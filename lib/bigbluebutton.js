// BigBlueButton module
// Things that require in-depth knowledge of how BigBlueButton works
// should be here. Such as parsing XML responses.

var Logger = require('./logger')
  , Server = require('../models/server')
  , Utils = require('./utils')
  , sha1 = require('sha1')
  , url = require('url');

var BigBlueButton = exports;

BigBlueButton.checksum = function(fullUrl, salt, incoming){
  var method, query, salt, urlObj, checksum;

  // parse the url and remove the old checksum
  urlObj = url.parse(fullUrl, true);
  delete urlObj.search;
  if (urlObj.query.hasOwnProperty('checksum')) {
    delete urlObj.query['checksum'];
  }

  // get the expected checksum
  query = Utils.bbbQueryFromUrl(urlObj);
  if (incoming != undefined && incoming) {
    // note: the url query is already escaped, however BBB expects a ' ' to
    // be encoded as '+', but any ' ' or '+' in the query are replaced by
    // '%20' in the 'url.parse()' call above
    // so when we're sending a call to BBB, we encode it using '%20', but
    // when we are receiving a call (incoming), we should expect that the
    // salt was calculated using '+' where we have '%20's
    query = query.replace(/%20/g, '+')
  }
  method = Utils.bbbMethodFromUrl(urlObj);
  checksum = sha1(method + query + salt);

  return checksum;
}
