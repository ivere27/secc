#!/usr/bin/env node
'use strict';

var assert = require('assert');
var http = require('http');
var path = require('path');
var url = require('url');

var SECC = require('../package.json');

var argv = process.argv;
var nodePath = argv.shift();
var filePath = argv.shift();
var file = path.basename(filePath);

var schedulerUrl = argv.shift();
var command = argv.shift();
var option1 = argv.shift();
var option2 = argv.shift();

function howto() {
  console.log('SECC - %s', SECC.version);
  console.log("Managing Scheduler's archives. - a simple rest commandline tool\n");
  console.log('Options:');
  console.log('%s %s http://SCHEDULER:PORT list', nodePath, file);
  console.log('%s %s http://SCHEDULER:PORT get <ARCHIVE_ID>', nodePath, file);
  console.log('%s %s http://SCHEDULER:PORT delete <ARCHIVE_ID>', nodePath, file);
  console.log('%s %s http://SCHEDULER:PORT addTarget <ARCHIVE_ID> <TARGET>', nodePath, file);
  console.log('%s %s http://SCHEDULER:PORT removeTarget <ARCHIVE_ID> <TARGET>', nodePath, file);
  console.log('\n');
  console.log('Example:');
  console.log('%s %s http://172.17.42.1:10509 list', nodePath, file);
  console.log('%s %s http://172.17.42.1:10509 delete 09e716fc4f43a6a8e718f7d8e17ff13b5e54b33f', nodePath, file);
  console.log('%s %s http://172.17.42.1:10509 addTarget 09e716fc4f43a6a8e718f7d8e17ff13b5e54b33f x86_64-apple-darwin15.2.0', nodePath, file);
  process.exit(0);
}

function send(method, uri) {
  var urlObject = url.parse(uri);
  var options = {
    hostname: urlObject.hostname,
    port: urlObject.port,
    path: urlObject.path,
    method: method
  };

  var req = http.request(options);
  req.on('error', function(err) { return console.error(err); });
  req.setTimeout(5 * 1000, function() {
    this.abort();
    return console.error(new Error('Timeout in request ' + urlObject.path));
  });
  req.on('response', function(res) {
    var data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
      if (res.statusCode !== 200) {
        console.error(data);
        return console.error(new Error('Error raised in ' + urlObject.path));
      }

      if (res.headers['content-type'].indexOf('application/json') !== -1) {
        try {
          data = JSON.parse(data);
        } catch (e) {
          console.error(e);
          console.error(data);
          return;
        }
      }

      return console.log((typeof data === 'object')
        ? JSON.stringify(data, null, 2)
        : data);
    });
  });
  // req.write()
  req.end();
}

var uri = schedulerUrl + '/archive/';
var method = 'GET';

if (command === 'list') {
} else if ((command === 'get') && option1) {
  uri += option1;
} else if ((command === 'delete') && option1) {
  method = 'DELETE';
  uri += option1;
} else if ((command === 'addTarget') && option1 && option2) {
  method = 'POST';
  uri += option1 + '/target/' + option2;
} else if ((command === 'removeTarget') && option1 && option2) {
  method = 'DELETE';
  uri += option1 + '/target/' + option2;
} else {
  howto();
  assert(false, 'should not reach here');
}

send(method, uri);
