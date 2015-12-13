'use strict';

var debug = require('debug')('secc:job');
var crypto = require('crypto');
var path = require('path');
var arg = require('./arg.js');
var utils = require('./utils.js');

var Job = function(settings, argv) {
  if (!(this instanceof Job)) {
     return new Job(settings, argv); //, command, compilerPath
  }
  this.argv = argv;
  this.nodePath = argv.shift();    //node path. /usr/bin/nodejs or /usr/bin/node
  this.commandPath = argv.shift(); //command. ./nodejs.js or ./bin/gcc
  this.command = path.basename(this.commandPath);
  this.originalArgv = argv.slice();  //for passThrough
  this.compilerPath = path.join('/','usr','bin', this.command);

  this.mode = (process.env.SECC_MODE == 2) ? '2' : '1';
  this.declaredSourcePath = arg.determineSourcePath(this.argv, false);
  this.declaredOutputPath = arg.determineOutputPath(this.argv, true);
  this.projectId = crypto.createHash('md5')
                   .update(process.env.SECC_PROJECT || process.cwd())
                   .digest("hex");

  this.cachePrefered = process.env.SECC_CACHE
                       ? ((process.env.SECC_CACHE == 1) ? true : false)
                       : settings.client.cache;

  this.id = null;
  this.sourcePath = null;
  this.outputPath = null;

  this.compilerInformation = null;
  this.compileFile = null;
  this.sourceHash = null;

  //FIXME
  this.useLocal = false;

  this.analyze();
};

//FIXME, need to be accurated
Job.prototype.analyze = function() {
  if (process.env.SECC_USELOCAL == 1  //always use local compiler.
    || this.argv.indexOf('-c') === -1   //when -c not exists
    || this.argv.indexOf('-M') !== -1   //when -M exists
    || this.argv.indexOf('-E') !== -1   //when -E exists
    || process.cwd().indexOf('CMakeFiles') !== -1) //always passThrough in CMakeFiles
    this.useLocal = true;
};

Job.prototype.passThrough = function() {
  var self = this;
  var os = require('os');
  //FIXME : check by freemem(64MB) ?
  var isSystemStable = function(criteria) {
    return (os.freemem() > (criteria || 1024*1024*64)) ? true : false;
  };
  var passThroughCompile = function(command, argv) {
    debug('passThrough');
    var spawn = require('child_process').spawn,
        exec = spawn(command, argv, {stdio: 'inherit'});
  };

 //check memory usages to prevent full load.
  if(isSystemStable())
    return passThroughCompile(self.compilerPath, self.originalArgv);
  else {
    return setTimeout(function(){
      if(isSystemStable())
        return passThroughCompile(self.compilerPath, self.originalArgv);
      else
        debug('wait... free memory is low.')
        return setTimeout(arguments.callee, 5000);
    }, 5000);
  }
};

module.exports = Job;
