var url = require('url')
  , Logger = require('../lib/logger')
  , sha1 = require('sha1')
  , config = require('../config')
  , request = require('request')
  , Utils = require('../lib/utils')
  , Server = require('../models/server');

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
// TODO: somehow nagios should inform which one is the default server
LoadBalancer.defaultServer = function(fn){
  Server.first(function(err, server) {
    fn(server);
  });
}

// Handlers a request 'req' to the BigBlueButton 'server'
// If 'useProxy', the request will be proxied, otherwise
// it will respond with a redirect to the BBB server.
LoadBalancer.handle = function(req, res, server, useProxy){
  var method, query, salt, urlObj, checksum, newUrl;
  Logger.log('handling the request to the server ' + server.url);

  // parse the url and remove the old checksum
  urlObj = url.parse(req.url, true);
  delete urlObj.search; // so the obj is updated later
  if (urlObj.query.hasOwnProperty('checksum')) {
    delete urlObj.query['checksum'];
  }

  // calculates the new checksum
  method = Utils.bbbMethodFromUrl(urlObj);
  query = Utils.bbbQueryFromUrl(urlObj);
  salt = server.salt;
  checksum = sha1(method + query + salt);

  // format the new url with the new server and checksum
  urlObj.query['checksum'] = checksum;
  newUrl = server.url + url.format(urlObj);

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

  opt = { url: destination }
  request(opt, function(error, response, body) {
    if (error) {
      Logger.log('error proxying the request: ' + error);
    } else {
      Logger.log('got the response from BBB, sending to the user with headers:');
      Logger.log(JSON.stringify(response.headers));

      res.statusCode = response.statusCode;
      for (name in response.headers) {
        value = response.headers[name];
        res.setHeader(name, value);
      }
      res.send(body);
    }
  });
}
