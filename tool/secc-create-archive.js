/*
This is a standard-alone tool to upload a compiler archive to Scheduler server.
currently, using icecc's tool to create a compiler archive

how to use.

ex)
nodejs secc-create-archive.js /usr/bin/gcc /usr/bin/g++ ./icecc-create-env.in http://172.17.42.1:10509
*/

var crypto = require('crypto');
var fs = require("fs");
var request = require("request");

var argv = process.argv;
var gccPath = argv[2] || '/usr/bin/gcc';
var gppPath = argv[3] || '/usr/bin/g++';
var archiveToolPath = argv[4] || __dirname + '/icecc-create-env.in';
var schedulerUrl = argv[5]; //|| 'http://localhost:10509';

var archive = {};

function final() {
  var os = require('os');
  archive.platform = os.platform();
  archive.arch = os.arch();
  
  if (results[0].indexOf('gcc') !== -1)
    archive.compiler = 'gcc';
  else if (results[0].indexOf('clang') !== -1)
    archive.compiler = 'clang';
  else
    archive.compiler = 'unknown';

  archive.version = results[0];
  archive.dumpversion = results[1].replace(/\n$/, '');
  archive.dumpmachine = results[2].replace(/\n$/, '');
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

  uploadArchive(archive, function(err, httpResponse){
    if (err)
      return console.log(err);

    console.log('Scheduler server responded with : ', httpResponse.body);
    console.log('\n');
    
    if (httpResponse.statusCode == 200)
      console.log('Upload done successfully!\n');
  });
}

function uploadArchive(archive, cb) {
  console.log('upload the archive file - ', archive.archiveFile);

  var r = request.post(schedulerUrl + '/archive', function optionalCallback(err, httpResponse, body) {
    if (err) return cb(err);
    
    cb(null, httpResponse);
  });

  var form = r.form();
  form.append('archive', JSON.stringify(archive));
  form.append('archiveFile', fs.createReadStream(__dirname + '/' + archive.archiveFile), {filename: archive.archiveFile});
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
  callChildProcess(gccPath + ' --version', function(error, stdout, stderr){
    if (error) throw error;
    callback(stdout);
  });
}, function(callback){
  callChildProcess(gccPath + ' -dumpversion', function(error, stdout, stderr){
    if (error) throw error;
    callback(stdout);
  });
}, function(callback){
  callChildProcess(gccPath + ' -dumpmachine', function(error, stdout, stderr){
    if (error) throw error;
    callback(stdout);
  });
}, function(callback){
  var command = archiveToolPath + ' --gcc ' + gccPath + ' ' + gppPath + ' --addfile /usr/bin/objcopy --addfile /bin/sh';
  callChildProcess(command , function(error, stdout, stderr){
    if (error) throw error;
    console.log(stdout);
    callback(stdout);
  });
}];


//series async
var results = [];
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
