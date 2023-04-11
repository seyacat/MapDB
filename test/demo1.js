const { MapDB } = require("..//mapdb");
const mdb = new MapDB();

const games = mdb.createTable("games", {
  fields: {
    name: { unique: true },
    rooms: { hasMany: "rooms", fhField: "game" },
  },
});
const rooms = mdb.createTable("rooms", {
  fields: {
    name: { unique: true },
    game: { hasOne: "games", fhField: "rooms", required: true },
    players: { hasMany: "players", fhField: "room" },
  },
});
const players = mdb.createTable("players", {
  fields: {
    room: { hasOne: "rooms", fhField: "players" },
  },
});

const game1 = games.insert({ name: "juego1", desc: "j1" });
const game2 = games.insert({ name: "juego2", desc: "j1" });

const room1 = rooms.insert({ game: game1.id });
const room2 = rooms.insert({ name: "room2", game: game1.id });
room2.test = "hola";

//SHOW OBJECTS WITHOUT RELATED DATA
//console.log(game1);
/*{
  id: '5384c954acbd25b15d6fb7e5f1b5c178762c837d',
  name: 'juego1',
  desc: 'j1',
  rooms: null
}*/
//console.log(room1);
/*{
  id: 'fd050c21a227a6db7774f03d5091e8f25ec969d9',
  game: '5384c954acbd25b15d6fb7e5f1b5c178762c837d',
  name: null,
  players: null
}*/

//SHOW RELATED DATA
//console.log(game1.rooms_data);
/*[
  {
    id: 'fd050c21a227a6db7774f03d5091e8f25ec969d9',
    game: '5384c954acbd25b15d6fb7e5f1b5c178762c837d',
    name: null,
    players: null
  },
  {
    id: '9c855aed893508ac0eb485e7d9d447985b776b81',
    name: 'room2',
    game: '5384c954acbd25b15d6fb7e5f1b5c178762c837d',
    players: null,
    test: 'hola'
  }
]*/
//console.log(room1.game_data);
/*{
  id: '5384c954acbd25b15d6fb7e5f1b5c178762c837d',
  name: 'juego1',
  desc: 'j1',
  rooms: null
}*/
