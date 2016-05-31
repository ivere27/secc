'use strict';

var debug = require('debug')('secc:routes:schedulerOption');
var utils = require('../lib/utils');

module.exports = function(express, io, SECC, SCHEDULER) {
  var router = express.Router();

  var om = SCHEDULER.om;

  router.post('/analyze', function (req, res) {
    var json = req.body;

    if (typeof json !== 'object'
      || !Array.isArray(json.argv)
      || typeof json.driver === 'undefined'
      || typeof json.cwd === 'undefined'
      || typeof json.mode === 'undefined'
      ) {
      return res.status(400).send('invalid options');
    }
    var data = om.analyzeArguments(json.argv, json.driver, json.cwd, json.mode);

    if (req.headers['accept'] === 'text/plain')
      res.send(utils.ObjectToText(data));
    else
      res.send(data);
  });

  router.get('/gcc', function (req, res) {
    res.json(om.gccOptionList());
  });

  router.get('/gcc/index', function (req, res) {
    res.json(om.gccOptionIndexList());
  });

  return router;
};