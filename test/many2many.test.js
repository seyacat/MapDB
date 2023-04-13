const { MapDB } = require('../mapdb.js');
const chai = require('chai');
const assert = require('assert');

const mdb = new MapDB();

const cursos = mdb.createTable('cursos', {
  fields: {
    name: { unique: true },
    estudiantes: { hasMany: 'estudiantes', fhField: 'cursos' },
  },
});

it('Unique field duplication', function () {
  chai
    .expect(() => {
      mdb.createTable('estudiantes1', {
        fields: {
          name: { unique: true },
          cursos: {
            hasMany: 'estudiantes',
            hasOne: 'estudiantes',
            fhField: 'cursos',
          },
        },
      });
    })
    .to.throw('Multiple relationship configured in this field. cursos');
});

const estudiantes = mdb.createTable('estudiantes', {
  fields: {
    name: { unique: true },
    cursos: { hasMany: 'cursos', fhField: 'estudiantes' },
  },
});

const curso1 = cursos.insert({ name: 'matematicas' });
const curso2 = cursos.insert({ name: 'fisica' });
const curso3 = cursos.insert({ name: 'quimica' });

const estudiante1 = estudiantes.insert({ name: 'juan' });
const estudiante2 = estudiantes.insert({ name: 'pedro' });
const estudiante3 = estudiantes.insert({ name: 'maria' });

curso1.attach('estudiantes', estudiante1.id);

it('Wrong configuration hasMany', function () {
  assert.equal(estudiante1.cursos, '[...]');
  assert.equal(curso1.estudiantes, '[...]');
  assert.equal(estudiante1.cursos_data?.length, 1);
  assert.equal(curso1.estudiantes_data?.length, 1);
  assert.equal(curso2.estudiantes_data?.length, null);
  curso1.attach('estudiantes', estudiante2.id);
  assert.equal(estudiante2.cursos_data?.length, 1);
  assert.equal(curso1.estudiantes_data?.length, 2);
  estudiante2.attach('cursos', curso2.id);
  assert.equal(estudiante2.cursos_data?.length, 2);
  assert.equal(curso1.estudiantes_data?.length, 2);
  estudiante2.detach('cursos', curso1.id);
  assert.equal(estudiante2.cursos_data?.length, 1);
  assert.equal(curso1.estudiantes_data?.length, 1);
  estudiantes.delete(estudiante2.id);
});

it('Wrong configuration hasMany', function () {
  chai
    .expect(() => {
      curso1.attach('estudiantes', 'badid');
    })
    .to.throw('Not valid forheign Id (badid)');
});

it('Wrong configuration hasMany', function () {
  chai
    .expect(() => {
      curso1.attach('wrongfield', curso1.id);
    })
    .to.throw('Not valid hasMany field (wrongfield)');
});

//console.log(mdb.describe());
//SHOW RELATED DATA
//console.log( curso1.estudiantes_data );
//console.log( estudiante1.cursos_data );
