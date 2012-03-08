var url = require('url')
  , Logger = require('../lib/logger')
  , sha1 = require('sha1')
  , config = require('../config')
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

// Redirects a request 'req' to the BigBlueButton 'server'
// TODO: implement a proxy mode too
LoadBalancer.redirect = function(req, res, server){
  var method, query, salt, urlObj, checksum, newUrl;
  Logger.log('redirecting the request to the server ' + server.url);

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

  Logger.log('full redirect url ' + newUrl);
  res.redirect(newUrl);
}
