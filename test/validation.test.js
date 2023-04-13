const { MapDB } = require("../mapdb.js");
const chai = require("chai");
const assert = require("assert");

const mdb = new MapDB();

const usuarios = mdb.createTable("usuarios", {
  fields: {
    email: { match: /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g },
  },
});

usuarios.insert({ email: "seyacat@gmail.com" });

it("Common commands", function () {
  chai
    .expect(() => {
      usuarios.insert({ email: "bademail" });
    })
    .to.throw(
      `Table (usuarios) field (email) not match /^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$/g`
    );
});
