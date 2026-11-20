/* Almacenamiento de datos en localStorage, con consultas y cálculos derivados. */
(function () {
  'use strict';

  const KEY = 'entrenapro:data:v1';
  const COLLECTIONS = ['clients', 'measurements', 'payments', 'tasks', 'photos', 'reviews', 'routines', 'library', 'diets', 'foods', 'foodBlocks', 'forms', 'injuries'];

  function emptyData() {
    return {
      version: 1,
      clients: [],
      measurements: [],
      payments: [],
      injuries: [], // lesiones de cada cliente (fecha de la lesión y de la recuperación)
      tasks: [], // tareas pendientes del entrenador por cliente
      photos: [], // solo datos de cada foto; la imagen va aparte (ver photos.js)
      reviews: [], // historial de revisiones hechas
      routines: [], // rutina de entrenamiento de cada cliente (días con sus ejercicios)
      library: [], // biblioteca de ejercicios
      diets: [], // dieta de cada cliente (por ahora, texto libre)
      foods: [], // biblioteca de alimentos
      foodBlocks: [], // bloques de equivalencia de alimentos
      forms: [], // formularios enviados por enlace a personas que aún no son clientes
      settings: { trainerName: 'David Orihuela', currency: 'EUR', defaultRate: 60, theme: 'dark' },
    };
  }

  let data = emptyData();
  let storageOk = true;

  function normalize(raw) {
    const base = emptyData();
    if (!raw || typeof raw !== 'object') { seedLibrary(base); seedFoods(base); seedBlocks(base); return base; }
    for (const c of COLLECTIONS) base[c] = Array.isArray(raw[c]) ? raw[c] : [];
    base.settings = Object.assign(base.settings, raw.settings || {});
    migrateNextDue(base);
    // Ya no se pregunta por el tabaco en el cuestionario.
    if (Array.isArray(base.settings.questionnaire)) {
      base.settings.questionnaire = base.settings.questionnaire.map((q) => (q === '¿Cuánta agua bebes al día? ¿Consumes alcohol o tabaco?' ? '¿Cuánta agua bebes al día? ¿Consumes alcohol?' : q));
    }
    // El cuestionario pasa a respuestas marcadas (A, B, C, D): las listas antiguas, todas de texto, se cambian por las nuevas.
    if (!base.settings.questionnaireV2) {
      if (Array.isArray(base.settings.questionnaire) && !base.settings.questionnaire.some((q) => String(q).includes('|'))) delete base.settings.questionnaire;
      base.settings.questionnaireV2 = true;
    }
    // Se añade el correo electrónico al cuestionario (una sola vez).
    if (!base.settings.questionnaireEmail) {
      if (Array.isArray(base.settings.questionnaire) && !base.settings.questionnaire.some((q) => /correo|e-?mail/i.test(q))) base.settings.questionnaire.unshift('Correo electrónico');
      base.settings.questionnaireEmail = true;
    }
    // La edad se pide como fecha de nacimiento (para avisar de su cumpleaños).
    if (Array.isArray(base.settings.questionnaire)) {
      base.settings.questionnaire = base.settings.questionnaire.map((q) => (/^¿Qué edad tienes\? \| Menos de 25 años/.test(q) ? 'Fecha de nacimiento' : q));
    }
    seedLibrary(base);
    // Siempre: los ejercicios de la biblioteca que hay en las rutinas siguen sus pautas actuales
    // (series, repeticiones y descanso), salvo lo que hayas cambiado a mano en esa rutina (ex.custom).
    // Así, cuando cambian las pautas de la biblioteca, cambian solas en todas las rutinas.
    {
      const lib = new Map(base.library.map((x) => [x.id, x]));
      const key = (n) => String(n || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const byName = new Map(base.library.filter((x) => x.builtIn).map((x) => [key(x.name), x]));
      for (const r of base.routines) {
        for (const d of r.days || []) {
          for (const ex of d.exercises || []) {
            // Ejercicios añadidos escribiendo el nombre: si es uno de la biblioteca, se enlaza con él.
            if (!lib.get(ex.libraryId) && byName.has(key(ex.name))) {
              const m = byName.get(key(ex.name));
              ex.libraryId = m.id;
              if (!ex.group) ex.group = m.group;
              migrated = true;
            }
            const l = lib.get(ex.libraryId);
            if (!l || !l.builtIn) continue;
            const own = ex.custom || [];
            for (const f of ['sets', 'reps', 'rest']) {
              if (!own.includes(f) && l[f] !== undefined && ex[f] !== l[f]) { ex[f] = l[f]; migrated = true; }
            }
          }
        }
      }
    }
    // Una sola vez: los descansos de las rutinas ya hechas pasan a la regla nueva
    // (3 min en los ejercicios de pierna y 2 min en el resto de músculos).
    if (!base.settings.restV2) {
      const LEGS = ['Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Aductores', 'Gemelos'];
      const OTHERS = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Core / Abdomen', 'Antebrazo'];
      const libGroup = new Map(base.library.map((x) => [x.id, x.group]));
      for (const r of base.routines) {
        for (const d of r.days || []) {
          for (const ex of d.exercises || []) {
            const g = ex.group || libGroup.get(ex.libraryId);
            if (LEGS.includes(g)) ex.rest = '3 min';
            else if (OTHERS.includes(g)) ex.rest = '2 min';
          }
        }
      }
      base.settings.restV2 = true;
      migrated = true; // hay que subirlo a la nube (y a la zona de los clientes)
    }
    // Una sola vez: las series y repeticiones de las rutinas ya hechas pasan al método nuevo de las 3 series
    // (los ejercicios de la biblioteca toman sus pautas actuales; los escritos a mano con el formato
    // antiguo de «Casi-Fallo / Fallo / Top Set», también).
    if (!base.settings.repsV2) {
      const lib = new Map(base.library.map((x) => [x.id, x]));
      const method = (window.LIBRARY_DEFAULT || [])[0];
      const OLD = /casi-fallo|cerca-del-fallo|top set|serie1 efectiva|fallo-total|fallo-agotamiento|\(fallo\)/i;
      for (const r of base.routines) {
        for (const d of r.days || []) {
          for (const ex of d.exercises || []) {
            const l = lib.get(ex.libraryId);
            if (l && l.builtIn) { ex.sets = l.sets; ex.reps = l.reps; }
            else if (method && OLD.test(ex.reps || '')) { ex.sets = method.sets; ex.reps = method.reps; }
          }
        }
      }
      base.settings.repsV2 = true;
      migrated = true;
    }
    // Limpieza única: el jamón ibérico no se usa en ningún sitio (tampoco si se añadió a mano).
    if (!base.settings.ibericoRemoved) {
      base.foods = base.foods.filter((f) => !/jam[oó]n\s+ib[eé]rico/i.test(f.name || ''));
      base.settings.ibericoRemoved = true;
    }
    seedFoods(base);
    seedBlocks(base);
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
    const byId = new Map(defaults.map((x) => [x.id, x]));
    // Los alimentos de serie que ya no están en la lista se quitan; los demás se muestran tal cual vienen.
    d.foods = d.foods
      .filter((x) => !x.builtIn || byId.has(x.id))
      .map((x) => (byId.has(x.id) ? Object.assign({}, byId.get(x.id), { builtIn: true }) : x));
    const have = new Set(d.foods.map((x) => x.id));
    const removed = new Set(d.settings.foodsRemoved || []);
    for (const f of defaults) if (!have.has(f.id) && !removed.has(f.id)) d.foods.push(Object.assign({ builtIn: true }, f));
    // Las comidas de las dietas no conservan alimentos que ya no existen.
    const ids = new Set(d.foods.map((x) => x.id));
    for (const diet of d.diets || []) {
      for (const m of diet.meals || []) if ((m.items || []).some((it) => !ids.has(it.foodId))) m.items = m.items.filter((it) => ids.has(it.foodId));
    }
  }

  /** Carga una sola vez los bloques de equivalencia de serie (después se pueden editar). */
  function seedBlocks(d) {
    const defaults = window.FOOD_BLOCKS_DEFAULT || [];
    const version = window.FOOD_BLOCKS_VERSION || 1;
    if (!defaults.length) return;
    const idByName = new Map(d.foods.map((f) => [f.name, f.id]));
    const fromDefault = (b) => ({ id: b.id, family: b.family, name: b.name, macro: b.macro, amount: b.amount, notes: b.notes || '', foodIds: b.foods.map((n) => idByName.get(n)).filter(Boolean) });
    const byId = new Map(defaults.map((b) => [b.id, b]));
    if (!d.settings.blocksSeeded) {
      const have = new Set(d.foodBlocks.map((b) => b.id));
      for (const b of defaults) if (!have.has(b.id)) d.foodBlocks.push(fromDefault(b));
      d.settings.blocksSeeded = true;
      d.settings.blocksVersion = version;
    } else if ((d.settings.blocksVersion || 1) < version) {
      // Cambios en los bloques de serie desde la versión guardada.
      for (let v = (d.settings.blocksVersion || 1) + 1; v <= version; v++) {
        const ch = (window.FOOD_BLOCKS_CHANGES || {})[v] || {};
        d.foodBlocks = d.foodBlocks.filter((b) => !(ch.remove || []).includes(b.id));
        for (const id of ch.replace || []) {
          const i = d.foodBlocks.findIndex((b) => b.id === id);
          if (i >= 0 && byId.has(id)) d.foodBlocks[i] = fromDefault(byId.get(id));
        }
        for (const id of ch.add || []) if (byId.has(id) && !d.foodBlocks.some((b) => b.id === id)) d.foodBlocks.push(fromDefault(byId.get(id)));
      }
      d.settings.blocksVersion = version;
    }
    // Si un alimento deja de existir, se quita también de los bloques.
    const foodIds = new Set(d.foods.map((f) => f.id));
    for (const b of d.foodBlocks) b.foodIds = (b.foodIds || []).filter((id) => foodIds.has(id));
    // Los bloques de serie se muestran en su orden; los creados a mano, al final.
    const order = new Map(defaults.map((b, i) => [b.id, i]));
    d.foodBlocks = d.foodBlocks.map((b, i) => [b, i]).sort((x, y) => (order.has(x[0].id) ? order.get(x[0].id) : 1e6 + x[1]) - (order.has(y[0].id) ? order.get(y[0].id) : 1e6 + y[1])).map((x) => x[0]);
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
    // Los de serie, en el orden de la biblioteca (así un ejercicio nuevo sale en su sitio); los propios, al final.
    const order = new Map(defaults.map((x, i) => [x.id, i]));
    d.library = d.library.map((x, i) => [x, i])
      .sort((a, b) => (order.has(a[0].id) ? order.get(a[0].id) : 1e6 + a[1]) - (order.has(b[0].id) ? order.get(b[0].id) : 1e6 + b[1]))
      .map((x) => x[0]);
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

  let migrated = false; // normalize() ha cambiado datos antiguos: se guardan en cuanto se pueda
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
    migrated = false;
    data = normalize(raw);
    if (migrated) { migrated = false; save(); } else writeLocal();
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
      for (const c of ['measurements', 'payments', 'tasks', 'photos', 'reviews', 'routines', 'diets', 'injuries']) {
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
    if (!client || (client.status || 'activo') !== 'activo' || client.free) return null; // «Gratis»: no se le cobra
    const paidOnce = data.payments.some((p) => p.clientId === client.id && p.status === 'pagado');
    // Sin fecha de próximo pago y sin ningún pago (p. ej. dado de alta desde el cuestionario): pendiente desde el alta.
    const due = client.nextDue || (!paidOnce ? (client.startDate && client.startDate < today() ? client.startDate : today()) : '');
    if (!due) return null;
    const days = U.daysBetween(today(), due);
    let status = 'al-dia';
    if (days < 0) status = 'vencido';
    else if (days === 0) status = 'hoy';
    else if (days <= REMIND_DAYS) status = 'pronto';
    // Recién dado de alta y todavía sin ningún pago: queda pendiente hasta que se marque el primero.
    const first = days <= 0 && !paidOnce;
    return { status, days, first, date: due, amount: Number(client.rate) || lastPaidAmount(client.id) || 0 };
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

  /** Lesiones de un cliente: primero las activas y luego las recuperadas, de la más reciente a la más antigua. */
  function injuriesFor(clientId) {
    return data.injuries
      .filter((x) => x.clientId === clientId)
      .sort((a, b) => (!!a.recoveredDate - !!b.recoveredDate) || (b.date || '').localeCompare(a.date || ''));
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

  function blocksForFood(foodId) {
    return data.foodBlocks.filter((b) => (b.foodIds || []).includes(foodId));
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
    // «Sin rutina» (clientes de solo dieta): no cuenta como rutina pendiente.
    const noRoutine = !client.noTraining && (!r || !(r.days || []).some((day) => (day.exercises || []).length));
    // Fijar solo los objetivos (kcal y macros) no cuenta: la dieta tiene que estar rellenada con alimentos.
    const hasMealFoods = !!(d && (d.meals || []).some((m) => (m.items || []).length));
    // «Sin dieta» (clientes de solo rutina): no cuenta como dieta pendiente.
    const noDiet = !client.noDiet && (!d || (!hasMealFoods && !(d.text || '').trim()));
    const hasTargets = !!(d && d.targets && Number(d.targets.kcal) > 0);
    return noRoutine || noDiet ? { noRoutine, noDiet, routineEmpty: !!r && noRoutine, hasTargets } : null;
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
    return JSON.stringify(Object.assign({ exportedAt: now(), app: 'David Orihuela Entrenador Online' }, data), null, 2);
  }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.clients)) {
      throw new Error('El archivo no parece una copia de seguridad de David Orihuela Entrenador Online.');
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
    data.settings.blocksSeeded = false;
    seedBlocks(data);
    save();
  }

  function today() { return U.today(); }

  window.Store = {
    load, save, onSave, replaceAll, mergeIn, add, update, remove, get, reset, exportJSON, importJSON,
    clients, measurementsFor, paymentsFor, monthRange, dueInfo, receivables, pendingAmount, lastPaidAmount, REMIND_DAYS,
    tasksFor, injuriesFor, pendingTasks, photosFor, routineFor, dietFor, planGaps, library, removeLibraryExercise, foods, removeFood, blocksForFood, snapToStart, startOnOrAfter, nextDueAfter, reviewInfo, reviewsFor, reviewSchedule, REVIEW_NOTICE, REVIEW_TYPES, FOLLOWUP_DAY,
    lastMeasurement, paidBetween, clientName,
    get data() { return data; },
    get settings() { return data.settings; },
    get storageOk() { return storageOk; },
  };
})();
