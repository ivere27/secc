'use strict';

var debug = require('debug')('secc:archivemanager');
var mkdirp = require('mkdirp');

var ArchiveManager = function(express, io, SECC, SCHEDULER) {
  if (!(this instanceof ArchiveManager)) {
     return new ArchiveManager(express, io, SECC, SCHEDULER);
  }

  this.uploadDir = __dirname + '/../uploads/';
  this.archiveDir = __dirname + '/../archive/';
  this.archiveDB = this.archiveDir + 'archive.json';
  this.archives = {};

  //mkdir if not exists.
  mkdirp.sync(this.uploadDir);
  mkdirp.sync(this.archiveDir);

  this.loadArchivesFromJson();
};

ArchiveManager.prototype.loadArchivesFromJson = function() {
  var self = this;
  var fs = require('fs');

  try {
    var data = fs.readFileSync(self.archiveDB);
    self.archives = JSON.parse(data.toString());
  } catch(e) {
    debug("archive.json read error")
  }

}

ArchiveManager.prototype.saveArchivesToJSON = function() {
  var self = this;
  var fs = require('fs');

  try {
    var data = fs.writeFileSync(self.archiveDB, JSON.stringify(self.archives,null,2));
  } catch(e) {
    debug("archive.json write error")
  }

}

ArchiveManager.prototype.archiveExists = function(archiveId) {
  return this.archives.hasOwnProperty(archiveId);
}

ArchiveManager.prototype.getArchiveId = function(information) {
  var self = this;

  for (var archiveId in self.archives) {
    var a = self.archives[archiveId];
    if ( a.platform === information.platform
      && a.arch === information.arch
      && a.compiler === information.compiler
      && a.version === information.version
      && a.dumpversion === information.dumpversion
      && a.dumpmachine === information.dumpmachine) {
      return a.archiveId;
    }
  }

  return null;
}

ArchiveManager.prototype.getArchiveInfo = function(archiveId) {
  var self = this;

  if (self.archiveExists(archiveId)) {
    var a = self.archives[archiveId];
    return {archiveId: a.archiveId
          , platform: a.platform
          , arch: a.arch
          , compiler: a.compiler
          , version: a.version
          , dumpversion: a.dumpversion
          , dumpmachine: a.dumpmachine
          , targets: a.targets
          , archiveLog: a.archiveLog
          , archiveFile: a.archiveFile
          , creationDatetime : a.creationDatetime};
  } else
    return null;
}

ArchiveManager.prototype.getArchiveList = function() {
  var self = this;
  var archiveList = [];

  for(var archiveId in self.archives) {
    archiveList.push(self.getArchiveInfo(archiveId));
  }
  return archiveList;
}

ArchiveManager.prototype.getArchiveIdsByTarget = function(target) {
  var self = this;
  var archiveIds = [];

  for(var archiveId in self.archives) {
    if (self.archives[archiveId].targets.indexOf(target) !== -1)
      archiveIds.push(archiveId);
  }

  return archiveIds;
}

ArchiveManager.prototype.addTarget = function(archiveId, target, cb) {
  var self = this;

  if (!self.archiveExists(archiveId))
    return cb(new Error('Archive not exists'));

  var archive = self.archives[archiveId];
  if (archive.targets.indexOf(target) !== -1)
    return cb(null, archive); //Target already exists

  archive.targets.push(target);
  self.saveArchivesToJSON();
  return cb(null, archive);
}

ArchiveManager.prototype.removeTarget = function(archiveId, target, cb) {
  var self = this;

  if (!self.archiveExists(archiveId))
    return cb(new Error('Archive not exists'));

  var archive = self.archives[archiveId];
  var index = archive.targets.indexOf(target);
  if (index === -1)
    return cb(null, archive); //Target not exists

  archive.targets.splice(index, 1);
  self.saveArchivesToJSON();
  return cb(null, archive);
}

ArchiveManager.prototype.addArchive = function(archive, file, cb) {
  var self = this;

  if (self.archiveExists(archive.archiveId))
    return cb(new Error('This archive already exists'));

  archive.creationDatetime = new Date();

  //file..
  var fs = require('fs');
  var path = require('path');
  var fromFile = path.join(self.uploadDir, file.filename);
  var toFile = path.join(self.archiveDir, archive.archiveFile);

  //FIXME : looks ugly.. need to refactoring.
  return fs.createReadStream(fromFile)
    .on('error',function(err){
      debug('error raised in createReadStream');
      debug(err);
      fs.unlink(fromFile, function(err){
        if(err && err.code !== 'ENOENT')
          return debug(err);
        return ;
      });
      return cb(err);
    })
    .pipe(fs.createWriteStream(toFile))
    .on('error', function(err){
      debug('error raised in createWriteStream');
      debug(err);
      fs.unlink(toFile, function(err){
        if(err && err.code !== 'ENOENT')
          return debug(err);
        return ;
      });
      return cb(err);
    })
    .on('finish', function(){
      debug('copy done.');
      fs.unlink(fromFile, function(err){
        if(err && err.code !== 'ENOENT')
          return debug(err);
        return ;
      });

      self.archives[archive.archiveId] = archive;
      self.saveArchivesToJSON();
      return cb(null, archive);
    });
}

ArchiveManager.prototype.removeArchive = function(archiveId, cb) {
  var self = this;

  if (!self.archiveExists(archiveId))
    return cb(new Error('Archive not exists'));

  var fs = require('fs');
  return fs.unlink(self.archiveDir + self.archives[archiveId].archiveFile , function(err){
    if (err) return cb(err);

    delete self.archives[archiveId];
    self.saveArchivesToJSON();
    return cb(null);
  });

  cb(new Error('Assert not reached in removeArchive'));
}

module.exports = ArchiveManager;
