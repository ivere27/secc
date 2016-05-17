'use strict';

var debug = require('debug')('secc:'+process.pid+':routes:daemonWebSocket');
var os = require('os');

var environment = require('../lib/environment.js');

module.exports = function(socket, SECC, DAEMON) {

  socket.on('connect', function(){
    //console.log(socket);
    console.log('secc-scheduler %s:%s connected.', SECC.daemon.scheduler.address, SECC.daemon.scheduler.port);

    environment.getGccClangCompilerInformation(function(err, results) {
      if(err)
        return console.err(err);

      var daemonInformation = environment.getSystemInformation();

      if(results.gcc)
        daemonInformation.gcc = results.gcc;

      if(results.clang)
        daemonInformation.clang = results.clang;

      daemonInformation.cpus = os.cpus();
      daemonInformation.networkInterfaces = os.networkInterfaces();
      daemonInformation.address = SECC.daemon.address;
      daemonInformation.expose = {
        address : SECC.daemon.expose.address,
        port : SECC.daemon.expose.port
      };
      daemonInformation.maxCpuUsage = SECC.daemon.maxCpuUsage || 100;

      socket.emit('daemonInformation', daemonInformation);

      DAEMON.loadReportTimer = setInterval(function(){
        socket.emit('daemonLoad', { loadavg : os.loadavg()
                                  , totalmem : os.totalmem()
                                  , freemem : os.freemem()})
      },5000);
    });

    DAEMON.broadcast('daemonIdChanged', {daemonId : socket.id});
  });

  socket.on('event', function(data){
    debug(data) ;
  });

  socket.on('schedulerArchives', function(data){
    DAEMON.broadcast('schedulerArchives', data);
  });


  socket.on('clearCache', function(data){
    //debug(data);
    if (SECC.daemon.cache) {
      redisClient.flushdb(function(err, didSucceed){
        debug('redis flushed : %s', didSucceed);
      });
    }
  });

  socket.on('disconnect', function(){
    console.log('secc-scheduler disconnected.')

    if (DAEMON.loadReportTimer)
      clearInterval(DAEMON.loadReportTimer);

    DAEMON.broadcast('daemonIdChanged', {daemonId : null});
  });

};