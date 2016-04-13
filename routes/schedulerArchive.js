'use strict';

var debug = require('debug')('secc:routes:schedulerArchive');

var environment = require('../lib/environment.js');
var path = require('path');

module.exports = function(express, io, SECC, SCHEDULER) {
  var router = express.Router();

  var am = SCHEDULER.am;

  router.get('/', function (req, res) {
    debug(req.body);
    res.json(am.getArchiveList());
  })

  router.get('/:archiveId', function (req, res) {
    debug(req.body);

    var archiveId = req.params.archiveId;

    if (am.archiveExists(archiveId))
      return res.json(am.getArchiveInfo(archiveId));
    else
      return res.status(400).send('archive not exists.');
  })

  router.get('/:archiveId/target', function (req, res) {
    debug(req.body);

    var archiveId = req.params.archiveId;

    if (am.archiveExists(archiveId))
      return res.json(am.getArchiveInfo(archiveId).targets);
    else
      return res.status(400).send('archive not exists.');
  })

  router.post('/:archiveId/target/:target', function (req, res) {
    debug(req.body);

    var archiveId = req.params.archiveId;
    var target = req.params.target;

    if (am.archiveExists(archiveId)) {
      am.addTarget(archiveId, target, function(err, archive){
        if (err) {
          debug(err);
          return res.status(400).send('unable to add a target.');
        }

        res.json(archive.targets);
      });
    }
    else
      return res.status(400).send('archive not exists.');
  });

  router.delete('/:archiveId/target/:target', function (req, res) {
    debug(req.body);

    var archiveId = req.params.archiveId;
    var target = req.params.target;

    if (am.archiveExists(archiveId)) {
      am.removeTarget(archiveId, target, function(err, archive){
        if (err) {
          debug(err);
          return res.status(400).send('unable to remove a target.');
        }

        res.json(archive.targets);
      });
    }
    else
      return res.status(400).send('archive not exists.');
  });

  router.get('/:archiveId/file/', function (req, res) {
    debug(req.body);

    var archiveId = req.params.archiveId;
    var archive = am.getArchiveInfo(archiveId);

    if (am.archiveExists(archiveId)) {
      var archive = am.getArchiveInfo(archiveId);

      res.attachment(archive.archiveFile);
      res.sendFile(path.join(SECC.archivePath, archive.archiveFile));
    }
    else
      return res.status(400).send('archive not exists.');
  })

  router.delete('/:archiveId', function (req, res) {
    debug(req.body);

    var archiveId = req.params.archiveId;

    if (am.archiveExists(archiveId)) {
      am.removeArchive(archiveId, function(err){
        if (err)
          res.status(400).send(err);  

        io.emit('schedulerArchives', am.getArchiveList());
        return res.send('archive deleted.');
      })
    }
    else
      return res.status(400).send('archive not exists.');
  })


  router.post('/', function (req, res) {
    debug(req.body);
    debug(req.file);

    try {
      var archive = JSON.parse(req.body.archive);
    } catch(e) {
      debug("req.body.archive is not a json string. not serializable.")
      return res.status(400).send('wrong json string');
    }

    debug(archive);

    //FIXME : need to check archive data type.
    if ( typeof archive.platform    === 'undefined'
      || typeof archive.arch        === 'undefined'
      || typeof archive.compiler    === 'undefined'
      || typeof archive.version     === 'undefined'
      || typeof archive.dumpversion === 'undefined'
      || typeof archive.dumpmachine === 'undefined'
      || typeof archive.targets     === 'undefined'
      || typeof archive.archiveLog  === 'undefined'
      || typeof archive.archiveFile === 'undefined')
     return res.status(400).send('invalid archive data');

    //generate archiveId in server side
    archive.archiveId = environment.generatorArchiveId(archive);

    if (am.archiveExists(archive.archiveId))
      return res.status(400).send('archive already exists.'); 

    am.addArchive(archive, req.file, function(err){
      if(err) {
        debug(err);
        return res.status(400).send('unable to add.');
      }

      io.emit('schedulerArchives', am.getArchiveList());
      return res.json(am.getArchiveInfo(archive.archiveId));
    });
  })


  return router;
};