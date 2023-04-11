const Crypto = require("crypto");

class MapDB {
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
  //TODO Test one to one feature
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
      throw new Error("Wrong insert data type");
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
  delete(id) {
    const record = this.data.get(id);
    //REMOVE RELATED DATA
    if (this.options?.fields) {
      for (const [field, properties] of Object.entries(this.options.fields)) {
        let fhTable;
        if (properties.hasMany) {
          fhTable = this.mdb.tables.get(properties.hasMany);
        }
        if (properties.hasOne) {
          fhTable = this.mdb.tables.get(properties.hasOne);
        }

        if (
          record[field] &&
          properties.hasMany &&
          Array.isArray(record[field + "_data"])
        ) {
          //REMOVE DATA FROM RELATED FIELD FIRST
          for (const relatedRecord of record[field + "_data"]) {
            relatedRecord[properties.fhField] = null;
          }
          for (const relatedRecord of record[field + "_data"]) {
            record.detach(field, relatedRecord[fhTable.id]);
          }
        }
        if (
          record[field] &&
          properties.hasOne &&
          record[field + "_data"] &&
          fhTable.options.fields?.[properties.fhField].hasMany
        ) {
          const relatedRecord = record[field + "_data"];
          relatedRecord.detach(properties.fhField, id);
        }
      }
    }
    this.data.delete(id);
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
          if (!pivotTable.data.has(this.name + target[this.id])) {
            return null;
          }
          const childIds = pivotTable.data.get(this.name + target[this.id]);
          if (childIds?.size) {
            return "[...]";
          } else {
            return null;
          }
        }

        if (field && this.options?.fields?.[field]?.hasMany) {
          const fieldOptions = this.options?.fields?.[field];
          const pivotTableName = this.options.fields[field].pivotTable;
          const pivotTable = this.mdb.tables.get(pivotTableName);
          const forheignTable = this.mdb.tables.get(fieldOptions.hasMany);
          if (!pivotTable.data.has(this.name + target[this.id])) {
            return null;
          }
          const childIds = pivotTable.data.get(this.name + target[this.id]);
          if (!childIds.size) return null;
          const childs = [];
          for (const childId of childIds) {
            const rel = forheignTable.data.get(childId);
            if (rel) {
              childs.push(forheignTable.data.get(childId));
            }
          }
          if (!childs.length) return null;
          return childs;
        }

        if (field && this.options?.fields?.[field]?.hasOne) {
          const fieldOptions = this.options?.fields?.[field];
          const forheignTable = this.mdb.tables.get(fieldOptions.hasOne);
          const parent = forheignTable.data.get(target[field]);
          return parent;
        }
        //ATTACH FUNCTION
        if (prop === "attach") {
          //MANY TO MANY ATTACH
          return function (field, fhId) {
            const {
              pivotTableName,
              pivotTable,
              fieldOptions,
              fhFieldOptions,
              fhTable,
              fhPivotTableName,
              fhPivotTable,
              fhField,
            } = getVars(this, field);

            if (!pivotTableName || !fieldOptions?.hasMany) {
              throw new Error(`Not valid hasMany field (${field})`);
            }

            //UPDATE DATA TO HAS ONE
            if (fhFieldOptions.hasOne) {
              const oldId = fhTable.data.get(fhId);
              oldId[fhField] = target[this.id];
              return;
            }

            //VALIDATE REMOTE ID
            if (!fhTable.data.get(fhId)) {
              throw new Error(`Not valid forheign Id (${fhId})`);
            }

            //CREATE SET IF NOT EXISTS
            if (!pivotTable.data.has(this.name + target[this.id])) {
              pivotTable.data.set(this.name + target[this.id], new Set());
            }
            //POLULATE PIVOTABLE
            insertInPivotTable(target[this.id], null, fhId, this, pivotTable);

            // REMOVE OLD RELATION

            //TODO POPULATE FORHEIGN DATA
            if (
              fieldOptions?.fhField &&
              fhFieldOptions?.hasMany &&
              fhTable?.data?.has(fhId)
            ) {
              insertInPivotTable(
                fhId,
                null,
                target[this.id],
                fhTable,
                pivotTable
              );
            }

            return;
          }.bind(this);
        } else if (prop === "detach") {
          return function (field, fhId) {
            const {
              pivotTableName,
              pivotTable,
              fieldOptions,
              fhFieldOptions,
              fhTable,
              fhPivotTableName,
              fhPivotTable,
              fhField,
              tableName,
              fhTableName,
            } = getVars(this, field);
            if (!pivotTableName || !fieldOptions?.hasMany) {
              throw new Error(`Not valid hasMany field (${field})`);
            }
            deleteInPivotTable(
              target[this.id],
              fhId,
              tableName,
              fhTableName,
              pivotTable
            );
          }.bind(this);
        } else {
          return target[prop];
        }
      }.bind(table),
      set: function (target, key, value, proxy) {
        const old_value = target[key];
        const {
          fieldOptions,
          fhFieldOptions,
          fhTableName,
          fhTable,
          fhPivotTableName,
          fhPivotTable,
          fhField,
        } = getVars(this, key);

        //CHECK REQUIRED
        if (fieldOptions?.required && !value) {
          throw new Error(`Table (${this.name}) field (${key}) required`);
        }
        //CHECK MATCH
        if (fieldOptions?.match && !fieldOptions?.match.test(value)) {
          throw new Error(
            `Table (${this.name}) field (${key}) not match ${fieldOptions?.match} `
          );
        }
        //CHECK FOREING EXISTS
        if (!fhTable && (fieldOptions?.hasOne || fieldOptions?.hasMany)) {
          throw new Error(
            `Table (${this.name}) configuration required a forheigh missing table (${fhTableName}) field (${fhField})`
          );
        }
        if (
          fieldOptions?.required &&
          fieldOptions?.hasOne &&
          fieldOptions?.fhField &&
          fhTable?.options?.fields?.[fhField] &&
          !fhTable?.data.get(value)
        ) {
          throw new Error(
            `Not valid parent for field ${key}:${value} required`
          );
        }

        //IGNORE ON SAME
        if (target[key] === value) {
          return true;
        }
        //CHECK IF RECORD ID ALREADY EXISTS
        if (key == this.id && this.data.has(value)) {
          throw new Error(`Id record ${key}:${value} already exists`);
        }
        //CHECK UNIQUE
        if (this.uniques.has(key)) {
          if (this.uniques.get(key).has(value)) {
            throw new Error(`Record duplicated. ${key}:${value}`);
          }
        }

        target[key] = value;

        //UPDATE KEY IN TABLE
        if (key == this.id && old_value) {
          this.data.set(value, this.data.get(old_value));
          this.data.delete(old_value);
        }
        //UPDATE UNIQUE INDEXES
        if (this.uniques.has(key)) {
          this.uniques.get(key).delete(old_value);
          this.uniques.get(key).set(value);
        }
        //UPDATE MANY-X RELATION
        if (
          fhField &&
          fhPivotTable &&
          fieldOptions?.hasMany &&
          (fhFieldOptions?.hasOne || fhFieldOptions?.hasMany) &&
          fhTable?.data?.has(value)
        ) {
          //return true;
          this.data.get(target[this.id]).attach(key, value);
        }
        //UPDATE ONE-ONE RELATION
        if (
          fhField &&
          fhPivotTable &&
          fieldOptions?.hasOne &&
          fhFieldOptions?.hasOne &&
          fhTable?.data?.has(value) &&
          fhTable.data.get(value)[fhField] !== target[this.id]
        ) {
          fhTable.data.get(value)[fhField] = target[this.id];
        }
        //UPDATE ONE-MANY RELATION
        if (
          fhField &&
          fhPivotTable &&
          fieldOptions?.hasOne &&
          fhFieldOptions?.hasMany &&
          fhTable?.data?.has(value)
        ) {
          insertInPivotTable(
            value,
            old_value,
            target[this.id],
            fhTable,
            fhPivotTable
          );
        }

        return true;
      }.bind(table),
    };
  }
}

