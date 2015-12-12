'use strict';

var debug = require('debug')('secc:daemonmanager');

var DaemonManager = function(express, io, SECC, SCHEDULER) {
  if (!(this instanceof DaemonManager)) {
     return new DaemonManager(express, io, SECC, SCHEDULER);
  }

  this.jobIndex = 0;
  this.daemons = [];
};

DaemonManager.prototype.addDaemon = function(metaData, cb) {
  var self = this;

  var daemon = { id            : metaData.id
               , jobs          : metaData.jobs
               , maxJobs       : metaData.maxJobs
               , daemonAddress : metaData.daemonAddress
               , type          : metaData.type
               , createdAt     : new Date()};

  self.daemons.push(daemon);
  if(typeof cb === 'function') return cb(null, daemon);
}


DaemonManager.prototype.getDaemonList = function() {
  var self = this;
  var daemonList = [];

  for (var i = 0; i < self.daemons.length; ++i) {
    var d = self.daemons[i]; 
    daemonList.push( { id            : d.id
                     , jobs          : d.jobs
                     , maxJobs       : d.maxJobs
                     , daemonAddress : d.daemonAddress 
                     , type          : d.type
                     , system        : d.system
                     , createdAt     : d.createdAt });
  }

  return daemonList;
}

DaemonManager.prototype.getDaemonInfo = function(daemonId) {
  var self = this;
  var daemonList = [];

  for (var i = 0; i < self.daemons.length; ++i) {
    if(self.daemons[i].id === daemonId) {
      var d = self.daemons[i]; 
      return { id            : d.id
             , jobs          : d.jobs
             , maxJobs       : d.maxJobs
             , daemonAddress : d.daemonAddress 
             , type          : d.type
             , system        : d.system
             , createdAt     : d.createdAt };
    }
  }

  return null;
}

DaemonManager.prototype.getCandidateDaemonIds = function(job) {
  var self = this;
  debug(job);
  var candidate = [];
  for (var i = 0; i < self.daemons.length; i++) {
    if (self.daemons[i].type !== 'daemon') continue;

    if (self.daemons[i].system.platform !== job.systemInformation.platform) continue;
    if (self.daemons[i].system.arch !== job.systemInformation.arch) continue;

    //pass same daemon. mask only for test purpose.
    if (job.systemInformation.hostname === self.daemons[i].system.hostname) continue;

    if (self.daemons[i].jobs < (self.daemons[i].maxJobs - 2)) {
      candidate.push(self.daemons[i].id);
    }
  };
  return candidate;
}


DaemonManager.prototype.removeDaemon = function(daemonId) {
  var self = this;

  for (var i = 0; i < self.daemons.length; ++i) {
    if ( self.daemons[i].id === daemonId) {
      self.daemons.splice(i,1);
      break;
    }
  }
}

DaemonManager.prototype.setDaemonSystemInformation = function(daemonId, options) {
  var self = this;

  for (var i = 0; i < self.daemons.length; ++i) {
    if ( self.daemons[i].id === daemonId) {
      self.daemons[i].system = options.system;
      self.daemons[i].type = options.type;
      self.daemons[i].maxJobs = options.maxJobs;
      break;
    }
  }
}

DaemonManager.prototype.increaseJobCount = function(daemonId) {
  var self = this;

  for (var i = 0; i < self.daemons.length; ++i) {
    if ( self.daemons[i].id === daemonId) {
      self.daemons[i].jobs = self.daemons[i].jobs + 1;
      break;
    }
  }
}

DaemonManager.prototype.decreaseJobCount = function(daemonId) {
  var self = this;

  for (var i = 0; i < self.daemons.length; ++i) {
    if ( self.daemons[i].id === daemonId) {
      self.daemons[i].jobs = (self.daemons[i].jobs === 0) ? 0 : self.daemons[i].jobs-1;
      break;
    }
  }
}

module.exports = DaemonManager;
