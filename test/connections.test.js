'use strict';
const { MapDB } = require('../mapdb');
const chai = require('chai');
const assert = require('assert');

const config = {
  tables: {
    users: {
      fields: {
        connection: { hasOne: 'connections', fhField: 'user' },
        //room: { hasOne: 'rooms', fhField: 'users' },
        //myrooms: { hasMany: 'rooms', fhField: 'owner' },
      },
    },
    connections: {
      fields: {
        //messages: { hasMany: 'messages', fhField: 'connection' },
        //user: { hasOne: 'users', fhField: 'connection' },
      },
    },
    message_status: {
      fields: {
        status: { id: true },
        //messages: { hasMany: 'messages', fhField: 'status' },
      },
    },
    messages: {
      fields: {
        //connection: { hasOne: 'connections', fhField: 'messages' },
        //status: { hasOne: 'message_status', fhField: 'messages' },
        //user: { hasOne: 'users', fhField: 'messages' },
      },
    },
    rooms: {
      fields: {
        //users: { hasMany: 'users', fhField: 'room' },
        //owner: { hasOne: 'users', fhField: 'myrooms' },
      },
    },
  },

  relationships: [
    //One room in table rooms has many users in table users
    ['one', 'room', 'rooms', 'many', 'users', 'users'],
    //One owner (users) has many rooms(rooms)
    ['one', 'owner', 'users', 'many', 'myrooms', 'rooms'],
    //One owner (users) has many messages(messages)
    ['one', 'user', 'users', 'many', 'messages', 'messages'],
    //One connection (connections) has one user (users)
    ['one', 'connection', 'connections', 'one', 'user', 'users'],
    //One connection (connections) has many messages (messages)
    ['one', 'connection', 'connections', 'many', 'messages', 'messages'],
    //One status (message_status) has many messages (messages)
    ['one', 'status', 'message_status', 'many', 'messages', 'messages'],
  ],
};

const mdb = new MapDB(config);

const messages = mdb.get('messages');
const message_status = mdb.tables.get('message_status');
const connections = mdb.tables.get('connections');
const users = mdb.tables.get('users');
const rooms = mdb.get('rooms');

messages.onAny(function (data) {
  const { record, event } = data;
  if (record.status == 'new') {
    const user = users.insert({
      type: 'user',
      connection: record.connection_data,
    });
    users.update({
      ...user,
      updateok: 'updateok',
      connection: record.connection_data,
    });

    messages.update({
      ...record,
      user,
      status: 'reply',
      data: { success: true },
    });

    const room = rooms.insert({ users: user, owner: user });
  }

  it('Test onAny', function () {
    assert.equal(!!data, true);
  });

  if (record.status === 'reply') {
    it('Test related data exist', function () {
      assert.equal(!!record, true);
      assert.equal(!!record.user_data, true);
      assert.equal(!!record.user_data.connection_data, true);
    });
  }
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

message_status.upsert({ type: 'message_status', status: 'new', ko: 'ko' });
message_status.upsert({ type: 'message_status', status: 'new', ok: 'ok' });
message_status.update({ type: 'message_status', status: 'new', okk: 'okk' });

message_status.insert({ type: 'message_status', status: 'reply', ko: 'ko' });

it('Update error', function () {
  chai
    .expect(() => {
      message_status.update({ status: 'noexist', okk: 'okk' });
    })
    .to.throw('Missing record');
});

const mdbws = connections.insert({
  type: 'connection',
  ws: 'ok',
  send: function () {
    return 'OK';
  },
});

const msg = messages.insert({
  type: 'message',
  data: JSON.parse('{}'),
  connection: mdbws,
  status: message_status.get('new'),
});

const msg2 = messages.insert({
  type: 'message',
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
  assert.equal(message_status.get('reply').messages_data.length, 2);
});
