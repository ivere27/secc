#!/usr/bin/env node
'use strict';

//FIXME : merge with secc-create-archive-linux.js
//        os.platform() === 'darwin'
//trace by $ sudo /usr/bin/dtruss -a -p <PID|SHELL PID>

var os = require('os');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var async = require('async');
var mkdirp = require('mkdirp');

var environment = require('../lib/environment');

var argv = process.argv;
var cwd = process.cwd();

var nodePath = argv.shift(); 
var commandPath = argv.shift();
var command = path.basename(commandPath);

var addList = {};
var addFileList = [];
var tempDirectory = null;
var contentsHash = null;

var compilerName = null; //clang
var compilerPath = null;

var ccPath = null;
var cppPath = null;
var ccRealPath = null;
var cppRealPath = null;

/* clang is located in /usr/local/bin/clang
   $ brew install llvm --with-clang --with-clang-extra-tools --with-libcxx
   $ brew link llvm --force
*/
function howto() {
  console.log('usage: %s --clang <clang_path> <clang++_path>', command);
  process.exit(0);
}

if (argv.indexOf('--clang') !== -1) {
  compilerName = 'clang';
  compilerPath = argv[argv.indexOf('--clang')+1];
  ccPath = argv[argv.indexOf('--clang')+1];
  cppPath = argv[argv.indexOf('--clang')+2];
} else {
  howto();
}

function callChildProcess(command, options, cb) {
  var exec = require('child_process').exec,
      child;

  if (typeof cb === 'undefined')
    child = exec(command, options);
  else
    child = exec(command, options, cb);
}

var debug = require('debug')('secc:tool');
function addFile(object, filePath, targetPath, cb, level) {
  if (object.hasOwnProperty(filePath)) return cb(null);
  if (typeof level === 'undefined')
    var level = 0;
  debug((" " + level).slice(-2) + ' level. path is : ' + filePath);

  object[filePath] = {target : targetPath};
  var realpath = fs.realpathSync(filePath);
  callChildProcess('file ' + realpath, function(err, stdout, stderr){
    if (err) return cb(err);
    object[filePath]['realpath'] = realpath;
    object[filePath]['type'] = null;
    object[filePath]['fileStdout'] = stdout;
    if (object[filePath]['fileStdout'].indexOf('Mach-O') !== -1) {
      object[filePath]['type'] = 'Mach-O';
      callChildProcess('otool -L ' + realpath, function(err, stdout, stderr){
        if (err) return cb(err);

        object[filePath]['otoolStdout'] = stdout;
        var arr = object[filePath]['otoolStdout'].trim().split('\n');
        var dependencies = [];

        for (var i in arr) {
          if ((arr[i].indexOf(path.basename(filePath)) !== -1) ||  //first line. fileName: [(architecture i386|x86_64)]
              (arr[i].indexOf(path.basename(object[filePath]['realpath'])) !== -1))
            continue;

          var dependencyPath = arr[i].trim().split(/\s+/)[0];
          if (arr[i] === filePath) continue; //same path

          dependencies.push(dependencyPath);
        }

        //recursive dependencies
        async.eachSeries(dependencies, function(dependencyPath, callback) {
          addFile(object, dependencyPath, dependencyPath, callback, level+1);
        }, function(err){
          if(err)
            return cb(err);
          return cb(null);
        });
      });
    } else  //normal file
      return cb(null);
  });
}

