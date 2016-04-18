'use strict';

var SECC = require('./settings.json');
var server = require('./lib/scheduler')(SECC);

server.listen(SECC.scheduler.port, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('secc-scheduler listening at http://%s:%s', host, port);
});
