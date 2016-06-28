'use strict';

var debug = require('debug')('secc:routes:schedulerIndex');

module.exports = function(express, io, SECC, SCHEDULER) {
  var router = express.Router();

  router.get('/', function(req, res) {
    res.redirect('/view');
  });

  return router;
};
