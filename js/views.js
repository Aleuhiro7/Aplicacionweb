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
  const DUE_STATUS = {
    vencido: { label: 'Vencido', badge: 'danger' },
    hoy: { label: 'Hoy', badge: 'warning' },
    pronto: { label: 'Pronto', badge: 'warning' },
    'al-dia': { label: 'Al día', badge: 'success' },
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
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const monthName = (iso) => MONTHS[U.parseDate(iso).getMonth()];

  /* Estado de la interfaz (no se guarda). */
  const state = {
    clientSearch: '',
    clientFilter: 'activo',
    clientTab: 'resumen',
    payFilter: 'todos',
    libSearch: '',
    foodSearch: '',
    foodCat: 'todos',
    foodView: 'alimentos', // 'alimentos' | 'bloques'
    pick: null, // { client, day } cuando se elige un ejercicio para una rutina
    libGroup: 'todos',
    openPay: null, // cliente con el desplegable de pago abierto
  };

  const badge = (text, kind) => `<span class="badge ${kind || ''}">${esc(text)}</span>`;
  const clientStatus = (c) => (CLIENT_STATUS[c.status] ? c.status : 'activo');
  const statusBadge = (c) => badge(CLIENT_STATUS[clientStatus(c)].label, CLIENT_STATUS[clientStatus(c)].badge);
  const dueBadge = (di) => (di ? badge(DUE_STATUS[di.status].label, DUE_STATUS[di.status].badge) : badge('Sin fecha'));
  /** Texto del próximo pago: «Le toca pagar en 3 días», «Vencido hace 2 días»… */
  function dueText(di) {
    if (!di) return 'Sin fecha de próximo pago';
    const date = U.fmtDateShort(di.date);
    if (di.status === 'vencido') return `Vencido hace ${plural(-di.days, 'día', 'días')} (${date})`;
    if (di.status === 'hoy') return 'Le toca pagar hoy';
    if (di.status === 'pronto') return `Le toca pagar ${di.days === 1 ? 'mañana' : `en ${di.days} días`} (${date})`;
    return `Próximo pago: ${date}`;
  }
  const payBadge = (p) => (p.status === 'pagado' ? badge('Pagado', 'success') : badge('Pendiente', 'warning'));
  const empty = (icon, text, extra = '') => `<div class="empty"><span class="empty-icon">${U.icon(icon)}</span><div>${text}</div>${extra}</div>`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /** Saludo según la hora local del dispositivo: días 6–14 h, tardes 14–21 h, noches 21–6 h. */
  function greeting(date = new Date()) {
    const h = date.getHours();
    if (h >= 6 && h < 14) return 'Buenos días';
    if (h >= 14 && h < 21) return 'Buenas tardes';
    return 'Buenas noches';
  }

  function greetingText() {
    const name = Store.settings.trainerName || 'David Orihuela';
    return `${greeting()}, ${name.split(' ')[0]}.`;
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
      { name: 'startDate', label: 'Fecha de alta', type: 'date', default: today(), hint: 'A los 15 días toca el seguimiento y al mes la revisión mensual, cada mes.' },
      { name: 'status', label: 'Estado', type: 'select', options: Object.entries(CLIENT_STATUS).map(([value, s]) => ({ value, label: s.label })), default: 'activo' },
      { name: 'rate', label: `Importe habitual (${Store.settings.currency})`, type: 'number', step: '0.01', min: 0, default: Store.settings.defaultRate, hint: 'Se propone al registrar un pago.' },
      { name: 'nextDue', label: 'Próximo pago', type: 'date', hint: `Cae el mismo día del mes que la fecha de alta (se ajusta solo). Vacío: el próximo aniversario del alta. Te avisaré ${Store.REMIND_DAYS} días antes.` },
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
        // El próximo pago se alinea con el día del alta.
        if (v.startDate) v.nextDue = v.nextDue ? Store.snapToStart(v.startDate, v.nextDue) : Store.startOnOrAfter(v.startDate, today());
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
      message: `Se eliminará a <strong>${esc(c.name)}</strong> junto con todo su historial de peso y pagos. Esta acción no se puede deshacer.<br><br>Si solo ha dejado la asesoría, puedes marcarlo como <em>Baja</em> o <em>En pausa</em>.`,
    });
    if (!ok) return;
    await Photos.removeForClient(id);
    Store.remove('clients', id);
    UI.toast('Cliente eliminado');
    location.hash = '#/clientes';
    App.render();
  }

  function measurementFields() {
    return [
      { name: 'date', label: 'Fecha', type: 'date', required: true, default: today(), full: true },
      { name: 'weight', label: 'Peso (kg)', type: 'number', step: '0.1', min: 0, required: true, full: true },
      { name: 'notes', label: 'Notas de la revisión', type: 'textarea', placeholder: 'Sensaciones, adherencia, cambios en el plan…' },
    ];
  }

  function openMeasurementForm(id, clientId) {
    const existing = id ? Store.get('measurements', id) : null;
    UI.form({
      title: existing ? 'Editar peso' : 'Registrar peso',
      fields: measurementFields(),
      values: existing || {},
      onDelete: existing ? () => deleteRecord('measurements', id, 'este registro de peso') : null,
      onSubmit: (v) => {
        if (existing) Store.update('measurements', id, v);
        else Store.add('measurements', Object.assign({ clientId }, v));
        UI.toast('Peso guardado');
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

  /** Método de pago usado en el último pago del cliente (para no tener que elegirlo cada vez). */
  function lastMethod(clientId) {
    const last = Store.paymentsFor(clientId).find((p) => p.method);
    return last ? last.method : '';
  }

  /** Fecha base para proponer el siguiente pago: la fecha que tocaba (si es reciente) o hoy. */
  function payBase(c) {
    return c.nextDue && c.nextDue >= U.addDays(today(), -31) ? c.nextDue : today();
  }

  /** Desplegable para registrar un pago: cantidad y cuántos meses paga (el próximo pago cae el día del alta). */
  function payForm(c) {
    const amount = Number(c.rate) || Store.lastPaidAmount(c.id) || Store.settings.defaultRate || '';
    const base = payBase(c);
    const options = [1, 2, 3, 6].map((n) => ({ n, date: Store.nextDueAfter(c, base, n) }));
    const first = options[0];
    const quick = options.map((o) => `<button type="button" class="chip${o === first ? ' active' : ''}" data-action="pay-months" data-date="${o.date}" aria-pressed="${o === first}">${o.n === 1 ? '1 mes' : `${o.n} meses`}</button>`).join('');
    return `<form class="pay-form" data-client="${c.id}">
      <div class="pay-fields">
        <div class="field"><label for="pa-${c.id}">Cantidad (${esc(Store.settings.currency)})</label><input id="pa-${c.id}" name="amount" type="number" step="0.01" min="0" inputmode="decimal" required value="${esc(amount)}"></div>
        <div class="field"><span class="field-label">Próximo pago</span><div class="pay-next" aria-live="polite">${esc(fmtDate(first.date))}</div><input type="hidden" name="nextDue" value="${first.date}"></div>
      </div>
      <div class="pay-quick"><span class="muted">Paga:</span>${quick}</div>
      <p class="hint">${c.startDate ? `Los pagos caen el día ${Number(c.startDate.slice(8))} de cada mes (fecha de alta: ${esc(fmtDate(c.startDate))}). ` : ''}Te avisaré ${Store.REMIND_DAYS} días antes.</p>
      <div class="pay-actions">
        <button type="button" class="btn sm" data-action="pay-close">Cancelar</button>
        <button type="submit" class="btn primary sm">${U.icon('check')}Guardar pago</button>
      </div>
    </form>`;
  }

  /** Fila de un cliente con su próximo pago y el botón «Pago» que abre el desplegable. */
  function payRow(c) {
    const di = Store.dueInfo(c);
    const open = state.openPay === c.id;
    return `<li class="pay-item${open ? ' open' : ''}" data-pay-row="${c.id}">
      <div class="pay-line">
        ${avatar(c)}
        <div class="grow"><a class="title" href="#/clientes/${c.id}" style="color:inherit;text-decoration:none">${esc(c.name)}</a><div class="meta">${esc(dueText(di))}</div></div>
        <div class="pay-row">
          ${di && di.status !== 'al-dia' ? dueBadge(di) : ''}
          <button class="btn ${open ? '' : 'primary '}sm pay" data-action="pay-open" data-client="${c.id}" aria-expanded="${open}">${U.icon('wallet')}Pago${U.icon(open ? 'up' : 'down', 'chev')}</button>
        </div>
      </div>
      ${open ? payForm(c) : ''}
    </li>`;
  }

  /** Clientes activos ordenados por fecha de próximo pago (los que no tienen fecha, al final). */
  function clientsByDue() {
    return Store.clients()
      .filter((c) => clientStatus(c) === 'activo')
      .sort((a, b) => (a.nextDue || '9999').localeCompare(b.nextDue || '9999') || a.name.localeCompare(b.name, 'es'));
  }

  function submitPayForm(form) {
    const c = Store.get('clients', form.dataset.client);
    if (!c) return;
    const amountEl = form.elements.amount;
    const dateEl = form.elements.nextDue;
    const amount = Number(amountEl.value);
    if (amountEl.value === '' || !(amount >= 0)) { amountEl.focus(); UI.toast('Indica la cantidad'); return; }
    if (!dateEl.value) { dateEl.focus(); UI.toast('Indica la fecha del próximo pago'); return; }
    const prev = { nextDue: c.nextDue || '', rate: c.rate };
    const pay = Store.add('payments', {
      clientId: c.id, date: today(), amount, concept: 'Pago', method: lastMethod(c.id),
      status: 'pagado', nextDue: dateEl.value, notes: '',
    });
    Store.update('clients', c.id, { nextDue: dateEl.value, rate: amount });
    state.openPay = null;
    App.render();
    UI.toast(`Pago de ${c.name.split(' ')[0]} guardado · próximo el ${U.fmtDateShort(dateEl.value)}`, {
      label: 'Deshacer',
      onClick: () => { Store.remove('payments', pay.id); Store.update('clients', c.id, prev); App.render(); },
    });
  }

  /** Marca como pagado un pago que estaba registrado como pendiente. */
  function markPaid(id) {
    const p = Store.get('payments', id);
    if (!p) return;
    const prev = { status: p.status, date: p.date };
    Store.update('payments', id, { status: 'pagado', date: today() });
    App.render();
    UI.toast(`${Store.clientName(p.clientId).split(' ')[0]} marcado como pagado`, {
      label: 'Deshacer',
      onClick: () => { Store.update('payments', id, prev); App.render(); },
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
   * Resumen
   * ======================================================= */

  /* =========================================================
   * Revisiones (cada 15 días)
   * ======================================================= */

  const REVIEW_STATUS = {
    atrasada: { label: 'Atrasada', badge: 'danger' },
    hoy: { label: 'Hoy', badge: 'warning' },
    pronto: { label: 'Pronto', badge: 'warning' },
    'al-dia': { label: 'Programada', badge: 'info' },
  };
  const reviewBadge = (ri) => badge(ri.type === 'mensual' ? 'Revisión mensual' : 'Seguimiento', REVIEW_STATUS[ri.status].badge);

  function reviewText(ri) {
    if (!ri) return '';
    const date = U.fmtDateShort(ri.date);
    if (ri.status === 'atrasada') return `${ri.label} pendiente desde hace ${plural(-ri.days, 'día', 'días')} (${date})`;
    if (ri.status === 'hoy') return `${ri.label} hoy`;
    if (ri.status === 'pronto') return `${ri.label} ${ri.days === 1 ? 'mañana' : `en ${ri.days} días`} (${date})`;
    return `${ri.label} el ${date}`;
  }

  /** Fila de aviso de revisión: el nombre abre WhatsApp y la casilla marca la revisión como hecha. */
  function reviewItem(c, ri) {
    const wa = U.waLink(c.phone);
    const name = wa
      ? `<a class="title wa-link" href="${wa}" target="_blank" rel="noopener" title="Abrir WhatsApp con ${esc(c.name)}">${U.icon('message')}${esc(c.name)}</a>`
      : `<a class="title" href="#/clientes/${c.id}" style="color:inherit;text-decoration:none">${esc(c.name)}</a>`;
    return `<li class="task review">
      <button class="task-check" data-action="complete-review" data-client="${c.id}" role="checkbox" aria-checked="false" aria-label="Marcar ${esc(ri.label.toLowerCase())} de ${esc(c.name)} como hecho" title="Marcar como hecho"></button>
      ${avatar(c)}
      <div class="grow">
        ${name}
        <div class="meta"><span>${esc(reviewText(ri))}</span>${wa ? '' : `<a href="#/clientes/${c.id}" data-action="edit-client" data-id="${c.id}">Añade su teléfono para abrir WhatsApp</a>`}</div>
      </div>
      <div class="review-actions">
        ${reviewBadge(ri)}
        ${wa ? `<a class="btn sm wa-btn" href="${wa}" target="_blank" rel="noopener" aria-label="Abrir WhatsApp con ${esc(c.name)}">${U.icon('message')}WhatsApp</a>` : ''}
        <a class="btn sm" href="#/clientes/${c.id}" aria-label="Ver perfil de ${esc(c.name)}">${U.icon('users')}Perfil</a>
      </div>
    </li>`;
  }

  function completeReview(clientId) {
    const c = Store.get('clients', clientId);
    const ri = c && Store.reviewInfo(c);
    if (!ri || ri.status === 'al-dia') return;
    const rec = Store.add('reviews', { clientId, type: ri.type, due: ri.date, date: today() });
    App.render();
    const next = Store.reviewInfo(c);
    UI.toast(`${ri.label} de ${c.name.split(' ')[0]} hecho${next ? ` · siguiente: ${next.label.toLowerCase()} el ${U.fmtDateShort(next.date)}` : ''}`, {
      label: 'Deshacer',
      onClick: () => { Store.remove('reviews', rec.id); App.render(); },
    });
  }

  /* =========================================================
   * Tareas pendientes
   * ======================================================= */

  function taskDue(task) {
    if (!task.dueDate || task.done) return '';
    const days = U.daysBetween(today(), task.dueDate);
    if (days < 0) return badge(`Vencida · ${U.fmtDateShort(task.dueDate)}`, 'danger');
    if (days === 0) return badge('Para hoy', 'warning');
    if (days === 1) return badge('Para mañana', 'warning');
    return badge(`Para el ${U.fmtDateShort(task.dueDate)}`, 'info');
  }

  /** Una tarea con su casilla para marcarla como hecha. */
  function taskItem(task, { showClient = false } = {}) {
    const c = Store.get('clients', task.clientId);
    const meta = [
      showClient && c ? `<a href="#/clientes/${c.id}" data-action="open-client-tab" data-client="${c.id}" data-value="tareas">${esc(c.name)}</a>` : '',
      `<span>${task.done ? `Hecha el ${esc(U.fmtDateShort((task.doneAt || '').slice(0, 10) || today()))}` : `Apuntada el ${esc(U.fmtDateShort((task.createdAt || '').slice(0, 10) || today()))}`}</span>`,
    ].filter(Boolean).join('');
    return `<li class="task${task.done ? ' done' : ''}">
      <button class="task-check" data-action="toggle-task" data-id="${task.id}" role="checkbox" aria-checked="${!!task.done}" aria-label="${task.done ? 'Marcar como pendiente' : 'Marcar como hecha'}">${task.done ? U.icon('check') : ''}</button>
      <div class="grow">
        <div class="task-text">${esc(task.text)}</div>
        <div class="meta">${meta} ${taskDue(task)}</div>
      </div>
      <button class="icon-btn" data-action="edit-task" data-id="${task.id}" aria-label="Editar tarea">${U.icon('edit')}</button>
    </li>`;
  }

  function clientTasks(c) {
    const list = Store.tasksFor(c.id);
    const pending = list.filter((t) => !t.done);
    const done = list.filter((t) => t.done);
    return `<section class="card">
      <div class="card-header"><h2>Tareas pendientes ${pending.length ? `<span class="count">${pending.length}</span>` : ''}</h2></div>
      <form class="task-form" data-client="${c.id}">
        <textarea name="text" rows="2" placeholder="Escribe una tarea o anotación para ${esc(c.name.split(' ')[0])}…" aria-label="Nueva tarea" required></textarea>
        <div class="task-form-row">
          <label class="task-date"><span>Para el (opcional)</span><input type="date" name="dueDate"></label>
          <button type="submit" class="btn primary">${U.icon('plus')}Añadir tarea</button>
        </div>
      </form>
      ${pending.length ? `<ul class="list task-list">${pending.map((t) => taskItem(t)).join('')}</ul>` : empty('done', 'No hay tareas pendientes. Las que apuntes aquí aparecerán también en el resumen.')}
    </section>
    ${done.length ? `<section class="card">
      <details class="done-tasks"${state.showDone ? ' open' : ''}>
        <summary data-action="toggle-done-list"><h2>Hechas (${done.length})</h2></summary>
        <ul class="list task-list">${done.map((t) => taskItem(t)).join('')}</ul>
      </details>
    </section>` : ''}`;
  }

  function submitTaskForm(form) {
    const text = form.elements.text.value.trim();
    if (!text) { form.elements.text.focus(); return; }
    Store.add('tasks', { clientId: form.dataset.client, text, dueDate: form.elements.dueDate.value || '', done: false });
    UI.toast('Tarea apuntada');
    App.render();
    document.querySelector('.task-form textarea')?.focus();
  }

  function toggleTask(id) {
    const task = Store.get('tasks', id);
    if (!task) return;
    const done = !task.done;
    Store.update('tasks', id, { done, doneAt: done ? new Date().toISOString() : '' });
    App.render();
    if (done) {
      UI.toast('Tarea hecha', { label: 'Deshacer', onClick: () => { Store.update('tasks', id, { done: false, doneAt: '' }); App.render(); } });
    }
  }

  function editTask(id) {
    const task = Store.get('tasks', id);
    if (!task) return;
    UI.form({
      title: 'Editar tarea',
      fields: [
        { name: 'text', label: 'Tarea', type: 'textarea', required: true },
        { name: 'dueDate', label: 'Para el (opcional)', type: 'date' },
      ],
      values: task,
      onDelete: async () => {
        const ok = await UI.confirm({ title: 'Eliminar tarea', message: '¿Seguro que quieres eliminar esta tarea?' });
        if (!ok) return;
        Store.remove('tasks', id);
        UI.toast('Tarea eliminada');
        App.render();
      },
      onSubmit: (v) => { Store.update('tasks', id, v); UI.toast('Tarea actualizada'); App.render(); },
    });
  }

  /* =========================================================
   * Rutina
   * ======================================================= */

  /** «4 × 10 · 60 kg · 90 s de descanso» */
  function exerciseMeta(ex) {
    const parts = [];
    if (ex.sets || ex.reps) parts.push([ex.sets, ex.reps].filter(Boolean).join(' × '));
    if (ex.load) parts.push(ex.load);
    if (ex.rest) parts.push(`${ex.rest} de descanso`);
    return parts.join(' · ');
  }

  function clientRoutine(c) {
    const r = Store.routineFor(c.id);
    if (!r) {
      return `<section class="card">${empty('logo', `<strong>${esc(c.name.split(' ')[0])} aún no tiene rutina.</strong><br>Crea su rutina por días y añade los ejercicios con series, repeticiones, carga y descanso.`,
        `<div style="margin-top:14px"><button class="btn primary" data-action="routine-create" data-client="${c.id}">${U.icon('plus')}Crear rutina</button></div>`)}</section>`;
    }
    const days = r.days || [];
    return `
      <section class="card routine-head">
        <div class="card-header">
          <div>
            <h2>${esc(r.name || 'Rutina')}</h2>
            <div class="muted" style="font-size:.85rem">Actualizada el ${esc(fmtDate((r.updatedAt || r.createdAt || '').slice(0, 10) || today()))} · ${plural(days.length, 'día', 'días')} · ${plural(days.reduce((n, d) => n + (d.exercises || []).length, 0), 'ejercicio', 'ejercicios')}</div>
          </div>
          <div class="actions">
            <a class="btn sm wa-btn" href="${routineWaLink(c, r)}" target="_blank" rel="noopener">${U.icon('message')}Enviar por WhatsApp</a>
            <button class="btn sm" data-action="routine-copy" data-client="${c.id}">${U.icon('file')}Copiar</button>
            <button class="btn sm" data-action="routine-edit" data-client="${c.id}">${U.icon('edit')}Editar</button>
          </div>
        </div>
        ${r.notes ? `<p class="routine-notes">${esc(r.notes)}</p>` : ''}
      </section>
      ${days.map((d, di) => `
        <section class="card routine-day">
          <div class="card-header">
            <h2><span class="day-num">${di + 1}</span>${esc(d.name || `Día ${di + 1}`)}</h2>
            <div class="actions">
              ${di > 0 ? `<button class="icon-btn" data-action="day-move" data-client="${c.id}" data-day="${d.id}" data-dir="-1" aria-label="Subir día" title="Subir">${U.icon('up')}</button>` : ''}
              ${di < days.length - 1 ? `<button class="icon-btn" data-action="day-move" data-client="${c.id}" data-day="${d.id}" data-dir="1" aria-label="Bajar día" title="Bajar">${U.icon('down')}</button>` : ''}
              <button class="icon-btn" data-action="day-edit" data-client="${c.id}" data-day="${d.id}" aria-label="Editar día" title="Editar día">${U.icon('edit')}</button>
            </div>
          </div>
          ${(d.exercises || []).length ? `<ol class="list exercise-list">${d.exercises.map((ex, ei) => `
            <li>
              <span class="ex-num">${ei + 1}</span>
              <div class="grow">
                <div class="title">${esc(ex.name)}</div>
                ${exerciseMeta(ex) ? `<div class="ex-meta">${esc(exerciseMeta(ex))}</div>` : ''}
                ${ex.notes ? `<div class="meta ex-notes">${esc(ex.notes)}</div>` : ''}
              </div>
              <div class="ex-actions">
                ${ei > 0 ? `<button class="icon-btn" data-action="ex-move" data-client="${c.id}" data-day="${d.id}" data-ex="${ex.id}" data-dir="-1" aria-label="Subir ejercicio">${U.icon('up')}</button>` : ''}
                ${ei < d.exercises.length - 1 ? `<button class="icon-btn" data-action="ex-move" data-client="${c.id}" data-day="${d.id}" data-ex="${ex.id}" data-dir="1" aria-label="Bajar ejercicio">${U.icon('down')}</button>` : ''}
                <button class="icon-btn" data-action="ex-edit" data-client="${c.id}" data-day="${d.id}" data-ex="${ex.id}" aria-label="Editar ejercicio">${U.icon('edit')}</button>
              </div>
            </li>`).join('')}</ol>` : '<p class="muted" style="margin:0 0 12px">Sin ejercicios todavía.</p>'}
          <button class="btn sm" data-action="ex-add" data-client="${c.id}" data-day="${d.id}">${U.icon('plus')}Añadir ejercicio</button>
        </section>`).join('')}
      <button class="btn primary add-day" data-action="day-add" data-client="${c.id}">${U.icon('plus')}Añadir día</button>`;
  }

  function routineText(c, r) {
    const lines = [`*${r.name || 'Rutina'} — ${c.name}*`];
    if (r.notes) lines.push('', r.notes);
    (r.days || []).forEach((d, di) => {
      lines.push('', `*${d.name || `Día ${di + 1}`}*`);
      (d.exercises || []).forEach((ex, ei) => {
        const meta = exerciseMeta(ex);
        lines.push(`${ei + 1}. ${ex.name}${meta ? ` — ${meta}` : ''}`);
        if (ex.notes) lines.push(`   _${ex.notes}_`);
      });
    });
    return lines.join('\n');
  }

  function routineWaLink(c, r) {
    const base = U.waLink(c.phone) || 'https://wa.me/';
    return `${base}?text=${encodeURIComponent(routineText(c, r))}`;
  }

  /** Guarda la rutina tras modificar sus días (marca la fecha de actualización). */
  function saveRoutine(r) {
    Store.update('routines', r.id, { days: r.days, name: r.name, notes: r.notes });
    App.render();
  }

  const findDay = (r, id) => (r.days || []).find((d) => d.id === id);

  function routineForm(c, existing) {
    UI.form({
      title: existing ? 'Editar rutina' : 'Nueva rutina',
      fields: [
        { name: 'name', label: 'Nombre de la rutina', required: true, full: true, default: `Rutina de ${monthName(today())}`, placeholder: 'Ej.: Fuerza 4 días, Hipertrofia bloque 1…' },
        { name: 'notes', label: 'Indicaciones generales', type: 'textarea', placeholder: 'Calentamiento, frecuencia semanal, progresión…' },
      ],
      values: existing || {},
      submitLabel: existing ? 'Guardar' : 'Crear rutina',
      onDelete: existing ? async () => {
        const ok = await UI.confirm({ title: 'Eliminar rutina', message: `Se eliminará la rutina completa de ${esc(c.name)} con todos sus días y ejercicios.` });
        if (!ok) return;
        Store.remove('routines', existing.id);
        UI.toast('Rutina eliminada');
        App.render();
      } : null,
      onSubmit: (v) => {
        if (existing) {
          Object.assign(existing, v);
          saveRoutine(existing);
          UI.toast('Rutina actualizada');
        } else {
          Store.add('routines', { clientId: c.id, name: v.name, notes: v.notes, days: [{ id: U.uid(), name: 'Día 1', exercises: [] }] });
          UI.toast('Rutina creada: añade los ejercicios');
          App.render();
        }
      },
    });
  }

  function dayForm(c, r, day) {
    UI.form({
      title: day ? 'Editar día' : 'Nuevo día',
      fields: [{ name: 'name', label: 'Nombre del día', required: true, full: true, default: `Día ${(r.days || []).length + 1}`, placeholder: 'Ej.: Día 1 · Pierna, Lunes · Torso…' }],
      values: day || {},
      submitLabel: day ? 'Guardar' : 'Añadir día',
      onDelete: day ? async () => {
        const ok = await UI.confirm({ title: 'Eliminar día', message: `Se eliminará «${esc(day.name)}» con sus ${plural((day.exercises || []).length, 'ejercicio', 'ejercicios')}.` });
        if (!ok) return;
        r.days = r.days.filter((d) => d.id !== day.id);
        saveRoutine(r);
        UI.toast('Día eliminado');
      } : null,
      onSubmit: (v) => {
        if (day) day.name = v.name;
        else (r.days = r.days || []).push({ id: U.uid(), name: v.name, exercises: [] });
        saveRoutine(r);
      },
    });
  }

  function exerciseForm(c, r, day, ex) {
    UI.form({
      title: ex ? 'Editar ejercicio' : `Añadir ejercicio · ${day.name}`,
      fields: [
        { name: 'name', label: 'Ejercicio', required: true, full: true, placeholder: 'Ej.: Sentadilla, Press banca, Remo con mancuerna…' },
        { name: 'sets', label: 'Series', placeholder: 'Ej.: 4' },
        { name: 'reps', label: 'Repeticiones', placeholder: 'Ej.: 8-10, 12, 30 s' },
        { name: 'load', label: 'Carga', placeholder: 'Ej.: 60 kg, RPE 8, peso corporal' },
        { name: 'rest', label: 'Descanso', placeholder: 'Ej.: 90 s, 2 min' },
        { name: 'notes', label: 'Notas', type: 'textarea', placeholder: 'Técnica, tempo, variantes…' },
      ],
      values: ex || {},
      submitLabel: ex ? 'Guardar' : 'Añadir',
      onDelete: ex ? () => {
        day.exercises = day.exercises.filter((x) => x.id !== ex.id);
        saveRoutine(r);
        UI.toast('Ejercicio eliminado', { label: 'Deshacer', onClick: () => { const cur = Store.routineFor(c.id); const d = cur && findDay(cur, day.id); if (d) { d.exercises.push(ex); saveRoutine(cur); } } });
      } : null,
      // Al elegir un ejercicio de la biblioteca se rellenan series, repeticiones, descanso y notas vacías.
      onReady: (dlg) => {
        const nameEl = dlg.querySelector('#f-name');
        const fill = () => {
          const lib = Store.library().find((x) => x.name.toLowerCase() === nameEl.value.trim().toLowerCase());
          if (!lib) return;
          const notes = [lib.tempo ? `Tempo: ${lib.tempo}` : '', lib.description].filter(Boolean).join('\n');
          const set = (id, val) => { const el = dlg.querySelector(`#f-${id}`); if (el && !el.value && val) el.value = val; };
          set('sets', lib.sets); set('reps', lib.reps); set('rest', lib.rest); set('notes', notes);
        };
        nameEl.addEventListener('change', fill);
        nameEl.addEventListener('input', () => { if (Store.library().some((x) => x.name === nameEl.value)) fill(); });
      },
      onSubmit: (v) => {
        if (ex) Object.assign(ex, v);
        else (day.exercises = day.exercises || []).push(Object.assign({ id: U.uid() }, v));
        saveRoutine(r);
        if (!ex) UI.toast('Ejercicio añadido');
      },
    });
  }

  function moveItem(list, id, dir) {
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
  }

  async function copyRoutine(c) {
    const r = Store.routineFor(c.id);
    if (!r) return;
    const text = routineText(c, r);
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (err) { /* sin portapapeles */ }
      ta.remove();
    }
    UI.toast('Rutina copiada: pégala donde quieras');
  }

  /* =========================================================
   * Dieta (apartado preparado; el contenido se definirá más adelante)
   * ======================================================= */

  /* ---------- Objetivos de la dieta: calorías y reparto de macronutrientes ---------- */

  const MACRO_INFO = [
    { key: 'carbs', label: 'Carbohidratos', kcalPerG: 4, cls: 'm-carbs' },
    { key: 'protein', label: 'Proteínas', kcalPerG: 4, cls: 'm-protein' },
    { key: 'fat', label: 'Grasas', kcalPerG: 9, cls: 'm-fat' },
  ];
  const DIET_PRESETS = {
    equilibrada: { label: 'Equilibrada', carbs: 50, protein: 20, fat: 30 },
    proteica: { label: 'Alta en proteína', carbs: 33, protein: 40, fat: 27 },
    deportiva: { label: 'Deportiva (más hidratos)', carbs: 55, protein: 25, fat: 20 },
    baja: { label: 'Baja en hidratos', carbs: 20, protein: 40, fat: 40 },
    cetogenica: { label: 'Cetogénica', carbs: 5, protein: 25, fat: 70 },
  };

  /** Gramos, kcal y % de cada macro a partir de las calorías y los porcentajes. */
  function macroSplit(t) {
    const kcal = Number(t.kcal) || 0;
    return MACRO_INFO.map((m) => {
      const pct = Number(t[`${m.key}Pct`]) || 0;
      const grams = Math.round((kcal * pct) / 100 / m.kcalPerG);
      return Object.assign({}, m, { pct, grams, kcal: grams * m.kcalPerG });
    });
  }

  function presetName(t) {
    const hit = Object.entries(DIET_PRESETS).find(([, p]) => p.carbs === Math.round(t.carbsPct) && p.protein === Math.round(t.proteinPct) && p.fat === Math.round(t.fatPct));
    return hit ? hit[1].label : 'Personalizada';
  }

  /** Gráfico circular (dónut) con el % de cada macro. */
  function macroDonut(split) {
    const total = split.reduce((n, m) => n + m.pct, 0) || 1;
    const R = 52;
    const C = 2 * Math.PI * R;
    let offset = 0;
    let labels = '';
    const segs = split.map((m) => {
      const frac = m.pct / total;
      const len = frac * C;
      const mid = (offset + len / 2) / C * 2 * Math.PI - Math.PI / 2;
      if (m.pct >= 4) labels += `<text x="${80 + Math.cos(mid) * R}" y="${80 + Math.sin(mid) * R + 5}" text-anchor="middle" class="donut-label">${Math.round(m.pct)}</text>`;
      const seg = `<circle r="${R}" cx="80" cy="80" fill="none" class="donut-seg ${m.cls}" stroke-width="34" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 80 80)"/>`;
      offset += len;
      return seg;
    }).join('');
    return `<svg class="donut" viewBox="0 0 160 160" role="img" aria-label="Reparto de macronutrientes: ${split.map((m) => `${m.label} ${Math.round(m.pct)} %`).join(', ')}">${segs}${labels}</svg>`;
  }

  function dietTargetsCard(c, d) {
    const t = d && d.targets;
    if (!t || !(Number(t.kcal) > 0)) {
      return `<section class="card diet-goals">
        <div class="card-header"><h2>Objetivos</h2>${badge('Sin objetivos', 'warning')}</div>
        ${empty('trend', `<strong>Fija las calorías y el reparto de macros de ${esc(c.name.split(' ')[0])}.</strong><br>Serán la base para preparar su dieta.`,
          `<div style="margin-top:14px"><button class="btn primary" data-action="diet-targets" data-client="${c.id}">${U.icon('plus')}Fijar objetivos</button></div>`)}
      </section>`;
    }
    const split = macroSplit(t);
    const lastW = Store.lastMeasurement(c.id);
    const kg = lastW && Number(lastW.weight) > 0 ? Number(lastW.weight) : null;
    return `<section class="card diet-goals">
      <button class="kcal-goal" data-action="diet-targets" data-client="${c.id}">
        <span class="kcal-icon">${U.icon('flame')}</span>
        <span class="grow"><span class="kcal-label">Objetivo de calorías</span><span class="kcal-value">${fmtNum(t.kcal, 0)} kcal</span></span>
        ${U.icon('right')}
      </button>
      <h3 class="macro-title">Macronutrientes</h3>
      <div class="macro-cols">${split.map((m) => `
        <div class="macro-col ${m.cls}">
          <span class="mc-label">${m.label}</span>
          <span class="mc-grams">${m.grams} g</span>
          <span class="mc-kcal">${m.kcal} kcal</span>
          ${kg ? `<span class="mc-perkg">${fmtNum(m.grams / kg, 1)} g/kg</span>` : ''}
        </div>`).join('')}</div>
      ${macroDonut(split)}
      <div class="donut-legend">${split.map((m) => `<span class="${m.cls}"><i></i>${m.label === 'Carbohidratos' ? 'Carbohidratos' : m.label}</span>`).join('')}</div>
      <div class="diet-rows">
        <div class="diet-row"><span>Tipo de dieta</span><strong class="accent">${esc(presetName(t))}</strong></div>
        <button class="diet-row" data-action="diet-targets" data-client="${c.id}"><span>Editar macronutrientes</span>${U.icon('right')}</button>
      </div>
      ${kg ? `<p class="muted" style="font-size:.8rem;margin:10px 0 0">g/kg calculado con su último peso: ${fmtNum(kg)} kg.</p>` : ''}
    </section>`;
  }

  function dietTargetsForm(clientId) {
    const c = Store.get('clients', clientId);
    if (!c) return;
    const d = Store.dietFor(clientId);
    const t0 = (d && d.targets) || { kcal: 2000, carbsPct: 33, proteinPct: 40, fatPct: 27 };
    const lastW = Store.lastMeasurement(clientId);
    const kg = lastW && Number(lastW.weight) > 0 ? Number(lastW.weight) : null;
    const body = `<div class="form-grid">
      <div class="field full"><label for="dt-kcal">Objetivo de calorías (kcal)</label><input id="dt-kcal" type="number" min="500" max="8000" step="10" inputmode="numeric" value="${esc(t0.kcal)}"></div>
      <div class="field full"><label for="dt-preset">Tipo de dieta</label><select id="dt-preset">
        <option value="">Personalizada</option>
        ${Object.entries(DIET_PRESETS).map(([k, p]) => `<option value="${k}">${p.label} (${p.carbs} / ${p.protein} / ${p.fat})</option>`).join('')}
      </select><div class="hint">Reparto en % de carbohidratos / proteínas / grasas.</div></div>
      ${MACRO_INFO.map((m) => `
        <div class="field full macro-edit ${m.cls}">
          <label>${m.label}</label>
          <div class="me-row">
            <div class="me-input"><input id="dt-${m.key}-pct" type="number" min="0" max="100" step="1" inputmode="numeric" aria-label="${m.label} en %"><span>%</span></div>
            <div class="me-input"><input id="dt-${m.key}-g" type="number" min="0" step="1" inputmode="numeric" aria-label="${m.label} en gramos"><span>g</span></div>
            <span class="me-kcal" id="dt-${m.key}-kcal"></span>
          </div>
        </div>`).join('')}
      <div class="full macro-total" id="dt-total"></div>
    </div>`;
    UI.openModal({
      title: `Objetivos de ${c.name.split(' ')[0]}`,
      body,
      footer: '<button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn primary">Guardar objetivos</button>',
      onOpen: (dlg) => {
        const $ = (id) => dlg.querySelector(`#${id}`);
        const pct = { carbs: Number(t0.carbsPct), protein: Number(t0.proteinPct), fat: Number(t0.fatPct) };
        const kcal = () => Number($('dt-kcal').value) || 0;
        const paint = (skip) => {
          let sum = 0;
          for (const m of MACRO_INFO) {
            const g = Math.round((kcal() * pct[m.key]) / 100 / m.kcalPerG);
            if (skip !== `${m.key}-pct`) $(`dt-${m.key}-pct`).value = Math.round(pct[m.key] * 10) / 10;
            if (skip !== `${m.key}-g`) $(`dt-${m.key}-g`).value = g;
            $(`dt-${m.key}-kcal`).textContent = `${g * m.kcalPerG} kcal${kg ? ` · ${fmtNum(g / kg, 1)} g/kg` : ''}`;
            sum += pct[m.key];
          }
          const ok = Math.abs(sum - 100) < 0.6;
          $('dt-total').className = `full macro-total ${ok ? 'ok' : 'bad'}`;
          $('dt-total').textContent = ok ? 'Total: 100 %' : `Total: ${fmtNum(sum, 1)} %. El reparto debe sumar 100 %.`;
          const hit = Object.entries(DIET_PRESETS).find(([, p]) => p.carbs === Math.round(pct.carbs) && p.protein === Math.round(pct.protein) && p.fat === Math.round(pct.fat));
          $('dt-preset').value = hit ? hit[0] : '';
        };
        $('dt-kcal').addEventListener('input', () => paint());
        $('dt-preset').addEventListener('change', () => {
          const p = DIET_PRESETS[$('dt-preset').value];
          if (p) { pct.carbs = p.carbs; pct.protein = p.protein; pct.fat = p.fat; paint(); }
        });
        for (const m of MACRO_INFO) {
          $(`dt-${m.key}-pct`).addEventListener('input', (e) => { pct[m.key] = Number(e.target.value) || 0; paint(`${m.key}-pct`); });
          $(`dt-${m.key}-g`).addEventListener('input', (e) => {
            const k = kcal();
            pct[m.key] = k ? ((Number(e.target.value) || 0) * m.kcalPerG * 100) / k : 0;
            paint(`${m.key}-g`);
          });
        }
        paint();
        dlg._pct = pct;
      },
      onSubmit: () => {
        const dlg = document.getElementById('modal');
        const pct = dlg._pct;
        const k = Number(dlg.querySelector('#dt-kcal').value);
        if (!(k >= 500)) { UI.toast('Indica un objetivo de calorías válido'); return; }
        const sum = pct.carbs + pct.protein + pct.fat;
        if (Math.abs(sum - 100) >= 0.6) { UI.toast('El reparto de macros debe sumar 100 %'); return; }
        const targets = { kcal: Math.round(k), carbsPct: pct.carbs, proteinPct: pct.protein, fatPct: pct.fat };
        if (d) Store.update('diets', d.id, { targets }); else Store.add('diets', { clientId, text: '', targets });
        UI.closeModal();
        UI.toast('Objetivos guardados');
        App.render();
      },
    });
  }

  function clientDiet(c) {
    const d = Store.dietFor(c.id);
    return `${dietTargetsCard(c, d)}
    <section class="card">
      <div class="card-header">
        <h2>Plan de comidas</h2>
        ${d && (d.text || '').trim() ? `<span class="muted" style="font-size:.85rem">Actualizado el ${esc(fmtDate((d.updatedAt || d.createdAt || '').slice(0, 10) || today()))}</span>` : ''}
      </div>
      <form class="diet-form" data-client="${c.id}">
        <textarea name="text" rows="8" placeholder="Escribe aquí el plan de alimentación de ${esc(c.name.split(' ')[0])}: comidas, cantidades, indicaciones…" aria-label="Plan de comidas">${esc(d ? d.text : '')}</textarea>
        <div class="actions" style="margin-top:10px"><button type="submit" class="btn primary">${U.icon('check')}Guardar</button></div>
      </form>
      <p class="muted" style="font-size:.82rem;margin:12px 0 0">Próximamente podrás generar aquí el menú con alimentos de la biblioteca a partir de estos objetivos.</p>
    </section>`;
  }

  function submitDietForm(form) {
    const clientId = form.dataset.client;
    const text = form.elements.text.value;
    const d = Store.dietFor(clientId);
    if (d) Store.update('diets', d.id, { text });
    else Store.add('diets', { clientId, text });
    UI.toast('Plan de comidas guardado');
    App.render();
  }

  /* =========================================================
   * Fotos
   * ======================================================= */

  function clientPhotos(c) {
    const photos = Store.photosFor(c.id);
    const groups = [];
    for (const p of photos) {
      const g = groups[groups.length - 1];
      if (g && g.date === p.date) g.items.push(p);
      else groups.push({ date: p.date, items: [p] });
    }
    return `<section class="card">
      <div class="card-header"><h2>Fotos ${photos.length ? `<span class="muted" style="font:500 1rem 'Plus Jakarta Sans',sans-serif">${photos.length}</span>` : ''}</h2></div>
      <div class="photo-upload">
        <label class="btn primary" for="photo-input" tabindex="0">${U.icon('upload')}Subir fotos</label>
        <input type="file" id="photo-input" data-client="${c.id}" accept="image/*" multiple hidden>
        <label class="task-date"><span>Fecha de las fotos</span><input type="date" id="photo-date" value="${today()}"></label>
      </div>
      ${groups.length ? groups.map((g) => `
        <h3 class="photo-date">${esc(fmtDate(g.date))}</h3>
        <div class="photo-grid">${g.items.map((p) => `
          <button class="photo" data-action="open-photo" data-id="${p.id}" aria-label="Ver foto del ${esc(fmtDate(p.date))}">
            <img data-photo="${p.id}" alt="Foto de ${esc(c.name)} del ${esc(fmtDate(p.date))}">
          </button>`).join('')}</div>`).join('') : empty('upload', 'Todavía no hay fotos. Sube las fotos de progreso de este cliente: puedes elegirlas de la galería o hacerlas con la cámara.')}
    </section>`;
  }

  async function uploadPhotos(input) {
    const files = [...(input.files || [])];
    if (!files.length) return;
    const clientId = input.dataset.client;
    const date = document.getElementById('photo-date')?.value || today();
    UI.toast(files.length === 1 ? 'Subiendo foto…' : `Subiendo ${files.length} fotos…`);
    try {
      const n = await Photos.addFiles(clientId, files, date);
      UI.toast(n === 1 ? 'Foto guardada' : `${n} fotos guardadas`);
    } catch (e) {
      UI.toast(e.message || 'No se pudo guardar la foto');
    }
    App.render();
  }

  async function openPhoto(id) {
    const meta = Store.get('photos', id);
    if (!meta) return;
    const list = Store.photosFor(meta.clientId);
    const i = list.findIndex((p) => p.id === id);
    const prev = list[i + 1];
    const next = list[i - 1];
    const dataUrl = await Photos.src(id);
    UI.openModal({
      title: `Foto del ${fmtDate(meta.date)}`,
      body: `<div class="photo-view">
        ${dataUrl ? `<img src="${dataUrl}" alt="Foto del ${esc(fmtDate(meta.date))}">` : '<div class="empty">No se ha podido cargar esta foto en este dispositivo.</div>'}
        ${prev ? `<button type="button" class="photo-nav prev" data-photo-nav="${prev.id}" aria-label="Foto anterior">${U.icon('left')}</button>` : ''}
        ${next ? `<button type="button" class="photo-nav next" data-photo-nav="${next.id}" aria-label="Foto siguiente">${U.icon('right')}</button>` : ''}
      </div>`,
      footer: `<button type="button" class="btn danger" id="photo-delete" style="margin-right:auto">${U.icon('trash')}Eliminar</button>
        ${dataUrl ? `<a class="btn" href="${dataUrl}" download="foto-${meta.date}.jpg">${U.icon('download')}Descargar</a>` : ''}
        <button type="button" class="btn primary" data-close>Cerrar</button>`,
      onOpen: (dlg) => {
        dlg.querySelectorAll('[data-photo-nav]').forEach((b) => { b.onclick = () => openPhoto(b.dataset.photoNav); });
        document.getElementById('photo-delete').onclick = async () => {
          const ok = await UI.confirm({ title: 'Eliminar foto', message: '¿Seguro que quieres eliminar esta foto? No se puede deshacer.' });
          if (!ok) return;
          await Photos.remove(id);
          UI.toast('Foto eliminada');
          App.render();
        };
      },
    });
  }

  /** Avisos: pagos que vencen pronto o vencidos, seguimientos/revisiones y tareas pendientes. */
  function computeAlerts() {
    const pay = [];
    for (const c of Store.clients().filter((x) => clientStatus(x) === 'activo')) {
      const di = Store.dueInfo(c);
      if (di && di.status !== 'al-dia') pay.push({ c, di, kind: 'pago' });
    }
    pay.sort((a, b) => a.di.date.localeCompare(b.di.date));
    const tasks = Store.pendingTasks().map((task) => ({ c: Store.get('clients', task.clientId), task, kind: 'tarea' }));
    const reviews = Store.clients()
      .map((c) => ({ c, ri: Store.reviewInfo(c), kind: 'revision' }))
      .filter((x) => x.ri && x.ri.status !== 'al-dia')
      .sort((a, b) => a.ri.date.localeCompare(b.ri.date));
    const plans = Store.clients().map((c) => ({ c, gaps: Store.planGaps(c), kind: 'plan' })).filter((x) => x.gaps);
    // Cuestionarios respondidos por enlace que aún no se han marcado como revisados.
    const answers = Store.clients()
      .filter((c) => c.questionnaire && c.questionnaire.answeredAt && c.questionnaire.linkToken && !c.questionnaire.reviewedAt)
      .sort((a, b) => b.questionnaire.answeredAt.localeCompare(a.questionnaire.answeredAt))
      .map((c) => ({ c, kind: 'cuestionario' }));
    return pay.concat(answers, reviews, plans, tasks);
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
    const dueThisMonth = d.clients.map((c) => Store.dueInfo(c)).filter((x) => x && x.days > 0 && x.date <= to).reduce((s, x) => s + x.amount, 0);
    const pendingMonth = rec.reduce((s, r) => s + r.amount, 0) + dueThisMonth;
    const pendingClients = new Set(rec.map((r) => r.clientId)).size;
    const overdue = rec.filter((r) => r.overdue).length;
    const active = d.clients.filter((c) => clientStatus(c) === 'activo');
    const paused = d.clients.filter((c) => clientStatus(c) === 'pausa').length;
    const newThisMonth = d.clients.filter((c) => c.startDate >= from && c.startDate <= to).length;
    const alerts = computeAlerts();

    const payAlerts = alerts.filter((a) => a.kind === 'pago');
    const taskAlerts = alerts.filter((a) => a.kind === 'tarea');
    const reviewAlerts = alerts.filter((a) => a.kind === 'revision');
    const planAlerts = alerts.filter((a) => a.kind === 'plan');
    const answerAlerts = alerts.filter((a) => a.kind === 'cuestionario');
    const routineGapAlerts = planAlerts.filter((a) => a.gaps.noRoutine);
    const dietGapAlerts = planAlerts.filter((a) => a.gaps.noDiet);
    const planItem = (c, tab, text, label) => `
          <li class="plan-item">
            ${avatar(c)}
            <div class="grow">
              <a class="title" href="#/clientes/${c.id}" style="color:inherit;text-decoration:none">${esc(c.name)}</a>
              <div class="meta">${esc(text)}</div>
            </div>
            <button class="btn sm" data-action="open-client-tab" data-client="${c.id}" data-value="${tab}">${U.icon('plus')}${label}</button>
          </li>`;

    /* Avisos: primero las tarjetas con algo pendiente; las que están al día, en una sola línea al final. */
    const section = (id, title, n, link, list, okText) => ({
      n,
      html: n
        ? `<section class="card alert-card has-items" id="${id}">
            <div class="card-header"><h2>${title} <span class="count">${n}</span></h2>${link}</div>
            ${list}
          </section>`
        : `<section class="card alert-card alert-ok" id="${id}">
            <h2>${title}</h2><span class="ok-text">${U.icon('done')}${esc(okText)}</span>
          </section>`,
    });
    const alertSections = [
      section('cuestionarios', 'Cuestionarios respondidos', answerAlerts.length, '',
        `<ul class="list task-list">${answerAlerts.map((a) => `
          <li class="task review">
            <button class="task-check" data-action="review-questionnaire" data-client="${a.c.id}" role="checkbox" aria-checked="false" aria-label="Marcar el cuestionario de ${esc(a.c.name)} como revisado" title="Marcar como revisado"></button>
            ${avatar(a.c)}
            <div class="grow">
              <a class="title" href="#/clientes/${a.c.id}" data-action="open-answers" data-client="${a.c.id}" style="color:inherit;text-decoration:none">${esc(a.c.name)}</a>
              <div class="meta"><span>Respondió el ${esc(fmtDate(a.c.questionnaire.answeredAt))} · ${plural((a.c.questionnaire.items || []).filter((x) => x.a).length, 'respuesta', 'respuestas')}</span></div>
            </div>
            <div class="review-actions">
              ${badge('Nuevo', 'success')}
              <button class="btn sm primary" data-action="open-answers" data-client="${a.c.id}">${U.icon('file')}Ver respuestas</button>
            </div>
          </li>`).join('')}</ul>`,
        'No hay cuestionarios nuevos'),
      section('proximos-pagos', 'Pagos pendientes', payAlerts.length, '<a href="#/pagos" class="btn sm">Ver todos</a>',
        `<ul class="list pay-list">${payAlerts.map((a) => payRow(a.c)).join('')}</ul>`,
        `Nadie tiene que pagar en los próximos ${Store.REMIND_DAYS} días`),
      section('revisiones', 'Seguimientos y revisiones', reviewAlerts.length, '',
        `<ul class="list task-list">${reviewAlerts.map((a) => reviewItem(a.c, a.ri)).join('')}</ul>`,
        `Nada en los próximos ${Store.REVIEW_NOTICE} días`),
      section('sin-rutina', 'Sin rutina', routineGapAlerts.length, '',
        `<ul class="list">${routineGapAlerts.map((a) => planItem(a.c, 'rutina', a.gaps.routineEmpty ? 'Tiene la rutina sin ejercicios' : 'Todavía no tiene rutina', a.gaps.routineEmpty ? 'Completar rutina' : 'Crear rutina')).join('')}</ul>`,
        'Todos tienen rutina'),
      section('sin-dieta', 'Sin dieta', dietGapAlerts.length, '',
        `<ul class="list">${dietGapAlerts.map((a) => planItem(a.c, 'dieta', a.gaps.hasTargets ? 'Tiene los objetivos fijados, falta rellenar la dieta' : 'Todavía no tiene dieta', a.gaps.hasTargets ? 'Completar dieta' : 'Crear dieta')).join('')}</ul>`,
        'Todos tienen dieta'),
      section('tareas-pendientes', 'Tareas pendientes', taskAlerts.length, '',
        `<ul class="list task-list">${taskAlerts.map((a) => taskItem(a.task, { showClient: true })).join('')}</ul>`,
        'Sin tareas pendientes'),
    ].sort((x, y) => (y.n > 0) - (x.n > 0)); // las que tienen avisos, arriba (sin cambiar su orden)

    return `
      <div class="page-header">
        <div>
          ${dateLine}
          <h1 class="display" data-greeting data-day="${t}">${esc(greetingText())}</h1>
        </div>
      </div>

      <div class="alerts-stack">
        ${alertSections.map((x) => x.html).join('')}
      </div>

      <h2 class="section-title">Este mes</h2>
      <div class="stats">
        <div class="card stat"><div class="stat-label">Cobrado en ${month}</div><div class="stat-value">${money(income)}</div><div class="stat-sub">de ${money(income + pendingMonth)} previstos</div></div>
        <div class="card stat"><div class="stat-label">Por cobrar</div><div class="stat-value">${money(pending)}</div><div class="stat-sub">${plural(pendingClients, 'cliente', 'clientes')} · ${plural(overdue, 'vencido', 'vencidos')}</div></div>
        <div class="card stat"><div class="stat-label">Clientes activos</div><div class="stat-value">${active.length}</div><div class="stat-sub">${paused} en pausa</div></div>
        <div class="card stat"><div class="stat-label">Altas en ${month}</div><div class="stat-value">${newThisMonth}</div><div class="stat-sub">${plural(d.clients.length, 'cliente', 'clientes')} en total</div></div>
      </div>

      <section class="card chart-card">
        <div class="card-header"><h2>Ingresos cobrados</h2><span class="muted">Últimos 6 meses</span></div>
        ${incomeChart()}
      </section>`;
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
    return `<div class="table-wrap"><table>
      <thead><tr><th>Cliente</th><th class="hide-sm">Email</th><th class="hide-sm">Teléfono</th><th class="num">Importe</th><th>Próximo pago</th><th class="hide-sm">Próxima revisión</th><th class="hide-sm">Último peso</th></tr></thead>
      <tbody>${list.map((c) => {
        const di = Store.dueInfo(c);
        const last = Store.lastMeasurement(c.id);
        return `<tr class="clickable" data-href="#/clientes/${c.id}" tabindex="0">
          <td><div class="name-cell">${avatar(c)}<div><div style="font-weight:600">${esc(c.name)}</div>${clientStatus(c) !== 'activo' ? statusBadge(c) : ''}</div></div></td>
          <td class="hide-sm">${c.email ? esc(c.email) : '—'}</td>
          <td class="hide-sm">${c.phone ? esc(c.phone) : '—'}</td>
          <td class="num">${c.rate ? money(c.rate) : '<span class="muted">—</span>'}</td>
          <td>${di ? `${esc(U.fmtDateShort(di.date))} ${di.status !== 'al-dia' ? dueBadge(di) : ''}` : '<span class="muted">—</span>'}</td>
          <td class="hide-sm">${(() => { const ri = Store.reviewInfo(c); return ri ? `${esc(U.fmtDateShort(ri.date))} ${badge(ri.type === 'mensual' ? 'Mensual' : 'Seguimiento', REVIEW_STATUS[ri.status].badge)}` : '<span class="muted">—</span>'; })()}</td>
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
    const pendingCount = Store.tasksFor(c.id).filter((t) => !t.done).length;
    const tabs = [['resumen', 'Resumen'], ['rutina', 'Rutina'], ['dieta', 'Dieta'], ['progreso', 'Progreso'], ['pagos', 'Pagos'], ['fotos', 'Fotos'], ['tareas', `Tareas${pendingCount ? ` <span class="tab-count">${pendingCount}</span>` : ''}`]];
    if (!tabs.some(([k]) => k === state.clientTab)) state.clientTab = 'resumen';
    const ageVal = U.age(c.birthDate);
    const sub = [ageVal !== null ? `${ageVal} años` : null, c.startDate ? `Cliente desde ${fmtDate(c.startDate)}` : null].filter(Boolean).join(' · ');
    let body;
    switch (state.clientTab) {
      case 'progreso': body = clientProgress(c); break;
      case 'pagos': body = clientPayments(c); break;
      case 'fotos': body = clientPhotos(c); break;
      case 'rutina': body = clientRoutine(c); break;
      case 'dieta': body = clientDiet(c); break;
      case 'tareas': body = clientTasks(c); break;
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
            ${U.waLink(c.phone) ? `<a class="btn" href="${U.waLink(c.phone)}" target="_blank" rel="noopener">${U.icon('message')}WhatsApp</a>` : ''}
            ${c.email ? `<a class="btn" href="mailto:${esc(c.email)}">${U.icon('mail')}Email</a>` : ''}
            <button class="btn" data-action="edit-client" data-id="${c.id}">${U.icon('edit')}Editar</button>
            <button class="btn primary" data-action="new-measurement" data-client="${c.id}">${U.icon('plus')}Peso</button>
          </div>
        </div>
        ${c.health ? `<div class="alert">${U.icon('alert')}<div><strong>Salud:</strong> ${esc(c.health)}</div></div>` : ''}
      </div>
      <div class="tabs" role="tablist">
        ${tabs.map(([k, l]) => `<button role="tab" aria-selected="${state.clientTab === k}" class="${state.clientTab === k ? 'active' : ''}" data-action="client-tab" data-value="${k}">${l}</button>`).join('')}
      </div>
      ${body}
      ${state.clientTab === 'resumen' ? questionnaireCard(c) + clientManage(c) : ''}`;
  }

  /** Sección al final del perfil para pausar, dar de baja, reactivar o eliminar al cliente. */
  function clientManage(c) {
    const st = clientStatus(c);
    const pauseBtn = st === 'pausa'
      ? `<button class="btn" data-action="set-status" data-id="${c.id}" data-value="activo">${U.icon('done')}Reactivar</button>`
      : `<button class="btn" data-action="set-status" data-id="${c.id}" data-value="pausa">${U.icon('clock')}Pausar</button>`;
    const leaveBtn = st === 'inactivo'
      ? `<button class="btn" data-action="set-status" data-id="${c.id}" data-value="activo">${U.icon('done')}Reactivar</button>`
      : `<button class="btn" data-action="set-status" data-id="${c.id}" data-value="inactivo">${U.icon('back')}Dar de baja</button>`;
    const info = {
      activo: 'Aparece en pagos y en los avisos.',
      pausa: 'En pausa: no aparece en pagos ni en avisos hasta que reactives su ficha.',
      inactivo: 'De baja: se conserva todo su historial, pero no aparece en pagos ni en avisos.',
    }[st];
    return `<section class="card manage-card">
      <div class="card-header"><h2>Gestionar cliente</h2>${statusBadge(c)}</div>
      <p class="muted" style="margin:0 0 14px">${info}</p>
      <div class="actions">
        ${st === 'inactivo' ? leaveBtn : `${pauseBtn}${leaveBtn}`}
        <button class="btn danger" data-action="delete-client" data-id="${c.id}">${U.icon('trash')}Eliminar</button>
      </div>
    </section>`;
  }

  async function setClientStatus(id, status) {
    const c = Store.get('clients', id);
    if (!c) return;
    const first = esc(c.name.split(' ')[0]);
    const texts = {
      pausa: { title: 'Pausar cliente', msg: `${first} dejará de aparecer en pagos y avisos hasta que reactives su ficha. No se borra nada.`, btn: 'Pausar', done: 'Cliente en pausa' },
      inactivo: { title: 'Dar de baja', msg: `${first} pasará a la lista de bajas. Se conserva todo su historial y podrás reactivar su ficha cuando quieras.`, btn: 'Dar de baja', done: 'Cliente dado de baja' },
      activo: { title: 'Reactivar cliente', msg: `${first} volverá a aparecer en pagos y avisos. Revisa la fecha de su próximo pago.`, btn: 'Reactivar', done: 'Cliente reactivado' },
    }[status];
    const ok = await UI.confirm({ title: texts.title, message: texts.msg, confirmLabel: texts.btn, danger: false });
    if (!ok) return;
    const prev = c.status || 'activo';
    Store.update('clients', id, { status });
    App.render();
    UI.toast(texts.done, { label: 'Deshacer', onClick: () => { Store.update('clients', id, { status: prev }); App.render(); } });
  }

  function clientSummary(c) {
    const t = today();
    const di = Store.dueInfo(c);
    const lastPay = Store.paymentsFor(c.id).find((p) => p.status === 'pagado');
    const ri = Store.reviewInfo(c);
    const totalPaid = Store.paymentsFor(c.id).filter((p) => p.status === 'pagado').reduce((s, p) => s + Number(p.amount || 0), 0);
    const all = Store.measurementsFor(c.id);
    const ms = all.filter((m) => m.weight !== '' && m.weight !== undefined);
    const weightDelta = ms.length >= 2 ? Number(ms[ms.length - 1].weight) - Number(ms[0].weight) : null;
    const lastM = ms[ms.length - 1];
    const imc = lastM && c.height ? Number(lastM.weight) / Math.pow(Number(c.height) / 100, 2) : null;
    const months = c.startDate ? Math.max(0, Math.floor(U.daysBetween(c.startDate, t) / 30.44)) : null;
    const row = (k, v) => (v ? `<dt>${k}</dt><dd>${v}</dd>` : '');

    return `
      <div class="stats">
        <div class="card stat"><div class="stat-label">Próximo pago</div><div class="stat-value" style="font-size:1.8rem">${c.nextDue ? esc(U.fmtDateShort(c.nextDue)) : '—'}</div><div class="stat-sub">${di ? esc(dueText(di).replace(/ \(.*\)$/, '')) : clientStatus(c) === 'activo' ? 'Sin fecha' : esc(CLIENT_STATUS[clientStatus(c)].label)}</div></div>
        <div class="card stat"><div class="stat-label">Último pago</div><div class="stat-value">${lastPay ? money(lastPay.amount) : '—'}</div><div class="stat-sub">${lastPay ? esc(fmtDate(lastPay.date)) : 'Sin pagos'}</div></div>
        <div class="card stat"><div class="stat-label">Último peso</div><div class="stat-value">${lastM ? `${fmtNum(lastM.weight)} kg` : '—'}</div><div class="stat-sub">${lastM ? `${esc(U.fmtDateShort(lastM.date))} · hace ${plural(U.daysBetween(lastM.date, t), 'día', 'días')}` : 'Sin peso registrado'}</div></div>
        <div class="card stat"><div class="stat-label">${ri ? esc(ri.label) : 'Próxima revisión'}</div><div class="stat-value" style="font-size:1.8rem">${ri ? esc(U.fmtDateShort(ri.date)) : '—'}</div><div class="stat-sub">${!ri ? (clientStatus(c) === 'activo' ? 'Añade su fecha de alta en Editar' : 'Solo para clientes activos') : ri.status === 'atrasada' ? `Pendiente desde hace ${plural(-ri.days, 'día', 'días')}` : ri.days === 0 ? 'Hoy' : ri.days === 1 ? 'Mañana' : `En ${ri.days} días`}</div>${ri && ri.status !== 'al-dia' ? `<button class="btn sm review-done" data-action="complete-review" data-client="${c.id}">${U.icon('check')}Hecho</button>` : ''}</div>
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
          </dl>` : empty('ruler', 'Sin peso registrado todavía.', `<div style="margin-top:10px"><button class="btn sm" data-action="new-measurement" data-client="${c.id}">${U.icon('plus')}Peso</button></div>`)}
          ${ms.length >= 2 ? `<div class="mt">${UI.lineChart(ms.map((m) => ({ x: m.date, y: m.weight })), { unit: 'kg', height: 180 })}</div>` : ''}
        </section>
      </div>`;
  }

  function clientProgress(c) {
    const ms = Store.measurementsFor(c.id).filter((m) => m.weight !== '' && m.weight !== undefined && m.weight !== null);
    const first = ms[0];
    const diff = (a, b) => {
      if (!a || !b) return '<span class="muted">—</span>';
      const d = Number(a.weight) - Number(b.weight);
      if (!d) return '<span class="muted">0</span>';
      return `<span class="${d > 0 ? 'delta-up' : 'delta-down'}">${d > 0 ? '+' : ''}${fmtNum(d)} kg</span>`;
    };
    const rows = ms.slice().reverse();
    return `
      <section class="card">
        <div class="card-header">
          <h2>Evolución del peso</h2>
          <button class="btn primary sm" data-action="new-measurement" data-client="${c.id}">${U.icon('plus')}Peso</button>
        </div>
        ${ms.length ? UI.lineChart(ms.map((m) => ({ x: m.date, y: m.weight })), { unit: 'kg' }) : empty('ruler', 'Registra el primer peso para empezar a ver la evolución.')}
      </section>
      ${ms.length ? `<section class="card">
        <div class="card-header"><h2>Historial de peso</h2></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Fecha</th><th class="num">Peso</th><th class="num">Cambio</th><th class="num hide-sm">Desde el inicio</th><th></th></tr></thead>
          <tbody>${rows.map((m, i) => `<tr>
            <td>${fmtDate(m.date)}${m.notes ? ` <span class="muted" title="${esc(m.notes)}">${U.icon('note')}</span>` : ''}</td>
            <td class="num"><strong>${fmtNum(m.weight)} kg</strong></td>
            <td class="num">${diff(m, rows[i + 1])}</td>
            <td class="num hide-sm">${m === first ? '<span class="muted">—</span>' : diff(m, first)}</td>
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
          ${p.status === 'pendiente' ? `<button class="btn sm" data-action="mark-paid" data-id="${p.id}">${U.icon('check')}Marcar pagado</button>` : ''}
          <button class="icon-btn" data-action="edit-payment" data-id="${p.id}" aria-label="Editar">${U.icon('edit')}</button>
        </td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  function clientPayments(c) {
    const list = Store.paymentsFor(c.id);
    return `${clientStatus(c) === 'activo' ? `<section class="card"><ul class="list pay-list">${payRow(c)}</ul></section>` : ''}
    <section class="card">
      <div class="card-header"><h2>Historial de pagos (${list.length})</h2>
        <button class="btn sm" data-action="new-payment" data-client="${c.id}">${U.icon('plus')}Otro pago</button>
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
    const year = Store.paidBetween(t.slice(0, 4) + '-01-01', t.slice(0, 4) + '-12-31');
    const rec = Store.receivables();
    const clients = clientsByDue();
    const dueThisMonth = Store.data.clients.map((c) => Store.dueInfo(c)).filter((x) => x && x.days > 0 && x.date <= to).reduce((s, x) => s + x.amount, 0);
    const seg = (v, l) => `<button data-action="pay-filter" data-value="${v}" class="${state.payFilter === v ? 'active' : ''}">${l}</button>`;
    return `
      <div class="page-header">
        <div><h1 class="display">Pagos</h1><p>Pulsa «Pago» cuando un cliente te pague y elige cuántos meses paga: el siguiente pago cae el mismo día del mes que su alta</p></div>
        <button class="btn pill" data-action="new-payment">${U.icon('plus')}Otro pago</button>
      </div>
      <section class="card" id="pendientes">
        <div class="card-header"><h2>Clientes</h2><span class="muted">${plural(clients.length, 'cliente activo', 'clientes activos')}</span></div>
        ${clients.length ? `<ul class="list pay-list">${clients.map(payRow).join('')}</ul>` : empty('users', 'No tienes clientes activos.')}
      </section>
      <div class="stats">
        <div class="card stat"><div class="stat-label">Cobrado en ${monthName(t)}</div><div class="stat-value">${money(month)}</div><div class="stat-sub">de ${money(month + rec.reduce((s, r) => s + r.amount, 0) + dueThisMonth)} previstos</div></div>
        <div class="card stat"><div class="stat-label">Por cobrar</div><div class="stat-value">${money(rec.reduce((s, r) => s + r.amount, 0))}</div><div class="stat-sub">${plural(new Set(rec.map((r) => r.clientId)).size, 'cliente', 'clientes')} · ${plural(rec.filter((r) => r.overdue).length, 'vencido', 'vencidos')}</div></div>
        <div class="card stat"><div class="stat-label">Cobrado en ${t.slice(0, 4)}</div><div class="stat-value">${money(year)}</div><div class="stat-sub">desde enero</div></div>
      </div>
      <section class="card">
        <div class="card-header"><h2>Historial de pagos</h2><div class="segmented" role="group" aria-label="Filtrar pagos">${seg('todos', 'Todos')}${seg('pagado', 'Pagados')}${seg('pendiente', 'Pendientes')}</div></div>
        ${paymentsTable(list)}
      </section>`;
  }

  /* =========================================================
   * Biblioteca de ejercicios
   * ======================================================= */

  const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Gemelos', 'Core / Abdomen', 'Cuerpo completo', 'Cardio', 'Movilidad / Estiramientos', 'Otros'];

  function libraryGroups() {
    const used = new Set(Store.data.library.map((x) => x.group).filter(Boolean));
    return MUSCLE_GROUPS.filter((g) => used.has(g)).concat([...used].filter((g) => !MUSCLE_GROUPS.includes(g)).sort((a, b) => a.localeCompare(b, 'es')));
  }

  function normalizeText(t) {
    return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function filteredLibrary() {
    const q = normalizeText(state.libSearch);
    const order = libraryGroups();
    const rank = (g) => { const i = order.indexOf(g); return i < 0 ? 999 : i; };
    // Orden: grupo → patrón → orden original del PDF (los añadidos a mano, por nombre).
    const pdfOrder = new Map((window.LIBRARY_DEFAULT || []).map((x, i) => [x.id, i]));
    const pos = (x) => (pdfOrder.has(x.id) ? pdfOrder.get(x.id) : 1e6);
    return Store.library().sort((a, b) => rank(a.group) - rank(b.group)
      || (a.pattern || '\uffff').localeCompare(b.pattern || '\uffff', 'es')
      || pos(a) - pos(b) || a.name.localeCompare(b.name, 'es')).filter((x) => {
      if (state.libGroup !== 'todos' && x.group !== state.libGroup) return false;
      if (!q) return true;
      return [x.name, x.group, x.pattern, x.equipment, x.description].some((f) => normalizeText(f).includes(q));
    });
  }

  /** «3 × 12 (Casi-Fallo) / 10 (Fallo)…» */
  const libSeries = (ex) => [ex.sets && `${ex.sets} series`, ex.reps].filter(Boolean).join(' × ');

  function libraryGuide(group) {
    const guide = (window.LIBRARY_GUIDES || {})[group];
    if (!guide) return '';
    return `<details class="lib-guide">
      <summary>${U.icon('book')}Pautas de ${esc(group)}</summary>
      ${guide.map((sec) => `<h4>${esc(sec.title)}</h4><ul>${sec.items.map((it) => {
        const m = it.match(/^([^:]{2,30}):\s*(.*)$/);
        return `<li>${m ? `<strong>${esc(m[1])}:</strong> ${esc(m[2])}` : esc(it)}</li>`;
      }).join('')}</ul>`).join('')}
    </details>`;
  }

  function libraryList() {
    const list = filteredLibrary();
    if (!Store.data.library.length) {
      return empty('book', '<strong>La biblioteca está vacía.</strong><br>Añade tus ejercicios con «+ Ejercicio».');
    }
    if (!list.length) return empty('search', 'Ningún ejercicio coincide con la búsqueda.');
    const searching = !!state.libSearch.trim();
    const groups = [];
    for (const ex of list) {
      const g = ex.group || 'Sin grupo';
      let last = groups[groups.length - 1];
      if (!last || last.name !== g) groups.push((last = { name: g, patterns: [] }));
      const pat = ex.pattern || '';
      let lp = last.patterns[last.patterns.length - 1];
      if (!lp || lp.name !== pat) last.patterns.push((lp = { name: pat, items: [] }));
      lp.items.push(ex);
    }
    return groups.map((g) => `
      <h3 class="lib-group">${esc(g.name)} <span class="muted">${g.patterns.reduce((n, p) => n + p.items.length, 0)}</span></h3>
      ${searching ? '' : libraryGuide(g.name)}
      ${g.patterns.map((p) => `
        ${p.name ? `<div class="lib-pattern"><span>${esc(p.name)}</span>${p.items[0].rest ? `<span class="muted">Descanso ${esc(p.items[0].rest)}</span>` : ''}</div>` : ''}
        <div class="lib-grid">${p.items.map((ex) => `
          <button class="lib-card" data-action="lib-open" data-id="${ex.id}">
            <span class="lib-name">${esc(ex.name)}</span>
            ${ex.equipment ? `<span class="badge">${esc(ex.equipment)}</span>` : ''}
            ${libSeries(ex) ? `<span class="lib-series">${esc(libSeries(ex))}</span>` : ''}
            ${ex.description ? `<span class="lib-desc">${esc(ex.description)}</span>` : ''}
          </button>`).join('')}</div>`).join('')}`).join('');
  }

  function renderLibrary() {
    const groups = libraryGroups();
    if (state.libGroup !== 'todos' && !groups.includes(state.libGroup)) state.libGroup = 'todos';
    const chip = (v, l) => `<button class="chip${state.libGroup === v ? ' active' : ''}" data-action="lib-group" data-value="${esc(v)}">${esc(l)}</button>`;
    const pick = pickContext();
    return `
      ${pick ? `<div class="pick-banner">
        <div class="grow">
          <div class="pick-title">${U.icon('plus')}Elige un ejercicio para <strong>${esc(pick.day.name)}</strong></div>
          <div class="muted">Rutina de ${esc(pick.client.name)} · toca un ejercicio para verlo y añadirlo</div>
        </div>
        <div class="actions">
          <button class="btn sm" data-action="pick-manual">${U.icon('edit')}No está en la biblioteca</button>
          <button class="btn sm" data-action="pick-cancel">Cancelar</button>
        </div>
      </div>` : ''}
      <div class="page-header">
        <div><h1 class="display">Biblioteca de ejercicios</h1><p>${plural(Store.data.library.length, 'ejercicio', 'ejercicios')}</p></div>
        <button class="btn primary pill" data-action="lib-new">${U.icon('plus')}Ejercicio</button>
      </div>
      <div class="card">
        <div class="toolbar">
          <input type="search" class="search" id="library-search" placeholder="Buscar ejercicio, grupo muscular o material…" value="${esc(state.libSearch)}" aria-label="Buscar ejercicios">
        </div>
        ${groups.length ? `<div class="lib-chips">${chip('todos', 'Todos')}${groups.map((g) => chip(g, g)).join('')}</div>` : ''}
        <div id="library-list">${libraryList()}</div>
      </div>`;
  }

  function onLibrarySearch(value) {
    state.libSearch = value;
    const el = document.getElementById('library-list');
    if (el) el.innerHTML = libraryList();
  }

  function libraryForm(id) {
    const existing = id ? Store.get('library', id) : null;
    if (existing && existing.builtIn) return; // los ejercicios de la biblioteca de serie no se editan
    UI.form({
      title: existing ? 'Editar ejercicio' : 'Nuevo ejercicio',
      fields: [
        { name: 'name', label: 'Nombre', required: true, full: true },
        { name: 'group', label: 'Grupo muscular', datalist: MUSCLE_GROUPS, placeholder: 'Ej.: Pecho, Glúteos…' },
        { name: 'pattern', label: 'Patrón', datalist: [...new Set(Store.data.library.map((x) => x.pattern).filter(Boolean))], placeholder: 'Ej.: Patrón 1 · Curl pesado' },
        { name: 'equipment', label: 'Material', placeholder: 'Ej.: Barra, mancuernas, polea, sin material' },
        { name: 'sets', label: 'Series', placeholder: 'Ej.: 3' },
        { name: 'reps', label: 'Repeticiones', full: true, placeholder: 'Ej.: 12 (Casi-Fallo) / 10 (Fallo) / 8 [Top Set] (Fallo-Total)' },
        { name: 'rest', label: 'Descanso', placeholder: 'Ej.: 2 a 3 min' },
        { name: 'tempo', label: 'Tempo', placeholder: 'Ej.: 3 s excéntrica / concéntrica explosiva' },
        { name: 'description', label: 'Notas / técnica', type: 'textarea', placeholder: 'Ejecución, puntos clave, errores comunes…' },
        { name: 'video', label: 'Enlace a vídeo (opcional)', type: 'url', full: true, placeholder: 'https://…' },
      ],
      values: existing || (state.libGroup !== 'todos' ? { group: state.libGroup } : {}),
      submitLabel: existing ? 'Guardar' : 'Añadir',
      onDelete: existing ? async () => {
        const ok = await UI.confirm({ title: 'Eliminar ejercicio', message: `¿Eliminar «${esc(existing.name)}» de la biblioteca? Las rutinas que ya lo usan no cambian.` });
        if (!ok) return;
        Store.removeLibraryExercise(id);
        UI.toast('Ejercicio eliminado');
        App.render();
      } : null,
      onSubmit: (v) => {
        if (existing) Store.update('library', id, v);
        else Store.add('library', v);
        UI.toast(existing ? 'Ejercicio actualizado' : 'Ejercicio añadido');
        App.render();
      },
    });
  }

  function openLibraryExercise(id) {
    const ex = Store.get('library', id);
    if (!ex) return;
    const row = (k, v) => (v ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : '');
    UI.openModal({
      title: ex.name,
      body: `<div class="lib-detail">
        <div class="actions" style="margin-bottom:14px">${ex.group ? badge(ex.group, 'primary') : ''}${ex.equipment ? badge(ex.equipment) : ''}</div>
        <dl class="dl">
          ${row('Patrón', ex.pattern)}
          ${row('Series', ex.sets)}
          ${row('Repeticiones', ex.reps)}
          ${row('Descanso', ex.rest)}
          ${row('Tempo', ex.tempo)}
          ${row('Notas', ex.description)}
        </dl>
        ${ex.video ? `<p style="margin-top:14px"><a href="${esc(ex.video)}" target="_blank" rel="noopener">${U.icon('right')} Ver vídeo</a></p>` : ''}
      </div>`,
      footer: (() => {
        const pick = pickContext();
        const editBtn = ex.builtIn ? '<span style="margin-right:auto"></span>' : `<button type="button" class="btn" id="lib-edit" style="margin-right:auto">${U.icon('edit')}Editar</button>`;
        return editBtn + (pick
          ? `<button type="button" class="btn" data-close>Volver</button><button type="button" class="btn primary" id="lib-pick">${U.icon('plus')}Añadir a ${esc(pick.day.name)}</button>`
          : `<button type="button" class="btn primary" data-close>Cerrar</button>`);
      })(),
      onOpen: () => {
        const edit = document.getElementById('lib-edit');
        if (edit) edit.onclick = () => libraryForm(id);
        const add = document.getElementById('lib-pick');
        if (add) add.onclick = () => { UI.closeModal(); addFromLibrary(id); };
      },
    });
  }

  /* =========================================================
   * Biblioteca de alimentos
   * ======================================================= */

  const FOOD_CATEGORIES = ['Carnes y aves', 'Embutidos y fiambres', 'Pescados y mariscos', 'Huevos', 'Proteína vegetal', 'Lácteos', 'Cereales, pan y pasta', 'Tortitas', 'Tubérculos', 'Legumbres', 'Verduras y hortalizas', 'Frutas', 'Frutos secos y semillas', 'Grasas y aceites', 'Bebidas', 'Suplementos', 'Salsas y condimentos', 'Otros'];

  function foodCategories() {
    const used = new Set(Store.data.foods.map((x) => x.category).filter(Boolean));
    return FOOD_CATEGORIES.filter((g) => used.has(g)).concat([...used].filter((g) => !FOOD_CATEGORIES.includes(g)).sort((a, b) => a.localeCompare(b, 'es')));
  }

  const num = (v) => (v === '' || v === undefined || v === null || isNaN(v) ? null : Number(v));
  /** «100 g · 165 kcal · P 31 g · C 0 g · G 3,6 g» */
  function foodMacros(f) {
    const parts = [];
    if (f.portion) parts.push(f.portion);
    if (num(f.kcal) !== null) parts.push(`${fmtNum(f.kcal, 0)} kcal`);
    const m = [['P', f.protein], ['C', f.carbs], ['G', f.fat]].filter(([, v]) => num(v) !== null).map(([k, v]) => `${k} ${fmtNum(v)} g`);
    return parts.concat(m).join(' · ');
  }

  function filteredFoods() {
    const q = normalizeText(state.foodSearch);
    const order = foodCategories();
    const rank = (g) => { const i = order.indexOf(g); return i < 0 ? 999 : i; };
    return Store.foods()
      .sort((a, b) => rank(a.category) - rank(b.category) || a.name.localeCompare(b.name, 'es'))
      .filter((f) => (state.foodCat === 'todos' || f.category === state.foodCat)
        && (!q || [f.name, f.category, f.notes].some((x) => normalizeText(x).includes(q))));
  }

  function foodList() {
    if (!Store.data.foods.length) {
      return empty('apple', '<strong>La biblioteca de alimentos está vacía.</strong><br>Añade alimentos con «+ Alimento».');
    }
    const list = filteredFoods();
    if (!list.length) return empty('search', 'Ningún alimento coincide con la búsqueda.');
    const groups = [];
    for (const f of list) {
      const g = f.category || 'Sin categoría';
      const last = groups[groups.length - 1];
      if (last && last.name === g) last.items.push(f); else groups.push({ name: g, items: [f] });
    }
    return groups.map((g) => `
      <h3 class="lib-group">${esc(g.name)} <span class="muted">${g.items.length}</span></h3>
      <div class="lib-grid">${g.items.map((f) => `
        <button class="lib-card" data-action="food-open" data-id="${f.id}">
          <span class="lib-name">${esc(f.name)}</span>
          ${foodMacros(f) ? `<span class="lib-series">${esc(foodMacros(f))}</span>` : ''}
          ${f.notes ? `<span class="lib-desc">${esc(f.notes)}</span>` : ''}
        </button>`).join('')}</div>`).join('');
  }

  function renderFoods() {
    const cats = foodCategories();
    if (state.foodCat !== 'todos' && !cats.includes(state.foodCat)) state.foodCat = 'todos';
    const chip = (v, l) => `<button class="chip${state.foodCat === v ? ' active' : ''}" data-action="food-cat" data-value="${esc(v)}">${esc(l)}</button>`;
    const tabs = `<div class="tabs food-tabs" role="tablist">
        <button role="tab" class="${state.foodView === 'alimentos' ? 'active' : ''}" data-action="food-view" data-value="alimentos">Alimentos <span class="muted">${Store.data.foods.length}</span></button>
        <button role="tab" class="${state.foodView === 'bloques' ? 'active' : ''}" data-action="food-view" data-value="bloques">Bloques de equivalencia <span class="muted">${Store.data.foodBlocks.length}</span></button>
      </div>`;
    if (state.foodView === 'bloques') {
      return `
        <div class="page-header">
          <div><h1 class="display">Biblioteca de alimentos</h1><p>Alimentos parecidos en macros y calorías, para pautar dietas por equivalencias</p></div>
          <button class="btn primary pill" data-action="block-new">${U.icon('plus')}Bloque</button>
        </div>
        ${tabs}
        ${renderBlocks()}`;
    }
    return `
      <div class="page-header">
        <div><h1 class="display">Biblioteca de alimentos</h1><p>${plural(Store.data.foods.length, 'alimento', 'alimentos')}</p></div>
        <button class="btn primary pill" data-action="food-new">${U.icon('plus')}Alimento</button>
      </div>
      ${tabs}
      <div class="card">
        <div class="toolbar">
          <input type="search" class="search" id="food-search" placeholder="Buscar alimento o categoría…" value="${esc(state.foodSearch)}" aria-label="Buscar alimentos">
        </div>
        ${cats.length ? `<div class="lib-chips">${chip('todos', 'Todos')}${cats.map((g) => chip(g, g)).join('')}</div>` : ''}
        <div id="food-list">${foodList()}</div>
      </div>`;
  }

  /* ---------- Bloques de equivalencia ---------- */

  const MACROS = {
    protein: { label: 'proteína', short: 'P' },
    carbs: { label: 'hidratos', short: 'C' },
    fat: { label: 'grasa', short: 'G' },
    kcal: { label: 'kcal', short: 'kcal' },
  };
  const BLOCK_FAMILIES = ['Proteínas', 'Hidratos de carbono', 'Grasas', 'Lácteos', 'Otros'];
  const unitOf = (f) => (/ml/.test(f.portion || '') ? 'ml' : 'g');

  /** Gramos de un alimento que aportan la cantidad de referencia del bloque, con sus macros. */
  function equivalence(block, f) {
    const per100 = num(f[block.macro]);
    if (!per100) return null;
    const raw = (Number(block.amount) / per100) * 100;
    const grams = raw >= 20 ? Math.round(raw / 5) * 5 : Math.max(1, Math.round(raw));
    const k = grams / 100;
    const v = (x) => (num(x) === null ? null : num(x) * k);
    return { grams, kcal: v(f.kcal), protein: v(f.protein), carbs: v(f.carbs), fat: v(f.fat) };
  }

  function blockRef(b) {
    const m = MACROS[b.macro] || MACROS.protein;
    return b.macro === 'kcal' ? `${fmtNum(b.amount, 0)} kcal` : `${fmtNum(b.amount)} g de ${m.label}`;
  }

  function blockCard(b) {
    const foods = (b.foodIds || []).map((id) => Store.get('foods', id)).filter(Boolean);
    const rows = foods.map((f) => ({ f, e: equivalence(b, f) })).sort((x, y) => (x.e ? x.e.grams : 1e9) - (y.e ? y.e.grams : 1e9));
    const cell = (v, d = 0) => (v === null || v === undefined ? '—' : fmtNum(v, d));
    return `<details class="card block-card"${state.openBlock === b.id ? ' open' : ''}>
      <summary data-action="block-toggle" data-id="${b.id}">
        <div class="grow">
          <h3>${esc(b.name)}</h3>
          <div class="muted">${plural(foods.length, 'alimento', 'alimentos')} · cantidades para ${esc(blockRef(b))}</div>
        </div>
        <span class="block-chev">${U.icon('down')}</span>
      </summary>
      ${b.notes ? `<p class="muted" style="margin:0 0 10px">${esc(b.notes)}</p>` : ''}
      ${rows.length ? `<div class="table-wrap"><table class="eq-table">
        <thead><tr><th>Alimento</th><th class="num">Cantidad</th><th class="num">kcal</th><th class="num">P</th><th class="num">C</th><th class="num">G</th></tr></thead>
        <tbody>${rows.map(({ f, e }) => `<tr>
          <td><button class="link-btn eq-food" data-action="food-open" data-id="${f.id}">${esc(f.name)}</button></td>
          <td class="num"><strong>${e ? `${e.grams} ${unitOf(f)}` : '—'}</strong></td>
          <td class="num">${e ? cell(e.kcal) : '—'}</td>
          <td class="num">${e ? cell(e.protein, 1) : '—'}</td>
          <td class="num">${e ? cell(e.carbs, 1) : '—'}</td>
          <td class="num">${e ? cell(e.fat, 1) : '—'}</td>
        </tr>`).join('')}</tbody></table></div>` : '<p class="muted">Este bloque aún no tiene alimentos.</p>'}
      <div class="actions" style="margin-top:12px"><button class="btn sm" data-action="block-edit" data-id="${b.id}">${U.icon('edit')}Editar bloque</button></div>
    </details>`;
  }

  function renderBlocks() {
    const blocks = Store.data.foodBlocks;
    if (!blocks.length) return `<div class="card">${empty('apple', '<strong>Todavía no hay bloques.</strong><br>Crea uno con «+ Bloque» y elige los alimentos que son equivalentes.')}</div>`;
    const fams = BLOCK_FAMILIES.filter((f) => blocks.some((b) => (b.family || 'Otros') === f))
      .concat([...new Set(blocks.map((b) => b.family || 'Otros'))].filter((f) => !BLOCK_FAMILIES.includes(f)));
    return `<p class="muted block-intro">Cada bloque reúne alimentos parecidos. La tabla indica cuánto de cada uno equivale a la misma cantidad de referencia (pesos en crudo salvo que el alimento diga otra cosa). Toca un bloque para verlo.</p>
      ${fams.map((fam) => `<h2 class="section-title">${esc(fam)}</h2>${blocks.filter((b) => (b.family || 'Otros') === fam).map(blockCard).join('')}`).join('')}`;
  }

  function blockForm(id) {
    const existing = id ? Store.get('foodBlocks', id) : null;
    const selected = new Set(existing ? existing.foodIds || [] : []);
    const cats = foodCategories();
    const foodsByCat = cats.map((c) => ({ c, items: Store.foods().filter((f) => f.category === c) }));
    const body = `<div class="form-grid">
        <div class="field full"><label for="bf-name">Nombre del bloque *</label><input id="bf-name" value="${esc(existing ? existing.name : '')}" placeholder="Ej.: Aves magras"></div>
        <div class="field"><label for="bf-family">Grupo</label><select id="bf-family">${BLOCK_FAMILIES.map((f) => `<option ${existing && existing.family === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
        <div class="field"><label for="bf-macro">Equivaler por</label><select id="bf-macro">${Object.entries(MACROS).map(([k, m]) => `<option value="${k}" ${existing && existing.macro === k ? 'selected' : ''}>${k === 'kcal' ? 'Calorías' : m.label.charAt(0).toUpperCase() + m.label.slice(1)}</option>`).join('')}</select></div>
        <div class="field"><label for="bf-amount">Cantidad de referencia</label><input id="bf-amount" type="number" step="0.5" min="0.5" value="${esc(existing ? existing.amount : 25)}"><div class="hint">En gramos (o kcal si equivales por calorías).</div></div>
        <div class="field full"><label for="bf-notes">Notas</label><textarea id="bf-notes" rows="2" placeholder="Ej.: pesos en crudo, sin piel…">${esc(existing ? existing.notes || '' : '')}</textarea></div>
        <div class="field full">
          <label>Alimentos del bloque <span class="muted" id="bf-count">(${selected.size})</span></label>
          <input type="search" id="bf-search" placeholder="Buscar alimento…" aria-label="Buscar alimento para el bloque">
          <div class="bf-list">${foodsByCat.filter((g) => g.items.length).map((g) => `<div class="bf-cat" data-cat><div class="bf-cat-name">${esc(g.c)}</div>${g.items.map((f) => `
            <label class="bf-item" data-name="${esc(normalizeText(f.name))}"><input type="checkbox" value="${f.id}" ${selected.has(f.id) ? 'checked' : ''}> <span>${esc(f.name)}</span></label>`).join('')}</div>`).join('')}</div>
        </div>
      </div>`;
    UI.openModal({
      title: existing ? 'Editar bloque' : 'Nuevo bloque',
      body,
      footer: `${existing ? '<button type="button" class="btn danger" id="bf-delete" style="margin-right:auto">Eliminar</button>' : ''}<button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn primary">${existing ? 'Guardar' : 'Crear bloque'}</button>`,
      onOpen: (dlg) => {
        const search = dlg.querySelector('#bf-search');
        search.addEventListener('input', () => {
          const q = normalizeText(search.value);
          dlg.querySelectorAll('.bf-item').forEach((el) => { el.hidden = q && !el.dataset.name.includes(q); });
          dlg.querySelectorAll('[data-cat]').forEach((c) => { c.hidden = ![...c.querySelectorAll('.bf-item')].some((el) => !el.hidden); });
        });
        dlg.querySelector('.bf-list').addEventListener('change', () => { dlg.querySelector('#bf-count').textContent = `(${dlg.querySelectorAll('.bf-item input:checked').length})`; });
        const del = dlg.querySelector('#bf-delete');
        if (del) del.onclick = async () => {
          UI.closeModal();
          const ok = await UI.confirm({ title: 'Eliminar bloque', message: `¿Eliminar el bloque «${esc(existing.name)}»? Los alimentos no se borran.` });
          if (!ok) return;
          Store.remove('foodBlocks', existing.id);
          UI.toast('Bloque eliminado');
          App.render();
        };
        dlg.querySelector('#bf-name').focus();
      },
      onSubmit: () => {
        const dlg = document.getElementById('modal');
        const name = dlg.querySelector('#bf-name').value.trim();
        const amount = Number(dlg.querySelector('#bf-amount').value);
        if (!name) { dlg.querySelector('#bf-name').focus(); UI.toast('Ponle un nombre al bloque'); return; }
        if (!(amount > 0)) { dlg.querySelector('#bf-amount').focus(); UI.toast('Indica la cantidad de referencia'); return; }
        const v = {
          name, amount,
          family: dlg.querySelector('#bf-family').value,
          macro: dlg.querySelector('#bf-macro').value,
          notes: dlg.querySelector('#bf-notes').value.trim(),
          foodIds: [...dlg.querySelectorAll('.bf-item input:checked')].map((i) => i.value),
        };
        if (existing) Store.update('foodBlocks', existing.id, v);
        else { const b = Store.add('foodBlocks', v); state.openBlock = b.id; }
        UI.closeModal();
        UI.toast(existing ? 'Bloque actualizado' : 'Bloque creado');
        App.render();
      },
    });
  }

  function onFoodSearch(value) {
    state.foodSearch = value;
    const el = document.getElementById('food-list');
    if (el) el.innerHTML = foodList();
  }

  function foodForm(id) {
    const existing = id ? Store.get('foods', id) : null;
    if (existing && existing.builtIn) return; // los alimentos de serie no se editan
    UI.form({
      title: existing ? 'Editar alimento' : 'Nuevo alimento',
      fields: [
        { name: 'name', label: 'Nombre', required: true, full: true, placeholder: 'Ej.: Pechuga de pollo, Arroz basmati…' },
        { name: 'category', label: 'Categoría', datalist: FOOD_CATEGORIES, placeholder: 'Ej.: Carnes y aves' },
        { name: 'portion', label: 'Cantidad de referencia', default: '100 g', placeholder: 'Ej.: 100 g, 1 unidad, 1 cucharada' },
        { type: 'section', label: 'Valores para esa cantidad' },
        { name: 'kcal', label: 'Calorías (kcal)', type: 'number', step: '0.1', min: 0 },
        { name: 'protein', label: 'Proteínas (g)', type: 'number', step: '0.1', min: 0 },
        { name: 'carbs', label: 'Carbohidratos (g)', type: 'number', step: '0.1', min: 0 },
        { name: 'fat', label: 'Grasas (g)', type: 'number', step: '0.1', min: 0 },
        { name: 'notes', label: 'Notas', type: 'textarea', placeholder: 'Marca, cómo pesarlo (crudo/cocinado), equivalencias…' },
      ],
      values: existing || (state.foodCat !== 'todos' ? { category: state.foodCat } : {}),
      submitLabel: existing ? 'Guardar' : 'Añadir',
      onDelete: existing ? async () => {
        const ok = await UI.confirm({ title: 'Eliminar alimento', message: `¿Eliminar «${esc(existing.name)}» de la biblioteca?` });
        if (!ok) return;
        Store.removeFood(id);
        UI.toast('Alimento eliminado');
        App.render();
      } : null,
      onSubmit: (v) => {
        if (existing) Store.update('foods', id, v); else Store.add('foods', v);
        UI.toast(existing ? 'Alimento actualizado' : 'Alimento añadido');
        App.render();
      },
    });
  }

  function openFood(id) {
    const f = Store.get('foods', id);
    if (!f) return;
    const cell = (label, v, unit) => `<div class="macro"><span class="macro-val">${num(v) === null ? '—' : esc(fmtNum(v, unit === 'kcal' ? 0 : 1))}${num(v) === null ? '' : ` <small>${unit}</small>`}</span><span class="macro-label">${label}</span></div>`;
    UI.openModal({
      title: f.name,
      body: `<div class="lib-detail">
        <div class="actions" style="margin-bottom:14px">${f.category ? badge(f.category, 'primary') : ''}${f.portion ? badge(`Por ${f.portion}`) : ''}</div>
        <div class="macros">${cell('Calorías', f.kcal, 'kcal')}${cell('Proteínas', f.protein, 'g')}${cell('Carbohidratos', f.carbs, 'g')}${cell('Grasas', f.fat, 'g')}</div>
        ${f.notes ? `<p class="lib-detail-desc" style="margin-top:14px">${esc(f.notes)}</p>` : ''}
        ${Store.blocksForFood(f.id).length ? `<p class="muted" style="margin:14px 0 0">Bloques: ${Store.blocksForFood(f.id).map((b) => { const e = equivalence(b, f); return `<strong>${esc(b.name)}</strong>${e ? ` (${e.grams} ${unitOf(f)} = ${esc(blockRef(b))})` : ''}`; }).join(' · ')}</p>` : ''}
      </div>`,
      footer: `${f.builtIn ? '<span style="margin-right:auto"></span>' : `<button type="button" class="btn" id="food-edit" style="margin-right:auto">${U.icon('edit')}Editar</button>`}<button type="button" class="btn primary" data-close>Cerrar</button>`,
      onOpen: () => { const b = document.getElementById('food-edit'); if (b) b.onclick = () => foodForm(id); },
    });
  }

  /* ---------- Elegir ejercicio de la biblioteca para una rutina ---------- */

  /** Cliente, rutina y día para los que se está eligiendo ejercicio (o null). */
  function pickContext() {
    const p = state.pick;
    if (!p) return null;
    const client = Store.get('clients', p.client);
    const routine = Store.routineFor(p.client);
    const day = routine && findDay(routine, p.day);
    return client && day ? { client, routine, day } : null;
  }

  function startPick(clientId, dayId) {
    state.pick = { client: clientId, day: dayId };
    state.libSearch = '';
    location.hash = '#/biblioteca';
  }

  function backToRoutine(clientId) {
    state.pick = null;
    state.clientTab = 'rutina';
    state.keepTab = true;
    location.hash = `#/clientes/${clientId}`;
  }

  /** Añade el ejercicio de la biblioteca al día elegido (con sus series, repeticiones, descanso y notas). */
  function addFromLibrary(libId) {
    const pick = pickContext();
    const lib = Store.get('library', libId);
    if (!pick || !lib) return;
    const notes = [lib.tempo ? `Tempo: ${lib.tempo}` : '', lib.description].filter(Boolean).join('\n');
    const ex = { id: U.uid(), libraryId: lib.id, name: lib.name, sets: lib.sets || '', reps: lib.reps || '', load: '', rest: lib.rest || '', notes };
    (pick.day.exercises = pick.day.exercises || []).push(ex);
    saveRoutine(pick.routine);
    const { client, day } = pick;
    backToRoutine(client.id);
    setTimeout(() => UI.toast(`«${lib.name}» añadido a ${day.name}`, {
      label: 'Editar',
      onClick: () => { const r = Store.routineFor(client.id); const d = r && findDay(r, day.id); const e = d && d.exercises.find((x) => x.id === ex.id); if (e) exerciseForm(client, r, d, e); },
    }), 50);
  }

  /* =========================================================
   * Cuestionario para conocer al cliente (se envía por WhatsApp)
   * ======================================================= */

  const DEFAULT_QUESTIONS = [
    'Nombre completo y edad',
    'Altura (cm) y peso actual (kg)',
    '¿Cuál es tu objetivo principal? (perder grasa, ganar músculo, ganar fuerza, mejorar tu salud…)',
    '¿Tienes alguna lesión, dolor o problema de salud? ¿Tomas alguna medicación?',
    '¿Qué experiencia tienes entrenando? ¿Entrenas actualmente? ¿Qué tipo de entrenamiento?',
    '¿Cuántos días a la semana puedes entrenar y cuánto tiempo por sesión?',
    '¿Dónde vas a entrenar (gimnasio, casa…) y qué material tienes?',
    '¿A qué te dedicas? ¿Tu trabajo es activo o pasas muchas horas sentado?',
    '¿Cuántas horas duermes de media y cómo descansas?',
    '¿Cómo es tu alimentación en un día normal? (comidas, horarios y qué sueles comer)',
    '¿Tienes alergias o intolerancias? ¿Hay alimentos que no te gusten o no comas?',
    '¿Cuánta agua bebes al día? ¿Consumes alcohol?',
    '¿Tomas algún suplemento?',
    '¿Hay algo más que quieras contarme?',
  ];

  const questions = () => (Array.isArray(Store.settings.questionnaire) && Store.settings.questionnaire.length ? Store.settings.questionnaire : DEFAULT_QUESTIONS);

  function questionnaireText(c) {
    const coach = (Store.settings.trainerName || 'David Orihuela').split(' ')[0];
    return [
      `Hola ${c.name.split(' ')[0]}, soy ${coach}. Para preparar tu plan necesito conocerte un poco mejor. ¿Me respondes a estas preguntas? Puedes contestar en un solo mensaje poniendo el número de cada pregunta.`,
      '',
      ...questions().map((q, i) => `${i + 1}. ${q}`),
      '',
      '¡Muchas gracias!',
    ].join('\n');
  }

  function sendQuestionnaire(clientId) {
    const c = Store.get('clients', clientId);
    if (!c) return;
    const url = `${U.waLink(c.phone) || 'https://wa.me/'}?text=${encodeURIComponent(questionnaireText(c))}`;
    window.open(url, '_blank', 'noopener');
    const q = Object.assign({}, c.questionnaire || {}, { sentAt: today() });
    Store.update('clients', clientId, { questionnaire: q });
    App.render();
    UI.toast('Cuestionario preparado en WhatsApp');
  }

  /** Envía el cuestionario como enlace: el cliente lo rellena y las respuestas llegan solas a su ficha. */
  async function sendQuestionnaireLink(clientId) {
    const c = Store.get('clients', clientId);
    if (!c) return;
    if (location.protocol === 'file:') {
      UI.toast('Abre la app desde tu web publicada para poder enviar enlaces');
      return;
    }
    if (!window.Sync || !Sync.state.user) {
      const ok = await UI.confirm({
        title: 'Inicia sesión con Google',
        message: 'Para enviar el cuestionario como enlace, la app tiene que estar conectada a la nube (sincronización con Google). Así las respuestas del cliente pueden llegar a su ficha.',
        confirmLabel: 'Iniciar sesión', danger: false,
      });
      if (ok && window.Sync) Sync.signIn();
      return;
    }
    const prev = c.questionnaire || {};
    const reuse = prev.linkToken && !prev.answeredAt;
    const token = reuse ? prev.linkToken : [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    // Abrimos la ventana ya (si no, el móvil la bloquea al esperar a la nube).
    const win = window.open('about:blank', '_blank');
    try {
      if (!reuse) {
        await Sync.createQuestionnaire(token, {
          clientName: c.name.split(' ')[0],
          coach: (Store.settings.trainerName || 'David Orihuela').split(' ')[0],
          questions: questions(),
        });
      }
    } catch (e) {
      console.error(e);
      if (win) win.close();
      UI.openModal({
        title: 'Falta un permiso en Firebase',
        body: `<p style="margin-top:0">No se ha podido crear el enlace. Lo más probable es que falte añadir la regla de los cuestionarios en la consola de Firebase (Firestore Database → Reglas). Tienes el texto exacto en el archivo <strong>firestore.rules</strong> del proyecto.</p><p class="muted" style="margin-bottom:0">Detalle: ${esc(e.code || e.message || e)}</p>`,
        footer: '<button type="button" class="btn primary" data-close>Entendido</button>',
      });
      return;
    }
    const url = new URL(`cuestionario.html?t=${token}`, location.href.split('#')[0]).href;
    const coach = (Store.settings.trainerName || 'David Orihuela').split(' ')[0];
    const text = `Hola ${c.name.split(' ')[0]}, soy ${coach}. Para preparar tu plan necesito conocerte un poco mejor. Rellena este cuestionario, son solo unos minutos:\n${url}\n¡Muchas gracias!`;
    const wa = `${U.waLink(c.phone) || 'https://wa.me/'}?text=${encodeURIComponent(text)}`;
    if (win) win.location.href = wa; else window.open(wa, '_blank');
    const fresh = reuse ? prev : { items: [], answeredAt: '', reviewedAt: '' };
    Store.update('clients', clientId, { questionnaire: Object.assign({}, prev, fresh, { sentAt: today(), linkToken: token, via: 'enlace' }) });
    App.render();
    UI.toast('Enlace preparado en WhatsApp: las respuestas llegarán solas a su ficha');
  }

  /** Mira en la nube si algún cliente ha respondido su cuestionario por enlace. */
  let checkingLinks = false;
  async function checkQuestionnaireLinks(onlyClientId, manual) {
    if (checkingLinks || !window.Sync || !Sync.state.user) {
      if (manual) UI.toast('Inicia sesión con Google (Ajustes) para recibir las respuestas');
      return;
    }
    checkingLinks = true;
    let found = 0;
    try {
      const pending = Store.data.clients.filter((c) => c.questionnaire && c.questionnaire.linkToken && !c.questionnaire.answeredAt && (!onlyClientId || c.id === onlyClientId));
      for (const c of pending) {
        const doc = await Sync.fetchQuestionnaire(c.questionnaire.linkToken).catch(() => null);
        if (!doc || !doc.answeredAt || !Array.isArray(doc.answers)) continue;
        const qs = Array.isArray(doc.questions) ? doc.questions : questions();
        const items = qs.map((q, i) => ({ q, a: (doc.answers[i] || '').trim() }));
        const answeredAt = doc.answeredAt && doc.answeredAt.toDate ? U.toISODate(doc.answeredAt.toDate()) : today();
        Store.update('clients', c.id, { questionnaire: Object.assign({}, c.questionnaire, { items, answeredAt, reviewedAt: '' }) });
        found++;
        UI.toast(`${c.name.split(' ')[0]} ha respondido el cuestionario`);
      }
    } finally {
      checkingLinks = false;
    }
    if (found) App.render();
    else if (manual) UI.toast('Todavía no ha respondido');
  }

  /** Reparte una respuesta pegada de WhatsApp («1. … 2. …») entre las preguntas. */
  function splitAnswers(text) {
    const out = {};
    let current = null;
    for (const line of String(text || '').split(/\r?\n/)) {
      const m = line.match(/^\s*\*?(\d{1,2})\s*[.)\-:ºª]+\s*\*?\s*(.*)$/);
      if (m) { current = Number(m[1]) - 1; out[current] = m[2].trim(); }
      else if (current !== null && line.trim()) out[current] = `${out[current] ? out[current] + '\n' : ''}${line.trim()}`;
    }
    return out;
  }

  function questionnaireForm(clientId) {
    const c = Store.get('clients', clientId);
    if (!c) return;
    const saved = (c.questionnaire && c.questionnaire.items) || [];
    const qs = saved.length ? saved.map((x) => x.q) : questions();
    const values = {};
    qs.forEach((q, i) => { values[`q${i}`] = (saved[i] && saved[i].a) || ''; });
    UI.form({
      title: `Respuestas de ${c.name.split(' ')[0]}`,
      fields: [
        { name: 'paste', label: 'Pega aquí su respuesta de WhatsApp (opcional)', type: 'textarea', placeholder: '1. …\n2. …', hint: 'Si contestó con el número de cada pregunta, se repartirá solo en las casillas de abajo. Revísalo antes de guardar.' },
        { type: 'section', label: 'Respuestas' },
        ...qs.map((q, i) => ({ name: `q${i}`, label: `${i + 1}. ${q}`, type: 'textarea' })),
      ],
      values,
      submitLabel: 'Guardar respuestas',
      onReady: (dlg) => {
        const paste = dlg.querySelector('#f-paste');
        paste.addEventListener('input', () => {
          const parts = splitAnswers(paste.value);
          let n = 0;
          Object.entries(parts).forEach(([i, a]) => { const el = dlg.querySelector(`#f-q${i}`); if (el) { el.value = a; n++; } });
          paste.closest('.field').querySelector('.hint').textContent = n
            ? `Repartidas ${n} de ${qs.length} respuestas. Revísalas abajo antes de guardar.`
            : 'No he encontrado respuestas numeradas: copia cada respuesta en su casilla.';
        });
      },
      onSubmit: (v) => {
        const items = qs.map((q, i) => ({ q, a: (v[`q${i}`] || '').trim() }));
        const answered = items.some((x) => x.a);
        const prev = c.questionnaire || {};
        Store.update('clients', clientId, { questionnaire: Object.assign({}, prev, { items, answeredAt: answered ? (prev.answeredAt || today()) : '', reviewedAt: answered ? (prev.reviewedAt || today()) : '' }) });
        UI.toast(answered ? 'Respuestas guardadas' : 'Cuestionario sin respuestas');
        App.render();
      },
    });
  }

  function questionnaireCard(c) {
    const q = c.questionnaire || {};
    const answered = (q.items || []).filter((x) => x.a);
    const isNew = answered.length && q.linkToken && !q.reviewedAt;
    const status = answered.length
      ? (isNew ? badge('Nuevo · sin revisar', 'warning') : badge('Respondido', 'success'))
      : q.sentAt ? badge('Pendiente de respuesta', 'info') : badge('Sin enviar', 'warning');
    const meta = [q.sentAt ? `${q.linkToken ? 'Enlace enviado' : 'Enviado'} el ${fmtDate(q.sentAt)}` : '', q.answeredAt ? `respondido el ${fmtDate(q.answeredAt)}` : (q.linkToken ? 'las respuestas aparecerán aquí cuando lo rellene' : '')].filter(Boolean).join(' · ');
    return `<section class="card questionnaire-card">
      <div class="card-header"><h2>Cuestionario</h2>${status}</div>
      <p class="muted" style="margin:0 0 14px">${meta ? esc(meta.charAt(0).toUpperCase() + meta.slice(1)) + '.' : `Envíale el cuestionario para conocer su objetivo, salud, experiencia, disponibilidad y hábitos.`}</p>
      <div class="actions">
        <button class="btn wa-btn" data-action="send-questionnaire-link" data-client="${c.id}">${U.icon('message')}${q.linkToken && !answered.length ? 'Reenviar enlace por WhatsApp' : 'Enviar enlace por WhatsApp'}</button>
        ${q.linkToken && !answered.length ? `<button class="btn" data-action="check-questionnaire" data-client="${c.id}">${U.icon('download')}Comprobar respuestas</button>` : ''}
        <button class="btn" data-action="questionnaire-answers" data-client="${c.id}">${U.icon('edit')}${answered.length ? 'Editar respuestas' : 'Apuntar a mano'}</button>
        ${isNew ? `<button class="btn primary" data-action="review-questionnaire" data-client="${c.id}">${U.icon('check')}Marcar como revisado</button>` : ''}
      </div>
      <p class="q-alt"><button class="link-btn" data-action="send-questionnaire" data-client="${c.id}">o enviar las preguntas como texto en WhatsApp</button></p>
      ${answered.length ? `<details class="q-answers"${state.showAnswers ? ' open' : ''}>
        <summary data-action="toggle-answers">Ver respuestas (${answered.length} de ${(q.items || []).length})</summary>
        <dl>${(q.items || []).map((x, i) => `<dt>${i + 1}. ${esc(x.q)}</dt><dd>${x.a ? esc(x.a) : '<span class="muted">Sin respuesta</span>'}</dd>`).join('')}</dl>
      </details>` : ''}
    </section>`;
  }

  function saveQuestionnaire(form) {
    const list = form.elements.questions.value.split(/\r?\n/).map((x) => x.replace(/^\s*\d{1,2}\s*[.)\-:]\s*/, '').trim()).filter(Boolean);
    Store.settings.questionnaire = list.length ? list : DEFAULT_QUESTIONS.slice();
    Store.save();
    UI.toast('Preguntas del cuestionario guardadas');
    App.render();
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
            <div class="field full"><label for="s-defaultRate">Importe habitual por defecto</label><input id="s-defaultRate" name="defaultRate" type="number" step="0.01" min="0" value="${esc(s.defaultRate)}"></div>
            <div class="full"><button type="submit" class="btn primary">Guardar preferencias</button></div>
          </form>
          <hr style="border:0;border-top:1px solid var(--border);margin:20px 0">
          <h2 style="margin-bottom:6px">Avisos de pago</h2>
          <p class="muted" style="margin:0 0 12px">Te aviso ${Store.REMIND_DAYS} días antes de que a un cliente le toque pagar: en el resumen y, si lo activas, con una notificación del navegador.</p>
          ${notificationStatus() ? `<p style="margin:0 0 12px">${esc(notificationStatus())}</p>` : ''}
          ${canNotify() && Notification.permission === 'default' ? `<button class="btn" data-action="enable-notifications">${U.icon('bell')} Activar notificaciones</button>` : ''}
        </section>
        <section class="card">
          <div class="card-header"><h2>Tus datos</h2></div>
          ${window.Sync ? Sync.settingsHTML() : `<p class="muted" style="margin-top:0">Cargando la sincronización…</p>`}
          ${Store.storageOk ? '' : `<div class="alert">${U.icon('alert')}<div>El navegador no permite guardar datos (¿modo privado?). Los cambios se perderán al cerrar.</div></div>`}
          <p>${plural(d.clients.length, 'cliente', 'clientes')} · ${plural(d.measurements.length, 'registro de peso', 'registros de peso')} · ${plural(d.payments.length, 'pago', 'pagos')} · ${plural(d.photos.length, 'foto', 'fotos')} · ${plural(d.tasks.length, 'tarea', 'tareas')}</p>
          <p class="muted" style="font-size:.85rem">La copia de seguridad (Exportar copia) incluye clientes, pesos, pagos y tareas, pero no las fotos.</p>
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
      </div>
      <section class="card" style="margin-top:18px">
        <div class="card-header"><h2>Cuestionario para clientes</h2><button class="btn sm" data-action="questionnaire-reset">Restaurar preguntas básicas</button></div>
        <p class="muted" style="margin:0 0 12px">Estas son las preguntas que se envían por WhatsApp desde la ficha de cada cliente. Escribe una pregunta por línea; se numeran solas.</p>
        <form id="questionnaire-form">
          <textarea name="questions" rows="${Math.max(8, questions().length + 1)}" aria-label="Preguntas del cuestionario">${esc(questions().join('\n'))}</textarea>
          <div class="actions" style="margin-top:10px"><button type="submit" class="btn primary">Guardar preguntas</button></div>
        </form>
      </section>`;
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
    const cols = [['name', 'Nombre'], ['email', 'Email'], ['phone', 'Teléfono'], ['birthDate', 'Nacimiento'], ['status', 'Estado'], ['rate', 'Importe habitual'], ['nextDue', 'Próximo pago'], ['startDate', 'Alta'], ['health', 'Salud'], ['notes', 'Notas']];
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
    // due = días hasta el próximo pago (negativo = vencido)
    const people = [
      { name: 'Laura Martínez', email: 'laura@example.com', phone: '+34 600 111 222', birthDate: '1990-04-12', gender: 'Mujer', gain: false, rate: 60, height: 165, health: 'Molestias en la rodilla izquierda: evitar impacto alto.', w: 72, fat: 30, months: 5, due: 15, lastM: 3 },
      { name: 'Carlos Ruiz', email: 'carlos@example.com', phone: '+34 600 333 444', birthDate: '1985-09-30', gender: 'Hombre', gain: true, rate: 80, height: 180, w: 78, fat: 18, months: 4, due: -4, lastM: 6 },
      { name: 'Ana Gómez', email: 'ana@example.com', phone: '+34 600 555 666', birthDate: '1972-01-20', gender: 'Mujer', gain: false, rate: 50, height: 158, health: 'Hipertensión controlada con medicación.', w: 68, fat: 34, months: 3, due: 3, lastM: 20 },
      { name: 'Javier López', email: 'javier@example.com', phone: '+34 600 777 888', birthDate: '1998-06-05', gender: 'Hombre', gain: false, rate: 60, height: 176, w: 74, fat: 15, months: 2, due: 25, lastM: 2 },
      { name: 'Marta Sánchez', email: 'marta@example.com', phone: '+34 600 999 000', birthDate: '1988-11-15', gender: 'Mujer', gain: false, rate: 60, height: 170, w: 63, fat: 24, months: 4, due: -20, status: 'pausa', lastM: 40 },
    ];
    people.forEach((p) => {
      const nextDue = U.addDays(t, p.due);
      const c = Store.add('clients', {
        name: p.name, email: p.email, phone: p.phone, birthDate: p.birthDate, gender: p.gender,
        rate: p.rate, nextDue, lastReview: '', height: p.height, health: p.health || '', notes: '', startDate: U.addMonths(nextDue, -p.months), status: p.status || 'activo',
      });
      // Un pago al mes hasta la fecha del próximo pago
      for (let i = p.months; i >= 1; i--) {
        const date = U.addMonths(nextDue, -i);
        if (date > t) continue;
        Store.add('payments', { clientId: c.id, date, amount: p.rate, concept: 'Pago', method: i % 2 ? 'Bizum' : 'Transferencia', status: 'pagado', nextDue: U.addMonths(date, 1) });
      }
      // Revisiones cada 2 semanas
      const total = Math.max(2, Math.floor((p.months * 30 - p.lastM) / 14) + 1);
      for (let i = 0; i < total; i++) {
        const trend = p.gain ? 0.4 : -0.6;
        Store.add('measurements', {
          clientId: c.id, date: U.addDays(t, -p.lastM - (total - 1 - i) * 14),
          weight: Math.round((p.w + trend * i + (i % 2 ? 0.2 : 0)) * 10) / 10,
          notes: '',
        });
      }
    });
    UI.toast('Datos de ejemplo cargados');
    App.render();
  }

  async function resetData() {
    const ok = await UI.confirm({ title: 'Borrar todos los datos', message: 'Se eliminarán <strong>todos</strong> los clientes, registros de peso y pagos. Te recomendamos exportar una copia antes. ¿Continuar?', confirmLabel: 'Borrar todo' });
    if (!ok) return;
    Store.reset();
    await Photos.clearAll();
    UI.toast('Datos borrados');
    App.render();
  }

  /* ---------- Notificaciones del navegador ---------- */
  const NOTIFY_KEY = 'entrenapro:notified';
  const canNotify = () => 'Notification' in window;

  /** Una vez al día, avisa de los pagos que vencen en los próximos días (si se dio permiso). */
  function notifyDue(force) {
    try {
      if (!canNotify() || Notification.permission !== 'granted') return;
      if (!force && localStorage.getItem(NOTIFY_KEY) === today()) return;
      const due = computeAlerts().filter((a) => a.kind === 'pago' || a.kind === 'revision');
      if (!due.length && !force) return;
      const body = due.length
        ? due.slice(0, 6).map((a) => `${a.c.name}: ${a.kind === 'pago' ? dueText(a.di) : reviewText(a.ri)}`).join('\n')
        : `Nadie tiene que pagar en los próximos ${Store.REMIND_DAYS} días.`;
      new Notification(due.length ? `${plural(due.length, 'aviso', 'avisos')} de pagos y revisiones` : 'Avisos activados', { body, tag: 'pagos' });
      localStorage.setItem(NOTIFY_KEY, today());
    } catch (e) { /* sin notificaciones disponibles */ }
  }

  async function enableNotifications() {
    if (!canNotify()) { UI.toast('Este navegador no permite notificaciones'); return; }
    const res = await Notification.requestPermission();
    if (res === 'granted') { UI.toast('Notificaciones activadas'); notifyDue(true); }
    else UI.toast('No se han permitido las notificaciones');
    App.render();
  }

  function notificationStatus() {
    if (!canNotify()) return 'Este navegador no permite notificaciones.';
    if (Notification.permission === 'granted') return 'Activadas: te avisaré al abrir la app cuando a alguien le toque pagar.';
    if (Notification.permission === 'denied') return 'Bloqueadas. Puedes permitirlas en los ajustes del navegador para esta página.';
    return '';
  }

  /* =========================================================
   * Acciones (delegadas desde app.js)
   * ======================================================= */

  const actions = {
    'new-client': () => openClientForm(),
    'edit-client': (d) => openClientForm(d.id),
    'delete-client': (d) => deleteClient(d.id),
    'set-status': (d) => setClientStatus(d.id, d.value),
    'new-measurement': (d) => openMeasurementForm(null, d.client),
    'edit-measurement': (d) => openMeasurementForm(d.id),
    'new-payment': (d) => openPaymentForm(null, d.client ? { clientId: d.client } : {}),
    'edit-payment': (d) => openPaymentForm(d.id),
    'pay-open': (d) => {
      state.openPay = state.openPay === d.client ? null : d.client;
      App.render();
      if (state.openPay) {
        const input = document.getElementById(`pa-${d.client}`);
        if (input) { input.focus({ preventScroll: true }); input.closest('.pay-item').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      }
    },
    'pay-close': () => { state.openPay = null; App.render(); },
    'pay-months': (d, el) => {
      const form = el.closest('.pay-form');
      form.elements.nextDue.value = d.date;
      form.querySelector('.pay-next').textContent = fmtDate(d.date);
      form.querySelectorAll('.chip').forEach((b) => { b.classList.toggle('active', b === el); b.setAttribute('aria-pressed', String(b === el)); });
    },
    'mark-paid': (d) => markPaid(d.id),
    'client-tab': (d) => { state.clientTab = d.value; App.render(); },
    'open-client-tab': (d) => { state.clientTab = d.value; state.keepTab = true; location.hash = `#/clientes/${d.client}`; },
    'toggle-task': (d) => toggleTask(d.id),
    'lib-new': () => libraryForm(),
    'food-new': () => foodForm(),
    'food-open': (d) => openFood(d.id),
    'food-cat': (d) => { state.foodCat = d.value; App.render(); },
    'food-view': (d) => { state.foodView = d.value; App.render(); },
    'block-new': () => blockForm(),
    'block-edit': (d) => blockForm(d.id),
    'block-toggle': (d, el) => { const det = el.closest('details'); det.open = !det.open; state.openBlock = det.open ? d.id : null; },
    'lib-open': (d) => openLibraryExercise(d.id),
    'lib-group': (d) => { state.libGroup = d.value; App.render(); },
    'routine-create': (d) => routineForm(Store.get('clients', d.client)),
    'routine-edit': (d) => routineForm(Store.get('clients', d.client), Store.routineFor(d.client)),
    'routine-copy': (d) => copyRoutine(Store.get('clients', d.client)),
    'day-add': (d) => dayForm(Store.get('clients', d.client), Store.routineFor(d.client)),
    'day-edit': (d) => { const r = Store.routineFor(d.client); dayForm(Store.get('clients', d.client), r, findDay(r, d.day)); },
    'day-move': (d) => { const r = Store.routineFor(d.client); moveItem(r.days, d.day, Number(d.dir)); saveRoutine(r); },
    'ex-add': (d) => startPick(d.client, d.day),
    'pick-cancel': () => { const p = state.pick; if (p) backToRoutine(p.client); },
    'pick-manual': () => { const p = pickContext(); if (!p) return; const { client, routine, day } = p; backToRoutine(client.id); setTimeout(() => exerciseForm(client, routine, day), 50); },
    'ex-edit': (d) => { const r = Store.routineFor(d.client); const day = findDay(r, d.day); exerciseForm(Store.get('clients', d.client), r, day, day.exercises.find((x) => x.id === d.ex)); },
    'ex-move': (d) => { const r = Store.routineFor(d.client); moveItem(findDay(r, d.day).exercises, d.ex, Number(d.dir)); saveRoutine(r); },
    'complete-review': (d) => completeReview(d.client),
    'edit-task': (d) => editTask(d.id),
    'toggle-done-list': (d, el) => { const det = el.closest('details'); det.open = !det.open; state.showDone = det.open; },
    'open-photo': (d) => openPhoto(d.id),
    'client-filter': (d) => { state.clientFilter = d.value; App.render(); },
    'pay-filter': (d) => { state.payFilter = d.value; App.render(); },
    export: () => { download(`david-orihuela-coach-copia-${today()}.json`, Store.exportJSON(), 'application/json'); UI.toast('Copia exportada'); },
    'export-csv': () => exportCSV(),
    'sample-data': () => loadSample(),
    'enable-notifications': () => enableNotifications(),
    'send-questionnaire': (d) => sendQuestionnaire(d.client),
    'send-questionnaire-link': (d) => sendQuestionnaireLink(d.client),
    'diet-targets': (d) => dietTargetsForm(d.client),
    'open-answers': (d) => {
      state.clientTab = 'resumen';
      state.keepTab = true;
      state.showAnswers = true;
      location.hash = `#/clientes/${d.client}`;
      setTimeout(() => document.querySelector('.questionnaire-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    },
    'review-questionnaire': (d) => {
      const c = Store.get('clients', d.client);
      if (!c || !c.questionnaire) return;
      Store.update('clients', c.id, { questionnaire: Object.assign({}, c.questionnaire, { reviewedAt: today() }) });
      App.render();
      UI.toast(`Cuestionario de ${c.name.split(' ')[0]} revisado`, { label: 'Deshacer', onClick: () => { const cur = Store.get('clients', c.id); Store.update('clients', c.id, { questionnaire: Object.assign({}, cur.questionnaire, { reviewedAt: '' }) }); App.render(); } });
    },
    'check-questionnaire': (d) => checkQuestionnaireLinks(d.client, true),
    'questionnaire-answers': (d) => questionnaireForm(d.client),
    'toggle-answers': (d, el) => { const det = el.closest('details'); det.open = !det.open; state.showAnswers = det.open; },
    'questionnaire-reset': async () => {
      const ok = await UI.confirm({ title: 'Restaurar preguntas', message: 'Se sustituirán tus preguntas por las del cuestionario básico.', confirmLabel: 'Restaurar', danger: false });
      if (!ok) return;
      Store.settings.questionnaire = DEFAULT_QUESTIONS.slice();
      Store.save();
      UI.toast('Preguntas restauradas');
      App.render();
    },
    'reset-data': () => resetData(),
  };

  function onClientSearch(value) {
    state.clientSearch = value;
    const el = document.getElementById('clients-table');
    if (el) el.innerHTML = clientsTable();
  }

  window.Views = {
    state, actions, renderPanel, renderClients, renderClient, renderPayments, renderSettings,
    renderLibrary, onLibrarySearch, renderFoods, onFoodSearch, submitDietForm, saveQuestionnaire, checkQuestionnaireLinks,
    saveSettings, importFile, onClientSearch, computeAlerts, submitPayForm, submitTaskForm, uploadPhotos, notifyDue, greeting, greetingText,
  };
})();
