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
var om = SCHEDULER.om = require('./lib/optionmanager.js')();

//SECC.
if (typeof SECC.archivePath === 'undefined')
  SECC.archivePath = path.join(__dirname, 'archive');

//WebSocket
var schedulerWebSocket = require('./routes/schedulerWebSocket')(express, io, SECC, SCHEDULER);

//routers.
var schedulerIndex = require('./routes/schedulerIndex')(express, io, SECC, SCHEDULER);
var schedulerArchive = require('./routes/schedulerArchive')(express, io, SECC, SCHEDULER);
var schedulerCache = require('./routes/schedulerCache')(express, io, SECC, SCHEDULER);
var schedulerDaemon = require('./routes/schedulerDaemon')(express, io, SECC, SCHEDULER);
var schedulerJob = require('./routes/schedulerJob')(express, io, SECC, SCHEDULER);
var schedulerOption = require('./routes/schedulerOption')(express, io, SECC, SCHEDULER);

app.use('/', schedulerIndex);
app.use('/archive/', schedulerArchive);
app.use('/cache/', schedulerCache);
app.use('/daemon/', schedulerDaemon);
app.use('/job/', schedulerJob);
app.use('/option/', schedulerOption);

server.listen(SECC.scheduler.port, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('secc-scheduler listening at http://%s:%s', host, port);
});
