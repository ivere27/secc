'use strict';

var debug = require('debug')('secc:routes:schedulerWebSocket');

var path = require('path');

module.exports = function(express, io, SECC, SCHEDULER) {
  var am = SCHEDULER.am;
  var cm = SCHEDULER.cm;
  var dm = SCHEDULER.dm;
  var jm = SCHEDULER.jm;
  var om = SCHEDULER.om;

  //sockets.
  io.on('connection', function(socket){
    debug('io connect!!! %s', socket.id);

    var daemonAddress = socket.handshake.address;
    var idx = daemonAddress.lastIndexOf(':');
    if (~idx && ~daemonAddress.indexOf('.'))
      daemonAddress = daemonAddress.slice(idx + 1);

    var newDaemon = { daemonId: socket.id, 
      jobs: 0, maxJobs: 0, type: 'guest', 
      daemonAddress : daemonAddress };
    dm.addDaemon(newDaemon);
    
    //send current Archives
    socket.emit('schedulerArchives', am.getArchiveList());
    socket.emit('daemonList', dm.getDaemonList());

    socket.on('connect', function(){
      debug('io connect.');

      socket.emit('event', { hello: 'world' });
    });
    socket.on('disconnect', function(){
      debug('io disconnect!!! %s', socket.id);
      cm.removeDaemon(socket.id);
      dm.removeDaemon(socket.id);
      jm.removeDaemon(socket.id);
    });
    socket.on('event', function(metaData){
      debug(metaData);
    });

    socket.on('daemonInformation', function(metaData){
      dm.setDaemonSystemInformation(socket.id
        , { system  : { hostname : metaData.hostname
                      , port     : metaData.port
                      , platform : metaData.platform
                      , release  : metaData.release
                      , arch     : metaData.arch
                      , gcc      : metaData.gcc
                      , clang    : metaData.clang
                      }
          , type    :'daemon'
          , maxJobs : metaData.numCPUs
          , numCPUs : metaData.numCPUs
          , maxCpuUsage : metaData.maxCpuUsage
          , cpus    : metaData.cpus
          , networkInterfaces : metaData.networkInterfaces});
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

      if (metaData.jobId) {
        io.emit("compileBefore", {daemonId : socket.id, jobId : metaData.jobId, timestamp: new Date()});
      }
    });
    socket.on('compileAfter', function(metaData){
      debug(metaData);
      dm.decreaseJobCount(socket.id);

      if (metaData.jobId) {
        jm.removeJob(metaData.jobId);
        io.emit("compileAfter", {daemonId : socket.id, jobId : metaData.jobId, timestamp: new Date()});
      }
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