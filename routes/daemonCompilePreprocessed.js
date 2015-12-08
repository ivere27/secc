'use strict';

var debug = require('debug')('secc:routes:daemonCompilePreprocessed');

var mkdirp = require('mkdirp');
var path = require('path');
var zlib = require('zlib');
var querystring = require('querystring');

var compile = require('../lib/compile.js');
var environment = require('../lib/environment.js');
var utils = require('../lib/utils.js');

module.exports = function(express, socket, SECC, DAEMON) {
  var router = express.Router();

  var Archives = DAEMON.Archives;
  var redisClient = DAEMON.redisClient;

  var compileWrapper = function(req, res, options) {
    var jobId = req.headers['secc-jobid'] || null;
    if (socket.connected && jobId) socket.emit('compileBefore', { jobId: jobId });

    var options = options || {};

    var contentEncoding = req.headers['content-encoding'] || '';
    
    options.compiler = req.headers['secc-compiler'] || 'gcc';

    if (options.archive) {
      if(options.archive.compiler === 'gcc' && options.compiler === 'c++')
        options.compiler = 'g++';
      else if(options.archive.compiler === 'gcc' && options.compiler === 'cc')
        options.compiler = 'gcc';
      else if(options.archive.compiler === 'clang' && options.compiler === 'c++')
        options.compiler = 'clang++';
      else if(options.archive.compiler === 'clang' && options.compiler === 'cc')
        options.compiler = 'clang';
    }

    try {
      options.argv = [];
      options.argv = JSON.parse(req.headers['secc-argv']);
    } catch(e) {}

    var output;

    if (typeof req.headers['secc-language'] !== 'undefined')
      options.language = req.headers['secc-language'];

    if (typeof req.headers['secc-filename'] !== 'undefined')
      options.fileName = req.headers['secc-filename'];

    //using stdin pipe
    options.usingPipe = true;

    //cache
    if (SECC.daemon.cache) {
      debug('using redis cache.')
      options.cache = true;
      options.redisClient = redisClient;
    }

    var compilePipeStream = new compile.CompileStream(options);

    compilePipeStream.on('cacheStored', function(data){
      if (socket.connected)
        socket.emit('cacheStored', data);
    });

    compilePipeStream.on('finish', function(err, stdout, stderr, code, outArchive) {
      //console.log('finish');
      if (stdout) res.setHeader('SECC-stdout', querystring.escape(stdout));
      if (stderr) res.setHeader('SECC-stderr', querystring.escape(stderr));
      if (code || code == 0) res.setHeader('SECC-code', code);

      if (err) {
        debug('compilePipeStream compile ERROR!!');
        debug(stderr);
        debug(err);

        if (socket.connected && jobId) socket.emit('compileAfter', { jobId: jobId , error: err.message });

        return res.status(400).send(err.message);
      }

      res.attachment(outArchive);
      res.writeHead(200);
      output.pipe(res);

      if (socket.connected && jobId) socket.emit('compileAfter', { jobId: jobId });
    });

    if (contentEncoding === 'gzip') {
      output = req.pipe(zlib.createGunzip()).pipe(compilePipeStream);
    } else if (contentEncoding === 'deflate') {
      output = req.pipe(zlib.createInflate()).pipe(compilePipeStream);
    } else {
      output = req.pipe(compilePipeStream);
    }
  }

  router.post('/native', function (req, res) {
    compileWrapper(req, res);
  })

  router.post('/:archiveId', function (req, res) {
    var jobId = req.headers['secc-jobid'] || null;
    var archiveId = req.params.archiveId;
    console.log(req.params.archiveId);
    var archive = utils.getArchiveInArray(Archives.schedulerArchives, archiveId);
    var archivePath = path.join(SECC.runPath, 'preprocessed', archiveId);

    //check exists in Archives.schedulerArchives
    if (!utils.archiveExistsInArray(Archives.schedulerArchives, archiveId)) {
      debug('unknown archiveId. not exists in Archives.schedulerArchives.');

      if (socket.connected && jobId) socket.emit('compileLocal', { jobId: jobId });
      return res.status(400).send('unknown archiveId.');
    }

    //check WIP in Archives.localPrepArchiveIdInProgress.
    if (Archives.localPrepArchiveIdInProgress.indexOf(archiveId) !== -1 ) {
      debug('archiveId %s is working in progress.', archiveId);
      if (socket.connected && jobId) socket.emit('compileLocal', { jobId: jobId });
      return res.status(400).send('archiveId is working in progress.');
    }

    //check in localPrepArchiveIdInProgress(already installed or not)
    if (Archives.localPrepArchiveId.indexOf(archiveId) === -1) {
      debug('archiveId %s is not installed. will be install.', archiveId);
      Archives.localPrepArchiveIdInProgress.push(archiveId);
      process.nextTick(function(){
        //download from scheduler. FIXME : make as a function. and loop.
        var fs = require('fs');
        var archiveIdToInstall = Archives.localPrepArchiveIdInProgress[Archives.localPrepArchiveIdInProgress.length-1];

        var schedulerUrl = 'http://' + SECC.daemon.scheduler.address + ':' + SECC.daemon.scheduler.port;
        var url = schedulerUrl
                + '/archive/' + archiveIdToInstall
                + '/file/';

        debug("download %s", url);

        var request = require('request');
        var targz = require('node-tar.gz');

        var read = request.get(url);
        var write = targz().createWriteStream(archivePath);
         
        read.pipe(write).on('finish',function(){
          debug('download and extract done : %s', archivePath);
          mkdirp.sync(path.join(archivePath, 'tmp'));

          debug('copy chdir.sh to archivePath');
          fs.createReadStream(path.join(SECC.toolPath,'chdir.sh'))
            .pipe(fs.createWriteStream(path.join(archivePath,'chdir.sh')));

          Archives.localPrepArchiveIdInProgress = 
            Archives.localPrepArchiveIdInProgress.filter(function(e){
              return e !== archiveIdToInstall;
            })

          Archives.localPrepArchiveId.push(archiveIdToInstall);
        }).on('error',function(err){
          debug(err);
          Archives.localPrepArchiveIdInProgress = 
            Archives.localPrepArchiveIdInProgress.filter(function(e){
              return e !== archiveId;
            })
        });

      });
      if (socket.connected && jobId) socket.emit('compileLocal', { jobId: jobId });
      return res.status(400).send('archiveId is not installed.'); 
    }

    var options = {
          buildNative: false,
          archiveId: archive.archiveId,
          buildRoot: path.join(SECC.runPath, 'preprocessed', archive.archiveId),
          archive : archive
        };

    compileWrapper(req, res, options);

  })

  return router;
};