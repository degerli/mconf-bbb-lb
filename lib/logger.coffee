fs = require("fs")
Log = require("log")
log = new Log("debug", fs.createWriteStream("debug.log"))

Logger = exports

Logger.info = (msg, id) ->
  Logger.log msg, id

Logger.log = (msg, id) ->
  msg = Logger.format(msg, id)
  console.log msg
  log.info msg

Logger.debug = (msg, id) ->
  msg = Logger.format(msg, id)
  console.log msg
  log.debug msg

Logger.error = (msg, id) ->
  msg = Logger.format(msg, id)
  console.log "ERROR: " + msg
  log.error msg

Logger.format = (msg, id) ->
  if id
    "[" + id + "] " + msg
  else
    "[-] " + msg
