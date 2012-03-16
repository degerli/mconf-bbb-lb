// LoadBalancer module
// Responsible for balancing the request.

var BigBlueButton = require('../lib/bigbluebutton')
  , Logger = require('../lib/logger')
  , Server = require('../models/server')
  , Utils = require('../lib/utils')
  , config = require('../config')
  , request = require('request')
  , url = require('url');

var LoadBalancer = exports;

// Selects the adequate BigBlueButton server for a new meeting
// to be created
LoadBalancer.selectServer = function(){
  var id = 0
    , s = null
    , count = -1
    , newCount = 0;
  Logger.log('selecting a server for a new meeting');

  // for now we select the server with the lowest number of users connected
  var selected;
  Server.all(function(err, servers) {
    selected = servers[0];
    for (id in servers) {
      s = servers[id];
      newCount = s.getMeetingCount();

      if (newCount != -1) {
        Logger.log('server ' + s.name + ' has ' + newCount + ' meetings');
        if (newCount < count || count == -1) {
          selected = s;
          count = newCount;
        }
      } else {
        Logger.log('server ' + s.name + ' is disabled');
      }

    }
  });

  Logger.log('server selected: ' + selected.name + ' with ' + count + ' meetings');
  selected.incMeetingCount();
  Logger.log('server selected has now ' + (count + 1) + ' meetings');
  return selected;
}

// Returns the default server, used when we don't know in which server
// the meeting is in (usually resulting in an error message)
LoadBalancer.defaultServer = function(fn){
  Server.get(config.nagios.defaultServer, function(err, server) {
    if (server != undefined) {
      fn(server);
    } else {
      // if we don't find the default server, get the first one
      Server.first(function(err, first) {
        fn(first);
      });
    }
  });
}

// Handlers a request 'req' to the BigBlueButton 'server'
// If 'useProxy', the request will be proxied, otherwise
// it will respond with a redirect to the BBB server.
LoadBalancer.handle = function(req, res, server, useProxy){
  var newUrl;
  Logger.log('handling the request to the server ' + server.url);

  newUrl = BigBlueButton.formatBBBUrl(req.url, server);
  if (useProxy) {
    LoadBalancer.proxy(res, newUrl);
  } else {
    LoadBalancer.redirect(res, newUrl);
  }
}

// Redirects a request to 'destination'
LoadBalancer.redirect = function(res, destination){
  Logger.log('full redirect api call to ' + destination);
  res.redirect(destination);
}

// Proxies a request to 'destination'
LoadBalancer.proxy = function(res, destination){
  var value, name, opt;
  Logger.log('proxying api call to ' + destination);

  opt = { url: destination, timeout: config.lb.requestTimeout }
  request(opt, function(error, response, body) {
    if (error) {
      Logger.log('error proxying the request: ' + error);
    } else {
      Logger.log('got the response from BBB, sending it to the user.');

      res.statusCode = response.statusCode;
      for (name in response.headers) { // copy the headers from BBB
        value = response.headers[name];
        res.setHeader(name, value);
      }
      res.send(body);
    }
  });
}
