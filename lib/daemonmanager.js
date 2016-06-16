'use strict';

var debug = require('debug')('secc:daemonmanager');

var net = require('net');
var utils = require('./utils.js')

var DaemonManager = function(express, io, SECC, SCHEDULER) {
  if (!(this instanceof DaemonManager)) {
     return new DaemonManager(express, io, SECC, SCHEDULER);
  }

  this.SECC = SECC;
  this.daemons = {};
  this.am = SCHEDULER.am;
};

DaemonManager.prototype.daemonExists = function(daemonId) {
  return this.daemons.hasOwnProperty(daemonId);
}

DaemonManager.prototype.addDaemon = function(metaData, cb) {
  var self = this;

  var daemonId = metaData.daemonId;

  if (self.daemonExists(daemonId))
    self.removeDaemon(daemonId);

  var daemon = { daemonId         : daemonId
               , jobs             : metaData.jobs
               , maxJobs          : metaData.maxJobs
               , maxCpuUsage      : 0
               , numCPUs          : 0
               , daemonAddress    : metaData.daemonAddress
               , daemonPort       : metaData.daemonPort
               , type             : metaData.type
               , creationDatetime : new Date()};

  self.daemons[daemonId] = daemon;
  if(typeof cb === 'function') return cb(null, daemon);
}

DaemonManager.prototype.removeDaemon = function(daemonId) {
  var self = this;

  if (self.daemonExists(daemonId))
    delete self.daemons[daemonId];
}

DaemonManager.prototype.getDaemonList = function() {
  var self = this;
  var daemonList = [];

  for (var daemonId in self.daemons) {
    daemonList.push(self.getDaemonInfo(daemonId));
  }
  return daemonList;
}

DaemonManager.prototype.getDaemonInfo = function(daemonId) {
  var self = this;
  var daemonList = [];

  if (self.daemonExists(daemonId)) {
    var d = self.daemons[daemonId];
    return { daemonId      : d.daemonId
           , jobs          : d.jobs
           , maxJobs       : d.maxJobs
           , numCPUs       : d.numCPUs
           , daemonAddress : d.daemonAddress
           , daemonPort    : d.daemonPort
           , type          : d.type
           , system        : d.system
           , creationDatetime     : d.creationDatetime };
  } else
    return null;
}

DaemonManager.prototype.getCandidateDaemonIds = function(job, archiveInfo) {
  var self = this;
  debug(job);
  var candidate = {};

  for (var daemonId in self.daemons) {
    var daemon = self.daemons[daemonId];

    if (daemon.type !== 'daemon') continue;

    if (daemon.system.platform !== job.systemInformation.platform) continue;
    if (daemon.system.arch !== job.systemInformation.arch) continue;

    //pass same daemon.
    if ( !self.SECC.experimental.allowLocalDaemon
      && job.clientAddress === daemon.daemonAddress) continue;

    if (daemon.jobs < daemon.maxJobs) { //(daemon.maxJobs - 2)
      candidate[daemonId] = {cross : false, archiveId : archiveInfo.archiveId};
    }
  };

  return candidate;
}

DaemonManager.prototype.getCandidateCrossDaemonIds = function(job, crossArchiveIds) {
  var self = this;
  debug(job);
  var candidate = {};

  // add cross machines. FIXME : merge with above code.
  if (job.crossPrefered && (crossArchiveIds.length > 0)) {
    crossArchiveIds.forEach(function(crossArchiveId){
      var archiveInfo = self.am.getArchiveInfo(crossArchiveId);
        for (var daemonId in self.daemons) {
          var daemon = self.daemons[daemonId];

          if (daemon.type !== 'daemon') continue;

          //pass same daemon.
          if ( !self.SECC.experimental.allowLocalDaemon
            && job.systemInformation.hostname === daemon.system.hostname) continue;

          if ( (daemon.system.platform === archiveInfo.platform)
            && (daemon.system.arch === archiveInfo.arch)
            && (daemon.jobs < daemon.maxJobs) //daemon.maxJobs - 2
            && (!candidate.hasOwnProperty(daemonId))) {
            candidate[daemonId] = {cross : true, archiveId : crossArchiveId};
          }
        }
    })
  }

  return candidate;
}

