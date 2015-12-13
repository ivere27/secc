#!/usr/bin/env node
'use strict';

console.time('SECC')
var debug = require('debug')('secc:client');  // 4~5ms
var settings = require('./settings.json');
debug('--- SECC START ---');

//define a new job.
var job = require('./lib/job.js')(settings, process.argv.slice());
debug('projectId : %s , SourcePath : %s , OutputPath : %s, cachePrefered : %s'
  , job.projectId, job.declaredSourcePath, job.declaredOutputPath, job.cachePrefered);

if (['c++', 'cc', 'clang++', 'clang', 'g++', 'gcc'].indexOf(job.command) === -1) {
  console.log('print how-to');
  return;
}

// FIXME : check the policy. 
if (job.useLocal)
  return job.passThrough();

require('async').waterfall([
  //check which compiler is using.
  function(callback) {
    var environment = require('./lib/environment.js');
    environment.getCompilerInformation(job.compilerPath, function(err, compilerInformation) {
      if (err) return callback(err);

      delete compilerInformation.stats;
      job.compilerInformation = compilerInformation;
      debug('compiler information - %s... %s %s'
        , compilerInformation.version.substr(0,30)
        , compilerInformation.dumpversion
        , compilerInformation.dumpmachine);

      callback(null);
    })
  },

  //get right outputPath, sourcePath.
  function(callback) {
    var options = {compiler: job.compilerPath, argv: job.argv};
    var compile = require('./lib/compile.js');
    compile.GetDependencies(options).on('finish', function(err, compileFile) {
      if (err) {
        debug('GetDependencies Error Raised.');
        debug(options);
        return callback(err);  //GetDependencies error.
      }

      debug('GetDependencies done. compileFile is....')
      debug('source : %s, object : %s, dependencies total : %d'
        ,compileFile.sourceFile, compileFile.objectFile, compileFile.dependencies.length);

      //FIXME : arrange right outputPath and sourcePath. 
      job.compileFile = compileFile;
      job.outputPath = job.declaredOutputPath || compileFile.objectFile;
      job.sourcePath = job.declaredSourcePath || compileFile.sourceFile;
      debug('arranged sourcePath %s , outputPath %s', job.sourcePath, job.outputPath);

      callback(null);
    });
  },

  //mode
  function(callback) {
    if(job.mode == '2') { //performPumpMode
      require('./lib/clientPump.js').performPumpMode(job, settings, function(err){
        if (err)
          return callback(err);

        callback(null);
      });
    } else { // performPreprocessedMode(default)
      require('./lib/clientPreprocessed.js').performPreprocessedMode(job, settings, function(err){
        if (err)
          return callback(err);

        callback(null);
      });
    }
  }
  ],

  //finally
  function(err) {
    if(err) {
      debug(err);
      return job.passThrough();
    }

    //Everything is okay.
    debug(process.memoryUsage());
    debug('--- SECC END ---');
    if (process.env.DEBUG) console.timeEnd('SECC')
  }
);