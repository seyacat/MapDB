# MapDB

MapDB is a tool for managing relationships between objects like a database does.

## Instalation

```
npm i --save @seyacat/mapdb
```
## Import in project

```
const { MapDB } = require("@seyacat/mapdb");
const mdb = new MapDB();
```
as module
```
import { MapDB } from "@seyacat/mapdb";
const mdb = new MapDB();
```
## Classes

MapDB: Main class, contains all the structure and data
* constructor(config): config can contain tables structure, look example below
* get(name): return table by name
* tables: contains Map of Tables.
* createTable(name, options): create new table

Table: Contains the records and settings of a collection of objects.
* mdb: parent MapDB object.
* id: name of the id field.
* name: unique table name.
* options: contains fields configurations.
* data: contains Map of records.
* insert(object): Insert record function.
* upsert(object): Update if exists or insert record function.
* update(object): Update record function.
* delete(object || id): delete record

* onAny(function({record,event,field,prev}){}): Add callback function for any record event.
* onChange(function({record,event,field,prev}){}): Add callback function for change FIELD event. Should be used only on single field change.
* onInsert(function({record,event}){}): Add callback function for insert record event.
* onUpdate(function({record,event,prev}){}): Add callback function for update record event.

Record: Is a proxy object created with Table.insert() method.
* muted: boolena trapped property than disable callback it is true;
* attach(object | id): reserved trapped function for attach relation on hasOne and hasMany properties.
* detach(object | id): reserved trapped function for detach relation on hasOne and hasMany property.
* ${fieldname}_data: A related field with hasMany or hasOne shows the id, [...] when you have many or null. To retrieve the data of a related field it is necessary to prepend "_data", this to avoid infinite loops.
* [???] hasMany field with unknow content, seen on console.log()
* [...] hasMany field with childs

## Field Properties

* [x] id: name of the Id field.
* [x] unique.
* [x] required: non null.
* [x] match: validation regexp.
* [x] hasOne: property than contains table name for the record that has related a single parent. 
* [x] hasMany: property than contains table name for the record that has related many children.
* [x] fhField: property than contains field name of related table, required on fields with hasMany and hasOne property.

## Usage

Create main class
```
import { MapDB } from "@seyacat/mapdb";
const mdb = new MapDB();
```

Declare tables in a single JSON object
```
const config = {
  tables: {
    users: {
      fields: { connection: { hasOne: 'connections', fhField: 'user' } },
    },
    connections: {
      ...
    },
    ...
  },
};

const mdb = new MapDB(config);

const messages = mdb.get('messages');
const messages = mdb.tables.get('messages');

```

Create Table with field properties
```
const emails = mdb.createTable("emails", {
  fields: { email: { unique: true } },
});
```

Create records
```
  const email1 = emails.insert({ email: "test@test.com" });
  const email2 = emails.insert({ email: "test@test.com" }); //<-- Thrown error
```

Edit record, treat it like any other object
``` 
  email1.email = "test@test.com" <--- Set data as normal object
```
``` 
  email1.email = "test@test.com" <--- Assing record on hasOne relationship
```
``` 
  email1.email = "test@test.com" <--- Append record on hasMany relationship
```

## Examples

One to Many example
```
const { MapDB } = require("@seyacat/mapdb");
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
const game2 = games.insert({ name: "juego2", desc: "j1" });

const room1 = rooms.insert({ game: game1.id });
const room2 = rooms.insert({ name: "room2", game: game1.id });
room2.test = "hola";

//SHOW OBJECTS WITHOUT RELATED DATA
console.log(game1);
/*{
  id: '5384c954acbd25b15d6fb7e5f1b5c178762c837d',
  name: 'juego1',
  desc: 'j1',
  rooms: null
}*/
console.log(room1);
/*{
  id: 'fd050c21a227a6db7774f03d5091e8f25ec969d9',
  game: '5384c954acbd25b15d6fb7e5f1b5c178762c837d',
  name: null,
  players: null
}*/

//SHOW RELATED DATA
console.log(game1.rooms_data);
/*[
  {
    id: 'fd050c21a227a6db7774f03d5091e8f25ec969d9',
    game: '5384c954acbd25b15d6fb7e5f1b5c178762c837d',
    name: null,
    players: null
  },
  {
    id: '9c855aed893508ac0eb485e7d9d447985b776b81',
    name: 'room2',
    game: '5384c954acbd25b15d6fb7e5f1b5c178762c837d',
    players: null,
    test: 'hola'
  }
]*/
console.log(room1.game_data);
/*{
  id: '5384c954acbd25b15d6fb7e5f1b5c178762c837d',
  name: 'juego1',
  desc: 'j1',
  rooms: null
}*/

```

Many to Many example
```
const { MapDB } = require("@seyacat/mapdb");
const mdb = new MapDB();

const cursos = mdb.createTable("cursos", {
  fields: {
    name: { unique: true },
    estudiantes: { hasMany: "estudiantes", fhField: "cursos" },
  },
});

const estudiantes = mdb.createTable("estudiantes", {
  fields: {
    name: { unique: true },
    cursos: { hasMany: "cursos", fhField: "estudiantes" },
  },
});

const curso1 = cursos.insert({ name: "matematicas" });
const curso2 = cursos.insert({ name: "fisica" });
const curso3 = cursos.insert({ name: "quimica" });
const estudiante1 = estudiantes.insert({ name: "juan" });
const estudiante2 = estudiantes.insert({ name: "pedro" });
const estudiante3 = estudiantes.insert({ name: "maria" });
curso1.attach("estudiantes", estudiante1.id);
curso1.attach("estudiantes", estudiante2.id);
estudiante2.attach("cursos", curso2.id);
estudiante2.detach("cursos", curso1.id);

//SHOW RELATED DATA
console.log(curso1.estudiantes_data);
/*[
  {
    id: '2af0fc5c3717a64cf8edf4595ba02ce548768a08',
    name: 'juan',
    cursos: null
  }
]*/
console.log(estudiante1.cursos_data);
/*[
  {
    id: '2d390151184d7a49a3980ba47ebbaae32d5ca598',
    name: 'matematicas',
    estudiantes: null
  }
]*/

```
## Test

Integrated tesr with mocha
```
npm run test
```

## Support
Write without problem to seyacat@gmail.com or create an issue.

## Roadmap

* [ ] Typescript types.
* [X] Delete records.
* [ ] Validate fields.
* [ ] Redis Database integration.

## Contributing

Mail to seyacat@gmail.com

## Authors

Santiago Andrade (seyacat)<br />
You can follow the develop of this live on twitch 22:00 GMT-5 
https://www.twitch.tv/seyacat 

## License
ISC

## Project status
Early Stage


