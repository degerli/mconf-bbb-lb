var Logger = require('../lib/logger')
  , Server = require('../models/server')
  , Utils = require('../lib/utils')
  , config = require('../config')
  , request = require('request');

var Nagios = exports;

// Start working already!
Nagios.startup = function(callback) {
  Logger.log('nagios integration at: ' + config.nagios.url + config.nagios.apiPath);
  Nagios.updateServers(callback);
  setInterval(Nagios.updateServers, config.nagios.interval);
}

// Fetches the list of servers from Nagios and updates the db in Server
Nagios.updateServers = function(callback) {
  var opt = { url: config.nagios.url + config.nagios.apiPath }
  if (config.nagios.auth == 'HTTPBasic') {
    var unameAndPass = config.nagios.username + ':' + config.nagios.password;
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
        servers = Nagios.parseServers(body);
        Nagios.validateServers(servers);

        // replace the current db with the list from nagios
        Server.clear();
        Logger.log('current list of servers registered:');
        for (var id in servers) {
          servers[id].save();
          Logger.log(JSON.stringify(servers[id]));
        }

      } else {
        Logger.log('wrong status code getting data from nagios: ' + response.statusCode);
      }
    }
    if (callback) callback(error);
  });
}

// Parse the json received from Nagios
Nagios.parseServers = function(data){
  var servers = {}; // temp list of servers

  Logger.log('parsing the servers to update the db');
  json = JSON.parse(data);

  for (var id in json['services']) {
    var node = json['services'][id];

    if (Nagios.isValidServiceNode(node)) {
      var s = {}
        , notes = Utils.unescapeEntities(node['service_host']['host_notes']).split(' ');

      // Only parse the node if the host is UP
      // from nagios: "int host_status_types=HOST_PENDING|HOST_UP|HOST_DOWN|HOST_UNREACHABLE;"
      if (node['service_host']['host_status'] == 2) {
        s.name = Utils.unescapeEntities(node['service_description']);
        s.data = Utils.unescapeEntities(node['service_performance_data']);
        s.hostname = Utils.unescapeEntities(node['service_host']['host_address']);
        s.hostsalt = notes[1];
        // we want the "protocol://host:port" part only
        s.hosturl = Utils.gsub(notes[0], '[/]?bigbluebutton[/]?', '');
        Logger.log('parsed: ' + JSON.stringify(s));

        Nagios.addServerFromService(s, servers);
      }
    }
  }

  return servers;
}

// Checks whether a json node from the response received from Nagios
// is a valid BigBlueButton or not
Nagios.isValidServiceNode = function(node){
  return node.hasOwnProperty('service_host')
    && node['service_host'].hasOwnProperty('host_notes')
    && node['service_host']['host_notes'].split(' ').length == 2  // has bbb url and salt
    && config.nagios.services.indexOf(node['service_description']) != -1 // is a tracked service
}

// Create a Server object with information from the given service
Nagios.addServerFromService = function(service, servers){
  var id = service.hostname;
  if (servers[id] == undefined) {
    servers[id] = new Server(service.hostname, service.hosturl, service.hostsalt);
  }
  servers[id].updateService(service.name, service.data);
}

// Validates 'servers' to remove any server that is not a BBB server
// or that is not running
Nagios.validateServers = function(servers){
  var server;
  for (var id in servers) {
    // for now any server with this service is considered a BBB server
    if (servers[id].services[config.nagios.bbbService] == undefined) {
      delete servers[id];
    }
  }
}
