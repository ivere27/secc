'use strict';

var debug = require('debug')('secc:jobmanager');

var JobManager = function(express, io, SECC, SCHEDULER) {
  if (!(this instanceof JobManager)) {
     return new JobManager(express, io, SECC, SCHEDULER);
  }

  this.jobIndex = 0;
  this.jobs = [];
};

JobManager.prototype.jobList = function() {
  var self = this;
  return self.jobs;
}

JobManager.prototype.clearJob = function() {
  var self = this;
  self.jobs = [];
}

JobManager.prototype.setDaemonOfJob = function(jobId, daemonId) {
  var self = this;

  for (var i = 0; i < self.jobs.length; ++i) {
    if (self.jobs[i].id == jobId) {
      self.jobs[i].daemonId = daemonId;
      break;
    }
  }
}

JobManager.prototype.newJob = function(metaData) {
  var self = this;
  var job = {
    id                  : ++self.jobIndex,
    mode                : metaData.mode,
    sourcePath          : metaData.sourcePath,
    projectId           : metaData.projectId,
    archiveId           : metaData.archiveId,
    daemonId            : metaData.daemonId,
    cachePrefered       : metaData.cachePrefered,
    crossPrefered       : metaData.crossPrefered,

    systemInformation   : metaData.systemInformation,
    compilerInformation : metaData.compilerInformation,
    sourceHash          : metaData.sourceHash,
    argvHash            : metaData.argvHash,

    clientAddress       : metaData.clientAddress,

    createdAt     : new Date()
  };

  self.jobs.push(job);
  return job;
}

JobManager.prototype.removeJob = function(jobId) {
  var self = this;

  for (var i = 0; i < self.jobs.length; ++i) {
    if (self.jobs[i].id == jobId) {
      self.jobs.splice(i,1);
      break;
    }
  }
}

JobManager.prototype.removeDaemon = function(daemonId) {
  var self = this;
  debug('remove all jobs over daemon %s', daemonId);
  self.jobs = self.jobs.filter(function(e){
                                 return e.daemonId !== daemonId
                               });
}

module.exports = JobManager;
