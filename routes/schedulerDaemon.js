var debug = require('debug')('secc:routes:schedulerDaemon');

var path = require('path');

module.exports = function(express, io, SECC, SCHEDULER) {
  var router = express.Router();

  var dm = SCHEDULER.dm;

  router.get('/', function (req, res) {
    res.json(dm.getDaemonList());
  })

  return router;
};