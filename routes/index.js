var url = require('url')
  , Meeting = require('../models/meeting')
  , Nagios = require('../lib/nagios')
  , LoadBalancer = require('../lib/load_balancer')
  , Logger = require('../lib/logger')
  , Utils = require('../lib/utils')
  , sha1 = require('sha1')
  , config = require('../config');

exports.index = function(req, res){
  res.render('index', { title: 'Mconf - BigBlueButton Load Balancer' })
};

exports.api_index = function(req, res){
  res.render('index', { title: 'Mconf - BigBlueButton Load Balancer - Api Index' })
};

// Validates the checksum in the request 'req'.
// If it doesn't match the expected checksum, we'll send
// an XML response with an error code just like BBB does and
// return false. Returns true if the checksum matches.
exports.validateChecksum = function(req, res){
  var method, query, salt, urlObj, checksum;

  urlObj = url.parse(req.url, true);
  checksum = urlObj.query['checksum'];
  delete urlObj.search; // so the next line has effect
  delete urlObj.query['checksum'];

  // get the expected checksum
  // note: the url query is already encoded, howerver BBB expects a ' ' to
  // be encoded as '+', but any ' ' or '+' in the query are replaced by
  // '%20' in the 'url.parse()' call above
  query = Utils.bbbQueryFromUrl(urlObj).replace(/%20/g, '+');
  method = Utils.bbbMethodFromUrl(urlObj);
  salt = config.lb.salt;
  correctChecksum = sha1(method + query + salt);

  // matches the checksum
  if (checksum != correctChecksum) {
    Logger.log('checksum check failed, sending a checksumError response', m_id);
    res.contentType('xml');
    res.send(config.bbb.responses.checksumError);
    return false;
  }
  return true;
};

// Routing a 'create' request
exports.create = function(req, res){
  if (!exports.validateChecksum(req, res)) return;

  urlObj = url.parse(req.url, true);
  var m_id = urlObj.query['meetingID'];
  Logger.log(urlObj.pathname + ' request with: ' + JSON.stringify(urlObj.query), m_id);

  Meeting.get(m_id, function(err, meeting){

    // the meeting is not being proxied yet
    if (!meeting) {
      Logger.log('failed to load meeting', m_id);

      var server = LoadBalancer.selectServer();
      meeting = new Meeting(m_id, server);
      meeting.save();
    }

    Logger.log('successfully loadded meeting', m_id);
    Logger.log('server selected ' + meeting.server.url, m_id);

    LoadBalancer.redirect(req, res, meeting.server);
  });
};

// Routing any request that simply needs to be redirected to a BBB server
exports.redirect = function(req, res){
  if (!exports.validateChecksum(req, res)) return;

  urlObj = url.parse(req.url, true);
  var m_id = urlObj.query['meetingID'];
  Logger.log(urlObj.pathname + ' request with: ' + JSON.stringify(urlObj.query), m_id);

  Meeting.get(m_id, function(err, meeting){
    if (!meeting) {
      Logger.log('failed to load meeting, sending an invalidMeeting response', m_id);
      res.contentType('xml');
      res.send(config.bbb.responses.invalidMeeting);
      return false;
    }

    LoadBalancer.redirect(req, res, meeting.server);
  });
};
