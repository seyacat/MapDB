import MapDb from "../mapdb.js";
import assert from "assert";
import chai from "chai";

const mdb = new MapDb();

let users = mdb.createTable("users");
it("Duplicated Tables", function () {
  chai
    .expect(() => {
      mdb.createTable("users");
    })
    .to.throw("Table users already exists");
});

it("Multiple Ids", function () {
  chai
    .expect(() => {
      mdb.createTable("multipleids", {
        fields: { id1: { id: true }, id2: { id: true } },
      });
    })
    .to.throw("Multiple Ids configured");
});

it("Insert two records", function () {
  const user1 = users.insert({ hola: 1 });
  const user2 = users.insert({ id: "test", hola: 1 });
  assert.equal(users.data.size, 2);
});
