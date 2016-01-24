'use strict';

var debug = require('debug')('secc:'+process.pid+':lib:clientPreprocessed');
var zlib = require('zlib');
var path = require('path');
var querystring = require('querystring');
var fs = require("fs");
var http = require("http");
var crypto = require('crypto');

var async = require('async');
var compile = require('./compile.js');
var environment = require('./environment.js');

module.exports.performPreprocessedMode = function(job, settings, cb) {
  debug('performPreprocessedMode');


  async.waterfall([
    function(callback) {
      var options = { preprocessedInfile : job.preprocessedInfile,
                      compilerPath: job.compilerPath,
                      argv: job.localArgv};
      var preprocessedStream = compile.GeneratePreprocessed(job.sourcePath, options);
      preprocessedStream.on('finish', function(err, sourceHash) {
        if (err) return callback(err);  //GeneratePreprocessed error.

        job.sourceHash = sourceHash;
        callback(null, preprocessedStream);
      });
    },

    function(preprocessedStream, callback) {
      //ask who.
      var formData = {
        systemInformation : environment.getSystemInformation(settings),
        compilerInformation : job.compilerInformation,
        mode : job.mode,
        projectId: job.projectId,
        cachePrefered : job.cachePrefered,
        crossPrefered : job.crossPrefered,
        sourcePath : job.sourcePath,
        sourceHash: job.sourceHash,
        argvHash : job.argvHash
      }; 
     
      debug('sourceHash : %s , argvHash : %s', job.sourceHash, job.argvHash);
      var options = {
        hostname: settings.client.scheduler.address,
        port: settings.client.scheduler.port,
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
        res.on('data', function(chunk){data += chunk;});
        res.on('end', function(){
          var json = JSON.parse(data);
          job.id = json.jobId;
          job.local = json.local;
          job.cacheAvailable = json.cache;
          job.crossAvailable = json.cross;
          job.daemon = json.daemon;
          job.archive = json.archive;

          if (job.local)
            return callback(new Error('Build local from scheduler.' + ((json.error && json.error.message) ? ' - ' + json.error.message : '')));

          debug('remote daemon information - daemonId : %s , ip : %s:%s , hostname : %s'
            , job.daemon.daemonId, job.daemon.daemonAddress, job.daemon.system.port, job.daemon.system.hostname);
          debug('archiveId : %s , %s ,  %s', job.archive.archiveId
            , job.archive.dumpversion, job.archive.dumpmachine);

          if (job.cachePrefered == true && job.cacheAvailable == true) { //oh, cache~
            var options = {
              hostname: job.daemon.daemonAddress,
              port: job.daemon.system.port,
              path: '/cache/' + job.archive.archiveId
                    +'/' + job.sourceHash + '/' + job.argvHash,
              headers: {
                'secc-jobid' : job.id
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
              var extract = require('tar').Extract({path: path.dirname(job.outputPath)});
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
      var compiler = (job.crossAvailable) ? job.archive.compiler : job.command;
      var language = compile.determineLanguage(job.command, job.sourcePath);
      
      debug(job.remoteArgv);
      debug('language : %s', language);

      //FIXME : this happens when new remote daemon is on.
      if (typeof job.daemon.system === 'undefined')
        return callback(new Error('remote daemon Error')); 

      var options = {
        hostname: job.daemon.daemonAddress,
        port: job.daemon.system.port,
        path: '/compile/preprocessed/' + job.archive.archiveId,
        method: 'POST',
        headers: {
          'Content-Encoding' : 'gzip',
          'secc-jobid' : job.id,
          'secc-compiler' : compiler,
          'secc-language' : language,
          'secc-argv' : JSON.stringify(job.remoteArgv),
          'secc-filename' : path.basename(job.outputPath, path.extname(job.outputPath)),
          'secc-cross' : job.crossAvailable,
          'secc-target': (job.targetSpecified)
                          ? job.target
                          : ((job.crossAvailable)
                              ? job.compilerInformation.dumpmachine
                              : null)
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
        var extract = require('tar').Extract({path: path.dirname(job.outputPath)});
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