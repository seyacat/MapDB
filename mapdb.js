import Crypto from "crypto";

export default class {
  constructor() {
    this.tables = new Map();
  }
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
  uniques = new Map();
  constructor(mdb, tablename, options) {
    this.mdb = mdb;
    this.name = tablename;
    this.options = options;
    this.data = new Map();
    this.id = "id";
    //CHECK IDS
    if (options?.fields) {
      let testMultipleIds;
      for (const [field, properties] of Object.entries(options.fields)) {
        //VALIDATE OPTIONS
        //MULTIPLE IDS
        if (properties?.id) {
          if (testMultipleIds) {
            throw new Error("Multiple Ids configured");
          }
          testMultipleIds = true;
          this.id = field;
        }
        //CREATE UNIQUES MAP
        if (properties?.unique) {
          this.uniques.set(field, new Map());
        }
        if (properties?.hasOne) {
          properties.pivotTable = `${properties.hasOne}-${this.name}-${field}`;
          this.mdb.createTable(properties.pivotTable);
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
    //POPULATED DECLARED FIELD ON NULL
    if (this.options?.fields) {
      for (const field of Object.keys(this.options.fields)) {
        if (!data[field]) {
          data[field] = null;
        }
      }
    }
    if (this.id != "id" && !data[this.id]) {
      throw new Error(`Missing ${this.id} field`);
    }

    //CREATE RECORD AN POPULATE
    const recordHandler = new RecordHandler(this);
    const record = new Proxy({}, recordHandler);
    record[this.id] = data[this.id];
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
        const fieldOptions = this.options?.fields?.[key];

        //CHECK REQUIRED
        if (fieldOptions?.required && !value) {
          throw new Error(`Field (${key}) required`);
        }
        //CHECK FOREINGREQUIRED
        if (
          fieldOptions?.hasOne &&
          fieldOptions?.notForeignRequired !== true &&
          value &&
          !this.mdb.tables.get(this.options.fields[key].hasOne)?.data.get(value)
        ) {
          throw new Error(
            `Not valid parent for field ${key}:${value} required`
          );
        }
        //IGNORE ON SAME
        if (target[key] === value) {
          return true;
        }
        //CHECK IF RECORD ALREADY EXISTS
        if (key == this.id && this.data.has(value)) {
          throw new Error(`Id record ${key}:${value} already exists`);
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
        //forheign data

        if (fieldOptions?.hasOne) {
          const pivotTableName = this.options.fields[key].pivotTable;
          const pivotTable = this.mdb.tables.get(pivotTableName);
          const forheignTable = this.mdb.tables.get(fieldOptions.hasOne);
          if (forheignTable.data.has(value)) {
            //CREATE SET IF NOT EXISTS ON PIVOT
            if (!pivotTable.data.has(value)) {
              pivotTable.data.set(value, new Set());
            }
            if (pivotTable.data.has(old_value)) {
              pivotTable.data.get(old_value).delete(target[this.id]);
              //DELETE SET IF ITS NULL
              if (pivotTable.data.get(old_value).size <= 0) {
                pivotTable.data.delete(old_value);
              }
            }

            pivotTable.data.get(value).add(target[this.id]);
          }
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
