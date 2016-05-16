'use strict';

var debug = require('debug')('secc:'+process.pid+':routes:daemonNative');

var environment = require('../lib/environment.js');

module.exports = function(express, SECC, DAEMON) {
  var router = express.Router();

  var Archives = DAEMON.Archives;
  var redisClient = DAEMON.redisClient;

  router.get('/system', function (req, res) {
    environment.getGccClangCompilerInformation(function(err, results) {
      if(err)
        return res.status(400).send();

      var systemInformation = environment.getSystemInformation();

      if(results.gcc)
        systemInformation.gcc = results.gcc;

      if(results.clang)
        systemInformation.clang = results.clang;

      systemInformation.daemonId = DAEMON.daemonId;

      res.send(systemInformation);
    });
  });

  return router;
};