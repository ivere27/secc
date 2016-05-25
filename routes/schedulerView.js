'use strict';

var debug = require('debug')('secc:routes:schedulerView');

module.exports = function(express, io, SECC, SCHEDULER) {
  var router = express.Router();

  var am = SCHEDULER.am;
  var cm = SCHEDULER.cm;
  var dm = SCHEDULER.dm;

  router.get('/', function(req, res) {
    res.redirect('/view/star');
  });

  router.get('/star', function(req, res) {
    res.render('schedulerViewStar');
  });

  return router;
};