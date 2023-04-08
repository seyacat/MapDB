import MapDb from "../mapdb.js";

const mdb = new MapDb();

const usuarios = mdb.createTable("usuarios", {
  fields: {
    email: { unique: true, required: true },
    automovil: { hasMany: "automoviles" },
  },
});

const automoviles = mdb.createTable("automoviles", {
  fields: { usuario: { hasOne: "usuarios" } },
});

const pablo = usuarios.insert({ nombre: "Pablo", email: "pablo@pablo.com" });
const juan = usuarios.insert({ nombre: "Juan", email: "juan@juan.com" });

//TODO SHOW PARENT
const auto1 = automoviles.insert({ marca: "fiat", usuario: juan.id });

console.log({ pablo, juan });
console.log({ auto1 });
console.log(mdb.describe());
