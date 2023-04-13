'use strict';
const { MapDB } = require('../mapdb');

const mdb = new MapDB();

const connections = mdb.createTable('connections', {
  fields: { messages: { hasMany: 'messages', fhField: 'connection' } },
});

const message_status = mdb.createTable('message_status', {
  fields: {
    status: { id: true },
    messages: { hasMany: 'messages', fhField: 'status' },
  },
});

const messages = mdb.createTable('messages', {
  fields: {
    connection: { hasOne: 'connections', fhField: 'messages' },
    status: { hasOne: 'message_status', fhField: 'messages' },
  },
});

message_status.insert({ status: 'new' });

const mdbws = connections.insert({ ws: 'ok' });

//console.log(connections);

const msg = messages.insert({
  data: JSON.parse('{}'),
  connection: mdbws,
  status: message_status.get('new'),
});

//TODO Asserts of this logs
/*console.log(msg);
console.log(mdbws.messages_data);
console.log(message_status.get('new'));
console.log(message_status.get('new').messages_data);
*/
