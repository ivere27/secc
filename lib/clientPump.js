var debug = require('debug')('secc:lib:clientPump');
var zlib = require('zlib');
var path = require('path');
var querystring = require('querystring');
var fs = require("fs");
var http = require("http");
var crypto = require('crypto');

var async = require('async');
var compile = require('./compile.js');
var environment = require('./environment.js');

module.exports.performPumpMode = function(JOB, SECC, cb) {
  debug('performPumpMode');
  var sendingFileCount = 0;

  async.waterfall([
    function(callback) {
      environment.getHashedFileList(JOB.compileFile.dependencies, JOB.sourcePath, null, process.cwd()
        ,function(err, files, checkFiles, sourceHash){
          if (err)
            return callback(err || new Error('Generate hashes error'));

          JOB.sourceHash = sourceHash;
          callback(null, files, checkFiles);
        });
    },

    // and which daemon is available,
    function(files, checkFiles, callback) {

      JOB.newArgv = compile.newPumpArgvRemoved(JOB.argv, JOB.sourcePath);
      JOB.argvHash = crypto.createHash('md5').update(JSON.stringify(JOB.newArgv)).digest("hex");

      var formData = {
        systemInformation : environment.getSystemInformation(SECC),
        compilerInformation : JOB.compilerInformation,
        mode : JOB.mode,
        projectId: JOB.projectId,
        cachePrefered : JOB.cachePrefered,
        sourcePath : JOB.sourcePath,
        sourceHash: JOB.sourceHash,
        argvHash : JOB.argvHash
      }; 


      debug('sourceHash : %s , argvHash : %s', JOB.sourceHash, JOB.argvHash);
      //debug(newArgv);
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

          if (JOB.local == true)
            return callback(new Error('Build local from scheduler.'));

          debug('remote daemon information - daemonId : %s , ip : %s , hostname : %s'
            , JOB.daemon.id, JOB.daemon.daemonAddress, JOB.daemon.system.hostname);
          debug('archiveId : %s , %s ,  %s', JOB.archive.archiveId
            , JOB.archive.dumpversion, JOB.archive.dumpmachine);
          //debug(JOB);

          if (JOB.cachePrefered == true && JOB.cacheAvailable == true) { //oh, cache~
            var options = {
              hostname: JOB.daemon.daemonAddress,
              port: JOB.daemon.system.port,
              path: '/cache/' + JOB.archive.archiveId 
                    +'/' + JOB.sourceHash + '/' + JOB.argvHash,
              headers: {
                'secc-jobid' : JOB.id
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
              var extract = require('tar').Extract({path: path.dirname(JOB.outputPath)});
              extract.on('error', function(err) {debug(err); return callback(err);});
              extract.on('end',function(){
                debug('download and extract done. from cache.');
                return callback(null, true, files, checkFiles);
              });

              res.pipe(extract);
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
          hostname: JOB.daemon.daemonAddress,
          port: JOB.daemon.system.port,
          path: '/compile/pump/' + JOB.archive.archiveId + '/' + JOB.projectId + '/filecheck',
          method: 'POST',
          headers : {
            'Content-Type': 'application/json',
            'secc-jobid' : JOB.id
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
        hostname: JOB.daemon.daemonAddress,
        port: JOB.daemon.system.port,
        path: '/compile/pump/' + JOB.archive.archiveId + '/' + JOB.projectId,
        method: 'POST',
        headers : form.getHeaders(),
        encoding: null //avoid converting the downloaded body to a string and keep it in a binary buffer
      };
      options.headers['secc-jobid'] = JOB.id;
      options.headers['secc-argv'] = JSON.stringify(JOB.newArgv);
      options.headers['secc-filename'] = path.basename(JOB.outputPath, path.extname(JOB.outputPath));

      debug(JOB.newArgv);

      debug('header[secc-filename] = %s', options.headers['secc-filename']);

      debug('############ compile server - request #######################')      
      var req = http.request(options);
      req.on('error', function(err) {return callback(err);})
      req.setTimeout(60000, function(){
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
        var extract = require('tar').Extract({path: path.dirname(JOB.outputPath)});
        extract.on('error', function(err) {debug(err); return callback(err);});
        extract.on('end',function(){
          debug('download and extract done.');
          return callback(null);
        });

        res.pipe(extract);
      })

      debug('Sending Files...');
      form.append('sourceFile', path.basename(JOB.sourcePath));
      form.append('workingDirectory', process.cwd());
      form.append('source', gzipPack, {filename: path.basename(JOB.sourcePath) + '.tar.gz'});

      form.pipe(req);
    }

  ],
  function(err) {
    if(err)
      return cb(err)

    return cb(null);
  });
};