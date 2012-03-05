var url = require('url')
  , Logger = require('../lib/logger')
  , sha1 = require('sha1');

var LoadBalancer = exports;

// Selects the adequate BigBlueButton server for a new meeting
// to be created
LoadBalancer.select_server = function(servers){
  Logger.log('selecting a server for a new meeting');
  // TODO: select one
  return servers[0];
}

// Redirects a request 'req' to the BigBlueButton 'server'
LoadBalancer.redirect = function(req, res, server){
  Logger.log('redirecting the request to the server ' + server.url);

  // parse the url and remove the old checksum
  urlObj = url.parse(req.url, true);
  delete urlObj.search; // so the obj is updated later
  if (urlObj.query.hasOwnProperty('checksum')) {
    delete urlObj.query['checksum'];
  }

  // calculates the new checksum
  method = urlObj.pathname.substr('/bigbluebutton/api/'.length);
  query = url.format(urlObj).substr(urlObj.pathname.length + 1); // + the '?'
  salt = server.salt;
  checksum = sha1(method + query + salt)

  // format the new url with the new server and checksum
  urlObj.query['checksum'] = checksum;
  newUrl = server.url + url.format(urlObj);

  // TODO: implement proxy mode too
  Logger.log('redirecting to ' + newUrl);
  res.redirect(newUrl);
}
