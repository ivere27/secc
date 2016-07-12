'use strict';

exports.pumpArchiveExistsInArray = function (arr, pumpArchiveId) {
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i].pumpArchiveId === pumpArchiveId) {
      return true;
    }
  }

  return false;
};

exports.removePumpArchiveInArray = function (arr, pumpArchiveId) {
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i].pumpArchiveId === pumpArchiveId) {
      arr.splice(i,1);
      return true;
    }
  }

  return false;
};

exports.archiveExistsInArray = function (arr, archiveId) {
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i].archiveId === archiveId) {
      return true;
    }
  }

  return false;
};

exports.getArchiveInArray = function (arr, archiveId) {
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i].archiveId === archiveId) {
      return arr[i];
    }
  }

  return false;
};

exports.removeArchiveInArray = function (arr, archiveId) {
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i].archiveId === archiveId) {
      arr.splice(i,1);
      return true;
    }
  }

  return false;
};

exports.ObjectToText = function(o, p) {
  var r = '';
  var p = ((p) ? p +'/' : "");
  for(var key in o) {
    if (Array.isArray(o[key])) { //FIXME : Object in Array?
      var value = '';
      for (var i in o[key])
        value += "'" + String(o[key][i]).replace("'","\' ") + "' ";

      r += p+key+'=' + value + '\n';
    } else if (typeof o[key] === 'object') {
      r += this.ObjectToText(o[key], p + key);
    } else {
      r += p+key+'='+ String(o[key]).replace("'","\'") + '\n';
    }
  }
  return r;
}

exports.getCacheKey = function(archiveId, sourceHash, argvHash) {
  return 'cache/' + archiveId + '/' + sourceHash + '/' + argvHash;
};

// from node/lib/internal/net.js
exports.isLegalPort = function(port) {
  if ((typeof port !== 'number' && typeof port !== 'string') ||
      (typeof port === 'string' && port.trim().length === 0))
    return false;
  return +port === (+port >>> 0) && port <= 0xFFFF;
}