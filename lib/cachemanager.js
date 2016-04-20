'use strict';

/*
  caches structure.
  {daemonId : {key:{archiveId,sourceHash,argvHash},key:{...}}
*/

var debug = require('debug')('secc:cachemanager');
var utils = require('./utils');

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
    for (var key in self.caches[daemonId]) {
      cacheList.push(self.caches[daemonId][key]);
    }
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

  var key = utils.getCacheKey(metaData.archiveId, metaData.sourceHash, metaData.argvHash);
  if (self.caches[daemonId].hasOwnProperty(key))
    return true;

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
  if (!self.caches.hasOwnProperty(daemonId))
    self.caches[daemonId] = {};

  if (self.cacheExists(daemonId, metaData))
    return;

  metaData.daemonId = daemonId;
  var key = utils.getCacheKey(metaData.archiveId, metaData.sourceHash, metaData.argvHash);
  self.caches[daemonId][key] = metaData;
}

CacheManager.prototype.removeCache = function(daemonId, metaData) {
  var self = this;

  if (!self.caches.hasOwnProperty(daemonId))
    return;

  var key = utils.getCacheKey(metaData.archiveId, metaData.sourceHash, metaData.argvHash);
  delete self.caches[daemonId][key];
}

CacheManager.prototype.removeDaemon = function(daemonId) {
  var self = this;
  debug('remove all caches over %s', daemonId);
  delete self.caches[daemonId];
}

module.exports = CacheManager;
