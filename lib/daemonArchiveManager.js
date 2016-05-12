'use strict';

var debug = require('debug')('secc:daemonarchivemanager');
var path = require('path');
var zlib = require('zlib');

var mkdirp = require('mkdirp');

var DaemonArchiveManager = function(socket, SECC, DAEMON) {
  if (!(this instanceof DaemonArchiveManager)) {
     return new DaemonArchiveManager(socket, SECC, DAEMON);
  }
  this.SECC = SECC;
  this.DAEMON = DAEMON;
};

DaemonArchiveManager.prototype.installArchive = function(archiveId) {
  var self = this;
  var archivePath = path.join(this.SECC.runPath, 'preprocessed', archiveId);

  debug('install archiveId %s to %s', archiveId, archivePath);

  process.nextTick(function(){
    var fs = require('fs');
    var archiveIdToInstall = archiveId;

    var http = require('http');
    var options = {
      hostname: self.SECC.daemon.scheduler.address,
      port: self.SECC.daemon.scheduler.port,
      path: '/archive/' + archiveIdToInstall + '/file/',
      method: 'GET'
    };

    debug("download %s", options.path);

    var req = http.request(options);
    req.on('error', function(err) {return debug(err);})
    req.setTimeout(60000, function(){
        //FIXME : report to the scheduler.
        return debug(new Error('Timeout in downloading the archive file'));
    });
    req.on('response', function(res) {
      if(res.statusCode !== 200) {
        this.abort();
        //FIXME : report to the scheduler.
        return debug(new Error('Timeout in downloading the archive file'));
      }

      var extract = require('tar').Extract({path: archivePath});
      extract.on('error', function(err) {
        debug(err);
        self.DAEMON.broadcast('removeLocalPrepArchiveIdInProgress', {archiveId : archiveIdToInstall });
      });
      extract.on('end',function(){
        debug('download and extract done : %s', archivePath);
        mkdirp.sync(path.join(archivePath, 'tmp'));

        debug('copy chdir.sh to archivePath');
        fs.createReadStream(path.join(self.SECC.toolPath,'chdir.sh'))
          .pipe(fs.createWriteStream(path.join(archivePath,'chdir.sh')));

        self.DAEMON.broadcast('removeLocalPrepArchiveIdInProgress', {archiveId : archiveIdToInstall });
        self.DAEMON.broadcast('addLocalPrepArchiveId', {archiveId : archiveIdToInstall });
      });

      res.pipe(zlib.createGunzip()).pipe(extract);
    });
    req.end();
  });

}

module.exports = DaemonArchiveManager;


