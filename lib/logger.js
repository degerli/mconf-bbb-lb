var fs = require('fs')
  , Log = require('log')
  , log = new Log('debug', fs.createWriteStream('debug.log'));

var Logger = exports;

Logger.info = function(msg, id){
  return Logger.log(msg, id);
}

Logger.log = function(msg, id){
  var msg = Logger.format(msg, id);
  console.log(msg);
  log.info(msg);
}

Logger.debug = function(msg, id){
  var msg = Logger.format(msg, id);
  console.log(msg);
  log.debug(msg);
}

Logger.error = function(msg, id){
  var msg = Logger.format(msg, id);
  console.log('ERROR: ' + msg);
  log.error(msg);
}

Logger.format = function(msg, id) {
  if (id) {
    return '[' + id + '] ' + msg;
  } else {
    return '[-] ' + msg;
  }
}
