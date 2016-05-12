'use strict';

var debug = require('debug')('secc:'+process.pid+':daemon');

var utils = require('./lib/utils.js');

var cluster = require('cluster');
var crypto = require('crypto');
var os = require('os');
var path = require('path');

var SECC = require('./settings.json');

//override settings
SECC.daemon.cache = process.env.SECC_CACHE
                  ? ((process.env.SECC_CACHE == 1) ? true : false)
                  : SECC.daemon.cache;
SECC.daemon.port = process.env.SECC_DAEMON_PORT || SECC.daemon.port;
SECC.daemon.expose.address = process.env.SECC_EXPOSE_ADDRESS || SECC.daemon.expose.address;
SECC.daemon.expose.port = process.env.SECC_EXPOSE_PORT
                        || (utils.isLegalPort(SECC.daemon.expose.port)
                          ? SECC.daemon.expose.port
                          : SECC.daemon.port);
SECC.daemon.scheduler.address = process.env.SECC_ADDRESS || SECC.daemon.scheduler.address;
SECC.daemon.scheduler.port = process.env.SECC_PORT || SECC.daemon.scheduler.port;
SECC.daemon.redis.address = process.env.REDIS_ADDRESS || SECC.daemon.redis.address;
SECC.daemon.redis.port = process.env.REDIS_PORT || SECC.daemon.redis.port;

if (!SECC.runPath || SECC.runPath === '')
  SECC.runPath = path.join(os.tmpdir(), 'secc', 'run');
if (!SECC.uploadPath || SECC.uploadPath === '')
  SECC.uploadPath = path.join(os.tmpdir(), 'secc', 'upload');
if (!SECC.toolPath || SECC.toolPath === '')
    SECC.toolPath = path.join(__dirname, 'tool');

require('mkdirp').sync(SECC.runPath);
require('mkdirp').sync(SECC.uploadPath);

if (cluster.isMaster) {
  debug = require('debug')('secc:'+process.pid+':daemon:master');

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
      console.log("maxmemory : %d MB(%s bytes) - redisClient : %s", parseInt(maxmemory/(1024*1024)), maxmemory, replay.toString());
    });
    redisClient.send_command("config", ['set','maxmemory-policy', maxmemoryPolicy], function(err,replay){
      if (err)
        return debug(err);
      console.log("maxmemory-policy : %s - redisClient : %s", maxmemoryPolicy, replay.toString());
    });
  }

  //runtime global val.
  var DAEMON = {
    redisClient : redisClient,
    loadReportTimer : null
  }
  DAEMON.broadcast = function(event, data) {
   Object.keys(cluster.workers).forEach(function(id) {
      cluster.workers[id].send({event: event, data: data});
    });
  }

  //WebSocket.
  var schedulerUrl = 'http://' + SECC.daemon.scheduler.address + ':' + SECC.daemon.scheduler.port;
  var socket = require('socket.io-client')(schedulerUrl);

  var daemonWebSocket = require('./routes/daemonWebSocket')(socket, SECC, DAEMON);
  var am = require('./lib/daemonArchiveManager.js')(socket, SECC, DAEMON)

  var clusterMessageHandler = function(worker, msg) {
    if (msg.type && msg.type === 'b') { // boradcast to workers.
     Object.keys(cluster.workers).forEach(function(id) {
        if (cluster.workers[id] === worker) return;

        cluster.workers[id].send({event: msg.event, data: msg.data});
      });
    } else if (msg.type && msg.type === 's') { // emit to scheduler
      socket.emit(msg.event, msg.data);
    } else if (msg.type && msg.type === 'm') { // emit to master
      if (msg.event === 'requestInstallArchive') {
        am.installArchive(msg.data.archiveId)
      }
    } else {
      debug('unknown message type.');
      debug(msg);
    }
  };

  for (var i = 0; i < os.cpus().length; i++)
    cluster.fork();

  Object.keys(cluster.workers).forEach(function(id) {
    cluster.workers[id].on('message', function(msg) {
      clusterMessageHandler(cluster.workers[id], msg);
    });
  });

  cluster.on('exit', function(worker, code, signal) {
    console.log('worker ' + worker.process.pid + ' died');
    var worker = cluster.fork();
    worker.on('message', function(msg){
      return clusterMessageHandler(worker, msg);
    });
  });
}

if (cluster.isWorker) {
  debug = require('debug')('secc:'+process.pid+':daemon:' + cluster.worker.id);

  var express = require('express');
  var app = express();
  var bodyParser = require('body-parser');
  var compression = require('compression')
  var multer  = require('multer')
  var upload = multer({dest:SECC.uploadPath}).single('source');

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

  //runtime global val.
  var DAEMON = {
    worker : cluster.worker,
    redisClient : redisClient,
    Archives : {
      schedulerArchives : [],

      localPrepArchiveId : {},
      localPrepArchiveIdInProgress : {},

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
  cluster.worker.emitToMaster = function(event, data) {
    cluster.worker.send({type:'m', event: event, data: data});
  }
  // send data to scheduler(through the master )
  cluster.worker.emitToScheduler = function(event, data) {
    cluster.worker.send({type:'s', event: event, data: data});
  }

  cluster.worker.on('message', function(msg) {
    debug(msg);
    if (msg.event === 'addLocalPrepArchiveIdInProgress') {
      DAEMON.Archives.localPrepArchiveIdInProgress[msg.data.archiveId] = new Date();
    } else if (msg.event === 'removeLocalPrepArchiveIdInProgress') {
      delete DAEMON.Archives.localPrepArchiveIdInProgress[msg.data.archiveId];
    } else if (msg.event === 'addLocalPrepArchiveId') {
      DAEMON.Archives.localPrepArchiveId[msg.data.archiveId] = new Date();
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

    console.log('SECC listening at http://%s:%s', host, port);
  });

}