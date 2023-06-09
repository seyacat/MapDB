const { MapDB, Record } = require('../mapdb.js');
const chai = require('chai');
const assert = require('assert');

it('Error relationships', function () {
  let config = {
    tables: {},
    relationships: [['one', 'table1', 'table2', 'table2']],
  };
  chai
    .expect(() => {
      new MapDB(config);
    })
    .to.throw(
      `Relation format is ['one'|'many',fhField1 name, table1 name ,'one'|'many',fhField2 name, table2 name] read as " one|many user in table users has one|many objects in table objects "`
    );
});

it('Error relationships', function () {
  let config = {
    tables: {},
    relationships: [['one', 'table1', 'table1', 'many', 'table2', 'table2']],
  };
  chai
    .expect(() => {
      new MapDB(config);
    })
    .to.throw('Table table1 not declared');
});

it('Error relationships', function () {
  let config = {
    tables: { table1: {} },
    relationships: [['one', 'table1', 'table1', 'many', 'table2', 'table2']],
  };
  chai
    .expect(() => {
      new MapDB(config);
    })
    .to.throw('Table table2 not declared');
});

let config = {
  tables: { table1: { fields: { status: { index: true } } }, table2: {} },
  relationships: [['one', 'table1', 'table1', 'many', 'table2', 'table2']],
};
const mdb = new MapDB(config);

it('Wrong index insert', function () {
  const table1 = mdb.get('table1');
  const table1Status = mdb.get('table1_status');
  table1Status.insert({ type: 'table1Status', status: 'new' });
  table1Status.insert({ type: 'table1Status', status: 'old' });

  table1.insert({ type: 'table1', status: 'new', status2: 'old' });
  table1.insert({ type: 'table1', status: 'new' });

  assert.equal(table1Status.get('new').table1_data.length, 2);

  console.log(table1.getAllByField('status2', 'old'));
  console.log(table1.getAllByField('status', 'new'));

  chai
    .expect(() => {
      table1.insert({ status: 'wrong' });
    })
    .to.throw('Not valid parent for field status:wrong required');
});

const usuarios = mdb.createTable('usuarios', {
  fields: {
    email: { unique: true, required: true },
    automovil: { hasMany: 'automoviles', fhField: 'usuario' },
  },
});

const automoviles = mdb.createTable('automoviles', {
  fields: { usuario: { hasOne: 'usuarios', fhField: 'automovil' } },
});

it('Insert non object', function () {
  chai
    .expect(() => {
      usuarios.insert('');
    })
    .to.throw('Wrong insert data type');
});

it('Create relation without fhField', function () {
  chai
    .expect(() => {
      mdb.createTable('errorExpected', {
        fields: { usuario: { hasMany: 'usuarios' } },
      });
    })
    .to.throw('Related field (usuario) requires fhField');
});

it('Common commands', function () {
  assert.equal(mdb.describe().tables.length, 8);
  assert.equal(!!usuarios.describe().id, true);
  assert.equal(!!usuarios.describe().name, true);
  assert.equal(!!usuarios.describe().options, true);
});
