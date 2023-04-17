'use strict';
const { MapDB } = require('../mapdb');
const chai = require('chai');
const assert = require('assert');

const mdb = new MapDB();

const users = mdb.createTable('users', {
  fields: { connection: { hasOne: 'connections', fhField: 'user' } },
});

const connections = mdb.createTable('connections', {
  fields: {
    messages: { hasMany: 'messages', fhField: 'connection' },
    user: { hasOne: 'users', fhField: 'connection' },
  },
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

messages.onAny(function (data) {
  const { record, event } = data;
  const newuser = users.insert({ connection: record.connection_data });
  users.update({ ...newuser, updateok: 'updateok' });
  //console.log({ newuser });
  //console.log({ conn: newuser.connection_data });

  it('Test onAny', function () {
    assert.equal(!!data, true);
  });
});

messages.onInsert(function (ob) {
  //console.log(ob);
  it('Test onInsert', function () {
    assert.equal(!!ob, true);
  });
});

messages.onUpdate(function (ob) {
  //console.log(ob);
  it('Test onUpdate', function () {
    assert.equal(!!ob, true);
  });
});

messages.onChange(function (ob) {
  //console.log(ob);
  it('Test onChange', function () {
    assert.equal(!!ob, true);
  });
});

message_status.upsert({ status: 'new', ko: 'ko' });
message_status.upsert({ status: 'new', ok: 'ok' });
message_status.update({ status: 'new', okk: 'okk' });

it('Update error', function () {
  chai
    .expect(() => {
      message_status.update({ status: 'noexist', okk: 'okk' });
    })
    .to.throw('Missing record');
});

const mdbws = connections.insert({ ws: 'ok' });

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

messages.update({
  ...msg2,
  data: JSON.parse('{}'),
  connection: mdbws,
  status: message_status.get('new'),
});

msg2.hola = 1;

it('Test related exists', function () {
  assert.equal(mdbws.messages_data.length, 2);
  assert.equal(message_status.get('new').messages_data.length, 2);
});
