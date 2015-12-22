'use strict';

var debug = require('debug')('secc:OptionManager');
var GCC_OPTIONS = require('./GCC_OPTIONS');
//var CLANG_OPTIONS = require('./CLANG_OPTIONS');
//var getBareOption = function(option)

var OptionManager = function() {
  if (!(this instanceof OptionManager)) {
     return new OptionManager();
  }
  this.gccOptions = {};       //stored by category
  this.gccOptionsIndex = {};  //stored by key/value

  //loading OPTIONS
  for (var category in GCC_OPTIONS) {
    var options;
    options = _parsingGccOption(GCC_OPTIONS, category);
    this.gccOptions[category] = options;
  }

  //index.
  for (var category in this.gccOptions) {
    var options = this.gccOptions[category] ;
    for(var i = 0; i< options.length ; i++) {
      if (this.gccOptionsIndex.hasOwnProperty(options[i].bare))
        throw new Error(options[i].bare + ' exists in object');

      this.gccOptionsIndex[options[i].bare] = options[i];
    }
  }

};

OptionManager.prototype.gccOptionList = function() {
  return this.gccOptions;
}

OptionManager.prototype.gccOptionIndexList = function() {
  return this.gccOptionsIndex;
}

OptionManager.prototype.parseOneOption = function(option) {
  var o = { 
            bare : null,
            singular : true,
            equals : false,
            option : option,
            rvalue : null,
            following : null,
            category : null
          };

  var str = o.option;
  if (str.indexOf('=') !== -1) {
    o.equals = true;
    str = str.substring(0, str.indexOf('=')); //FIXME : parse rvalue?
    o.rvalue = o.option.substr(str.length + 1);
  }

  if (str.indexOf('/') !== -1)  // there's no '/' in options
    str = str.substring(0, str.indexOf('/'));

  do {
    if (this.gccOptionsIndex.hasOwnProperty(str)) {
      var form = this.gccOptionsIndex[str];  
      o.singular = form.singular;
      o.category = form.category;
      break;
    } else {
      str = str.slice(0,-1);
    }
  } while(str.length > 0)

  if (str.length > 0)
    o.bare = str;
  return o;
}

var _parsingGccOption = function(OPTIONS, category) {
  var options = [];

  //split by spaces/line feed, remove empty string.
  var arr = OPTIONS[category]
           .split(/\s+/)
           .filter(function(e){return e});

  for (var i = 0; i < arr.length ; i++) {
    //might be following or special case such as <source | object>
    if (arr[i][0] !== '-') { 
      if ((i == 0) && (arr[i][0] === '<'))  // FIXME : one case : <object-file-name>
        continue;

      var last = options[options.length-1];
      last.singular = false;
      last.following = arr[i];
      continue;
    }

    var o = { 
              bare : null,
              singular : true,
              equals : false,
              option : arr[i],
              rvalue : null,
              following : null,
              category : category
            };
    
    var str = arr[i].replace(/\[[,.]*\]/,''); //--help[=class[,...]]
    str = str.replace(/\[[-|*=<>a-z]*\]/,'');
    if (str.indexOf('=') !== -1) {
      o.equals = true;
      str = str.substring(0, str.indexOf('=')); //FIXME : parse rvalue?
      o.rvalue = arr[i].substr(str.length + 1);
    }

    if (str.indexOf('<') !== -1) {
      str = str.substring(0, str.indexOf('<'));
    }

    o.bare = str;
    options.push(o);
  }

  return options;
}

module.exports = OptionManager;

//console.log(OptionManager().gccOptionsIndex);