import MapDb from "../mapdb.js";
import assert from "assert";
import chai from "chai";

const mdb = new MapDb();

const games = mdb.createTable("games", { fields: { name: { unique: true } } });
const rooms = mdb.createTable("rooms", {
  fields: {
    name: { unique: true },
    game: { hasOne: "games", required: true, notForeignRequired: true },
    players: { hasMany: true },
  },
});

const game1 = games.insert({ name: "juego1", desc: "j1" });

it("Unique field duplication", function () {
  chai
    .expect(() => {
      games.insert({ name: "juego1", desc: "j2" });
    })
    .to.throw("Record duplicated. name:juego1");
});

const game2 = games.insert({ name: "juego2", desc: "j1" });

const room1 = rooms.insert({ game: "game1" });

it("Empty unique field duplication", function () {
  chai
    .expect(() => {
      rooms.insert({});
    })
    .to.throw("Record duplicated. name:null");
});

const room2 = rooms.insert({ name: "room2", game: "game1" });
room2.test = "hola";

it("Unique field duplication on insert", function () {
  chai
    .expect(() => {
      rooms.insert({ name: "room2" });
    })
    .to.throw("Record duplicated. name:room2");
});
