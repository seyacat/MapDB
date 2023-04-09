import MapDb from "../mapdb.js";

const mdb = new MapDb();

const usuarios = mdb.createTable("usuarios", {
  fields: {
    email: { unique: true, required: true },
    automovil: { hasMany: "automoviles", fhField: "usuario" },
  },
});

const automoviles = mdb.createTable("automoviles", {
  fields: { usuario: { hasOne: "usuarios", fhField: "automovil" } },
});

const pablo = usuarios.insert({ nombre: "Pablo", email: "pablo@pablo.com" });
const juan = usuarios.insert({ nombre: "Juan", email: "juan@juan.com" });

//TODO SHOW PARENT
const auto1 = automoviles.insert({ marca: "fiat", usuario: juan.id });

//console.log(mdb.tables);
//console.log(juan.automovil_data);
//console.log({ pablo, juan });
//console.log(auto1.usuario);
//console.log(mdb.describe());
