'use strict';

var debug = require('debug')('secc:'+process.pid+':compile');
var redisDebug = function (err, reply) {  //print only if error raised
  if (err) debug("Error: " + err);
};

var crypto = require('crypto');
var fs = require('fs');
var os = require('os');
var path = require('path');
var stream = require("stream");
var util = require("util");
var zlib = require('zlib');

var async = require('async');

var utils = require('./utils');

function CompileStream(options) {
  //debug(options);
  var self = this;

  var options = options || {};
  if (typeof options.timeout !== 'number')
    options.timeout = 60 * 2 * 1000;

  this.buildNative = (typeof options.buildNative === 'boolean') ? options.buildNative : true;

  this.archiveId = options.archiveId;
  this.buildRoot = options.buildRoot || path.join(os.tmpdir(), 'secc', 'run', this.buildNative ? '' : this.archiveId);

  this.outputPath = options.outputPath || '/tmp/SECC-'+crypto.pseudoRandomBytes(16).toString('hex');
  this.compiler = options.compiler || 'gcc';
  this.driver = options.driver || 'gcc';
  this.compilerPath = options.compilerPath
                    || '/usr/bin/' + this.driver
  this.language = options.language || 'c';
  this.clientOutfile = options.outfile || null;
  this.fileName = options.fileName || path.basename(this.outputPath);
  this.usingPipe = (typeof options.usingPipe === 'boolean') ? options.usingPipe : true;
  this.sourceFile = options.sourceFile;
  this.workingDirectory = options.workingDirectory || '.';
  this.cache = options.cache || false;
  this.redisClient = options.redisClient || null;
  this.argv = Array.isArray(options.argv) ? options.argv : [];
  this.cross = (typeof options.cross === 'boolean') ? options.cross : false;
  this.target = options.target || null;

  this._stdout = null;
  this._stderr = null;
  this._error;
  this.outputFiles = [];
  this.timerFired = false;
  this.sourceHash = null;
  this.hash = crypto.createHash('md5');
  this.hash.setEncoding('hex');

  var spawn = require('child_process').spawn;
  var newArgv = this.argv.slice();

  if (this.cache && this.redisClient) {
    this.argvHash = crypto.createHash('md5')
                    .update(JSON.stringify(newArgv))
                    .update(String(this.clientOutfile))
                    .digest("hex");
  }

  //cross compile
  if (this.cross) {
    debug('cross compile. target : %s', this.target);
    if (this.compiler === 'gcc')
      newArgv.push('--target');
    else
      newArgv.push('-target');

    newArgv.push(this.target);
  }

  if (this.usingPipe)  {
    var addArgv = ['-x', this.language,'-o',this.outputPath,'-pipe','-'];
    if (this.compiler === 'gcc') //clang does not have -fpreprocessed option.
      addArgv.unshift('-fpreprocessed');
    newArgv.push.apply(newArgv, addArgv);
  }
  else
    newArgv.push.apply(newArgv, ['-o',this.outputPath,'-pipe']);

  //debug('compile newArgv');
  //debug(newArgv);

  //output files. main and .dwo(debug fission)
  this.outputFiles.push({name : this.fileName + '.o', path : this.buildNative ? this.outputPath : path.join(this.buildRoot, this.outputPath)})
  if (newArgv.indexOf('-gsplit-dwarf') !== -1) {
    var outfile = this.outputFiles[0];
    this.outputFiles.push({name: this.fileName + '.dwo', path: outfile.path + '.dwo'});
  }

  if (this.buildNative)  {
    debug('buildNative - %s', this.compilerPath);
    this.exec  = spawn(this.compilerPath, newArgv);

    //debug(this.exec);
  } else {
    newArgv.unshift(this.compilerPath);
    newArgv.unshift(this.workingDirectory);
    newArgv.unshift('/chdir.sh');
    newArgv.unshift('/bin/sh');
    newArgv.unshift(this.buildRoot);

    debug('build in chroot. compiler path : %s', this.compilerPath);
    //debug(newArgv);

    this.exec  = spawn('chroot', newArgv);  //something like, [path,gcc,...]
  }

  this.killTimer = setTimeout(function(){
    self.timerFired = true;
    self.exec.kill('SIGKILL');
  }, options.timeout);

  this.exec.on('error', function(error){
    self._error = error;
  });

  this.exec.stdout.on('data', function (data) {
    //console.log(data.toString());
    self._stdout = (self._stdout || '') + data;
  });

  this.exec.stderr.on('data', function (data) {
    //console.log(data.toString());
    self._stderr = (self._stderr || '') + data;
  });

  this.cleanup = function(){
    clearTimeout(self.killTimer);
  };

  this.exec.on('close', function (code) {
    clearTimeout(self.killTimer);

    if (code !== 0) {
      if (self.timerFired)
        self.outputFiles.forEach(function(outfile){fs.unlink(outfile.path);});

      return self.emit('finish', new Error(self.timerFired ? 'CompileStream timeout.' : self._error || 'Compiler Error'), self._stdout, self._stderr, code);
    }

    debug('CompileStream close. push outputFiles to stream. ');

    async.waterfall([
      function(callback){
        if (self.usingPipe) return callback(null, null);

        var GetDependenciesOptions = {
          buildNative : false
          ,compilerPath: self.compilerPath
          ,argv: self.argv
          ,workingDirectory : self.workingDirectory
          ,buildRoot : self.buildRoot
        };

        GetDependencies(GetDependenciesOptions).on('finish', function(err, compileFile) {
          if (err) return callback(err);  //GetDependencies error.

          debug('GetDependencies done. compileFile is....')
          debug('source : %s, object : %s, dependencies total : %d'
            ,compileFile.sourceFile, compileFile.objectFile, compileFile.dependencies.length);

          //debug(compileFile);
          callback(null, compileFile);

        });
      },
      function(compileFile, callback) {
        if (self.usingPipe) return callback(null);

        var files = {};
        var checkFiles = []

        compileFile.dependencies.forEach(function(filePath){
          checkFiles.push( filePath[0] === '/'
            ? path.join(self.buildRoot, filePath)
            : path.join(self.buildRoot, self.workingDirectory, filePath));
        });
        checkFiles.push( compileFile.sourceFile[0] === '/'
          ? path.join(self.buildRoot, compileFile.sourceFile)
          : path.join(self.buildRoot, self.workingDirectory, compileFile.sourceFile));
        checkFiles.sort();  //sort for ordering.
        //debug(checkFiles);

        debug('checkFiles. hashing start.');
        async.each(checkFiles, function(file, cb) {
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
            return callback(err || new Error('Generate hashes error'));

          //sort for hashing.
          var filesKeys = Object.keys(files);
          filesKeys.sort();

          var hash = crypto.createHash('md5')
          filesKeys.forEach(function(e){
            hash.update(files[e]);  //without path, only hashed content.
          })

          var pumpHash = hash.digest("hex");

          self.sourceHash = pumpHash;
          debug('hashing end. pumpHash %s', pumpHash);
          callback(null, compileFile, files, checkFiles);
        });
      }

    ],function(err){
      if (err)
        return self.emit('finish', new Error('CompileStream error. generate sourceHash.'), self._stdout, self._stderr, code);

      var redisKey = utils.getCacheKey(self.archiveId, self.sourceHash, self.argvHash);
      var redisChunkCount = 0;

      debug(self.outputFiles);
      var pack = require('tar-stream').pack();
      async.each(self.outputFiles, function(outfile, cb){
        debug('outputFiles append %s', JSON.stringify(outfile));
        fs.readFile(outfile.path, function(err, data) {
          if (err) throw cb(err);
          pack.entry({ name: outfile.name }, data);
          cb(null);
        });
      }, function(err){
        if (err) {
          self.outputFiles.forEach(function(outfile){fs.unlink(outfile.path);});
          return self.emit('finish', new Error('CompileStream error. file stream error.'), self._stdout, self._stderr, code);
        }

        pack.finalize();

        //FIXME : zlib.Z_BEST_SPEED
        var gzipPack = zlib.createGzip({level: 1})
        .on('error', function(err) {
          self.outputFiles.forEach(function(outfile){fs.unlink(outfile.path);});
          return self.emit('finish', new Error('CompileStream error. file stream error.'), self._stdout, self._stderr, code);
        }).on('data', function(data) {
          self.push(data);
          //debug(data);
          if (self.cache && self.redisClient) {
            process.nextTick(function(){
              self.redisClient.hset(redisKey, "chunk" + String(redisChunkCount++) , data, redisDebug);
            });
          }
        }).on('end', function() {
          self.push(null);
          if (self.cache && self.redisClient) {
            process.nextTick(function(){
              var info = {
                 chunkCount: redisChunkCount
                ,type: (self.usingPipe) ? 'preprocessed' : 'pump'
                ,stdout: self._stdout
                ,stderr: self._stderr
              }
              self.redisClient.hset(redisKey, "info" , JSON.stringify(info), redisDebug);

              var data = { key : redisKey
                         , archiveId : self.archiveId
                         , sourceHash: self.sourceHash
                         , argvHash : self.argvHash
                         , chunkCount : redisChunkCount}
              debug(data);
              self.emit('cacheStored', data);
            });
          }

          self.outputFiles.forEach(function(outfile){fs.unlink(outfile.path);});

          debug('CompileStream done. emit finish');
          return self.emit('finish', null, self._stdout, self._stderr, code, self.fileName + '.tar.gz');
        });

        pack.pipe(gzipPack);
      });
    })
  });

  stream.Duplex.call(this);
};
util.inherits(CompileStream, stream.Duplex);

