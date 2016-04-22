'use strict';

/**
 * Module dependenices.
 */

var debug = require('debug')('secc:scheduler');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
var multer  = require('multer')
var compression = require('compression')


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

  if (typeof SECC === 'undefined') {
    debug('SECC is null');
    return;
  }
  if (typeof SECC.archivePath === 'undefined') {
    SECC.archivePath = path.join(__dirname, '..', 'archive');
  }

  if (typeof SECC.uploadPath === 'undefined') {
    SECC.uploadPath = path.join(__dirname, '..', 'uploads');
  }

  this.SECC = SECC;
  this.server = null;
  this.sockets = {};
  this.nextSocketId = 0;
}

function isEmptyObject(obj) {
  return Object.keys(obj).length == 0 ? true : false;
}

/**
 * Init http server
 */

Scheduler.prototype.initServer = function(successCallback, failureCallback) {
  var self = this;

  if (!isEmptyObject(self.sockets)) {
    failureCallback('Already server is initialized.');
    return;
  }

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

  successCallback('Server is initialize');
}


/**
 * Start scheduer method
 */
Scheduler.prototype.startServer = function(successCallback, failureCallback) {
  var self = this;

  self.initServer(function(msg){
    debug(msg);

    var SECC = self.SECC || false;
    var server = self.server || false;

    if(!SECC || !server) {
      debug('Object is null');
      return;
    }

    // Server start listening
    server.listen(SECC.scheduler.port, function() {
      var host = server.address().address;
      var port = server.address().port;

      debug('secc-scheduler listening at http://%s:%s', host, port);
    });

    // Server connection event
    server.on('connection', function (socket) {
      // Add a newly connected socket
      var socketId = self.nextSocketId++;
      self.sockets[socketId] = socket;
      debug('socket', socketId, 'opened');

      // Remove the socket when it closes
      socket.on('close', function () {
        debug('socket', socketId, 'closed');
        delete self.sockets[socketId];
      });
    });

    // when server created successfully, call successCallback. 
    successCallback('Server is running!');

  }, function(msg) {
    failureCallback(msg);
  });
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
      debug('connections:'+count);

      if (count) {
        // destroy all sockes
        for (var socketId in self.sockets) {
          debug('socket', socketId, 'destroyed');
          self.sockets[socketId].destroy();
        }

        self.server.close(function(){
          debug('Closed Server....');

          self.nextSocketId = 0;
          self.server = null;
          self.sockets = {};

          successCallback('Server is stopping!');
        });
      }
    }); // end getConnections
  } else {
    failureCallback('Already server is stopped');
  }
}

/* End of File */