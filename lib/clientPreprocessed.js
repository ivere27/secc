var debug = require('debug')('secc:lib:clientPreprocessed');
var zlib = require('zlib');
var path = require('path');
var querystring = require('querystring');
var fs = require("fs");
var http = require("http");
var crypto = require('crypto');

var async = require('async');
var compile = require('./compile.js');
var environment = require('./environment.js');

module.exports.performPreprocessedMode = function(JOB, SECC, cb) {
  debug('performPreprocessedMode');


  async.waterfall([
    function(callback) {
      var options = {compiler: JOB.compilerPath, argv: JOB.argv};
      var preprocessedStream = compile.GeneratePreprocessed(JOB.sourcePath, options);
      preprocessedStream.on('finish', function(err, preprocessedHash) {
        if (err) return callback(err);  //GeneratePreprocessed error.

        JOB.preprocessedHash = preprocessedHash;
        callback(null, preprocessedStream);
      });
    },

    function(preprocessedStream, callback) {
      JOB.newArgv = compile.newPreprocessedArgvRemoved(JOB.argv, JOB.sourcePath);
      JOB.argvHash = crypto.createHash('md5').update(JSON.stringify(JOB.newArgv)).digest("hex");

      //ask who.
      var formData = {
        systemInformation : environment.getSystemInformation(SECC),
        compilerInformation : JOB.compilerInformation,
        mode : JOB.mode,
        projectId: JOB.projectId,
        cachePrefered : JOB.cachePrefered,
        sourcePath : JOB.sourcePath,
        sourceHash: JOB.preprocessedHash,
        argvHash : JOB.argvHash
      }; 
     
      debug('sourceHash : %s , argvHash : %s', JOB.preprocessedHash, JOB.argvHash);        
      var options = {
        hostname: SECC.client.scheduler.address,
        port: SECC.client.scheduler.port,
        path: '/job/new',
        method: 'POST',
        headers : {'Content-Type': 'application/json'}
      };

      var req = http.request(options);
      req.on('error', function(err) {return callback(err);})
      req.setTimeout(10000, function(){
        return this.emit('error', new Error('Timeout in request /job/new'));
      });
      req.on('response', function (res) {
        if(res.statusCode !== 200 
          || res.headers['content-type'].indexOf('application/json') === -1) {
          this.abort();
          return this.emit('error', new Error('Error raised in who request'));
        }

        var data = '';
        res.on('data', function (chunk) {
          data += chunk;
        });

        res.on('end', function(){
          var json = JSON.parse(data);
          JOB.id = json.jobId;
          JOB.local = json.local;
          JOB.cacheAvailable = json.cache;
          JOB.daemon = json.daemon;
          JOB.archive = json.archive;

          if (JOB.local)
            return callback(new Error('Build local from scheduler.'));

          debug('remote daemon information - daemonId : %s , ip : %s , hostname : %s'
            , JOB.daemon.id, JOB.daemon.daemonAddress, JOB.daemon.system.hostname);
          debug('archiveId : %s , %s ,  %s', JOB.archive.archiveId
            , JOB.archive.dumpversion, JOB.archive.dumpmachine);

          if (JOB.cachePrefered == true && JOB.cacheAvailable == true) { //oh, cache~
            var options = {
              hostname: JOB.daemon.daemonAddress,
              port: JOB.daemon.system.port,
              path: '/cache/' + JOB.archive.archiveId 
                    +'/' + JOB.preprocessedHash + '/' + JOB.argvHash,
              headers: {
                'secc-jobid' : JOB.id
              },
              method: 'GET'
            };

            debug('cache is available. try URL : %s', options.path);

            var cacheReq = http.request(options);
            cacheReq.on('error', function(err) { //on error, go next(cache failed)
              debug('cache hit failed. run request normal compile.')
              return callback(null, false, preprocessedStream);
            }); 
            cacheReq.setTimeout(10000, function(){
                return this.emit('error', new Error('Timeout in request cache'));
            });
            cacheReq.on('response', function(res) { 
              if(res.statusCode !== 200) {
                this.abort();
                return this.emit('error', new Error('remote cache hit failed'));
              }

              if (typeof res.headers['secc-stdout'] !== 'undefined')
                process.stdout.write(querystring.unescape(res.headers['secc-stdout']));
              if (typeof res.headers['secc-stderr'] !== 'undefined')
                process.stderr.write(querystring.unescape(res.headers['secc-stderr']));

              //download well.
              var extract = require('tar').Extract({path: path.dirname(JOB.outputPath)});
              extract.on('error', function(err) {debug(err); return callback(err);});
              extract.on('end',function(){
                debug('download and extract done. from cache.');
                return callback(null, true, preprocessedStream);
              });

              res.pipe(extract);
            });
            cacheReq.end();

          } else {
            callback(null, false, preprocessedStream);
          }

        });
      });
      req.write(JSON.stringify(formData));
      req.end();

    },

    // and which daemon is available,
    function(cached, preprocessedStream, callback) {
      if (cached) 
        return callback(null); //by-pass if cached which means already processed.

      var gzip = zlib.createGzip({level: 1}) //FIXME : zlib.Z_BEST_SPEED

      //FIXME : need to improve.
      var compiler = JOB.command;
      var language = compile.determineLanguage(JOB.command, JOB.compilerPath, JOB.sourcePath);
      
      debug(JOB.newArgv);
      debug('language : %s', language);

      //FIXME : this happens when new remote daemon is on.
      if (typeof JOB.daemon.system === 'undefined')
        return callback(new Error('remote daemon Error')); 

      var options = {
        hostname: JOB.daemon.daemonAddress,
        port: JOB.daemon.system.port,
        path: '/compile/preprocessed/' + JOB.archive.archiveId,
        method: 'POST',
        headers: {
          'Content-Encoding' : 'gzip',
          'secc-jobid' : JOB.id,
          'secc-compiler' : compiler,
          'secc-language' : language,
          'secc-argv' : JSON.stringify(JOB.newArgv),
          'secc-filename' : path.basename(JOB.outputPath, path.extname(JOB.outputPath))
        },
        encoding: null //avoid converting the downloaded body to a string and keep it in a binary buffer
      };

      var req = http.request(options);
      req.on('error', function(err) {return callback(err);})
      req.setTimeout(60000, function(){
          return this.emit('error', new Error('Timeout in request compilePreprocessed'));
      });
      req.on('response', function(res) { 
        if (typeof res.headers['secc-stdout'] !== 'undefined')
          process.stdout.write(querystring.unescape(res.headers['secc-stdout']));
        if (typeof res.headers['secc-stderr'] !== 'undefined')
          process.stderr.write(querystring.unescape(res.headers['secc-stderr']));

        if(res.statusCode !== 200 || res.headers['secc-code'] !== '0') {
          debug(res.headers['secc-code']);
          this.abort();
          return this.emit('error', new Error('remote compile daemon exited with non-zero'));
        }

        //download well.
        var extract = require('tar').Extract({path: path.dirname(JOB.outputPath)});
        extract.on('error', function(err) {debug(err); return callback(err);});
        extract.on('end',function(){
          debug('download and extract done.');
          return callback(null);
        });

        res.pipe(extract);
      });

      //pipe magic
      return preprocessedStream
        .pipe(gzip).on('error', function(err) {return callback(err);})
        .pipe(req);
    }
    ]
    ,function(err){
      if(err)
        return cb(err);
      return cb(null);
    });
};