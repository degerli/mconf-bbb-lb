// Router for the mobile requests
// This is an implementation of the mobile.jsp demo from BigBlueButton
// https://github.com/bigbluebutton/bigbluebutton/blob/master/bbb-api-demo/src/main/webapp/mobile.jsp

var BigBlueButton = require('../lib/bigbluebutton')
  , Logger = require('../lib/logger')
  , Utils = require('../lib/utils')
  , config = require('../config')
  , routes = require('./index')
  , url = require('url');

// Validates the checksum in the request 'req' against the
// mobile salt. If it doesn't match the expected checksum, we'll send
// an XML response with an error code just like BBB does and
// return false. Returns true if the checksum matches.
exports.validateMobileChecksum = function(req, res){
  var urlObj, checksum, expectedChecksum;

  urlObj = url.parse(req.url, true);
  checksum = urlObj.query['checksum'];

  // matches the checksum in the url with the expected checksum
  expectedChecksum = BigBlueButton.checksum(req.url, config.lb.mobileSalt, true, true);
  if (checksum != expectedChecksum) {
    Logger.log('mobile checksum check failed, sending a checksumError response');
    res.contentType('xml');
    res.send(config.bbb.responses.checksumError);
    return false;
  }
  return true;
};

// Validates the timestamp in the request 'req'. If it is not within 1 minute
// from the last timestamp sent, it sends a response with an error. Otherwise
// it will return true.
exports.validateTimestamp = function(req, res){
  var urlObj, now, timestamp;

  urlObj = url.parse(req.url, true);
  timestamp = urlObj.query['timestamp'];
  now = new Date().getTime();

  // if the last sent was more than 1min ago
  if (now - timestamp > 60000) {
    Logger.log('timestamp check failed, sending a timestampError response');
    Logger.log('received ' + timestamp + ', base ' + lastTimestamp);
    res.contentType('xml');
    res.send(config.bbb.mobile.responses.timestampError);
    return false;
  }
  return true;
};

// All requests from the mobile app end up here
exports.index = function(req, res){
  var urlObj, action;

  urlObj = url.parse(req.url, true);
  action = urlObj.query['action'];

  if (action == 'getTimestamp') {
    return exports.getTimestamp(req, res);
  } else {
    if (!exports.validateTimestamp(req, res)) { return; }

    // we don't need the timestamp and action params anymore
    Utils.removeParamFromUrl(urlObj, 'timestamp');
    Utils.removeParamFromUrl(urlObj, 'action');
    req.url = url.format(urlObj);

    // pretend this is a normal request for the api
    req.url = req.url.replace(config.bbb.mobile.path, config.bbb.apiPath + '/' + action);

    if (action == 'getMeetings') {
      return exports.getMeetings(req, res);
    } else if (action == 'create') {
      return exports.create(req, res);
    } else if (action == 'join') {
      return exports.join(req, res);
    } else {
      exports.sendDefaultError(req, res);
    }

  }
};

// Treats action=getTimestamp
exports.getTimestamp = function(req, res) {
  var xml;

  config.bbb.mobile.timestamp = new Date().getTime();
  xml = config.bbb.mobile.responses.getTimestamp;
  xml = xml.replace(/%%TIMESTAMP%%/, config.bbb.mobile.timestamp);
  res.contentType('xml');
  res.send(xml);
  Logger.log('sent the timestamp ' + config.bbb.mobile.timestamp);
}

// Treats action=getMeetings
exports.getMeetings = function(req, res) {
  return routes.getMeetings(req, res);
}

// Treats action=create
exports.create = function(req, res) {
  var urlObj = url.parse(req.url, true);

  // add some parameters that are mandatory and are added by bbb_api.jsp if
  // they don't exist
  if (urlObj.query['name'] == undefined &&
      urlObj.query['meetingID'] != undefined) {
    req.url += '&name=' + urlObj.query['meetingID'];
  }
  if (urlObj.query['attendeePW'] == undefined) {
    req.url += '&attendeePW=ap';
  }
  if (urlObj.query['moderatorPW'] == undefined) {
    req.url += '&moderatorPW=mp';
  }
  if (urlObj.query['voiceBridge'] == undefined) {
    req.url += '&voiceBridge=' + (7000 + Math.floor(Math.random() * 10000) - 1);
  }

  return routes.create(req, res);
}

// Treats action=join
// TODO: this method wasn't tested yet
exports.join = function(req, res){
  var joinUrl, enterUrl, opt;
  var urlObj = url.parse(req.url, true);

  exports.basicHandler(req, res, function(meeting) {
    if (urlObj.query['fullName'] == undefined ||
        urlObj.query['password'] == undefined) {
      exports.sendDefaultError(req, res);
    }

    joinUrl = BigBlueButton.formatBBBUrl(req.url, meeting.server);
    enterUrl = meeting.server.url + config.bbb.apiPath + '/enter'

    //Logger.log('JOIN URL ' + joinUrl);
    //Logger.log('ENTER URL ' + enterUrl);

    opt = { url: joinUrl, timeout: config.lb.requestTimeout }
    request(opt, function(joinError, joinRes, joinBody) {
      if (joinError) {
        exports.sendDefaultError(req, res);
      } else {
        opt = { url: enterUrl, timeout: config.lb.requestTimeout }
        request(opt, function(enterError, enterRes, enterBody) {
          if (enterError) {
            exports.sendDefaultError(req, res);
          } else {
            // TODO: res.contentType('xml'); ?
            res.send(enterBody);
          }
        });
      }
    });;
  });

}

exports.sendDefaultError = function(req, res) {
  res.contentType('xml');
  res.send(config.bbb.mobile.responses.defaultError);
}