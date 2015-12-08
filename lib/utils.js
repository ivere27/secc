'use strict';

//Polyfill.  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith

if (!String.prototype.startsWith) {
  String.prototype.startsWith = function(searchString, position) {
    position = position || 0;
    return this.indexOf(searchString, position) === position;
  };
}

if (!String.prototype.endsWith) {
  String.prototype.endsWith = function(searchString, position) {
      var subjectString = this.toString();
      if (position === undefined || position > subjectString.length) {
          position = subjectString.length;
      }
      position -= searchString.length;
      var lastIndex = subjectString.indexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
  };
}


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