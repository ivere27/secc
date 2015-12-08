'use strict';

var debug = require('debug')('secc:scheduler');
var SECC = require('./settings.json');

var path = require('path');

var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var bodyParser = require('body-parser');
var multer  = require('multer')
var compression = require('compression')
var upload = multer({dest:'./uploads/'}).single('archiveFile');

app.set('views', './views');
app.set('view engine', 'ejs');
app.use(express.static('views'));
app.use(express.static('public'));

app.use(compression());
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.text()); // for parsing text/plain
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(upload); // for parsing multipart/form-data
app.use(require('morgan')('combined'));

app.use(function(err, req, res, next) {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

//app.use(compression);
var SCHEDULER = {};
var am = SCHEDULER.am = require('./lib/archivemanager.js')(express, io, SECC, SCHEDULER);
var cm = SCHEDULER.cm = require('./lib/cachemanager.js')(express, io, SECC), SCHEDULER;
var dm = SCHEDULER.dm = require('./lib/daemonmanager.js')(express, io, SECC, SCHEDULER);
var jm = SCHEDULER.jm = require('./lib/jobmanager.js')(express, io, SECC, SCHEDULER);

//SECC.
if (typeof SECC.archivePath === 'undefined')
  SECC.archivePath = path.join(__dirname, 'archive');

//routers.
var schedulerIndex = require('./routes/schedulerIndex')(express, io, SECC, SCHEDULER);
var schedulerArchive = require('./routes/schedulerArchive')(express, io, SECC, SCHEDULER);
var schedulerCache = require('./routes/schedulerCache')(express, io, SECC, SCHEDULER);
var schedulerDaemon = require('./routes/schedulerDaemon')(express, io, SECC, SCHEDULER);
var schedulerJob = require('./routes/schedulerJob')(express, io, SECC, SCHEDULER);

app.use('/', schedulerIndex);
app.use('/archive/', schedulerArchive);
app.use('/cache/', schedulerCache);
app.use('/daemon/', schedulerDaemon);
app.use('/job/', schedulerJob);

//sockets.
io.on('connection', function(socket){
  debug('io connect!!! %s', socket.id);
  var newDaemon = { id: socket.id, 
    jobs: 0, maxJobs: 0, type: 'guest', 
    daemonAddress : socket.handshake.address };
  dm.addDaemon(newDaemon);
  
  //send current Archives
  socket.emit('schedulerArchives', am.getArchiveList());
  socket.emit('daemonList', dm.getDaemonList());

  socket.on('connect', function(){
    debug('io connect.');

    socket.emit('event', { hello: 'world' });
  });
  socket.on('disconnect', function(){
    debug('io disconnect!!! %s', socket.id);
    cm.removeDaemon(socket.id);
    dm.removeDaemon(socket.id);
    jm.removeDaemon(socket.id);
  });
  socket.on('event', function(metaData){
    debug(metaData);
  });

  socket.on('systemInformation', function(metaData){
    dm.setDaemonSystemInformation(socket.id
      , {system : metaData, type:'daemon',maxJobs : metaData.numCPUs});
    io.emit('daemonList', dm.getDaemonList());

    debug('daemonList');
    debug(SCHEDULER.dm.getDaemonList());
  });  

  //JOBs
  socket.on('compileBefore', function(metaData){
    debug(metaData);
    dm.increaseJobCount(socket.id);

    if (metaData.jobId) {
      io.emit("compileBefore", {daemonId : socket.id, jobId : metaData.jobId, timestamp: new Date()});
    }
  });
  socket.on('compileAfter', function(metaData){
    debug(metaData);
    dm.decreaseJobCount(socket.id);

    if (metaData.jobId) {
      jm.removeJob(metaData.jobId);
      io.emit("compileAfter", {daemonId : socket.id, jobId : metaData.jobId, timestamp: new Date()});
    }
  });
  socket.on('compileLocal', function(metaData){
    debug(metaData);
    if (metaData.jobId) {
      jm.removeJob(metaData.jobId);
      io.emit("compileLocal", {daemonId : socket.id, jobId : metaData.jobId, timestamp: new Date()});
    }
  });

  //cache
  socket.on('cacheStored', function(metaData){
    cm.newCache(socket.id, metaData)
    debug(metaData);
  });
  socket.on('cacheExists', function(metaData){
    cm.removeCache(socket.id, metaData);

    if (metaData.jobId) {
      jm.removeJob(metaData.jobId);
      io.emit("cacheHitSucceeded", {daemonId : socket.id, jobId : metaData.jobId, timestamp: new Date()});
    }
    debug(metaData);
  });
  socket.on('cacheNotExists', function(metaData){
    cm.removeCache(socket.id, metaData);

    if (metaData.jobId) {
      io.emit("cacheHitFailed", {daemonId : socket.id, jobId : metaData.jobId, timestamp: new Date()});
    }
    debug(metaData);
  });

});

server.listen(SECC.scheduler.port, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('secc-scheduler listening at http://%s:%s', host, port);
});
