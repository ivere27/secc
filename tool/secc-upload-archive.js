#!/usr/bin/env node
'use strict';

var crypto = require('crypto');
var fs = require("fs");
var http = require('http');
var url = require('url');
var path = require('path');

var SECC = require('../package.json');

var argv = process.argv;
var nodePath = argv.shift(); 
var commandPath = argv.shift();
var command = path.basename(commandPath);

var compiler = null;
var compilerPath = null;

var gccPath = null;
var gppPath = null;
var clangPath = null;
var clangppPath = null;
var archiveToolPath = null;
var schedulerUrl = null;

function howto() {
  console.log('SECC - %s', SECC.version);
  console.log('Upload a compiler archive to Scheduler server.\n')
  console.log('Options:')
  console.log('%s %s --gcc /path/to/gcc /path/to/g++ archivetool.js http://SCHEDULER:PORT', nodePath, command);
  console.log('%s %s --clang /path/to/clang /path/to/clang++ archivetool.js http://SCHEDULER:PORT', nodePath, command);
  console.log('\n');
  console.log('Example: linux');
  console.log('%s %s --gcc /usr/bin/gcc /usr/bin/g++ ./secc-create-archive-linux.js http://172.17.42.1:10509', nodePath, command);
  console.log('%s %s --clang /usr/bin/clang /usr/bin/clang++ ./secc-create-archive-linux.js http://172.17.42.1:10509', nodePath, command);
  console.log('');
  console.log('Example: mac');
  console.log('%s %s --clang /usr/bin/clang /usr/bin/clang++ ./secc-create-archive-mac.js http://172.17.42.1:10509', nodePath, command);

  process.exit(0);
}

if (argv.indexOf('--gcc') !== -1) {
  compiler = 'gcc';
  compilerPath = argv[argv.indexOf('--gcc') + 1];
  gccPath = argv[argv.indexOf('--gcc') + 1];
  gppPath = argv[argv.indexOf('--gcc') + 2];
  archiveToolPath = argv[argv.indexOf('--gcc') + 3];
  schedulerUrl = argv[argv.indexOf('--gcc') + 4];
} else if (argv.indexOf('--clang') !== -1) {
  compiler = 'clang';
  compilerPath = argv[argv.indexOf('--clang') + 1];
  clangPath = argv[argv.indexOf('--clang') + 1];
  clangppPath = argv[argv.indexOf('--clang') + 2];
  archiveToolPath = argv[argv.indexOf('--clang') + 3];
  schedulerUrl = argv[argv.indexOf('--clang') + 4];
} else {
  howto();
}

var archive = {};
var results = [];

function final() {
  var os = require('os');
  archive.platform = os.platform();
  archive.arch = os.arch();
  
  archive.compiler = compiler;

  archive.version = results[0];
  archive.dumpversion = results[1].replace(/\n$/, '');
  archive.dumpmachine = results[2].replace(/\n$/, '');
  archive.targets = [];
  archive.archiveLog = results[3];
  archive.archiveFile = archive.archiveLog.split('creating').pop().trim();

  var key = (function(e){
    //be aware of sequence. with dumpversion! without version.
    return e.platform + e.arch + e.compiler + e.dumpversion + e.dumpmachine;
  })(archive);
  archive.archiveId = crypto.createHash('sha1').update(key).digest('hex');
  
  console.log('JSON\n', archive);
  console.log('\n');
  console.log('JSON string\n', JSON.stringify(archive));
  console.log('\n\n');

  console.log('upload the archive file - ', archive.archiveFile);
  var FormData = require('form-data');
  var form = new FormData();

  var urlObject = url.parse(schedulerUrl + '/archive');
  var options = {
    hostname : urlObject.hostname,
    port : urlObject.port,
    path : urlObject.path,
    method : 'POST',
    headers : form.getHeaders()
  };

  var req = http.request(options);
  req.on('error', function(err) {return console.error(err);})
  req.setTimeout(60*1000, function(){
    this.abort();
    return console.error(new Error('Timeout in uploading the archive'));
  });
  req.on('response', function (res) {
    var data = '';
    res.on('data', function(chunk){data += chunk;});
    res.on('end', function(){
      if (res.statusCode !== 200) {
        console.error(data);
        return console.error(new Error('Error raised in uploading the archive'));
      }

      console.log('Scheduler server responded with : ' + data);
      console.log('\n');
      console.log('Upload done successfully!\n');
    });
  });

  form.append('archive', JSON.stringify(archive));
  form.append('archiveFile', fs.createReadStream(archive.archiveFile), {filename: archive.archiveFile});

  form.pipe(req);
}

function callChildProcess(command, cb) {
  var exec = require('child_process').exec,
      child;

  child = exec(command,cb);
}

function async(func, callback) {
  process.nextTick(function(){
    func(callback)
  });
}

//items to call each.
var items = [function(callback){
  callChildProcess(compilerPath + ' --version', function(error, stdout, stderr){
    if (error) throw error;
    callback(stdout);
  });
}, function(callback){
  callChildProcess(compilerPath + ' -dumpversion', function(error, stdout, stderr){
    if (error) throw error;
    callback(stdout);
  });
}, function(callback){
  callChildProcess(compilerPath + ' -dumpmachine', function(error, stdout, stderr){
    if (error) throw error;
    callback(stdout);
  });
}, function(callback){
  var command = null;
  if (compiler === 'gcc')
    command = archiveToolPath + ' --gcc ' + gccPath + ' ' + gppPath;
  else if (compiler === 'clang')
    command = archiveToolPath + ' --clang ' + clangPath + ' ' + clangppPath;

  callChildProcess(command , function(error, stdout, stderr){
    if (error) throw error;
    console.log(stdout);
    callback(stdout);
  });
}];


//series async
function series(item) {
  if(item) {
    async(item, function(result) {
      results.push(result);
      return series(items.shift());
    });
  } else {
    return final();
  }
}
series(items.shift());
