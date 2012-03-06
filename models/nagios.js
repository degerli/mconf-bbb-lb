var Logger = require('../lib/logger')
  , Server = require('./server')
  , request = require('request');

var Nagios = exports
  , db = {}
  , config = {};

// Get the available BigBlueButton servers from a Nagios instance
Nagios.getServers = function(){
  return db;
}

Nagios.startup = function(cfg){
  config = cfg;
  Logger.log('nagios integration at: ' + config.url + config.api_path);
  Nagios.updateServers();
  setInterval(Nagios.updateServers, config.interval);
}

// Fetches the list of servers from Nagios and updates the local db
Nagios.updateServers = function(){
  var opt = { url: config.url + config.api_path }
  if (config.auth == 'HTTPBasic') {
    var unameAndPass = config.username + ':' + config.password;
    opt.headers = {
      'Authorization': 'Basic ' + new Buffer(unameAndPass).toString('base64')
    }
  }

  Logger.log('requesting the list of servers to nagios: ' + opt.url);
  request(opt, function(error, response, body) {
    if (error) {
      Logger.log('error getting data from nagios: ' + error);
    } else {
      if (response.statusCode == 200) {
        Logger.log('got the server list back from nagios');
        Nagios.parseServers(body);
      } else {
        Logger.log('wrong status code getting data from nagios: ' + response.statusCode);
      }
    }
  })
}

// Parse the json received from Nagios
Nagios.parseServers = function(data){
  Logger.log('parsing the servers to update the db');
  json = JSON.parse(data);

  for (var id in json['services']) {
    var node = json['services'][id];

    if (Nagios.isValidServiceNode(node)) {
      var s = {}
        , notes = node['service_host']['host_notes'].split(' ');

      s.name = node['service_description'];
      s.data = node['service_plugin_output']; // TODO: should be the perf data, but it's not available yet
      s.hostname = node['service_host']['host_address'];
      s.url = notes[0];
      s.salt = notes[1];

      Logger.log('parsed: ' + JSON.stringify(s));
    }
  }
}

// Checks whether a json node from the response received from Nagios
// is a valid BigBlueButton or not
Nagios.isValidServiceNode = function(node){
  return node.hasOwnProperty('service_host')
    && node['service_host'].hasOwnProperty('host_notes')
    && node['service_host']['host_notes'].split(' ').length == 2  // has bbb url and salt
    && config.services.indexOf(node['service_description']) != -1 // is a tracked service
}
