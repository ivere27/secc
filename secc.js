#!/usr/bin/env node

console.time('SECC')
var debug = require('debug')('secc:client');  // 4~5ms
var fs = require('fs');
var path = require('path');
var settings = require('./settings.json');
debug('--- SECC START ---');

//print all arguments for test purpose.
if (process.env.SECC_CMDLINE) {
  var args = 'DEBUG=* SECC_MODE=1 SECC_CACHE=0 ';
  for (var i in process.argv)
    args += "'" + process.argv[i] + "' ";

  debug('-- Direct Command --')
  // debug('environment');
  // debug(process.env);

  debug('cd ' + process.cwd());
  debug(args);
}

//define passThrough
var passThrough = function() {
  var os = require('os');
  //FIXME : check by freemem(128MB) ?
  var isSystemStable = function(criteria) {
    return (os.freemem() > (criteria || 1024*1024*128)) ? true : false;
  };
  var passThroughCompile = function(command, argv) {
    debug('passThrough');
    var spawn = require('child_process').spawn,
        exec = spawn(command, argv, {stdio: 'inherit'});
  };

 //check memory usages to prevent full load.
  if(isSystemStable())
    return passThroughCompile(job.compilerPath, job.originalArgv);
  else {
    return setTimeout(function(){
      if(isSystemStable())
        return passThroughCompile(job.compilerPath, job.originalArgv);
      else
        debug('wait... free memory is low.')
        return setTimeout(arguments.callee, 5000);
    }, 5000);
  }
};

//define a new job.
var job = {};
job.argv = process.argv.slice();
job.nodePath = job.argv.shift();
job.commandPath = job.argv.shift();
job.command = path.basename(job.commandPath);
job.originalArgv = job.argv.slice();
job.compilerPath = path.join('/','usr','bin', job.command);
job.mode = (process.env.SECC_MODE == 2) ? '2' : '1';
job.declaredSourcePath = null;
job.declaredOutputPath = null;
job.projectId = null;
job.cachePrefered = process.env.SECC_CACHE
                  ? ((process.env.SECC_CACHE == 1) ? true : false)
                  : settings.client.cache;
job.crossPrefered = process.env.SECC_CROSS
                  ? ((process.env.SECC_CROSS == 1) ? true : false)
                  : settings.client.cross;
job.id = null;
job.sourcePath = null;
job.outputPath = null;
job.compilerInformation = null;
job.compileFile = null;
job.sourceHash = null;

if (['c++', 'cc', 'clang++', 'clang', 'g++', 'gcc'].indexOf(job.command) === -1) {
  console.log('print how-to');
  return;
}

job.compiler = fs.realpathSync(job.compilerPath);
if (job.compiler.indexOf('clang') !== -1)
  job.compiler = 'clang';
else if ((job.compiler.indexOf('gcc') !== -1) || (job.compiler.indexOf('g++') !== -1))
  job.compiler = 'gcc';
else
  return passThrough();

if (process.cwd().indexOf('CMakeFiles') !== -1) //always passThrough in CMakeFiles
  return passThrough();

//debug(job);

require('async').waterfall([
  //parsing options.
  function(callback) {
    var http = require("http");
    var formData = {
      compiler : job.compiler,
      cwd : process.cwd(),
      mode : job.mode,
      argv : job.argv
    }; 
    var options = {
      hostname: settings.client.scheduler.address,
      port: settings.client.scheduler.port,
      path: '/option/analyze',
      method: 'POST',
      headers : {'Content-Type': 'application/json'}
    };

    var req = http.request(options);
    req.on('error', function(err) {return callback(err);})
    req.setTimeout(1000, function(){
      this.abort();
      return callback(new Error('Timeout in request /option/analyze'));
    });
    req.on('response', function (res) {
      if(res.statusCode !== 200 
        || res.headers['content-type'].indexOf('application/json') === -1) {
        this.abort();
        return callback(new Error('Error raised in /option/analyze request'));
      }
      var data = '';
      res.on('data', function(chunk){data += chunk;});
      res.on('end', function(){
        var json = JSON.parse(data);

        if (json.useLocal)
          return callback(new Error('Use Local from Scheduler'));

        job.projectId = json.projectId;
        job.language = json.language;
        job.declaredSourcePath = json.infile;
        job.declaredOutputPath = json.outfile;
        job.preprocessedInfile = json.preprocessedInfile;
        job.multipleOutfiles = json.multipleOutfiles;
        job.argvHash = json.argvHash;
        job.localArgv = json.localArgv;
        job.remoteArgv = json.remoteArgv;
        debug(json);
        callback(null);
      });
    });
    req.write(JSON.stringify(formData));
    req.end();
  },

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
      return passThrough();
    }

    //Everything is okay.
    debug(process.memoryUsage());
    debug('--- SECC END ---');
    if (process.env.DEBUG) console.timeEnd('SECC')
  }
);