var config = require('../config')
  , persist = require("persist")
  , type = persist.type;

var Database = exports;

Database.startup = function(){

  var persist = require("persist");
  var type = persist.type;

  // Meeting = persist.define("Meeting", {
  //   "meetingId": type.STRING
  // });

  // Server = persist.define("Server", {
  //   "name": type.STRING,
  //   "url": type.STRING,
  //   "salt": type.STRING,
  //   "services": type.STRING
  // }).hasMany(Meeting);

  persist.connect(function(err, connection) {
    config.db.connection = connection;
  });

  // persist.connect(function(err, connection) {
  //   Server.using(connection).all(function(err, servers) {
  //     console.log("**** ALL SERVERS " + JSON.stringify(servers));
  //     console.log("**** 2 ERR " + err);
  //     if (servers[0]) {

  //       servers[0].meetings.all(function(err, phones) {
  //         console.log("**** ALL MEETINGS FIRST SERVER " + JSON.stringify(phones));
  //       });

  //     }

  //   Meeting.using(connection).all(function(err, meetings) {
  //     console.log("**** ALL MEETINGS " + JSON.stringify(meetings));
  //     if (meetings[0]) {
  //       meetings[0].server.first(function(err, sss) {
  //         console.log("**** SERVER FOR FIRST MEETING " + JSON.stringify(sss));
  //       });
  //     }
  //     console.log("**** 2 ERR " + err);
  //   });

  //   });

  //   var s1 = new Server();
  //   s1.name = 'mconf.org';
  //   s1.url = 'http://mconf.org:8888';
  //   s1.salt = '1231231231231231'
  //   s1.services = '{"123":"123"}';
  //   s1.save(connection, function(err) {
  //     console.log("**** SAVED SERVER " + JSON.stringify(s1));
  //     console.log("**** SAVE ERR " + err);

  //     var p1 = new Meeting();
  //     p1.meetingId = 'meeeet';
  //     console.log('SERVER ID ' + s1.id);
  //     p1._server = s1;
  //     p1.save(connection, function(err) {
  //       console.log("**** SAVING MEETING " + JSON.stringify(p1));
  //       console.log("**** SAVE ERR " + err);
  //     });

  //   });

  // });

}