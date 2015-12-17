'use strict';

/*
  caches structure.
  {daemonId : [{archiveId,sourceHash,argvHash},{...}]}
*/

var debug = require('debug')('secc:cachemanager');

var CacheManager = function(express, io, SECC, SCHEDULER) {
  if (!(this instanceof CacheManager)) {
     return new CacheManager(express, io, SECC, SCHEDULER);
  }

  this.caches = {};
};

CacheManager.prototype.cacheList = function() {
  var self = this;
  var cacheList = [];

  for (var daemonId in self.caches) {
    cacheList.push.apply(cacheList, self.caches[daemonId]);
  }
  return cacheList;
}

CacheManager.prototype.clearCache = function() {
  var self = this;
  self.caches = {};
}

CacheManager.prototype.cacheExists = function(daemonId, metaData) {
  var self = this;

  if (!self.caches.hasOwnProperty(daemonId))
    return false;

  for (var i = 0; i < self.caches[daemonId].length; ++i) {
    if ( self.caches[daemonId][i].archiveId === metaData.archiveId
      && self.caches[daemonId][i].sourceHash === metaData.sourceHash
      && self.caches[daemonId][i].argvHash === metaData.argvHash)
      return true;
  }

  return false;
}

CacheManager.prototype.getCandidateDaemonIds = function(metaData) {
  var self = this;
  var candidates = [];

  for (var daemonId in self.caches) {
    if (self.cacheExists(daemonId, metaData))
      candidates.push(daemonId);
  }
  return candidates;
}

CacheManager.prototype.newCache = function(daemonId, metaData) {
  var self = this;

  if (self.cacheExists(daemonId, metaData))
    return;

  if (!self.caches.hasOwnProperty(daemonId))
    self.caches[daemonId] = [];

  metaData.daemonId = daemonId;
  self.caches[daemonId].push(metaData);
}

CacheManager.prototype.removeCache = function(daemonId, metaData) {
  var self = this;

  if (!self.caches.hasOwnProperty(daemonId))
    return;

  for (var i = 0; i < self.caches[daemonId].length; ++i) {
    if ( self.caches[daemonId][i].archiveId === metaData.archiveId
      && self.caches[daemonId][i].sourceHash === metaData.sourceHash
      && self.caches[daemonId][i].argvHash === metaData.argvHash) {
      self.caches[daemonId].splice(i,1);
      break;
    }
  }
}

CacheManager.prototype.removeDaemon = function(daemonId) {
  var self = this;
  debug('remove all caches over %s', daemonId);
  delete self.caches[daemonId];
}

module.exports = CacheManager;
