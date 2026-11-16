/* Vistas de la aplicación y acciones del usuario. */
(function () {
  'use strict';

  const { esc, fmtDate, fmtMoney, fmtNum, today, avatar } = U;
  const money = (n) => fmtMoney(n, Store.settings.currency);

  /* ---------- Catálogos ---------- */
  const SESSION_STATUS = {
    programada: { label: 'Programada', badge: 'info' },
    completada: { label: 'Completada', badge: 'success' },
    cancelada: { label: 'Cancelada', badge: '' },
    'no-asistio': { label: 'No asistió', badge: 'danger' },
  };
  const SESSION_TYPES = ['Entrenamiento personal', 'Evaluación', 'Seguimiento', 'Online', 'Grupal'];
  const GOALS = ['Pérdida de grasa', 'Ganancia muscular', 'Fuerza', 'Resistencia', 'Salud general', 'Rehabilitación', 'Rendimiento deportivo'];
  const LEVELS = ['Principiante', 'Intermedio', 'Avanzado'];
  const PAY_METHODS = ['Efectivo', 'Transferencia', 'Tarjeta', 'Bizum', 'Otro'];
  const CURRENCIES = [
    { value: 'EUR', label: 'Euro (€)' },
    { value: 'USD', label: 'Dólar estadounidense ($)' },
    { value: 'MXN', label: 'Peso mexicano' },
    { value: 'COP', label: 'Peso colombiano' },
    { value: 'ARS', label: 'Peso argentino' },
    { value: 'CLP', label: 'Peso chileno' },
    { value: 'PEN', label: 'Sol peruano' },
    { value: 'GBP', label: 'Libra esterlina (£)' },
  ];
  const METRICS = [
    { key: 'weight', label: 'Peso', unit: 'kg' },
    { key: 'bodyFat', label: '% Grasa', unit: '%' },
    { key: 'waist', label: 'Cintura', unit: 'cm' },
    { key: 'hip', label: 'Cadera', unit: 'cm' },
    { key: 'chest', label: 'Pecho', unit: 'cm' },
    { key: 'arm', label: 'Brazo', unit: 'cm' },
    { key: 'thigh', label: 'Muslo', unit: 'cm' },
  ];

  /* Estado de la interfaz (no se guarda). */
  const state = {
    clientSearch: '',
    clientFilter: 'activo',
    clientTab: 'resumen',
    metric: 'weight',
    week: U.startOfWeek(today()),
    payFilter: 'todos',
  };

  const badge = (text, kind) => `<span class="badge ${kind || ''}">${esc(text)}</span>`;
  const statusBadge = (s) => badge(SESSION_STATUS[s.status]?.label || s.status, SESSION_STATUS[s.status]?.badge);
  const payBadge = (p) => (p.status === 'pagado' ? badge('Pagado', 'success') : badge('Pendiente', 'warning'));
  const empty = (icon, text, extra = '') => `<div class="empty"><span class="empty-icon">${U.icon(icon)}</span><div>${text}</div>${extra}</div>`;
  const endTime = (s) => {
    const [h, m] = (s.time || '00:00').split(':').map(Number);
    const total = h * 60 + m + (Number(s.duration) || 60);
    return `${U.pad(Math.floor(total / 60) % 24)}:${U.pad(total % 60)}`;
  };

  function greeting() {
    const h = new Date().getHours();
    return h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  }

  function clientOptions(includeInactiveId) {
    return Store.clients()
      .filter((c) => c.status !== 'inactivo' || c.id === includeInactiveId)
      .map((c) => ({ value: c.id, label: c.name }));
  }

  /* =========================================================
   * Formularios
   * ======================================================= */

  function clientFields() {
    return [
      { type: 'section', label: 'Datos personales' },
      { name: 'name', label: 'Nombre completo', required: true, full: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Teléfono', type: 'tel' },
      { name: 'birthDate', label: 'Fecha de nacimiento', type: 'date' },
      { name: 'gender', label: 'Sexo', type: 'select', options: ['', 'Mujer', 'Hombre', 'Otro'].map((o) => ({ value: o, label: o || '—' })) },
      { name: 'startDate', label: 'Fecha de alta', type: 'date', default: today() },
      { name: 'status', label: 'Estado', type: 'select', options: [{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }], default: 'activo' },
      { type: 'section', label: 'Entrenamiento' },
      { name: 'goal', label: 'Objetivo principal', type: 'select', options: GOALS, placeholder: 'Selecciona…' },
      { name: 'level', label: 'Nivel', type: 'select', options: LEVELS, placeholder: 'Selecciona…' },
      { name: 'rate', label: `Tarifa por sesión (${Store.settings.currency})`, type: 'number', step: '0.01', min: 0, default: Store.settings.defaultRate },
      { name: 'height', label: 'Altura (cm)', type: 'number', step: '0.1', min: 0 },
      { type: 'section', label: 'Salud y notas' },
      { name: 'health', label: 'Lesiones, patologías o medicación', type: 'textarea', placeholder: 'Ej.: lesión de rodilla derecha, hipertensión controlada…' },
      { name: 'notes', label: 'Notas', type: 'textarea', placeholder: 'Preferencias, disponibilidad, motivación…' },
    ];
  }

  function openClientForm(id) {
    const existing = id ? Store.get('clients', id) : null;
    UI.form({
      title: existing ? 'Editar cliente' : 'Nuevo cliente',
      fields: clientFields(),
      values: existing || {},
      submitLabel: existing ? 'Guardar cambios' : 'Crear cliente',
      onDelete: existing ? () => deleteClient(id) : null,
      onSubmit: (v) => {
        if (existing) {
          Store.update('clients', id, v);
          UI.toast('Cliente actualizado');
        } else {
          const c = Store.add('clients', v);
          UI.toast('Cliente creado');
          state.clientTab = 'resumen';
          location.hash = `#/clientes/${c.id}`;
          return;
        }
        App.render();
      },
    });
  }

  async function deleteClient(id) {
    const c = Store.get('clients', id);
    if (!c) return;
    const ok = await UI.confirm({
      title: 'Eliminar cliente',
      message: `Se eliminará a <strong>${esc(c.name)}</strong> junto con todas sus sesiones, mediciones y pagos. Esta acción no se puede deshacer.<br><br>Si solo ha dejado de entrenar, puedes marcarlo como <em>inactivo</em>.`,
    });
    if (!ok) return;
    Store.remove('clients', id);
    UI.toast('Cliente eliminado');
    location.hash = '#/clientes';
    App.render();
  }

  function sessionFields(isNew, clientId) {
    const fields = [
      { name: 'clientId', label: 'Cliente', type: 'select', required: true, options: clientOptions(clientId), placeholder: 'Selecciona un cliente…', full: true },
      { name: 'date', label: 'Fecha', type: 'date', required: true, default: today() },
      { name: 'time', label: 'Hora', type: 'time', required: true, default: '09:00' },
      { name: 'duration', label: 'Duración (min)', type: 'number', min: 5, step: 5, default: Store.settings.defaultDuration || 60 },
      { name: 'type', label: 'Tipo', type: 'select', options: SESSION_TYPES, default: SESSION_TYPES[0] },
      { name: 'location', label: 'Lugar', placeholder: 'Gimnasio, domicilio, parque…' },
      { name: 'status', label: 'Estado', type: 'select', options: Object.entries(SESSION_STATUS).map(([value, s]) => ({ value, label: s.label })), default: 'programada' },
    ];
    if (isNew) {
      fields.push({ name: 'repeat', label: 'Repetir cada semana', type: 'number', min: 1, max: 52, step: 1, default: 1, hint: 'Número de semanas (1 = solo esta sesión).' });
    }
    fields.push({ name: 'notes', label: 'Plan / notas de la sesión', type: 'textarea', placeholder: 'Ejercicios, series, cargas, sensaciones…' });
    return fields;
  }

  function findOverlap(s, ignoreId) {
    const start = s.time;
    const end = endTime(s);
    return Store.data.sessions.find(
      (o) => o.id !== ignoreId && o.date === s.date && o.status !== 'cancelada' && o.time < end && endTime(o) > start
    );
  }

  function openSessionForm(id, preset = {}) {
    const existing = id ? Store.get('sessions', id) : null;
    if (!existing && !Store.data.clients.some((c) => c.status !== 'inactivo')) {
      UI.toast('Primero crea un cliente activo');
      return;
    }
    UI.form({
      title: existing ? 'Editar sesión' : 'Nueva sesión',
      fields: sessionFields(!existing, existing?.clientId || preset.clientId),
      values: existing || preset,
      submitLabel: existing ? 'Guardar cambios' : 'Programar',
      onDelete: existing ? () => deleteRecord('sessions', id, 'la sesión') : null,
      onSubmit: (v) => {
        const repeat = Math.max(1, Math.min(52, Number(v.repeat) || 1));
        delete v.repeat;
        const prevStatus = existing?.status;
        let overlap;
        if (existing) {
          Store.update('sessions', id, v);
          overlap = findOverlap(v, id);
          if (v.status === 'completada' && prevStatus !== 'completada') autoCharge(Store.get('sessions', id));
          UI.toast('Sesión actualizada');
        } else {
          for (let i = 0; i < repeat; i++) {
            const s = Object.assign({}, v, { date: U.addDays(v.date, i * 7) });
            overlap = overlap || findOverlap(s);
            const created = Store.add('sessions', s);
            if (created.status === 'completada') autoCharge(created);
          }
          UI.toast(repeat > 1 ? `${repeat} sesiones programadas` : 'Sesión programada');
        }
        if (overlap) {
          setTimeout(() => UI.toast(`Atención: se solapa con la sesión de ${Store.clientName(overlap.clientId)} (${overlap.time})`), 2700);
        }
        App.render();
      },
    });
  }

  /** Si está activado en ajustes, crea un cobro pendiente al completar una sesión. */
  function autoCharge(session) {
    if (!session || !Store.settings.autoCharge) return;
    const client = Store.get('clients', session.clientId);
    if (!client || !(Number(client.rate) > 0)) return;
    const pack = Store.packBalance(client.id);
    if (pack && pack.remaining >= 0) return; // la sesión se descuenta del bono
    if (Store.data.payments.some((p) => p.sessionId === session.id)) return;
    Store.add('payments', {
      clientId: client.id,
      sessionId: session.id,
      date: session.date,
      amount: Number(client.rate),
      concept: `Sesión ${U.fmtDateShort(session.date)}`,
      method: '',
      status: 'pendiente',
      sessionsIncluded: '',
    });
  }

  function setSessionStatus(id, status) {
    const s = Store.get('sessions', id);
    if (!s) return;
    Store.update('sessions', id, { status });
    if (status === 'completada') autoCharge(s);
    UI.toast(`Sesión marcada como ${SESSION_STATUS[status].label.toLowerCase()}`);
    App.render();
  }

  function measurementFields() {
    return [
      { name: 'date', label: 'Fecha', type: 'date', required: true, default: today(), full: true },
      { name: 'weight', label: 'Peso (kg)', type: 'number', step: '0.1', min: 0 },
      { name: 'bodyFat', label: '% Grasa corporal', type: 'number', step: '0.1', min: 0, max: 80 },
      { type: 'section', label: 'Perímetros (cm)' },
      { name: 'waist', label: 'Cintura', type: 'number', step: '0.1', min: 0 },
      { name: 'hip', label: 'Cadera', type: 'number', step: '0.1', min: 0 },
      { name: 'chest', label: 'Pecho', type: 'number', step: '0.1', min: 0 },
      { name: 'arm', label: 'Brazo', type: 'number', step: '0.1', min: 0 },
      { name: 'thigh', label: 'Muslo', type: 'number', step: '0.1', min: 0 },
      { name: 'notes', label: 'Notas', type: 'textarea', placeholder: 'Test de fuerza, sensaciones, fotos…' },
    ];
  }

  function openMeasurementForm(id, clientId) {
    const existing = id ? Store.get('measurements', id) : null;
    UI.form({
      title: existing ? 'Editar medición' : 'Nueva medición',
      fields: measurementFields(),
      values: existing || {},
      onDelete: existing ? () => deleteRecord('measurements', id, 'la medición') : null,
      onSubmit: (v) => {
        const hasData = METRICS.some((m) => v[m.key] !== '') || v.notes;
        if (!hasData) { UI.toast('Introduce al menos un valor'); return false; }
        if (existing) Store.update('measurements', id, v);
        else Store.add('measurements', Object.assign({ clientId }, v));
        UI.toast('Medición guardada');
        App.render();
      },
    });
  }

  function paymentFields(clientId) {
    return [
      { name: 'clientId', label: 'Cliente', type: 'select', required: true, options: clientOptions(clientId), placeholder: 'Selecciona un cliente…', full: true },
      { name: 'date', label: 'Fecha', type: 'date', required: true, default: today() },
      { name: 'amount', label: `Importe (${Store.settings.currency})`, type: 'number', step: '0.01', min: 0, required: true },
      { name: 'concept', label: 'Concepto', placeholder: 'Sesión, bono 10 sesiones, mensualidad…', default: 'Sesión' },
      { name: 'method', label: 'Método de pago', type: 'select', options: PAY_METHODS, placeholder: '—' },
      { name: 'status', label: 'Estado', type: 'select', options: [{ value: 'pagado', label: 'Pagado' }, { value: 'pendiente', label: 'Pendiente' }], default: 'pagado' },
      { name: 'sessionsIncluded', label: 'Sesiones incluidas (bono)', type: 'number', min: 0, step: 1, hint: 'Si es un bono, indica cuántas sesiones incluye para llevar la cuenta.' },
      { name: 'notes', label: 'Notas', type: 'textarea' },
    ];
  }

  function openPaymentForm(id, preset = {}) {
    const existing = id ? Store.get('payments', id) : null;
    if (!existing && !Store.data.clients.length) { UI.toast('Primero crea un cliente'); return; }
    const values = existing || Object.assign({}, preset);
    if (!existing && preset.clientId && values.amount === undefined) {
      const c = Store.get('clients', preset.clientId);
      if (c && c.rate) values.amount = c.rate;
    }
    UI.form({
      title: existing ? 'Editar pago' : 'Registrar pago',
      fields: paymentFields(existing?.clientId || preset.clientId),
      values,
      onDelete: existing ? () => deleteRecord('payments', id, 'el pago') : null,
      onSubmit: (v) => {
        if (existing) Store.update('payments', id, v);
        else Store.add('payments', v);
        UI.toast('Pago guardado');
        App.render();
      },
    });
  }

  async function deleteRecord(collection, id, label) {
    const ok = await UI.confirm({ title: 'Confirmar eliminación', message: `¿Seguro que quieres eliminar ${label}?` });
    if (!ok) return;
    Store.remove(collection, id);
    UI.toast('Eliminado');
    App.render();
  }

  /* =========================================================
   * Fragmentos reutilizables
   * ======================================================= */

  function sessionItem(s, { showDate = false, showClient = true } = {}) {
    const client = Store.get('clients', s.clientId);
    const when = showDate ? `${U.relativeDay(s.date)} · ` : '';
    const who = showClient && client
      ? `<a href="#/clientes/${client.id}" class="title" style="color:inherit;text-decoration:none">${esc(client.name)}</a>`
      : `<span class="title">${esc(s.type || 'Sesión')}</span>`;
    const quick = s.status === 'programada'
      ? `<button class="btn sm" data-action="session-status" data-id="${s.id}" data-status="completada" title="Marcar como completada">${U.icon('check')}Hecha</button>`
      : statusBadge(s);
    return `<li class="session-row ${s.status}">
      <span class="time-badge">${esc(s.time || '--:--')}</span>
      <div class="grow">
        ${who}
        <div class="meta">${when}${esc(s.duration || 60)} min${showClient && s.type ? ' · ' + esc(s.type) : ''}${s.location ? ' · ' + esc(s.location) : ''}</div>
      </div>
      ${quick}
      <button class="icon-btn" data-action="edit-session" data-id="${s.id}" aria-label="Editar sesión" title="Editar">${U.icon('edit')}</button>
    </li>`;
  }

  /* =========================================================
   * Panel
   * ======================================================= */

  /** Avisos: bonos casi agotados y clientes activos sin sesiones próximas. */
  function computeAlerts() {
    const t = today();
    const alerts = [];
    for (const c of Store.data.clients.filter((x) => x.status !== 'inactivo')) {
      const pack = Store.packBalance(c.id);
      if (pack && pack.remaining <= 1) {
        alerts.push({ c, text: pack.remaining < 0 ? `Bono agotado (${-pack.remaining} sesión/es sin cubrir)` : pack.remaining === 0 ? 'Bono agotado' : 'Queda 1 sesión del bono', kind: 'warning' });
      }
      const last = Store.lastCompletedSession(c.id);
      if (!Store.nextSession(c.id)) {
        const days = last ? U.daysBetween(last.date, t) : null;
        if (days === null || days >= 14) {
          alerts.push({ c, text: last ? `Sin sesiones desde hace ${days} días` : 'Sin sesiones programadas', kind: 'info' });
        }
      }
    }
    return alerts;
  }

  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function incomeChart() {
    const now = U.parseDate(today());
    const items = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const from = U.toISODate(d);
      const to = U.toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      items.push({ label: MONTHS[d.getMonth()].slice(0, 3), value: Store.paidBetween(from, to), current: i === 0 });
    }
    const max = Math.max(...items.map((x) => x.value));
    if (!max) return empty('trend', 'Aún no hay pagos cobrados en los últimos 6 meses.');
    return `<div class="bars" role="img" aria-label="Ingresos cobrados por mes">${items.map((x) => `
      <div class="bar-col${x.current ? ' current' : ''}">
        <span class="bar-value">${x.value ? money(x.value) : ''}</span>
        <div class="bar" style="height:${Math.max(x.value ? 3 : 0, (x.value / max) * 100)}%" title="${esc(x.label)}: ${money(x.value)}"></div>
        <span class="bar-label">${esc(x.label)}</span>
      </div>`).join('')}</div>`;
  }

  function levelBreakdown(active) {
    const rows = LEVELS.map((l, i) => ({ n: i + 1, label: l, count: active.filter((c) => c.level === l).length }));
    const none = active.filter((c) => !LEVELS.includes(c.level)).length;
    if (none) rows.push({ n: null, label: 'Sin nivel asignado', count: none });
    const max = Math.max(1, ...rows.map((r) => r.count));
    return rows.map((r) => `
      <div class="level-row">
        <div class="level-name">${r.n ? `<strong>Nivel ${r.n}</strong> ` : ''}${esc(r.label)}</div>
        <div class="level-bar"><div class="progress"><span style="width:${(r.count / max) * 100}%"></span></div><strong>${r.count}</strong></div>
      </div>`).join('');
  }

  function renderPanel() {
    const t = today();
    const d = Store.data;
    const name = Store.settings.trainerName;
    const firstName = name ? name.split(' ')[0] : '';
    const dateLine = `<p class="eyebrow">${esc(fmtDate(t))}</p>`;

    if (!d.clients.length) {
      return `
        <div class="page-header"><div>${dateLine}<h1 class="display">¡Bienvenido${firstName ? ', ' + esc(firstName) : ''}!</h1><p>Tu centro de control como entrenador personal.</p></div></div>
        <div class="card">
          ${empty('logo', '<strong>Aún no tienes clientes.</strong><br>Empieza añadiendo tu primer cliente o explora la aplicación con datos de ejemplo.',
            `<div class="actions" style="justify-content:center;margin-top:16px">
               <button class="btn primary" data-action="new-client">${U.icon('plus')}Añadir cliente</button>
               <button class="btn" data-action="sample-data">Cargar datos de ejemplo</button>
             </div>`)}
        </div>`;
    }

    const weekStart = U.startOfWeek(t);
    const weekSessions = Store.sessionsBetween(weekStart, U.addDays(weekStart, 6)).filter((s) => s.status !== 'cancelada');
    const monthStart = t.slice(0, 8) + '01';
    const monthEnd = t.slice(0, 8) + '31';
    const income = Store.paidBetween(monthStart, monthEnd);
    const pendingPays = d.payments.filter((p) => p.status === 'pendiente').sort((a, b) => a.date.localeCompare(b.date));
    const pendingMonth = pendingPays.filter((p) => p.date >= monthStart && p.date <= monthEnd).reduce((s, p) => s + Number(p.amount || 0), 0);
    const pending = Store.pendingAmount();
    const pendingClients = new Set(pendingPays.map((p) => p.clientId)).size;
    const overdue = pendingPays.filter((p) => p.date < t).length;
    const active = d.clients.filter((c) => c.status !== 'inactivo');

    const todays = Store.sessionsBetween(t, t).filter((s) => s.status !== 'cancelada');
    const upcoming = Store.sessionsBetween(U.addDays(t, 1), U.addDays(t, 7)).filter((s) => s.status === 'programada');
    const nowTime = `${U.pad(new Date().getHours())}:${U.pad(new Date().getMinutes())}`;
    const nextToday = todays.find((x) => x.status === 'programada' && x.time >= nowTime);
    const alerts = computeAlerts();
    const monthName = MONTHS[U.parseDate(t).getMonth()];

    return `
      <div class="page-header">
        <div>
          ${dateLine}
          <h1 class="display">${greeting()}${firstName ? ', ' + esc(firstName) : ''}.</h1>
          <p>${todays.length ? `Hoy tienes ${todays.length} ${todays.length === 1 ? 'sesión' : 'sesiones'}${nextToday ? ` · la próxima a las ${esc(nextToday.time)} con ${esc(Store.clientName(nextToday.clientId))}` : ''}.` : 'Hoy no tienes sesiones programadas.'}</p>
        </div>
      </div>

      <div class="stats">
        <div class="card stat"><div class="stat-label">Cobrado en ${monthName}</div><div class="stat-value">${money(income)}</div><div class="stat-sub">de ${money(income + pendingMonth)} previstos</div></div>
        <div class="card stat"><div class="stat-label">Por cobrar</div><div class="stat-value">${money(pending)}</div><div class="stat-sub">${pendingClients} ${pendingClients === 1 ? 'cliente' : 'clientes'} · ${overdue} ${overdue === 1 ? 'vencido' : 'vencidos'}</div></div>
        <div class="card stat"><div class="stat-label">Clientes activos</div><div class="stat-value">${active.length}</div><div class="stat-sub">${d.clients.length - active.length} ${d.clients.length - active.length === 1 ? 'inactivo' : 'inactivos'}</div></div>
        <div class="card stat"><div class="stat-label">Sesiones hoy</div><div class="stat-value">${todays.length}</div><div class="stat-sub">${weekSessions.length} esta semana</div></div>
      </div>

      <div class="grid-main">
        <section class="card">
          <div class="card-header"><h2>Ingresos cobrados</h2><span class="muted">Últimos 6 meses</span></div>
          ${incomeChart()}
        </section>
        <section class="card">
          <div class="card-header"><h2>Clientes por nivel</h2></div>
          ${levelBreakdown(active)}
        </section>
      </div>

      <div class="grid-2">
        <section class="card">
          <div class="card-header"><h2>Hoy</h2><button class="btn sm" data-action="new-session" data-date="${t}">${U.icon('plus')}Añadir</button></div>
          ${todays.length ? `<ul class="list">${todays.map((s) => sessionItem(s)).join('')}</ul>` : empty('sun', 'No tienes sesiones hoy.')}
        </section>
        <section class="card">
          <div class="card-header"><h2>Próximos 7 días</h2><a href="#/agenda" class="btn sm">Ver agenda</a></div>
          ${upcoming.length ? `<ul class="list">${upcoming.slice(0, 8).map((s) => sessionItem(s, { showDate: true })).join('')}</ul>${upcoming.length > 8 ? `<p class="muted">y ${upcoming.length - 8} más…</p>` : ''}` : empty('calendar', 'Nada programado esta semana.')}
        </section>
        <section class="card">
          <div class="card-header"><h2>Cobros pendientes</h2><a href="#/pagos" class="btn sm">Ver pagos</a></div>
          ${pendingPays.length ? `<ul class="list">${pendingPays.slice(0, 6).map((p) => `
            <li>
              <div class="grow"><div class="title">${esc(Store.clientName(p.clientId))}</div><div class="meta">${esc(p.concept || 'Pago')} · ${fmtDate(p.date)}</div></div>
              <strong>${money(p.amount)}</strong>
              <button class="btn sm" data-action="mark-paid" data-id="${p.id}">Cobrado</button>
            </li>`).join('')}</ul>` : empty('done', 'Todo cobrado.')}
        </section>
        <section class="card" id="atencion">
          <div class="card-header"><h2>Requieren atención</h2></div>
          ${alerts.length ? `<ul class="list">${alerts.slice(0, 8).map((a) => `
            <li>
              ${avatar(a.c)}
              <div class="grow"><a class="title" href="#/clientes/${a.c.id}" style="color:inherit;text-decoration:none">${esc(a.c.name)}</a><div class="meta">${esc(a.text)}</div></div>
              ${a.kind === 'warning'
                ? `<button class="btn sm" data-action="new-payment" data-client="${a.c.id}">Renovar</button>`
                : `<button class="btn sm" data-action="new-session" data-client="${a.c.id}">Programar</button>`}
            </li>`).join('')}</ul>` : empty('done', 'Todos tus clientes están al día.')}
        </section>
      </div>`;
  }

  /* =========================================================
   * Clientes
   * ======================================================= */

  function filteredClients() {
    const q = state.clientSearch.toLowerCase();
    return Store.clients().filter((c) => {
      if (state.clientFilter !== 'todos' && (c.status || 'activo') !== state.clientFilter) return false;
      if (!q) return true;
      return [c.name, c.email, c.phone, c.goal].some((f) => (f || '').toLowerCase().includes(q));
    });
  }

  function clientsTable() {
    const list = filteredClients();
    if (!list.length) {
      return Store.data.clients.length
        ? empty('search', 'Ningún cliente coincide con la búsqueda.')
        : empty('users', 'Todavía no tienes clientes.', `<div style="margin-top:12px"><button class="btn primary" data-action="new-client">${U.icon('plus')}Añadir cliente</button></div>`);
    }
    return `<div class="table-wrap"><table>
      <thead><tr><th>Cliente</th><th class="hide-sm">Objetivo</th><th class="hide-sm">Teléfono</th><th>Próxima sesión</th><th class="hide-sm">Bono</th><th class="num">Pendiente</th></tr></thead>
      <tbody>${list.map((c) => {
        const next = Store.nextSession(c.id);
        const pack = Store.packBalance(c.id);
        const pend = Store.pendingAmount(c.id);
        return `<tr class="clickable" data-href="#/clientes/${c.id}" tabindex="0">
          <td><div class="name-cell">${avatar(c)}<div><div style="font-weight:600">${esc(c.name)}</div>${c.status === 'inactivo' ? badge('Inactivo') : `<span class="muted" style="font-size:.8rem">${esc(c.level || '')}</span>`}</div></div></td>
          <td class="hide-sm">${esc(c.goal || '—')}</td>
          <td class="hide-sm">${c.phone ? esc(c.phone) : '—'}</td>
          <td>${next ? `${esc(U.relativeDay(next.date))} <span class="muted">${esc(next.time)}</span>` : '<span class="muted">—</span>'}</td>
          <td class="hide-sm">${pack ? badge(`${pack.remaining} restantes`, pack.remaining <= 1 ? 'warning' : 'primary') : '<span class="muted">—</span>'}</td>
          <td class="num">${pend ? `<strong style="color:var(--warning)">${money(pend)}</strong>` : '<span class="muted">—</span>'}</td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }

  function renderClients() {
    const counts = { activo: 0, inactivo: 0 };
    Store.data.clients.forEach((c) => counts[c.status === 'inactivo' ? 'inactivo' : 'activo']++);
    const seg = (v, label) => `<button data-action="client-filter" data-value="${v}" class="${state.clientFilter === v ? 'active' : ''}">${label}</button>`;
    return `
      <div class="page-header">
        <div><h1 class="display">Clientes</h1><p>${Store.data.clients.length} en total</p></div>
        <button class="btn primary" data-action="new-client">${U.icon('plus')}Nuevo cliente</button>
      </div>
      <div class="card">
        <div class="toolbar">
          <input type="search" class="search" id="client-search" placeholder="Buscar por nombre, email, teléfono u objetivo…" value="${esc(state.clientSearch)}" aria-label="Buscar clientes">
          <div class="segmented" role="group" aria-label="Filtrar por estado">
            ${seg('activo', `Activos (${counts.activo})`)}${seg('inactivo', `Inactivos (${counts.inactivo})`)}${seg('todos', 'Todos')}
          </div>
        </div>
        <div id="clients-table">${clientsTable()}</div>
      </div>`;
  }

  function renderClient(id) {
    const c = Store.get('clients', id);
    if (!c) {
      return `<a href="#/clientes" class="back-link">${U.icon('back')} Clientes</a><div class="card">${empty('users', 'Este cliente no existe o fue eliminado.')}</div>`;
    }
    const tabs = [['resumen', 'Resumen'], ['sesiones', 'Sesiones'], ['progreso', 'Progreso'], ['pagos', 'Pagos']];
    const ageVal = U.age(c.birthDate);
    const sub = [c.goal, c.level, ageVal !== null ? `${ageVal} años` : null].filter(Boolean).join(' · ');
    let body = '';
    switch (state.clientTab) {
      case 'sesiones': body = clientSessions(c); break;
      case 'progreso': body = clientProgress(c); break;
      case 'pagos': body = clientPayments(c); break;
      default: body = clientSummary(c);
    }
    return `
      <a href="#/clientes" class="back-link">${U.icon('back')} Clientes</a>
      <div class="card profile-card">
        <div class="profile-cover"></div>
        <div class="profile-head">
          ${avatar(c, 'lg')}
          <div class="grow">
            <h1>${esc(c.name)} ${c.status === 'inactivo' ? badge('Inactivo') : ''}</h1>
            <p>${esc(sub || 'Sin objetivo definido')}</p>
          </div>
          <div class="actions">
            ${c.phone ? `<a class="btn" href="https://wa.me/${esc(c.phone.replace(/[^\d]/g, ''))}" target="_blank" rel="noopener">${U.icon('message')}WhatsApp</a>` : ''}
            ${c.email ? `<a class="btn" href="mailto:${esc(c.email)}">${U.icon('mail')}Email</a>` : ''}
            <button class="btn" data-action="edit-client" data-id="${c.id}">${U.icon('edit')}Editar</button>
            <button class="btn primary" data-action="new-session" data-client="${c.id}">${U.icon('plus')}Sesión</button>
          </div>
        </div>
        ${c.health ? `<div class="alert">${U.icon('alert')}<div><strong>Salud:</strong> ${esc(c.health)}</div></div>` : ''}
      </div>
      <div class="tabs" role="tablist">
        ${tabs.map(([k, l]) => `<button role="tab" aria-selected="${state.clientTab === k}" class="${state.clientTab === k ? 'active' : ''}" data-action="client-tab" data-value="${k}">${l}</button>`).join('')}
      </div>
      ${body}`;
  }

  function clientSummary(c) {
    const sessions = Store.sessionsFor(c.id);
    const done = sessions.filter((s) => s.status === 'completada');
    const noShow = sessions.filter((s) => s.status === 'no-asistio').length;
    const last = done[done.length - 1];
    const next = Store.nextSession(c.id);
    const pack = Store.packBalance(c.id);
    const pend = Store.pendingAmount(c.id);
    const totalPaid = Store.paymentsFor(c.id).filter((p) => p.status === 'pagado').reduce((s, p) => s + Number(p.amount || 0), 0);
    const ms = Store.measurementsFor(c.id).filter((m) => m.weight !== '' && m.weight !== undefined);
    const weightDelta = ms.length >= 2 ? Number(ms[ms.length - 1].weight) - Number(ms[0].weight) : null;
    const lastM = ms[ms.length - 1];
    const imc = lastM && c.height ? Number(lastM.weight) / Math.pow(Number(c.height) / 100, 2) : null;
    const row = (k, v) => (v ? `<dt>${k}</dt><dd>${v}</dd>` : '');

    return `
      <div class="stats">
        <div class="card stat"><div class="stat-label">Sesiones completadas</div><div class="stat-value">${done.length}</div><div class="stat-sub">${noShow} ausencias</div></div>
        <div class="card stat"><div class="stat-label">Próxima sesión</div><div class="stat-value" style="font-size:1.2rem">${next ? esc(U.relativeDay(next.date)) + ' ' + esc(next.time) : '—'}</div><div class="stat-sub">${last ? 'Última: ' + fmtDate(last.date) : 'Sin sesiones previas'}</div></div>
        <div class="card stat"><div class="stat-label">Bono</div><div class="stat-value">${pack ? pack.remaining : '—'}</div><div class="stat-sub">${pack ? `${pack.used} de ${pack.bought} usadas` : 'Pago por sesión'}</div></div>
        <div class="card stat"><div class="stat-label">Pendiente</div><div class="stat-value">${money(pend)}</div><div class="stat-sub">${money(totalPaid)} cobrado en total</div></div>
      </div>
      <div class="grid-2">
        <section class="card">
          <div class="card-header"><h2>Datos</h2></div>
          <dl class="dl">
            ${row('Email', c.email ? esc(c.email) : '')}
            ${row('Teléfono', c.phone ? esc(c.phone) : '')}
            ${row('Nacimiento', c.birthDate ? fmtDate(c.birthDate) : '')}
            ${row('Sexo', esc(c.gender || ''))}
            ${row('Altura', c.height ? fmtNum(c.height) + ' cm' : '')}
            ${row('Alta', c.startDate ? fmtDate(c.startDate) : '')}
            ${row('Tarifa', c.rate ? money(c.rate) + ' / sesión' : '')}
            ${row('Notas', esc(c.notes || ''))}
          </dl>
        </section>
        <section class="card">
          <div class="card-header"><h2>Progreso</h2><button class="btn sm" data-action="client-tab" data-value="progreso">Ver todo</button></div>
          ${lastM ? `<dl class="dl">
            ${row('Peso actual', `${fmtNum(lastM.weight)} kg <span class="muted">(${fmtDate(lastM.date)})</span>`)}
            ${weightDelta !== null ? row('Cambio', `<span class="${weightDelta > 0 ? 'delta-up' : 'delta-down'}">${weightDelta > 0 ? '+' : ''}${fmtNum(weightDelta)} kg</span> desde ${fmtDate(ms[0].date)}`) : ''}
            ${imc ? row('IMC', fmtNum(imc)) : ''}
          </dl>` : empty('ruler', 'Sin mediciones todavía.', `<div style="margin-top:10px"><button class="btn sm" data-action="new-measurement" data-client="${c.id}">${U.icon('plus')}Medición</button></div>`)}
          ${ms.length >= 2 ? `<div class="mt">${UI.lineChart(ms.map((m) => ({ x: m.date, y: m.weight })), { unit: 'kg', height: 180 })}</div>` : ''}
        </section>
      </div>`;
  }

  function clientSessions(c) {
    const sessions = Store.sessionsFor(c.id).reverse();
    const statusSelect = (s) => `<select data-action-change="session-status" data-id="${s.id}" aria-label="Estado" style="width:auto;padding:4px 8px">
      ${Object.entries(SESSION_STATUS).map(([v, o]) => `<option value="${v}" ${s.status === v ? 'selected' : ''}>${o.label}</option>`).join('')}</select>`;
    return `<section class="card">
      <div class="card-header"><h2>Sesiones (${sessions.length})</h2><button class="btn primary sm" data-action="new-session" data-client="${c.id}">${U.icon('plus')}Sesión</button></div>
      ${sessions.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Fecha</th><th>Hora</th><th class="hide-sm">Tipo</th><th>Estado</th><th class="hide-sm">Notas</th><th></th></tr></thead>
        <tbody>${sessions.map((s) => `<tr>
          <td>${fmtDate(s.date)}</td>
          <td>${esc(s.time)}</td>
          <td class="hide-sm">${esc(s.type || '—')}</td>
          <td>${statusSelect(s)}</td>
          <td class="hide-sm muted" style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.notes || '')}</td>
          <td class="actions-cell"><button class="icon-btn" data-action="edit-session" data-id="${s.id}" aria-label="Editar">${U.icon('edit')}</button></td>
        </tr>`).join('')}</tbody></table></div>` : empty('calendar', 'Sin sesiones registradas.')}
    </section>`;
  }

  function clientProgress(c) {
    const ms = Store.measurementsFor(c.id);
    const metric = METRICS.find((m) => m.key === state.metric) || METRICS[0];
    const available = METRICS.filter((m) => ms.some((x) => x[m.key] !== '' && x[m.key] !== undefined));
    const points = ms.map((m) => ({ x: m.date, y: m[metric.key] })).filter((p) => p.y !== '' && p.y !== undefined);
    const first = ms[0];
    const delta = (m, key) => {
      if (!first || m === first || m[key] === '' || m[key] === undefined || first[key] === '' || first[key] === undefined) return '';
      const d = Number(m[key]) - Number(first[key]);
      if (!d) return '';
      return ` <small class="${d > 0 ? 'delta-up' : 'delta-down'}">${d > 0 ? '+' : ''}${fmtNum(d)}</small>`;
    };
    return `
      <section class="card">
        <div class="card-header">
          <h2>Evolución: ${esc(metric.label)}</h2>
          <button class="btn primary sm" data-action="new-measurement" data-client="${c.id}">${U.icon('plus')}Medición</button>
        </div>
        ${available.length ? `<div class="segmented" style="margin-bottom:12px">${available.map((m) => `<button data-action="metric" data-value="${m.key}" class="${m.key === metric.key ? 'active' : ''}">${m.label}</button>`).join('')}</div>` : ''}
        ${ms.length ? UI.lineChart(points, { unit: metric.unit }) : empty('ruler', 'Registra la primera medición para empezar a ver la evolución.')}
      </section>
      ${ms.length ? `<section class="card">
        <div class="card-header"><h2>Historial de mediciones</h2><span class="muted" style="font-size:.85rem">Diferencias respecto a la primera medición</span></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Fecha</th>${METRICS.map((m) => `<th class="num">${m.label}${m.unit === '%' ? '' : ` <span style="text-transform:none">(${m.unit})</span>`}</th>`).join('')}<th></th></tr></thead>
          <tbody>${ms.slice().reverse().map((m) => `<tr>
            <td>${fmtDate(m.date)}${m.notes ? ` <span class="muted" title="${esc(m.notes)}">${U.icon('note')}</span>` : ''}</td>
            ${METRICS.map((k) => `<td class="num">${fmtNum(m[k.key])}${delta(m, k.key)}</td>`).join('')}
            <td class="actions-cell"><button class="icon-btn" data-action="edit-measurement" data-id="${m.id}" aria-label="Editar">${U.icon('edit')}</button></td>
          </tr>`).join('')}</tbody>
        </table></div>
      </section>` : ''}`;
  }

  function paymentsTable(list, { showClient = true } = {}) {
    if (!list.length) return empty('wallet', 'No hay pagos registrados.');
    return `<div class="table-wrap"><table>
      <thead><tr><th>Fecha</th>${showClient ? '<th>Cliente</th>' : ''}<th>Concepto</th><th class="hide-sm">Método</th><th class="num">Importe</th><th>Estado</th><th></th></tr></thead>
      <tbody>${list.map((p) => `<tr>
        <td>${fmtDate(p.date)}</td>
        ${showClient ? `<td><a href="#/clientes/${p.clientId}" style="color:inherit">${esc(Store.clientName(p.clientId))}</a></td>` : ''}
        <td>${esc(p.concept || '—')}${Number(p.sessionsIncluded) > 0 ? ' ' + badge(`${p.sessionsIncluded} ses.`, 'primary') : ''}</td>
        <td class="hide-sm">${esc(p.method || '—')}</td>
        <td class="num"><strong>${money(p.amount)}</strong></td>
        <td>${payBadge(p)}</td>
        <td class="actions-cell">
          ${p.status === 'pendiente' ? `<button class="btn sm" data-action="mark-paid" data-id="${p.id}">Cobrado</button>` : ''}
          <button class="icon-btn" data-action="edit-payment" data-id="${p.id}" aria-label="Editar">${U.icon('edit')}</button>
        </td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  function clientPayments(c) {
    const list = Store.paymentsFor(c.id);
    return `<section class="card">
      <div class="card-header"><h2>Pagos (${list.length})</h2><button class="btn primary sm" data-action="new-payment" data-client="${c.id}">${U.icon('plus')}Pago</button></div>
      ${paymentsTable(list, { showClient: false })}
    </section>`;
  }

  /* =========================================================
   * Agenda
   * ======================================================= */

  function renderAgenda() {
    const start = state.week;
    const end = U.addDays(start, 6);
    const t = today();
    const sessions = Store.sessionsBetween(start, end);
    const label = `${U.fmtDateShort(start)} – ${fmtDate(end)}`;
    const active = sessions.filter((s) => s.status !== 'cancelada');
    const hours = active.reduce((sum, s) => sum + (Number(s.duration) || 60), 0) / 60;

    let days = '';
    for (let i = 0; i < 7; i++) {
      const day = U.addDays(start, i);
      const list = sessions.filter((s) => s.date === day);
      days += `<div class="day-group">
        <h3 class="day-title ${day === t ? 'today' : ''}"><span class="capitalize">${esc(U.fmtWeekday(day))}</span>${day === t ? badge('Hoy', 'primary') : ''}
          <button class="icon-btn" style="margin-left:auto;width:28px;height:28px" data-action="new-session" data-date="${day}" aria-label="Añadir sesión el ${esc(U.fmtWeekday(day))}" title="Añadir sesión">${U.icon('plus')}</button>
        </h3>
        ${list.length ? `<ul class="list">${list.map((s) => sessionItem(s)).join('')}</ul>` : '<div class="muted" style="font-size:.85rem;padding:2px 0 8px">Sin sesiones</div>'}
      </div>`;
    }

    return `
      <div class="page-header">
        <div><h1 class="display">Agenda</h1><p>${active.length} sesiones · ${fmtNum(hours)} h de entrenamiento</p></div>
        <button class="btn primary" data-action="new-session">${U.icon('plus')}Nueva sesión</button>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="week-nav">
            <button class="btn sm" data-action="week" data-value="-1" aria-label="Semana anterior">${U.icon('left')}</button>
            <span class="week-label">${esc(label)}</span>
            <button class="btn sm" data-action="week" data-value="1" aria-label="Semana siguiente">${U.icon('right')}</button>
          </div>
          <button class="btn sm" data-action="week" data-value="0">Esta semana</button>
        </div>
        ${days}
      </div>`;
  }

  /* =========================================================
   * Pagos
   * ======================================================= */

  function renderPayments() {
    const t = today();
    const all = Store.data.payments.slice().sort((a, b) => b.date.localeCompare(a.date));
    const list = state.payFilter === 'todos' ? all : all.filter((p) => p.status === state.payFilter);
    const month = Store.paidBetween(t.slice(0, 8) + '01', t.slice(0, 8) + '31');
    const prevMonthStart = (() => { const d = U.parseDate(t); d.setDate(1); d.setMonth(d.getMonth() - 1); return U.toISODate(d); })();
    const prevMonth = Store.paidBetween(prevMonthStart, prevMonthStart.slice(0, 8) + '31');
    const year = Store.paidBetween(t.slice(0, 4) + '-01-01', t.slice(0, 4) + '-12-31');
    const seg = (v, l) => `<button data-action="pay-filter" data-value="${v}" class="${state.payFilter === v ? 'active' : ''}">${l}</button>`;
    return `
      <div class="page-header">
        <div><h1 class="display">Pagos</h1><p>Cobros, bonos y pagos pendientes</p></div>
        <button class="btn primary" data-action="new-payment">${U.icon('plus')}Registrar pago</button>
      </div>
      <div class="stats">
        <div class="card stat"><div class="stat-label">Cobrado este mes</div><div class="stat-value">${money(month)}</div><div class="stat-sub">Mes anterior: ${money(prevMonth)}</div></div>
        <div class="card stat"><div class="stat-label">Pendiente de cobro</div><div class="stat-value">${money(Store.pendingAmount())}</div><div class="stat-sub">${all.filter((p) => p.status === 'pendiente').length} pagos</div></div>
        <div class="card stat"><div class="stat-label">Cobrado en ${t.slice(0, 4)}</div><div class="stat-value">${money(year)}</div></div>
      </div>
      <div class="card">
        <div class="toolbar"><div class="segmented" role="group" aria-label="Filtrar pagos">${seg('todos', 'Todos')}${seg('pendiente', 'Pendientes')}${seg('pagado', 'Pagados')}</div></div>
        ${paymentsTable(list)}
      </div>`;
  }

  /* =========================================================
   * Ajustes
   * ======================================================= */

  function renderSettings() {
    const s = Store.settings;
    const d = Store.data;
    return `
      <div class="page-header"><div><h1 class="display">Ajustes</h1><p>Preferencias y copias de seguridad</p></div></div>
      <div class="grid-2">
        <section class="card">
          <div class="card-header"><h2>Preferencias</h2></div>
          <form id="settings-form" class="form-grid">
            <div class="field full"><label for="s-trainerName">Tu nombre</label><input id="s-trainerName" name="trainerName" value="${esc(s.trainerName)}" placeholder="Para el saludo del panel"></div>
            <div class="field"><label for="s-currency">Moneda</label><select id="s-currency" name="currency">${CURRENCIES.map((c) => `<option value="${c.value}" ${s.currency === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}</select></div>
            <div class="field"><label for="s-theme">Tema</label><select id="s-theme" name="theme">
              ${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, l]) => `<option value="${v}" ${s.theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <div class="field"><label for="s-defaultRate">Tarifa por defecto</label><input id="s-defaultRate" name="defaultRate" type="number" step="0.01" min="0" value="${esc(s.defaultRate)}"></div>
            <div class="field"><label for="s-defaultDuration">Duración por defecto (min)</label><input id="s-defaultDuration" name="defaultDuration" type="number" step="5" min="5" value="${esc(s.defaultDuration)}"></div>
            <div class="field check full"><label><input type="checkbox" name="autoCharge" ${s.autoCharge ? 'checked' : ''}> Al completar una sesión, crear un cobro pendiente con la tarifa del cliente</label>
              <div class="hint">No se aplica a clientes con bono activo: esas sesiones se descuentan del bono.</div></div>
            <div class="full"><button type="submit" class="btn primary">Guardar preferencias</button></div>
          </form>
        </section>
        <section class="card">
          <div class="card-header"><h2>Tus datos</h2></div>
          <p class="muted" style="margin-top:0">Los datos se guardan <strong>solo en este navegador</strong>. Exporta una copia de seguridad con regularidad para no perderlos y para pasarlos a otro dispositivo.</p>
          ${Store.storageOk ? '' : `<div class="alert">${U.icon('alert')}<div>El navegador no permite guardar datos (¿modo privado?). Los cambios se perderán al cerrar.</div></div>`}
          <p>${d.clients.length} clientes · ${d.sessions.length} sesiones · ${d.measurements.length} mediciones · ${d.payments.length} pagos</p>
          <div class="actions">
            <button class="btn primary" data-action="export">${U.icon('download')} Exportar copia</button>
            <label class="btn" for="import-file" tabindex="0">${U.icon('upload')} Importar copia</label>
            <input type="file" id="import-file" accept="application/json,.json" hidden>
            <button class="btn" data-action="export-csv">${U.icon('file')} Exportar clientes (CSV)</button>
          </div>
          <hr style="border:0;border-top:1px solid var(--border);margin:18px 0">
          <div class="actions">
            <button class="btn" data-action="sample-data">Cargar datos de ejemplo</button>
            <button class="btn danger" data-action="reset-data">Borrar todos los datos</button>
          </div>
        </section>
      </div>`;
  }

  function saveSettings(formEl) {
    const fd = new FormData(formEl);
    Object.assign(Store.settings, {
      trainerName: (fd.get('trainerName') || '').trim(),
      currency: fd.get('currency'),
      theme: fd.get('theme'),
      defaultRate: Number(fd.get('defaultRate')) || 0,
      defaultDuration: Number(fd.get('defaultDuration')) || 60,
      autoCharge: fd.get('autoCharge') === 'on',
    });
    Store.save();
    App.applyTheme();
    UI.toast('Preferencias guardadas');
    App.render();
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCSV() {
    const cols = [['name', 'Nombre'], ['email', 'Email'], ['phone', 'Teléfono'], ['birthDate', 'Nacimiento'], ['goal', 'Objetivo'], ['level', 'Nivel'], ['status', 'Estado'], ['rate', 'Tarifa'], ['startDate', 'Alta'], ['health', 'Salud'], ['notes', 'Notas']];
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [cols.map((c) => q(c[1])).join(';')].concat(Store.clients().map((c) => cols.map(([k]) => q(c[k])).join(';')));
    download(`clientes-${today()}.csv`, '﻿' + rows.join('\r\n'), 'text/csv;charset=utf-8');
  }

  async function importFile(file) {
    if (!file) return;
    const ok = await UI.confirm({
      title: 'Importar copia de seguridad',
      message: 'Los datos actuales se <strong>sustituirán</strong> por los del archivo. ¿Continuar?',
      confirmLabel: 'Importar',
      danger: false,
    });
    if (!ok) return;
    try {
      Store.importJSON(await file.text());
      App.applyTheme();
      UI.toast('Copia importada correctamente');
      App.render();
    } catch (e) {
      UI.toast('No se pudo importar: ' + e.message);
    }
  }

  /* ---------- Datos de ejemplo ---------- */
  async function loadSample() {
    if (Store.data.clients.length) {
      const ok = await UI.confirm({ title: 'Cargar datos de ejemplo', message: 'Se añadirán clientes ficticios a tus datos actuales. ¿Continuar?', confirmLabel: 'Añadir', danger: false });
      if (!ok) return;
    }
    const t = today();
    const people = [
      { name: 'Laura Martínez', email: 'laura@example.com', phone: '+34 600 111 222', birthDate: '1990-04-12', gender: 'Mujer', goal: 'Pérdida de grasa', level: 'Intermedio', rate: 35, height: 165, health: 'Molestias en la rodilla izquierda: evitar impacto alto.', w: 72, fat: 30, pack: 16, days: [0, 3], time: '08:00' },
      { name: 'Carlos Ruiz', email: 'carlos@example.com', phone: '+34 600 333 444', birthDate: '1985-09-30', gender: 'Hombre', goal: 'Ganancia muscular', level: 'Avanzado', rate: 40, height: 180, w: 78, fat: 18, days: [1, 4], time: '18:30' },
      { name: 'Ana Gómez', email: 'ana@example.com', phone: '+34 600 555 666', birthDate: '1972-01-20', gender: 'Mujer', goal: 'Salud general', level: 'Principiante', rate: 30, height: 158, health: 'Hipertensión controlada con medicación.', w: 68, fat: 34, pack: 8, days: [2], time: '10:00' },
      { name: 'Javier López', email: 'javier@example.com', phone: '+34 600 777 888', birthDate: '1998-06-05', gender: 'Hombre', goal: 'Rendimiento deportivo', level: 'Intermedio', rate: 35, height: 176, w: 74, fat: 15, days: [0, 2, 4], time: '19:30' },
      { name: 'Marta Sánchez', email: 'marta@example.com', phone: '+34 600 999 000', birthDate: '1988-11-15', gender: 'Mujer', goal: 'Fuerza', level: 'Intermedio', rate: 35, height: 170, w: 63, fat: 24, days: [], time: '12:00', inactive: true },
    ];
    const weekStart = U.startOfWeek(t);
    people.forEach((p, idx) => {
      const c = Store.add('clients', {
        name: p.name, email: p.email, phone: p.phone, birthDate: p.birthDate, gender: p.gender, goal: p.goal, level: p.level,
        rate: p.rate, height: p.height, health: p.health || '', notes: '', startDate: U.addDays(t, -56), status: p.inactive ? 'inactivo' : 'activo',
      });
      // Sesiones: 6 semanas atrás + 2 semanas adelante
      for (let w = -6; w <= 1; w++) {
        for (const d of p.days) {
          const date = U.addDays(weekStart, w * 7 + d);
          const past = date < t;
          const status = past ? ((w * 7 + d + idx) % 9 === 0 ? 'no-asistio' : 'completada') : 'programada';
          Store.add('sessions', { clientId: c.id, date, time: p.time, duration: 60, type: w === -6 ? 'Evaluación' : 'Entrenamiento personal', location: 'Gimnasio', status, notes: past ? 'Sesión de fuerza: sentadilla, press, remo.' : '' });
        }
      }
      // Mediciones cada 2 semanas
      for (let i = 0; i < 4; i++) {
        const trend = p.goal === 'Ganancia muscular' ? 0.6 : -0.9;
        Store.add('measurements', {
          clientId: c.id, date: U.addDays(t, -56 + i * 14 + 1),
          weight: Math.round((p.w + trend * i + (i % 2 ? 0.2 : 0)) * 10) / 10,
          bodyFat: Math.round((p.fat - 0.7 * i) * 10) / 10,
          waist: Math.round((p.w + 8 - 1.1 * i) * 10) / 10,
          hip: '', chest: '', arm: '', thigh: '', notes: '',
        });
      }
      // Pagos
      if (p.pack) {
        Store.add('payments', { clientId: c.id, date: U.addDays(t, -50), amount: p.rate * p.pack * 0.9, concept: `Bono ${p.pack} sesiones`, method: 'Transferencia', status: 'pagado', sessionsIncluded: p.pack });
      } else if (!p.inactive) {
        Store.add('payments', { clientId: c.id, date: U.addDays(t, -35), amount: p.rate * 4 * p.days.length, concept: 'Mensualidad', method: 'Tarjeta', status: 'pagado', sessionsIncluded: '' });
        Store.add('payments', { clientId: c.id, date: U.addDays(t, -5), amount: p.rate * 4 * p.days.length, concept: 'Mensualidad', method: '', status: 'pendiente', sessionsIncluded: '' });
      }
    });
    UI.toast('Datos de ejemplo cargados');
    App.render();
  }

  async function resetData() {
    const ok = await UI.confirm({ title: 'Borrar todos los datos', message: 'Se eliminarán <strong>todos</strong> los clientes, sesiones, mediciones y pagos. Te recomendamos exportar una copia antes. ¿Continuar?', confirmLabel: 'Borrar todo' });
    if (!ok) return;
    Store.reset();
    UI.toast('Datos borrados');
    App.render();
  }

  /* =========================================================
   * Acciones (delegadas desde app.js)
   * ======================================================= */

  const actions = {
    'new-client': () => openClientForm(),
    alerts: () => {
      const go = () => document.getElementById('atencion')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (location.hash.replace(/^#\/?/, '') === 'panel' || !location.hash) go();
      else { location.hash = '#/panel'; setTimeout(go, 60); }
    },
    'edit-client': (d) => openClientForm(d.id),
    'new-session': (d) => openSessionForm(null, Object.assign({}, d.client ? { clientId: d.client } : {}, d.date ? { date: d.date } : {})),
    'edit-session': (d) => openSessionForm(d.id),
    'session-status': (d, el) => setSessionStatus(d.id, d.status || el.value),
    'new-measurement': (d) => openMeasurementForm(null, d.client),
    'edit-measurement': (d) => openMeasurementForm(d.id),
    'new-payment': (d) => openPaymentForm(null, d.client ? { clientId: d.client } : {}),
    'edit-payment': (d) => openPaymentForm(d.id),
    'mark-paid': (d) => {
      Store.update('payments', d.id, { status: 'pagado', paidAt: today() });
      UI.toast('Pago marcado como cobrado');
      App.render();
    },
    'client-tab': (d) => { state.clientTab = d.value; App.render(); },
    'client-filter': (d) => { state.clientFilter = d.value; App.render(); },
    metric: (d) => { state.metric = d.value; App.render(); },
    'pay-filter': (d) => { state.payFilter = d.value; App.render(); },
    week: (d) => {
      const n = Number(d.value);
      state.week = n === 0 ? U.startOfWeek(today()) : U.addDays(state.week, n * 7);
      App.render();
    },
    export: () => { download(`entrenapro-copia-${today()}.json`, Store.exportJSON(), 'application/json'); UI.toast('Copia exportada'); },
    'export-csv': () => exportCSV(),
    'sample-data': () => loadSample(),
    'reset-data': () => resetData(),
  };

  function onClientSearch(value) {
    state.clientSearch = value;
    const el = document.getElementById('clients-table');
    if (el) el.innerHTML = clientsTable();
  }

  window.Views = {
    state, actions, renderPanel, renderClients, renderClient, renderAgenda, renderPayments, renderSettings,
    saveSettings, importFile, onClientSearch, computeAlerts,
  };
})();
