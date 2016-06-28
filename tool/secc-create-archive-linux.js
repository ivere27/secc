#!/usr/bin/env node
'use strict';

var os = require('os');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var async = require('async');
var mkdirp = require('mkdirp');

var environment = require('../lib/environment');

var argv = process.argv;
var cwd = process.cwd();

argv.shift(); // pop nodePath
var commandPath = argv.shift();
var command = path.basename(commandPath);

var addList = {};
var addFileList = [];
var tempDirectory = null;
var contentsHash = null;

var compiler = null; // gcc || clang
var compilerPath = null;

var ccPath = null;
var cppPath = null;

function howto() {
  console.log('usage: %s --gcc <gcc_path> <g++_path>', command);
  console.log('usage: %s --clang <clang_path> <clang++_path>', command);
  process.exit(0);
}

if (argv.indexOf('--gcc') !== -1) {
  compiler = 'gcc';
  compilerPath = argv[argv.indexOf('--gcc') + 1];
  ccPath = argv[argv.indexOf('--gcc') + 1];
  cppPath = argv[argv.indexOf('--gcc') + 2];

  addList[ccPath] = {target: '/usr/bin/gcc'};
  addList[cppPath] = {target: '/usr/bin/g++'};
} else if (argv.indexOf('--clang') !== -1) {
  compiler = 'clang';
  compilerPath = argv[argv.indexOf('--clang') + 1];
  ccPath = argv[argv.indexOf('--clang') + 1];
  cppPath = argv[argv.indexOf('--clang') + 2];

  addList[ccPath] = {target: '/usr/bin/clang'};
  addList[cppPath] = {target: '/usr/bin/clang++'};
} else {
  howto();
}

function callChildProcess(command, options, cb) {
  var exec = require('child_process').exec;

  if (typeof cb !== 'function') {
    exec(command, options);
  } else {
    exec(command, options, cb);
  }
}

