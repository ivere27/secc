'use strict';

var debug = require('debug')('secc:routes:daemonWebSocket');
var os = require('os');

var environment = require('../lib/environment.js');

module.exports = function(express, socket, SECC, DAEMON) {

  socket.on('connect', function(){
    //console.log(socket);
    debug('socket.io - connected.')

    environment.getGccClangCompilerInformation(function(err, results) {
      if(err) 
        return console.err(err);

      var daemonInformation = environment.getSystemInformation(SECC);
      
      if(results.gcc)
        daemonInformation.gcc = results.gcc;

      if(results.clang)
        daemonInformation.clang = results.clang;

      daemonInformation.cpus = os.cpus();
      daemonInformation.networkInterfaces = os.networkInterfaces();
      daemonInformation.maxCpuUsage = SECC.daemon.maxCpuUsage || 100;

      socket.emit('daemonInformation', daemonInformation);

      DAEMON.loadReportTimer = setInterval(function(){
        socket.emit('daemonLoad', { loadavg : os.loadavg()
                                  , totalmem : os.totalmem()
                                  , freemem : os.freemem()})
      },5000);
    });
  });

  socket.on('event', function(data){
    debug(data) ;
  });
  socket.on('schedulerArchives', function(data){
    //debug(data);
    DAEMON.Archives.schedulerArchives = data;
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
    debug('socket.io - disconnected.')

    if (DAEMON.loadReportTimer)
      clearInterval(DAEMON.loadReportTimer);
  });

};