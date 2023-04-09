import MapDb from "../mapdb.js";
import assert from "assert";
import chai from "chai";

const mdb = new MapDb();

const games = mdb.createTable("games", {
  fields: {
    name: { unique: true },
    rooms: { hasMany: "rooms", fhField: "game" },
  },
});

const rooms = mdb.createTable("rooms", {
  fields: {
    name: { unique: true },
    game: { hasOne: "games", required: true, fhField: "rooms" },
    players: { hasMany: "players", fhField: "room" },
  },
});

const players = mdb.createTable("players", {
  fields: {
    room: { hasOne: "rooms", fhField: "players" },
  },
});

const game1 = games.insert({ name: "game1" });
const game2 = games.insert({ name: "game2" });

const room1 = rooms.insert({ game: game1.id, premio: "uno" });
room1.game = game2.id;

it("Invalid Parent", function () {
  chai
    .expect(() => {
      room1.game = "nogame1";
    })
    .to.throw("Not valid parent for field game:nogame1 required");
  chai
    .expect(() => {
      rooms.insert({ name: "noroom", game: "nogame2" });
    })
    .to.throw("Not valid parent for field game:nogame2 required");
});

const room2 = rooms.insert({ name: "room2", game: game1.id });
const room3 = rooms.insert({ name: "room3", game: game2.id });
const room4 = rooms.insert({ name: "room4", game: game1.id });

const player1 = players.insert({ name: "player1", room: room2.id });

const pivotTable = mdb.tables.get(
  mdb.tables.get("rooms").options.fields.game.pivotTable
);

it("Test pivot sizes1", function () {
  assert.equal(game1.rooms_data?.length, 2);
  assert.equal(game2.rooms_data?.length, 2);
  room4.game = game2.id;
  assert.equal(game1.rooms_data?.length, 1);
  assert.equal(game2.rooms_data?.length, 3);
  room1.game = game1.id;
  room4.game = game1.id;
  assert.equal(game1.rooms_data?.length, 3);
  assert.equal(game2.rooms_data?.length, 1);
  game1.attach("rooms", room3.id);
  console.log(game1.rooms_data);
  console.log(game2.rooms_data);
  assert.equal(game1.rooms_data.length, 4);
  assert.equal(game2.rooms_data?.length, null);
  game2.attach("rooms", room3.id);
  assert.equal(game1.rooms_data.length, 3);
});
