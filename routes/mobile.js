// Router for the mobile requests
// It will work always on proxy-mode
//
// This is an implementation of the mobile.jsp demo from BigBlueButton
// https://github.com/bigbluebutton/bigbluebutton/blob/master/bbb-api-demo/src/main/webapp/mobile.jsp

var BigBlueButton = require('../lib/bigbluebutton')
  , Logger = require('../lib/logger')
  , Utils = require('../lib/utils')
  , config = require('../config')
  , request = require('request')
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

// Sends a default error XML to the client
exports.sendDefaultError = function(req, res) {
  res.contentType('xml');
  res.send(config.bbb.mobile.responses.defaultError);
}

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
// We can't use routes.getMeetings() because the mobile client expects
// a getMeetingInfo to be called for each meeting in the list
exports.getMeetings = function(req, res) {
  var meetId
    , meetings = []
    , allMeetings = []
    , responses = []
    , serverId
    , xml;

  BigBlueButton.sendGetMeetingsToAll(function(error, body, server) {
    if (error) {
      Logger.log('error calling getMeetings to ' + server.name + ': ' + error);
      allMeetings.push(null);
    } else {
      Logger.log('got response to getMeetings from ' + server.name);
      meetings = BigBlueButton.meetingsFromGetMeetings(body, server);
      for (var id in meetings) {
        allMeetings.push(meetings[id]);
      }
    }
  }, function(total) {

    // call a 'getMeetingInfo' for each meeting found in 'getMeetings'
    exports.sendGetMeetingInfoToAll(allMeetings, function(error, body, server) {
      if (error) {
        Logger.log('error calling getMeetingInfo to ' + server.name + ': ' + error);
        responses.push(null);
      } else {
        Logger.log('got response to getMeetingInfo from ' + server.name);
        responses.push(body);
      }
    }, function(total) {
      xml = exports.concatenateGetMeetingInfo(responses);
      res.contentType('xml');
      res.send(xml);
    });
  });
}

// Treats action=create
// We can't use routes.create() because the mobile client expects
// different responses than those from the normal api
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

  routes.createBase(req, res, function(meeting) {

    var newUrl = BigBlueButton.formatBBBUrl(req.url, meeting.server);
    opt = { url: newUrl, timeout: config.lb.requestTimeout }
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

        if (body.match(/<returncode>SUCCESS/)) {
          res.send(body.match(/<meetingID>(.*)<\/meetingID>/)[1]);
        } else {
          var msg = 'Error ' + body.match(/<messageKey>(.*)<\/messageKey>/)[1].trim()
          msg += ': ' + body.match(/<message>(.*)<\/message>/)[1].trim();
          res.send(msg);
        }
      }
    });

  });
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

// Calls 'getMeetingInfo' for all 'meetings'
// TODO: this is not in lib/bigbluebutton because it is only used for the
//       mobile client and might be removed in the future
exports.sendGetMeetingInfoToAll = function(meetings, afterEach, afterAll) {
  var count, id, rand, request
    , received = 0;

  count = meetings.length;

  // send a getMeetingInfo to all 'meetings'
  for (id in meetings) {
    request = config.bbb.apiPath + '/getMeetingInfo?';
    request += 'meetingID=' + escape(meetings[id].id);
    request += '&password=' + escape(meetings[id].password);
    Utils.requestToServer(request, meetings[id].server, function(error, response, body, server) {
      received++;
      afterEach(error, body, server);
      if (received == count) {
        afterAll(received);
      }
    });
  }
}

// Receives an array with responses from getMeetingInfo calls
// and generates a response with all the meetings available
// TODO: this is not in lib/bigbluebutton because it is only used for the
//       mobile client and might be removed in the future
exports.concatenateGetMeetingInfo = function(responses) {
  var id
    , match
    , responseMatcher
    , xml;

  responseMatcher = new RegExp('<response>(.*)</response>');

  xml = '<meetings>';
  for (id in responses) {
    match = responses[id].match(responseMatcher);
    if (match != undefined && match[1] != match != undefined) {
      xml += '<meeting>' + match[1] + '</meeting>';
    }
  }
  xml += '</meetings>';

  return xml;
}
