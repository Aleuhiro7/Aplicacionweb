/* Recuperar datos guardados en este dispositivo (Ajustes → «Recuperar datos»).
 *
 * Busca versiones de tus datos que estén guardadas en este navegador:
 *  - Las copias de seguridad automáticas que se hacen antes de que la nube sustituya o junte los datos.
 *  - El almacenamiento interno de Firebase de versiones anteriores de la app: ahí se quedaban los cambios
 *    que no llegaron a subirse a la nube (la «cola» de cambios pendientes) y la última copia recibida.
 * Cada versión encontrada se puede JUNTAR con lo que hay ahora (no se borra nada: por cada registro gana el
 * cambio más reciente y se añade lo que falte) y después se sube a la nube. */
(function () {
  'use strict';

  /** Recorre cualquier valor y avisa de cada texto que sea una copia completa de los datos de la app. */
  function walk(value, found, meta, depth = 0) {
    if (depth > 12 || value == null) return;
    if (typeof value === 'string') {
      if (value.length > 200 && value[0] === '{' && value.includes('"clients"')) {
        try {
          const obj = JSON.parse(value);
          if (obj && Array.isArray(obj.clients)) found.push(Object.assign({ json: value, data: obj }, meta));
        } catch (e) { /* no es una copia */ }
      }
      return;
    }
    if (typeof value !== 'object') return;
    const m = Object.assign({}, meta);
    if (typeof value.localWriteTimeMs === 'number') m.time = value.localWriteTimeMs;
    if (Array.isArray(value)) { for (const v of value) walk(v, found, m, depth + 1); return; }
    for (const k of Object.keys(value)) walk(value[k], found, m, depth + 1);
  }

  const openDb = (name) => new Promise((res, rej) => {
    const r = indexedDB.open(name);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('bloqueada'));
  });
  const getAll = (db, store) => new Promise((res) => {
    try {
      const r = db.transaction(store, 'readonly').objectStore(store).getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => res([]);
    } catch (e) { res([]); }
  });

  /** Todas las versiones de tus datos que hay en este dispositivo (sin repetir), de la más completa a la menos. */
  async function scan() {
    const found = [];
    // 1) Copias automáticas
    for (const b of Store.backups()) {
      try { found.push({ json: b.json, data: JSON.parse(b.json), time: Date.parse(b.at), source: `Copia automática (${b.reason})` }); } catch (e) { /* dañada */ }
    }
    // 2) Almacenamiento interno de Firebase (versiones anteriores de la app)
    let names = [];
    try { if (indexedDB.databases) names = (await indexedDB.databases()).map((d) => d.name).filter(Boolean); } catch (e) { names = []; }
    if (!names.length) names = ['firestore/[DEFAULT]/aplicacionweb7/main'];
    for (const name of names.filter((n) => n.startsWith('firestore/'))) {
      let db;
      try { db = await openDb(name); } catch (e) { continue; }
      for (const store of Array.from(db.objectStoreNames)) {
        const rows = await getAll(db, store);
        const label = /mutation/i.test(store) ? 'Cambios que no llegaron a subirse a la nube' : 'Copia guardada por la sincronización';
        for (const row of rows) walk(row, found, { source: label });
      }
      db.close();
    }
    // Sin repetir y sin la versión que ya tienes ahora
    const now = JSON.stringify(Store.data);
    const seen = new Set();
    return found.filter((f) => {
      if (seen.has(f.json)) return false;
      seen.add(f.json);
      return f.json !== now;
    }).sort((a, b) => (b.data.clients.length - a.data.clients.length) || ((b.time || 0) - (a.time || 0)));
  }

  /** Junta una versión encontrada con los datos actuales y lo guarda (y sube a la nube si hay sesión). */
  function restore(item) {
    Store.mergeIn(JSON.parse(item.json));
    Store.save();
  }

  window.Rescate = { scan, restore };
})();
