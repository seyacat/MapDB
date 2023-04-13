const { MapDB } = require("../mapdb.js");
const chai = require("chai");
const assert = require("assert");
const { table } = require("console");

const mdb = new MapDB();

const testTable1 = mdb.createTable("testTable1", {
  fields: {
    t1: { id: true },
    t2: { hasOne: "testTable2", fhField: "t1" },
    t3: { hasOne: "testTable3", fhField: "t1" },
    t4: { hasMany: "testTable4", fhField: "t1" },
  },
});

const testTable2 = mdb.createTable("testTable2", {
  fields: {
    t2: { id: true },
    t1: { hasOne: "testTable1", fhField: "t2" },
  },
});

const testTable3 = mdb.createTable("testTable3", {
  fields: {
    t1: { hasMany: "testTable1", fhField: "t3" },
  },
});

const testTable4 = mdb.createTable("testTable4", {
  fields: {
    t1: { hasMany: "testTable1", fhField: "t4" },
  },
});

/*console.log(
  `${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`
);*/

for (let i = 0; i < 200; i++) {
  const t1 = testTable1.insert({
    t1: Math.random(),
    rand2: Math.random(),
    rand3: Math.random(),
  });
  const t2 = testTable2.insert({
    t2: Math.random(),
    rand2: Math.random(),
    rand3: Math.random(),
  });
  const t3 = testTable3.insert({
    rand: Math.random(),
    rand2: Math.random(),
    rand3: Math.random(),
  });
  const t4 = testTable4.insert({
    rand: Math.random(),
    rand2: Math.random(),
    rand3: Math.random(),
  });
  switch (Math.round(Math.random() * 2)) {
    case 0:
      t2.t1 = t1.t1;
      break;
    case 1:
      t3.t1 = t1.t1;
      break;
    case 2:
      t4.t1 = t1.t1;
      break;
  }
}

/*for (const t of mdb.tables) {
  console.log(t[0], t[1].data.size);
}*/
/*console.log(
  `${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`
);*/

const tables = [testTable1, testTable2, testTable3, testTable4];
for (let j = 0; j < 1000000; j++) {
  if (
    testTable1.data.size +
      testTable2.data.size +
      testTable3.data.size +
      testTable4.data.size <=
    0
  ) {
    break;
  }
  const table = tables[j % 4];
  const first = table.data.entries().next().value?.[1];
  if (first) {
    table.delete(first);
  }
}

/*for (const t of mdb.tables) {
  console.log(t[0], t[1].data.size);
}*/

/*console.log(
  `${Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100} MB`
);*/

//TODO Assert comments
