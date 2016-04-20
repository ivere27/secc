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
 * Scheduler Object.
 * 
 * @param {Settings} SECC
 */

var Scheduler = function(SECC) {
  if (!(this instanceof Scheduler)) {
    return new Scheduler(SECC);
  }

  if (typeof SECC === 'undefined') {
    console.log("SECC is null");
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

/**
 * Init http server
 */

Scheduler.prototype.initServer = function(callback) {
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
  var schedulerWebSocket = require(path.join(__dirname, '..', 'routes', 'schedulerWebSocket'))(express, io, SECC, SCHEDULER);
  var schedulerIndex     = require(path.join(__dirname, '..', 'routes', 'schedulerIndex'))(express, io, SECC, SCHEDULER);
  var schedulerArchive   = require(path.join(__dirname, '..', 'routes', 'schedulerArchive'))(express, io, SECC, SCHEDULER);
  var schedulerCache     = require(path.join(__dirname, '..', 'routes', 'schedulerCache'))(express, io, SECC, SCHEDULER);
  var schedulerDaemon    = require(path.join(__dirname, '..', 'routes', 'schedulerDaemon'))(express, io, SECC, SCHEDULER);
  var schedulerJob       = require(path.join(__dirname, '..', 'routes', 'schedulerJob'))(express, io, SECC, SCHEDULER);
  var schedulerOption    = require(path.join(__dirname, '..', 'routes', 'schedulerOption'))(express, io, SECC, SCHEDULER);

  app.use('/', schedulerIndex);
  app.use('/archive/', schedulerArchive);
  app.use('/cache/', schedulerCache);
  app.use('/daemon/', schedulerDaemon);
  app.use('/job/', schedulerJob);
  app.use('/option/', schedulerOption);

  callback();
}


/**
 * Start scheduer method
 */
Scheduler.prototype.startServer = function() {
  var self = this;

  self.initServer(function(){
    var SECC = self.SECC || false;
    var server = self.server || false;

    if(!SECC || !server) {
      console.log("Object is null");
      return;
    }

    // Server start listening
    server.listen(SECC.scheduler.port, function() {
      var host = server.address().address;
      var port = server.address().port;

      console.log('secc-scheduler listening at http://%s:%s', host, port);
    });

    // Server connection event
    server.on('connection', function (socket) {
      // Add a newly connected socket
      var socketId = self.nextSocketId++;
      self.sockets[socketId] = socket;
      console.log('socket', socketId, 'opened');

      // Remove the socket when it closes
      socket.on('close', function () {
        console.log('socket', socketId, 'closed');
        delete self.sockets[socketId];
      });
    });

  });
}


/**
 * Stop scheduer method
 */
Scheduler.prototype.stopServer = function() {
  var self = this;

  if(self.server) {
    // Before close is called, it check handle===0 && connections===0.
    // If connections exist, do not working close event.
    self.server.getConnections(function(err, count) {
      console.log("connections:"+count);

      if (count) {
        // destroy all sockes
        for (var socketId in self.sockets) {
          console.log('socket', socketId, 'destroyed');
          self.sockets[socketId].destroy();
        }

        self.server.close(function(){
          console.log("Closed Server....");

          self.nextSocketId = 0;
        });
      }
    });
  }
}


module.exports = Scheduler;
