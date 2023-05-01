const { MapDB } = require('../mapdb.js');
const chai = require('chai');
const assert = require('assert');

const mdb = new MapDB();

const emails = mdb.createTable('emails', { fields: { email: { id: true } } });

it('Insert record without Id', function () {
  chai
    .expect(() => {
      emails.insert({ perro: 1 });
    })
    .to.throw('Missing email field');
});

const email1 = emails.insert({ email: 1 });

it('Insert email with same Id', function () {
  chai
    .expect(() => {
      emails.insert({ email: 1 });
    })
    .to.throw('Id record email:1 already exists');
});

it('Manipulate Fields', function () {
  email1.testfield = 'hola';
  assert.equal(email1.testfield, 'hola');
  assert.equal(emails.data.get(email1.email).testfield, 'hola');
  email1.testfield = 'mundo';
  assert.equal(email1.testfield, 'mundo');
  assert.equal(emails.data.get(email1.email).testfield, 'mundo');
});

it('Manipulate Email Ids', function () {
  email1.email = '1@1.com';
  assert.equal(email1.email, '1@1.com');
  assert.equal(emails.data.get('1@1.com')?.email, '1@1.com');

  email1.email = 2;

  assert.equal(email1.email, 2);
  chai.expect(emails.data.get('1@1.com')).to.be.oneOf([null, undefined]);
  assert.equal(emails.data.get(2)?.email, 2);
  const email3 = emails.insert({ email: 3, test: 3 });
  chai
    .expect(() => {
      email3.email = 2;
    })
    .to.throw('Id record email:2 already exists');
  assert.equal(emails.get().length, 2);
});
