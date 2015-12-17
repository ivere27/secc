'use strict';

var debug = require('debug')('secc:daemonmanager');

var DaemonManager = function(express, io, SECC, SCHEDULER) {
  if (!(this instanceof DaemonManager)) {
     return new DaemonManager(express, io, SECC, SCHEDULER);
  }

  this.daemons = {};
};

DaemonManager.prototype.daemonExists = function(daemonId) {
  return this.daemons.hasOwnProperty(daemonId);
}

DaemonManager.prototype.addDaemon = function(metaData, cb) {
  var self = this;

  var daemonId = metaData.daemonId;

  if (self.daemonExists(daemonId))
    removeDaemon(daemonId);

  var daemon = { daemonId         : daemonId
               , jobs             : metaData.jobs
               , maxJobs          : metaData.maxJobs
               , daemonAddress    : metaData.daemonAddress
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
           , daemonAddress : d.daemonAddress 
           , type          : d.type
           , system        : d.system
           , creationDatetime     : d.creationDatetime };
  } else
    return null;
}

DaemonManager.prototype.getCandidateDaemonIds = function(job) {
  var self = this;
  debug(job);
  var candidate = [];

  for (var daemonId in self.daemons) {
    var daemon = self.daemons[daemonId];

    if (daemon.type !== 'daemon') continue;

    if (daemon.system.platform !== job.systemInformation.platform) continue;
    if (daemon.system.arch !== job.systemInformation.arch) continue;

    //pass same daemon. mask only for test purpose.
    if (job.systemInformation.hostname === daemon.system.hostname) continue;

    if (daemon.jobs < (daemon.maxJobs - 2)) {
      candidate.push(daemon.daemonId);
    }
  };
  return candidate;
}

DaemonManager.prototype.setDaemonSystemInformation = function(daemonId, information) {
  var self = this;

  if (self.daemonExists(daemonId)) {
    var daemon = self.daemons[daemonId];
    daemon.system = information.system;
    daemon.type = information.type;
    daemon.maxJobs = information.maxJobs;    
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

module.exports = DaemonManager;
