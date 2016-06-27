'use strict';

var debug = require('debug')('secc:' + process.pid + ':routes:daemonCompilePump');

var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var zlib = require('zlib');
var querystring = require('querystring');
var async = require('async');
var crypto = require('crypto');

var compile = require('../lib/compile.js');
var utils = require('../lib/utils.js');

module.exports = function (express, SECC, DAEMON) {
  var router = express.Router();

  var Archives = DAEMON.Archives;
  var redisClient = DAEMON.redisClient;

  var compileWrapper = function (req, res, archive, options) {
    var jobId = req.headers['secc-jobid'] || null;
    if (jobId) DAEMON.worker.emitToScheduler('compileBefore', { jobId: jobId });

    var options = options || {};
    options.compiler = archive.compiler;
    options.driver = req.headers['secc-driver'] || archive.compiler;

    try {
      options.argv = [];
      options.argv = JSON.parse(req.headers['secc-argv']);
    } catch(e) {}

    if (req.headers['secc-language'] !== undefined)
      options.language = req.headers['secc-language'];

    if (req.headers['secc-filename'] !== undefined)
      options.fileName = req.headers['secc-filename'];

    if (req.headers['secc-outfile'] !== undefined)
      options.outfile = req.headers['secc-outfile'];

    if (req.headers['secc-cross'] !== undefined)
      options.cross = (req.headers['secc-cross'] == 'true') ? true : false;
    if (req.headers['secc-target'] !== undefined)
      options.target = req.headers['secc-target'];

    // using stdin pipe. NOPE! it's pump mode.
    options.usingPipe = false;

    // cache
    if (SECC.daemon.cache) {
      debug('using redis cache.');
      options.cache = true;
      options.redisClient = redisClient;
    }

    var compilePumpStream = new compile.CompileStream(options);

    compilePumpStream.on('cacheStored', function (data) {
      DAEMON.worker.emitToScheduler('cacheStored', data);
    });

    compilePumpStream.on('finish', function (err, stdout, stderr, code, outArchive) {
      // console.log('finish')
      if (stdout) res.setHeader('secc-stdout', querystring.escape(stdout));
      if (stderr) res.setHeader('secc-stderr', querystring.escape(stderr));
      if (code || code == 0) res.setHeader('secc-code', code);

      if (err) {
        debug('compilePumpStream compile ERROR!!');
        debug(stderr);
        debug(err);

        if (jobId) DAEMON.worker.emitToScheduler('compileAfter', { jobId: jobId,  error: err.message });

        return res.status(400).send(err.message);
      }

      res.attachment(outArchive);
      res.writeHead(200);
      compilePumpStream.pipe(res);

      if (jobId) DAEMON.worker.emitToScheduler('compileAfter', { jobId: jobId });
    });
  };

  router.post('/:archiveId/:projectId/filecheck', function (req, res) {
    debug('/:archiveId/:projectId/filecheck');
    var jobId = req.headers['secc-jobid'] || null;
    var archiveId = req.params.archiveId;
    var projectId = req.params.projectId;
    var clientIp = req.connection.remoteAddress;
    var archivePath = path.join(SECC.runPath, 'pump', archiveId, clientIp, projectId);
    debug(archivePath);

    var files = req.body;
    var response = {};

    debug('filecheck files...');
    // debug(files)

    async.forEachOf(files, function (value, key, callback) {
      fs.stat(archivePath + key, function (err, stats) {
        // FIXME : if key is directory in server? rm?
        if (err && err.code == 'ENOENT') { // file not exists
          response[key] = false;
          return callback(null);
        } else if (err) { // unknown error.
          return callback(err);
        }

        var stream = fs.createReadStream(archivePath + key);
        var hash = crypto.createHash('md5');
        hash.setEncoding('hex');

        stream.on('error', function (err) {
          callback(err);
        });
        stream.on('end', function () {
          hash.end();
          response[key] = (value == hash.read());
          callback(null);
        });
        stream.pipe(hash);
      });
    }, function (err) {
      if (err) {
        debug(err.message);
        if (jobId) DAEMON.worker.emitToScheduler('compileLocal', { jobId: jobId });
        return res.status(400).send('error!!');
      }

      debug('send back to client what files exist...');
      // debug(response)
      return res.json(response);
    });
  });

  router.post('/:archiveId/:projectId', function (req, res) {
    var jobId = req.headers['secc-jobid'] || null;
    var archiveId = req.params.archiveId;
    var projectId = req.params.projectId;
    var clientIp = req.connection.remoteAddress;

    var archive = utils.getArchiveInArray(Archives.schedulerArchives, archiveId);
    var archivePath = path.join(SECC.runPath, 'pump', archiveId, clientIp, projectId);

    debug('COMPILE REQUEST');
    debug('/%s/%s/ from %s', archiveId, projectId, clientIp);

    var pumpArchiveId = crypto.createHash('md5').update(archivePath).digest('hex');
    var pumpArchive = {
      pumpArchiveId: pumpArchiveId,
      archive: archive,
    archivePath: archivePath};

    var deleteAllUploadFiles = function (file, callback) {
      if (jobId) DAEMON.worker.emitToScheduler('compileLocal', { jobId: jobId });

      fs.unlink(file.path, function (err) {
        if (err && err.code !== 'ENOENT')
          return callback(err);
        return callback(null);
      });
    };

    // check exists in Archives.schedulerArchives
    if (!utils.archiveExistsInArray(Archives.schedulerArchives, archiveId)) {
      debug('unknown archiveId. not exists in Archives.schedulerArchives.');
      return deleteAllUploadFiles(req.file, function (err) {
        if (err)
          return res.status(400).send(err);
        return res.status(400).send('unknown archiveId.');
      });
    }

    // check WIP in Archives.localPumpArchivesInProgress.
    if (utils.pumpArchiveExistsInArray(Archives.localPumpArchivesInProgress, pumpArchive.pumpArchiveId)) {
      debug('pumpArchiveId %s(archiveId %s) is working in progress.', pumpArchive.pumpArchiveId, archiveId);
      return deleteAllUploadFiles(req.file, function (err) {
        if (err)
          return res.status(400).send(err);
        return res.status(400).send('pumpArchiveId is working in progress.');
      });
    }

    // check in localPumpArchives(already installed.)
    if (!utils.pumpArchiveExistsInArray(Archives.localPumpArchives, pumpArchive.pumpArchiveId)) {
      debug('pumpArchiveId %s(archiveId %s) is not installed. will be install.', pumpArchive.pumpArchiveId, archiveId);
      Archives.localPumpArchivesInProgress.push(pumpArchive);
      DAEMON.worker.broadcast('addLocalPumpArchivesInProgress', {pumpArchive: pumpArchive });

      process.nextTick(function () {
        // download from scheduler. FIXME : make as a function. and loop.
        var pumpArchiveToInstall = Archives.localPumpArchivesInProgress[Archives.localPumpArchivesInProgress.length - 1];

        var http = require('http');
        var options = {
          hostname: SECC.daemon.scheduler.address,
          port: SECC.daemon.scheduler.port,
          path: '/archive/' + pumpArchiveToInstall.archive.archiveId + '/file/',
          method: 'GET'
        };

        debug('download %s', options.path);

        var req = http.request(options);
        req.on('error', function (err) {return debug(err);});
        req.setTimeout(60000, function () {
          // FIXME : report to the scheduler.
          return debug(new Error('Timeout in downloading the archive file'));
        });
        req.on('response', function (res) {
          if (res.statusCode !== 200) {
            this.abort();
            // FIXME : report to the scheduler.
            return debug(new Error('Timeout in downloading the archive file'));
          }

          var extract = require('tar').Extract({path: pumpArchiveToInstall.archivePath});
          extract.on('error', function (err) {
            debug(err);
            utils.removePumpArchiveInArray(Archives.localPumpArchivesInProgress, pumpArchiveToInstall.pumpArchiveId);
            DAEMON.worker.broadcast('removeLocalPumpArchivesInProgress', {pumpArchive: pumpArchiveToInstall });
          });
          extract.on('end', function () {
            debug('download and extract done : %s', pumpArchiveToInstall.archivePath);
            mkdirp.sync(path.join(pumpArchiveToInstall.archivePath, 'tmp'));

            debug('copy chdir.sh to archivePath');
            fs.createReadStream(path.join(SECC.toolPath, 'chdir.sh'))
              .pipe(fs.createWriteStream(path.join(pumpArchiveToInstall.archivePath, 'chdir.sh')));

            utils.removePumpArchiveInArray(Archives.localPumpArchivesInProgress, pumpArchiveToInstall.pumpArchiveId);
            DAEMON.worker.broadcast('removeLocalPumpArchivesInProgress', {pumpArchive: pumpArchiveToInstall });
            Archives.localPumpArchives.push(pumpArchiveToInstall);
            DAEMON.worker.broadcast('addLocalPumpArchives', {pumpArchive: pumpArchiveToInstall });
          });
          res.pipe(zlib.createGunzip()).pipe(extract);
        });
        req.end();
      });

      return deleteAllUploadFiles(req.file, function (err) {
        if (err)
          return res.status(400).send(err);
        return res.status(400).send('archiveId is not installed.');
      });
    }

    debug(req.body);
    var sourceFile = req.body.sourceFile;

    debug('### sourceFile');
    debug(sourceFile);

    var source = req.file;
    var workingDirectory = req.body.workingDirectory;

    // file extract..
    debug(source);

    var tar = require('tar');
    var extract = tar.Extract({path: archivePath});
    extract.on('error', function (err) {
      return deleteAllUploadFiles(req.file, function (err) {
        if (err)
          return res.status(400).send(err);
        return res.status(400).send('error raised in extracting source.');
      });
    });

    extract.once('end', function () { // FIXME : it seems there is a bug in tar. it emit 'end' two times.
      debug('on extract end!!!!');

      deleteAllUploadFiles(req.file, function (err) {
        if (err)
          return res.status(400).send(err);

        debug('untar done. %s', source.filename);

        var options = {
          buildNative: false,
          archiveId: archive.archiveId,
          buildRoot: path.join(SECC.runPath, 'pump', archiveId, clientIp, projectId),
          sourceFile: sourceFile,
          workingDirectory: workingDirectory
        };

        // check workingDictory. prevent '../../'
        var cwd = path.join(options.buildRoot, path.normalize(path.join('/', options.workingDirectory)));
        debug({cwd: cwd});

        fs.stat(cwd, function (err, stats) {
          if (err) {
            if (err.code == 'ENOENT')
              mkdirp.sync(cwd);
            else
              return res.status(400).send(err);
          }
          compileWrapper(req, res, archive, options);
        });
      });
    });

    var gzipPack = fs.createReadStream(path.join(SECC.uploadPath, source.filename));
    gzipPack.on('error', function (err) {
      return deleteAllUploadFiles(req.file, function (err) {
        if (err)
          return res.status(400).send(err);
        return res.status(400).send('error raised in extracting source.');
      });
    });
    gzipPack.pipe(zlib.createGunzip()).pipe(extract);
  });

  return router;
};
