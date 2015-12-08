'use strict';

var debug = require('debug')('secc:cachemanager');

var CacheManager = function(express, io, SECC, SCHEDULER) {
  if (!(this instanceof CacheManager)) {
     return new CacheManager(express, io, SECC, SCHEDULER);
  }

  this.caches = [];
};

CacheManager.prototype.cacheList = function() {
  var self = this;
  return self.caches;
}

CacheManager.prototype.clearCache = function() {
  var self = this;
  self.caches = [];
}

CacheManager.prototype.cacheExists = function(daemonId, metaData) {
  var self = this;

  for (var i = 0; i < self.caches.length; ++i) {
    if ( self.caches[i].daemonId === daemonId
      && self.caches[i].archiveId === metaData.archiveId
      && self.caches[i].sourceHash === metaData.sourceHash
      && self.caches[i].argvHash === metaData.argvHash)
      return true;
  }

  return false;
}

CacheManager.prototype.getCandidateDaemonIds = function(metaData) {
  var self = this;
  var candidates = [];

  for (var i = 0; i < self.caches.length; ++i) {
    if ( self.caches[i].archiveId === metaData.archiveId
      && self.caches[i].sourceHash === metaData.sourceHash
      && self.caches[i].argvHash === metaData.argvHash)
      candidates.push(self.caches[i].daemonId);
  }

  return candidates;
}

CacheManager.prototype.newCache = function(daemonId, metaData) {
  var self = this;

  if (self.cacheExists(daemonId, metaData))
    return;

  metaData.daemonId = daemonId;
  self.caches.push(metaData);
}

CacheManager.prototype.removeCache = function(daemonId, metaData) {
  var self = this;

  for (var i = 0; i < self.caches.length; ++i) {
    if ( self.caches[i].daemonId === daemonId
      && self.caches[i].archiveId === metaData.archiveId
      && self.caches[i].sourceHash === metaData.sourceHash
      && self.caches[i].argvHash === metaData.argvHash) {
      self.caches.splice(i,1);
      break;
    }
  }
}

CacheManager.prototype.removeDaemon = function(daemonId) {
  var self = this;
  debug('remove all caches over %s', daemonId);
  self.caches = self.caches.filter(function(e){
                                     return e.daemonId !== daemonId
                                   });
}

module.exports = CacheManager;
