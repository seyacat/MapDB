import Crypto from 'crypto';

export default class {
  mdb = new Map();
  constructor() {}
  createTable(tablename, options) {
    //CHECK TABLE EXISTS
    if (this.mdb.has(tablename)) {
      throw new Error(`Table ${tablename} already exists`);
    }
    const newtable = new Table(tablename, options);
    this.mdb.set(tablename, newtable);
    return newtable;
  }
}
class Table {
  name;
  id = 'id';
  data = new Map();
  constructor(tablename, options) {
    this.name = tablename;
    if (options?.id) {
      this.id = options?.id;
    }
  }
  describe() {
    return { id: this.id, name: this.name };
  }
  insert(record) {
    if (typeof record != 'object') {
      throw new error('Wrong data type');
    }

    //CHECK ID EXIST IN OBJECTS
    if (this.id == 'id' && !record[this.id]) {
      record[this.id] = randomHexString();
    }
    if (this.id != 'id' && !record[this.id]) {
      throw new Error(`Missing ${this.id} field`);
    }
    //CHECK IF RECORD ALREADY EXISTS
    if (this.data.has(record[this.id])) {
      throw new Error(`Record ${this.id} already exists`);
    }
    //STORE RECORD
    this.data.set(record[this.id], record);
    return record;
  }
}

function randomHexString(size = 40) {
  return Crypto.randomBytes(size).toString('hex').slice(0, size);
}
