'use strict';

var debug = require('debug')('secc:routes:daemonIndex');

module.exports = function(express, socket, SECC, DAEMON) {
  var router = express.Router();

  router.get('/', function(req, res) {
    res.send('Hello World :) in Daemon.');
  });

  return router;
};