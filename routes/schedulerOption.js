'use strict';

var debug = require('debug')('secc:routes:schedulerOption');

var path = require('path');

module.exports = function(express, io, SECC, SCHEDULER) {
  var router = express.Router();

  var om = SCHEDULER.om;

  router.post('/analyze', function (req, res) {
    res.send('not implemented');
  });

  router.get('/gcc', function (req, res) {
    res.json(om.gccOptionList());
  });

  router.get('/gcc/index', function (req, res) {
    res.json(om.gccOptionIndexList());
  });

  return router;
};