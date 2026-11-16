/* Almacenamiento de datos en localStorage, con consultas y cálculos derivados. */
(function () {
  'use strict';

  const KEY = 'entrenapro:data:v1';
  const COLLECTIONS = ['clients', 'measurements', 'payments'];

  function emptyData() {
    return {
      version: 1,
      clients: [],
      measurements: [],
      payments: [],
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
      for (const c of ['measurements', 'payments']) {
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

  /**
   * Estado de la cuota mensual de un cliente en el mes de `iso` (por defecto, hoy).
   * Devuelve null si el cliente no está activo o no tiene cuota.
   */
  function feeStatus(client, iso) {
    const ref = iso || today();
    if (!client || (client.status || 'activo') !== 'activo' || !(Number(client.rate) > 0)) return null;
    const { from, to } = monthRange(ref);
    const paid = data.payments
      .filter((p) => p.clientId === client.id && p.status === 'pagado' && p.date >= from && p.date <= to)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const lastDay = Number(to.slice(8));
    const day = Math.min(lastDay, Math.max(1, Number(client.billingDay) || 1));
    const dueDate = from.slice(0, 8) + U.pad(day);
    let status = 'pendiente';
    if (paid > 0) status = 'pagado';
    else if (ref > dueDate) status = 'vencido';
    return { status, amount: Number(client.rate), paid, dueDate };
  }

  /**
   * Lo que falta por cobrar: cuotas de este mes sin pagar (si no hay ya un pago
   * pendiente registrado para ese cliente este mes) y pagos marcados como pendientes.
   */
  function receivables(clientId) {
    const t = today();
    const { from, to } = monthRange(t);
    const pending = data.payments.filter((p) => p.status === 'pendiente');
    const items = [];
    for (const c of data.clients) {
      if (clientId && c.id !== clientId) continue;
      const fs = feeStatus(c, t);
      if (!fs || fs.status === 'pagado') continue;
      const hasRecord = pending.some((p) => p.clientId === c.id && p.date >= from && p.date <= to);
      if (!hasRecord) items.push({ clientId: c.id, amount: fs.amount, overdue: fs.status === 'vencido', fee: true, date: fs.dueDate });
    }
    for (const p of pending) {
      if (clientId && p.clientId !== clientId) continue;
      items.push({ clientId: p.clientId, amount: Number(p.amount) || 0, overdue: p.date < t, payment: p, date: p.date });
    }
    return items;
  }

  function pendingAmount(clientId) {
    return receivables(clientId).reduce((sum, r) => sum + r.amount, 0);
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
    load, save, add, update, remove, get, reset, exportJSON, importJSON,
    clients, measurementsFor, paymentsFor, monthRange, feeStatus, receivables, pendingAmount,
    lastMeasurement, paidBetween, clientName,
    get data() { return data; },
    get settings() { return data.settings; },
    get storageOk() { return storageOk; },
  };
})();
