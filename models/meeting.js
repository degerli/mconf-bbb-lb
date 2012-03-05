var fs = require('fs')
  , Server = require('./server');

// TODO: Temporary data store
var db = {};

var Meeting = exports = module.exports = function Meeting(id, server) {
  this.id = id;
  this.server = server;
};

Meeting.prototype.save = function(fn){
  db[this.id] = this;
  if (fn) fn();
};

Meeting.prototype.destroy = function(fn){
  exports.destroy(this.id, fn);
};

Meeting.count = function(fn){
  fn(null, Object.keys(db).length);
};

Meeting.get = function(id, fn){
  fn(null, db[id]);
};

Meeting.all = function(fn){
  var arr = Object.keys(db).reduce(function(arr, id){
    arr.push(db[id]);
    return arr;
  }, []);
  fn(null, arr);
};

Meeting.destroy = function(id, fn){
  if (db[id]) {
    delete db[id];
    fn();
  } else {
    fn(new Error('meeting ' + id + ' does not exist'));
  }
};

// Loads a json into the local database
// For DEVELOPMENT only
Meeting.fromJson = function(path){
  try {
    var fileContents = fs.readFileSync(path, 'utf8');
    var json = JSON.parse(fileContents);
    for(var idx in json){
      var s = new Server(json[idx].server.url, json[idx].server.salt);
      var m = new Meeting(json[idx].id, s);
      m.save();
    }

    console.log('Loaded data from ' + path);
    console.log('Meetings: ' + JSON.stringify(db));
  } catch (e) { }
}
