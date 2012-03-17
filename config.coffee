# # Global configurations file
# See config_local.coffee for private configurations.
# TODO: might be better to make this a json file

# First check if the local config file exists
fs = require("fs")
try
  fs.statSync "./config_local.coffee"
catch e
  console.log "ERROR: You don't have a config_local.js file. Aborting."
  console.log "       Create it with \"cp config_local.coffee.example config_local.coffee\""
  process.exit 1

config = require("./config_local")

# ## Load balancer configs
config.lb.port = 3000
config.lb.proxy = true
config.lb.requestTimeout = 10000 # max wait = 10sec

# ## Nagios module configs
config.nagios = config.nagios or {}
config.nagios.apiPath = "/cgi-bin/status-json.cgi"
config.nagios.auth = "HTTPBasic" # set to null for no auth
config.nagios.interval = 2000000 # in ms
config.nagios.defaultServer = "mconf.org"
config.nagios.bbbService = "BigBlueButton Info"
config.nagios.services = [ "BigBlueButton Info", "Network Report", "Processor Report", "Memory Report" ]

# ## BigBlueButton module configs
config.bbb = config.bbb or {}
config.bbb.apiPath = "/bigbluebutton/api"
config.bbb.responses = {}
config.bbb.responses.checksumError =
  "<response> \
     <returncode>FAILED</returncode> \
     <messageKey>checksumError</messageKey> \
     <message>You did not pass the checksum security check</message> \
   </response>"
config.bbb.responses.apiIndex =
   "<response> \
      <returncode>SUCCESS</returncode> \
      <version>0.8</version> \
      <name>mconf-bbb-lb</name> \
    </response>"
config.bbb.responses.invalidMeeting = # only used when there are no servers registered
  "<response> \
     <returncode>FAILED</returncode> \
     <messageKey>invalidMeetingIdentifier</messageKey> \
     <message>The meeting ID that you supplied did not match any existing meetings</message> \
   </response>"

# ## Mobile module configs
config.bbb.mobile = {}
config.bbb.mobile.path = "/demo/mobile.jsp"
config.bbb.mobile.timestamp = null
config.bbb.mobile.responses = {}
config.bbb.mobile.responses.getTimestamp =
  "<response> \
     <returncode>SUCCESS</returncode> \
     <timestamp>%%TIMESTAMP%%</timestamp> \
   </response>"
config.bbb.mobile.responses.timestampError =
  "<meetings> \
     <meeting> \
       <returncode>FAILED</returncode> \
     </meeting> \
   </meetings>"
config.bbb.mobile.responses.defaultError = config.bbb.mobile.responses.timestampError

# for reference, in case we need process.env in the future:
# config.twitter.user_name = process.env.TWITTER_USER or 'username'

module.exports = config
