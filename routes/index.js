var url = require('url')
  , Meeting = require('../models/meeting')
  , Nagios = require('../models/nagios')
  , LoadBalancer = require('../models/load_balancer')
  , Logger = require('../lib/logger');

exports.index = function(req, res){
  res.render('index', { title: 'Mconf - BigBlueButton Load Balancer' })
};

exports.api_index = function(req, res){
  res.render('index', { title: 'Mconf - BigBlueButton Load Balancer - Api Index' })
};

exports.create = function(req, res){
  urlObj = url.parse(req.url, true);
  var m_id = urlObj.query['meetingID'];
  Logger.log(urlObj.pathname + ' request with: ' + JSON.stringify(urlObj.query), m_id);

  Meeting.get(m_id, function(err, meeting){

    // the meeting is not being proxied yet
    if (!meeting) {
      Logger.log('failed to load meeting', m_id);

      var servers = Nagios.get_servers();
      var server = LoadBalancer.select_server(servers);
      meeting = new Meeting(m_id, server);
      meeting.save();
    }

    Logger.log('successfully loadded meeting', m_id);
    Logger.log('server selected ' + meeting.server.url, m_id);

    LoadBalancer.redirect(req, res, meeting.server);
  });
};

exports.redirect = function(req, res){
  urlObj = url.parse(req.url, true);
  var m_id = urlObj.query['meetingID'];
  Logger.log(urlObj.pathname + ' request with: ' + JSON.stringify(urlObj.query), m_id);

  Meeting.get(m_id, function(err, meeting){
    if (!meeting) {
      Logger.log('failed to load meeting', m_id);
      // TODO: better response, xml, maybe simulate a BBB default error response
      res.send('This meeting was not created using this load balancer');
    }

    LoadBalancer.redirect(req, res, meeting.server);
  });
};
