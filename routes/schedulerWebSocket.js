'use strict';

var debug = require('debug')('secc:routes:schedulerWebSocket');

var environment = require('../lib/environment.js');
var path = require('path');

module.exports = function(express, io, SECC, SCHEDULER) {
  var am = SCHEDULER.am;
  var cm = SCHEDULER.cm;
  var dm = SCHEDULER.dm;
  var jm = SCHEDULER.jm;
  var om = SCHEDULER.om;

  //sockets.
  io.on('connection', function(socket){
    debug('io connect. id : %s, address : %s', socket.id, socket.handshake.address);

    var daemonAddress = socket.handshake.address;
    var idx = daemonAddress.lastIndexOf(':');
    if (~idx && ~daemonAddress.indexOf('.'))
      daemonAddress = daemonAddress.slice(idx + 1);

    var newDaemon = { daemonId: socket.id,
      jobs: 0, maxJobs: 0, type: 'guest',
      daemonAddress : daemonAddress, daemonPort : 0 };
    dm.addDaemon(newDaemon);

    //send current Archives
    socket.emit('schedulerArchives', am.getArchiveList());
    socket.emit('daemonList', dm.getDaemonList());

    socket.on('connect', function(){
      debug('io connect.');

      socket.emit('event', { hello: 'world' });
    });
    socket.on('disconnect', function(){
      debug('io disconnect. id : %s, address : %s', socket.id, socket.handshake.address);

      cm.removeDaemon(socket.id);
      dm.removeDaemon(socket.id);
      jm.removeDaemon(socket.id);

      io.emit('daemonList', dm.getDaemonList());
    });
    socket.on('event', function(metaData){
      debug(metaData);
    });

    socket.on('daemonInformation', function(metaData){
      var archive = {};
      if (metaData.gcc) {
        metaData.gcc.compilerVersion = environment.getCompilerVersionFromString('gcc', metaData.gcc.version);
        if (metaData.gcc.compilerVersion) {
          var gccArchive = {
             platform         : metaData.platform
            ,arch             : metaData.arch
            ,compiler         : 'gcc'
            ,compilerVersion  : metaData.gcc.compilerVersion
            ,version          : metaData.gcc.version
            ,dumpmachine      : metaData.gcc.dumpmachine};

          gccArchive.archiveId = environment.generatorArchiveId(gccArchive);
          archive[gccArchive.archiveId] = gccArchive;
        }
      }

      if (metaData.clang) {
        metaData.clang.compilerVersion = environment.getCompilerVersionFromString('clang', metaData.clang.version);
        if (metaData.clang.compilerVersion) {
          var clangArchive = {
             platform         : metaData.platform
            ,arch             : metaData.arch
            ,compiler         : 'clang'
            ,compilerVersion  : metaData.clang.compilerVersion
            ,version          : metaData.clang.version
            ,dumpmachine      : metaData.clang.dumpmachine};

          clangArchive.archiveId = environment.generatorArchiveId(clangArchive);
          archive[clangArchive.archiveId] = clangArchive;
        }
      }

      // send back, localArchives(already installed in a daemon)
      socket.emit('localArchives', archive);

      dm.setDaemonSystemInformation(socket.id
        , { system  : { hostname : metaData.hostname
                      , port     : metaData.port
                      , platform : metaData.platform
                      , release  : metaData.release
                      , arch     : metaData.arch
                      , archive  : archive
                      }
          , type    :'daemon'
          , maxJobs : metaData.numCPUs
          , numCPUs : metaData.numCPUs
          , maxCpuUsage : metaData.maxCpuUsage
          , cpus    : metaData.cpus
          , networkInterfaces : metaData.networkInterfaces
          , address : metaData.expose.address
          , port : metaData.expose.port
        });
      io.emit('daemonList', dm.getDaemonList());

      debug('daemonList');
      debug(SCHEDULER.dm.getDaemonList());
    });

    socket.on('daemonLoad', function(metaData){
      dm.recalculateMaxJobs(socket.id,
        { loadavg  : metaData.loadavg
        , totalmem : metaData.totalmem
        , freemem  : metaData.freemem});
    });

    //JOBs
    socket.on('compileBefore', function(metaData){
      debug(metaData);
      dm.increaseJobCount(socket.id);

      io.emit("compileBefore", { daemonId : socket.id
                               , jobId : metaData.jobId || null
                               , jobs : dm.getJobCount(socket.id)
                               , workerId : metaData.workerId
                               , timestamp: new Date()});
    });
    socket.on('compileAfter', function(metaData){
      debug(metaData);
      dm.decreaseJobCount(socket.id);

      if (metaData.jobId)
        jm.removeJob(metaData.jobId);

      io.emit("compileAfter", { daemonId : socket.id
                              , jobId : metaData.jobId || null
                              , jobs : dm.getJobCount(socket.id)
                              , workerId : metaData.workerId
                              , timestamp: new Date()});
    });
    socket.on('compileLocal', function(metaData){
      debug(metaData);
      if (metaData.jobId) {
        jm.removeJob(metaData.jobId);
        io.emit("compileLocal", {daemonId : socket.id, jobId : metaData.jobId, timestamp: new Date()});
      }
    });

    //cache
    socket.on('cacheStored', function(metaData){
      cm.newCache(socket.id, metaData)
      debug(metaData);
    });
    socket.on('cacheExists', function(metaData){
      cm.removeCache(socket.id, metaData);

      if (metaData.jobId) {
        jm.removeJob(metaData.jobId);
        io.emit("cacheHitSucceeded", {daemonId : socket.id, jobId : metaData.jobId, timestamp: new Date()});
      }
      debug(metaData);
    });
    socket.on('cacheNotExists', function(metaData){
      cm.removeCache(socket.id, metaData);

      if (metaData.jobId) {
        io.emit("cacheHitFailed", {daemonId : socket.id, jobId : metaData.jobId, timestamp: new Date()});
      }
      debug(metaData);
    });

  });
};