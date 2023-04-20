class MapDB {
  constructor(config) {
    this.tables = new Map();
    if (config?.tables) {
      for (const [t, data] of Object.entries(config.tables)) {
        this.createTable(t, data);
      }
    }
    console.log(config);
    if (config?.relationships) {
      try {
        for (const [
          type1,
          table1,
          field1,
          type2,
          table2,
          field2,
        ] of config.relationships) {
          if (type1 == 'one')
            this.get(table2).options.fields[field1] = {
              hasOne: table1,
              fhField: field2,
            };
          if (type1 == 'many')
            this.get(table2).options.fields[field1] = {
              hasMany: table1,
              fhField: field2,
            };
          if (type2 == 'one')
            this.get(table1).options.fields[field2] = {
              hasOne: table2,
              fhField: field1,
            };
          if (type2 == 'many')
            this.get(table1).options.fields[field2] = {
              hasMany: table2,
              fhField: field1,
            };
          console.log(this.get(table1).options);
          console.log(this.get(table2).options);
        }
      } catch (e) {
        throw new Error(
          "Relation format is ['one'|'many',table1 name,fhField1 name,'one'|'many',table2 name,fhField2 name]"
        );
      }
    }
  }
  /**
   * Return useful information about main class
   * @returns
   */
  describe() {
    return { tables: [...this.tables.keys()] };
  }
  /**
   * Same as this.tables.get(name)
   * @param {string} name
   * @returns
   */
  get(name) {
    return this.tables.get(name);
  }
  /**
   * Create ne table
   * @param {string} tablename
   * @param {object} options
   * @returns
   */
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
/**
 * Table class
 */
class Table {
  //TODO Redis integration
  //TODO FIX UNIQUES BUG
  //uniques: Map { name: ❗Cannot read properties of null (reading 'toString') },
  //TODO Test one to one feature

  uniques = new Map();
  constructor(mdb, tablename, options) {
    /**
     * Main parent class
     * @type {MapDB}
     * @public
     */
    this.mdb = mdb;
    /**
     * Unique table name
     * @type {string}
     * @public
     */
    this.name = tablename;
    /**
     * Table options
     * @type {Object}
     * @public
     */
    this.options = options;
    /**
     * Table data
     * @type {Map}
     * @public
     */
    this.data = new Map();
    /**
     * Table id field name
     * @type {string}
     * @public
     */
    this.id = 'id';
    //CHECK IDS
    if (options?.fields) {
      let testMultipleIds;
      for (const [field, properties] of Object.entries(options.fields)) {
        let testDualRelationship;
        //VALIDATE OPTIONS
        //MULTIPLE IDS
        if (properties?.id) {
          if (testMultipleIds) {
            throw new Error('Multiple Ids configured');
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
          properties.pivotTable = `${relatedTables.join('-')}`;
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
          properties.pivotTable = `${relatedTables.join('-')}`;
          try {
            this.mdb.createTable(properties.pivotTable);
          } catch (e) {}
        }
      }
    }
  }
  /**
   * Return table useful information
   * @returns
   */
  describe() {
    return { id: this.id, name: this.name, options: this.options };
  }
  /**
   * Insert record
   * @param {Object} data - record data
   * @returns {Record} object
   */
  insert(data) {
    if (typeof data != 'object') {
      throw new Error('Wrong insert data type');
    }

    //CHECK ID EXIST IN OBJECTS
    if (this.id == 'id' && !data[this.id]) {
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
    if (this.id != 'id' && !data[this.id]) {
      throw new Error(`Missing ${this.id} field`);
    }

    //CREATE RECORD AN POPULATE

    const recordHandler = new RecordHandler(this);
    const record = new Proxy({}, recordHandler);
    record[this.id] = data[this.id];
    //STORE RECORD
    this.data.set(data[this.id], record);
    //PUPOLATE RECORD
    record['muted'] = true;
    for (const [key, val] of Object.entries(data)) {
      record[key] = val;
    }

    if (this.onInsertFunction) {
      this.onInsertFunction({ record, event: 'insert' });
    }
    if (this.onAnyFunction) {
      this.onAnyFunction({ record, event: 'insert' });
    }
    record['muted'] = false;
    return record;
  }
  /**
   * Update or insert record
   * @param {Object} data
   * @returns
   */
  upsert(data) {
    let record = this.get(data[this.id]);
    if (record) {
      return this.update(data);
    }
    return this.insert(data);
  }
  /**
   * Update record
   * @param {Object} data
   * @returns
   */
  update(data) {
    let record = this.get(data[this.id]);
    if (record) {
      let prev;
      try {
        prev = JSON.parse(JSON.stringify(record));
      } catch (e) {}
      record['muted'] = true;
      for (const [key, val] of Object.entries(data)) {
        record[key] = val;
      }
      if (this.onUpdateFunction) {
        this.onUpdateFunction({ record, event: 'update', prev });
      }
      if (this.onAnyFunction) {
        this.onAnyFunction({ record, event: 'update', prev });
      }
      record['muted'] = false;
      return record;
    }
    throw new Error('Missing record');
  }
  /**
   * delete record
   * @param {Object|string} obOrId
   */
  delete(obOrId) {
    let id;
    let record;
    if (typeof obOrId === 'object') {
      record = obOrId;
      id = record[this.id];
    } else {
      id = obOrId;
      record = this.data.get(obOrId);
    }
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
          Array.isArray(record[field + '_data'])
        ) {
          //REMOVE DATA FROM RELATED FIELD FIRST
          for (const relatedRecord of record[field + '_data']) {
            relatedRecord[properties.fhField] = null;
          }
          for (const relatedRecord of record[field + '_data']) {
            record.detach(field, relatedRecord[fhTable.id]);
          }
        }
        if (
          record[field] &&
          properties.hasOne &&
          record[field + '_data'] &&
          fhTable.options.fields?.[properties.fhField].hasMany
        ) {
          const relatedRecord = record[field + '_data'];
          relatedRecord.detach(properties.fhField, id);
        }
      }
    }
    this.data.delete(id);
  }
  /**
   * Same as data.get(Id);
   * @param {*} Id
   */
  get(Id) {
    return this.data.get(Id);
  }
  /**
   *
   * @param {function({record,event,field,prev}){}} fn callback function for any event
   */
  onAny(fn) {
    this.onAnyFunction = fn;
  }
  /**
   *
   * @param {function({record,event}){}} fn callback function for insert event
   */
  onInsert(fn) {
    this.onInsertFunction = fn;
  }
  /**
   *
   * @param {function({record,event}){}} fn callback function for update event
   */
  onUpdate(fn) {
    this.onUpdateFunction = fn;
  }
  /**
   *
   * @param {function({record,event,field,prev}){}} fn callback function for change FIELD event
   */
  onChange(fn) {
    this.onChangeFunction = fn;
  }
}

