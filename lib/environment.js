'use strict';

var debug = require('debug')('secc:'+process.pid+':environment')

var os = require('os');
var fs = require('fs');
var crypto = require('crypto');
var path = require('path');

var async = require('async');
var compile = require('./compile.js');

var generatorArchiveId = function(archive) {
  var key = (function(e){
    // be aware of sequence.
    // clang's dumpversion is always '4.2.1' due to gcc compatibility
    return e.platform + e.arch + e.compiler + e.compilerVersion + e.dumpmachine;
  })(archive);

  return crypto.createHash('sha1').update(key).digest('hex');
};

var getSystemInformation = function() {
  return {hostname: os.hostname(),
          platform: os.platform(),
          release : os.release(),
          arch    : os.arch(),
          numCPUs : os.cpus().length
  };
};

function getGccClangCompilerInformation(cb) {
  async.parallel({
    gcc: function(callback) {
      getGccCompilerInformation(callback);
    },
    clang: function(callback) {
      getClangCompilerInformation(callback);
    }
  },cb);
}

// in Ubuntu Linux, $ /usr/bin/gcc --version
// GCC comes with "gcc (Ubuntu 5.3.1-14ubuntu2.1) 5.3.1 20160413 ..."
// CLANG comes with "clang version 3.8.0-2ubuntu3 (tags/RELEASE_380/final) ..."
function getCompilerVersionFromString(compiler, version) {
  if (compiler === 'gcc') {
    var matched = version.match(/(gcc|g\+\+).*(\d+)\.(\d+)\.(\d+)/g);
    if (matched) {
      var vers = matched[0].match(/(\d+)\.(\d+)\.(\d+)/g);
      return vers[vers.length -1];  //return last one.
    }
  } else if (compiler === 'clang') {
    var matched = version.match(/(clang|LLVM) version (\d+)\.(\d+)(\.(\d+))?/g);
    if (matched) {
      var vers = matched[0].match(/(\d+)\.(\d+)(\.(\d+))?/g);
      return vers[vers.length -1];  //return last one.
    }
  }

  return null;
}

function getGccCompilerVersionByMacro(compilerPath, cb) {
  compile.CompilerInformation(compilerPath,'macro')
    .on('error',function(err){return cb(err);})
    .on('data',function(data){
      var majorString = '__GNUC__';
      var minorString = '__GNUC_MINOR__';
      var patchString = '__GNUC_PATCHLEVEL__';

      var data = data.toString();

      if (data.indexOf('__clang__') !== -1)
        return cb(new Error('invalid compiler'));

      var major = data.substring(data.indexOf(majorString) + majorString.length, data.indexOf('\n', data.indexOf(majorString))).trim();
      var minor = data.substring(data.indexOf(minorString) + minorString.length, data.indexOf('\n', data.indexOf(minorString))).trim();
      var patch = data.substring(data.indexOf(patchString) + patchString.length, data.indexOf('\n', data.indexOf(patchString))).trim();

      var versionString = major + '.' + minor + '.' + patch;
      var versionObject = {major : major, minor : minor, patch : patch};
      return cb(null, versionString, versionObject);
    });
}

function getClangCompilerVersionByMacro(compilerPath, cb) {
  compile.CompilerInformation(compilerPath,'macro')
    .on('error',function(err){return cb(err);})
    .on('data',function(data){
      var majorString = '__clang_major__';
      var minorString = '__clang_minor__';
      var patchString = '__clang_patchlevel__';

      var data = data.toString();

      if (data.indexOf('__clang__') === -1)
        return cb(new Error('invalid compiler'));

      var major = data.substring(data.indexOf(majorString) + majorString.length, data.indexOf('\n', data.indexOf(majorString))).trim();
      var minor = data.substring(data.indexOf(minorString) + minorString.length, data.indexOf('\n', data.indexOf(minorString))).trim();
      var patch = data.substring(data.indexOf(patchString) + patchString.length, data.indexOf('\n', data.indexOf(patchString))).trim();

      var versionString = major + '.' + minor + '.' + patch;
      var versionObject = {major : major, minor : minor, patch : patch};
      return cb(null, versionString, versionObject);
    });
}

function getGccCompilerInformation(cb) {
  getCompilerInformation('/usr/bin/gcc', function(err, results){
    if (err) return cb(null);
    cb(null, results);
  });
}

function getClangCompilerInformation(cb) {
  getCompilerInformation('/usr/bin/clang', function(err, results){
    if (err) return cb(null);
    cb(null, results);
  });
}

