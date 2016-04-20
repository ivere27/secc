'use strict';

var path = require('path');
var archivePath = path.join(__dirname, "archive");
var uploadPath = path.join(__dirname, "uploads");
var SECC = require('./settings.json');

SECC.archivePath = archivePath;
SECC.uploadPath = uploadPath;

var scheduler = require('./lib/scheduler')(SECC);

scheduler.startServer();