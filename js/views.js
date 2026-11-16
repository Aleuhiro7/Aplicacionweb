/* Vistas de la aplicación y acciones del usuario (asesorías online). */
(function () {
  'use strict';

  const { esc, fmtDate, fmtMoney, fmtNum, today, avatar } = U;
  const money = (n) => fmtMoney(n, Store.settings.currency);

  /* ---------- Catálogos ---------- */
  const CLIENT_STATUS = {
    activo: { label: 'Activo', badge: 'success' },
    pausa: { label: 'En pausa', badge: 'warning' },
    inactivo: { label: 'Baja', badge: '' },
  };
  const FEE_STATUS = {
    pagado: { label: 'Pagado', badge: 'success' },
    pendiente: { label: 'Pendiente', badge: 'info' },
    vencido: { label: 'Vencido', badge: 'danger' },
  };
  const PAY_METHODS = ['Transferencia', 'Bizum', 'Tarjeta', 'PayPal', 'Efectivo', 'Otro'];
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
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const monthName = (iso) => MONTHS[U.parseDate(iso).getMonth()];
  const STALE_DAYS = 14; // días sin actualizar progreso para avisar

  /* Estado de la interfaz (no se guarda). */
  const state = {
    clientSearch: '',
    clientFilter: 'activo',
    clientTab: 'resumen',
    metric: 'weight',
    payFilter: 'todos',
  };

  const badge = (text, kind) => `<span class="badge ${kind || ''}">${esc(text)}</span>`;
  const clientStatus = (c) => (CLIENT_STATUS[c.status] ? c.status : 'activo');
  const statusBadge = (c) => badge(CLIENT_STATUS[clientStatus(c)].label, CLIENT_STATUS[clientStatus(c)].badge);
  const feeBadge = (fs) => (fs ? badge(FEE_STATUS[fs.status].label, FEE_STATUS[fs.status].badge) : '<span class="muted">—</span>');
  const payBadge = (p) => (p.status === 'pagado' ? badge('Pagado', 'success') : badge('Pendiente', 'warning'));
  const empty = (icon, text, extra = '') => `<div class="empty"><span class="empty-icon">${U.icon(icon)}</span><div>${text}</div>${extra}</div>`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function greeting() {
    const h = new Date().getHours();
    return h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  }

  function clientOptions(includeId) {
    return Store.clients()
      .filter((c) => c.status !== 'inactivo' || c.id === includeId)
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
      { name: 'phone', label: 'Teléfono / WhatsApp', type: 'tel' },
      { name: 'birthDate', label: 'Fecha de nacimiento', type: 'date' },
      { name: 'gender', label: 'Sexo', type: 'select', options: ['', 'Mujer', 'Hombre', 'Otro'].map((o) => ({ value: o, label: o || '—' })) },
      { type: 'section', label: 'Asesoría' },
      { name: 'startDate', label: 'Fecha de alta', type: 'date', default: today() },
      { name: 'status', label: 'Estado', type: 'select', options: Object.entries(CLIENT_STATUS).map(([value, s]) => ({ value, label: s.label })), default: 'activo' },
      { name: 'rate', label: `Cuota mensual (${Store.settings.currency})`, type: 'number', step: '0.01', min: 0, default: Store.settings.defaultRate },
      { name: 'billingDay', label: 'Día de cobro', type: 'number', min: 1, max: 31, step: 1, default: Number(today().slice(8)), hint: 'Día del mes en que vence la cuota.' },
      { name: 'height', label: 'Altura (cm)', type: 'number', step: '0.1', min: 0 },
      { type: 'section', label: 'Salud y notas' },
      { name: 'health', label: 'Lesiones, patologías o medicación', type: 'textarea', placeholder: 'Ej.: lesión de rodilla derecha, hipertensión controlada…' },
      { name: 'notes', label: 'Notas', type: 'textarea', placeholder: 'Horarios, material disponible, preferencias, motivación…' },
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
          App.render();
          return;
        }
        const c = Store.add('clients', v);
        UI.toast('Cliente creado');
        location.hash = `#/clientes/${c.id}`;
      },
    });
  }

  async function deleteClient(id) {
    const c = Store.get('clients', id);
    if (!c) return;
    const ok = await UI.confirm({
      title: 'Eliminar cliente',
      message: `Se eliminará a <strong>${esc(c.name)}</strong> junto con todas sus mediciones y pagos. Esta acción no se puede deshacer.<br><br>Si solo ha dejado la asesoría, puedes marcarlo como <em>Baja</em> o <em>En pausa</em>.`,
    });
    if (!ok) return;
    Store.remove('clients', id);
    UI.toast('Cliente eliminado');
    location.hash = '#/clientes';
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
      { name: 'notes', label: 'Notas de la revisión', type: 'textarea', placeholder: 'Sensaciones, adherencia, cambios en el plan…' },
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
      { name: 'concept', label: 'Concepto', placeholder: 'Cuota mensual, plan trimestral…', default: `Cuota de ${monthName(today())}` },
      { name: 'method', label: 'Método de pago', type: 'select', options: PAY_METHODS, placeholder: '—' },
      { name: 'status', label: 'Estado', type: 'select', options: [{ value: 'pagado', label: 'Pagado' }, { value: 'pendiente', label: 'Pendiente' }], default: 'pagado' },
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

  /** Abre el registro de pago con la cuota del mes ya rellenada. */
  function payFee(clientId) {
    const c = Store.get('clients', clientId);
    if (!c) return;
    openPaymentForm(null, { clientId, amount: Number(c.rate) || '', concept: `Cuota de ${monthName(today())}` });
  }

  async function deleteRecord(collection, id, label) {
    const ok = await UI.confirm({ title: 'Confirmar eliminación', message: `¿Seguro que quieres eliminar ${label}?` });
    if (!ok) return;
    Store.remove(collection, id);
    UI.toast('Eliminado');
    App.render();
  }

  /* =========================================================
   * Resumen
   * ======================================================= */

  /** Avisos: cuotas vencidas y clientes activos sin actualizar su progreso. */
  function computeAlerts() {
    const t = today();
    const alerts = [];
    for (const c of Store.clients().filter((x) => clientStatus(x) === 'activo')) {
      const fs = Store.feeStatus(c);
      if (fs && fs.status === 'vencido') {
        alerts.push({ c, text: `Cuota de ${monthName(t)} vencida (${money(fs.amount)})`, action: 'pay-fee', label: 'Cobrar' });
      }
      const last = Store.lastMeasurement(c.id);
      const days = last ? U.daysBetween(last.date, t) : null;
      if (days === null || days >= STALE_DAYS) {
        alerts.push({ c, text: last ? `Sin actualizar progreso desde hace ${days} días` : 'Sin mediciones todavía', action: 'new-measurement', label: 'Medición' });
      }
    }
    return alerts;
  }

  function incomeChart() {
    const now = U.parseDate(today());
    const items = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const { from, to } = Store.monthRange(U.toISODate(d));
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

  function renderPanel() {
    const t = today();
    const d = Store.data;
    const name = Store.settings.trainerName || 'David Orihuela';
    const firstName = name.split(' ')[0];
    const dateLine = `<p class="eyebrow">${esc(fmtDate(t))}</p>`;

    if (!d.clients.length) {
      return `
        <div class="page-header"><div>${dateLine}<h1 class="display">¡Bienvenido, ${esc(firstName)}!</h1><p>Tu centro de control de asesorías online.</p></div></div>
        <div class="card">
          ${empty('logo', '<strong>Aún no tienes clientes.</strong><br>Empieza añadiendo tu primer cliente o explora la aplicación con datos de ejemplo.',
            `<div class="actions" style="justify-content:center;margin-top:16px">
               <button class="btn primary" data-action="new-client">${U.icon('plus')}Añadir cliente</button>
               <button class="btn" data-action="sample-data">Cargar datos de ejemplo</button>
             </div>`)}
        </div>`;
    }

    const { from, to } = Store.monthRange(t);
    const month = monthName(t);
    const income = Store.paidBetween(from, to);
    const rec = Store.receivables();
    const pending = rec.reduce((s, r) => s + r.amount, 0);
    const pendingMonth = rec.filter((r) => r.date >= from && r.date <= to).reduce((s, r) => s + r.amount, 0);
    const pendingClients = new Set(rec.map((r) => r.clientId)).size;
    const overdue = rec.filter((r) => r.overdue).length;
    const active = d.clients.filter((c) => clientStatus(c) === 'activo');
    const paused = d.clients.filter((c) => clientStatus(c) === 'pausa').length;
    const newThisMonth = d.clients.filter((c) => c.startDate >= from && c.startDate <= to).length;
    const alerts = computeAlerts();

    const order = ['vencido', 'pendiente', 'pagado'];
    const fees = active
      .map((c) => ({ c, fs: Store.feeStatus(c) }))
      .filter((x) => x.fs)
      .sort((a, b) => order.indexOf(a.fs.status) - order.indexOf(b.fs.status) || a.fs.dueDate.localeCompare(b.fs.dueDate));
    const paidCount = fees.filter((x) => x.fs.status === 'pagado').length;

    return `
      <div class="page-header">
        <div>
          ${dateLine}
          <h1 class="display">${greeting()}, ${esc(firstName)}.</h1>
          <p>${fees.length ? `${paidCount} de ${plural(fees.length, 'cuota cobrada', 'cuotas cobradas')} este mes${overdue ? ` · ${plural(overdue, 'pago vencido', 'pagos vencidos')}` : ''}.` : 'Añade la cuota mensual de tus clientes para controlar los cobros.'}</p>
        </div>
      </div>

      <div class="stats">
        <div class="card stat"><div class="stat-label">Cobrado en ${month}</div><div class="stat-value">${money(income)}</div><div class="stat-sub">de ${money(income + pendingMonth)} previstos</div></div>
        <div class="card stat"><div class="stat-label">Por cobrar</div><div class="stat-value">${money(pending)}</div><div class="stat-sub">${plural(pendingClients, 'cliente', 'clientes')} · ${plural(overdue, 'vencido', 'vencidos')}</div></div>
        <div class="card stat"><div class="stat-label">Clientes activos</div><div class="stat-value">${active.length}</div><div class="stat-sub">${paused} en pausa</div></div>
        <div class="card stat"><div class="stat-label">Altas en ${month}</div><div class="stat-value">${newThisMonth}</div><div class="stat-sub">${plural(d.clients.length, 'cliente', 'clientes')} en total</div></div>
      </div>

      <section class="card chart-card">
        <div class="card-header"><h2>Ingresos cobrados</h2><span class="muted">Últimos 6 meses</span></div>
        ${incomeChart()}
      </section>

      <div class="grid-2">
        <section class="card">
          <div class="card-header"><h2>Cuotas de ${month}</h2><a href="#/pagos" class="btn sm">Ver pagos</a></div>
          ${fees.length ? `<ul class="list">${fees.map(({ c, fs }) => `
            <li>
              ${avatar(c)}
              <div class="grow"><a class="title" href="#/clientes/${c.id}" style="color:inherit;text-decoration:none">${esc(c.name)}</a><div class="meta">${money(fs.amount)} · ${fs.status === 'pagado' ? 'cobrada' : 'vence el ' + esc(U.fmtDateShort(fs.dueDate))}</div></div>
              ${feeBadge(fs)}
              ${fs.status !== 'pagado' ? `<button class="btn sm" data-action="pay-fee" data-client="${c.id}">Cobrar</button>` : ''}
            </li>`).join('')}</ul>` : empty('wallet', 'Ningún cliente activo tiene cuota mensual.')}
        </section>
        <section class="card" id="atencion">
          <div class="card-header"><h2>Requieren atención</h2></div>
          ${alerts.length ? `<ul class="list">${alerts.slice(0, 10).map((a) => `
            <li>
              ${avatar(a.c)}
              <div class="grow"><a class="title" href="#/clientes/${a.c.id}" style="color:inherit;text-decoration:none">${esc(a.c.name)}</a><div class="meta">${esc(a.text)}</div></div>
              <button class="btn sm" data-action="${a.action}" data-client="${a.c.id}">${esc(a.label)}</button>
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
      if (state.clientFilter !== 'todos' && clientStatus(c) !== state.clientFilter) return false;
      if (!q) return true;
      return [c.name, c.email, c.phone].some((f) => (f || '').toLowerCase().includes(q));
    });
  }

  function clientsTable() {
    const list = filteredClients();
    if (!list.length) {
      return Store.data.clients.length
        ? empty('search', 'Ningún cliente coincide con la búsqueda.')
        : empty('users', 'Todavía no tienes clientes.', `<div style="margin-top:12px"><button class="btn primary" data-action="new-client">${U.icon('plus')}Añadir cliente</button></div>`);
    }
    const monthLabel = monthName(today()).replace(/^./, (m) => m.toUpperCase());
    return `<div class="table-wrap"><table>
      <thead><tr><th>Cliente</th><th class="hide-sm">Email</th><th class="hide-sm">Teléfono</th><th class="num">Cuota</th><th>${esc(monthLabel)}</th><th class="hide-sm">Última medición</th></tr></thead>
      <tbody>${list.map((c) => {
        const fs = Store.feeStatus(c);
        const last = Store.lastMeasurement(c.id);
        return `<tr class="clickable" data-href="#/clientes/${c.id}" tabindex="0">
          <td><div class="name-cell">${avatar(c)}<div><div style="font-weight:600">${esc(c.name)}</div>${clientStatus(c) !== 'activo' ? statusBadge(c) : ''}</div></div></td>
          <td class="hide-sm">${c.email ? esc(c.email) : '—'}</td>
          <td class="hide-sm">${c.phone ? esc(c.phone) : '—'}</td>
          <td class="num">${c.rate ? money(c.rate) : '<span class="muted">—</span>'}</td>
          <td>${feeBadge(fs)}</td>
          <td class="hide-sm">${last ? esc(fmtDate(last.date)) : '<span class="muted">—</span>'}</td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }

  function renderClients() {
    const counts = { activo: 0, pausa: 0, inactivo: 0 };
    Store.data.clients.forEach((c) => counts[clientStatus(c)]++);
    const seg = (v, label) => `<button data-action="client-filter" data-value="${v}" class="${state.clientFilter === v ? 'active' : ''}">${label}</button>`;
    return `
      <div class="page-header">
        <div><h1 class="display">Clientes</h1><p>${plural(Store.data.clients.length, 'cliente', 'clientes')} en total</p></div>
      </div>
      <div class="card">
        <div class="toolbar">
          <input type="search" class="search" id="client-search" placeholder="Buscar por nombre, email o teléfono…" value="${esc(state.clientSearch)}" aria-label="Buscar clientes">
          <div class="segmented" role="group" aria-label="Filtrar por estado">
            ${seg('activo', `Activos (${counts.activo})`)}${seg('pausa', `En pausa (${counts.pausa})`)}${seg('inactivo', `Bajas (${counts.inactivo})`)}${seg('todos', 'Todos')}
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
    const tabs = [['resumen', 'Resumen'], ['progreso', 'Progreso'], ['pagos', 'Pagos']];
    if (!tabs.some(([k]) => k === state.clientTab)) state.clientTab = 'resumen';
    const ageVal = U.age(c.birthDate);
    const sub = [ageVal !== null ? `${ageVal} años` : null, c.startDate ? `Cliente desde ${fmtDate(c.startDate)}` : null].filter(Boolean).join(' · ');
    let body;
    switch (state.clientTab) {
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
            <h1>${esc(c.name)} ${clientStatus(c) !== 'activo' ? statusBadge(c) : ''}</h1>
            ${sub ? `<p>${esc(sub)}</p>` : ''}
          </div>
          <div class="actions">
            ${c.phone ? `<a class="btn" href="https://wa.me/${esc(c.phone.replace(/[^\d]/g, ''))}" target="_blank" rel="noopener">${U.icon('message')}WhatsApp</a>` : ''}
            ${c.email ? `<a class="btn" href="mailto:${esc(c.email)}">${U.icon('mail')}Email</a>` : ''}
            <button class="btn" data-action="edit-client" data-id="${c.id}">${U.icon('edit')}Editar</button>
            <button class="btn primary" data-action="new-measurement" data-client="${c.id}">${U.icon('plus')}Medición</button>
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
    const t = today();
    const fs = Store.feeStatus(c);
    const pend = Store.pendingAmount(c.id);
    const totalPaid = Store.paymentsFor(c.id).filter((p) => p.status === 'pagado').reduce((s, p) => s + Number(p.amount || 0), 0);
    const all = Store.measurementsFor(c.id);
    const lastAny = all[all.length - 1];
    const ms = all.filter((m) => m.weight !== '' && m.weight !== undefined);
    const weightDelta = ms.length >= 2 ? Number(ms[ms.length - 1].weight) - Number(ms[0].weight) : null;
    const lastM = ms[ms.length - 1];
    const imc = lastM && c.height ? Number(lastM.weight) / Math.pow(Number(c.height) / 100, 2) : null;
    const months = c.startDate ? Math.max(0, Math.floor(U.daysBetween(c.startDate, t) / 30.44)) : null;
    const row = (k, v) => (v ? `<dt>${k}</dt><dd>${v}</dd>` : '');

    return `
      <div class="stats">
        <div class="card stat"><div class="stat-label">Cuota mensual</div><div class="stat-value">${c.rate ? money(c.rate) : '—'}</div><div class="stat-sub">${c.billingDay ? `Cobro el día ${esc(c.billingDay)}` : 'Sin día de cobro'}</div></div>
        <div class="card stat"><div class="stat-label">Cuota de ${monthName(t)}</div><div class="stat-value" style="font-size:1.8rem">${fs ? esc(FEE_STATUS[fs.status].label) : '—'}</div><div class="stat-sub">${pend ? `${money(pend)} por cobrar` : 'Nada pendiente'}</div></div>
        <div class="card stat"><div class="stat-label">Última medición</div><div class="stat-value" style="font-size:1.8rem">${lastAny ? esc(U.fmtDateShort(lastAny.date)) : '—'}</div><div class="stat-sub">${lastAny ? `hace ${plural(U.daysBetween(lastAny.date, t), 'día', 'días')}` : 'Sin mediciones'}</div></div>
        <div class="card stat"><div class="stat-label">Cliente desde</div><div class="stat-value" style="font-size:1.8rem">${c.startDate ? esc(U.fmtDateShort(c.startDate)) : '—'}</div><div class="stat-sub">${months !== null ? `${plural(months, 'mes', 'meses')} · ` : ''}${money(totalPaid)} cobrado</div></div>
      </div>
      <div class="grid-2">
        <section class="card">
          <div class="card-header"><h2>Datos</h2></div>
          <dl class="dl">
            ${row('Estado', statusBadge(c))}
            ${row('Email', c.email ? esc(c.email) : '')}
            ${row('Teléfono', c.phone ? esc(c.phone) : '')}
            ${row('Nacimiento', c.birthDate ? fmtDate(c.birthDate) : '')}
            ${row('Sexo', esc(c.gender || ''))}
            ${row('Altura', c.height ? fmtNum(c.height) + ' cm' : '')}
            ${row('Alta', c.startDate ? fmtDate(c.startDate) : '')}
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
        <td>${esc(p.concept || '—')}</td>
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
    const fs = Store.feeStatus(c);
    return `<section class="card">
      <div class="card-header"><h2>Pagos (${list.length})</h2>
        <div class="actions">
          ${fs && fs.status !== 'pagado' ? `<button class="btn sm" data-action="pay-fee" data-client="${c.id}">Cobrar cuota de ${monthName(today())}</button>` : ''}
          <button class="btn primary sm" data-action="new-payment" data-client="${c.id}">${U.icon('plus')}Pago</button>
        </div>
      </div>
      ${paymentsTable(list, { showClient: false })}
    </section>`;
  }

  /* =========================================================
   * Pagos
   * ======================================================= */

  function renderPayments() {
    const t = today();
    const all = Store.data.payments.slice().sort((a, b) => b.date.localeCompare(a.date));
    const list = state.payFilter === 'todos' ? all : all.filter((p) => p.status === state.payFilter);
    const { from, to } = Store.monthRange(t);
    const month = Store.paidBetween(from, to);
    const prevStart = U.parseDate(from);
    prevStart.setMonth(prevStart.getMonth() - 1);
    const prev = Store.monthRange(U.toISODate(prevStart));
    const prevMonth = Store.paidBetween(prev.from, prev.to);
    const year = Store.paidBetween(t.slice(0, 4) + '-01-01', t.slice(0, 4) + '-12-31');
    const rec = Store.receivables();
    const seg = (v, l) => `<button data-action="pay-filter" data-value="${v}" class="${state.payFilter === v ? 'active' : ''}">${l}</button>`;
    return `
      <div class="page-header">
        <div><h1 class="display">Pagos</h1><p>Cuotas cobradas y pendientes</p></div>
        <button class="btn primary pill" data-action="new-payment">${U.icon('plus')}Registrar pago</button>
      </div>
      <div class="stats">
        <div class="card stat"><div class="stat-label">Cobrado en ${monthName(t)}</div><div class="stat-value">${money(month)}</div><div class="stat-sub">${monthName(prev.from)}: ${money(prevMonth)}</div></div>
        <div class="card stat"><div class="stat-label">Por cobrar</div><div class="stat-value">${money(rec.reduce((s, r) => s + r.amount, 0))}</div><div class="stat-sub">${plural(rec.filter((r) => r.overdue).length, 'vencido', 'vencidos')}</div></div>
        <div class="card stat"><div class="stat-label">Cobrado en ${t.slice(0, 4)}</div><div class="stat-value">${money(year)}</div><div class="stat-sub">desde enero</div></div>
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
            <div class="field full"><label for="s-trainerName">Tu nombre</label><input id="s-trainerName" name="trainerName" value="${esc(s.trainerName)}" placeholder="Para el saludo del resumen"></div>
            <div class="field"><label for="s-currency">Moneda</label><select id="s-currency" name="currency">${CURRENCIES.map((c) => `<option value="${c.value}" ${s.currency === c.value ? 'selected' : ''}>${c.label}</option>`).join('')}</select></div>
            <div class="field"><label for="s-theme">Tema</label><select id="s-theme" name="theme">
              ${[['dark', 'Oscuro'], ['light', 'Claro'], ['auto', 'Automático']].map(([v, l]) => `<option value="${v}" ${s.theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <div class="field full"><label for="s-defaultRate">Cuota mensual por defecto</label><input id="s-defaultRate" name="defaultRate" type="number" step="0.01" min="0" value="${esc(s.defaultRate)}"></div>
            <div class="full"><button type="submit" class="btn primary">Guardar preferencias</button></div>
          </form>
        </section>
        <section class="card">
          <div class="card-header"><h2>Tus datos</h2></div>
          <p class="muted" style="margin-top:0">Los datos se guardan <strong>solo en este navegador</strong>. Exporta una copia de seguridad con regularidad para no perderlos y para pasarlos a otro dispositivo.</p>
          ${Store.storageOk ? '' : `<div class="alert">${U.icon('alert')}<div>El navegador no permite guardar datos (¿modo privado?). Los cambios se perderán al cerrar.</div></div>`}
          <p>${plural(d.clients.length, 'cliente', 'clientes')} · ${plural(d.measurements.length, 'medición', 'mediciones')} · ${plural(d.payments.length, 'pago', 'pagos')}</p>
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
    const cols = [['name', 'Nombre'], ['email', 'Email'], ['phone', 'Teléfono'], ['birthDate', 'Nacimiento'], ['status', 'Estado'], ['rate', 'Cuota mensual'], ['billingDay', 'Día de cobro'], ['startDate', 'Alta'], ['health', 'Salud'], ['notes', 'Notas']];
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [cols.map((c) => q(c[1])).join(';')].concat(
      Store.clients().map((c) => cols.map(([k]) => q(k === 'status' ? CLIENT_STATUS[clientStatus(c)].label : c[k])).join(';'))
    );
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
    const tDay = Number(t.slice(8));
    const people = [
      { name: 'Laura Martínez', email: 'laura@example.com', phone: '+34 600 111 222', birthDate: '1990-04-12', gender: 'Mujer', goal: 'Pérdida de grasa', rate: 60, height: 165, health: 'Molestias en la rodilla izquierda: evitar impacto alto.', w: 72, fat: 30, months: 5, billingDay: 1, paidNow: true, lastM: 3 },
      { name: 'Carlos Ruiz', email: 'carlos@example.com', phone: '+34 600 333 444', birthDate: '1985-09-30', gender: 'Hombre', goal: 'Ganancia muscular', rate: 80, height: 180, w: 78, fat: 18, months: 4, billingDay: Math.max(1, tDay - 4), paidNow: false, lastM: 6 },
      { name: 'Ana Gómez', email: 'ana@example.com', phone: '+34 600 555 666', birthDate: '1972-01-20', gender: 'Mujer', goal: 'Salud general', rate: 50, height: 158, health: 'Hipertensión controlada con medicación.', w: 68, fat: 34, months: 3, billingDay: Math.min(28, tDay + 6), paidNow: false, lastM: 20 },
      { name: 'Javier López', email: 'javier@example.com', phone: '+34 600 777 888', birthDate: '1998-06-05', gender: 'Hombre', goal: 'Rendimiento deportivo', rate: 60, height: 176, w: 74, fat: 15, months: 2, billingDay: 1, paidNow: true, lastM: 2 },
      { name: 'Marta Sánchez', email: 'marta@example.com', phone: '+34 600 999 000', birthDate: '1988-11-15', gender: 'Mujer', goal: 'Fuerza', rate: 60, height: 170, w: 63, fat: 24, months: 4, billingDay: 10, status: 'pausa', lastM: 40 },
    ];
    const now = U.parseDate(t);
    people.forEach((p) => {
      const start = U.toISODate(new Date(now.getFullYear(), now.getMonth() - p.months, Math.min(28, p.billingDay)));
      const c = Store.add('clients', {
        name: p.name, email: p.email, phone: p.phone, birthDate: p.birthDate, gender: p.gender,
        rate: p.rate, billingDay: p.billingDay, height: p.height, health: p.health || '', notes: '', startDate: start, status: p.status || 'activo',
      });
      // Cuotas cobradas de los meses anteriores (y la de este mes si procede)
      for (let i = p.months; i >= 0; i--) {
        if (i === 0 && !p.paidNow) continue;
        if (p.status === 'pausa' && i < 2) continue;
        const d = new Date(now.getFullYear(), now.getMonth() - i, Math.min(28, p.billingDay));
        const date = U.toISODate(d) > t ? t : U.toISODate(d);
        Store.add('payments', { clientId: c.id, date, amount: p.rate, concept: `Cuota de ${MONTHS[d.getMonth()]}`, method: i % 2 ? 'Bizum' : 'Transferencia', status: 'pagado' });
      }
      // Revisiones cada 2 semanas
      const total = Math.max(2, Math.floor((p.months * 30 - p.lastM) / 14) + 1);
      for (let i = 0; i < total; i++) {
        const trend = p.goal === 'Ganancia muscular' ? 0.4 : -0.6;
        Store.add('measurements', {
          clientId: c.id, date: U.addDays(t, -p.lastM - (total - 1 - i) * 14),
          weight: Math.round((p.w + trend * i + (i % 2 ? 0.2 : 0)) * 10) / 10,
          bodyFat: Math.round((p.fat - 0.5 * i) * 10) / 10,
          waist: Math.round((p.w + 8 - 0.8 * i) * 10) / 10,
          hip: '', chest: '', arm: '', thigh: '', notes: '',
        });
      }
    });
    UI.toast('Datos de ejemplo cargados');
    App.render();
  }

  async function resetData() {
    const ok = await UI.confirm({ title: 'Borrar todos los datos', message: 'Se eliminarán <strong>todos</strong> los clientes, mediciones y pagos. Te recomendamos exportar una copia antes. ¿Continuar?', confirmLabel: 'Borrar todo' });
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
    'new-measurement': (d) => openMeasurementForm(null, d.client),
    'edit-measurement': (d) => openMeasurementForm(d.id),
    'new-payment': (d) => openPaymentForm(null, d.client ? { clientId: d.client } : {}),
    'edit-payment': (d) => openPaymentForm(d.id),
    'pay-fee': (d) => payFee(d.client),
    'mark-paid': (d) => {
      Store.update('payments', d.id, { status: 'pagado', paidAt: today() });
      UI.toast('Pago marcado como cobrado');
      App.render();
    },
    'client-tab': (d) => { state.clientTab = d.value; App.render(); },
    'client-filter': (d) => { state.clientFilter = d.value; App.render(); },
    metric: (d) => { state.metric = d.value; App.render(); },
    'pay-filter': (d) => { state.payFilter = d.value; App.render(); },
    export: () => { download(`david-orihuela-coach-copia-${today()}.json`, Store.exportJSON(), 'application/json'); UI.toast('Copia exportada'); },
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
    state, actions, renderPanel, renderClients, renderClient, renderPayments, renderSettings,
    saveSettings, importFile, onClientSearch, computeAlerts,
  };
})();
