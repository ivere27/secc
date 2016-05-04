'use strict';

var debug = require('debug')('secc-scheduler');

var path = require('path');
var archivePath = path.join(__dirname, "archive");
var uploadPath = path.join(__dirname, "uploads");
var SECC = require('./settings.json');

SECC.scheduler.port = process.env.SECC_PORT || SECC.scheduler.port;
SECC.archivePath = archivePath;
SECC.uploadPath = uploadPath;

var scheduler = require('./lib/scheduler')(SECC);

function success(msg) {
  debug(msg);
}

function failure(msg) {
  debug(msg);
  console.error(msg);
}

scheduler.startServer(success, failure);
