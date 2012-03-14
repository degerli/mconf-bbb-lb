var express = require('express')
  , routes = require('./routes')
  , Meeting = require('./models/meeting')
  , config = require('./config')
  , Nagios = require('./lib/nagios')
  , Logger = require('./lib/logger');

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));

  // tries to load seed data from a file
  Meeting.fromJson('.data.json');
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Start the integration with nagios
Nagios.startup(function(error) {
  if (error) {
    Logger.log('error getting the data from Nagios, starting won\' populate the meetings db');
  } else {
    BigBlueButton.populateMeetings();
  }
});

// Routes
app.all('*', function(req, res, next){ // simple request logger
  Logger.log('request to ' + req.url);
  next();
});
app.get('/', routes.index);
app.get(config.bbb.apiPath, routes.apiIndex);
app.all(config.bbb.apiPath + '/*', function(req, res, next){ // checksum checker
  if (routes.validateChecksum(req, res)) {
    next();
  }
});
app.get(config.bbb.apiPath + '/create', routes.create);
app.get(config.bbb.apiPath + '/join', routes.join);
app.get(config.bbb.apiPath + '/getMeetings', routes.getMeetings);
app.get(config.bbb.apiPath + '/*', routes.anything); // any other api method
// TODO: treat getRecordings

app.listen(config.lb.port);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
