'use strict';

var debug = require('debug')('secc:job');
var crypto = require('crypto');
var arg = require('./arg.js');

var Job = function(SECC, argv, command, compilerPath) {
  if (!(this instanceof Job)) {
     return new Job(SECC, argv, command, compilerPath);
  }
  this.argv = argv;
  this.command = command;
  this.compilerPath = compilerPath;
  this.mode = (process.env.SECC_MODE == 2) ? '2' : '1';
  this.declaredSourcePath = arg.determineSourcePath(this.argv, false);
  this.declaredOutputPath = arg.determineOutputPath(this.argv, true);
  this.projectId = crypto.createHash('md5')
                   .update(process.env.SECC_PROJECT || process.cwd())
                   .digest("hex");

  this.cachePrefered = process.env.SECC_CACHE
                       ? ((process.env.SECC_CACHE == 1) ? true : false)
                       : SECC.client.cache;

  this.id = null;
  this.sourcePath = null;
  this.outputPath = null

  this.cachePrefered = (process.env.SECC_CACHE == 1) ? true : false;
  this.compilerInformation = null;
  this.compileFile = null;
  this.sourceHash = null;
};


module.exports = Job;
