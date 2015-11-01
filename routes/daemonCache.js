var debug = require('debug')('secc:routes:daemonCompilePreprocessed');

var mkdirp = require('mkdirp');
var path = require('path');
var zlib = require('zlib');
var querystring = require('querystring');
var stream = require('stream');

var compile = require('../lib/compile.js');
var environment = require('../lib/environment.js');
var utils = require('../lib/utils.js');

module.exports = function(express, socket, SECC, DAEMON) {
  var router = express.Router();

  var Archives = DAEMON.Archives;
  var redisClient = DAEMON.redisClient;

  router.get('/:archiveId/:preprocessedHash/:argvHash', function (req, res) {
    //cache
    if (!SECC.daemon.cache || !redisClient)
      res.status(400).send('cache is not enabled.')

    var jobId = req.headers['secc-jobid'];
    var archiveId = req.params.archiveId;
    var preprocessedHash = req.params.preprocessedHash;
    var argvHash = req.params.argvHash;

    var redisKey = 'cache/' + archiveId + '/' + preprocessedHash + '/' + argvHash;    

    debug('cache is requested. key : %s', redisKey);

    redisClient.hgetall(redisKey, function(err, obj){
      if (err)
        res.status(400).send(err);

      var metaData = { key : redisKey
                 , jobId : jobId
                 , archiveId : archiveId
                 , preprocessedHash: preprocessedHash
                 , argvHash : argvHash};

      var responseError = function() {
        debug('cache not exists.')
        if (socket.connected) socket.emit('cacheNotExists', metaData);

        return res.status(400).send('object cache not exists');        
      }

      //nothing or data error.
      if (obj === null 
        || (typeof obj['chunkCount'] === 'undefined')
        || (typeof obj['stdout'] === 'undefined')
        || (typeof obj['stderr'] === 'undefined'))
        return responseError();

      var chunkCount = parseInt(obj['chunkCount'].toString());

      for (var i = 0; i<chunkCount;i++) {
        if (typeof obj['chunk' + i] === 'undefined')
          return responseError();
      }

      //obj['stderr'] is stored as String 'undefined' in redis.
      if (obj['stdout'].toString() !== 'undefined')
        res.setHeader('SECC-stdout', querystring.escape(obj['stdout']));
      if (obj['stderr'].toString() !== 'undefined')
        res.setHeader('SECC-stderr', querystring.escape(obj['stderr']));

      debug('hit the cache.');
      debug(metaData);
      res.attachment('cache.tar'); //FIXME : better naming?
      res.writeHead(200);

      var readable = new stream.Readable();
      for (var i = 0; i<chunkCount;i++) {
        //debug(i);
        //debug(obj['chunk' + i]);
        readable.push(obj['chunk' + i]);  //FIXME : need to make a stream.
      }
      readable.push(null);

      readable.pipe(res);

      if (socket.connected) socket.emit('cacheExists', metaData);
    });

  })

  return router;
};