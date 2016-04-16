'use strict';

var server = require('./lib/scheduler');

server.listen(server.SECC.scheduler.port, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('secc-scheduler listening at http://%s:%s', host, port);
});
