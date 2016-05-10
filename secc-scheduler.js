'use strict';

var debug = require('debug')('secc-scheduler');

var SECC = require('./settings.json');
SECC.scheduler.port = process.env.SECC_PORT || SECC.scheduler.port;

var scheduler = require('./lib/scheduler')(SECC);

function success(msg) {
  debug(msg);
}

function failure(msg) {
  debug(msg);
  console.error(msg);
}

scheduler.startServer(success, failure);
