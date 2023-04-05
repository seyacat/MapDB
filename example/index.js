import MapDb from '../mapdb.js';

const log = console.log.bind(
  console,
  '%c %s',
  'background: green; color: white'
);

const mdb = new MapDb();

const users = mdb.createTable('users');
try {
  const users = mdb.createTable('users');
} catch (e) {
  log(e.message);
}
const user1 = users.insert({ hola: 1 });
const user2 = users.insert({ id: 'test', hola: 1 });
log(users.describe());
log(user1, user2);

const emails = mdb.createTable('emails', { id: 'email' });
try {
  const email1 = emails.insert({ perro: 1 });
} catch (e) {
  log(e.message);
}
const email1 = emails.insert({ email: 1 });
log(emails.describe());
log(email1);
