fs = require("fs")
Server = require("./server")

db = {}

Meeting = exports = module.exports = Meeting = (id, server, password) ->
  @id = id
  @server = server
  # We only need this for the mobile client
  # See routes/mobile.sendGetMeetingInfoToAll()
  @password = password
  this

Meeting::saveSync = ->
  db[@id] = this
  db[@id]

Meeting::destroySync = ->
  exports.destroySync @id

Meeting.countSync = ->
  Object.keys(db).length

Meeting.getSync = (id) ->
  db[id]

Meeting.allSync = ->
  arr = Object.keys(db).reduce((arr, id) ->
    arr.push db[id]
    arr
  , [])
  arr

Meeting.destroySync = (id) ->
  if db[id]
    delete db[id]
    true
  else
    false

Meeting.clearSync = ->
  for id of db
    item = db[id]
    delete item
  db = {}

# Loads a json into the local database
# For DEVELOPMENT only
Meeting.fromJsonSync = (path) ->
  try
    fileContents = fs.readFileSync(path, "utf8")
    json = JSON.parse(fileContents)
    for idx of json
      s = new Server(json[idx].server.url, json[idx].server.salt)
      m = new Meeting(json[idx].id, s)
      m.saveSync()
    Logger.log "loaded data from " + path
    Logger.log "meetings loaded: " + JSON.stringify(db)
