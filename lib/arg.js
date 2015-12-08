'use strict';

var debug = require('debug')('secc:arg');
var path = require('path');

//FIXME : more?
var supportingExtname = ['.cc','.cpp','.cxx','.s','.c'];

//FIXME : need to check the path is right.
var determineOutputPath = function(argv, removeItem) {
  var outputPath;
  var removeItem = removeItem || false;
  var index = 0;

  //FIXME : need to handle multiple -MT option.
  while((index = argv.indexOf('-MT', index)) !== -1) {
    outputPath = argv[index + 1];
    if (removeItem)
      argv.splice(index, 2);
  }

  index = argv.indexOf('-o');
  if(index !== -1) {
    outputPath = argv[index + 1];
    if (removeItem) argv.splice(index, 2);
  }

  return outputPath;
};

//FIXME : need to see GCC's argument passing function.
var determineSourcePath = function(argv, removeItem) {
  var sourcePath;
  var removeItem = removeItem || false;

  for (var i = argv.length - 1; i >= 0; i--) {
    if (argv[i].startsWith('-')) continue;

    if (supportingExtname.indexOf(path.extname(argv[i]).toLowerCase()) !== -1) {
      sourcePath = argv[i];
      if (removeItem) argv.splice(i,1);
      break;
    }
  };

  return sourcePath;
};

var newPumpArgvRemoved = function(argv, sourcePath) {

  var singleOptions = ['-MMD'];
  singleOptions.push('-c');
  //singleOptions.push(sourcePath);

  var newArgv = argv.filter(function(e){
    return singleOptions.indexOf(e) === -1
  });

  //remove two plural options.
  var twoPluralOptions = ['-MF'];

  for (var i = newArgv.length - 1; i >= 0; i--) {
    if (twoPluralOptions.indexOf(newArgv[i]) !== -1)
      newArgv.splice(i,2);
  };

  return newArgv;
};

var newPreprocessedArgvRemoved = function(argv, sourcePath) {
/*  man gcc
 Preprocessor Options
     -Aquestion=answer -A-question[=answer] -C  -dD  -dI  -dM  -dN -Dmacro[=defn]  -E  -H -idirafter dir -include file  -imacros file -iprefix file  -iwithprefix dir -iwithprefixbefore dir
     -isystem dir -imultilib dir -isysroot dir -M  -MM  -MF  -MG  -MP  -MQ  -MT  -nostdinc -P  -fdebug-cpp -ftrack-macro-expansion -fworking-directory -remap -trigraphs  -undef  -Umacro
     -Wp,option -Xpreprocessor option -no-integrated-cpp

*/
  //remove singular options(-C -dM), plural options(-Dmacro)
  var singleOptions = ['-C', '-dD', '-dI', '-dM', '-dN', '-E', '-H', '-M', '-MM'
          , '-MG', '-MP', '-MQ', '-MT', '-nostdinc', '-P'
          , '-fdebug-cpp', '-ftrack-macro-expansion'
          , '-fworking-directory', '-remap', '-trigraphs', '-undef'
          , '-no-integrated-cpp', '-MMD'];
  singleOptions.push('-c');
  singleOptions.push(sourcePath);


  var newArgv = argv.filter(function(e){
    return singleOptions.indexOf(e) === -1 
                && (e.indexOf('-A') === -1)
                && (e.indexOf('-D') === -1)
                && (e.indexOf('-W') === -1)
                && (e.indexOf('-U') === -1)
                && (e.indexOf('-I') === -1) //added.
  });
  //remove two plural options.
  var twoPluralOptions = ['-idirafter', '-iprefix', '-iwithprefix'
       , '-iwithprefixbefore', '-isystem', '-imultilib'
       , '-isysroot', '-include', '-imacros', '-Xpreprocessor'
       , '-MF'];

  for (var i = newArgv.length - 1; i >= 0; i--) {
    if (twoPluralOptions.indexOf(newArgv[i]) !== -1)
      newArgv.splice(i,2);
  };

  return newArgv;
};

module.exports.determineOutputPath = determineOutputPath;
module.exports.determineSourcePath = determineSourcePath;

module.exports.newPreprocessedArgvRemoved = newPreprocessedArgvRemoved;
module.exports.newPumpArgvRemoved = newPumpArgvRemoved;