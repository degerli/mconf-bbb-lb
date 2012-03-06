// NOTE: See config_local.js for local private configurations.
var config = require('./config_local');

config.bbb = config.bbb || {};
config.bbb.api_path = '/bigbluebutton/api';

config.nagios = config.nagios || {};
config.nagios.url = 'http://143.54.12.174/nagios';
config.nagios.api_path = '/cgi-bin/status-json.cgi';
config.nagios.auth = 'HTTPBasic'; // set to null for no auth
config.nagios.interval = 20000; // in ms
config.nagios.services = [ 'BigBlueButton Info', 'Network Report',
                           'Processor Report', 'Memory Report' ];

// for reference, in case we need process.env in the future:
// config.twitter.user_name = process.env.TWITTER_USER || 'username';

module.exports = config;
