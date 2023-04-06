import Crypto from 'crypto';

export default class {
  tables = new Map();
  constructor() {}
  describe() {
    return { tables: [...this.tables.keys()] };
  }
  createTable(tablename, options) {
    //CHECK TABLE EXISTS
    if (this.tables.has(tablename)) {
      throw new Error(`Table ${tablename} already exists`);
    }
    const newtable = new Table(this, tablename, options);
    this.tables.set(tablename, newtable);
    return newtable;
  }
}
class Table {
  mdb;
  name;
  id = 'id';
  data = new Map();
  unique = new Map();
  constructor(mdb, tablename, options) {
    this.mdb = mdb;
    this.name = tablename;
    if (options?.id) {
      this.id = options?.id;
    }
    //CREATE UNIQUE MAPS
    for (const uniqueField of options?.unique ?? []) {
      this.unique.set(uniqueField, new Map());
    }
    //CREATE ONE-MANY RELATION
    for (const hasOneField of options?.hasOne ?? []) {
      this.mdb.createTable(`${hasOneField.table}-${this.name}`);
    }
  }
  describe() {
    return { id: this.id, name: this.name, unique: [...this.unique.keys()] };
  }
  insert(data) {
    if (typeof data != 'object') {
      throw new error('Wrong data type');
    }

    //CHECK ID EXIST IN OBJECTS
    if (this.id == 'id' && !data[this.id]) {
      data[this.id] = randomHexString();
    }
    if (this.id != 'id' && !data[this.id]) {
      throw new Error(`Missing ${this.id} field`);
    }
    //CHECK IF RECORD ALREADY EXISTS
    if (this.data.has(data[this.id])) {
      throw new Error(`Record ${this.id} already exists`);
    }
    //CHECK UNIQUE
    for (const [key, val] of this.unique) {
      if (val.has(data[key])) {
        throw new Error(`Record '${key}' duplicated. ${key}:${data[key]}`);
      }
    }
    //STORE RECORD
    this.data.set(data[this.id], data);
    //UPDATE UNIQUES
    for (const [key, val] of this.unique) {
      val.set(data[key]);
    }
    //TODO fill oneMany relationship
    record = new Record(this, data);
    return record;
  }
}

class Record {
  table;
  data;
  constructor(table, data) {
    this.table = table;
    this.data = data;
    return new Proxy(this, {
      set: (object, key, value, proxy) => {
        object[key] = value;
        console.log('PROXY SET');
        return true;
      },
    });
  }
}

function randomHexString(size = 40) {
  return Crypto.randomBytes(size).toString('hex').slice(0, size);
}
