# # BigBlueButton module
# Things that require in-depth knowledge of how BigBlueButton works
# should be here. Such as parsing XML responses.

Logger = require("./logger")
Meeting = require("../models/meeting")
Server = require("../models/server")
Utils = require("./utils")
config = require("../config")
sha1 = require("sha1")
url = require("url")
xml2js = require("xml2js")

BigBlueButton = exports

# Calculates the checksum given a url 'fullUrl' and a 'salt'
# 'incoming' should be true if the checksum is to match an incoming
# message. 'mobile' should be true if the checksum is for a mobile request.
BigBlueButton.checksum = (fullUrl, salt, incoming, mobile) ->

  # Parse the url and remove the old checksum
  urlObj = url.parse(fullUrl, true)
  Utils.removeParamFromUrl urlObj, "checksum"

  # Get the expected checksum
  query = Utils.bbbQueryFromUrl(urlObj)
  if incoming? and incoming
    # Note: the url query is already escaped, however BBB expects a ' ' to
    # be encoded as '+', but any ' ' or '+' in the query are replaced by
    # '%20' in the 'url.parse()' call above
    # so when we're sending a call to BBB, we encode it using '%20', but
    # when we are receiving a call (incoming), we should expect that the
    # salt was calculated using '+' where we have '%20's
    query = query.replace(/%20/g, "+")

  if mobile? and mobile
    checksum = sha1(query + salt)
  else
    method = Utils.bbbMethodFromUrl(urlObj)
    checksum = sha1(method + query + salt)
  checksum

# Receives an array with responses from getMeetings calls
# and generates a response with all the meetings available
# FIXME: maybe we should prevent duplicated meeting ids?
BigBlueButton.concatenateGetMeetings = (responses) ->
  selected = null
  meetingList = []

  # At first we'll select one of the responses to be used
  # as a base for our response and create an array with
  # all meetings found in the responses
  for id of responses
    response = responses[id]

    # If the response has meetings, select it as the base for our response
    hasMeetings = response.match(/<meetings>(.*)<\/meetings>/)
    if hasMeetings?
      selected = response
      meetingList.push hasMeetings[1]

    # If the response has no meetings, but was successful, select it
    # for now. if we're at the last response and there's none selected,
    # select it even if it's an error response
    if not selected? and (BigBlueButton.isSuccessfulResponse(response) or id is responses.length - 1)
      selected = response

  # If there's at least 1 meeting, we add it to our selected response
  if meetingList.length > 0
    meetingStr = "<meetings>" + meetingList.join("") + "</meetings>"
    selected = selected.replace(/<meetings>.*<\/meetings>/, meetingStr)

  selected

# Method used as a callback for when the module nagios updates the
# list of servers
BigBlueButton.nagiosCallback = (error) ->
  if error
    Logger.log "error getting the servers from Nagios, will not modify the meetings db"
  else
    Logger.log "repopulating the meetings db"
    BigBlueButton.repopulateMeetings()

# Sends a 'getMeetings' request to all registered servers and use the responses
# to create the database of meetings
# FIXME: if there are meetings with duplicated meetingID's, the last one parsed
#        will be the one used, the others are ignored
BigBlueButton.repopulateMeetings = ->
  meetings = []

  BigBlueButton.sendGetMeetingsToAll (error, body, server) ->
    if error
      Logger.log "error calling getMeetings to " + server.name + ": " + error
      meetings.push null
    else
      # Get the meetings in the XML and push to an array
      meetings.push BigBlueButton.meetingsFromGetMeetings(body, server)

      Logger.log "got response to getMeeting from " + server.name
      unless BigBlueButton.isSuccessfulResponse(body)
        Logger.log "got error in the response:"
        Logger.log body

  , (total) ->
    # After we've got all the responses, replace the meetings db and print them
    Utils.updateMeetings Utils.flatten(meetings)

# Parses the XML in 'data' (result from 'getMeetings') and returns an array
# of Meeting's with the meetings in the XML
BigBlueButton.meetingsFromGetMeetings = (data, server) ->
  result = []
  parser = new xml2js.Parser()

  parser.parseString data, (error, parsed) ->
    if error
      Logger.log "error parsing the result of getMeetings: " + data
    else
      if parsed["meetings"]?
        meetings = parsed["meetings"]["meeting"]
        if meetings?

          # When there's 1 meeting, BBB returns an object
          # with >1 meetings it is an array
          if Utils.realTypeOf(meetings) is "Array"
            for id of meetings
              meeting = new Meeting(meetings[id]["meetingID"], server, meetings[id]["moderatorPW"])
              result.push meeting
          else
            meeting = new Meeting(meetings["meetingID"], server, meetings["moderatorPW"])
            result.push meeting

  result

# Gets an url in 'originalUrl' and formats it to be sent to a BBB server
# 'originalUrl' in the format '/bigbluebutton/api/getMeetings?random=123...'
BigBlueButton.formatBBBUrl = (originalUrl, server) ->
  # Parse the url and change the checksum
  urlObj = url.parse(originalUrl, true)
  Utils.removeParamFromUrl urlObj, "checksum"
  urlObj.query["checksum"] = BigBlueButton.checksum(originalUrl, server.salt)

  server.url + url.format(urlObj)

# Returns whether an XML response from a BBB server is successful or not
BigBlueButton.isSuccessfulResponse = (body) ->
  body.match /<returncode>SUCCESS/

# Sends a 'getMeetings' to all servers registered
# Calls 'afterEach' after each response and 'afterAll' after all responses
# are received (or after they timed-out)
# TODO: check what happens if one connection times out
BigBlueButton.sendGetMeetingsToAll = (afterEach, afterAll) ->
  received = 0
  servers = Server.allSync()

  for id of servers
    rand = Math.floor(Math.random() * 10000000000) # BBB 0.7 needs it
    request = config.bbb.apiPath + "/getMeetings?random=" + rand
    Utils.requestToServer request, servers[id], (error, response, body, server) ->
      received++
      afterEach error, body, server
      afterAll received  if received is servers.length
