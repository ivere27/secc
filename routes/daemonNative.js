'use strict';

var debug = require('debug')('secc:' + process.pid + ':routes:daemonNative');

var environment = require('../lib/environment.js');

module.exports = function (express, SECC, DAEMON) {
  var router = express.Router();

  var Archives = DAEMON.Archives;
  var redisClient = DAEMON.redisClient;

  router.get('/system', function (req, res) {
    var systemInformation = environment.getSystemInformation();

    systemInformation.archive = DAEMON.Archives.localArchives;
    systemInformation.daemonId = DAEMON.daemonId;

    res.send(systemInformation);
  });

  return router;
};
