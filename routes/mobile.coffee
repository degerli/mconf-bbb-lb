# # Router for the mobile requests
# It will work always on proxy-mode.
#
# This is an implementation of the `mobile.jsp` demo from BigBlueButton
# <https://github.com/bigbluebutton/bigbluebutton/blob/master/bbb-api-demo/src/main/webapp/mobile.jsp>

BigBlueButton = require("../lib/bigbluebutton")
Logger = require("../lib/logger")
Meeting = require("../models/meeting")
Utils = require("../lib/utils")
config = require("../config")
request = require("request")
routes = require("./index")
url = require("url")

# Validates the checksum in the request `req` against the
# mobile salt. If it doesn't match the expected checksum, we'll send
# an XML response with an error code just like BBB does and
# return false. Returns true if the checksum matches.
exports.validateMobileChecksum = (req, res) ->
  urlObj = url.parse(req.url, true)
  checksum = urlObj.query["checksum"]

  # Matches the checksum in the url with the expected checksum
  expectedChecksum = BigBlueButton.checksum(req.url, config.lb.mobileSalt, true, true)
  unless checksum is expectedChecksum
    Logger.log "mobile checksum check failed, sending a checksumError response"
    res.contentType "xml"
    res.send config.bbb.responses.checksumError
    false
  else
    true

# Validates the timestamp in the request `req`. If it is not within 1 minute
# from the last timestamp sent, it sends a response with an error. Otherwise
# it will return true.
exports.validateTimestamp = (req, res) ->
  urlObj = url.parse(req.url, true)
  timestamp = urlObj.query["timestamp"]
  now = new Date().getTime()

  # If the last sent was more than 1min ago
  if now - timestamp > 60000
    Logger.log "timestamp check failed, sending a timestampError response"
    Logger.log "received " + timestamp + ", base " + lastTimestamp
    res.contentType "xml"
    res.send config.bbb.mobile.responses.timestampError
    false
  else
    true

# Sends a default error XML to the client
exports.sendDefaultError = (req, res) ->
  res.contentType "xml"
  res.send config.bbb.mobile.responses.defaultError

# All requests from the mobile app end up here
exports.index = (req, res) ->
  urlObj = url.parse(req.url, true)
  action = urlObj.query["action"]

  if action is "getTimestamp"
    exports.getTimestamp req, res
  else
    return unless exports.validateTimestamp(req, res)

    # We don't need the timestamp and action params anymore
    Utils.removeParamFromUrl urlObj, "timestamp"
    Utils.removeParamFromUrl urlObj, "action"
    req.url = url.format(urlObj)

    # Pretend this is a normal request for the api
    req.url = req.url.replace(config.bbb.mobile.path, config.bbb.apiPath + "/" + action)

    switch action
      when "getMeetings" then exports.getMeetings req, res
      when "create" then exports.create req, res
      when "join" then exports.join req, res
      else exports.sendDefaultError req, res

# Treats the action `getTimestamp`.
exports.getTimestamp = (req, res) ->
  config.bbb.mobile.timestamp = new Date().getTime()
  xml = config.bbb.mobile.responses.getTimestamp
  xml = xml.replace(/%%TIMESTAMP%%/, config.bbb.mobile.timestamp)
  res.contentType "xml"
  res.send xml
  Logger.log "sent the timestamp " + config.bbb.mobile.timestamp

# Treats the action `getMeetings`.
# We can't use `routes.getMeetings()` because the mobile client expects
# a `getMeetingInfo` to be called for each meeting in the list.
exports.getMeetings = (req, res) ->
  allMeetings = []
  meetings = []
  responses = []

  BigBlueButton.sendGetMeetingsToAll (error, body, server) ->
    if error
      Logger.log "error calling getMeetings to " + server.name + ": " + error
      allMeetings.push null
    else
      Logger.log "got response to getMeetings from " + server.name
      meetings = BigBlueButton.meetingsFromGetMeetings(body, server)
      for id of meetings
        allMeetings.push meetings[id]
  , (total) ->
    # First update the meetings db
    Utils.updateMeetings allMeetings

    if Meeting.countSync() is 0
      xml = exports.concatenateGetMeetingInfo(responses)
      res.contentType "xml"
      res.send xml

    else
      # Call a `getMeetingInfo` for each meeting found in `getMeetings`
      exports.sendGetMeetingInfoToAll allMeetings, (error, body, server) ->
        if error
          Logger.log "error calling getMeetingInfo to " + server.name + ": " + error
          responses.push null
        else
          Logger.log "got response to getMeetingInfo from " + server.name
          responses.push body
      , (total) ->
        xml = exports.concatenateGetMeetingInfo(responses)
        res.contentType "xml"
        res.send xml

