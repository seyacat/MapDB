import MapDb from '../mapdb.js';

const mdb = new MapDb();

const users = mdb.createTable('users');
try {
  //ERROR DUPLICATED TABLE
  mdb.createTable('users');
} catch (e) {
  console.log(e.message);
}
const user1 = users.insert({ hola: 1 });
const user2 = users.insert({ id: 'test', hola: 1 });
console.log(users.describe());
console.log(user1, user2);

const emails = mdb.createTable('emails', { id: 'email' });
try {
  //ERROR NO ID
  emails.insert({ perro: 1 });
} catch (e) {
  console.log(e.message);
}
const email1 = emails.insert({ email: 1 });
console.log(emails.describe());
console.log(email1);

const games = mdb.createTable('games',{unique:["name"]});

const game1 = games.insert( {name:"juego1",desc:"j1"} )
try {
  //DUPLICATE FIELD
games.insert( {name:"juego1",desc:"j2"} )
} catch(e){console.log(e.message);}
const game2 = games.insert( {name:"juego2",desc:"j1"} )
console.log(games.describe());
console.log("games",game1,game2)

const rooms = mdb.createTable('rooms',{unique:["name"],hasOne:[{table:"games",field:"game"}]});
const room1 = rooms.insert( {} )
try{
  const room2 = rooms.insert( {} )
} catch(e){console.log(e.message);}

console.log(room1)

//console.log(mdb.describe())