console.log('SECC archive generator.');
async.series([
  // add cc1
  function(callback) {
    if (compiler === 'clang') {
      return callback(null);
    }

    callChildProcess(compilerPath + ' -print-prog-name=cc1', function(err, stdout, stderr) {
      if (err) return callback(err);
      var cc1 = stdout.trim();
      addList[cc1] = {target: '/usr/bin/cc1'};
      callback(null);
    });
  },
  // add cc1plus
  function(callback) {
    if (compiler === 'clang') {
      return callback(null);
    }

    callChildProcess(compilerPath + ' -print-prog-name=cc1plus', function(err, stdout, stderr) {
      if (err) return callback(err);
      var cc1plus = stdout.trim();
      addList[cc1plus] = {target: '/usr/bin/cc1plus'};
      callback(null);
    });
  },
  // add liblto_plugin.so
  function(callback) {
    if (compiler === 'clang') {
      return callback(null);
    }

    callChildProcess(compilerPath + ' -print-file-name=liblto_plugin.so', function(err, stdout, stderr) {
      if (err) return callback(err);
      var libltoPlugin = stdout.trim();
      addList[libltoPlugin] = {target: libltoPlugin};
      callback(null);
    });
  },
  // add 'includes' symbolic link for clang.
  function(callback) {
    if (compiler === 'gcc') {
      return callback(null);
    }

    environment.getClangCompilerVersionByMacro(compilerPath, function(err, versionString, versionObject) {
      if (err) return callback(err);

      // http://clang.llvm.org/docs/LibTooling.html#libtooling-builtin-includes
      var version1 = versionObject.major + '.' + versionObject.minor;
      var includePath1 = path.join(path.dirname(compilerPath), '..', 'lib', 'clang', version1, 'include');
      addList[includePath1] = {target: includePath1, symbolic: true, copySymbolic: true};

      // since ubuntu:14.04 and clang-3.5,
      // '/usr/bin/../lib/clang/major.minor.patch/' path should be included
      var version2 = versionObject.major + '.' + versionObject.minor + '.' + versionObject.patch;
      var includePath2 = path.join(path.dirname(compilerPath), '..', 'lib', 'clang', version2, 'include');

      fs.lstat(includePath2, function(err, stats) {
        if (!err && stats.isSymbolicLink()) {
          addList[includePath2] = {target: includePath2, symbolic: true, copySymbolic: true};
        }

        callback(null);
      });
    });
  },
  // when clang and clang++ are same(mostly), just make a symbolic link.
  function(callback) {
    if (compiler === 'gcc') {
      return callback(null);
    }

    if (fs.realpathSync(ccPath) === fs.realpathSync(cppPath)) {
      addList[cppPath]['symbolic'] = true;
      addList[cppPath]['makeSymbolic'] = true;
    }

    callback(null);
  },
  // make up addList.
  function(callback) {
    addList['/usr/bin/as'] = {target: '/usr/bin/as'};
    addList['/usr/bin/objcopy'] = {target: '/usr/bin/objcopy'};
    addList['/bin/sh'] = {target: '/bin/sh'};
    addList['/bin/true'] = {target: '/bin/true'};

    callback(null);
  },
  // check shared object.
  function(callback) {
    async.eachSeries(Object.keys(addList), function(filePath, cb) {
      var realpath = fs.realpathSync(filePath);
      callChildProcess('file ' + realpath, function(err, stdout, stderr) {
        if (err) throw cb(err);
        addList[filePath]['realpath'] = realpath;
        addList[filePath]['type'] = null;
        addList[filePath]['fileStdout'] = stdout;

        if (addList[filePath]['fileStdout'].indexOf('ELF') !== -1) {
          addList[filePath]['type'] = 'ELF';
          callChildProcess('ldd ' + realpath, function(err, stdout, stderr) {
            if (err) throw cb(err);

            addList[filePath]['lddStdout'] = stdout;
            cb(null);
          });
        } else {
          cb(null);
        }
      });
    }, function(err) {
      if (err) {
        return callback(err);
      }

      callback(null);
    });
  },
  // parsing lddStdout
  function(callback) {
    async.eachSeries(Object.keys(addList), function(filePath, cb) {
      if (addList[filePath]['type'] === 'ELF') {
        var arr = addList[filePath]['lddStdout'].trim().split('\n');
        arr.map(function(dependency) {
          var arr = dependency.trim().split(/\s+/);

          if (arr.length === 2) {
            addFileList.push(arr[0]);
          } else if (arr.length === 3) {
            addFileList.push(arr[0]);
          } else if (arr.length === 4) {
            addFileList.push(arr[2]);
          } else {
            console.error(addList[filePath]);
            throw new TypeError('incorrect lddStdout length');
          }
        });
      }

      cb(null);
    }, function(err) {
      if (err) {
        return callback(err);
      }

      callback(null);
    });
  },
  // remove duplications. //remove unnecessary file(ex, linux-vdso.so.1)
  function(callback) {
    addFileList = addFileList.filter(function(item, pos, self) {
      return self.indexOf(item) === pos;
    });

    addFileList = addFileList.filter(function(item, pos, self) {
      return item.indexOf('linux-vdso.so') === -1;
    });

    callback(null);
  },
  // re-arrange. addFileList to addList
  function(callback) {
    addFileList.map(function(filePath) {
      if (!(filePath in addList)) {
        addList[filePath] = {target: filePath};
      }
    });

    callback(null);
  },
  // create a temp directory.
  function(callback) {
    tempDirectory = path.join(os.tmpdir(), 'SECC_' + crypto.randomBytes(10).toString('hex'));
    mkdirp.sync(tempDirectory, '0775');

    console.log('mkdir temp directory : %s', tempDirectory);
    callback(null);
  },
  // copy add files to the temp directory
  function(callback) {
    async.eachSeries(Object.keys(addList), function(filePath, cb) {
      mkdirp.sync(path.join(tempDirectory, path.dirname(addList[filePath]['target'])), '0775');
      var tempPath = path.join(tempDirectory, addList[filePath]['target']);
      addList[filePath]['tempPath'] = tempPath;

      // using 'cp' instead of readable/writable stream to copy.(to preserve mode)
      if (addList[filePath]['makeSymbolic']) {
        console.log('make link %s', filePath);
        var relativePath = path.relative(path.dirname(addList[cppPath]['tempPath']), addList[ccPath]['tempPath']);
        callChildProcess('ln -s ' + relativePath + ' ' + tempPath, function(err, stdout, stderr) {
          if (err) return cb(err);
          cb(null);
        });
      } else if (addList[filePath]['copySymbolic']) {
        console.log('copy link %s', filePath);
        var option = '-P';
        callChildProcess('cp ' + filePath + ' ' + tempPath + ' ' + option, function(err, stdout, stderr) {
          if (err) return cb(err);
          cb(null);
        });
      } else {
        console.log('copy %s', filePath);
        callChildProcess('cp ' + filePath + ' ' + tempPath, function(err, stdout, stderr) {
          if (err) return cb(err);
          cb(null);
        });
      }
    }, function(err) {
      if (err) {
        return callback(err);
      }

      callback(null);
    });
  },
  // copy ld.so.conf
  function(callback) {
    mkdirp.sync(path.join(tempDirectory, 'etc'), '0775');

    var filePath = '/etc/ld.so.conf';
    var tempPath = path.join(tempDirectory, filePath);

    console.log('copying %s', filePath);
    callChildProcess('cp ' + filePath + ' ' + tempPath, function(err, stdout, stderr) {
      if (err) return callback(err);

      addList[filePath] = {target: filePath, tempPath: tempPath};
      // FIXME make ld.so.conf to absolute. is it necessary?
      callback(null);
    });
  },
  // generate ld.so.cache
  function(callback) {
    var filePath = '/etc/ld.so.cache';
    var tempPath = path.join(tempDirectory, filePath);

    console.log('generate %s', tempPath);
    callChildProcess('ldconfig -r ' + tempDirectory, function(err, stdout, stderr) {
      if (err) return callback(err);

      addList[filePath] = {target: filePath, tempPath: tempPath};
      callback(null);
    });
  },
  // strip. ex) cc1 and cc1plus are huge.
  function(callback) {
    async.eachSeries(Object.keys(addList), function(filePath, cb) {
      var tempPath = addList[filePath]['tempPath'];

      if (addList[filePath]['type'] === 'ELF') {
        console.log('strip %s', tempPath);
        callChildProcess('strip -s ' + tempPath, function(err, stdout, stderr) {
          if (err) return cb(err);
          cb(null);
        });
      } else {
        cb(null);
      }
    }, function(err) {
      if (err) {
        return callback(err);
      }
      callback(null);
    });
  },
  // hashing,
  function(callback) {
    async.eachSeries(Object.keys(addList), function(filePath, cb) {
      if (addList[filePath]['symbolic']) { // skip on symbolic links.
        return cb(null);
      }

      var tempPath = addList[filePath]['tempPath'];
      var stream = fs.createReadStream(tempPath);
      var hash = crypto.createHash('md5');
      hash.setEncoding('hex');

      stream.on('error', function(err) {
        cb(err);
      });
      stream.on('end', function() {
        hash.end();
        addList[filePath]['hash'] = hash.read();
        cb(null);
      });
      stream.pipe(hash);
    },
      function(err) {
        if (err) {
          return callback(err || new Error('hashing error.'));
        }

        callback(null);
      });
  },
  // tar,
  function(callback) {
    var command = '';

    // get md5 sum by hashes(sorted).
    var keys = Object.keys(addList);
    keys.sort();

    var hash = crypto.createHash('md5');
    keys.forEach(function(filePath) {
      if (!addList[filePath]['symbolic']) {
        hash.update(addList[filePath]['hash']);
      }

      command += ' ' + path.relative(tempDirectory, addList[filePath]['tempPath']);
    });

    contentsHash = hash.digest('hex');
    console.log('md5sum %s', contentsHash);

    command = 'tar -cvz --numeric-owner -f ' + path.join(cwd, contentsHash + '.tar.gz') + command;

    console.log('creating %s', contentsHash + '.tar.gz');
    callChildProcess(command, {cwd: tempDirectory}, function(err, stdout, stderr) {
      if (err) return callback(err);
      callback(null);
    });
  },
  // finally rm -rf tempDirectory
  function(callback) {
    callChildProcess('rm -rf ' + tempDirectory, function(err, stdout, stderr) {
      if (err) return callback(err);
      callback(null);
    });
  }
],
  function(err, results) {
    if (err) {
      console.log('error');
      console.log(err);
      return;
    }

  // console.log(tempDirectory)
  // console.log(addList)
  // console.log(contentsHash)
  // console.log(addFileList)
  });
