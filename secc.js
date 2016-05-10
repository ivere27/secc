#!/usr/bin/env node

var _SECC_START_TIME = new Date();
if (process.env.DEBUG && process.env.SECC_LOG) {
  try {
    process.env['DEBUG_FD'] = require('fs').openSync(process.env.SECC_LOG, 'a+');
  } catch(e) {}
}

var debug = require('debug')('secc:'+process.pid+':client');  // 4~5ms
var fs = require('fs');
var path = require('path');
var settings = require('./settings.json');
debug('--- SECC START --- ' + _SECC_START_TIME);

//print all arguments for test purpose.
if (process.env.SECC_CMDLINE) {
  debug('-- Direct Command --')
  var env = '';
  for (var key in process.env) {
    if (key === 'DEBUG_FD') continue;
    env += '' + key + "='" + process.env[key].replace("'","''")+"' ";
  }

  var args = '';
  for (var i in process.argv)
    args += "'" + process.argv[i] + "' ";
  debug('cd ' + process.cwd());
  debug(env + '  \\\n  ' + args);
}

//define passThrough
var passThrough = function() {
  var os = require('os');
  //FIXME : check by freemem(50MB) ?
  var isSystemStable = function(criteria) {
    return (os.freemem() > (criteria || 1024*1024*50)) ? true : false;
  };
  var passThroughCompile = function(command, argv) {
    debug('passThrough');
    var spawn = require('child_process').spawn,
        exec = spawn(command, argv, {stdio: 'inherit'});
    exec.on('close', function(code) {
      debug(process.memoryUsage());
      debug('--- SECC END --- ' + (new Date() - _SECC_START_TIME) + ' ms');
      process.exit(code);
    });
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

//FIXME : sync or callback? //async.detect(pathArray, fs.stat, function(result){});
var lookupInPath = function(seccPath, command) {
  var pathArray = process.env.PATH.split(':')
                  .map(function(e){return path.join(e, command)})
                  .filter(function(e){return e !== seccPath});

  for(var i in pathArray) {
    try {
      fs.statSync(pathArray[i]);
      return pathArray[i];
    } catch(e) {}
  }

  return null;
}

//define a new job.
var job = {};
job.argv = process.argv.slice();
job.nodePath = job.argv.shift();
job.commandPath = job.argv.shift();
job.command = path.basename(job.commandPath);
job.originalArgv = job.argv.slice();
job.mode = process.env.SECC_MODE
         ? ((process.env.SECC_MODE == 2) ? '2' : '1')
         : settings.client.mode;
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
job.target = null;
job.targetSpecified = false;

if (['cc', 'clang', 'gcc'].indexOf(job.command) !== -1) {
  job.compilerPath = process.env.SECC_CC
                   ? process.env.SECC_CC
                   : ((settings.client.CC)
                     ? settings.client.CC
                     : lookupInPath(job.commandPath, job.command));
} else if (['c++', 'clang++', 'g++'].indexOf(job.command) !== -1) {
  job.compilerPath = process.env.SECC_CXX
                   ? process.env.SECC_CXX
                   : ((settings.client.CXX)
                     ? settings.client.CXX
                     : lookupInPath(job.commandPath, job.command));
} else {
  console.log('print how-to');
  process.exit(1);
}

job.compiler = fs.realpathSync(job.compilerPath);
if (job.compiler.indexOf('clang') !== -1)
  job.compiler = 'clang';
else if ((job.compiler.indexOf('gcc') !== -1) || (job.compiler.indexOf('g++') !== -1))
  job.compiler = 'gcc';
else
  return passThrough();

//quick check
if ( (job.argv.indexOf('-c') === -1)
  || (process.cwd().indexOf('CMakeFiles') !== -1)) //always passThrough in CMakeFiles
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
      hostname: process.env.SECC_ADDRESS || settings.client.scheduler.address,
      port: process.env.SECC_PORT || settings.client.scheduler.port,
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
        job.target = json.target;
        job.targetSpecified = json.targetSpecified;
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
    debug('--- SECC END --- ' + (new Date() - _SECC_START_TIME) + ' ms');
  }
);