function getCompilerInformation(compilerPath, cb) {
  var cachePath;
  var fallback = function(){
    async.series({
      version: function(callback){
        compile.CompilerInformation(compilerPath,'--version')
          .on('error',function(err){return callback(err);})
          .on('data',function(data){return callback(null,data.toString());});
      },
      dumpversion: function(callback){
        compile.CompilerInformation(compilerPath,'-dumpversion')
          .on('error',function(err){return callback(err);})
          .on('data',function(data){return callback(null,data.toString().replace(/\n$/, ''));});
      },
      dumpmachine: function(callback){
        compile.CompilerInformation(compilerPath,'-dumpmachine')
          .on('error',function(err){return callback(err);})
          .on('data',function(data){return callback(null,data.toString().replace(/\n$/, ''));});
      }
    }, function(err, results){
      if (err)
        return cb(err);

      //try to store information to cachePath
      return fs.writeFile(cachePath, JSON.stringify(results, null, 2), function(err){
        if (err)
          debug('unable to write a compiler information cache - ' + cachePath);
        else
          debug('sucessfully write a compiler information cache - ' + cachePath);

        //whatever error is.
        return cb(null, results);
       });
    })
  };

  fs.stat(compilerPath,function(err,stats) {
    if(err) return cb(err);
    if(!stats.isFile()) return cb(new Error('compilerPath not exists'));

    var seccTmpPath = path.join(os.tmpdir(), 'secc');

    var hash = crypto.createHash('md5');
    hash.update(compilerPath);
    hash.update(String(stats.dev));
    hash.update(String(stats.ino));
    hash.update(String(stats.size));
    hash.update(String(stats.mtime));

    cachePath = path.join(seccTmpPath, 'compiler_' + hash.digest('hex') + '.json');
    fs.stat(cachePath, function(err, cacheStats){
      if (err) {  //might be there's no /tmp/secc'
        try {
          fs.statSync(seccTmpPath);
        } catch(e) {
          debug('mkdirp - ' + seccTmpPath);
          require('mkdirp').sync(seccTmpPath);
        }
        return fallback();
      }

      if (cacheStats && !cacheStats.isFile()) {
        debug('unable to read a compiler information cache - ' + cachePath);
        return fallback();
      }

      try {
        var infoCache = require(cachePath);

        if ( !infoCache.version
          || !infoCache.dumpversion
          || !infoCache.dumpmachine)
          throw new Error('wrong infoCache object');

        debug('read the compiler information cache - ' + cachePath);
        return cb(null, infoCache);
      } catch(e) {
        debug('wrong compiler information cache - ' + cachePath);
      }
      return fallback();
    });
  });
}

function getHashedFileList(arr, sourcePath, buildRoot, workingDirectory, callback) {
  var files = {};
  var checkFiles =  [];

  arr.forEach(function(filePath) {
    if (buildRoot) {  //FIXME : isAbsolute not exists in 0.10.xx
      checkFiles.push( filePath[0] === '/'
        ? path.join(buildRoot, filePath)
        : path.join(buildRoot, workingDirectory, filePath));
    } else {
      checkFiles.push(path.resolve(workingDirectory, filePath));
    }
  });

  if (buildRoot) {
    checkFiles.push( sourcePath[0] === '/'
      ? path.join(buildRoot, sourcePath)
      : path.join(buildRoot, workingDirectory, sourcePath));
  } else {
    checkFiles.push(path.resolve(workingDirectory, sourcePath));
  }
  //debug(checkFiles);

  debug('checkFiles. hashing start.');
  async.eachSeries(checkFiles, function(file, cb) {
    var stream = fs.createReadStream(file);
    var hash = crypto.createHash('md5');
    hash.setEncoding('hex');

    stream.on('error', function(err){
      cb(err);
    });
    stream.on('end', function() {
      hash.end();
      files[file] = hash.read();
      cb(null);
    });
    stream.pipe(hash);
  },
  function(err){
    if(err)
      return callback(err || new Error('getHashedFileList - Generate hashes error'));

    //sort for hashing.
    var filesKeys = Object.keys(files);
    filesKeys.sort();

    var hash = crypto.createHash('md5')
    filesKeys.forEach(function(e){
      hash.update(files[e]);  //without path, only hashed content.
    })

    var sourceHash = hash.digest("hex");
    debug('hashing end. %s', sourceHash);

    callback(null, files, checkFiles, sourceHash);
  });
}

module.exports.generatorArchiveId = generatorArchiveId;

module.exports.getSystemInformation = getSystemInformation;

module.exports.getCompilerVersionFromString = getCompilerVersionFromString;
module.exports.getCompilerInformation = getCompilerInformation;
module.exports.getGccCompilerVersionByMacro = getGccCompilerVersionByMacro;
module.exports.getClangCompilerVersionByMacro = getClangCompilerVersionByMacro;

module.exports.getGccCompilerInformation = getGccCompilerInformation;
module.exports.getClangCompilerInformation = getClangCompilerInformation;
module.exports.getGccClangCompilerInformation = getGccClangCompilerInformation;

module.exports.getHashedFileList = getHashedFileList;