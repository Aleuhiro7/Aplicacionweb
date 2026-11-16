/* Almacenamiento de datos en localStorage, con consultas y cálculos derivados. */
(function () {
  'use strict';

  const KEY = 'entrenapro:data:v1';
  const COLLECTIONS = ['clients', 'measurements', 'payments', 'tasks', 'photos', 'reviews'];

  function emptyData() {
    return {
      version: 1,
      clients: [],
      measurements: [],
      payments: [],
      tasks: [], // tareas pendientes del entrenador por cliente
      photos: [], // solo datos de cada foto; la imagen va aparte (ver photos.js)
      reviews: [], // historial de revisiones hechas
      settings: { trainerName: 'David Orihuela', currency: 'EUR', defaultRate: 60, theme: 'dark' },
    };
  }

  let data = emptyData();
  let storageOk = true;

  function normalize(raw) {
    const base = emptyData();
    if (!raw || typeof raw !== 'object') return base;
    for (const c of COLLECTIONS) base[c] = Array.isArray(raw[c]) ? raw[c] : [];
    base.settings = Object.assign(base.settings, raw.settings || {});
    migrateNextDue(base);
    return base;
  }

  /** Versiones anteriores usaban «día de cobro»; se convierte en fecha de próximo pago. */
  function migrateNextDue(d) {
    const t = U.today();
    const pad = U.pad;
    for (const c of d.clients) {
      if (c.nextDue || !c.billingDay || !(Number(c.rate) > 0)) continue;
      const now = U.parseDate(t);
      const from = U.toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const due = from.slice(0, 8) + pad(Math.min(lastDay, Number(c.billingDay)));
      const paid = d.payments.some((p) => p.clientId === c.id && p.status === 'pagado' && p.date >= from && p.date <= t);
      c.nextDue = paid ? U.addMonths(due, 1) : due;
    }
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

  const saveListeners = [];

  function writeLocal() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      storageOk = true;
    } catch (e) {
      storageOk = false;
    }
  }

  /** Guarda en este navegador y avisa a la sincronización en la nube. */
  function save() {
    writeLocal();
    for (const fn of saveListeners) {
      try { fn(data); } catch (e) { console.error(e); }
    }
  }

  function onSave(fn) { saveListeners.push(fn); }

  /** Sustituye todos los datos por los que llegan de la nube (sin volver a subirlos). */
  function replaceAll(raw) {
    data = normalize(raw);
    writeLocal();
  }

  /** Une los datos de la nube con los de este navegador (por id) sin perder nada. */
  function mergeIn(raw) {
    const remote = normalize(raw);
    for (const c of COLLECTIONS) {
      const ids = new Set(remote[c].map((r) => r.id));
      remote[c] = remote[c].concat(data[c].filter((r) => !ids.has(r.id)));
    }
    remote.settings = Object.assign({}, data.settings, remote.settings);
    data = remote;
    writeLocal();
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
      for (const c of ['measurements', 'payments', 'tasks', 'photos', 'reviews']) {
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

  function measurementsFor(clientId) {
    return data.measurements.filter((m) => m.clientId === clientId).sort(byDateTime);
  }

  function paymentsFor(clientId) {
    return data.payments.filter((p) => p.clientId === clientId).sort(byDateTime).reverse();
  }

  /** Primer y último día (YYYY-MM-DD) del mes de la fecha dada. */
  function monthRange(iso) {
    const d = U.parseDate(iso);
    return {
      from: U.toISODate(new Date(d.getFullYear(), d.getMonth(), 1)),
      to: U.toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    };
  }

  const REMIND_DAYS = 5; // días de antelación para avisar de un pago

  function lastPaidAmount(clientId) {
    const list = data.payments.filter((p) => p.clientId === clientId && p.status === 'pagado').sort(byDateTime);
    return list.length ? Number(list[list.length - 1].amount) || 0 : 0;
  }

  /**
   * Próximo pago de un cliente activo: fecha, días que faltan y estado
   * ('vencido', 'hoy', 'pronto' = dentro de los próximos 5 días, 'al-dia').
   * null si el cliente no está activo o no tiene fecha de próximo pago.
   */
  function dueInfo(client) {
    if (!client || (client.status || 'activo') !== 'activo' || !client.nextDue) return null;
    const days = U.daysBetween(today(), client.nextDue);
    let status = 'al-dia';
    if (days < 0) status = 'vencido';
    else if (days === 0) status = 'hoy';
    else if (days <= REMIND_DAYS) status = 'pronto';
    return { status, days, date: client.nextDue, amount: Number(client.rate) || lastPaidAmount(client.id) || 0 };
  }

  /** Lo que falta por cobrar: pagos que vencen hoy o ya vencidos, y pagos marcados como pendientes. */
  function receivables(clientId) {
    const t = today();
    const items = [];
    for (const c of data.clients) {
      if (clientId && c.id !== clientId) continue;
      const d = dueInfo(c);
      if (d && d.days <= 0) items.push({ clientId: c.id, amount: d.amount, overdue: d.days < 0, date: d.date });
    }
    for (const p of data.payments.filter((x) => x.status === 'pendiente')) {
      if (clientId && p.clientId !== clientId) continue;
      items.push({ clientId: p.clientId, amount: Number(p.amount) || 0, overdue: p.date < t, payment: p, date: p.date });
    }
    return items;
  }

  function pendingAmount(clientId) {
    return receivables(clientId).reduce((sum, r) => sum + r.amount, 0);
  }

  const REVIEW_AFTER = 15; // días después de cada pago en que toca la revisión
  const REVIEW_NOTICE = 2; // días de antelación para avisar

  /** Último pago cobrado de un cliente (el más reciente por fecha y, si empatan, por hora de registro). */
  function lastPaid(clientId) {
    let last = null;
    for (const p of data.payments) {
      if (p.clientId !== clientId || p.status !== 'pagado') continue;
      if (!last || p.date > last.date || (p.date === last.date && (p.createdAt || '') > (last.createdAt || ''))) last = p;
    }
    return last;
  }

  /**
   * Revisión de un cliente activo: toca 15 días después de su último pago.
   * Estado: 'hecha' (ya marcada en este periodo), 'atrasada', 'hoy',
   * 'pronto' (en los próximos 2 días) o 'al-dia'. null si no tiene pagos.
   */
  function reviewInfo(client) {
    if (!client || (client.status || 'activo') !== 'activo') return null;
    const pay = lastPaid(client.id);
    if (!pay) return null;
    const paidDate = pay.date;
    const date = U.addDays(paidDate, REVIEW_AFTER);
    const days = U.daysBetween(today(), date);
    // La revisión de este periodo está hecha si se marcó para este mismo pago.
    const done = client.reviewedPayment ? client.reviewedPayment === pay.id : (!!client.lastReview && client.lastReview > paidDate);
    let status = 'al-dia';
    if (done) status = 'hecha';
    else if (days < 0) status = 'atrasada';
    else if (days === 0) status = 'hoy';
    else if (days <= REVIEW_NOTICE) status = 'pronto';
    return { status, days, date, paidDate, paymentId: pay.id, doneDate: done ? client.lastReview : '' };
  }

  function reviewsFor(clientId) {
    return data.reviews.filter((r) => r.clientId === clientId).sort((a, b) => b.date.localeCompare(a.date));
  }

  /** Tareas de un cliente: primero las pendientes (por fecha límite), luego las hechas. */
  function tasksFor(clientId) {
    return data.tasks
      .filter((t) => t.clientId === clientId)
      .sort((a, b) => (a.done - b.done) || (a.done ? (b.doneAt || '').localeCompare(a.doneAt || '') : (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || (a.createdAt || '').localeCompare(b.createdAt || '')));
  }

  function pendingTasks() {
    return data.tasks
      .filter((t) => !t.done && data.clients.some((c) => c.id === t.clientId))
      .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || (a.createdAt || '').localeCompare(b.createdAt || ''));
  }

  function photosFor(clientId) {
    return data.photos.filter((p) => p.clientId === clientId).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  function lastMeasurement(clientId) {
    const list = measurementsFor(clientId);
    return list[list.length - 1] || null;
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
    return JSON.stringify(Object.assign({ exportedAt: now(), app: 'David Orihuela Coach' }, data), null, 2);
  }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.clients)) {
      throw new Error('El archivo no parece una copia de seguridad de David Orihuela Coach.');
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
    load, save, onSave, replaceAll, mergeIn, add, update, remove, get, reset, exportJSON, importJSON,
    clients, measurementsFor, paymentsFor, monthRange, dueInfo, receivables, pendingAmount, lastPaidAmount, REMIND_DAYS,
    tasksFor, pendingTasks, photosFor, reviewInfo, reviewsFor, REVIEW_AFTER, REVIEW_NOTICE,
    lastMeasurement, paidBetween, clientName,
    get data() { return data; },
    get settings() { return data.settings; },
    get storageOk() { return storageOk; },
  };
})();
