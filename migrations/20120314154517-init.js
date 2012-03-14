var dbm = require('db-migrate');
var type = dbm.dataType;

exports.up = function(db, callback) {
  db.createTable('servers', {
    id: { type: 'int', primaryKey: true },
    name: 'string',
    url: 'string',
    salt: 'string',
    services: 'string'
  }, createMeetings);

  function createMeetings(err) {
    if (err) { callback(err); return; }
    db.createTable('meetings', {
      id: { type: 'int', primaryKey: true },
      server_id: 'int',
      meeting_id: 'string'
    }, callback);
  }
};

exports.down = function(db, callback) {
  db.dropTable('servers', function(err) {
    if (err) { callback(err); return; }
    db.dropTable('meetings', callback);
  })
};
