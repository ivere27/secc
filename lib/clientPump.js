'use strict';

var debug = require('debug')('secc:'+process.pid+':lib:clientPump');
var zlib = require('zlib');
var path = require('path');
var querystring = require('querystring');
var fs = require("fs");
var http = require("http");
var crypto = require('crypto');

var async = require('async');
var compile = require('./compile.js');
var environment = require('./environment.js');

module.exports.performPumpMode = function(job, settings, cb) {
  debug('performPumpMode');
  var sendingFileCount = 0;

  async.waterfall([
    function(callback) {
      environment.getHashedFileList(job.compileFile.dependencies, job.sourcePath, null, process.cwd()
        ,function(err, files, checkFiles, sourceHash){
          if (err)
            return callback(err || new Error('Generate hashes error'));

          job.sourceHash = sourceHash;
          callback(null, files, checkFiles);
        });
    },

    // and which daemon is available,
    function(files, checkFiles, callback) {
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
      //debug(newArgv);
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
        res.on('data', function (chunk) {
          data += chunk;
        });

        res.on('end', function(){
          var json = JSON.parse(data);
          job.id = json.jobId;
          job.local = json.local;
          job.cacheAvailable = json.cache;
          job.crossAvailable = json.cross;
          job.daemon = json.daemon;
          job.archive = json.archive;

          if (job.local == true)
            return callback(new Error('Build local from scheduler.'));

          debug('remote daemon information - daemonId : %s , ip : %s , hostname : %s'
            , job.daemon.daemonId, job.daemon.daemonAddress, job.daemon.system.hostname);
          debug('archiveId : %s , %s ,  %s', job.archive.archiveId
            , job.archive.dumpversion, job.archive.dumpmachine);
          //debug(job);

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
              return callback(null, false, files, checkFiles);
            });
            cacheReq.setTimeout(3000, function(){
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
                return callback(null, true, files, checkFiles);
              });

              res.pipe(zlib.createGunzip()).pipe(extract);
            });
            cacheReq.end();

          } else {
            callback(null, false, files, checkFiles);
          }
        })
      })
      req.write(JSON.stringify(formData));
      req.end();
    },

    //
    function(cached, files, checkFiles, callback) {
      if (cached)
        return callback(null, true, null, null, null); //by-pass if cached which means already processed.

      //debug(files);
      debug('compile pump.');

      var options = {
          hostname: job.daemon.daemonAddress,
          port: job.daemon.daemonPort,
          path: '/compile/pump/' + job.archive.archiveId + '/' + job.projectId + '/filecheck',
          method: 'POST',
          headers : {
            'Content-Type': 'application/json',
            'secc-jobid' : job.id
          }
        };

      var req = http.request(options);
      req.on('error', function(err) {return callback(err);})
      req.setTimeout(10000, function(){
        return this.emit('error', new Error('Timeout in request file exists'));
      });
      req.on('response', function (res) {
        if(res.statusCode !== 200
          || res.headers['content-type'].indexOf('application/json') === -1) {
          this.abort();
          return callback(new Error('file check error'));
        }

        var data = '';
        res.on('data', function (chunk) {
          data += chunk;
        });

        res.on('end', function(){
          var fileExists = JSON.parse(data);
          debug('Server responded.. File Exsitance.')
          //debug(fileExists);
          callback(null, false, files, checkFiles, fileExists);
        })
      })
      req.write(JSON.stringify(files));
      req.end();
    },
    //pack
    function(cached, files, checkFiles, fileExists, callback) {
      if (cached)
        return callback(null, true, null, null, null, null); //by-pass if cached which means already processed.

      debug('pack start.');
      var pack = require('tar-stream').pack()
      async.eachSeries(checkFiles, function(filePath, cb) {
        if (!fileExists[filePath]) { //pack test. add || true
          fs.readFile(filePath, function (err, data) {
            if (err) throw cb(err);
            pack.entry({ name: filePath }, data);
            sendingFileCount++;
            cb(null);
          });
        } else
          cb(null);
      }, function(err){
        if(err)
          return callback(err);

        pack.finalize();
        debug('pack done. total : %d files. gzip start.', sendingFileCount);

        var gzipPack = zlib.createGzip({level: 1}) //FIXME : zlib.Z_BEST_SPEED
        pack.pipe(gzipPack);

        callback(null, false, files, checkFiles, fileExists, gzipPack);
      });
    },

    //
    function(cached, files, checkFiles, fileExists, gzipPack, callback) {
      if (cached)
        return callback(null); //by-pass if cached which means already processed.

      debug('http.request begins');

      var FormData = require('form-data');
      var form = new FormData();

      var options = {
        hostname: job.daemon.daemonAddress,
        port: job.daemon.daemonPort,
        path: '/compile/pump/' + job.archive.archiveId + '/' + job.projectId,
        method: 'POST',
        headers : form.getHeaders(),
        encoding: null //avoid converting the downloaded body to a string and keep it in a binary buffer
      };
      options.headers['secc-jobid'] = job.id;
      options.headers['secc-argv'] = JSON.stringify(job.remoteArgv);
      options.headers['secc-filename'] = path.basename(job.outputPath, path.extname(job.outputPath));
      options.headers['secc-compiler'] = (job.crossAvailable) ? job.archive.compiler : job.command;
      options.headers['secc-cross'] = job.crossAvailable;
      options.headers['secc-target'] = (job.crossAvailable)
                                      ? job.compilerInformation.dumpmachine
                                      : null;

      debug(job.remoteArgv);

      debug('header[secc-filename] = %s', options.headers['secc-filename']);

      debug('############ compile server - request #######################')
      var req = http.request(options);
      req.on('error', function(err) {return callback(err);})
      req.setTimeout(60 * 2 * 1000, function(){
        return this.emit('error', new Error('Timeout in request compilePump'));
      });
      req.on('response', function (res) {
        if (typeof res.headers['secc-stdout'] !== 'undefined')
          process.stdout.write(querystring.unescape(res.headers['secc-stdout']));
        if (typeof res.headers['secc-stderr'] !== 'undefined')
          process.stderr.write(querystring.unescape(res.headers['secc-stderr']));

        if (res.statusCode !== 200 || res.headers['secc-code'] !== '0') {
          debug(res.headers['secc-code']);
          this.abort();
          return this.emit('error', new Error('remote compile daemon exited with non-zero'));
        }

        debug('compile server responsed.');

        //download well.
        var extract = require('tar').Extract({path: path.dirname(job.outputPath)});
        extract.on('error', function(err) {debug(err); return callback(err);});
        extract.on('end',function(){
          debug('download and extract done.');
          return callback(null);
        });

        res.pipe(zlib.createGunzip()).pipe(extract);
      })

      debug('Sending Files...');
      form.append('sourceFile', path.basename(job.sourcePath));
      form.append('workingDirectory', process.cwd());
      form.append('source', gzipPack, {filename: path.basename(job.sourcePath) + '.tar.gz'});

      form.pipe(req);
    }

  ],
  function(err) {
    if(err)
      return cb(err)

    return cb(null);
  });
};