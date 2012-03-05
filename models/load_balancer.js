var LoadBalancer = exports,
  Logger = require('../lib/logger');

// Selects the adequate BigBlueButton server for a new meeting
// to be created
LoadBalancer.select_server = function(servers){
  Logger.log('selecting a server for a new meeting');
  return 'empty';
}