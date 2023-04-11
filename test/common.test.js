const { MapDB } = require("../mapdb.js");
const chai = require("chai");
const assert = require("assert");

const mdb = new MapDB();

const usuarios = mdb.createTable("usuarios", {
  fields: {
    email: { unique: true, required: true },
    automovil: { hasMany: "automoviles", fhField: "usuario" },
  },
});

const automoviles = mdb.createTable("automoviles", {
  fields: { usuario: { hasOne: "usuarios", fhField: "automovil" } },
});

it("Insert non object", function () {
  chai
    .expect(() => {
      usuarios.insert("");
    })
    .to.throw("Wrong insert data type");
});

it("Create relation without fhField", function () {
  chai
    .expect(() => {
      mdb.createTable("errorExpected", {
        fields: { usuario: { hasMany: "usuarios" } },
      });
    })
    .to.throw("Related field (usuario) requires fhField");
});

it("Common commands", function () {
  assert.equal(mdb.describe().tables.length, 3);
  assert.equal(!!usuarios.describe().id, true);
  assert.equal(!!usuarios.describe().name, true);
  assert.equal(!!usuarios.describe().options, true);
});
