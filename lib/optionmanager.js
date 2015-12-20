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
    if (category === 'Machine Dependent Options') {
      this.gccOptions[category] = {};
      for (var subCategory in GCC_OPTIONS['Machine Dependent Options']) {
        options = this.parsingGccOption(GCC_OPTIONS[category], subCategory);  
        this.gccOptions[category][subCategory] = options;
      }
    } else {
      options = this.parsingGccOption(GCC_OPTIONS, category);
      this.gccOptions[category] = options;
    }
  }

  var addToIndex = function(object, key, value) {
    if (object.hasOwnProperty(key)) {
      //FIXME : make it array? or over-write?
      if (Array.isArray(object[key])) {
        object[key].push(value);
      } else {
        var temp = object[key];
        object[key] = [];
        object[key].push(temp);
        object[key].push(value);

        //console.log(object[key])
      }
    } else {
      object[key] = value;
    }
  }

  //index.
  for (var category in this.gccOptions) {
    if (category === 'Machine Dependent Options') {
      for (var subCategory in this.gccOptions[category]) {
        var options = this.gccOptions[category] ;
        for(var i = 0; i< options.length ; i++) {
          addToIndex(this.gccOptionsIndex, options[i].bare, options[i]);
        }
      }
    } else {
      var options = this.gccOptions[category] ;
      for(var i = 0; i< options.length ; i++) {
        addToIndex(this.gccOptionsIndex, options[i].bare, options[i]);
      }
    }
  }

};

OptionManager.prototype.gccOptionList = function() {
  return this.gccOptions;
}

OptionManager.prototype.gccOptionIndexList = function() {
  return this.gccOptionsIndex;
}

OptionManager.prototype.parsingGccOption = function(OPTIONS, category) {
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
    str = str.replace(/\[[-|=<>a-z]*\]/,'');
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

//new OptionManager();