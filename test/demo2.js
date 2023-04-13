const { MapDB } = require('../mapdb');
const mdb = new MapDB();

const cursos = mdb.createTable('cursos', {
  fields: {
    name: { unique: true },
    estudiantes: { hasMany: 'estudiantes', fhField: 'cursos' },
  },
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
curso1.attach('estudiantes', estudiante2.id);
estudiante2.attach('cursos', curso2.id);
estudiante2.detach('cursos', curso1);

//SHOW RELATED DATA
//console.log(curso1.estudiantes_data);
/*[
  {
    id: '2af0fc5c3717a64cf8edf4595ba02ce548768a08',
    name: 'juan',
    cursos: null
  }
]*/
//console.log(estudiante1.cursos_data);
/*[
  {
    id: '2d390151184d7a49a3980ba47ebbaae32d5ca598',
    name: 'matematicas',
    estudiantes: null
  }
]*/
