# TODO: document the methods and args, specially those with callbacks

BigBlueButton = require("./lib/bigbluebutton")
Logger = require("./lib/logger")
Meeting = require("./models/meeting")
Nagios = require("./lib/nagios")
config = require("./config")
express = require("express")
routes = require("./routes/index")
routesMobile = require("./routes/mobile")

app = module.exports = express.createServer()

app.configure ->
  app.set "views", __dirname + "/views"
  app.set "view engine", "jade"
  app.use express.bodyParser()
  app.use express.methodOverride()
  app.use app.router
  app.use express.static(__dirname + "/public")

app.configure "development", ->
  app.use express.errorHandler
    dumpExceptions: true
    showStack: true

  # Tries to load development seed data from a file
  Meeting.fromJsonSync ".data.json"

app.configure "production", ->
  app.use express.errorHandler()

# Start the integration with nagios
Nagios.startup BigBlueButton.nagiosCallback

# Simple request logger
app.get "*", (req, res, next) ->
  Logger.log "request to " + req.url
  next()

# Overall index
app.get "/", routes.index

# Mobile routes
app.get config.bbb.mobile.path, (req, res, next) ->
  next() if routesMobile.validateMobileChecksum(req, res)
app.get config.bbb.mobile.path, routesMobile.index

# Normal api routes
app.get config.bbb.apiPath, routes.apiIndex
app.get config.bbb.apiPath + "/*", (req, res, next) ->
  next() if routes.validateChecksum(req, res)
app.get config.bbb.apiPath + "/create", routes.create
app.get config.bbb.apiPath + "/join", routes.join
app.get config.bbb.apiPath + "/end", routes.end
app.get config.bbb.apiPath + "/getMeetings", routes.getMeetings
app.get config.bbb.apiPath + "/*", routes.anything
# TODO: treat getRecordings

app.listen config.lb.port
console.log "Express server listening on port %d in %s mode", app.address().port, app.settings.env
