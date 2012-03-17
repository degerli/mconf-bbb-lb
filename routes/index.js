// Router module

var BigBlueButton = require('../lib/bigbluebutton')
  , LoadBalancer = require('../lib/load_balancer')
  , Logger = require('../lib/logger')
  , Meeting = require('../models/meeting')
  , Nagios = require('../lib/nagios')
  , Server = require('../models/server')
  , Utils = require('../lib/utils')
  , config = require('../config')
  , request = require('request')
  , url = require('url');


// HELPERS

// Basic handler that tries to find the meeting using the meetingID provided
// in the request and checks the checksum. If the meeting is not found or the
// checksum is incorrect it responds with an error.
// Otherwise it calls the callback 'fn'.
exports.basicHandler = function(req, res, fn){
  var meeting, m_id, urlObj, server;

  urlObj = url.parse(req.url, true);
  m_id = urlObj.query['meetingID'];
  Logger.log(urlObj.pathname + ' request with: ' + JSON.stringify(urlObj.query), m_id);

  meeting = Meeting.getSync(m_id);
  if (!meeting) {
    Logger.log('failed to find meeting', m_id);

    // we'll use the default server to get a proper anwser from BBB
    // usually it will be an XML with an error code
    server = LoadBalancer.defaultServer();
    if (server != undefined) {
      Logger.log('redirecting to the default server ' + server.name, m_id);
      LoadBalancer.handle(req, res, server);
    } else {
      Logger.log('there\'s no default server, sending an invalidMeeting response', m_id);
      res.contentType('xml');
      res.send(config.bbb.responses.invalidMeeting);
    }
    return false;
  }

  fn(meeting);
};


// ROUTES HANDLERS

// General index
exports.index = function(req, res){
  res.render('index', { title: 'Mconf - BigBlueButton Load Balancer' })
};

// BBB api index
exports.apiIndex = function(req, res){
  res.contentType('xml');
  res.send(config.bbb.responses.apiIndex);
};

// Validates the checksum in the request 'req'.
// If it doesn't match the expected checksum, we'll send
// an XML response with an error code just like BBB does and
// return false. Returns true if the checksum matches.
exports.validateChecksum = function(req, res){
  var urlObj, checksum;

  urlObj = url.parse(req.url, true);
  checksum = urlObj.query['checksum'];

  // matches the checksum in the url with the expected checksum
  if (checksum != BigBlueButton.checksum(req.url, config.lb.salt, true)) {
    Logger.log('checksum check failed, sending a checksumError response');
    res.contentType('xml');
    res.send(config.bbb.responses.checksumError);
    return false;
  }
  return true;
};

// Base method used to create a new meeting
// TODO: This exists only because of the mobile client, see routes/mobile.create
exports.createBase = function(req, res, callback){
  var meeting, m_id, server, urlObj;

  urlObj = url.parse(req.url, true);
  m_id = urlObj.query['meetingID'];
  Logger.log(urlObj.pathname + ' request with: ' + JSON.stringify(urlObj.query), m_id);

  if (m_id == undefined) {
    Logger.log('meetingID was not defined, forwarding call to BBB to get the error response');
    LoadBalancer.handle(req, res, LoadBalancer.defaultServer());
    return;
  }

  // the meeting is not registered yet
  meeting = Meeting.getSync(m_id);
  if (!meeting) {
    Logger.log('failed to load meeting', m_id);
    server = LoadBalancer.selectServer();
    meeting = new Meeting(m_id, server);
  }

  Logger.log('successfully loaded meeting', m_id);
  Logger.log('server selected ' + meeting.server.url, m_id);

  callback(meeting);
};

// Routing a 'create' request
exports.create = function(req, res, whenReady){
  exports.createBase(req, res, function(meeting) {
    LoadBalancer.handle(req, res, meeting.server, null, function(useProxy, body) {

      // if not proxying, we assume the meeting was created, otherwise check the response
      if (!useProxy || BigBlueButton.isSuccessfulResponse(body)) {
        meeting.saveSync();
      }

    })
  });
};

// Routing a 'join' request
exports.join = function(req, res){
  exports.basicHandler(req, res, function(meeting) {
    // always redirect, never proxy
    LoadBalancer.handle(req, res, meeting.server, false);
  });
};

// Routing a 'end' request
exports.end = function(req, res){
  exports.basicHandler(req, res, function(meeting) {
    LoadBalancer.handle(req, res, meeting.server, null, function(useProxy, body) {

      // if not proxying, we assume the meeting was ended, otherwise check the response
      if (!useProxy || BigBlueButton.isSuccessfulResponse(body)) {
        meeting.destroySync();
      }

    });
  });
};

// Routing a 'getMeetings' request
// TODO: this replicates some code from BigBlueButton.repopulateMeetings()
exports.getMeetings = function(req, res){
  var meetId
    , meetings = []
    , responses = []
    , serverId
    , xml;

  // send a getMeetings to all registered servers and concatenate the responses
  // since we're getting the list of meetings, we'll also update the meetings db

  BigBlueButton.sendGetMeetingsToAll(function(error, body, server) {
    if (error) {
      Logger.log('error calling getMeetings to ' + server.name + ': ' + error);
      responses.push(null);
      meetings.push(null);
    } else {
      Logger.log('got response to getMeetings from ' + server.name);
      responses.push(body);
      meetings.push(BigBlueButton.meetingsFromGetMeetings(body, server));
    }
  }, function(total) {
    // first update the meetings db
    Utils.updateMeetings(Utils.flatten(meetings));

    // and send the response to the user
    xml = BigBlueButton.concatenateGetMeetings(responses);
    res.contentType('xml');
    res.send(xml);
  });
};

// Routing any request that simply needs to be passed to a BBB server
exports.anything = function(req, res){
  exports.basicHandler(req, res, function(meeting) {
    LoadBalancer.handle(req, res, meeting.server);
  });
};