CompileStream.prototype._read = function (size) {};

CompileStream.prototype._write = function (chunk, encoding, next) {
  //debug("CompileStream _write %d", chunk.length);

  if (this.exec.stdin.writable) {
    this.hash.write(chunk);
    this.exec.stdin.write(chunk);
  }

  next();
};

CompileStream.prototype.end = function() {
  this.hash.end();
  this.sourceHash = this.hash.read();
  this.exec.stdin.end();
  debug('CompileStream end. received stream hash : %s', this.sourceHash);
};


function GetDependencies(options) {
  if (!(this instanceof GetDependencies)) {
     return new GetDependencies(options);
  }
  stream.Readable.call(this, {objectMode: true});

  var self = this;
  var options = options || {};
  var spawn = require('child_process').spawn;

  this.compilerPath = options.compilerPath
                    || '/usr/bin/' + this.compiler;
  this.buildNative = (typeof options.buildNative === 'boolean') ? options.buildNative : true;

  var newArgv = options.argv.slice();

  //remove -M... args.
  if(newArgv.indexOf('-MF') !== -1)
    newArgv.splice(newArgv.indexOf('-MF'),2);
  if(newArgv.indexOf('-MMD') !== -1)
    newArgv.splice(newArgv.indexOf('-MMD'),1);

  newArgv.push('-M');
  //debug(newArgv);

  if (this.buildNative) {
    this.exec = spawn(this.compilerPath, newArgv);
  } else {
    newArgv.unshift(this.compilerPath);
    newArgv.unshift(options.workingDirectory);
    newArgv.unshift('/chdir.sh');
    newArgv.unshift('/bin/sh');
    newArgv.unshift(options.buildRoot);

    debug('GetDependencies in chroot');
    //debug(newArgv);

    this.exec  = spawn('chroot', newArgv);  //something like, [path,gcc,...]
  }

  if (typeof options.timeout !== 'number')
    options.timeout = 10000;

  this.killTimer = setTimeout(function(){
    self.exec.kill('SIGKILL');
  }, options.timeout);

  this._stdout;
  this._stderr;
  this._error;

  this.exec.on('error', function(error){
    self._error = error;
  });

  this.exec.stdout.on('data', function (data) {
    //console.log(data.toString());
    self._stdout = (self._stdout || '') + data;
  });

  this.exec.stderr.on('data', function (data) {
    //console.log(data.toString());
    self._stderr = (self._stderr || '') + data;
  });

  this.exec.on('close', function (code) {
    clearTimeout(self.killTimer);
    if (code !== 0)
      return self.emit('finish', new Error(self._error || 'Dependencies Error. Exit Code is ' + code));

    // console.log(typeof stdout)
    // console.log(typeof stdout)
    var headers = (self._stdout) ? self._stdout.toString() : '';

    //debug(headers);

    headers = headers.replace(/\\ /g,'~').replace(/\\/g,'').split(/:|\s/)
                     .filter(function(n){ return n != '' })
                     .map(function(e){ return e.replace(/~/g,'\ ') });  //FIXME : need a better regex pattern.

    var objectFile = headers.shift();
    var sourceFile = headers.shift();

    var result = {sourceFile: sourceFile, objectFile: objectFile, dependencies: headers};

    self.push(result);

    return self.emit('finish', null, result);
  });
};
util.inherits(GetDependencies, stream.Readable);

