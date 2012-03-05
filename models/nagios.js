var Nagios = exports,
  Logger = require('../lib/logger');

// Get the available BigBlueButton servers from a Nagios instance
Nagios.get_servers = function(url){
  Logger.log('fetching servers from ' + url);
  return 'empty';
}