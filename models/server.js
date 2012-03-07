var Service = require('./service')
  , Logger = require('../lib/logger');

// TODO: Temporary data store
var db = {};

var Server = exports = module.exports = function Server(name, url, salt) {
  this.id = name;
  this.url = url;
  this.salt = salt;
  this.services = {};
};

Server.prototype.save = function(fn){
  db[this.id] = this;
  if (fn) fn();
};

Server.prototype.destroy = function(fn){
  exports.destroy(this.id, fn);
};

Server.prototype.updateService = function(name, data, fn){
  service = this.services[name];
  if (service == undefined) {
    service = new Service(name, data);
  }
  this.services[name] = service;
  if (fn) fn(null, service);
};

// Get the number of meetings in the server from one of its
// services
Server.prototype.getMeetingCount = function() {
  var service = this.services['BigBlueButton Info']
    , count = 0;

  if (service != undefined) {
    try {
      // ex: "meetings=2;5;10;0; ..."
      count = parseInt(service.data.match(/meetings=(\d+);/)[1]);
    } catch (e) {
      Logger.log('ERROR getting the number of meetings from: ' + service.data)
    }
  }

  return count;
}

Server.count = function(fn){
  fn(null, Object.keys(db).length);
};

Server.get = function(id, fn){
  fn(null, db[id]);
};

Server.all = function(fn){
  var arr = Object.keys(db).reduce(function(arr, id){
    arr.push(db[id]);
    return arr;
  }, []);
  fn(null, arr);
};

Server.destroy = function(id, fn){
  if (db[id]) {
    delete db[id];
    fn();
  } else {
    fn(new Error('server ' + id + ' does not exist'));
  }
};

Server.clear = function(fn){
  for (var id in db) {
    item = db[id];
    delete item;
  }
  db = {};
  if (fn) fn();
};
