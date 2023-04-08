import MapDb from "../mapdb.js";
import assert from "assert";
import chai from "chai";

const mdb = new MapDb();

const cursos = mdb.createTable("cursos", {
  fields: { name: { unique: true }, estudiantes: { hasMany: "estudiantes" } },
});

it("Unique field duplication", function () {
  chai
    .expect(() => {
      mdb.createTable("estudiantes1", {
        fields: {
          name: { unique: true },
          cursos: { hasMany: "estudiantes", hasOne: "estudiantes" },
        },
      });
    })
    .to.throw("Multiple relationship configured in this field. cursos");
});

const estudiantes = mdb.createTable("estudiantes", {
  fields: { name: { unique: true }, cursos: { hasMany: "cursos" } },
});

const curso1 = cursos.insert({ name: "matematicas" });
const curso2 = cursos.insert({ name: "fisica" });
const curso3 = cursos.insert({ name: "quimica" });

const estudiante1 = estudiantes.insert({ name: "juan" });
const estudiante2 = estudiantes.insert({ name: "pedro" });
const estudiante3 = estudiantes.insert({ name: "maria" });

curso1.attach("estudiantes", estudiante1.id);

it("Wrong configuration hasMany", function () {
  chai
    .expect(() => {
      curso1.attach("estudiantes", "badid");
    })
    .to.throw("Not valid forheign Id (badid)");
});

it("Wrong configuration hasMany", function () {
  chai
    .expect(() => {
      curso1.attach("wrongfield", curso1.id);
    })
    .to.throw("Not valid hasMany field (wrongfield)");
});

//console.log(mdb.describe());