class RecordHandler {
  constructor(table) {
    return {
      get: function (target, prop, receiver) {
        //RELATED DATA RETURN
        if (typeof prop === 'string' && prop.includes('_data')) {
          let field;
          field = prop.replace('_data', '');
          const fieldOptions = this.options?.fields?.[field];
          if (fieldOptions?.hasMany) {
            const pivotTableName = this.options.fields[field].pivotTable;
            const pivotTable = this.mdb.tables.get(pivotTableName);
            if (!pivotTable.data.has(this.name + target[this.id])) {
              return null;
            }
            const forheignTable = this.mdb.tables.get(fieldOptions.hasMany);
            if (!forheignTable) {
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

          if (fieldOptions?.hasOne) {
            const forheignTable = this.mdb.tables.get(fieldOptions.hasOne);
            const parent = forheignTable.data.get(target[field]);
            return parent;
          }
        }

        const fieldOptions = this.options?.fields?.[prop];
        if (fieldOptions?.hasMany) {
          const pivotTableName = this.options.fields[prop].pivotTable;
          const pivotTable = this.mdb.tables.get(pivotTableName);
          if (!pivotTable.data.has(this.name + target[this.id])) {
            return null;
          }
          const childIds = pivotTable.data.get(this.name + target[this.id]);
          if (childIds?.size) {
            return '[...]';
          } else {
            return null;
          }
        }

        //ATTACH FUNCTION
        if (prop === 'attach') {
          //MANY TO MANY ATTACH
          return function (field, fhObOrId) {
            if (typeof field !== 'string') {
              throw new Error(`Field should be a string. ${field}`);
            }
            if (!fhObOrId) {
              throw new Error(`Null object ${field}`);
            }

            let fhId;
            let fhRecord;
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

            if (fhTable) {
              if (typeof fhObOrId === 'object') {
                fhRecord = fhObOrId;
                fhId = fhRecord[fhTable.id];
              } else {
                fhId = fhObOrId;
                fhRecord = fhTable.get(fhId);
              }
            }

            if (!pivotTableName || !fieldOptions?.hasMany) {
              throw new Error(`Not valid hasMany field (${field})`);
            }

            //UPDATE DATA TO HAS ONE
            if (fhFieldOptions.hasOne) {
              fhRecord[fhField] = target[this.id];
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
        } else if (prop === 'detach') {
          return function (field, fhObOrId) {
            if (typeof field !== 'string') {
              throw new Error(`Field should be a string. ${field}`);
            }
            let fhId;
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

            if (typeof fhObOrId === 'object') {
              let fhRecord = fhObOrId;
              fhId = fhRecord[fhTable.id];
            } else {
              fhId = fhObOrId;
            }

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
        //UPDATE LOCK TO BLOCK CALLBACKS
        if (key === 'muted') {
          if (value) {
            target[key] = value;
          } else {
            delete target[key];
          }
          return true;
        }
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

        //FILL IF HAS RELATIONSHIP
        let fhRecord;
        let fhId;
        if (
          value &&
          fhTable &&
          (fieldOptions?.hasMany || fieldOptions?.hasOne)
        ) {
          if (typeof value === 'object') {
            fhRecord = value;
            fhId = fhRecord[fhTable.id];
          } else {
            fhId = value;
            fhRecord = fhTable.data.get(fhId);
          }
        }

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
          fhId &&
          fieldOptions?.hasOne &&
          fieldOptions?.fhField &&
          fhTable?.options?.fields?.[fhField] &&
          !fhTable?.data.get(fhId)
        ) {
          throw new Error(`Not valid parent for field ${key}:${fhId} required`);
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

        //ASSIGN TARGET VALUE
        if (fieldOptions?.hasMany) {
          target[key] = '[???]';
        } else if (fhId) {
          target[key] = fhId;
        } else {
          target[key] = value;
        }

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
          fhTable?.data?.has(fhId)
        ) {
          this.data.get(target[this.id]).attach(key, fhId);
        }

        //UPDATE ONE-ONE RELATION
        if (
          fhField &&
          fhPivotTable &&
          fieldOptions?.hasOne &&
          fhFieldOptions?.hasOne &&
          fhTable?.data?.has(fhId) &&
          fhTable.data.get(fhId)[fhField] != target[this.id]
        ) {
          fhTable.data.get(fhId)[fhField] = target[this.id];
        }
        //UPDATE ONE-MANY RELATION

        if (
          fhField &&
          fhPivotTable &&
          fieldOptions?.hasOne &&
          fhFieldOptions?.hasMany &&
          value
        ) {
          insertInPivotTable(
            fhId,
            old_value,
            target[this.id],
            fhTable,
            fhPivotTable
          );
        }

        //CALLBACKS
        let record = this.get(target[this.id]);
        if (this.onChangeFunction && record && !record['muted']) {
          record.muted = true;
          this.onChangeFunction({
            record,
            event: 'change',
            field: key,
            prev: old_value,
          });
          record.muted = false;
        }
        if (this.onAnyFunction && record && !record['muted']) {
          record.muted = true;
          this.onAnyFunction({
            record,
            event: 'change',
            field: key,
            prev: old_value,
          });
          record.muted = false;
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

function randomHexString(len = 40) {
  let output = '';
  for (let i = 0; i < len; ++i) {
    output += Math.floor(Math.random() * 16).toString(16);
  }
  return output;
}

//DUMMIE JSDOC CLASS
/**
 * Proxy Record class
 */
class Record {
  /**
   * Attach related object relation
   * @param {string} field local field
   * @param {Object|string} fhObOrId foreign object or id
   */
  attach = (field, fhObOrId) => {};
  /**
   * Detach related object relation
   * @param {string} field local field
   * @param {Object|string} fhObOrId foreign object or id
   */
  detach = (field, fhObOrId) => {};
}

module.exports = { MapDB };