function getVars(table, key) {
  const tableName = table.name;
  const fieldOptions = table.options?.fields?.[key];
  const pivotTableName = fieldOptions?.pivotTable;
  const pivotTable = table.mdb.tables.get(pivotTableName);
  let fhFieldOptions;
  let fhTableName;
  let fhTable;
  let fhPivotTableName;
  let fhPivotTable;
  const fhField = fieldOptions?.fhField;

  if (fieldOptions?.hasOne) {
    fhTable = fieldOptions?.hasOne
      ? table.mdb.tables.get(fieldOptions.hasOne)
      : null;
    fhTableName = fieldOptions?.hasOne;
    fhFieldOptions = fhTable?.options?.fields?.[fhField];
    fhPivotTableName = fhFieldOptions?.pivotTable;
    fhPivotTable = table.mdb.tables.get(fhPivotTableName);
  }
  if (fieldOptions?.hasMany) {
    fhTable = fieldOptions?.hasMany
      ? table.mdb.tables.get(fieldOptions.hasMany)
      : null;
    fhTableName = fieldOptions?.hasMany;
    fhFieldOptions = fhTable?.options?.fields?.[fhField];
    fhPivotTableName = fhFieldOptions?.pivotTable;
    fhPivotTable = table.mdb.tables.get(fhPivotTableName);
  }

  return {
    tableName,
    fieldOptions,
    pivotTableName,
    pivotTable,
    fhFieldOptions,
    fhTable,
    fhTableName,
    fhPivotTableName,
    fhPivotTable,
    fhField,
  };
}

function deleteInPivotTable(id, fhid, tableName, fhTableName, pivotTable) {
  if (
    pivotTable.data.has(tableName + id) &&
    pivotTable.data.get(tableName + id).has(fhid)
  ) {
    pivotTable.data.get(tableName + id).delete(fhid);
    if (pivotTable.data.get(tableName + id).size <= 0) {
      pivotTable.data.delete(tableName + id);
    }
  }
  if (
    pivotTable.data.has(fhTableName + fhid) &&
    pivotTable.data.get(fhTableName + fhid).has(id)
  ) {
    pivotTable.data.get(fhTableName + fhid).delete(id);
    if (pivotTable.data.get(fhTableName + fhid).size <= 0) {
      pivotTable.data.delete(fhTableName + fhid);
    }
  }
}

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

module.exports = { MapDB };
