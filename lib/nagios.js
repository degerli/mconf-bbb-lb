var Logger = require('../lib/logger')
  , Server = require('../models/server')
  , request = require('request')
  , Utils = require('../lib/utils');

var Nagios = exports
  , config = {};

// Start working already!
Nagios.startup = function(cfg){
  config = cfg;
  Logger.log('nagios integration at: ' + config.url + config.api_path);
  Nagios.updateServers();
  setInterval(Nagios.updateServers, config.interval);
}

// Fetches the list of servers from Nagios and updates the db in Server
Nagios.updateServers = function(){
  // TODO: it might be better to clear only after parsing the new servers,
  //       to keep the old db if the last connection fails
  Server.clear();

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

        Logger.log('servers registered:');
        Server.all(function(error, servers) {
          for (var idx in servers) {
            Logger.log(JSON.stringify(servers[idx]));
          }
        });
      } else {
        Logger.log('wrong status code getting data from nagios: ' + response.statusCode);
      }
    }
  });
}

// Parse the json received from Nagios
Nagios.parseServers = function(data){
  Logger.log('parsing the servers to update the db');
  json = JSON.parse(data);

  for (var id in json['services']) {
    var node = json['services'][id];

    if (Nagios.isValidServiceNode(node)) {
      var s = {}
        , notes = Utils.unescapeEntities(node['service_host']['host_notes']).split(' ');

      s.name = Utils.unescapeEntities(node['service_description']);
      s.data = Utils.unescapeEntities(node['service_performance_data']);
      s.hostname = Utils.unescapeEntities(node['service_host']['host_address']);
      s.hostsalt = notes[1];
      // we want the protocol://host:port part only
      s.hosturl = Utils.gsub(notes[0], '[/]?bigbluebutton[/]?', '');
      Logger.log('parsed: ' + JSON.stringify(s));

      Nagios.addServerFromService(s);
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

// Adds information about a service in the local db or updates the existing
// information
Nagios.addServerFromService = function(service){
  Server.get(service.hostname, function(err, server) {
    if (server == undefined) {
      server = new Server(service.hostname, service.hosturl, service.hostsalt);
    }
    server.updateService(service.name, service.data);
    server.save();
  });
}
