# # LoadBalancer module
# Responsible for balancing the requests.

BigBlueButton = require("../lib/bigbluebutton")
Logger = require("../lib/logger")
Server = require("../models/server")
Utils = require("../lib/utils")
config = require("../config")
request = require("request")
url = require("url")

LoadBalancer = exports

# Selects the adequate BigBlueButton server for a new meeting
# to be created
LoadBalancer.selectServer = ->
  count = -1
  newCount = 0
  s = null

  Logger.log "selecting a server for a new meeting"

  # For now we select the server with the lowest number of users connected
  servers = Server.allSync()
  selected = servers[0]
  for id of servers
    s = servers[id]
    newCount = s.getMeetingCountSync()

    unless newCount is -1 # -1 means disabled
      Logger.log "server " + s.name + " has " + newCount + " meetings"
      if newCount < count or count is -1
        selected = s
        count = newCount
    else
      Logger.log "server " + s.name + " is disabled"

  selected.incMeetingCountSync()
  Logger.log "server selected: " + selected.name + " with " + count + " meetings"
  Logger.log "server selected has now " + (count + 1) + " meetings"
  selected

# Returns the default server, used when we don't know in which server
# the meeting is in (usually resulting in an error message)
LoadBalancer.defaultServer = ->
  server = Server.getSync(config.nagios.defaultServer)
  if server?
    server
  else
    # If we don't find the default server, use the first one
    Server.firstSync()

# Handles a request `req` to the BigBlueButton `server`.
# If `useProxy`, the request will be 'proxied', otherwise it will respond with
# a redirect to the BigBluebutton server.
# Also, if `useProxy`, `beforeSend` will be called when we receive a response from BBB
# and before sending it to the user. If not `useProxy`, `beforeSend` is called
# before returning the redirect to the user. `beforeSend` parameters are:
#
# * `isProxy`: true if the request being proxied.
# * `data`: the data received from the BBB server (if any).
LoadBalancer.handle = (req, res, server, useProxy, beforeSend) ->
  Logger.log "handling the request to the server " + server.url
  newUrl = BigBlueButton.formatBBBUrl(req.url, server)

  # If not specified, use the default in the config
  useProxy = config.lb.proxy unless useProxy?
  if useProxy
    LoadBalancer.proxy res, newUrl, beforeSend
  else
    LoadBalancer.redirect res, newUrl, beforeSend

# Redirects a request to `destination` (a uri).
LoadBalancer.redirect = (res, destination, beforeSend) ->
  Logger.log "full redirect api call to " + destination
  beforeSend false, null if beforeSend?
  res.redirect destination

# Proxies a request to `destination` (a uri).
LoadBalancer.proxy = (res, destination, beforeSend) ->
  Logger.log "proxying api call to " + destination
  opt =
    url: destination
    timeout: config.lb.requestTimeout

  request opt, (error, response, body) ->
    if error
      Logger.log "error proxying the request: " + error
    else
      Logger.log "got the response from BBB, sending it to the user."

      # Copy the headers from BBB and send it back to the user
      Utils.copyHeaders response, res
      beforeSend true, body if beforeSend?
      res.send body
