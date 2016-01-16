'use strict';

var debug = require('debug')('secc:OptionManager');
var crypto = require('crypto');
var path = require('path');
var GCC_OPTIONS = require('./GCC_OPTIONS');
//var CLANG_OPTIONS = require('./CLANG_OPTIONS');
//var getBareOption = function(option)

// FIXME : move Extnames to other shared library file.
var supportingLanguages = [ 'c', 'c++'
                          , 'objective-c', 'objective-c++'
                          , 'assembler', 'assembler-with-cpp'];
var Extname = {
  'assembler' : ['.S', '.sx'],
  'assembler Preprocessed' : ['.s'],
  'c' : ['.c'],
  'c Preprocessed' : ['.i'],
  'c++' : ['.cc','.cp','.cxx','.cpp','.CPP','.c++','.C'],
  'c++ Preprocessed' : ['.ii'],
  'objective-c' : ['.m'],
  'objective-c Preprocessed' : ['.mi'],
  'objective-c++' : ['.mm', '.M'],
  'objective-c++ Preprocessed' : ['.mii']
};

var _lastElement = function(arr){
  return (Array.isArray(arr)) ? arr[arr.length -1] : arr;
}

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

//supposed that 'thin client', 'network cost is cheap enough',
//              and 'workers are powerful'
OptionManager.prototype.analyzeArguments = function(argv, compiler, cwd, mode) {
  debug('analyzeArguments start');
  var argv = argv || [];
  var compiler = compiler || 'gcc';
  var cwd = cwd || '';
  var mode = (mode && (mode == 2)) ? '2' : '1';

  var infile = null;
  var outfile = null;
  var multipleOutfiles = false;
  var language = null;
  var useLocal = false;
  var projectId = null;
  var preprocessedInfile = false;
  var localArgv = null;
  var remoteArgv = null;
  var argvHash = null;
  var form = [];
  var formIndex = {};

  projectId = crypto.createHash('md5').update(cwd).digest("hex");

  //parsing/hashing arguments.
  for (var i = 0; i < argv.length ; i++) {
    var o = this.parseOneOption(argv[i]);
    if (o && !o.singular && argv[i+1] && (argv[i+1][0] !== '-'))
      o.following = argv[++i];
    form.push(o);

    //make an index. 'null' makes an array always for psrsing infile.
    if (!formIndex.hasOwnProperty(o.bare)) {
      if (o.bare === null)
        formIndex[o.bare] = [o];
      else
        formIndex[o.bare] = o;
    } else {
      if (Array.isArray(formIndex[o.bare]))
        formIndex[o.bare].push(o);
      else
        formIndex[o.bare] = [formIndex[o.bare], o];
    } 
  }

  //language
  if (formIndex.hasOwnProperty('-x')) {
    var o = _lastElement(formIndex['-x']);

    language = o.following;
    if (supportingLanguages.indexOf[language] === -1) //un-supporting
      buildLocal = true;
  }

  //outfile
  if (formIndex.hasOwnProperty('-o')) {
    var o = _lastElement(formIndex['-o']);
    outfile = o.following;
  }
  //multipleOutfiles
  if (formIndex.hasOwnProperty('-gsplit-dwarf'))
    multipleOutfiles = true;

  //infile. o.bare === null
  //debug(formIndex);
  if (formIndex.hasOwnProperty(null)) {
    for (var i in formIndex[null]) {
      if (formIndex[null][i].option[0] === '-') continue;

      var extname = path.extname(formIndex[null][i].option);
      if (extname === '') continue;

      var __infileProcessed = false;
      for (var key in Extname) {
        if (Extname[key].indexOf(extname) !== -1) {
          __infileProcessed = true;
          infile = formIndex[null][i].option;

          if (key.indexOf('Preprocessed') !== -1)
            preprocessedInfile = true;

          if (language === null) {
            if (key === 'assembler')
              language = 'assembler-with-cpp';
            else
              language = key.replace(' Preprocessed',''); //shortcut
          }

          break;
        }
      }
      if (__infileProcessed) break;
    }
  }  

  //FIXME : check un-supporting -M? flag
  for (var i = 0; i < form.length ; i++) {
    if (form[i].bare 
      && form[i].bare.substring(0,2) === '-M'
      && (['-MF', '-MG', '-MP', '-MQ', '-MT', '-MD','-MMD'].indexOf(form[i].bare) === -1 )) {
      useLocal = true;
      break;
    }
  }

  //check useLocal
  if ( (infile === null)    //unable to detect the infile
    || ([ 'conftest.c'      //skip on ./configure test
        , 'conftest.cpp'
        , 'conftest.s'
        , 'conftest1.s'
        , 'dummy.c'
        ].indexOf(path.basename(infile)) !== -1))
    useLocal = true;
  if (path.dirname(infile) === '/tmp')  //might be testing in ./configure such as /tmp/ffconf.bLAhBlAh.c
    useLocal = true;
  if (!formIndex.hasOwnProperty('-c'))
    useLocal = true;
  if ( formIndex.hasOwnProperty('-###')
    || formIndex.hasOwnProperty('-S')
    || formIndex.hasOwnProperty('-E')
    || formIndex.hasOwnProperty('-M'))
    useLocal = true;
  if (cwd.indexOf('CMakeFiles') !== -1)
    useLocal = true;

  //local arguments, remote arguments
  if (!useLocal  && (mode === '1')) {
    localArgv = [];
    remoteArgv = [];
    for (var i = 0; i < form.length ; i++) {
      if (form[i].bare === '-o') continue;

      localArgv.push(form[i].option);
      if (!form[i].singular)
        localArgv.push(form[i].following);
    }
    localArgv.push('-E');

    for (var i = 0; i < form.length ; i++) {
      if (form[i].category === 'Preprocessor Options') continue;
      if (form[i].bare === '-I') {
        //form '-I' is defined as 'singular'
        //so check either '-I /path/to/...' or '-I/path/to/...'
        if (form[i].bare === form[i].option) {
          //next argument shouldn't be an option.
          if (form[i+1] && form[i+1].bare && (form[i+1].bare.indexOf['-'] == 0))
            useLocal = true;

          i++;
        }
        continue;
      }
      if (form[i].bare === '-o') continue;
      if ((form[i].bare === null) && (form[i].option === infile)) continue;

      remoteArgv.push(form[i].option);
      if (!form[i].singular)
        remoteArgv.push(form[i].following);
    }
  }

  if (!useLocal  && (mode === '2')) {
    remoteArgv = [];
    for (var i = 0; i < form.length ; i++) {
      if (form[i].bare === '-o') continue;

      remoteArgv.push(form[i].option);
      if (!form[i].singular)
        remoteArgv.push(form[i].following);
    }
  }

  argvHash = crypto.createHash('md5').update(JSON.stringify(remoteArgv)).digest("hex");

  debug('analyzeArguments end');  // start~end : 1~3 ms
  return {argvHash : argvHash,
          infile : infile,
          preprocessedInfile : preprocessedInfile,
          outfile : outfile,
          multipleOutfiles : multipleOutfiles,
          language : language,
          useLocal : useLocal,
          projectId : projectId,
          localArgv : localArgv,
          remoteArgv : remoteArgv
          //,form : form
         };
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
    str = str.replace(/\[[-|*=<>a-z0-9]*\]/,'');
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