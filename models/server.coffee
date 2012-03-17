# # Model Server
# Has a class `Server` to represent BigBlueButton servers and a
# database (a simple in-memory object) to store the servers saved.

Logger = require("../lib/logger")
Service = require("./service")
config = require("../config")

# The database of servers.
db = {}

Server = exports = module.exports = Server = (name, url, salt) ->
  @name = name
  @url = url
  @salt = salt
  @services = {}
  this

Server::saveSync = ->
  db[@name] = this
  db[@name]

Server::destroySync = ->
  exports.destroySync @name

Server::updateServiceSync = (name, data) ->
  service = @services[name]
  service = new Service(name, data)  if service is `undefined`
  @services[name] = service
  service

# Get the number of meetings in the server from the BBB service.
Server::getMeetingCountSync = ->
  service = @services[config.nagios.bbbService]
  count = -1
  if service?
    try
      count = service.getIntSync("meetings")
    catch e
      Logger.error "server " + @name + ", getting the number of meetings from: \"" + service.data + "\""
  count

# Increment the number of meetings described in the BBB service.
Server::incMeetingCountSync = (value) ->
  service = @services[config.nagios.bbbService]
  count = 0
  if service?
    try
      count = service.getIntSync("meetings")
      service.setIntSync "meetings", count + 1
    catch e
      Logger.error "server " + @name + ", setting the number of meetings in: \"" + service.data + "\""

Server.countSync = ->
  Object.keys(db).length

Server.getSync = (id) ->
  db[id]

Server.firstSync = ->
  keys = Object.keys(db)
  if keys.length > 0
    db[keys[0]]
  else
    null

Server.allSync = ->
  arr = Object.keys(db).reduce((arr, id) ->
    arr.push db[id]
    arr
  , [])
  arr

Server.destroySync = (id) ->
  if db[id]
    delete db[id]
    true
  else
    false

Server.clearSync = ->
  for id of db
    item = db[id]
    delete item
  db = {}
