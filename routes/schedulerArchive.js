'use strict';

var debug = require('debug')('secc:routes:schedulerArchive');
var environment = require('../lib/environment.js');
var path = require('path');

module.exports = function(express, io, SECC, SCHEDULER) {
  var router = express.Router();

  var am = SCHEDULER.am;

  router.get('/', function(req, res) {
    res.json(am.getArchiveList());
  });

  router.get('/:archiveId', function(req, res) {
    var archiveId = req.params.archiveId;

    if (!am.archiveExists(archiveId))
      return res.status(400).send('archive not exists.');

    return res.json(am.getArchiveInfo(archiveId));
  });

  router.get('/:archiveId/target', function(req, res) {
    var archiveId = req.params.archiveId;

    if (!am.archiveExists(archiveId))
      return res.status(400).send('archive not exists.');

    return res.json(am.getArchiveInfo(archiveId).targets);
  });

  router.post('/:archiveId/target/:target', function(req, res) {
    var archiveId = req.params.archiveId;
    var target = req.params.target;

    if (!am.archiveExists(archiveId))
      return res.status(400).send('archive not exists.');

    am.addTarget(archiveId, target, function(err, archive) {
      if (err) {
        debug(err);
        return res.status(400).send('unable to add a target.');
      }

      return res.json(archive.targets);
    });
  });

  router.delete('/:archiveId/target/:target', function(req, res) {
    var archiveId = req.params.archiveId;
    var target = req.params.target;

    if (!am.archiveExists(archiveId))
      return res.status(400).send('archive not exists.');

    am.removeTarget(archiveId, target, function(err, archive) {
      if (err) {
        debug(err);
        return res.status(400).send('unable to remove a target.');
      }

      return res.json(archive.targets);
    });
  });

  router.get('/:archiveId/file/', function(req, res) {
    var archiveId = req.params.archiveId;

    if (!am.archiveExists(archiveId))
      return res.status(400).send('archive not exists.');

    var archive = am.getArchiveInfo(archiveId);

    res.attachment(archive.archiveFile);
    res.sendFile(path.join(SECC.archivePath, archive.archiveFile));
  });

  router.delete('/:archiveId', function(req, res) {
    var archiveId = req.params.archiveId;

    if (!am.archiveExists(archiveId))
      return res.status(400).send('archive not exists.');

    am.removeArchive(archiveId, function(err) {
      if (err) {
        debug(err);
        return res.status(400).send('unable to remove an archive.');
      }

      io.emit('schedulerArchives', am.getArchiveList());
      return res.send('archive deleted.');
    });
  });

  router.post('/', function(req, res) {
    var archive = {};
    try {
      archive = JSON.parse(req.body.archive);
    } catch (e) {
      debug('req.body.archive is not a json string. not serializable.');
    }

    // check the input data.
    try {
      if ( archive.platform === undefined
        || archive.arch === undefined
        || archive.compiler === undefined
        || archive.version === undefined
        || archive.dumpmachine === undefined
        || archive.targets === undefined
        || archive.archiveLog === undefined
        || archive.archiveFile === undefined)
        throw new Error('invalid archive data');

      // extract version(x.y.z) from '--version' string
      archive.compilerVersion = environment.getCompilerVersionFromString(archive.compiler, archive.version);
      if (archive.compilerversion === null)
        throw new Error('unable to extract the version');

      // generate archiveId in server side
      archive.archiveId = environment.generatorArchiveId(archive);

      if (am.archiveExists(archive.archiveId))
        throw new Error('archive already exists.');
    } catch (e) {
      debug(e.message);
      debug(req.body);
      debug(req.file);

      return res.status(400).send(e.message);
    }

    // add new archive
    am.addArchive(archive, req.file, function(err) {
      if (err) {
        debug(err);
        return res.status(400).send('unable to add.');
      }

      debug('an archive is uploaded');
      debug(am.getArchiveInfo(archive.archiveId));

      io.emit('schedulerArchives', am.getArchiveList());
      return res.json(am.getArchiveInfo(archive.archiveId));
    });
  });

  return router;
};
