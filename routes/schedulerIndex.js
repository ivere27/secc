var debug = require('debug')('secc:routes:schedulerIndex');

module.exports = function(express, io, SECC, SCHEDULER) {
  var router = express.Router();

  var am = SCHEDULER.am;
  var cm = SCHEDULER.cm;
  var dm = SCHEDULER.dm;

  router.get('/', function(req, res) {
    res.render('schedulerIndex', {a: 42});
  });

  return router;
};