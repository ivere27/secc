var debug = require('debug')('secc:environment')

var os = require('os');
var fs = require('fs');
var crypto = require('crypto');
var path = require('path');

var async = require('async');
var compile = require('./compile.js');

var getSystemInformation = function(SECC) {
  return {hostname: os.hostname(),
          platform: os.platform(),
          release : os.release(),
          arch    : os.arch(),
          numCPUs : os.cpus().length,
          port    : SECC.daemon.port
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

function getGccCompilerSimpleVersion(compilerPath, cb) {
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

      var version = major + '.' + minor + '.' + patch;
      return cb(null, version);
    });
}

function getClangCompilerSimpleVersion(compilerPath, cb) {
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

      var version = major + '.' + minor + '.' + patch;
      return cb(null, version);
    });
}

function getGccCompilerInformation(cb) {
  getCompilerInformation('/usr/bin/gcc', function(err, results){
    if (err) return cb(null);
    delete results.stats;
    cb(null, results);
  });
}

function getClangCompilerInformation(cb) {
  getCompilerInformation('/usr/bin/clang', function(err, results){
    if (err) return cb(null);
    delete results.stats;
    cb(null, results);
  });
}

function getCompilerInformation(compilerPath, cb) {
  async.series({
    stats: function(callback){
      fs.stat(compilerPath,function(err,stats) {
        if(err) return callback(err);
        if(!stats.isFile()) return callback(new Error('compilerPath not exists'));

        return callback(null, stats);
      });
    },
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
  }, cb);
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

module.exports.getSystemInformation = getSystemInformation;

module.exports.getCompilerInformation = getCompilerInformation;
module.exports.getGccCompilerSimpleVersion = getGccCompilerSimpleVersion;
module.exports.getClangCompilerSimpleVersion = getClangCompilerSimpleVersion;

module.exports.getGccCompilerInformation = getGccCompilerInformation;
module.exports.getClangCompilerInformation = getClangCompilerInformation;
module.exports.getGccClangCompilerInformation = getGccClangCompilerInformation;

module.exports.getHashedFileList = getHashedFileList;