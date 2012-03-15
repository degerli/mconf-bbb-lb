// NOTE: See config_local.js for local private configurations.
var config = require('./config_local');

config.lb.port = 3000;
config.lb.proxy = true;

config.nagios = config.nagios || {};
config.nagios.url = 'http://143.54.12.174/nagios';
config.nagios.apiPath = '/cgi-bin/status-json.cgi';
config.nagios.auth = 'HTTPBasic'; // set to null for no auth
config.nagios.interval = 2000000; // in ms
config.nagios.defaultServer = 'mconf.org';
config.nagios.bbbService = 'BigBlueButton Info';
config.nagios.services = [ 'BigBlueButton Info', 'Network Report',
                           'Processor Report', 'Memory Report' ];

config.bbb = config.bbb || {};
config.bbb.apiPath = '/bigbluebutton/api';
config.bbb.responses = {}
config.bbb.responses.checksumError =
  '<response> \
     <returncode>FAILED</returncode> \
     <messageKey>checksumError</messageKey> \
     <message>You did not pass the checksum security check</message> \
   </response>';
config.bbb.responses.apiIndex =
   '<response> \
      <returncode>SUCCESS</returncode> \
      <version>0.8</version> \
      <name>mconf-bbb-lb</name> \
    </response>';
config.bbb.responses.invalidMeeting = // only used when there are no servers registered
  '<response> \
     <returncode>FAILED</returncode> \
     <messageKey>invalidMeetingIdentifier</messageKey> \
     <message>The meeting ID that you supplied did not match any existing meetings</message> \
   </response>';

config.bbb.mobile = {};
config.bbb.mobile.path = '/demo/mobile.jsp';
config.bbb.mobile.timestamp = null;
config.bbb.mobile.responses = {};
config.bbb.mobile.responses.getTimestamp =
  '<response> \
     <returncode>SUCCESS</returncode> \
     <timestamp>%%TIMESTAMP%%</timestamp> \
   </response>';
config.bbb.mobile.responses.timestampError =
  '<meetings> \
     <meeting> \
       <returncode>FAILED</returncode> \
     </meeting> \
   </meetings>';

"<meetings><meeting><returncode>FAILED</returncode></meeting></meetings>"

// for reference, in case we need process.env in the future:
// config.twitter.user_name = process.env.TWITTER_USER || 'username';

module.exports = config;
