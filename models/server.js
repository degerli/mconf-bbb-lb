var Logger = require('../lib/logger')
  , Service = require('./service')
  , config = require('../config');

var db = {};

var Server = exports = module.exports = function Server(name, url, salt) {
  this.name = name;
  this.url = url;
  this.salt = salt;
  this.services = {};
};

Server.prototype.saveSync = function(){
  db[this.name] = this;
  return db[this.name];
};

Server.prototype.destroySync = function(){
  return exports.destroySync(this.name);
};

Server.prototype.updateServiceSync = function(name, data){
  service = this.services[name];
  if (service == undefined) {
    service = new Service(name, data);
  }
  this.services[name] = service;
  return service;
};

// Get the number of meetings in the server from the BBB service
Server.prototype.getMeetingCountSync = function() {
  var service = this.services[config.nagios.bbbService]
    , count = -1; // -1 disables this server

  if (service != undefined) {
    try {
      count = service.getIntSync('meetings');
    } catch (e) {
      Logger.error('server ' + this.name + ', getting the number of meetings from: "' + service.data + '"')
    }
  }

  return count;
}

// Inc the number of meetings described in the BBB service
Server.prototype.incMeetingCountSync = function(value) {
  var service = this.services[config.nagios.bbbService]
    , count = 0;

  if (service != undefined) {
    try {
      count = service.getIntSync('meetings');
      service.setIntSync('meetings', count + 1);
    } catch (e) {
      Logger.error('server ' + this.name + ', setting the number of meetings in: "' + service.data + '"')
    }
  }
}

Server.countSync = function(){
  return Object.keys(db).length;
};

Server.getSync = function(id){
  return db[id];
};

Server.firstSync = function(){
  var keys = Object.keys(db);
  if (keys.length > 0) {
    return db[keys[0]];
  } else {
    return undefined;
  }
};

Server.allSync = function(){
  var arr = Object.keys(db).reduce(function(arr, id){
    arr.push(db[id]);
    return arr;
  }, []);
  return arr;
};

Server.destroySync = function(id){
  if (db[id]) {
    delete db[id];
    return true;
  } else {
    return false;
  }
};

Server.clearSync = function(){
  for (var id in db) {
    item = db[id];
    delete item;
  }
  db = {};
};
