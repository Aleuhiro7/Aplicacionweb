/* Almacenamiento de datos en localStorage, con consultas y cálculos derivados. */
(function () {
  'use strict';

  const KEY = 'entrenapro:data:v1';
  const COLLECTIONS = ['clients', 'sessions', 'measurements', 'payments'];

  function emptyData() {
    return {
      version: 1,
      clients: [],
      sessions: [],
      measurements: [],
      payments: [],
      settings: { trainerName: '', currency: 'EUR', defaultRate: 35, defaultDuration: 60, theme: 'auto' },
    };
  }

  let data = emptyData();
  let storageOk = true;

  function normalize(raw) {
    const base = emptyData();
    if (!raw || typeof raw !== 'object') return base;
    for (const c of COLLECTIONS) base[c] = Array.isArray(raw[c]) ? raw[c] : [];
    base.settings = Object.assign(base.settings, raw.settings || {});
    return base;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? normalize(JSON.parse(raw)) : emptyData();
    } catch (e) {
      storageOk = false;
      data = emptyData();
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      storageOk = true;
    } catch (e) {
      storageOk = false;
    }
  }

  function now() { return new Date().toISOString(); }

  function add(collection, item) {
    const record = Object.assign({ id: U.uid(), createdAt: now() }, item);
    data[collection].push(record);
    save();
    return record;
  }

  function update(collection, id, patch) {
    const rec = data[collection].find((r) => r.id === id);
    if (!rec) return null;
    Object.assign(rec, patch, { updatedAt: now() });
    save();
    return rec;
  }

  function remove(collection, id) {
    data[collection] = data[collection].filter((r) => r.id !== id);
    if (collection === 'clients') {
      for (const c of ['sessions', 'measurements', 'payments']) {
        data[c] = data[c].filter((r) => r.clientId !== id);
      }
    }
    save();
  }

  function get(collection, id) {
    return data[collection].find((r) => r.id === id) || null;
  }

  /* ---------- Consultas ---------- */

  const byDateTime = (a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''));

  function clients() {
    return data.clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  function sessionsFor(clientId) {
    return data.sessions.filter((s) => s.clientId === clientId).sort(byDateTime);
  }

  function measurementsFor(clientId) {
    return data.measurements.filter((m) => m.clientId === clientId).sort(byDateTime);
  }

  function paymentsFor(clientId) {
    return data.payments.filter((p) => p.clientId === clientId).sort(byDateTime).reverse();
  }

  function sessionsBetween(fromISO, toISO) {
    return data.sessions.filter((s) => s.date >= fromISO && s.date <= toISO).sort(byDateTime);
  }

  function nextSession(clientId) {
    const t = today();
    return data.sessions
      .filter((s) => s.clientId === clientId && s.status === 'programada' && s.date >= t)
      .sort(byDateTime)[0] || null;
  }

  function lastCompletedSession(clientId) {
    const list = data.sessions
      .filter((s) => s.clientId === clientId && s.status === 'completada')
      .sort(byDateTime);
    return list[list.length - 1] || null;
  }

  /**
   * Bonos: sesiones compradas (suma de "sesiones incluidas" en pagos) menos
   * sesiones consumidas (completadas o no asistidas). null si el cliente no usa bonos.
   */
  function packBalance(clientId) {
    const bought = data.payments
      .filter((p) => p.clientId === clientId && Number(p.sessionsIncluded) > 0)
      .reduce((sum, p) => sum + Number(p.sessionsIncluded), 0);
    if (!bought) return null;
    const used = data.sessions.filter(
      (s) => s.clientId === clientId && (s.status === 'completada' || s.status === 'no-asistio')
    ).length;
    return { bought, used, remaining: bought - used };
  }

  function pendingAmount(clientId) {
    return data.payments
      .filter((p) => p.status === 'pendiente' && (!clientId || p.clientId === clientId))
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }

  function paidBetween(fromISO, toISO) {
    return data.payments
      .filter((p) => p.status === 'pagado' && p.date >= fromISO && p.date <= toISO)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }

  function clientName(id) {
    const c = get('clients', id);
    return c ? c.name : 'Cliente eliminado';
  }

  /* ---------- Copias de seguridad ---------- */

  function exportJSON() {
    return JSON.stringify(Object.assign({ exportedAt: now(), app: 'EntrenaPro' }, data), null, 2);
  }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.clients)) {
      throw new Error('El archivo no parece una copia de seguridad de EntrenaPro.');
    }
    data = normalize(parsed);
    save();
  }

  function reset() {
    const settings = data.settings;
    data = emptyData();
    data.settings = settings;
    save();
  }

  function today() { return U.today(); }

  window.Store = {
    load, save, add, update, remove, get, reset, exportJSON, importJSON,
    clients, sessionsFor, measurementsFor, paymentsFor, sessionsBetween, nextSession,
    lastCompletedSession, packBalance, pendingAmount, paidBetween, clientName,
    get data() { return data; },
    get settings() { return data.settings; },
    get storageOk() { return storageOk; },
  };
})();
