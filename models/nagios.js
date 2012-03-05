var Logger = require('../lib/logger')
  , Server = require('./server');

var Nagios = exports;

// Get the available BigBlueButton servers from a Nagios instance
Nagios.get_servers = function(url){
  Logger.log('fetching servers from ' + url);
  // TODO: implement
  servers = new Array();
  servers[0] = new Server('http://test.com', '1234567890abcdefghijkl');
  return servers;
}