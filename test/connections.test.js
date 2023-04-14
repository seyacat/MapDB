'use strict';
const { MapDB } = require('../mapdb');
const chai = require('chai');
const assert = require('assert');

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

messages.onAny(function (ob) {
  //console.log(ob);
  it('Test onAny', function () {
    assert.equal(!!ob, true);
  });
});

messages.onInsert(function (ob) {
  //console.log(ob);
  it('Test onInsert', function () {
    assert.equal(!!ob, true);
  });
});

messages.onChange(function (ob) {
  //console.log(ob);
  it('Test onChange', function () {
    assert.equal(!!ob, true);
  });
});

message_status.insert({ status: 'new' });

const mdbws = connections.insert({ ws: 'ok' });

//console.log(connections);

const msg = messages.insert({
  data: JSON.parse('{}'),
  connection: mdbws,
  status: message_status.get('new'),
});

const msg2 = messages.insert({
  data: JSON.parse('{}'),
  connection: mdbws,
  status: message_status.get('new'),
});

msg2.hola = 1;

it('Test related exists', function () {
  assert.equal(mdbws.messages_data.length, 2);
  assert.equal(message_status.get('new').messages_data.length, 2);
});
