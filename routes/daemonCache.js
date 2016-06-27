'use strict';

var debug = require('debug')('secc:' + process.pid + ':routes:daemonCompilePreprocessed');

var querystring = require('querystring');
var stream = require('stream');

var utils = require('../lib/utils.js');

module.exports = function (express, SECC, DAEMON) {
  var router = express.Router();

  var redisClient = DAEMON.redisClient;

  router.get('/:archiveId/:preprocessedHash/:argvHash', function (req, res) {
    // cache
    if (!SECC.daemon.cache || !redisClient)
      res.status(400).send('cache is not enabled.');

    var jobId = req.headers['secc-jobid'];
    var archiveId = req.params.archiveId;
    var preprocessedHash = req.params.preprocessedHash;
    var argvHash = req.params.argvHash;

    var redisKey = utils.getCacheKey(archiveId, preprocessedHash, argvHash);

    debug('cache is requested. key : %s', redisKey);

    redisClient.hgetall(redisKey, function (err, obj) {
      if (err)
        res.status(400).send(err);

      var metaData = {
        key: redisKey,
        jobId: jobId,
        archiveId: archiveId,
        preprocessedHash: preprocessedHash,
        argvHash: argvHash
      };

      var responseError = function () {
        debug('cache not exists.');
        DAEMON.worker.emitToScheduler('cacheNotExists', metaData);

        return res.status(400).send('object cache not exists');
      };

      // nothing or broken data(possibly deleted 'cos of allkeys-lru)
      try {
        obj['info'] = JSON.parse(obj['info']);
        obj['info']['chunkCount'] |= 0;
      } catch(err) {
        return responseError();
      }

      var readable = new stream.Readable();
      for (var i = 0; i < obj['info']['chunkCount'];i++) {
        if (obj['chunk' + i] === undefined)
          return responseError();
        readable.push(obj['chunk' + i]); // FIXME : need to make a stream.
      }
      readable.push(null);

      // obj['stdout'] is not stored when it is omited.
      if (obj['info']['stdout'])
        res.setHeader('secc-stdout', querystring.escape(obj['info']['stdout']));
      if (obj['info']['stderr'])
        res.setHeader('secc-stderr', querystring.escape(obj['info']['stderr']));

      debug('hit the cache.');
      debug(metaData);
      res.attachment('cache.tar.gz'); // FIXME : better naming?
      res.writeHead(200);

      readable.pipe(res);

      DAEMON.worker.emitToScheduler('cacheExists', metaData);
    });
  });

  return router;
};
