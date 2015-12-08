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
  this.archives = [];

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
  var self = this;

  for (var i = 0; i < self.archives.length; ++i) {
    if (self.archives[i].archiveId === archiveId)
      return true;
  }

  return false;
}

ArchiveManager.prototype.getArchiveId = function(information) {
  var self = this;

  for (var i = 0; i < self.archives.length; ++i) {
    if ( self.archives[i].platform === information.platform
      && self.archives[i].arch === information.arch
      && self.archives[i].compiler === information.compiler
      && self.archives[i].dumpversion === information.dumpversion
      && self.archives[i].dumpmachine === information.dumpmachine ) {
      
      return self.archives[i].archiveId;
    }
  }
  return null;
}

ArchiveManager.prototype.getArchiveInfo = function(archiveId) {
  var self = this;

  if (typeof archiveId === 'undefined' || archiveId === null)
    return null;

  for (var i = 0; i < self.archives.length; ++i) {
    if (self.archives[i].archiveId === archiveId) {
      var a = self.archives[i];
      return {archiveId: a.archiveId
            , platform: a.platform
            , arch: a.arch
            , compiler: a.compiler
            , version: a.version
            , dumpversion: a.dumpversion
            , dumpmachine: a.dumpmachine
            , archiveLog: a.archiveLog
            , archiveFile: a.archiveFile
            , creationDatetime : a.creationDatetime};
    }
  }

  return null;
}

ArchiveManager.prototype.getArchiveList = function() {
  var self = this;
  var archiveList = [];

  for (var i = 0; i < self.archives.length; ++i) {
    var a = self.archives[i]; 
    archiveList.push( {archiveId: a.archiveId
                    , platform: a.platform
                    , arch: a.arch
                    , compiler: a.compiler
                    , version: a.version
                    , dumpversion: a.dumpversion
                    , dumpmachine: a.dumpmachine
                    , archiveLog: a.archiveLog
                    , archiveFile: a.archiveFile
                    , creationDatetime : a.creationDatetime} )
  }

  return archiveList;
}

ArchiveManager.prototype.addArchive = function(archive, file, cb) {
  var self = this;

  if (self.archiveExists(archive.archiveId))
    return cb(new Error('This archive already exists'));

  archive.creationDatetime = new Date();

  //file..
  var fs = require('fs');
  var path = require('path');
  return fs.rename(path.join(self.uploadDir, file.filename), path.join(self.archiveDir, archive.archiveFile), function(err){
    if(err) return cb(err);

    self.archives.push(archive);

    self.saveArchivesToJSON();
    return cb(null, archive);    
  })
}

ArchiveManager.prototype.removeArchive = function(archiveId, cb) {
  var self = this;

  if (!self.archiveExists(archiveId))
    return cb(new Error('Archive not exists'));

  for (var i = 0; i < self.archives.length; ++i) {
    if (self.archives[i].archiveId === archiveId) {
      var fs = require('fs');
      return fs.unlink(self.archiveDir + self.archives[i].archiveFile , function(err){
        if (err) return cb(err);

        self.archives.splice(i--, 1);

        self.saveArchivesToJSON();
        return cb(null);
      });
    }
  }
  
  cb(new Error('something broken in removeArchive'));
}

module.exports = ArchiveManager;
