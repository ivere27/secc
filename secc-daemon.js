'use strict';
var cluster = require('cluster');
var os = require('os');
var debug = require('debug')('secc:daemon');

if (cluster.isMaster) {
  var SECC = require('./settings.json');

  var redisClient = null;
  if (SECC.daemon.cache) { //cache enabled.
    debug('cache is enabled. set maxmemory and policy');
    redisClient =  require("redis").createClient( SECC.daemon.redis.port
                                                , SECC.daemon.redis.address
                                                , {'return_buffers': true});

    redisClient.on("error", function (err) {
      debug(err);
    });

    var maxmemoryPolicy = SECC.daemon.redis['maxmemory-policy'];
    var maxmemory = SECC.daemon.redis['maxmemory'] || "256MB";
    maxmemory = String(maxmemory);
    if (maxmemory.match(/KB$/))
      maxmemory = parseInt(maxmemory) * 1024;
    else if (maxmemory.match(/MB$/))
      maxmemory = parseInt(maxmemory) * 1024 * 1024;
    else if (maxmemory.match(/GB$/))
      maxmemory = parseInt(maxmemory) * 1024 * 1024 * 1024;
    else
      maxmemory = parseInt(maxmemory);

    redisClient.send_command("config", ['set','maxmemory', maxmemory], function(err,replay){
      if (err)
        return debug(err);
      debug("maxmemory : %d MB(%s bytes) - redisClient : %s", parseInt(maxmemory/(1024*1024)), maxmemory, replay.toString());
    });
    redisClient.send_command("config", ['set','maxmemory-policy', maxmemoryPolicy], function(err,replay){
      if (err)
        return debug(err);
      debug("maxmemory-policy : %s - redisClient : %s", maxmemoryPolicy, replay.toString());
    });
  }

  //runtime global val.
  var DAEMON = {
    redisClient : redisClient,
    loadReportTimer : null
  }

  //WebSocket.
  var schedulerUrl = 'http://' + SECC.daemon.scheduler.address + ':' + SECC.daemon.scheduler.port;
  var socket = require('socket.io-client')(schedulerUrl);

  var daemonWebSocket = require('./routes/daemonWebSocket')(socket, SECC, DAEMON);

  var clusterMessageHandler = function(worker, msg) {
    if (msg.type && msg.type === 'b') { // boradcast.
     Object.keys(cluster.workers).forEach(function(id) {
        if (cluster.workers[id] === worker) return;

        cluster.workers[id].send({event: msg.event, data: msg.data});
      });
    } else if (msg.type && msg.type === 'm') { // emit
      socket.emit(msg.event, msg.data);
    }
  };

  for (var i = 0; i < os.cpus().length; i++) {
    var worker = cluster.fork();
    worker.on('message', function(msg){
      return clusterMessageHandler(worker, msg);
    });
  }

  cluster.on('exit', function(worker, code, signal) {
    console.log('worker ' + worker.process.pid + ' died');
    var worker = cluster.fork();
    worker.on('message', function(msg){
      return clusterMessageHandler(worker, msg);
    });
  }); 
}

