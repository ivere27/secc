'use strict';

var debug = require('debug')('secc:routes:schedulerCache');
var path = require('path');

module.exports = function(express, io, SECC, SCHEDULER) {
  var router = express.Router();

  var cm = SCHEDULER.cm;

  router.get('/', function (req, res) {
    res.json(cm.cacheList());
  });

  router.delete('/', function (req, res) {
    cm.clearCache();
    io.emit('clearCache', {});

    return res.send('cache cleared.');
  });

  return router;
};