import MapDb from "../mapdb.js";
import assert from "assert";
import chai from "chai";

const mdb = new MapDb();

const games = mdb.createTable("games", {
  fields: { name: { unique: true }, rooms: { hasMany: "rooms" } },
});
const rooms = mdb.createTable("rooms", {
  fields: {
    name: { unique: true },
    game: { hasOne: "games", required: true },
    players: { hasMany: "players" },
  },
});

const game1 = games.insert({});
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
const room3 = rooms.insert({ name: "room3", game: game1.id });
const room4 = rooms.insert({ name: "room4", game: game1.id });

const players = mdb.createTable("players", {
  fields: { room: { hasOne: "rooms" } },
});
const player1 = players.insert({ name: "player1" });

const pivotTable = mdb.tables.get(
  mdb.tables.get("rooms").options.fields.game.pivotTable
);

it("Test pivot sizes1", function () {
  assert.equal(game1.rooms.length, 3);
  assert.equal(game2.rooms.length, 1);
  room4.game = game2.id;
  assert.equal(game1.rooms.length, 2);
  assert.equal(game2.rooms.length, 2);
  room1.game = game1.id;
  room4.game = game1.id;
  assert.equal(game1.rooms.length, 4);
  assert.equal(game2.rooms, null);
});
