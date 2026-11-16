/* Almacenamiento de datos en localStorage, con consultas y cálculos derivados. */
(function () {
  'use strict';

  const KEY = 'entrenapro:data:v1';
  const COLLECTIONS = ['clients', 'measurements', 'payments', 'tasks', 'photos', 'reviews', 'routines', 'library', 'diets', 'foods'];

  function emptyData() {
    return {
      version: 1,
      clients: [],
      measurements: [],
      payments: [],
      tasks: [], // tareas pendientes del entrenador por cliente
      photos: [], // solo datos de cada foto; la imagen va aparte (ver photos.js)
      reviews: [], // historial de revisiones hechas
      routines: [], // rutina de entrenamiento de cada cliente (días con sus ejercicios)
      library: [], // biblioteca de ejercicios
      diets: [], // dieta de cada cliente (por ahora, texto libre)
      foods: [], // biblioteca de alimentos
      settings: { trainerName: 'David Orihuela', currency: 'EUR', defaultRate: 60, theme: 'dark' },
    };
  }

  let data = emptyData();
  let storageOk = true;

  function normalize(raw) {
    const base = emptyData();
    if (!raw || typeof raw !== 'object') { seedLibrary(base); seedFoods(base); return base; }
    for (const c of COLLECTIONS) base[c] = Array.isArray(raw[c]) ? raw[c] : [];
    base.settings = Object.assign(base.settings, raw.settings || {});
    migrateNextDue(base);
    // Ya no se pregunta por el tabaco en el cuestionario.
    if (Array.isArray(base.settings.questionnaire)) {
      base.settings.questionnaire = base.settings.questionnaire.map((q) => (q === '¿Cuánta agua bebes al día? ¿Consumes alcohol o tabaco?' ? '¿Cuánta agua bebes al día? ¿Consumes alcohol?' : q));
    }
    seedLibrary(base);
    seedFoods(base);
    // El próximo pago siempre cae el mismo día del mes que la fecha de alta.
    for (const c of base.clients) if (c.startDate && c.nextDue) c.nextDue = snapToStart(c.startDate, c.nextDue);
    return base;
  }

  /* ---------- Pagos alineados con la fecha de alta ---------- */

  /** Mayor k ≥ 0 tal que el alta + k meses cae en `date` o antes. */
  function monthFloor(start, date) {
    const a = U.parseDate(start);
    const b = U.parseDate(date);
    let k = Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1);
    while (k > 0 && U.addMonths(start, k) > date) k--;
    return k;
  }

  /** Fecha «aniversario mensual» del alta más cercana a `date` (nunca antes del alta). */
  function snapToStart(start, date) {
    if (!start || !date) return date;
    if (date <= start) return start;
    const k = monthFloor(start, date);
    const before = U.addMonths(start, k);
    const after = U.addMonths(start, k + 1);
    return U.daysBetween(before, date) <= U.daysBetween(date, after) ? before : after;
  }

  /** Primer aniversario mensual del alta que cae en `date` o después. */
  function startOnOrAfter(start, date) {
    if (date <= start) return start;
    const k = monthFloor(start, date);
    const d = U.addMonths(start, k);
    return d >= date ? d : U.addMonths(start, k + 1);
  }

  /** Fecha del próximo pago si paga `months` meses a partir de `base` (alineada con el alta). */
  function nextDueAfter(client, base, months) {
    if (!client.startDate) return U.addMonths(base, months);
    const from = base < client.startDate ? client.startDate : base;
    return U.addMonths(client.startDate, monthFloor(client.startDate, from) + months);
  }

  /** Añade a la biblioteca los ejercicios de serie que falten (salvo los que el usuario borró). */
  /** Igual que la biblioteca de ejercicios: añade los alimentos de serie que falten (de solo lectura). */
  function seedFoods(d) {
    const defaults = window.FOODS_DEFAULT || [];
    if (!defaults.length) return;
    const byId = new Map(defaults.map((x) => [x.id, x]));
    d.foods = d.foods.map((x) => (byId.has(x.id) ? Object.assign({}, byId.get(x.id), { builtIn: true }) : x));
    const have = new Set(d.foods.map((x) => x.id));
    const removed = new Set(d.settings.foodsRemoved || []);
    for (const f of defaults) if (!have.has(f.id) && !removed.has(f.id)) d.foods.push(Object.assign({ builtIn: true }, f));
  }

  function seedLibrary(d) {
    const defaults = window.LIBRARY_DEFAULT || [];
    if (!defaults.length) return;
    const byId = new Map(defaults.map((x) => [x.id, x]));
    // Los ejercicios de serie no se editan: siempre se muestran tal como vienen en los PDF.
    d.library = d.library.map((x) => (byId.has(x.id) ? Object.assign({}, byId.get(x.id), { builtIn: true }) : x));
    const have = new Set(d.library.map((x) => x.id));
    const removed = new Set(d.settings.libraryRemoved || []);
    for (const ex of defaults) {
      if (!have.has(ex.id) && !removed.has(ex.id)) d.library.push(Object.assign({ builtIn: true }, ex));
    }
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
      data = normalize(raw ? JSON.parse(raw) : null);
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
      for (const c of ['measurements', 'payments', 'tasks', 'photos', 'reviews', 'routines', 'diets']) {
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

  const FOLLOWUP_DAY = 15; // días después del inicio de cada mes (contado desde el alta) en que toca el seguimiento
  const REVIEW_NOTICE = 2; // días de antelación para avisar
  const REVIEW_TYPES = { seguimiento: 'Seguimiento', mensual: 'Revisión mensual' };

  /**
   * Calendario de revisiones desde la fecha de alta del cliente: cada mes,
   * a los 15 días un seguimiento y al cumplir el mes una revisión mensual.
   * Devuelve las que caen hasta `until`.
   */
  function reviewSchedule(client, until) {
    const start = client.startDate;
    const list = [];
    if (!start) return list;
    for (let k = 0; k < 1200; k++) {
      const seguimiento = U.addDays(U.addMonths(start, k), FOLLOWUP_DAY);
      if (seguimiento > until) break;
      list.push({ type: 'seguimiento', date: seguimiento });
      const mensual = U.addMonths(start, k + 1);
      if (mensual > until) break;
      list.push({ type: 'mensual', date: mensual });
    }
    return list;
  }

  function reviewDone(clientId, cp) {
    return data.reviews.find((r) => r.clientId === clientId && r.due === cp.date && r.type === cp.type) || null;
  }

  /**
   * Revisión que toca a un cliente activo. Si la más reciente (hasta dentro de 2 días)
   * está sin hacer, esa; si no, la siguiente del calendario.
   * Estado: 'atrasada', 'hoy', 'pronto' (en los próximos 2 días) o 'al-dia'.
   */
  function reviewInfo(client) {
    if (!client || (client.status || 'activo') !== 'activo') return null;
    const t = today();
    const horizon = U.addDays(t, REVIEW_NOTICE);
    const due = reviewSchedule(client, horizon);
    let cp = due[due.length - 1];
    if (!cp || reviewDone(client.id, cp)) {
      cp = reviewSchedule(client, U.addMonths(horizon, 2)).find((x) => x.date > horizon);
      if (!cp) return null;
    }
    const days = U.daysBetween(t, cp.date);
    let status = 'al-dia';
    if (cp.date <= horizon) status = days < 0 ? 'atrasada' : days === 0 ? 'hoy' : 'pronto';
    return { status, days, date: cp.date, type: cp.type, label: REVIEW_TYPES[cp.type] };
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

  function library() {
    return data.library.slice().sort((a, b) => (a.group || '').localeCompare(b.group || '', 'es') || a.name.localeCompare(b.name, 'es'));
  }

  /** Borra un ejercicio de la biblioteca; si venía de serie, se recuerda para no volver a añadirlo. */
  function foods() {
    return data.foods.slice().sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  function removeFood(id) {
    const f = get('foods', id);
    if (f && f.builtIn) data.settings.foodsRemoved = [...new Set([...(data.settings.foodsRemoved || []), id])];
    remove('foods', id);
  }

  function removeLibraryExercise(id) {
    const ex = get('library', id);
    if (ex && ex.builtIn) data.settings.libraryRemoved = [...new Set([...(data.settings.libraryRemoved || []), id])];
    remove('library', id);
  }

  function dietFor(clientId) {
    return data.diets.find((d) => d.clientId === clientId) || null;
  }

  /** Qué le falta a un cliente activo: rutina (con al menos un ejercicio) y dieta. */
  function planGaps(client) {
    if (!client || (client.status || 'activo') !== 'activo') return null;
    const r = routineFor(client.id);
    const d = dietFor(client.id);
    const noRoutine = !r || !(r.days || []).some((day) => (day.exercises || []).length);
    const noDiet = !d || !(d.text || '').trim();
    return noRoutine || noDiet ? { noRoutine, noDiet, routineEmpty: !!r && noRoutine } : null;
  }

  function routineFor(clientId) {
    return data.routines.find((r) => r.clientId === clientId) || null;
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
    seedLibrary(data);
    seedFoods(data);
    save();
  }

  function today() { return U.today(); }

  window.Store = {
    load, save, onSave, replaceAll, mergeIn, add, update, remove, get, reset, exportJSON, importJSON,
    clients, measurementsFor, paymentsFor, monthRange, dueInfo, receivables, pendingAmount, lastPaidAmount, REMIND_DAYS,
    tasksFor, pendingTasks, photosFor, routineFor, dietFor, planGaps, library, removeLibraryExercise, foods, removeFood, snapToStart, startOnOrAfter, nextDueAfter, reviewInfo, reviewsFor, reviewSchedule, REVIEW_NOTICE, REVIEW_TYPES, FOLLOWUP_DAY,
    lastMeasurement, paidBetween, clientName,
    get data() { return data; },
    get settings() { return data.settings; },
    get storageOk() { return storageOk; },
  };
})();
