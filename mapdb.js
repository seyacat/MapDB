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

  uniques = new Map();
  constructor(mdb, tablename, options) {
    this.mdb = mdb;
    this.name = tablename;
    this.options = options;
    this.data = new Map();
    //CHECK IDS
    if (options?.fields) {
      let testMultipleIds;
      for (const [field, properties] of Object.entries(options.fields)) {
        if (properties?.id) {
          if (testMultipleIds) {
            throw new Error("Multiple Ids configured");
          }
          testMultipleIds = true;
          this.id = field;
        }
        //CREATE UNIQUES MAP
        if (properties?.unique) {
          console.log(field, properties);
          this.uniques.set(field, new Map());
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

    //CREATE RECORD AN POPULATE
    const recordHandler = new RecordHandler(this);
    const record = new Proxy({}, recordHandler);
    for (const [key, val] of Object.entries(data)) {
      record[key] = val;
    }
    //STORE RECORD

    this.data.set(data[this.id], record);

    //TODO fill oneMany relationship

    return record;
  }
}

class RecordHandler {
  constructor(table) {
    return {
      //get: (target, prop, receiver) => {},
      set: function (target, key, value, proxy) {
        const old_value = target[key];
        //IGNORE ON SAME
        if (target[key] === value) {
          return true;
        }
        //CHECK IF RECORD ALREADY EXISTS
        if (key == this.id) {
          if (this.data.has(value)) {
            throw new Error(`Id record ${key}:${value} already exists`);
          }
        }
        //CHECK UNIQUE
        if (this.uniques.has(key)) {
          if (this.uniques.get(key).has(value)) {
            throw new Error(`Record duplicated. ${key}:${value}`);
          }
        }

        //UPDATE CONSTRAINTS
        if (key == this.id && old_value) {
          this.data.set(value, this.data.get(old_value));
          this.data.delete(old_value);
        }
        if (this.uniques.has(key)) {
          this.uniques.get(key).delete(old_value);
          this.uniques.get(key).set(value);
        }
        target[key] = value;
        return true;
      }.bind(table),
    };
  }
}

function randomHexString(size = 40) {
  return Crypto.randomBytes(size).toString("hex").slice(0, size);
}