console.log('SECC archive generator.');
async.series([
  //findout where clang is
  function(callback){
    callChildProcess(compilerPath + ' -print-prog-name=clang', function(err, stdout, stderr){
      if (err) return callback(err);
      ccRealPath = stdout.trim();
      addFile(addList, ccRealPath, '/usr/bin/clang', callback);
    });
  },
  //add cc1plus
  function(callback){
    callChildProcess(compilerPath + ' -print-prog-name=clang++', function(err, stdout, stderr){
      if (err) return callback(err);
      cppRealPath = stdout.trim();
      addFile(addList, cppRealPath, '/usr/bin/clang++', callback);
    });
  },
  //when clang and clang++ are same(mostly), just make a symbolic link.
  function(callback){
    if (fs.realpathSync(ccRealPath) === fs.realpathSync(cppRealPath)) {
      addList[cppRealPath]['symbolic'] = true;
      addList[cppRealPath]['makeSymbolic'] = true;
    }

    callback(null);
  },
  //make up addList.
  function(callback){
    //https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man1/dyld.1.html
    var dependencies = [];
    dependencies.push('/usr/lib/dyld');
    dependencies.push('/usr/bin/as');
    dependencies.push('/bin/sh');
    //dependencies.push('/bin/ls'); //chroot test purpose.

    //additional dependencies
    async.eachSeries(dependencies, function(dependencyPath, cb) {
      addFile(addList, dependencyPath, dependencyPath, cb);
    }, function(err){
      if(err)
        return callback(err);
      return callback(null);
    });
  },

  //create a temp directory.
  function(callback){
    tempDirectory = path.join(os.tmpdir(), 'SECC_' + crypto.randomBytes(10).toString('hex'));
    mkdirp.sync(tempDirectory, '0775');

    console.log('mkdir temp directory : %s',tempDirectory);
    callback(null);
  },
  //copy add files to the temp directory
  function(callback){
    async.eachSeries(Object.keys(addList), function(filePath, cb) {
      mkdirp.sync(path.join(tempDirectory, path.dirname(addList[filePath]['target'])), '0775');
      var tempPath = path.join(tempDirectory, addList[filePath]['target']);
      addList[filePath]['tempPath'] = tempPath;

      //using 'cp' instead of readable/writable stream to copy.(to preserve mode)
      if (addList[filePath]['makeSymbolic']) {
        console.log('make link %s', filePath);
        var relativePath = path.relative(path.dirname(addList[cppRealPath]['tempPath']), addList[ccRealPath]['tempPath']);
        callChildProcess('ln -s ' + relativePath + ' ' + tempPath, function(err, stdout, stderr){
          if (err) return cb(err);
          cb(null);
        });
      } else if (addList[filePath]['copySymbolic']) {
        console.log('copy link %s', filePath);
        var option = '-P';
        callChildProcess('cp ' + filePath + ' ' + tempPath + ' ' + option, function(err, stdout, stderr){
          if (err) return cb(err);
          cb(null);
        });
      } else {
        console.log('copy %s', filePath);
        callChildProcess('cp ' + filePath + ' ' + tempPath, function(err, stdout, stderr){
          if (err) return cb(err);
          cb(null);
        });
      }
    }, function(err){
      if(err)
        return callback(err);

      callback(null);
    });
  },
  // //strip. ex) cc1 and cc1plus are huge.
  // function(callback){
  //   async.eachSeries(Object.keys(addList), function(filePath, cb) {
  //     var tempPath = addList[filePath]['tempPath'];

  //     if (addList[filePath]['type'] === 'Mach-O') {
  //       console.log('strip %s', tempPath);
  //       callChildProcess('strip -S ' + tempPath, function(err, stdout, stderr){
  //         if (err) return cb(err);
  //         cb(null);
  //       });
  //     } else {
  //       cb(null);
  //     }
  //   }, function(err){
  //     if(err)
  //       return callback(err);
  //     callback(null);
  //   });
  // },
  //hashing,
  function(callback){
    async.eachSeries(Object.keys(addList), function(filePath, cb) {
      if (addList[filePath]['symbolic'])  //skip on symbolic links.
        return cb(null);

      var tempPath = addList[filePath]['tempPath'];
      var stream = fs.createReadStream(tempPath);
      var hash = crypto.createHash('md5');
      hash.setEncoding('hex');

      stream.on('error', function(err){
        cb(err);
      });
      stream.on('end', function() {
        hash.end();
        addList[filePath]['hash'] = hash.read();
        cb(null);
      });
      stream.pipe(hash);
    }, 
    function(err){
      if(err) 
        return callback(err || new Error('hashing error.'));

      callback(null);
    }); 
  },
  //tar,
  function(callback) {
    var command = '';

    //get md5 sum by hashes(sorted).
    var keys = Object.keys(addList);
    keys.sort();

    var hash = crypto.createHash('md5')
    keys.forEach(function(filePath){
      if (!addList[filePath]['symbolic'])
        hash.update(addList[filePath]['hash']);

      command += ' ' + path.relative(tempDirectory, addList[filePath]['tempPath'])
    });

    contentsHash = hash.digest("hex");
    console.log('md5sum %s', contentsHash);

    command = 'tar -cvz --numeric-owner -f ' 
              + path.join(cwd, contentsHash + '.tar.gz')
              + command;

    console.log('creating %s', contentsHash + '.tar.gz');
    callChildProcess(command, {cwd : tempDirectory}, function(err, stdout, stderr){
      if (err) return callback(err);
      callback(null);
    });
  },
  //finally rm -rf tempDirectory
  function(callback){
    callChildProcess('rm -rf ' + tempDirectory, function(err, stdout, stderr){
      if (err) return callback(err);
      callback(null);
    });
  }
],
function(err, results){
  if (err) {
    console.log('error');
    console.log(err);
    return;
  }

  //console.log(tempDirectory);
  //console.log(addList);
  //console.log(contentsHash);
  //console.log(addFileList);
});

