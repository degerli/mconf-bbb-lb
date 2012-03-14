var Server = require('./server')
  , fs = require('fs')
  , persist = require("persist")
  , type = persist.type;

Meeting = exports = module.exports = persist.define("Meeting", {
  "meetingId": type.STRING
});

Meeting.prototype.getByMeetingId = function(connection, id, callback){
  Meeting.where('meeting_id = ?', id).first(config.db.connection, function(err, meeting){
    callback(err, meeting);
  });
};

// Meeting.prototype.destroy = function(fn){
//   exports.destroy(this.id, fn);
// };

// Meeting.count = function(fn){
//   fn(null, Object.keys(db).length);
// };

// Meeting.get = function(id, fn){
//   fn(null, db[id]);
// };

// Meeting.all = function(fn){
//   var arr = Object.keys(db).reduce(function(arr, id){
//     arr.push(db[id]);
//     return arr;
//   }, []);
//   fn(null, arr);
// };

// Meeting.destroy = function(id, fn){
//   if (db[id]) {
//     delete db[id];
//     fn();
//   } else {
//     fn(new Error('meeting ' + id + ' does not exist'));
//   }
// };

// Loads a json into the local database
// For DEVELOPMENT only
// TODO: adapt to persist
Meeting.fromJson = function(path){
  try {
    var fileContents = fs.readFileSync(path, 'utf8');
    var json = JSON.parse(fileContents);
    for(var idx in json){
      var s = new Server(json[idx].server.url, json[idx].server.salt);
      var m = new Meeting(json[idx].id, s);
      m.save();
    }

    Logger.log('loaded data from ' + path);
    Logger.log('meetings loaded: ' + JSON.stringify(db));
  } catch (e) { }
}