# Treats the action `create`.
# We can't use `routes.create()` because the mobile client expects
# different responses than those from the normal api.
exports.create = (req, res) ->
  urlObj = url.parse(req.url, true)

  # Add some parameters that are mandatory and are added by `bbb_api.jsp` if
  # they don't exist
  if not urlObj.query["name"]? and urlObj.query["meetingID"]?
    req.url += "&name=" + urlObj.query["meetingID"]
  if urlObj.query["attendeePW"]?
    req.url += "&attendeePW=ap"
  if urlObj.query["moderatorPW"]?
    req.url += "&moderatorPW=mp"
  if urlObj.query["voiceBridge"]?
    req.url += "&voiceBridge=" + (7000 + Math.floor(Math.random() * 10000) - 1)

  routes.createBase req, res, (meeting) ->
    newUrl = BigBlueButton.formatBBBUrl(req.url, meeting.server)
    opt =
      url: newUrl
      timeout: config.lb.requestTimeout

    request opt, (error, response, body) ->
      if error
        Logger.log "error proxying the request: " + error
      else
        Logger.log "got the response from BBB, sending it to the user."
        Utils.copyHeaders response, res
        if BigBlueButton.isSuccessfulResponse(body)
          res.send body.match(/<meetingID>(.*)<\/meetingID>/)[1]
        else
          msg = "Error " + body.match(/<messageKey>(.*)<\/messageKey>/)[1].trim()
          msg += ": " + body.match(/<message>(.*)<\/message>/)[1].trim()
          res.send msg

# Treats the action `join`.
# TODO: this method wasn't tested yet
exports.join = (req, res) ->
  urlObj = url.parse(req.url, true)

  routes.basicHandler req, res, (meeting) ->
    if not urlObj.query["fullName"]? or not urlObj.query["password"]?
      exports.sendDefaultError req, res

    joinUrl = BigBlueButton.formatBBBUrl(req.url, meeting.server)
    enterUrl = meeting.server.url + config.bbb.apiPath + "/enter"

    Logger.log "JOIN URL " + joinUrl
    Logger.log "ENTER URL " + enterUrl

    opt =
      url: joinUrl
      timeout: config.lb.requestTimeout
    request opt, (joinError, joinRes, joinBody) ->
      if joinError
        exports.sendDefaultError req, res
      else
        #console.log('JOIN BODY');
        #console.log(joinBody);

        opt =
          url: enterUrl
          timeout: config.lb.requestTimeout

        request opt, (enterError, enterRes, enterBody) ->
          if enterError
            exports.sendDefaultError req, res
          else
            console.log enterBody
            Utils.copyHeaders enterRes, res
            res.contentType "xm"
            res.send enterBody

# Calls `getMeetingInfo` for all `meetings`.
# TODO: this is not in lib/bigbluebutton because it is only used for the
#       mobile client and might be removed in the future
exports.sendGetMeetingInfoToAll = (meetings, afterEach, afterAll) ->
  received = 0
  count = meetings.length

  # Send a getMeetingInfo to all `meetings`
  for id of meetings
    request = config.bbb.apiPath + "/getMeetingInfo?"
    request += "meetingID=" + escape(meetings[id].id)
    request += "&password=" + escape(meetings[id].password)
    Utils.requestToServer request, meetings[id].server, (error, response, body, server) ->
      received++
      afterEach error, body, server
      if received is count
        afterAll received

# Receives an array with responses from `getMeetingInfo` calls
# and generates a response with all the meetings available.
# TODO: this is not in lib/bigbluebutton because it is only used for the
#       mobile client and might be removed in the future
exports.concatenateGetMeetingInfo = (responses) ->
  responseMatcher = new RegExp("<response>(.*)</response>")
  xml = "<meetings>"
  for id of responses
    match = responses[id].match(responseMatcher)
    if match? and match[1]?
      xml += "<meeting>" + match[1] + "</meeting>"
  xml += "</meetings>"
  xml