GetDependencies.prototype._read = function (size) {};



function GeneratePreprocessed(sourcePath, options) {
  if (!(this instanceof GeneratePreprocessed)) {
     return new GeneratePreprocessed(sourcePath, options);
  }
  stream.Readable.call(this);

  var self = this;
  this.hash = crypto.createHash('md5');
  this.hash.setEncoding('hex');
  this.preprocessedHash;

  //if already preprocessed infile
  if (options && options.preprocessedInfile) {
    fs.readFile(sourcePath, function(err,data){
      if (err)
        return self.emit('finish', new Error('GeneratePreprocessed Error - reading preprocessed file'));
      self.push(data);
      self.hash.write(data);

      self.push(null);
      self.hash.end();
      self.preprocessedHash = self.hash.read();
      return self.emit('finish', null, self.preprocessedHash);
    });
  } else {
    //console.log(options);
    options = options || {};
    if (typeof options.timeout !== 'number')
      options.timeout = 10000;

    this.compilerPath = options.compilerPath || '/usr/bin/gcc';

    var spawn = require('child_process').spawn;
    this.exec = spawn(this.compilerPath, options.argv);

    this.killTimer = setTimeout(function(){
      self.exec.kill('SIGKILL');
    }, options.timeout);

    this._stderr; //FIXME : raise error?
    this._stdoutLength = 0;

    this.exec.on('error', function(error){
      return self.emit('finish', error);
    });

    this.exec.stdout.on('data', function (data) {
      self._stdoutLength += data.length;
      self.hash.write(data);
      self.push(data);
    });

    this.exec.stderr.on('data', function (data) {
      if (Buffer.isBuffer(self._stderr))
        self._stderr = Buffer.concat([self._stderr, data]);
      else
        self._stderr = new Buffer(data);
    });

    this.exec.on('close', function (code) {
      clearTimeout(self.killTimer);
      if (code !== 0 || self._stdoutLength === 0)
        return self.emit('finish', new Error('GeneratePreprocessed Error'));

      self.push(null);
      self.hash.end();
      var preprocessedHash = self.hash.read();
      debug('GeneratePreprocessed done');
      return self.emit('finish', null, preprocessedHash);
    });
  }

};
util.inherits(GeneratePreprocessed, stream.Readable);

