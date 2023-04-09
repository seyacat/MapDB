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
  //TODO Redis integration
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
        //CHECK FORHEIGN CONFIGURATION
        if (
          (properties?.hasOne || properties?.hasMany) &&
          !properties?.fhField
        ) {
          throw new Error(`Related field (${field}) requires fhField`);
        }
        //INITIATE TABLE
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
          const childIds = pivotTable.data.get(this.name + target[this.id]);
          if (childIds?.size) {
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
          const childIds = pivotTable.data.get(this.name + target[this.id]);
          if (!childIds) return null;
          const childs = [];
          for (const childId of childIds) {
            childs.push(forheignTable.data.get(childId));
          }
          return childs;
        }

        if (this.options?.fields?.[field]?.hasOne) {
          const fieldOptions = this.options?.fields?.[field];
          const forheignTable = this.mdb.tables.get(fieldOptions.hasOne);
          const parent = forheignTable.data.get(target[field]);
          return parent;
        }
        //ATTACH FUNCTION
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
            const fhField = this.options?.fields?.fhField;
            //VALIDATE REMOTE ID
            if (!forheignTable.data.get(forheignId)) {
              throw new Error(`Not valid forheign Id (${forheignId})`);
            }

            //CREATE SET IF NOT EXISTS
            if (!pivotTable.data.has(this.name + target[this.id])) {
              pivotTable.data.set(this.name + target[this.id], new Set());
            }
            //POLULATE PIVO TBLE
            insertInPivotTable(
              target[this.id],
              null,
              forheignId,
              this,
              pivotTable
            );
            //pivotTable.data.get(this.name + target[this.id]).add(forheignId);

            //TODO POPULATE FORHEIGN DATA
            if (
              fieldOptions?.fhField &&
              forheignTable?.options?.fields?.[fieldOptions?.fhField]
                ?.hasMany &&
              forheignTable?.data?.has(forheignId)
            ) {
              insertInPivotTable(
                forheignId,
                null,
                target[this.id],
                forheignTable,
                pivotTable
              );
            }

            return;
          }.bind(this);
        } else if (prop === "detach") {
          return () => {};
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
            `Table (${this.name}) configuration required on forheigh table (${
              forheignTable?.name
            }) field (${fieldOptions?.fhField}) ${
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

        //FILL FORHEIGH
        if (
          fieldOptions?.fhField &&
          forheignTable?.options?.fields?.[fieldOptions?.fhField]?.hasMany &&
          forheignTable?.data?.has(value)
        ) {
          console.log();
          const fhPivotTableName =
            forheignTable.options.fields[fieldOptions?.fhField].pivotTable;
          const fhPivotFhTable = this.mdb.tables.get(fhPivotTableName);
          insertInPivotTable(
            value,
            old_value,
            target[this.id],
            forheignTable,
            fhPivotFhTable
          );
        }

        target[key] = value;
        return true;
      }.bind(table),
    };
  }
}

function deleteInPivotTable() {}

function insertInPivotTable(id, old_id, value, table, pivotTable) {
  //CREATE SET IF NOT EXISTS ON PIVOT
  if (!pivotTable.data.has(table.name + id)) {
    pivotTable.data.set(table.name + id, new Set());
  }
  if (pivotTable.data.has(table.name + old_id)) {
    pivotTable.data.get(table.name + old_id).delete(value);
    //DELETE SET IF ITS NULL
    if (pivotTable.data.get(table.name + old_id).size <= 0) {
      pivotTable.data.delete(table.name + old_id);
    }
  }
  pivotTable.data.get(table.name + id).add(value);
}

function randomHexString(size = 40) {
  return Crypto.randomBytes(size).toString("hex").slice(0, size);
}
