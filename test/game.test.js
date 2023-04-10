const { MapDB } = require("../mapdb.js");
const chai = require("chai");
const assert = require("assert");

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

it("Unique field duplication", function () {
  chai
    .expect(() => {
      games.insert({ name: "juego1", desc: "j2" });
    })
    .to.throw("Record duplicated. name:juego1");
});

const game2 = games.insert({ name: "juego2", desc: "j1" });

const room1 = rooms.insert({ game: game1.id });

it("Empty unique field duplication", function () {
  chai
    .expect(() => {
      rooms.insert({});
    })
    .to.throw("Record duplicated. name:null");
});

const room2 = rooms.insert({ name: "room2", game: game1.id });
room2.test = "hola";

it("Unique field duplication on insert", function () {
  chai
    .expect(() => {
      rooms.insert({ name: "room2" });
    })
    .to.throw("Record duplicated. name:room2");
});
