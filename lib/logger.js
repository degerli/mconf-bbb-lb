var Logger = exports;

Logger.log = function(msg, id){
  if (id) {
    console.log('[' + id + '] ' + msg);
  } else {
    console.log('[-] ' + msg);
  }
}