DaemonManager.prototype.setDaemonSystemInformation = function(daemonId, information) {
  var self = this;

  debug(information);
  if (self.daemonExists(daemonId)) {
    var daemon = self.daemons[daemonId];
    daemon.system = information.system;
    daemon.type = information.type;
    daemon.maxJobs = information.maxJobs;
    daemon.maxCpuUsage = information.maxCpuUsage;
    daemon.numCPUs = information.numCPUs;
    daemon.cpus = information.cpus;
    daemon.networkInterfaces = information.networkInterfaces;

    if (net.isIPv4(information.address))
      daemon.daemonAddress = information.address;
    if (utils.isLegalPort(information.port))
      daemon.daemonPort = Number(information.port);

    // FIXME : workaround patch.
    // set any IPv4 address when SCHEDULER and DAEMON are in the same PC
    // and SECC.daemon.scheduler.address = '127.0.0.1' in settings.json
    if (daemon.daemonAddress === '127.0.0.1') {
      for (var adpater in daemon.networkInterfaces) {
        if (adpater === 'lo') continue;
        for (var i in daemon.networkInterfaces[adpater]) {
          if (daemon.networkInterfaces[adpater][i].family === 'IPv4') {
            daemon.daemonAddress = daemon.networkInterfaces[adpater][i].address;
          }
        }
      }
    }

    // FIXME : 100% of cpuUsage is safe?
    if (daemon.maxCpuUsage > 100) daemon.maxCpuUsage = 100;
    if (daemon.maxCpuUsage <= 0) {
      daemon.maxCpuUsage = 0;
      daemon.maxJobs = 0;
    }
  }
}

DaemonManager.prototype.increaseJobCount = function(daemonId) {
  var self = this;

  if (self.daemonExists(daemonId))
    self.daemons[daemonId].jobs += 1;
}

DaemonManager.prototype.decreaseJobCount = function(daemonId) {
  var self = this;

  if (self.daemonExists(daemonId) && self.daemons[daemonId].jobs > 0)
    self.daemons[daemonId].jobs -= 1;
}

DaemonManager.prototype.getJobCount = function(daemonId) {
  var self = this;

  if (self.daemonExists(daemonId))
    return self.daemons[daemonId].jobs;

  return 0;
}

DaemonManager.prototype.recalculateMaxJobs = function(daemonId, loadInfo) {
  var self = this;

  if (!self.daemonExists(daemonId))
    return;

  var daemon = self.daemons[daemonId];

  if (daemon.maxCpuUsage == 0) return;

  // FIXME : need a better algorithm and long test.
  // calculate with cpu/memory/time/network(bandwidth/ping) etc.
  // loadavg, totalmem, freemem

  var _01_cpuUsage = (loadInfo.loadavg[0] / daemon.numCPUs * 100) | 0;
  var _05_cpuUsage = (loadInfo.loadavg[1] / daemon.numCPUs * 100) | 0;
  var _15_cpuUsage = (loadInfo.loadavg[2] / daemon.numCPUs * 100) | 0;

  if (_05_cpuUsage > daemon.maxCpuUsage) {
    daemon.maxJobs = (daemon.maxCpuUsage / 100 * daemon.numCPUs) | 0;
    return;
  }

  if (_01_cpuUsage > daemon.maxCpuUsage) {
    daemon.maxJobs = Math.round(daemon.maxCpuUsage / 100 * daemon.numCPUs * 2 * 0.60);
  } else if (_01_cpuUsage > (daemon.maxCpuUsage*0.9)) {
    daemon.maxJobs = Math.round(daemon.maxCpuUsage / 100 * daemon.numCPUs * 2 * 0.65);
  } else if (_01_cpuUsage > (daemon.maxCpuUsage*0.8)) {
    daemon.maxJobs = Math.round(daemon.maxCpuUsage / 100 * daemon.numCPUs * 2 * 0.70);
  } else if (_01_cpuUsage > (daemon.maxCpuUsage*0.7)) {
    daemon.maxJobs = Math.round(daemon.maxCpuUsage / 100 * daemon.numCPUs * 2 * 0.75);
  } else if (_01_cpuUsage > (daemon.maxCpuUsage*0.6)) {
    daemon.maxJobs = Math.round(daemon.maxCpuUsage / 100 * daemon.numCPUs * 2 * 0.80);
  } else {
    daemon.maxJobs = Math.round(daemon.maxCpuUsage / 100 * daemon.numCPUs * 2 * 0.85);
  }

  //in case of, 1 <= maxJobs <= daemon.numCPUs * 2
  if (daemon.maxJobs > (daemon.numCPUs * 2))
    daemon.maxJobs = daemon.numCPUs * 2;
  if (daemon.maxJobs == 0)
    daemon.maxJobs = 1;

  debug('%s - maxJobs : %s / _01_cpuUsage : %s / maxCpuUsage : %s : ', daemonId, daemon.maxJobs, _01_cpuUsage, daemon.maxCpuUsage);
}

module.exports = DaemonManager;
