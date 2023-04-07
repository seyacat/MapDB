import Crypto from "crypto";

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
  options;
  id = "id";
  data = new Map();
  unique = new Map();
  constructor(mdb, tablename, options) {
    this.mdb = mdb;
    this.name = tablename;
    this.options = options;
    //CHECK IDS
    if (options?.fields) {
      let testMultipleIds;
      for (const [field, properties] of Object.entries(options.fields)) {
        if (properties?.id) {
          if (testMultipleIds) {
            throw new Error("Multiple Ids Configured");
          }
          testMultipleIds = true;
          this.id = field;
        }
        if (properties?.unique) {
          this.unique.set(field, new Map());
        }
        if (properties?.hasOne) {
          this.mdb.createTable(`${properties.hasOne}-${this.name}`);
        }
      }
    }

    //CREATE ONE-MANY RELATION
    for (const hasOneField of options?.hasOne ?? []) {
    }
  }
  describe() {
    return { id: this.id, name: this.name, options: this.options };
  }
  insert(data) {
    if (typeof data != "object") {
      throw new error("Wrong data type");
    }
    //TODO MOVE CHECKS TO PROXY
    //CHECK ID EXIST IN OBJECTS
    if (this.id == "id" && !data[this.id]) {
      data[this.id] = randomHexString();
    }
    if (this.id != "id" && !data[this.id]) {
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
    const recordHandler = new RecordHandler(this);
    const record = new Proxy(data, recordHandler);
    return record;
  }
}

class RecordHandler {
  constructor(table) {
    return {
      //get: (target, prop, receiver) => {},
      set: function (target, key, value, proxy) {
        target[key] = value;
        console.log(`PROXY SET ${key} = ${value} `);
        return true;
      }.bind(table),
    };
  }
}

function randomHexString(size = 40) {
  return Crypto.randomBytes(size).toString("hex").slice(0, size);
}
