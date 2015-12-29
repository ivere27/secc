/*
man gcc
 You can specify the input language explicitly with the -x option:

 -x language
     Specify explicitly the language for the following input files (rather than letting the compiler choose a default based on the file name suffix).  This option
     applies to all following input files until the next -x option.  Possible values for language are:

             c  c-header  cpp-output
             c++  c++-header  c++-cpp-output
             objective-c  objective-c-header  objective-c-cpp-output
             objective-c++ objective-c++-header objective-c++-cpp-output
             assembler  assembler-with-cpp
             ada
             d
             f77  f77-cpp-input f95  f95-cpp-input
             go
             java
*/
'use strict';

var debug = require('debug')('secc:compile');
var util = require("util");
var stream = require("stream");
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var async = require('async');

var utils = require('./utils');
var environment = require('./environment.js');

function CompileStream(options) {
  //debug(options);
  var self = this;

  var options = options || {};
  if (typeof options.timeout !== 'number')
    options.timeout = 60000;

  this.buildNative = (typeof options.buildNative === 'undefined') ? true : options.buildNative;

  this.archiveId = options.archiveId;
  this.buildRoot = options.buildRoot || path.join(__dirname,'..','run', this.buildNative ? '' : this.archiveId);

  this.outputPath = options.outputPath || '/tmp/SECC-'+crypto.pseudoRandomBytes(16).toString('hex');
  this.compiler = (options.compiler) ? '/usr/bin/' + options.compiler : '/usr/bin/gcc';
  this.language = options.language || 'c';
  this.fileName = options.fileName || path.basename(this.outputPath);
  this.usingPipe = (typeof options.usingPipe === 'undefined') ? true : options.usingPipe;
  this.sourceFile = options.sourceFile;
  this.workingDirectory = options.workingDirectory || '.';
  this.cache = options.cache || false;
  this.redisClient = options.redisClient || null;
  this.argv = (typeof options.argv === 'undefined') ? [] : options.argv; 
  this.cross = (typeof options.cross === 'undefined') ? false : options.cross;
  this.target = (typeof options.target === 'undefined') ? null : options.target;

  this._stdout;
  this._stderr;
  this._error;
  this.outputFiles = [];
  this.timerFired = false;
  this.sourceHash = null;
  this.hash = crypto.createHash('md5');
  this.hash.setEncoding('hex');

  var spawn = require('child_process').spawn;
  var newArgv = this.argv.slice();

  if (this.cache && this.redisClient) {
    this.argvHash = crypto.createHash('md5').update(JSON.stringify(newArgv)).digest("hex");
  }

  //cross compile
  if (this.cross) {
    debug('cross compile. target : %s', this.target);
    if (this.compiler.indexOf('clang') == -1)
      newArgv.push('--target');
    else
      newArgv.push('-target');

    newArgv.push(this.target);
  }

  if (this.usingPipe)  {
    var addArgv = ['-x', this.language,'-o',this.outputPath,'-pipe','-'];
    if (this.compiler.indexOf('clang') == -1)
      addArgv.unshift('-fpreprocessed');  //clang does not have -fpreprocessed option.
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
    debug('buildNative');
    debug(this.compiler);
    debug(newArgv);
    this.exec  = spawn(this.compiler, newArgv);

    //debug(this.exec);
  } else {
    newArgv.unshift(this.compiler);
    newArgv.unshift(this.workingDirectory);
    newArgv.unshift('/chdir.sh');
    newArgv.unshift('/bin/sh');
    newArgv.unshift(this.buildRoot);

    debug('build in chroot');
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
          ,compiler: self.compiler
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

      //
      var redis = require("redis");
      var redisKey = 'cache/' + self.archiveId + '/' + self.sourceHash + '/' + self.argvHash;    
      var redisChunkCount = 0;

      var archive = require('archiver')('tar', {});

      debug(self.outputFiles);

      self.outputFiles.forEach(function(outfile){
        debug('outputFiles append %s', JSON.stringify(outfile));
        archive.append(fs.createReadStream(outfile.path), { name: outfile.name });
      });

      archive.finalize();
      archive.on('data',function(data){
        self.push(data);
        // debug(redisChunkCount);
        // debug(data);
        if (self.cache && self.redisClient)
          self.redisClient.hset(redisKey, "chunk" + String(redisChunkCount++) , data, redis.print);
      });

      archive.on('finish', function(){
        self.push(null);
        if (self.cache && self.redisClient) {
          self.redisClient.hset(redisKey, "chunkCount" , String(redisChunkCount), redis.print);
          self.redisClient.hset(redisKey, "stdout" , self._stdout, redis.print);
          self.redisClient.hset(redisKey, "stderr" , self._stderr, redis.print);
          self.redisClient.hset(redisKey, "type" , (self.usingPipe) ? 'preprocessed' : 'pump', redis.print);
          var data = { key : redisKey
                     , archiveId : self.archiveId
                     , sourceHash: self.sourceHash
                     , argvHash : self.argvHash
                     , chunkCount : redisChunkCount}
          debug(data);
          self.emit('cacheStored', data);
        }

        self.outputFiles.forEach(function(outfile){fs.unlink(outfile.path);});

        debug('CompileStream done. emit finish');
        return self.emit('finish', null, self._stdout, self._stderr, code, self.fileName + '.tar.gz');
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

  this.compiler = options.compiler || '/usr/bin/gcc';
  this.buildNative = (typeof options.buildNative === 'undefined') ? true : options.buildNative;

  var newArgv = options.argv.slice();

  //remove -M... args.
  if(newArgv.indexOf('-MF') !== -1)
    newArgv.splice(newArgv.indexOf('-MF'),2);
  if(newArgv.indexOf('-MMD') !== -1)
    newArgv.splice(newArgv.indexOf('-MMD'),1);

  newArgv.push('-M');
  //debug(newArgv);

  if (this.buildNative) {
    this.exec = spawn(this.compiler, newArgv);
  } else {
    newArgv.unshift(this.compiler);
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
      preprocessedHash = self.hash.read();
      return self.emit('finish', null, preprocessedHash);
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
      return self.emit('finish', new Error(data));
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
  this.compiler = compilerPath || '/usr/bin/gcc';

  if (['--version','-dumpmachine','-dumpversion', 'macro'].indexOf(flag) === -1)
    return process.nextTick(function(){
      self.emit('error', new Error('unsupported flags : ' + flag))
    });

  var spawn = require('child_process').spawn;

  if (flag === 'macro') {
    var flag = ['-dM', '-E', '-'];
    this.exec = spawn(this.compiler, flag, {stdio : ['ignore', null, null]});
  } else {
    this.exec = spawn(this.compiler, [flag]);
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
    if (typeof self._stdout === 'undefined')
      self._stdout = new Buffer(data);
    else
      self._stdout.concat(data);
  });

  this.exec.stderr.on('data', function (data) {
    if (typeof self._stderr === 'undefined')
      self._stderr = new Buffer(data);
    else
      self._stderr.concat(data);
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

var determineLanguage = function(command, sourcePath) {
  var extname = path.extname(sourcePath).toLowerCase();
  var language;

  //some special case. like assembler
  if (extname == '.s')
    return 'assembler';

  if (['cc'].indexOf(command) !== -1)
    language = 'c';
  else if (['c++', 'g++', 'clang++'].indexOf(command) !== -1)
    language = 'c++';

  if (typeof language === 'undefined') { //if still unknown, check by extname
    if (['.c'].indexOf(extname) !== -1)
      language = 'c';
    else if (extname.indexOf('.cc') !== -1)
      language = 'c++';  
    else if (['.cpp','.cxx'].indexOf(extname) !== -1)
      language = 'c++';
  }

  if (typeof language === 'undefined') { //and then, still unknown.
    language = 'c++';
  }

  return language;
};

module.exports.determineLanguage = determineLanguage;

module.exports.CompileStream = CompileStream;
module.exports.GetDependencies = GetDependencies;
module.exports.GeneratePreprocessed = GeneratePreprocessed;
module.exports.CompilerInformation = CompilerInformation;
