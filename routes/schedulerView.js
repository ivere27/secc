'use strict';

var debug = require('debug')('secc:routes:schedulerView');

module.exports = function (express, io, SECC, SCHEDULER) {
  var router = express.Router();

  router.get('/', function (req, res) {
    res.redirect('/view/star');
  });

  router.get('/star', function (req, res) {
    res.render('schedulerViewStar');
  });

  router.get('/cluster', function (req, res) {
    res.render('schedulerViewCluster');
  });

  return router;
};
