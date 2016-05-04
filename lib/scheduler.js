'use strict';

/**
 * Module dependenices.
 */

var debug = require('debug')('secc:scheduler');
var path = require('path');

var bodyParser = require('body-parser');
var compression = require('compression');
var express = require('express');
var multer  = require('multer');

/**
 * Exports scheduler.
 */

module.exports = Scheduler;


/**
 * Scheduler Object.
 *
 * @param {Settings} SECC
 */

function Scheduler(SECC) {
  if (!(this instanceof Scheduler)) {
    return new Scheduler(SECC);
  }

  this.SECC = SECC || {scheduler : { port: process.env.SECC_PORT || 10509}};
  this.SECC.archivePath = this.SECC.archivePath || path.join(__dirname, '..', 'archive');
  this.SECC.uploadPath = this.SECC.uploadPath || path.join(__dirname, '..', 'uploads');
  this.SECC.experimental = this.SECC.experimental || {allowLocalDaemon : false};

  this.server = null;
  this.sockets = {};
  this.nextSocketId = 0;
}

function isEmptyObject(obj) {
  return (Object.keys(obj).length === 0);
}

/**
 * Init http server
 */

Scheduler.prototype.initServer = function(successCallback, failureCallback) {
  var self = this;

  if (!isEmptyObject(self.sockets))
    return failureCallback('Server is already initialized.');

  var SECC = this.SECC;
  var app = express();
  var server = require('http').Server(app);
  var io = require('socket.io')(server);
  var upload = multer({dest:SECC.uploadPath}).single('archiveFile');

  // set member variable
  this.server = server;

  app.set('views', path.join(__dirname, '..', 'views'));
  app.set('view engine', 'ejs');
  app.use(express.static(path.join(__dirname, '..', 'views')));
  app.use(express.static(path.join(__dirname, '..', 'public')));

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
  var am = SCHEDULER.am = require('./archivemanager.js')(express, io, SECC, SCHEDULER);
  var cm = SCHEDULER.cm = require('./cachemanager.js')(express, io, SECC), SCHEDULER;
  var dm = SCHEDULER.dm = require('./daemonmanager.js')(express, io, SECC, SCHEDULER);
  var jm = SCHEDULER.jm = require('./jobmanager.js')(express, io, SECC, SCHEDULER);
  var om = SCHEDULER.om = require('./optionmanager.js')();

  //WebSocket and routers
  var schedulerWebSocket = require('../routes/schedulerWebSocket')(express, io, SECC, SCHEDULER);
  var schedulerIndex = require('../routes/schedulerIndex')(express, io, SECC, SCHEDULER);
  var schedulerArchive = require('../routes/schedulerArchive')(express, io, SECC, SCHEDULER);
  var schedulerCache = require('../routes/schedulerCache')(express, io, SECC, SCHEDULER);
  var schedulerDaemon = require('../routes/schedulerDaemon')(express, io, SECC, SCHEDULER);
  var schedulerJob = require('../routes/schedulerJob')(express, io, SECC, SCHEDULER);
  var schedulerOption = require('../routes/schedulerOption')(express, io, SECC, SCHEDULER);

  app.use('/', schedulerIndex);
  app.use('/archive/', schedulerArchive);
  app.use('/cache/', schedulerCache);
  app.use('/daemon/', schedulerDaemon);
  app.use('/job/', schedulerJob);
  app.use('/option/', schedulerOption);

  successCallback('Server initialized');
}


/**
 * Start scheduer method
 */
Scheduler.prototype.startServer = function(successCallback, failureCallback) {
  var self = this;

  self.initServer(function(msg){
    debug(msg);

    var SECC = self.SECC;
    var server = self.server;

    if(!SECC || !server)
      return failureCallback('Server or SECC is null');

    // Server start listening
    server.on('error', failureCallback);  // in case of 'Error: listen EACCES'
    server.listen(SECC.scheduler.port, function() {
      var host = server.address().address;
      var port = server.address().port;

      console.log('secc-scheduler listening at http://%s:%s', host, port);

      // when server created successfully, call successCallback.
      server.removeListener('error', failureCallback);
      successCallback('Server has started');
    });

    // Server connection event
    server.on('connection', function (socket) {
      // Add a newly connected socket
      var socketId = self.nextSocketId++;
      self.sockets[socketId] = socket;

      // Remove the socket when it closes
      socket.on('close', function () {
        delete self.sockets[socketId];
      });
    });
  }, failureCallback);
}


/**
 * Stop scheduer method
 */
Scheduler.prototype.stopServer = function(successCallback, failureCallback) {
  var self = this;

  if(!isEmptyObject(self.sockets)) {
    // Before close is called, it check handle===0 && connections===0.
    // If connections exist, do not working close event.
    self.server.getConnections(function(err, count) {
      if (count) {
        // destroy all sockes
        for (var socketId in self.sockets) {
          self.sockets[socketId].destroy();
        }

        self.server.close(function(){
          debug('Server closed');

          self.nextSocketId = 0;
          self.server = null;
          self.sockets = {};

          successCallback('Server has stopped');
        });
      }
    }); // end getConnections
  } else {
    failureCallback('Server is already stopped');
  }
}

/* End of File */