GeneratePreprocessed.prototype._read = function (size) {};


function CompilerInformation(compilerPath, flag) {
  if (!(this instanceof CompilerInformation)) {
     return new CompilerInformation(compilerPath, flag);
  }

  stream.Readable.call(this);

  var self = this;
  //console.log(options);
  this.compilerPath = compilerPath || '/usr/bin/gcc';

  if (['--version','-dumpmachine','-dumpversion', 'macro'].indexOf(flag) === -1)
    return process.nextTick(function(){
      self.emit('error', new Error('unsupported flags : ' + flag))
    });

  var spawn = require('child_process').spawn;

  if (flag === 'macro') {
    var flag = ['-dM', '-E', '-'];
    this.exec = spawn(this.compilerPath, flag, {stdio : ['ignore', null, null]});
  } else {
    this.exec = spawn(this.compilerPath, [flag]);
  }

  this.killTimer = setTimeout(function(){
    self.exec.kill('SIGKILL');
  }, 2000);

  this._stdout;
  this._stderr;
  this._error;
  this._returnCode;

  this.exec.on('error', function(error){
    self._error = error;
  });

  this.exec.stdout.on('data', function (data) {
    if (self._stdout === undefined)
      self._stdout = new Buffer(data);
    else
      self._stdout.concat(data);
  });

  this.exec.stderr.on('data', function (data) {
    if (Buffer.isBuffer(self._stderr))
      self._stderr = Buffer.concat([self._stderr, data]);
    else
      self._stderr = new Buffer(data);
  });

  this.exec.on('close', function (code) {
    clearTimeout(self.killTimer);
    if (code !== 0)
      return self.emit('error', new Error(self._error || 'CompilerInformation Error'), self._stdout, self._stderr, code);

    self._returnCode = code;

    if (self._stdout)
      self.push(self._stdout);

    self.push(null);
  });
};
util.inherits(CompilerInformation, stream.Readable);

CompilerInformation.prototype._read = function (size) {};

module.exports.CompileStream = CompileStream;
module.exports.GetDependencies = GetDependencies;
module.exports.GeneratePreprocessed = GeneratePreprocessed;
module.exports.CompilerInformation = CompilerInformation;
