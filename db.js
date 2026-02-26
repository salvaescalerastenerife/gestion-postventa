const DB_NAME = 'gp_oliver_db';
const DB_VER = 1;

let _db = null;

export async function dbInit(){
  if (_db) return _db;

  _db = await new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);

    req.onupgradeneeded = (e)=>{
      const db = req.result;

      // imports: one row per PDF imported
      if (!db.objectStoreNames.contains('imports')){
        const s = db.createObjectStore('imports', { keyPath: 'import_id' });
        s.createIndex('by_date', 'date_detected', { unique:false });
        s.createIndex('by_imported_at', 'imported_at', { unique:false });
      }

      // interventions: unique real interventions
      if (!db.objectStoreNames.contains('interventions')){
        const s = db.createObjectStore('interventions', { keyPath: 'uid' });
        s.createIndex('by_date', 'date', { unique:false });
        s.createIndex('by_client', 'client_id', { unique:false });
        s.createIndex('by_type', 'type', { unique:false });
        s.createIndex('by_date_client', ['date','client_id'], { unique:false });
      }

      // meta: simple key/value
      if (!db.objectStoreNames.contains('meta')){
        db.createObjectStore('meta', { keyPath: 'k' });
      }
    };

    req.onerror = ()=> reject(req.error);
    req.onsuccess = ()=> resolve(req.result);
  });

  return _db;
}

function tx(storeName, mode='readonly'){
  const t = _db.transaction(storeName, mode);
  return t.objectStore(storeName);
}

export async function dbMetaGet(k){
  await dbInit();
  return await new Promise((resolve)=>{
    const req = tx('meta').get(k);
    req.onsuccess = ()=> resolve(req.result?.v ?? null);
    req.onerror = ()=> resolve(null);
  });
}

export async function dbMetaSet(k, v){
  await dbInit();
  return await new Promise((resolve, reject)=>{
    const store = tx('meta', 'readwrite');
    const req = store.put({ k, v });
    req.onsuccess = ()=> resolve(true);
    req.onerror = ()=> reject(req.error);
  });
}

// Imports
export async function dbImportsPutMany(items){
  await dbInit();
  return await new Promise((resolve, reject)=>{
    const store = tx('imports', 'readwrite');
    for (const it of items) store.put(it);
    store.transaction.oncomplete = ()=> resolve(true);
    store.transaction.onerror = ()=> reject(store.transaction.error);
  });
}

export async function dbImportsListRecent(limit=20){
  await dbInit();
  return await new Promise((resolve)=>{
    const store = tx('imports');
    const idx = store.index('by_imported_at');
    const out = [];
    idx.openCursor(null, 'prev').onsuccess = (e)=>{
      const cur = e.target.result;
      if (!cur || out.length >= limit) return resolve(out);
      out.push(cur.value);
      cur.continue();
    };
  });
}

export async function dbImportsListByDate(date){
  await dbInit();
  return await new Promise((resolve)=>{
    const store = tx('imports');
    const idx = store.index('by_date');
    const out = [];
    idx.openCursor(IDBKeyRange.only(date)).onsuccess = (e)=>{
      const cur = e.target.result;
      if (!cur) return resolve(out);
      out.push(cur.value);
      cur.continue();
    };
  });
}

// Interventions
export async function dbInterventionGet(uid){
  await dbInit();
  return await new Promise((resolve)=>{
    const req = tx('interventions').get(uid);
    req.onsuccess = ()=> resolve(req.result ?? null);
    req.onerror = ()=> resolve(null);
  });
}

export async function dbInterventionsPutMany(items){
  await dbInit();
  return await new Promise((resolve, reject)=>{
    const store = tx('interventions', 'readwrite');
    for (const it of items) store.put(it);
    store.transaction.oncomplete = ()=> resolve(true);
    store.transaction.onerror = ()=> reject(store.transaction.error);
  });
}

export async function dbInterventionsListByDate(date){
  await dbInit();
  return await new Promise((resolve)=>{
    const store = tx('interventions');
    const idx = store.index('by_date');
    const out = [];
    idx.openCursor(IDBKeyRange.only(date)).onsuccess = (e)=>{
      const cur = e.target.result;
      if (!cur) return resolve(out);
      out.push(cur.value);
      cur.continue();
    };
  });
}

export async function dbInterventionsListByClient(clientId, { from=null, to=null, type=null } = {}){
  await dbInit();
  return await new Promise((resolve)=>{
    const store = tx('interventions');
    const idx = store.index('by_client');
    const out = [];
    idx.openCursor(IDBKeyRange.only(clientId)).onsuccess = (e)=>{
      const cur = e.target.result;
      if (!cur) return resolve(out
        .filter(x => !type || x.type === type)
        .filter(x => !from || x.date >= from)
        .filter(x => !to || x.date <= to)
        .sort((a,b)=> (a.date < b.date ? 1 : -1))
      );
      out.push(cur.value);
      cur.continue();
    };
  });
}

export async function dbInterventionsSearch({ client=null, from=null, to=null, type=null } = {}){
  await dbInit();
  // naive scan (V1). Enough for local scale.
  return await new Promise((resolve)=>{
    const store = tx('interventions');
    const out = [];
    store.openCursor().onsuccess = (e)=>{
      const cur = e.target.result;
      if (!cur) return resolve(
        out
          .filter(x => !client || String(x.client_id).includes(client))
          .filter(x => !type || x.type === type)
          .filter(x => !from || x.date >= from)
          .filter(x => !to || x.date <= to)
          .sort((a,b)=> (a.date < b.date ? 1 : -1))
      );
      out.push(cur.value);
      cur.continue();
    };
  });
}

export async function dbInterventionsDistinctDates(){
  await dbInit();
  return await new Promise((resolve)=>{
    const store = tx('interventions');
    const dates = new Set();
    store.index('by_date').openKeyCursor().onsuccess = (e)=>{
      const cur = e.target.result;
      if (!cur) return resolve(Array.from(dates).sort());
      dates.add(cur.key);
      cur.continue();
    };
  });
}

export async function dbAllDump(){
  await dbInit();
  const dumpStore = (name)=> new Promise((resolve)=>{
    const out = [];
    tx(name).openCursor().onsuccess = (e)=>{
      const cur = e.target.result;
      if (!cur) return resolve(out);
      out.push(cur.value);
      cur.continue();
    };
  });
  return {
    schema_version: DB_VER,
    exported_at: new Date().toISOString(),
    imports: await dumpStore('imports'),
    interventions: await dumpStore('interventions'),
    meta: await dumpStore('meta')
  };
}

export async function dbAllReplace(dump){
  await dbInit();
  // Clear and repopulate (V1 simple)
  const clearStore = (name)=> new Promise((resolve, reject)=>{
    const store = tx(name, 'readwrite');
    store.clear();
    store.transaction.oncomplete = ()=> resolve(true);
    store.transaction.onerror = ()=> reject(store.transaction.error);
  });
  await clearStore('imports');
  await clearStore('interventions');
  await clearStore('meta');

  if (dump?.imports?.length) await dbImportsPutMany(dump.imports);
  if (dump?.interventions?.length) await dbInterventionsPutMany(dump.interventions);
  if (dump?.meta?.length) {
    await new Promise((resolve, reject)=>{
      const store = tx('meta', 'readwrite');
      for (const it of dump.meta) store.put(it);
      store.transaction.oncomplete = ()=> resolve(true);
      store.transaction.onerror = ()=> reject(store.transaction.error);
    });
  }
}
