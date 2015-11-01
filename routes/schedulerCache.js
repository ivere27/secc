var debug = require('debug')('secc:routes:schedulerArchive');

var path = require('path');

module.exports = function(express, io, SECC, SCHEDULER) {
  var router = express.Router();

  var cm = SCHEDULER.cm;

  router.get('/', function (req, res) {
    res.json(cm.cacheList());
  })

  router.delete('/', function (req, res) {
    process.nextTick(function(){
      cm.clearCache();
      io.emit('clearCache', {});      
    });

    return res.send('cache cleared.');
  })

  return router;
};