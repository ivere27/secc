
var path = require('path');

var debug = require('debug')('secc:scheduler');
var SECC = require(path.join(__dirname, '..', 'settings.json'));

var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var bodyParser = require('body-parser');
var multer  = require('multer')
var compression = require('compression')
var upload = multer({dest:'./uploads/'}).single('archiveFile');

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

//SECC.
if (typeof SECC.archivePath === 'undefined') {
  SECC.archivePath = path.join(__dirname, '..', 'archive');
}

//WebSocket
var schedulerWebSocket = require(path.join('..', 'routes', 'schedulerWebSocket'))(express, io, SECC, SCHEDULER);

//routers.
var schedulerIndex 	 = require(path.join('..', 'routes', 'schedulerIndex'))(express, io, SECC, SCHEDULER);
var schedulerArchive = require(path.join('..', 'routes', 'schedulerArchive'))(express, io, SECC, SCHEDULER);
var schedulerCache 	 = require(path.join('..', 'routes', 'schedulerCache'))(express, io, SECC, SCHEDULER);
var schedulerDaemon  = require(path.join('..', 'routes', 'schedulerDaemon'))(express, io, SECC, SCHEDULER);
var schedulerJob 	 = require(path.join('..', 'routes', 'schedulerJob'))(express, io, SECC, SCHEDULER);
var schedulerOption  = require(path.join('..', 'routes', 'schedulerOption'))(express, io, SECC, SCHEDULER);

app.use('/', schedulerIndex);
app.use('/archive/', schedulerArchive);
app.use('/cache/', schedulerCache);
app.use('/daemon/', schedulerDaemon);
app.use('/job/', schedulerJob);
app.use('/option/', schedulerOption);

//add secc settings to server object
server.SECC = SECC;

module.exports = server;