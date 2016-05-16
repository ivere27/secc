'use strict';

var debug = require('debug')('secc:'+process.pid+':routes:daemonIndex');

module.exports = function(express, SECC, DAEMON) {
  var router = express.Router();

  router.get('/', function(req, res) {
    res.send('Hello World :) in Daemon.');
  });

  return router;
};