// BigBlueButton module
// Things that require in-depth knowledge of how BigBlueButton works
// should be here. Such as parsing XML responses.

var Logger = require('./logger')
  , Server = require('../models/server')
  , Utils = require('./utils')
  , sha1 = require('sha1')
  , url = require('url')
  , xml2js = require('xml2js');

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

// Receives an array with responses from getMeetings calls
// and generates a response with all the meetings available
// FIXME: maybe we should prevent duplicated meeting ids?
BigBlueButton.concatenateGetMeetings = function(responses){
  var id, response
    , selected = null
    , meetingList = []
    , meetingStr;

  // at first we'll select one of the responses to be used
  // as a base for our response and create an array with
  // all meetings found in the responses
  for (id in responses) {
    response = responses[id];

    // if the response has meetings, select it as the base for our
    // response
    hasMeetings = response.match(/<meetings>(.*)<\/meetings>/);
    if (hasMeetings != null) {
      selected = response;
      meetingList.push(hasMeetings[1]);
    }

    // if the response has no meetings, but was successful, select it
    // for now. if we're at the last response and there's none selected,
    // select it even if it's an error response
    if (selected == null &&
        (response.match(/SUCCESS/) || id == responses.length-1) ) {
      selected = response;
    }
  }

  // it there's at least 1 meeting, we add it to our selected response
  if (meetingList.length > 0) {
    meetingStr = "<meetings>" + meetingList.join('') + "</meetings>";
    selected = selected.replace(/<meetings>.*<\/meetings>/, meetingStr);
  }

  return selected;
}

// Sends a 'getMeetings' request to all registered servers and use the responses
// to create the database of meetings
// FIXME: if there are meetings with duplicated meetingID's, the last one parsed
//        will be the one used, the others are ignored
BigBlueButton.populateMeetings = function(){
  var count = 0
    , id
    , meetings;

  Server.count(function(err, c) { count = c; });

  // send a getMeetings to all registered servers
  Server.all(function(err, servers) {
    for (id in servers) {
      Utils.requestToServer('/getMeetings', servers[id], function(error, response, body, server) {

        if (error) {
          Logger.log('error calling getMeetings to ' + server.name + ': ' + error);
        } else {
          // get the meetings in the XML and save them
          meetings = BigBlueButton.meetingsFromGetMeetings(body, server);
          for (id in meetings) { meetings[id].save(); }
        }

      });
    }
  });

}

// Parses the XML in 'data' (result from 'getMeetings') and returns an array
// of Meeting's with the meetings in the XML
BigBlueButton.meetingsFromGetMeetings = function(data, server) {
  var result = []
    , meetings
    , parser = new xml2js.Parser();

  parser.parseString(data, function (error, parsed) {
    if (error) {
      Logger.log('error parsing the result of getMeetings: ' + data);
    } else {
      if (parsed['meetings'] != undefined) {
        meetings = parsed['meetings']['meeting'];
        if (meetings != undefined) {
          for (id in meetings) {
            result.push(new Meeting(meetings[id]['meetingID'], server));
          }
        }
      }
    }
  });

  return result;
}

// Gets an url in 'originalUrl' and formats it to be sent to a BBB server
// 'originalUrl' in the format '/bigbluebutton/api/getMeetings?random=123...'
BigBlueButton.formatBBBUrl = function(originalUrl, server){

  // parse the url and change the checksum
  var urlObj = url.parse(originalUrl, true);
  delete urlObj.search; // so the obj is updated later
  if (urlObj.query.hasOwnProperty('checksum')) {
    delete urlObj.query['checksum'];
  }
  urlObj.query['checksum'] = BigBlueButton.checksum(originalUrl, server.salt);

  return server.url + url.format(urlObj);
}
