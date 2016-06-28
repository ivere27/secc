'use strict';

var debug = require('debug')('secc:routes:schedulerDaemon');

module.exports = function(express, io, SECC, SCHEDULER) {
  var router = express.Router();

  var dm = SCHEDULER.dm;

  router.get('/', function(req, res) {
    res.json(dm.getDaemonList());
  });

  return router;
};
