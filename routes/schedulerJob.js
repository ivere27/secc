var debug = require('debug')('secc:routes:schedulerJob');

var path = require('path');

module.exports = function(express, io, SECC, SCHEDULER) {
  var router = express.Router();

  var dm = SCHEDULER.dm;
  var jm = SCHEDULER.jm;

  router.get('/', function (req, res) {
    res.json(jm.jobList());
  })

  router.post('/new', function (req, res) {
    var json = req.body;
    debug('/job/new request fired!!');
    debug(json);

    var job = jm.newJob({
      systemInformation : json.systemInformation,
      compilerInformation : json.compilerInformation,
      mode : json.mode,
      projectId : json.projectId,
      cachePrefered : json.cachePrefered,
      sourcePath : json.sourcePath,
      sourceHash : json.sourceHash,
      argvHash : json.argvHash
    });

    //get suitable archiveId
    var information = { platform: job.systemInformation.platform
                       ,arch : job.systemInformation.arch
                       ,compiler : 'unknown'
                       ,dumpversion : job.compilerInformation.dumpversion
                       ,dumpmachine : job.compilerInformation.dumpmachine};

    if (job.compilerInformation.version.indexOf('gcc') !== -1)
      information.compiler = 'gcc'
    else if (job.compilerInformation.version.indexOf('clang') !== -1)
      information.compiler = 'clang'

    //if still unknown, then check it by other phrase.
    if (information.compiler === 'unknown') {
      if (job.compilerInformation.version.indexOf('Free Software Foundation') !== -1) //which is gcc
        information.compiler = 'gcc'
    }

    var archiveInfo = am.getArchiveInfo(am.getArchiveId(information));

    if (archiveInfo === null) {
      console.log('archive not exists. build local.')
      debug(information);
      jm.removeJob(job.id);
      return res.json({local : true, error : { message : 'archive not exists'}});
    }

    debug('request compiler information is..')
    debug('suitable archive is.. %s', archiveInfo.archiveId);

    //Cache Check
    debug('sourceHash : %s , argvHash : %s', job.sourceHash, job.argvHash);

    if (job.cachePrefered && job.sourceHash && job.argvHash) {
      var candidateDaemonIds = cm.getCandidateDaemonIds({ archiveId : archiveInfo.archiveId
                                                        , sourceHash : job.sourceHash
                                                        , argvHash : job.argvHash});
      debug('cache available daemon list');
      debug(candidateDaemonIds);
      if (candidateDaemonIds.length > 0) {
          var bestDaemonId = candidateDaemonIds[Math.floor(Math.random()*candidateDaemonIds.length)];
          debug('use remote cache. %s', bestDaemonId);
          //debug(dm.getDaemonInfo(bestDaemonId));

          jm.setDaemonOfJob(job.id, bestDaemonId);
          io.emit("newJob", {id : job.id, 
            cache : true, 
            daemonId : bestDaemonId,
            archiveId : archiveInfo.archiveId,
            timestamp: new Date()});

          return res.json({
            jobId : job.id,
            local: false, 
            cache: true, 
            daemon: dm.getDaemonInfo(bestDaemonId), 
            archive: archiveInfo});
      } //no available cache.
    }

    //FIXME : need a good algorithm. so far, just random()
    var candidateDaemonIds = dm.getCandidateDaemonIds(job);

    debug('daemon list');
    debug(candidateDaemonIds);
    if (candidateDaemonIds.length > 0) {
        var bestDaemonId = candidateDaemonIds[Math.floor(Math.random()*candidateDaemonIds.length)];
        debug('build remote. %s', bestDaemonId);
        //debug(dm.getDaemonInfo(bestDaemonId));

        jm.setDaemonOfJob(job.id, bestDaemonId);
        io.emit("newJob", {id : job.id, 
          cache : false, 
          daemonId : bestDaemonId,
          archiveId : archiveInfo.archiveId,
          timestamp: new Date()});

        return res.json({
          jobId : job.id,
          local: false, 
          cache: false, 
          daemon: dm.getDaemonInfo(bestDaemonId), 
          archive: archiveInfo});
    }

    //no available daemon.
    jm.removeJob(job.id);
    res.json({local : true});
  })

  return router;
};