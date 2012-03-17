# # Router module

BigBlueButton = require("../lib/bigbluebutton")
LoadBalancer = require("../lib/load_balancer")
Logger = require("../lib/logger")
Meeting = require("../models/meeting")
Nagios = require("../lib/nagios")
Server = require("../models/server")
Utils = require("../lib/utils")
config = require("../config")
request = require("request")
url = require("url")

# ## Helpers

# Basic handler that tries to find the meeting using the meetingID provided
# in the request and checks the checksum. If the meeting is not found or the
# checksum is incorrect it responds with an error.
# Otherwise it calls the callback 'fn'.
exports.basicHandler = (req, res, fn) ->
  urlObj = url.parse(req.url, true)
  m_id = urlObj.query["meetingID"]
  Logger.log urlObj.pathname + " request with: " + JSON.stringify(urlObj.query), m_id

  meeting = Meeting.getSync(m_id)
  unless meeting
    Logger.log "failed to find meeting", m_id

    server = LoadBalancer.defaultServer()
    if server?
      Logger.log "redirecting to the default server " + server.name, m_id
      LoadBalancer.handle req, res, server
    else
      Logger.log "there's no default server, sending an invalidMeeting response", m_id
      res.contentType "xml"
      res.send config.bbb.responses.invalidMeeting
    return false

  fn meeting


# ## Routes handlers

# General index
exports.index = (req, res) ->
  res.render "index",
    title: "Mconf - BigBlueButton Load Balancer"

# BigBlueButton api index
exports.apiIndex = (req, res) ->
  res.contentType "xml"
  res.send config.bbb.responses.apiIndex

# Validates the checksum in the request 'req'.
# If it doesn't match the expected checksum, we'll send
# an XML response with an error code just like BBB does and
# return false. Returns true if the checksum matches.
exports.validateChecksum = (req, res) ->
  urlObj = url.parse(req.url, true)
  checksum = urlObj.query["checksum"]

  # matches the checksum in the url with the expected checksum
  unless checksum is BigBlueButton.checksum(req.url, config.lb.salt, true)
    Logger.log "checksum check failed, sending a checksumError response"
    res.contentType "xml"
    res.send config.bbb.responses.checksumError
    false
  else
    true

# Base method used to create a new meeting
# TODO: This exists only because of the mobile client, see routes/mobile.create
exports.createBase = (req, res, callback) ->
  urlObj = url.parse(req.url, true)
  m_id = urlObj.query["meetingID"]
  Logger.log urlObj.pathname + " request with: " + JSON.stringify(urlObj.query), m_id

  unless m_id?
    Logger.log "meetingID was not defined, forwarding call to BBB to get the error response"
    LoadBalancer.handle req, res, LoadBalancer.defaultServer()
    return

  # If the meeting is not registered yet
  meeting = Meeting.getSync(m_id)
  unless meeting
    Logger.log "failed to load meeting", m_id
    server = LoadBalancer.selectServer()
    meeting = new Meeting(m_id, server)

  Logger.log "successfully loaded meeting", m_id
  Logger.log "server selected " + meeting.server.url, m_id
  callback meeting

# Routing a 'create' request
exports.create = (req, res, whenReady) ->
  exports.createBase req, res, (meeting) ->
    LoadBalancer.handle req, res, meeting.server, null, (useProxy, body) ->
      # If not proxying, we assume the meeting was created, otherwise check the response
      if not useProxy or BigBlueButton.isSuccessfulResponse(body)
        meeting.saveSync()

# Routing a 'join' request
exports.join = (req, res) ->
  exports.basicHandler req, res, (meeting) ->
    LoadBalancer.handle req, res, meeting.server, false

# Routing a 'end' request
exports.end = (req, res) ->
  exports.basicHandler req, res, (meeting) ->
    LoadBalancer.handle req, res, meeting.server, null, (useProxy, body) ->
      # If not proxying, we assume the meeting was ended, otherwise check the response
      if not useProxy or BigBlueButton.isSuccessfulResponse(body)
        meeting.destroySync()

# Routing a 'getMeetings' request
# TODO: this replicates some code from BigBlueButton.repopulateMeetings()
exports.getMeetings = (req, res) ->
  meetings = []
  responses = []

  # Send a getMeetings to all registered servers and concatenate the responses
  # Since we're getting the list of meetings, we'll also update the meetings db
  BigBlueButton.sendGetMeetingsToAll (error, body, server) ->
    if error
      Logger.log "error calling getMeetings to " + server.name + ": " + error
      responses.push null
      meetings.push null
    else
      Logger.log "got response to getMeetings from " + server.name
      responses.push body
      meetings.push BigBlueButton.meetingsFromGetMeetings(body, server)

  , (total) ->
    # First update the meetings db
    Utils.updateMeetings Utils.flatten(meetings)
    # And send the response to the user
    xml = BigBlueButton.concatenateGetMeetings(responses)
    res.contentType "xml"
    res.send xml

# Routing any request that simply needs to be passed to a BBB server
exports.anything = (req, res) ->
  exports.basicHandler req, res, (meeting) ->
    LoadBalancer.handle req, res, meeting.server
