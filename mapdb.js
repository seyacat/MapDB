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
  //TODO FIX UNIQUES BUG
  //uniques: Map { name: ❗Cannot read properties of null (reading 'toString') },
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
        let testDualRelationship;
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
          const relatedTables = [this.name, properties.hasOne];
          relatedTables.sort();
          properties.pivotTable = `${relatedTables.join("-")}`;
          try {
            this.mdb.createTable(properties.pivotTable);
          } catch (e) {}
          testDualRelationship = true;
        }
        if (properties?.hasMany) {
          if (testDualRelationship) {
            throw new Error(
              `Multiple relationship configured in this field. ${field}`
            );
          }
          const relatedTables = [this.name, properties.hasMany];
          relatedTables.sort();
          properties.pivotTable = `${relatedTables.join("-")}`;
          try {
            this.mdb.createTable(properties.pivotTable);
          } catch (e) {}
        }
      }
    }
  }
  toString = function () {
    return describe();
  };
  describe() {
    return { id: this.id, name: this.name, options: this.options };
  }
  insert(data) {
    if (typeof data != "object") {
      throw new error("Wrong data type");
    }

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

    return record;
  }
  //TODO HANDLE DELETES
}

class RecordHandler {
  constructor(table) {
    return {
      get: function (target, prop, receiver) {
        let field;
        if (typeof prop === "string" && prop.includes("_data")) {
          field = prop.replace("_data", "");
        }

        if (this.options?.fields?.[prop]?.hasMany) {
          const fieldOptions = this.options?.fields?.[prop];
          const pivotTableName = this.options.fields[prop].pivotTable;
          const pivotTable = this.mdb.tables.get(pivotTableName);
          const childIds = pivotTable.data.get(target[this.id]);
          if (childIds?.length) {
            return "[...]";
          } else {
            return null;
          }
        }
        if (this.options?.fields?.[field]?.hasMany) {
          const fieldOptions = this.options?.fields?.[field];
          const pivotTableName = this.options.fields[field].pivotTable;
          const pivotTable = this.mdb.tables.get(pivotTableName);
          const forheignTable = this.mdb.tables.get(fieldOptions.hasMany);
          const childIds = pivotTable.data.get(target[this.id]);
          if (!childIds) return null;
          const childs = [];
          for (const childId of childIds) {
            childs.push(forheignTable.data.get(childId));
          }
          return childs;
        }

        if (this.options?.fields?.[prop]?.hasOne) {
          const fieldOptions = this.options?.fields?.[prop];
          const forheignTable = this.mdb.tables.get(fieldOptions.hasOne);
          const parent = forheignTable.data.get(target[prop]);
          if (parent) {
            return "[...]";
          } else {
            return null;
          }
        }
        if (this.options?.fields?.[field]?.hasOne) {
          const fieldOptions = this.options?.fields?.[field];
          const forheignTable = this.mdb.tables.get(fieldOptions.hasOne);
          const parent = forheignTable.data.get(target[field]);
          return parent;
        }

        if (prop === "attach") {
          //MANY TO MANY ATTACH
          return function (field, forheignId) {
            if (
              !this.options?.fields?.[field]?.pivotTable ||
              !this.options?.fields?.[field]?.hasMany
            ) {
              throw new Error(`Not valid hasMany field (${field})`);
            }
            const fieldOptions = this.options?.fields?.[field];
            const pivotTableName = this.options.fields[field].pivotTable;
            const pivotTable = this.mdb.tables.get(pivotTableName);
            const forheignTable = this.mdb.tables.get(fieldOptions.hasMany);
            //VALIDATE REMOTE ID
            if (!forheignTable.data.get(forheignId)) {
              throw new Error(`Not valid forheign Id (${forheignId})`);
            }

            //CREATE SET IF NOT EXISTS
            if (!pivotTable.data.has(target[this.id])) {
              pivotTable.data.set(target[this.id], new Set());
            }
            pivotTable.data.get(target[this.id]).add(forheignId);

            return;
          }.bind(this);
        } else {
          return target[prop];
        }
      }.bind(table),
      set: function (target, key, value, proxy) {
        const old_value = target[key];
        const fieldOptions = this.options?.fields?.[key];
        let forheignTable;

        if (fieldOptions?.hasOne) {
          forheignTable = fieldOptions?.hasOne
            ? this.mdb.tables.get(fieldOptions.hasOne)
            : null;
        }
        if (fieldOptions?.hasMany) {
          forheignTable = fieldOptions?.hasMany
            ? this.mdb.tables.get(fieldOptions.hasMany)
            : null;
        }

        //CHECK REQUIRED
        if (fieldOptions?.required && !value) {
          throw new Error(`Field (${key}) required`);
        }
        //CHECK FOREING
        if (
          (fieldOptions?.hasOne || fieldOptions?.hasMany) &&
          fieldOptions?.fhField &&
          !forheignTable?.options?.fields?.[fieldOptions?.fhField]
        ) {
          throw new Error(
            `Configuration required on forheigh table ${
              fieldOptions?.hasOne ?? fieldOptions?.hasMany
            }`
          );
        }
        if (
          fieldOptions?.hasOne &&
          fieldOptions?.fhField &&
          forheignTable?.options?.fields?.[fieldOptions?.fhField] &&
          !forheignTable?.data.get(value)
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

          if (
            fieldOptions?.fhField &&
            forheignTable?.options?.fields?.[fieldOptions?.fhField]?.hasMany &&
            forheignTable?.data?.has(value)
          ) {
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
