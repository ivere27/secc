#!/usr/bin/env node
'use strict';

var request = require("request");
var path = require('path');

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
  console.log('Managing Scheduler\'s archives. - a simple rest commandline tool\n')
  console.log('Options:')
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
  request({method: method, uri: uri}, function optionalCallback(err, httpResponse, body) {
    if (err) return console.error(err);
    if (httpResponse.statusCode !== 200) return console.error(body);
    try {
      body = JSON.parse(body);
    } finally {
      return console.log((typeof body === 'object') ? JSON.stringify(body, null, 2) 
                                                    : body);
    }
  });
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
} else 
  return howto();

send(method, uri);