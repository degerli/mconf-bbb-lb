Logger = require("../lib/logger")
Server = require("../models/server")
Utils = require("../lib/utils")
config = require("../config")
request = require("request")

Nagios = exports

callback = null
intervalId = null

# Start working already!
# The 'callback' function will be called whenever the list of meetings is updated
Nagios.startup = (callback) ->
  Logger.log "nagios integration at: " + config.nagios.url + config.nagios.apiPath
  Nagios.callback = callback
  Nagios.updateServers()
  intervalId = setInterval(Nagios.updateServers, config.nagios.interval)

# Fetches the list of servers from Nagios and updates the db in Server
Nagios.updateServers = ->
  opt =
    url: config.nagios.url + config.nagios.apiPath
    timeout: config.lb.requestTimeout

  if config.nagios.auth is "HTTPBasic"
    unameAndPass = config.nagios.username + ":" + config.nagios.password
    opt.headers = Authorization: "Basic " + new Buffer(unameAndPass).toString("base64")

  Logger.log "requesting the list of servers to nagios: " + opt.url
  request opt, (error, response, body) ->
    if error
      Logger.log "error getting data from nagios: " + error
    else
      if response.statusCode is 200
        Logger.log "got the server list back from nagios"
        servers = Nagios.parseServers(body)
        Nagios.validateServers servers

        # Replace the current db with the list from nagios
        Server.clearSync()
        Logger.log "current list of servers registered:"
        for id of servers
          servers[id].saveSync()
          Logger.log JSON.stringify(servers[id])
      else
        Logger.log "wrong status code getting data from nagios: " + response.statusCode

    Nagios.callback error if Nagios.callback

# Parse the json received from Nagios
Nagios.parseServers = (data) ->
  servers = {} # temp list of servers

  Logger.log "parsing the servers to update the db"
  json = JSON.parse(data)

  for id of json["services"]
    node = json["services"][id]

    if Nagios.isValidServiceNode(node)
      s = {}
      notes = Utils.unescapeEntities(node["service_host"]["host_notes"]).split(" ")

      # Only parse the node if the host is UP
      # from nagios: "int host_status_types=HOST_PENDING|HOST_UP|HOST_DOWN|HOST_UNREACHABLE;"
      if node["service_host"]["host_status"] is 2
        s.name = Utils.unescapeEntities(node["service_description"])
        s.data = Utils.unescapeEntities(node["service_performance_data"])
        s.hostname = Utils.unescapeEntities(node["service_host"]["host_address"])
        s.hostsalt = notes[1]
        # We want the "protocol://host:port" part only
        s.hosturl = Utils.gsub(notes[0], "[/]?bigbluebutton[/]?", "")
        Logger.log "parsed: " + JSON.stringify(s)
        Nagios.addServerFromService s, servers

  servers

# Checks whether a json node from the response received from Nagios
# is a valid BigBlueButton or not
Nagios.isValidServiceNode = (node) ->
  node.hasOwnProperty("service_host") and
    node["service_host"].hasOwnProperty("host_notes") and
    node["service_host"]["host_notes"].split(" ").length is 2 and # has bbb url and salt in it
    config.nagios.services.indexOf(node["service_description"]) isnt -1 # is a tracked service

# Create a Server object with information from the given service
Nagios.addServerFromService = (service, servers) ->
  id = service.hostname
  servers[id] = new Server(service.hostname, service.hosturl, service.hostsalt)  if servers[id] is `undefined`
  servers[id].updateServiceSync service.name, service.data

# Validates 'servers' to remove any server that is not a BBB server
# or that is not running
Nagios.validateServers = (servers) ->
  server = undefined
  service = undefined
  for id of servers
    # for now any server with this service is considered a BBB server
    service = servers[id].services[config.nagios.bbbService]
    if not servers[id].services[config.nagios.bbbService]? or not service.data? or service.data.trim() is ""
      Logger.log "removing invalid server: " + servers[id].name
      delete servers[id]
