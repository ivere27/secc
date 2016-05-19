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
  job.sourcePath = job.infile;
  job.outputPath = job.outfile
                || path.basename(job.sourcePath, path.extname(job.sourcePath)) + '.o';

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
        systemInformation : environment.getSystemInformation(),
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
        hostname: process.env.SECC_ADDRESS || settings.client.scheduler.address,
        port: process.env.SECC_PORT || settings.client.scheduler.port,
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
            , job.daemon.daemonId, job.daemon.daemonAddress, job.daemon.daemonPort, job.daemon.system.hostname);
          debug('archiveId : %s , %s ,  %s', job.archive.archiveId
            , job.archive.dumpversion, job.archive.dumpmachine);

          if (job.cachePrefered == true && job.cacheAvailable == true) { //oh, cache~
            var options = {
              hostname: job.daemon.daemonAddress,
              port: job.daemon.daemonPort,
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

              res.pipe(zlib.createGunzip()).pipe(extract);
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
      var compiler = (job.crossAvailable) ? job.archive.compiler : job.compiler;
      var driver = job.driver;
      if (job.crossAvailable) {
        if (job.archive.compiler === 'gcc') {
          if (job.language === 'c++')
            driver = 'g++';
          else
            driver = 'gcc';
        } else if (job.archive.compiler = 'clang') {
          if (job.language === 'c++')
            driver = 'clang++';
          else
            driver = 'clang';
        }
      }

      debug(job.remoteArgv);
      debug('compiler : %s, driver : %s, language : %s, ', compiler, driver, job.language);

      //FIXME : this happens when new remote daemon is on.
      if (typeof job.daemon.system === 'undefined')
        return callback(new Error('remote daemon Error'));

      var options = {
        hostname: job.daemon.daemonAddress,
        port: job.daemon.daemonPort,
        path: '/compile/preprocessed/' + job.archive.archiveId,
        method: 'POST',
        headers: {
          'Content-Encoding' : 'gzip',
          'secc-jobid' : job.id,
          'secc-compiler' : compiler,
          'secc-driver' : driver,
          'secc-language' : job.language,
          'secc-argv' : JSON.stringify(job.remoteArgv),
          'secc-filename' : path.basename(job.outputPath, path.extname(job.outputPath)),
          'secc-outfile' : job.outfile,
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
      req.setTimeout(60 * 2 * 1000, function(){
          return this.emit('error', new Error('Timeout in request compilePreprocessed'));
      });
      req.on('response', function(res) {
        if(res.statusCode !== 200 || res.headers['secc-code'] !== '0') {
          debug(res.headers['secc-code']);
          this.abort();
          return this.emit('error', new Error('remote compile daemon exited with non-zero'));
        }

        if (typeof res.headers['secc-stdout'] !== 'undefined')
          process.stdout.write(querystring.unescape(res.headers['secc-stdout']));
        if (typeof res.headers['secc-stderr'] !== 'undefined')
          process.stderr.write(querystring.unescape(res.headers['secc-stderr']));

        //download well.
        var extract = require('tar').Extract({path: path.dirname(job.outputPath)});
        extract.on('error', function(err) {debug(err); return callback(err);});
        extract.on('end',function(){
          debug('download and extract done.');
          return callback(null);
        });

        res.pipe(zlib.createGunzip()).pipe(extract);
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