if (cluster.isWorker) {
  var SECC = require('./settings.json');
  var crypto = require('crypto');
  var path = require('path');

  var express = require('express');
  var app = express();
  var bodyParser = require('body-parser');
  var compression = require('compression')
  var multer  = require('multer')
  var upload = multer({dest:'./uploads/'}).single('source');

  var redisClient = null;
  if (SECC.daemon.cache) { //cache enabled.
    redisClient =  require("redis").createClient( SECC.daemon.redis.port
                                                , SECC.daemon.redis.address
                                                , {'return_buffers': true});

    redisClient.on("error", function (err) {
      debug(err);
    });
  }

  app.use(compression());
  app.use(bodyParser.json()); // for parsing application/json
  app.use(bodyParser.text()); // for parsing text/plain
  app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
  app.use(upload); // for parsing multipart/form-data

  var compile = require('./lib/compile.js');
  var environment = require('./lib/environment.js');
  var utils = require('./lib/utils.js');
  app.use(require('morgan')('combined'));

  app.use(function(err, req, res, next) {
    console.error(err.stack);
    res.status(500).send('Something broke!');
  });

  process.on('uncaughtException', function (err) {
    console.log('Caught exception: ');
    console.log(err.stack);
  });

  //SECC.
  if (typeof SECC.runPath === 'undefined')
    SECC.runPath = path.join(__dirname, 'run');
  if (typeof SECC.uploadsPath === 'undefined')
    SECC.uploadsPath = path.join(__dirname, 'uploads');
  if (typeof SECC.toolPath === 'undefined')
    SECC.toolPath = path.join(__dirname, 'tool');


  //runtime global val.
  var DAEMON = {
    worker : cluster.worker,
    redisClient : redisClient,
    Archives : {
      schedulerArchives : [],
      localPrepArchiveId : [],
      localPrepArchiveIdInProgress : [],

      //FIXME, currently store {pumpArchiveId, archive, archivePath}
      localPumpArchives : [],
      localPumpArchivesInProgress : []
    }
  }

  var schedulerUrl = 'http://' + SECC.daemon.scheduler.address + ':' + SECC.daemon.scheduler.port;
  var socket = require('socket.io-client')(schedulerUrl);

  // send data to all workers(except me)
  cluster.worker.broadcast = function(event, data) {
    cluster.worker.send({type:'b', event: event, data: data});
  }
  // send data to master
  cluster.worker.emit = function(event, data) {
    cluster.worker.send({type:'m', event: event, data: data});
  }
  cluster.worker.on('message', function(msg) {
    debug(msg);
    if (msg.event === 'addLocalPrepArchiveIdInProgress') {
      DAEMON.Archives.localPrepArchiveIdInProgress.push(msg.data.archiveId);
    } else if (msg.event === 'removeLocalPrepArchiveIdInProgress') {
      DAEMON.Archives.localPrepArchiveIdInProgress = 
        DAEMON.Archives.localPrepArchiveIdInProgress.filter(function(e){
          return e !== msg.data.archiveId;
        });
    } else if (msg.event === 'addLocalPrepArchiveId') {
      DAEMON.Archives.localPrepArchiveId.push(msg.data.archiveId);
    } else if (msg.event === 'addLocalPumpArchivesInProgress') {
      DAEMON.Archives.localPumpArchivesInProgress.push(msg.data.pumpArchive);
    } else if (msg.event === 'removeLocalPumpArchivesInProgress') {
      utils.removePumpArchiveInArray(DAEMON.Archives.localPumpArchivesInProgress, msg.data.pumpArchive.pumpArchiveId);
    } else if (msg.event === 'addLocalPumpArchives') {
      DAEMON.Archives.localPumpArchives.push(msg.data.pumpArchive);
    }
  });

  socket.on('schedulerArchives', function(data){
    //debug(data);
    DAEMON.Archives.schedulerArchives = data;
  });

  //routers.
  var daemonIndex = require('./routes/daemonIndex')(express, socket, SECC, DAEMON);
  var daemonNative = require('./routes/daemonNative')(express, socket, SECC, DAEMON);
  var daemonCache = require('./routes/daemonCache')(express, socket, SECC, DAEMON);
  var daemonCompilePreprocessed = require('./routes/daemonCompilePreprocessed')(express, socket, SECC, DAEMON);
  var daemonCompilePump = require('./routes/daemonCompilePump')(express, socket, SECC, DAEMON);

  app.use('/', daemonIndex);
  app.use('/native/', daemonNative);
  app.use('/cache/', daemonCache);
  app.use('/compile/preprocessed/', daemonCompilePreprocessed);
  app.use('/compile/pump/', daemonCompilePump);

  var server = app.listen(SECC.daemon.port, function () {
    var host = server.address().address;
    var port = server.address().port;

    //console.log(server);

    console.log('SECC listening at http://%s:%s', host, port);
  });

}