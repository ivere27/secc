'use strict';

var debug = require('debug')('secc:routes:schedulerJob');
var path = require('path');

var utils = require('../lib/utils');
var environment = require('../lib/environment');

module.exports = function (express, io, SECC, SCHEDULER) {
  var router = express.Router();

  var am = SCHEDULER.am;
  var cm = SCHEDULER.cm;
  var dm = SCHEDULER.dm;
  var jm = SCHEDULER.jm;

  router.get('/', function (req, res) {
    res.json(jm.jobList());
  });

  router.post('/new', function (req, res) {
    var json = req.body;
    debug('/job/new request fired!!');
    debug(json);

    if (!json.systemInformation
      || !json.systemInformation.platform
      || !json.systemInformation.arch
      || !json.compilerInformation
      || !json.compilerInformation.version
      || !json.compilerInformation.dumpmachine
      || !json.mode
      || !json.projectId
      || (typeof json.cachePrefered !== 'boolean')
      || (typeof json.crossPrefered !== 'boolean')
      || !json.sourcePath
      || !json.sourceHash
      || !json.argvHash) {
      debug('wrong request.');
      return res.status(400).send('wrong request.');
    }

    var job = jm.newJob({
      systemInformation: json.systemInformation,
      compilerInformation: json.compilerInformation,
      mode: json.mode,
      projectId: json.projectId,
      cachePrefered: json.cachePrefered,
      crossPrefered: json.crossPrefered,
      sourcePath: json.sourcePath,
      sourceHash: json.sourceHash,
      argvHash: json.argvHash,
      clientAddress: req.connection.remoteAddress
    });

    // get suitable archiveId
    var information = {
      platform: job.systemInformation.platform,
      arch: job.systemInformation.arch,
      compiler: 'unknown',
      compilerVersion: null,
      version: job.compilerInformation.version,
      dumpmachine: job.compilerInformation.dumpmachine
    };

    if (job.compilerInformation.version.indexOf('gcc') !== -1
      || job.compilerInformation.version.indexOf('g++') !== -1)
      information.compiler = 'gcc';
    else if (job.compilerInformation.version.indexOf('clang') !== -1)
      information.compiler = 'clang';

    // if still unknown, then check it by other phrase.
    if (information.compiler === 'unknown') {
      if (job.compilerInformation.version.indexOf('Free Software Foundation') !== -1) // which is gcc
        information.compiler = 'gcc';
    }

    // extract compilerVersion from --version string
    information.compilerVersion = environment.getCompilerVersionFromString(information.compiler, information.version);

    var archiveInfo = am.getArchiveInfo(am.getArchiveId(information));
    var crossArchiveIds = am.getArchiveIdsByTarget(information.dumpmachine);

    if (information.compilerVersion === null
      || (!job.crossPrefered && archiveInfo === null)
      || (job.crossPrefered && archiveInfo === null && crossArchiveIds.length === 0)) {
      debug('archive not exists. build local.');
      debug(information);
      jm.removeJob(job.id);
      return res.json({local: true, error: { message: 'archive not exists'}});
    }

    if (archiveInfo) {
      debug('suitable archive is.. %s', archiveInfo.archiveId);
    }
    if (job.crossPrefered && (crossArchiveIds.length > 0)) {
      debug('suitable cross archiveIds are..');
      debug(crossArchiveIds);
    }

    // Cache Check
    debug('sourceHash : %s , argvHash : %s', job.sourceHash, job.argvHash);

    // FIXME : lets find caches in cross machines.
    if (archiveInfo && job.cachePrefered && job.sourceHash && job.argvHash) {
      var candidateDaemonIds = cm.getCandidateDaemonIds({
        archiveId: archiveInfo.archiveId,
        sourceHash: job.sourceHash,
        argvHash: job.argvHash
      });
      debug('cache available daemon list');
      debug(candidateDaemonIds);
      if (candidateDaemonIds.length > 0) {
        var bestDaemonId = candidateDaemonIds[Math.floor(Math.random() * candidateDaemonIds.length)];
        debug('use remote cache. %s', bestDaemonId);
        // debug(dm.getDaemonInfo(bestDaemonId))

        jm.setDaemonOfJob(job.id, bestDaemonId);
        io.emit('newJob', {id: job.id,
          cache: true,
          cross: false,
          daemonId: bestDaemonId,
          archiveId: archiveInfo.archiveId,
          timestamp: new Date(),
          source: path.basename(job.sourcePath)
        });

        var data = {
          jobId: job.id,
          local: false,
          cache: true,
          cross: false,
          daemon: dm.getDaemonInfo(bestDaemonId),
        archive: archiveInfo};

        if (req.headers['accept'] === 'text/plain')
          return res.send(utils.ObjectToText(data));
        else
          return res.json(data);
      } // no available cache in same machine
    }

    // FIXME : need a good algorithm. so far, just random(:o)
    var candidateDaemons = {};
    if (archiveInfo)
      candidateDaemons = dm.getCandidateDaemonIds(job, archiveInfo);

    // try if there is no same machine.
    // FIXME : refactoring.
    if ((Object.keys(candidateDaemons).length === 0)
      && (job.crossPrefered && (crossArchiveIds.length > 0)))
      candidateDaemons = dm.getCandidateCrossDaemonIds(job, crossArchiveIds);

    debug('daemon list');
    debug(candidateDaemons);
    if (Object.keys(candidateDaemons).length > 0) {
      var bestDaemonId = Object.keys(candidateDaemons)[Math.floor(Math.random() * Object.keys(candidateDaemons).length)];
      debug('build remote. %s', bestDaemonId);
      // debug(dm.getDaemonInfo(bestDaemonId))

      jm.setDaemonOfJob(job.id, bestDaemonId);
      io.emit('newJob', {id: job.id,
        cache: false,
        cross: candidateDaemons[bestDaemonId].cross,
        daemonId: bestDaemonId,
        archiveId: (candidateDaemons[bestDaemonId].cross)
          ? candidateDaemons[bestDaemonId].archiveId
          : archiveInfo.archiveId,
        timestamp: new Date(),
        source: path.basename(job.sourcePath)
      });

      var data = {
        jobId: job.id,
        local: false,
        cache: false,
        cross: candidateDaemons[bestDaemonId].cross,
        daemon: dm.getDaemonInfo(bestDaemonId),
        archive: (candidateDaemons[bestDaemonId].cross)
          ? am.getArchiveInfo(candidateDaemons[bestDaemonId].archiveId)
          : archiveInfo
      };

      if (req.headers['accept'] === 'text/plain')
        return res.send(utils.ObjectToText(data));
      else
        return res.json(data);
    }

    // no available daemon.
    jm.removeJob(job.id);
    var data = {
      local: true,
      error: { message: 'no available daemon'}
    };

    if (req.headers['accept'] === 'text/plain')
      res.send(utils.ObjectToText(data));
    else
      res.json(data);
  });

  return router;
};
