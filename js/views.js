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
  const dueBadge = (di) => (di && di.first ? badge('Pendiente de pago', 'danger') : di ? badge(DUE_STATUS[di.status].label, DUE_STATUS[di.status].badge) : badge('Sin fecha'));
  /** Texto del próximo pago: «Le toca pagar en 3 días», «Vencido hace 2 días»… */
  function dueText(di) {
    if (!di) return 'Sin fecha de próximo pago';
    if (di.first) return di.days === 0 ? 'Nuevo cliente · pendiente del primer pago' : `Nuevo cliente · pendiente del primer pago desde el ${U.fmtDateShort(di.date)}`;
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
      { name: 'height', label: 'Altura (cm)', type: 'number', step: '0.5', min: 100, max: 230, placeholder: 'Ej.: 175' },
      { type: 'section', label: 'Asesoría' },
      { name: 'startDate', label: 'Fecha de alta', type: 'date', default: today(), hint: 'A los 15 días toca el seguimiento y al mes la revisión mensual, cada mes.' },
      { name: 'status', label: 'Estado', type: 'select', options: Object.entries(CLIENT_STATUS).map(([value, s]) => ({ value, label: s.label })), default: 'activo' },
      { name: 'rate', label: `Importe habitual (${Store.settings.currency})`, type: 'number', step: '0.01', min: 0, default: Store.settings.defaultRate, hint: 'Se propone al registrar un pago.' },
      { name: 'nextDue', label: 'Próximo pago', type: 'date', hint: `Cae el mismo día del mes que la fecha de alta (se ajusta solo). Vacío en un cliente nuevo: queda pendiente de pago desde el alta hasta que marques su primer pago. Te avisaré ${Store.REMIND_DAYS} días antes.` },
      { type: 'section', label: 'Salud y notas' },
      { name: 'health', label: 'Lesiones, patologías, medicación o alergias', type: 'textarea', placeholder: 'Ej.: lesión de rodilla derecha, hipertensión controlada, alergia al marisco…', hint: 'Lo que escribas aquí te saldrá siempre en rojo arriba del perfil.' },
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
        if (!existing && !v.nextDue) v.nextDue = v.startDate && v.startDate > today() ? v.startDate : today(); // nuevo: pendiente de pago desde el alta
        else if (v.startDate) v.nextDue = v.nextDue ? Store.snapToStart(v.startDate, v.nextDue) : Store.startOnOrAfter(v.startDate, today());
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

  /** Músculo de un ejercicio de la rutina: el suyo o el de la biblioteca. */
  const exGroup = (ex) => ex.group || ((ex.libraryId && Store.get('library', ex.libraryId)) || {}).group || 'Otros';
  /** Músculos de un día: los elegidos y los de los ejercicios que ya tenga, en el orden de la biblioteca. */
  function dayMuscles(d) {
    const set = new Set([...(d.muscles || []), ...(d.exercises || []).map(exGroup)]);
    const order = libraryGroups();
    return [...set].sort((a, b) => ((order.indexOf(a) + 1) || 99) - ((order.indexOf(b) + 1) || 99));
  }
  const dayCountPicker = (c, n) => `<div class="day-count" role="group" aria-label="Días de entrenamiento a la semana">
      ${[1, 2, 3, 4, 5, 6, 7].map((k) => `<button type="button" class="day-count-btn${k === n ? ' active' : ''}" data-action="routine-days" data-client="${c.id}" data-value="${k}" aria-pressed="${k === n}">${k}</button>`).join('')}
    </div>`;

  function exerciseRow(c, d, ex, list) {
    const i = list.indexOf(ex);
    return `<li>
        <span class="ex-num">${i + 1}</span>
        ${exThumb(ex.libraryId && Store.get('library', ex.libraryId), 'sm')}
        <div class="grow">
          <div class="title">${esc(ex.name)}</div>
          ${exerciseMeta(ex) ? `<div class="ex-meta">${esc(exerciseMeta(ex))}</div>` : ''}
          ${ex.notes ? `<div class="meta ex-notes">${esc(ex.notes)}</div>` : ''}
        </div>
        <div class="ex-actions">
          ${i > 0 ? `<button class="icon-btn" data-action="ex-move" data-client="${c.id}" data-day="${d.id}" data-ex="${ex.id}" data-dir="-1" aria-label="Subir ejercicio">${U.icon('up')}</button>` : ''}
          ${i < list.length - 1 ? `<button class="icon-btn" data-action="ex-move" data-client="${c.id}" data-day="${d.id}" data-ex="${ex.id}" data-dir="1" aria-label="Bajar ejercicio">${U.icon('down')}</button>` : ''}
          <button class="icon-btn" data-action="ex-edit" data-client="${c.id}" data-day="${d.id}" data-ex="${ex.id}" aria-label="Editar ejercicio">${U.icon('edit')}</button>
        </div>
      </li>`;
  }

  function clientRoutine(c) {
    const r = Store.routineFor(c.id);
    if (!r) {
      return `<section class="card routine-start">
          <h2>¿Cuántos días va a entrenar ${esc(c.name.split(' ')[0])}?</h2>
          <p class="muted">Elige los días a la semana. Después, en cada día marcas los músculos y eliges sus ejercicios de la biblioteca.</p>
          ${dayCountPicker(c, 0)}
        </section>`;
    }
    const days = r.days || [];
    const groups = libraryGroups();
    return `
      <section class="card routine-head">
        <div class="card-header">
          <div>
            <h2>${esc(r.name || 'Rutina')}</h2>
            <div class="muted" style="font-size:.85rem">Actualizada el ${esc(fmtDate((r.updatedAt || r.createdAt || '').slice(0, 10) || today()))} · ${plural(days.reduce((n, d) => n + (d.exercises || []).length, 0), 'ejercicio', 'ejercicios')}</div>
          </div>
          <div class="actions">
            <a class="btn sm wa-btn" href="${routineWaLink(c, r)}" target="_blank" rel="noopener">${U.icon('message')}Enviar por WhatsApp</a>
            <button class="btn sm" data-action="routine-copy" data-client="${c.id}">${U.icon('file')}Copiar</button>
            <button class="btn sm" data-action="routine-edit" data-client="${c.id}">${U.icon('edit')}Editar</button>
          </div>
        </div>
        <div class="day-count-row"><span class="day-count-label">Días de entrenamiento</span>${dayCountPicker(c, days.length)}</div>
        ${r.notes ? `<p class="routine-notes">${esc(r.notes)}</p>` : ''}
      </section>
      ${days.map((d, di) => {
        const muscles = dayMuscles(d);
        const list = d.exercises || [];
        return `
        <section class="card routine-day">
          <div class="card-header">
            <h2><span class="day-num">${di + 1}</span>${esc(d.name || `Día ${di + 1}`)}</h2>
            <div class="actions">
              ${di > 0 ? `<button class="icon-btn" data-action="day-move" data-client="${c.id}" data-day="${d.id}" data-dir="-1" aria-label="Subir día" title="Subir">${U.icon('up')}</button>` : ''}
              ${di < days.length - 1 ? `<button class="icon-btn" data-action="day-move" data-client="${c.id}" data-day="${d.id}" data-dir="1" aria-label="Bajar día" title="Bajar">${U.icon('down')}</button>` : ''}
              <button class="icon-btn" data-action="day-edit" data-client="${c.id}" data-day="${d.id}" aria-label="Editar día" title="Editar día">${U.icon('edit')}</button>
            </div>
          </div>
          <div class="day-muscles">
            <div class="day-muscles-label">Músculos que entrena</div>
            <div class="chips">${groups.map((g) => `<button type="button" class="chip${muscles.includes(g) ? ' active' : ''}" data-action="day-muscle" data-client="${c.id}" data-day="${d.id}" data-value="${esc(g)}" aria-pressed="${muscles.includes(g)}">${esc(g)}</button>`).join('')}</div>
          </div>
          ${muscles.length ? muscles.map((g) => {
            const exs = list.filter((ex) => exGroup(ex) === g);
            return `<div class="muscle-block">
              <div class="muscle-head">
                <h3>${esc(g)} <span class="muted">${exs.length || ''}</span></h3>
                ${g === 'Otros' ? '' : `<button class="btn sm primary" data-action="muscle-pick" data-client="${c.id}" data-day="${d.id}" data-value="${esc(g)}">${U.icon('plus')}Ejercicios de ${esc(g)}</button>`}
              </div>
              ${exs.length ? `<ol class="list exercise-list">${exs.map((ex) => exerciseRow(c, d, ex, exs)).join('')}</ol>` : `<p class="muted muscle-empty">Pulsa «Ejercicios de ${esc(g)}» para elegirlos de la biblioteca.</p>`}
            </div>`;
          }).join('') : '<p class="muted" style="margin:6px 0 0">Marca arriba los músculos que entrena este día.</p>'}
        </section>`;
      }).join('')}`;
  }

  /** Toda la biblioteca de un músculo para elegir uno o varios ejercicios y añadirlos al día. */
  function musclePicker(clientId, dayId, group) {
    const c = Store.get('clients', clientId);
    const r = Store.routineFor(clientId);
    const day = r && findDay(r, dayId);
    if (!c || !day) return;
    const have = new Set((day.exercises || []).map((x) => x.libraryId).filter(Boolean));
    const items = filteredLibrary().filter((x) => x.group === group);
    const pats = [];
    for (const ex of items) {
      let lp = pats[pats.length - 1];
      if (!lp || lp.name !== (ex.pattern || '')) pats.push((lp = { name: ex.pattern || '', items: [] }));
      lp.items.push(ex);
    }
    UI.openModal({
      title: `${group} · ${day.name}`,
      body: `<p class="muted" style="margin-top:0">Toca los ejercicios que quieras (${plural(items.length, 'ejercicio', 'ejercicios')} en la biblioteca) y pulsa «Añadir».</p>
        ${libraryGuide(group)}
        <div class="mpick">${pats.map((p) => `
          ${p.name ? `<div class="lib-pattern"><span>${esc(p.name)}</span>${p.items[0].rest ? `<span class="muted">Descanso ${esc(p.items[0].rest)}</span>` : ''}</div>` : ''}
          <div class="lib-grid">${p.items.map((ex) => `
            <label class="lib-card mpick-card${imgOf(ex) ? ' has-img' : ''}${have.has(ex.id) ? ' added' : ''}">
              <input type="checkbox" value="${ex.id}" ${have.has(ex.id) ? 'disabled' : ''}>
              <span class="mpick-check" aria-hidden="true">${U.icon('check')}</span>
              ${exThumb(ex)}
              <span class="lib-name">${esc(ex.name)}</span>
              ${have.has(ex.id) ? badge('Ya está en el día', 'success') : ex.equipment ? `<span class="badge">${esc(ex.equipment)}</span>` : ''}
              ${libSeries(ex) ? `<span class="lib-series">${esc(libSeries(ex))}</span>` : ''}
              ${ex.description ? `<span class="lib-desc">${esc(ex.description)}</span>` : ''}
            </label>`).join('')}</div>`).join('')}</div>`,
      footer: `<button type="button" class="btn" id="mpick-manual" style="margin-right:auto">${U.icon('edit')}No está en la biblioteca</button><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn primary" id="mpick-add" disabled>Añadir</button>`,
      onOpen: (dlg) => {
        const add = dlg.querySelector('#mpick-add');
        dlg.querySelector('.mpick').addEventListener('change', () => {
          const n = dlg.querySelectorAll('.mpick input:checked').length;
          add.disabled = !n;
          add.textContent = n ? `Añadir (${n})` : 'Añadir';
        });
        dlg.querySelector('#mpick-manual').onclick = () => { UI.closeModal(); setTimeout(() => exerciseForm(c, r, day, null, group), 50); };
      },
      onSubmit: () => {
        const ids = [...document.querySelectorAll('#modal .mpick input:checked')].map((i) => i.value);
        if (!ids.length) return;
        day.exercises = day.exercises || [];
        for (const id of ids) {
          const lib = Store.get('library', id);
          if (!lib) continue;
          const notes = [lib.tempo ? `Tempo: ${lib.tempo}` : '', lib.description].filter(Boolean).join('\n');
          day.exercises.push({ id: U.uid(), libraryId: lib.id, group: lib.group, name: lib.name, sets: lib.sets || '', reps: lib.reps || '', load: '', rest: lib.rest || '', notes });
        }
        if (!(day.muscles || []).includes(group)) day.muscles = (day.muscles || []).concat(group);
        UI.closeModal();
        saveRoutine(r);
        UI.toast(ids.length === 1 ? 'Ejercicio añadido' : `${ids.length} ejercicios añadidos`);
      },
    });
  }

  /** Cambia el número de días de la rutina (crea la rutina si aún no existe). */
  async function setRoutineDays(clientId, n) {
    const c = Store.get('clients', clientId);
    let r = Store.routineFor(clientId);
    if (!r) {
      Store.add('routines', { clientId, name: `Rutina de ${monthName(today())}`, notes: '', days: Array.from({ length: n }, (_, i) => ({ id: U.uid(), name: `Día ${i + 1}`, muscles: [], exercises: [] })) });
      UI.toast(`Rutina de ${plural(n, 'día', 'días')} creada: marca los músculos de cada día`);
      App.render();
      return;
    }
    const days = r.days || [];
    if (n === days.length) return;
    if (n < days.length) {
      const gone = days.slice(n);
      const exs = gone.reduce((t, d) => t + (d.exercises || []).length, 0);
      if (exs) {
        const ok = await UI.confirm({ title: 'Quitar días', message: `Se eliminarán ${gone.map((d) => `«${esc(d.name)}»`).join(', ')} con ${plural(exs, 'ejercicio', 'ejercicios')}.`, confirmLabel: 'Quitar' });
        if (!ok) return;
      }
      r.days = days.slice(0, n);
    } else {
      r.days = days.concat(Array.from({ length: n - days.length }, (_, i) => ({ id: U.uid(), name: `Día ${days.length + i + 1}`, muscles: [], exercises: [] })));
    }
    saveRoutine(r);
  }

  /** Marca o desmarca un músculo del día (si tiene ejercicios, pregunta antes de quitarlos). */
  async function toggleDayMuscle(clientId, dayId, group) {
    const r = Store.routineFor(clientId);
    const day = r && findDay(r, dayId);
    if (!day) return;
    const on = dayMuscles(day).includes(group);
    if (!on) {
      day.muscles = (day.muscles || []).concat(group);
      saveRoutine(r);
      return;
    }
    const exs = (day.exercises || []).filter((x) => exGroup(x) === group);
    if (exs.length) {
      const ok = await UI.confirm({ title: `Quitar ${group}`, message: `Se quitarán de «${esc(day.name)}» sus ${plural(exs.length, 'ejercicio', 'ejercicios')} de ${esc(group)}.`, confirmLabel: 'Quitar' });
      if (!ok) return;
    }
    day.muscles = (day.muscles || []).filter((g) => g !== group);
    day.exercises = (day.exercises || []).filter((x) => exGroup(x) !== group);
    saveRoutine(r);
  }

  function routineText(c, r) {
    const lines = [`*${r.name || 'Rutina'} — ${c.name}*`];
    if (r.notes) lines.push('', r.notes);
    (r.days || []).forEach((d, di) => {
      lines.push('', `*${d.name || `Día ${di + 1}`}*`);
      for (const g of dayMuscles(d)) {
        const exs = (d.exercises || []).filter((ex) => exGroup(ex) === g);
        if (!exs.length) continue;
        lines.push(`_${g}_`);
        exs.forEach((ex, ei) => {
          const meta = exerciseMeta(ex);
          lines.push(`${ei + 1}. ${ex.name}${meta ? ` — ${meta}` : ''}`);
          if (ex.notes) lines.push(`   _${ex.notes}_`);
        });
      }
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

  function exerciseForm(c, r, day, ex, group) {
    UI.form({
      title: ex ? 'Editar ejercicio' : `Añadir ejercicio · ${group ? `${group} · ` : ''}${day.name}`,
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
        else (day.exercises = day.exercises || []).push(Object.assign({ id: U.uid() }, group ? { group } : {}, v));
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

  const ACTIVITY = [
    { v: 1.2, label: 'Sedentaria (poco o ningún ejercicio)' },
    { v: 1.375, label: 'Ligera (1-3 días de ejercicio)' },
    { v: 1.55, label: 'Moderada (3-5 días de ejercicio)' },
    { v: 1.725, label: 'Alta (6-7 días de ejercicio)' },
    { v: 1.9, label: 'Muy alta (trabajo físico + entreno)' },
  ];

  /** Mantenimiento estimado (Mifflin-St Jeor × actividad) con los datos de la ficha, o null si faltan. */
  function estimateMaintenance(c, activity) {
    const w = Store.lastMeasurement(c.id);
    const kg = w && Number(w.weight) > 0 ? Number(w.weight) : null;
    const cm = Number(c.height) > 0 ? Number(c.height) : null;
    const age = U.age(c.birthDate);
    if (!kg || !cm || !age) return null;
    const sex = c.gender === 'Hombre' ? 5 : c.gender === 'Mujer' ? -161 : -78;
    const bmr = 10 * kg + 6.25 * cm - 5 * age + sex;
    return Math.round((bmr * (Number(activity) || 1.55)) / 10) * 10;
  }

  /** Déficit (o superávit) frente al mantenimiento. */
  function deficitInfo(t) {
    const m = Number(t && t.maintenance);
    const k = Number(t && t.kcal);
    if (!(m > 0) || !(k > 0)) return null;
    const diff = m - k;
    const pct = Math.round((Math.abs(diff) / m) * 100);
    if (Math.abs(diff) < 50) return { kind: 'mant', diff, pct, label: 'Mantenimiento', text: 'Calorías de mantenimiento' };
    return diff > 0
      ? { kind: 'deficit', diff, pct, label: 'Déficit', text: `Déficit de ${fmtNum(diff, 0)} kcal al día (−${pct} %)` }
      : { kind: 'superavit', diff, pct, label: 'Superávit', text: `Superávit de ${fmtNum(-diff, 0)} kcal al día (+${pct} %)` };
  }

  /**
   * Agua recomendada al día según el peso y la altura: 35 ml por kg de peso, ajustado por la
   * altura (las personas más altas tienen más superficie corporal y pierden más agua).
   * Entre 1,8 y 5 L, redondeado a 0,1 L. Sin peso, 2,5 L.
   */
  function waterLiters(clientId) {
    const w = Store.lastMeasurement(clientId);
    const kg = w && Number(w.weight) > 0 ? Number(w.weight) : null;
    if (!kg) return 2.5;
    const c = Store.get('clients', clientId);
    const cm = c && Number(c.height) > 0 ? Number(c.height) : null;
    const liters = kg * 0.035 * (cm ? Math.sqrt(cm / 170) : 1);
    return Math.min(5, Math.max(1.8, Math.round(liters * 10) / 10));
  }

  function presetName(t) {
    const hit = Object.entries(DIET_PRESETS).find(([, p]) => p.carbs === Math.round(t.carbsPct) && p.protein === Math.round(t.proteinPct) && p.fat === Math.round(t.fatPct));
    return hit ? hit[1].label : 'Personalizada';
  }

  /** Gráfico circular (dónut) con el % de cada macro. */
  function macroDonut(split) {
    const total = split.reduce((n, m) => n + m.pct, 0) || 1;
    const R = 52;
    const pt = (ang) => `${(80 + Math.cos(ang) * R).toFixed(3)} ${(80 + Math.sin(ang) * R).toFixed(3)}`;
    let start = -Math.PI / 2;
    let labels = '';
    // Cada macro es un arco propio (no trazos con guiones), así no se solapan en ningún navegador.
    const segs = split.filter((m) => m.pct > 0).map((m) => {
      const sweep = (m.pct / total) * 2 * Math.PI;
      const end = start + sweep;
      const mid = start + sweep / 2;
      if (m.pct >= 4) labels += `<text x="${80 + Math.cos(mid) * R}" y="${80 + Math.sin(mid) * R + 5}" text-anchor="middle" class="donut-label">${Math.round(m.pct)}</text>`;
      const seg = sweep >= 2 * Math.PI - 1e-6
        ? `<circle r="${R}" cx="80" cy="80" fill="none" class="donut-seg ${m.cls}" stroke-width="34"/>`
        : `<path d="M ${pt(start)} A ${R} ${R} 0 ${sweep > Math.PI ? 1 : 0} 1 ${pt(end)}" fill="none" class="donut-seg ${m.cls}" stroke-width="34" stroke-linecap="butt"/>`;
      start = end;
      return seg;
    }).join('');
    return `<svg class="donut" viewBox="0 0 160 160" role="img" aria-label="Reparto de macronutrientes: ${split.map((m) => `${m.label} ${Math.round(m.pct)} %`).join(', ')}">${segs}${labels}</svg>`;
  }

  function dietTargetsCard(c, d) {
    const t = d && d.targets;
    if (!t || !(Number(t.kcal) > 0)) {
      return `<div class="diet-sec diet-goals">
        <div class="card-header"><h2>Objetivos</h2>${badge('Sin objetivos', 'warning')}</div>
        ${empty('trend', `<strong>Fija las calorías y el reparto de macros de ${esc(c.name.split(' ')[0])}.</strong><br>Serán la base para preparar su dieta.`,
          `<div style="margin-top:14px"><button class="btn primary" data-action="diet-targets" data-client="${c.id}">${U.icon('plus')}Fijar objetivos</button></div>`)}
      </div>`;
    }
    const split = macroSplit(t);
    const lastW = Store.lastMeasurement(c.id);
    const kg = lastW && Number(lastW.weight) > 0 ? Number(lastW.weight) : null;
    return `<div class="diet-sec diet-goals">
      <div class="card-header"><h2>Objetivos</h2></div>
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
        ${deficitInfo(t) ? `<div class="diet-row"><span>Mantenimiento ${fmtNum(t.maintenance, 0)} kcal</span><strong class="accent">${esc(deficitInfo(t).label)}${deficitInfo(t).kind === 'mant' ? '' : ` ${fmtNum(Math.abs(deficitInfo(t).diff), 0)} kcal (${deficitInfo(t).kind === 'deficit' ? '−' : '+'}${deficitInfo(t).pct} %)`}</strong></div>` : ''}
        <button class="diet-row" data-action="diet-targets" data-client="${c.id}"><span>Editar macronutrientes</span>${U.icon('right')}</button>
      </div>
      ${kg ? `<p class="muted" style="font-size:.8rem;margin:10px 0 0">g/kg calculado con su último peso: ${fmtNum(kg)} kg.</p>` : ''}
    </div>`;
  }

  function dietTargetsForm(clientId) {
    const c = Store.get('clients', clientId);
    if (!c) return;
    const d = Store.dietFor(clientId);
    const t0 = (d && d.targets) || { kcal: 2000, carbsPct: 33, proteinPct: 40, fatPct: 27 };
    const lastW = Store.lastMeasurement(clientId);
    const kg = lastW && Number(lastW.weight) > 0 ? Number(lastW.weight) : null;
    const act0 = Number(t0.activity) || 1.55;
    const body = `<div class="form-grid">
      <div class="field"><label for="dt-activity">Actividad</label><select id="dt-activity">${ACTIVITY.map((a) => `<option value="${a.v}" ${a.v === act0 ? 'selected' : ''}>${a.label}</option>`).join('')}</select></div>
      <div class="field"><label for="dt-maint">Mantenimiento (kcal)</label><input id="dt-maint" type="number" min="0" max="9000" step="10" inputmode="numeric" value="${esc(t0.maintenance || '')}" placeholder="Opcional"></div>
      <div class="full hint" id="dt-est" style="margin-top:-6px"></div>
      <div class="field full"><label for="dt-kcal">Objetivo de calorías (kcal)</label><input id="dt-kcal" type="number" min="500" max="8000" step="10" inputmode="numeric" value="${esc(t0.kcal)}"><div class="hint" id="dt-deficit"></div></div>
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
        const est = () => estimateMaintenance(c, $('dt-activity').value);
        const paintMaint = () => {
          const e = est();
          $('dt-est').innerHTML = e
            ? `Estimado con su peso, altura, edad y actividad: <strong>${fmtNum(e, 0)} kcal</strong> <button type="button" class="link-btn" id="dt-use">Usar</button>`
            : 'Para estimarlo, rellena en su ficha la altura, la fecha de nacimiento y el sexo, y apunta su peso.';
          const use = $('dt-use');
          if (use) use.onclick = () => { $('dt-maint').value = e; paintMaint(); };
          const di = deficitInfo({ maintenance: $('dt-maint').value, kcal: kcal() });
          $('dt-deficit').textContent = di ? di.text : '';
        };
        if (!t0.maintenance && est()) $('dt-maint').value = est();
        $('dt-activity').addEventListener('change', paintMaint);
        $('dt-maint').addEventListener('input', paintMaint);
        $('dt-kcal').addEventListener('input', () => { paint(); paintMaint(); });
        paintMaint();
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
        const maint = Number(dlg.querySelector('#dt-maint').value) || 0;
        const targets = { kcal: Math.round(k), carbsPct: pct.carbs, proteinPct: pct.protein, fatPct: pct.fat, activity: Number(dlg.querySelector('#dt-activity').value) || 1.55, maintenance: maint > 0 ? Math.round(maint) : 0 };
        if (d) Store.update('diets', d.id, { targets }); else Store.add('diets', { clientId, text: '', targets });
        UI.closeModal();
        UI.toast('Objetivos guardados');
        App.render();
      },
    });
  }

  /* ---------- Comidas de la dieta: alimentos con cantidades ajustadas a los objetivos ---------- */

  const MEAL_NAMES = {
    3: ['Desayuno', 'Comida', 'Cena'],
    4: ['Desayuno', 'Comida', 'Merienda', 'Cena'],
    5: ['Desayuno', 'Media mañana', 'Comida', 'Merienda', 'Cena'],
    6: ['Desayuno', 'Media mañana', 'Comida', 'Merienda', 'Cena', 'Snack'],
    7: ['Desayuno', 'Media mañana', 'Comida', 'Preentreno', 'Postentreno', 'Cena', 'Snack'],
  };
  const MACRO_KEYS = ['protein', 'carbs', 'fat'];

  /** Guarda cambios en la dieta del cliente (la crea si no existe). */
  function saveDiet(clientId, patch) {
    const d = Store.dietFor(clientId);
    if (d) Store.update('diets', d.id, patch);
    else Store.add('diets', Object.assign({ clientId, text: '' }, patch));
  }

  /** Objetivo del día en gramos (y kcal), o null si no hay objetivos. */
  function dayTargets(d) {
    const t = d && d.targets;
    if (!t || !(Number(t.kcal) > 0)) return null;
    const out = { kcal: Number(t.kcal) };
    for (const m of macroSplit(t)) out[m.key] = m.grams;
    return out;
  }

  /**
   * Porcentaje del día de cada comida: el que fijes en cada una; lo que falte hasta 100 %
   * se reparte a partes iguales entre las que no tengan porcentaje.
   */
  function mealShares(meals) {
    const has = (m) => m.pct != null && m.pct !== '' && Number(m.pct) >= 0;
    const set = meals.filter(has);
    const used = set.reduce((t, m) => t + Number(m.pct), 0);
    const free = meals.length - set.length;
    const each = free ? Math.max(0, 100 - used) / free : 0;
    return new Map(meals.map((m) => [m.id, has(m) ? Number(m.pct) : each]));
  }
  /** Objetivo de una comida: su porcentaje de las calorías y macros del día. */
  function mealTargets(d, mealId) {
    const day = dayTargets(d);
    const meals = (d && d.meals) || [];
    if (!day || !meals.length) return null;
    const share = (mealId ? mealShares(meals).get(mealId) : 100 / meals.length) / 100;
    if (!(share >= 0)) return null;
    return { kcal: day.kcal * share, protein: day.protein * share, carbs: day.carbs * share, fat: day.fat * share, pct: share * 100 };
  }

  const per1g = (f, k) => (num(f[k]) || 0) / 100;
  const kcalPer1g = (f) => (num(f.kcal) || 0) / 100;

  /** Proteína en polvo (suero, isolate, caseína…): siempre va aparte, como añadido; nunca es una opción equivalente. */
  const isProteinPowder = (f) => /prote[ií]na .*(suero|polvo)|whey|isolate|case[ií]na/i.test(f.name || '');

  /** Macro que «aporta» cada alimento: el del bloque del que se eligió o, si no, el que más kcal da. */
  function roleOf(item, food) {
    const blocks = Store.blocksForFood(item.foodId);
    if (isProteinPowder(food) || blocks.some((b) => b.id === 'blk-proteina-polvo')) return 'extra';
    if (blocks.some((b) => b.id === 'blk-verdura') || food.category === 'Verduras y hortalizas') return 'veg';
    // El bloque con el que se eligió; si el alimento ya no está en él (bloques reorganizados), el bloque en el que esté ahora.
    let b = item.blockId && Store.get('foodBlocks', item.blockId);
    if (!b || !(b.foodIds || []).includes(item.foodId)) b = Store.blocksForFood(item.foodId)[0];
    if (b && MACRO_KEYS.includes(b.macro)) return b.macro;
    const kc = { protein: per1g(food, 'protein') * 4, carbs: per1g(food, 'carbs') * 4, fat: per1g(food, 'fat') * 9 };
    return MACRO_KEYS.reduce((a, k) => (kc[k] > kc[a] ? k : a), 'protein');
  }

  const ROLE_LABEL = { protein: 'Proteína', carbs: 'Hidratos', fat: 'Grasa', veg: 'Verdura', extra: 'Añadido' };
  /** Redondeo de las cantidades: grasas de 5 en 5; proteínas e hidratos de 10 en 10. */
  const stepOf = (role) => (role === 'protein' || role === 'carbs' || role === 'veg' ? 10 : 5);

  /**
   * Agrupa los alimentos de una comida por el macro que aportan. Los alimentos de un mismo
   * grupo son OPCIONES entre las que elegir (pollo o pavo o lomo), no se suman entre sí.
   */
  function mealGroups(meal) {
    const rows = (meal.items || []).map((it) => ({ it, f: Store.get('foods', it.foodId) })).filter((r) => r.f);
    rows.forEach((r) => { r.role = roleOf(r.it, r.f); });
    return MACRO_KEYS.concat('veg', 'extra').map((k) => ({ key: k, rows: rows.filter((r) => r.role === k) })).filter((g) => g.rows.length);
  }

  /**
   * Opción de referencia de un grupo: la fijada a mano o, si no, la primera. Las demás opciones
   * aportan lo mismo de su macro principal; para el resto de macros se cuenta la de referencia.
   */
  const refRow = (g) => g.rows.find((r) => r.it.locked && (g.key === 'veg' ? kcalPer1g(r.f) : per1g(r.f, g.key)) > 0) || g.rows[0];
  function rowAmount(r, key) {
    return (Number(r.it.grams) || 0) * (key === 'kcal' ? (num(r.f.kcal) || 0) / 100 : per1g(r.f, key));
  }

  /** Cómo se calculan las equivalencias entre opciones: por calorías (por defecto) o por el macro del bloque. */
  const equivBy = () => (Store.data.settings.equivBy === 'macro' ? 'macro' : 'kcal');
  const roundStep = (g, step) => {
    const raw = Math.min(1500, Math.max(0, Number(g) || 0));
    return raw > 0 ? Math.max(step, Math.round(raw / step) * step) : 0;
  };

  /**
   * Ajusta los gramos de los alimentos no fijados para acercarse al objetivo de la comida.
   * La opción de referencia de cada grupo (la primera o la fijada) cubre su macro, descontando
   * lo que aportan las de referencia de los otros grupos. Las demás opciones del grupo son
   * equivalentes a ella: con las mismas kcal (o, si se elige así en Ajustes, con el mismo macro).
   */
  function solveMeal(meal, target) {
    if (!target) return;
    const all = mealGroups(meal);
    // La proteína en polvo es un añadido: no se ajusta (30 g por defecto) y se descuenta de lo que deben cubrir los demás.
    const extras = (all.find((g) => g.key === 'extra') || { rows: [] }).rows;
    extras.forEach((r) => { if (!(Number(r.it.grams) > 0)) r.it.grams = 30; });
    // La verdura tampoco se ajusta por macros: 150 g por defecto (o lo que pongas) y sus opciones con las mismas kcal.
    const veg = all.find((g) => g.key === 'veg');
    if (veg) {
      const ref = refRow(veg);
      if (!(Number(ref.it.grams) > 0)) ref.it.grams = 150;
      for (const r of veg.rows) if (r !== ref && !r.it.locked && kcalPer1g(r.f) > 0) r.it.grams = roundStep(rowAmount(ref, 'kcal') / kcalPer1g(r.f), 10);
    }
    const extraAmount = (k) => extras.reduce((n, r) => n + rowAmount(r, k), veg ? rowAmount(refRow(veg), k) : 0);
    const groups = all.filter((g) => g.key !== 'extra' && g.key !== 'veg');
    groups.forEach((g) => g.rows.forEach((r) => { if (!r.it.locked && !(Number(r.it.grams) > 0)) r.it.grams = 100; }));
    for (let iter = 0; iter < 40; iter++) {
      for (const g of groups) {
        const ref = refRow(g);
        if (ref.it.locked || !(per1g(ref.f, g.key) > 0)) continue;
        const others = groups.filter((x) => x !== g).reduce((n, x) => n + rowAmount(refRow(x), g.key), extraAmount(g.key));
        ref.it.grams = Math.max(0, target[g.key] - others) / per1g(ref.f, g.key);
      }
    }
    const byKcal = equivBy() === 'kcal';
    for (const g of groups) {
      const step = stepOf(g.key);
      const ref = refRow(g);
      if (!ref.it.locked) ref.it.grams = roundStep(ref.it.grams, step);
      for (const r of g.rows) {
        if (r === ref || r.it.locked) continue;
        if (byKcal && kcalPer1g(r.f) > 0) r.it.grams = roundStep(rowAmount(ref, 'kcal') / kcalPer1g(r.f), step);
        else if (per1g(r.f, g.key) > 0) r.it.grams = roundStep(rowAmount(ref, g.key) / per1g(r.f, g.key), step);
      }
    }
  }

  /** Recalcula las comidas de todas las dietas (al cambiar cómo se calculan las equivalencias). */
  function resolveAllDiets() {
    for (const d of Store.data.diets) {
      const meals = d.meals || [];
      if (!meals.length || !mealTargets(d)) continue;
      const copy = meals.map((m) => Object.assign({}, m, { items: (m.items || []).map((x) => Object.assign({}, x)) }));
      copy.forEach((m) => solveMeal(m, mealTargets(Object.assign({}, d, { meals: copy }), m.id)));
      Store.update('diets', d.id, { meals: copy });
    }
  }

  function setEquivBy(v) {
    if (equivBy() === v) return;
    Store.data.settings.equivBy = v;
    Store.save();
    resolveAllDiets();
    UI.toast(v === 'kcal' ? 'Equivalencias por calorías' : 'Equivalencias por macronutriente');
    App.render();
  }

  const equivSwitch = () => `<div class="equiv-switch"><span>Equivalencias por</span>
    <div class="segmented" role="radiogroup" aria-label="Equivalencias por">${[['kcal', 'Calorías'], ['macro', 'Macronutriente']].map(([v, l]) => `<button type="button" role="radio" aria-checked="${equivBy() === v}" class="${equivBy() === v ? 'active' : ''}" data-action="equiv-by" data-value="${v}">${l}</button>`).join('')}</div></div>`;

  /** Totales de una comida: la opción de referencia de cada grupo. */
  function mealTotals(meal) {
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    for (const g of mealGroups(meal)) {
      const rows = g.key === 'extra' ? g.rows : [refRow(g)]; // los añadidos se suman todos
      for (const r of rows) for (const k in t) t[k] += rowAmount(r, k);
    }
    return t;
  }

  /** Barras de progreso de kcal y macros frente al objetivo. */
  function macroBars(tot, target) {
    const rows = [['kcal', 'kcal', 'Kcal', ''], ['protein', 'm-protein', 'Proteínas', 'g'], ['carbs', 'm-carbs', 'Hidratos', 'g'], ['fat', 'm-fat', 'Grasas', 'g']];
    return `<div class="mbars">${rows.map(([k, cls, label, u]) => {
      const goal = target ? target[k] : 0;
      const pct = goal ? Math.min(100, (tot[k] / goal) * 100) : 0;
      const diff = goal ? tot[k] - goal : 0;
      const off = goal && Math.abs(diff) > Math.max(k === 'kcal' ? 40 : 4, goal * 0.1);
      return `<div class="mbar ${cls}">
        <div class="mbar-top"><span>${label}</span><span class="${off ? 'off' : ''}">${fmtNum(tot[k], 0)}${goal ? ` / ${fmtNum(goal, 0)}` : ''} ${u || 'kcal'}</span></div>
        <div class="mbar-track"><span style="width:${pct}%"></span></div>
      </div>`;
    }).join('')}</div>`;
  }

  function mealCard(c, d, meal, idx) {
    const target = mealTargets(d, meal.id);
    const tot = mealTotals(meal);
    const open = state.openMeal === meal.id;
    const groups = mealGroups(meal);
    const items = groups.flatMap((g) => g.rows);
    const multi = groups.some((g) => g.key !== 'extra' && g.rows.length > 1);
    return `<details class="meal-card"${open ? ' open' : ''}>
      <summary data-action="meal-toggle" data-id="${meal.id}">
        <span class="meal-num">${idx + 1}</span>
        <div class="grow">
          <h3>${esc(meal.name)}</h3>
          <div class="muted">${meal.vegFree ? '<span class="veg-tag">+ verdura</span> ' : ''}${items.length ? `${plural(items.length, 'alimento', 'alimentos')} · ${multi ? '≈ ' : ''}${fmtNum(tot.kcal, 0)}${target ? ` / ${fmtNum(target.kcal, 0)}` : ''} kcal` : 'Sin alimentos'}</div>
        </div>
        <span class="block-chev">${U.icon('down')}</span>
      </summary>
      <div class="meal-body">
        <div class="field meal-name"><label for="mn-${meal.id}">Nombre de la comida</label>
          <input id="mn-${meal.id}" value="${esc(meal.name)}" data-action-change="meal-rename" data-client="${c.id}" data-meal="${meal.id}" list="meal-names" placeholder="Ej.: Desayuno, Preentreno…"></div>
        ${macroBars(tot, target)}
        ${multi ? `<p class="muted meal-note">Las opciones de un mismo grupo son equivalentes: ${equivBy() === 'kcal' ? 'todas aportan las mismas <strong>calorías</strong>' : 'todas aportan lo mismo de su macro'}. Las barras cuentan la primera opción de cada grupo (o la que fijes con el candado).</p>` : ''}
        ${items.length ? groups.map((g) => `<div class="meal-group m-${g.key}">
          <div class="meal-group-head"><span class="dot"></span><strong>${ROLE_LABEL[g.key]}</strong>${g.key === 'extra' ? '<span class="muted">resta su proteína a las demás opciones</span>' : g.rows.length > 1 ? `<span class="muted">${g.rows.length} opciones · elige una</span>` : ''}</div>
          <ul class="list meal-items">${g.rows.map(({ it, f }, i) => {
          const gr = Number(it.grams) || 0;
          let b = it.blockId && Store.get('foodBlocks', it.blockId);
          if (!b || !(b.foodIds || []).includes(it.foodId)) b = Store.blocksForFood(it.foodId)[0];
          const extra = g.key === 'extra';
          return `${i && !extra ? '<li class="meal-or" aria-hidden="true"><span>o</span></li>' : ''}<li>
            <div class="grow">
              <div class="title">${esc(f.name)}</div>
              <div class="meta">${b ? `${esc(b.name)} · ` : ''}${fmtNum((num(f.kcal) || 0) * gr / 100, 0)} kcal · P ${fmtNum(per1g(f, 'protein') * gr, 1)} · H ${fmtNum(per1g(f, 'carbs') * gr, 1)} · G ${fmtNum(per1g(f, 'fat') * gr, 1)}</div>
            </div>
            <div class="grams-input"><input type="number" min="0" step="${stepOf(g.key)}" inputmode="numeric" value="${gr}" aria-label="Cantidad de ${esc(f.name)}" data-action-change="meal-grams" data-client="${c.id}" data-meal="${meal.id}" data-item="${it.id}"><span>${unitOf(f)}</span></div>
            ${extra ? '<span class="lock-spacer" aria-hidden="true"></span>' : `<button class="icon-btn lock-btn${it.locked ? ' locked' : ''}" data-action="meal-lock" data-client="${c.id}" data-meal="${meal.id}" data-item="${it.id}" aria-pressed="${!!it.locked}" title="${it.locked ? 'Cantidad fijada por ti: toca para que la app la ajuste' : 'La app ajusta esta cantidad: toca para fijarla'}">${U.icon(it.locked ? 'lock' : 'unlock')}</button>`}
            <button class="icon-btn" data-action="meal-remove" data-client="${c.id}" data-meal="${meal.id}" data-item="${it.id}" aria-label="Quitar ${esc(f.name)}">${U.icon('close')}</button>
          </li>`;
        }).join('')}</ul></div>`).join('') : `<p class="muted" style="margin:12px 0">Añade alimentos de los bloques: la app calculará las cantidades para cuadrar ${target ? 'el objetivo de esta comida' : 'los objetivos (fíjalos arriba)'}. Si eliges varios del mismo tipo (pollo, pavo, lomo…), serán opciones a elegir.</p>`}
        <label class="veg-free${meal.vegFree ? ' on' : ''}"><input type="checkbox" data-action-change="meal-veg" data-client="${c.id}" data-meal="${meal.id}" ${meal.vegFree ? 'checked' : ''}>
          <span><strong>Verdura libre</strong><span class="muted">Se puede añadir hasta 150 g de verdura (la que quiera)</span></span></label>
        <div class="actions">
          <button class="btn primary sm" data-action="meal-add" data-client="${c.id}" data-meal="${meal.id}">${U.icon('plus')}Añadir alimentos</button>
          ${items.length && target ? `<button class="btn sm" data-action="meal-solve" data-client="${c.id}" data-meal="${meal.id}">${U.icon('activity')}Reajustar cantidades</button>` : ''}
        </div>
      </div>
    </details>`;
  }

  function mealsSection(c, d) {
    const meals = (d && d.meals) || [];
    const chooser = (current) => `<div class="meal-count">
        <span>Número de comidas</span>
        <div class="segmented" role="radiogroup" aria-label="Número de comidas">${[3, 4, 5, 6, 7].map((n) => `<button type="button" role="radio" aria-checked="${state.mealCount === n}" class="${state.mealCount === n ? 'active' : ''}" data-action="meal-count-pick" data-value="${n}">${n}</button>`).join('')}</div>
        <button class="btn primary sm" data-action="meal-count-apply" data-client="${c.id}" ${state.mealCount ? '' : 'disabled'}>${U.icon('check')}Aceptar</button>
        ${current ? '<button class="btn sm" data-action="meal-count-cancel">Cancelar</button>' : ''}
      </div>`;
    if (!meals.length) {
      return `<div class="diet-sec">
        <div class="card-header"><h2>Comidas</h2></div>
        <p class="muted" style="margin:0 0 12px">Elige cuántas comidas hará al día. Las calorías y los macros se repartirán a partes iguales entre ellas.</p>
        ${chooser(false)}
      </div>`;
    }
    const day = dayTargets(d);
    const tot = meals.reduce((t, m) => { const x = mealTotals(m); for (const k in t) t[k] += x[k]; return t; }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    return `<div class="diet-sec meals-summary">
        <div class="card-header"><h2>Comidas</h2><button class="btn sm" data-action="meal-count-edit">${U.icon('edit')}${plural(meals.length, 'comida', 'comidas')}</button></div>
        ${state.editMealCount ? chooser(true) : ''}
        ${day ? '' : `<div class="alert" style="margin:0 0 12px">${U.icon('alert')}<div>Fija los objetivos de calorías y macros arriba para que la app pueda calcular las cantidades.</div></div>`}
        ${equivSwitch()}
        <h3 class="meal-day-title">Total del día</h3>
        ${macroBars(tot, day)}
        ${day ? shareEditor(c, d) : ''}
      <datalist id="meal-names">${['Desayuno', 'Media mañana', 'Comida', 'Merienda', 'Cena', 'Preentreno', 'Postentreno', 'Snack', 'Recena'].map((n) => `<option value="${n}"></option>`).join('')}</datalist>
      <div class="meal-list">${meals.map((m, i) => mealCard(c, d, m, i)).join('')}</div>
      </div>`;
  }

  /** Reparto de las calorías del día entre las comidas (en %). */
  function shareEditor(c, d) {
    const meals = d.meals || [];
    const shares = mealShares(meals);
    const day = dayTargets(d);
    const total = [...shares.values()].reduce((a, b) => a + b, 0);
    const ok = Math.abs(total - 100) < 0.5;
    const gap = Math.round(100 - total);
    const custom = meals.some((m) => m.pct != null && m.pct !== '');
    return `<div class="meal-shares">
        <div class="meal-shares-head"><h3 class="meal-day-title">Reparto por comida</h3>
          <span class="share-total ${ok ? 'share-ok' : 'share-bad'}">${ok ? U.icon('check') : ''}Total ${fmtNum(total, 0)} %${ok ? '' : ` · ${gap > 0 ? `faltan ${gap} %` : `sobran ${-gap} %`}`}</span>
          ${custom ? `<button class="btn sm" data-action="meal-pct-equal" data-client="${c.id}">Repartir igual</button>` : ''}</div>
        <div class="meal-share-list">${meals.map((m) => `<label class="meal-share${m.pct != null && m.pct !== '' ? ' fixed' : ''}">
            <span class="ms-name">${esc(m.name)}</span>
            <span class="ms-ctrl">
              <button type="button" class="ms-btn" data-action="meal-pct-step" data-client="${c.id}" data-meal="${m.id}" data-dir="-1" aria-label="Bajar el porcentaje de ${esc(m.name)}">−</button>
              <span class="ms-input"><input type="number" min="0" max="100" step="1" inputmode="numeric" value="${fmtNum(shares.get(m.id), 0)}" data-action-change="meal-pct" data-client="${c.id}" data-meal="${m.id}" aria-label="Porcentaje del día para ${esc(m.name)}"><i>%</i></span>
              <button type="button" class="ms-btn" data-action="meal-pct-step" data-client="${c.id}" data-meal="${m.id}" data-dir="1" aria-label="Subir el porcentaje de ${esc(m.name)}">+</button>
            </span>
            <span class="ms-kcal">${fmtNum((day.kcal * shares.get(m.id)) / 100, 0)} kcal</span>
          </label>`).join('')}</div>
        <p class="muted" style="font-size:.8rem;margin:6px 0 0">Con − y + subes o bajas una comida de 1 en 1 % (o escribe el número). Las demás no se tocan: el total te avisa en verde cuando suma 100 % y en rojo si faltan o sobran. Las cantidades de los alimentos se recalculan.</p>
      </div>`;
  }
  /**
   * Fija el % de una comida sin tocar las demás: las que aún no tenían porcentaje propio
   * se quedan con el que mostraban, para que no cambien solas.
   */
  function setShare(meals, id, value) {
    const shares = mealShares(meals);
    meals.forEach((m) => { m.pct = Math.round(shares.get(m.id)); });
    const me = meals.find((m) => m.id === id);
    if (me) me.pct = Math.min(100, Math.max(0, Math.round(value)));
  }
  /** Aplica un cambio de reparto y recalcula todas las comidas. */
  function setMealShares(clientId, fn) {
    const d = Store.dietFor(clientId);
    if (!d) return;
    const meals = (d.meals || []).map((m) => Object.assign({}, m, { items: (m.items || []).map((x) => Object.assign({}, x)) }));
    fn(meals);
    const nd = Object.assign({}, d, { meals });
    meals.forEach((m) => solveMeal(m, mealTargets(nd, m.id)));
    saveDiet(clientId, { meals });
    App.render();
  }

  /** Abre la biblioteca de bloques para elegir varios alimentos y añadirlos a una comida. */
  function mealPicker(clientId, mealId) {
    const d = Store.dietFor(clientId);
    const meal = d && (d.meals || []).find((m) => m.id === mealId);
    if (!meal) return;
    const blocks = Store.data.foodBlocks;
    const inBlocks = new Set(blocks.flatMap((b) => b.foodIds || []));
    const others = Store.foods().filter((f) => !inBlocks.has(f.id));
    const fams = BLOCK_FAMILIES.filter((fm) => blocks.some((b) => (b.family || 'Otros') === fm));
    const item = (f, blockId) => `<label class="pick-item" data-name="${esc(normalizeText(f.name))}"><input type="checkbox" value="${f.id}" data-block="${blockId || ''}">
        <span class="grow">${esc(f.name)}</span><span class="muted">${fmtNum(f.kcal, 0)} kcal · P ${fmtNum(f.protein)} · H ${fmtNum(f.carbs)} · G ${fmtNum(f.fat)}</span></label>`;
    const body = `<p class="muted" style="margin:0 0 10px">Marca uno o varios alimentos. Los del mismo tipo (por ejemplo, pollo, pavo y lomo) serán <strong>opciones</strong> a elegir, no se suman. La app calcula los gramos de cada uno para cuadrar el objetivo de «${esc(meal.name)}». Valores por 100 g.</p>
      <input type="search" id="mp-search" placeholder="Buscar alimento…" aria-label="Buscar alimento">
      <div class="mp-list">
        ${fams.map((fm) => `<div class="mp-fam" data-group><div class="bf-cat-name">${esc(fm)}</div>
          ${blocks.filter((b) => (b.family || 'Otros') === fm).map((b) => `<details class="mp-block" data-group>
            <summary>${esc(b.name)} <span class="muted">${(b.foodIds || []).length}</span></summary>
            ${(b.foodIds || []).map((id) => Store.get('foods', id)).filter(Boolean).map((f) => item(f, b.id)).join('')}
          </details>`).join('')}</div>`).join('')}
        ${others.length ? `<div class="mp-fam" data-group><div class="bf-cat-name">Otros alimentos de la biblioteca</div><details class="mp-block" data-group><summary>Sin bloque <span class="muted">${others.length}</span></summary>${others.map((f) => item(f, '')).join('')}</details></div>` : ''}
      </div>`;
    UI.openModal({
      title: `Añadir a ${meal.name}`,
      body,
      footer: '<button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn primary" id="mp-add" disabled>Añadir</button>',
      onOpen: (dlg) => {
        const search = dlg.querySelector('#mp-search');
        const add = dlg.querySelector('#mp-add');
        const sync = () => {
          const ids = new Set([...dlg.querySelectorAll('.pick-item input:checked')].map((i) => i.value));
          add.disabled = !ids.size;
          add.textContent = ids.size ? `Añadir (${ids.size})` : 'Añadir';
        };
        dlg.querySelector('.mp-list').addEventListener('change', (e) => {
          // El mismo alimento puede estar en varios bloques: se marca/desmarca en todos.
          if (e.target.matches('.pick-item input')) dlg.querySelectorAll(`.pick-item input[value="${e.target.value}"]`).forEach((x) => { x.checked = e.target.checked; });
          sync();
        });
        search.addEventListener('input', () => {
          const q = normalizeText(search.value);
          dlg.querySelectorAll('.pick-item').forEach((el) => { el.hidden = q && !el.dataset.name.includes(q); });
          dlg.querySelectorAll('.mp-block').forEach((det) => {
            const any = [...det.querySelectorAll('.pick-item')].some((el) => !el.hidden);
            det.hidden = !any;
            det.open = !!q && any;
          });
          dlg.querySelectorAll('.mp-fam').forEach((fm) => { fm.hidden = ![...fm.querySelectorAll('.mp-block')].some((x) => !x.hidden); });
        });
      },
      onSubmit: () => {
        const dlg = document.getElementById('modal');
        const seen = new Set();
        const picked = [...dlg.querySelectorAll('.pick-item input:checked')].filter((i) => !seen.has(i.value) && seen.add(i.value)).map((i) => ({ foodId: i.value, blockId: i.dataset.block || '' }));
        if (!picked.length) return;
        const meals = d.meals.map((m) => Object.assign({}, m, { items: (m.items || []).slice() }));
        const target = meals.find((m) => m.id === mealId);
        for (const p of picked) if (!target.items.some((x) => x.foodId === p.foodId)) target.items.push({ id: U.uid(), foodId: p.foodId, blockId: p.blockId, grams: 0, locked: false });
        solveMeal(target, mealTargets(Object.assign({}, d, { meals }), mealId));
        saveDiet(clientId, { meals });
        state.openMeal = mealId;
        UI.closeModal();
        UI.toast(picked.length === 1 ? 'Alimento añadido' : `${picked.length} alimentos añadidos`);
        App.render();
      },
    });
  }

  /** Aplica un cambio a una comida, reajusta las cantidades no fijadas y guarda. */
  function updateMeal(clientId, mealId, fn, { solve = true } = {}) {
    const d = Store.dietFor(clientId);
    if (!d) return;
    const meals = (d.meals || []).map((m) => Object.assign({}, m, { items: (m.items || []).map((x) => Object.assign({}, x)) }));
    const meal = meals.find((m) => m.id === mealId);
    if (!meal) return;
    fn(meal);
    if (solve) solveMeal(meal, mealTargets(Object.assign({}, d, { meals }), mealId));
    saveDiet(clientId, { meals });
    state.openMeal = mealId;
    App.render();
  }

  function applyMealCount(clientId) {
    const n = state.mealCount;
    if (!n) return;
    const d = Store.dietFor(clientId);
    const old = (d && d.meals) || [];
    const names = MEAL_NAMES[n];
    const meals = names.map((name, i) => old[i] || { id: U.uid(), name, items: [] });
    const lost = old.slice(n).filter((m) => (m.items || []).length).length;
    const done = () => {
      // Con otro número de comidas cambia el objetivo de cada una: se reajustan las cantidades.
      meals.forEach((m) => { delete m.pct; });
      meals.forEach((m) => solveMeal(m, mealTargets(Object.assign({}, d, { meals }), m.id)));
      saveDiet(clientId, { meals });
      state.editMealCount = false;
      UI.toast(`${n} comidas`);
      App.render();
    };
    if (lost) {
      UI.confirm({ title: 'Quitar comidas', message: `Pasar a ${n} comidas quitará las últimas ${old.length - n}, y ${plural(lost, 'tiene', 'tienen')} alimentos. ¿Continuar?`, confirmLabel: 'Quitar' })
        .then((ok) => { if (ok) done(); });
    } else done();
  }

  function clientDiet(c) {
    const d = Store.dietFor(c.id);
    if (!state.mealCount) state.mealCount = 5;
    const has = d && ((d.targets && Number(d.targets.kcal) > 0) || (d.meals || []).length || (d.text || '').trim() || (d.supps || '').trim() || (d.suppList || []).length);
    return `<section class="card diet-panel">
    ${dietTargetsCard(c, d)}
    ${mealsSection(c, d)}
    <div class="diet-sec">
      <div class="card-header"><h2>Suplementación</h2></div>
      <form class="diet-form" data-client="${c.id}">
        <p class="muted" style="margin:0 0 8px;font-size:.88rem">Marca los que tome y ajusta la dosis o la porción (gramos, cápsulas, cacitos, momento del día).</p>
        ${suppChecklist(d)}
        <div class="actions" style="margin-top:10px"><button type="submit" class="btn primary">${U.icon('check')}Guardar</button></div>
      </form>
    </div>
    ${dietSendable(d) ? `<div class="diet-sec diet-send">
      <div class="card-header"><h2>PDF para el cliente</h2></div>
      <p class="muted" style="margin:0 0 12px">Una portada, una página por comida y las indicaciones al final. Descárgalo y mándaselo.</p>
      <div class="actions">
        <button class="btn primary" data-action="diet-pdf" data-client="${c.id}">${U.icon('download')}Descargar PDF</button>
        <button class="btn" data-action="diet-copy" data-client="${c.id}">${U.icon('file')}Copiar texto</button>
      </div>
    </div>` : ''}
    ${has ? `<div class="diet-sec diet-delete">
      <button class="btn danger" data-action="diet-delete" data-client="${c.id}">${U.icon('trash')}Eliminar toda la dieta</button>
      <span class="muted">Borra los objetivos, las comidas y las indicaciones.</span>
    </div>` : ''}
    </section>`;
  }

  const dietSendable = (d) => !!d && ((d.meals || []).some((m) => (m.items || []).length || m.vegFree) || !!(d.text || '').trim() || !!(d.targets && Number(d.targets.kcal) > 0));

  /** Texto de la dieta para WhatsApp (con *negritas* y _cursivas_ de WhatsApp). */
  function dietText(c, d) {
    const fmtG = (g) => fmtNum(Number(g) || 0, 0);
    const lines = [`*Dieta — ${c.name}*`];
    const addSupps = () => { if (suppLines(d).length) lines.push('', '*Suplementación*', ...suppLines(d).map((x) => `• ${x}`)); };
    const meals = (d.meals || []).filter((m) => (m.items || []).length || m.vegFree);
    meals.forEach((m) => {
      lines.push('', `*${m.name}*`);
      for (const g of mealGroups(m)) {
        const many = g.key !== 'extra' && g.rows.length > 1;
        lines.push(`_${ROLE_LABEL[g.key]}${many ? ' (elige una opción)' : ''}:_`);
        g.rows.forEach((r, i) => { const ck = cookedGrams(r.f, r.it.grams); lines.push(`${many && i ? '   o ' : '• '}${fmtG(r.it.grams)} ${unitOf(r.f)} de ${r.f.name}${ck ? ` (≈ ${ck} g ya cocinado)` : ''}`); });
      }
      if (m.vegFree) lines.push('🥗 Puedes añadir hasta 150 g de verdura (la que quieras)');
    });

    addSupps();
    if (meals.some((m) => mealGroups(m).some((g) => g.key !== 'extra' && g.rows.length > 1))) lines.push('', '_Donde hay varias opciones, elige solo una: las cantidades ya están ajustadas para que sean equivalentes._');
    return lines.join('\n');
  }

  /**
   * Peso aproximado ya cocinado de los alimentos que se pesan en crudo. Si la biblioteca tiene la
   * versión cocinada se usa la relación de sus calorías (las kcal no cambian al cocinar, solo el
   * agua); si no, un factor de rendimiento habitual.
   */
  const COOKED_OF = {
    'Pechuga de pollo (cruda)': 'Pechuga de pollo a la plancha', 'Muslo de pollo sin piel (crudo)': 'Muslo de pollo sin piel asado',
    'Pechuga de pavo (cruda)': 'Pechuga de pavo a la plancha', 'Solomillo de cerdo (crudo)': 'Solomillo de cerdo a la plancha',
    'Lomo de cerdo (crudo)': 'Lomo de cerdo a la plancha', 'Ternera magra (cruda)': 'Ternera magra a la plancha',
    'Carne picada de vacuno (cruda)': 'Carne picada de vacuno cocinada', 'Hamburguesa de vacuno (cruda)': 'Hamburguesa de vacuno a la plancha',
    'Hamburguesa de pollo (cruda)': 'Hamburguesa de pollo a la plancha', 'Cordero pierna (crudo)': 'Cordero pierna asado',
    'Salmón fresco (crudo)': 'Salmón a la plancha / al horno', 'Merluza (cruda)': 'Merluza a la plancha / al horno',
    'Bacalao fresco (crudo)': 'Bacalao fresco cocinado', 'Lubina (cruda)': 'Lubina al horno', 'Dorada (cruda)': 'Dorada al horno',
    'Atún fresco (crudo)': 'Atún fresco a la plancha', 'Emperador / pez espada (crudo)': 'Emperador a la plancha',
    'Gambas peladas congeladas (crudas)': 'Gambas a la plancha', 'Mejillones (crudos)': 'Mejillones cocidos',
    'Calamar (crudo)': 'Calamar a la plancha', 'Sepia (cruda)': 'Sepia a la plancha', 'Pulpo (crudo)': 'Pulpo cocido',
    'Arroz blanco (crudo)': 'Arroz blanco cocido', 'Pasta (cruda)': 'Pasta cocida',
    // Sin versión cocinada en la biblioteca: rendimiento típico (peso cocinado / peso crudo).
    'Pollo entero con piel (crudo)': 0.7, 'Bacalao desalado (crudo)': 0.8, 'Soja texturizada (seca)': 3,
    'Arroz integral (crudo)': 2.6, 'Arroz basmati (crudo)': 2.7, 'Pasta integral (cruda)': 2.3, 'Cuscús (crudo)': 2.5,
    'Quinoa (cruda)': 2.8, 'Fideos de arroz (crudos)': 2.5,
    'Lentejas (secas)': 2.5, 'Garbanzos (secos)': 2.4, 'Alubias blancas (secas)': 2.5,
  };
  function cookedGrams(f, grams) {
    const ref = COOKED_OF[f.name];
    if (!ref || !(Number(grams) > 0)) return null;
    let factor = typeof ref === 'number' ? ref : null;
    if (!factor) {
      const cooked = Store.foods().find((x) => x.name === ref);
      if (!cooked || !(num(cooked.kcal) > 0) || !(num(f.kcal) > 0)) return null;
      factor = num(f.kcal) / num(cooked.kcal);
    }
    if (!(factor > 0.3 && factor < 4)) return null;
    return Math.max(5, Math.round((Number(grams) * factor) / 5) * 5);
  }

  /** Colores del PDF según el tipo de alimento, todos dentro del degradado Glaciar (azul → cian → menta). */
  const FOOD_TONES = {
    // Carnes en rojo, lácteos en blanco, verdura en verde, hidratos (y fruta) en naranja y grasas en amarillo.
    carne: '#f87171', pescado: '#6e8bff', huevo: '#99f6e4', polvo: '#a5b4fc', vegetal: '#38bdf8',
    hidrato: '#fb923c', fruta: '#fb923c', aceite: '#facc15', fruto: '#facc15', queso: '#facc15', lacteo: '#f8fafc', verdura: '#4ade80',
  };
  const BLOCK_TONE = {
    'blk-carnes-magras': 'carne', 'blk-carnes-grasas': 'carne', 'blk-embutidos': 'carne',
    'blk-pescado-blanco': 'pescado', 'blk-pescado-azul': 'pescado', 'blk-conservas': 'pescado',
    'blk-huevos': 'huevo', 'blk-proteina-polvo': 'polvo', 'blk-proteina-vegetal': 'vegetal',
    'blk-cereales': 'hidrato', 'blk-pan': 'hidrato', 'blk-tuberculos': 'hidrato', 'blk-legumbres-secas': 'hidrato', 'blk-legumbres-cocidas': 'hidrato',
    'blk-fruta': 'fruta', 'blk-grasas': 'aceite', 'blk-frutos-secos': 'fruto', 'blk-quesos-curados': 'queso',
    'blk-lacteos-menos-grasa': 'lacteo', 'blk-lacteos-mas-grasa': 'lacteo',
  };
  const CATEGORY_TONE = {
    'Carnes y aves': 'carne', 'Embutidos y fiambres': 'carne', 'Pescados y mariscos': 'pescado', 'Huevos': 'huevo', 'Proteína vegetal': 'vegetal',
    'Lácteos': 'lacteo', 'Cereales, pan y pasta': 'hidrato', 'Tortitas': 'hidrato', 'Tubérculos': 'hidrato', 'Legumbres': 'hidrato',
    'Frutas': 'fruta', 'Frutos secos y semillas': 'fruto', 'Grasas y aceites': 'aceite', 'Suplementos': 'polvo', 'Verduras y hortalizas': 'verdura',
  };
  function toneOf(it, f) {
    let b = it.blockId && Store.get('foodBlocks', it.blockId);
    if (!b || !(b.foodIds || []).includes(it.foodId)) b = Store.blocksForFood(it.foodId)[0];
    if (/queso/i.test(f.name) && /curado|lonchas|rallado|cabra/i.test(f.name)) return 'queso';
    return (b && BLOCK_TONE[b.id]) || CATEGORY_TONE[f.category] || null;
  }
  /** Color de un grupo: el tipo de alimento que más se repite entre sus opciones. */
  function groupTone(g) {
    const n = {};
    for (const r of g.rows) { const t = toneOf(r.it, r.f); if (t) n[t] = (n[t] || 0) + 1; }
    const best = Object.keys(n).sort((a, b) => n[b] - n[a])[0];
    return best ? FOOD_TONES[best] : null;
  }

  /**
   * Hoja de la dieta para imprimir o guardar como PDF (A4, en claro): portada, una página por
   * comida (centrada) y, si hay, una página de indicaciones.
   */
  function dietSheet(c, d) {
    const meals = (d.meals || []).filter((m) => (m.items || []).length || m.vegFree);
    const anyOptions = meals.some((m) => mealGroups(m).some((g) => g.key !== 'extra' && g.rows.length > 1));
    const notes = '';
    const supps = suppLines(d);
    const t = d.targets && Number(d.targets.kcal) > 0 ? d.targets : null;
    // Orden de las páginas: portada, tu plan, comidas, plato saludable, agua y suplementos, indicaciones.
    const weights = Store.measurementsFor(c.id).filter((m) => Number(m.weight) > 0);
    const hasData = Number(c.height) > 0 || weights.length;
    const extraPages = [hasData ? 'Tus datos' : null, t ? 'Tu plan' : null].filter(Boolean);
    const afterPages = ['Tu plato improvisado', supps.length ? 'Agua y suplementación' : 'Hidratación', notes ? 'Indicaciones' : null].filter(Boolean);
    const total = 1 + extraPages.length + meals.length + afterPages.length;
    const firstMeal = 2 + extraPages.length;
    const brand = '<div class="ds-brand"><span class="ds-logo"><svg class="hexlogo" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="dogradpdf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6e8bff"/><stop offset=".55" stop-color="#22d3ee"/><stop offset="1" stop-color="#3ee6a0"/></linearGradient></defs><path class="hx" style="stroke:url(#dogradpdf)" d="M50 6 88 28v44L50 94 12 72V28Z"/><path class="hx-do" fill-rule="evenodd" style="fill:#fff" d="M23 35H40L49 44V56L40 65H23Z M30 42.5L42 50L30 57.5Z M57 35H72L79 42V58L72 65H57L50 58V42Z M58 43H71V57H58Z"/></svg></span><span><strong>David Orihuela</strong><small>Entrenador Online</small></span></div>';
    const top = `<header class="ds-top">${brand}<span class="ds-client">${esc(c.name)}</span></header>`;
    const foot = (n, txt) => `<footer class="ds-foot"><span>${txt || ''}</span><span class="ds-page-n">${n} / ${total}</span></footer>`;
    const optNote = 'Donde hay varias opciones, elige solo una: las cantidades ya son equivalentes.';
    const cover = `<section class="ds-page ds-cover">
        <div class="ds-cover-in">
          ${brand}
          <div class="ds-cover-main">
            <span class="ds-kicker">Plan de alimentación</span>
            <h1>${esc(c.name)}</h1>
            <span class="ds-rule"></span>
            <p>${esc(fmtDate(today()))}</p>
            <p class="ds-tag">Lo simple funciona.</p>
          </div>
          <ol class="ds-index">${extraPages.concat(meals.map((m) => m.name), afterPages).map((name, i) => `<li><span>${i + 1}</span>${esc(name)}</li>`).join('')}</ol>
          ${anyOptions ? `<p class="ds-cover-note">${optNote}</p>` : '<p class="ds-cover-note"></p>'}
        </div>
      </section>`;
    const mealPage = (m, i) => {
      const groups = mealGroups(m);
      // Cuantos más alimentos, más compacto, para que todo quepa en su página.
      const n = groups.reduce((t, g) => t + g.rows.length + 0.6, 0) + (m.vegFree ? 1 : 0);
      const dens = n > 11 ? ' ds-xdense' : n > 7 ? ' ds-dense' : n <= 4.5 ? ' ds-sparse' : '';
      return `<section class="ds-page${dens}">
        ${top}
        <div class="ds-main">
          <span class="ds-kicker">Comida ${i + 1} de ${meals.length}</span>
          <h2 class="ds-title">${esc(m.name)}</h2>
          <span class="ds-rule"></span>
          <div class="ds-groups">${groups.map((g) => {
            const many = g.key !== 'extra' && g.rows.length > 1;
            const tone = groupTone(g);
            return `<div class="ds-group ds-${g.key}" style="--rows:${g.rows.length + 1}${tone ? `;--ds-accent:${tone}` : ''}">
              <div class="ds-glabel"><i></i><b>${ROLE_LABEL[g.key]}</b>${many ? `<em>${g.rows.length} opciones · elige una</em>` : g.key === 'extra' ? '<em>además</em>' : ''}</div>
              <div class="ds-items">${g.rows.map((r, j) => `${many && j ? '<div class="ds-or"><span>o</span></div>' : ''}<div class="ds-item"><span class="ds-g">${fmtNum(Number(r.it.grams) || 0, 0)}<small>${unitOf(r.f)}</small></span><span class="ds-name">${esc(r.f.name)}${cookedGrams(r.f, r.it.grams) ? `<small class="ds-cooked">≈ ${cookedGrams(r.f, r.it.grams)} g ya cocinado</small>` : ''}</span></div>`).join('')}</div>
            </div>`;
          }).join('')}
          ${m.vegFree ? '<div class="ds-veg"><span>🥗</span><div><b>Verdura libre</b>Puedes añadir hasta 150 g de verdura, la que quieras.</div></div>' : ''}
          </div>
        </div>
        ${foot(firstMeal + i, [groups.some((g) => g.key !== 'extra' && g.rows.length > 1) ? optNote : '', groups.some((g) => g.rows.some((r) => cookedGrams(r.f, r.it.grams))) ? 'Pesa los alimentos en crudo; el peso cocinado es orientativo.' : ''].filter(Boolean).join(' '))}
      </section>`;
    };
    const page = (n, kicker, title, inner, cls = '', footTxt = 'David Orihuela · Entrenador Online') => `<section class="ds-page ${cls}">
        ${top}
        <div class="ds-main">
          <span class="ds-kicker">${kicker}</span>
          <h2 class="ds-title">${title}</h2>
          <span class="ds-rule"></span>
          ${inner}
        </div>
        ${foot(n, footTxt)}
      </section>`;
    let n = 1;
    const out = [cover];
    if (hasData) out.push(page(++n, 'Tu progreso', 'Tus datos', dataPage(c, weights)));
    if (t) {
      const split = macroSplit(t);
      const w = Store.lastMeasurement(c.id);
      const kg = w && Number(w.weight) > 0 ? Number(w.weight) : null;
      const di = deficitInfo(t);
      const tone = { protein: 'var(--ds-p)', carbs: 'var(--ds-c)', fat: 'var(--ds-f)' };
      const order = ['protein', 'carbs', 'fat'].map((k) => split.find((m) => m.key === k));
      out.push(page(++n, 'Tus números', 'Tu plan', `<div class="ds-plan">
          <div class="ds-kpis">
            <div class="ds-kpi"><span>Calorías al día</span><b>${fmtNum(t.kcal, 0)}<small>kcal</small></b></div>
            ${Number(t.maintenance) > 0 ? `<div class="ds-kpi"><span>Mantenimiento</span><b>${fmtNum(t.maintenance, 0)}<small>kcal</small></b></div>` : ''}
            ${di ? `<div class="ds-kpi ds-kpi-${di.kind}"><span>${di.label}</span><b>${di.kind === 'mant' ? '0' : `${di.kind === 'deficit' ? '−' : '+'}${fmtNum(Math.abs(di.diff), 0)}`}<small>kcal · ${di.pct} %</small></b></div>` : ''}
          </div>
          <table class="ds-table">
            <thead><tr><th>Macronutriente</th><th>Gramos</th><th>Kcal</th><th>%</th>${kg ? '<th>g/kg</th>' : ''}</tr></thead>
            <tbody>${order.map((m) => `<tr style="--ds-accent:${tone[m.key]}"><td><i></i>${m.label}</td><td><b>${m.grams} g</b></td><td>${m.kcal}</td><td>${fmtNum(m.pct, 0)} %</td>${kg ? `<td>${fmtNum(m.grams / kg, 1)}</td>` : ''}</tr>`).join('')}</tbody>
            <tfoot><tr><td>Total</td><td></td><td><b>${fmtNum(order.reduce((x, m) => x + m.kcal, 0), 0)}</b></td><td>100 %</td>${kg ? '<td></td>' : ''}</tr></tfoot>
          </table>
          <div class="ds-macrobar">${order.map((m) => `<span style="flex:${m.pct};background:${tone[m.key]}"></span>`).join('')}</div>
          ${di && di.kind === 'deficit' ? `<p class="ds-plan-note">Comes unas <b>${fmtNum(di.diff, 0)} kcal menos</b> de las que gastas cada día: es lo que te hace perder grasa de forma progresiva, sin pasar hambre ni perder rendimiento.</p>`
            : di && di.kind === 'superavit' ? `<p class="ds-plan-note">Comes unas <b>${fmtNum(-di.diff, 0)} kcal más</b> de las que gastas: un pequeño superávit para ganar masa muscular.</p>`
            : di ? '<p class="ds-plan-note">Comes lo mismo que gastas: el objetivo es mantener tu peso mientras mejoras tu composición.</p>' : ''}
          ${kg ? `<p class="ds-plan-small">g/kg calculado con tu último peso: ${fmtNum(kg)} kg.</p>` : ''}
        </div>`));
    }
    n += 0;
    out.push(...meals.map(mealPage));
    n += meals.length;
    const plate = `<div class="ds-plate">
        <svg viewBox="0 0 200 200" class="ds-plate-svg" aria-hidden="true">
          <circle cx="100" cy="100" r="96" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.18)" stroke-width="2"/>
          <path d="M100 100 L100 12 A88 88 0 0 0 100 188 Z" fill="#f87171"/>
          <path d="M100 100 L100 12 A88 88 0 0 1 188 100 Z" fill="#4ade80"/>
          <path d="M100 100 L188 100 A88 88 0 0 1 100 188 Z" fill="#fb923c"/>
          <line x1="100" y1="10" x2="100" y2="190" stroke="#121722" stroke-width="3"/><line x1="100" y1="100" x2="190" y2="100" stroke="#121722" stroke-width="3"/>
          <text x="54" y="104" text-anchor="middle" class="ds-pl">½</text><text x="140" y="68" text-anchor="middle" class="ds-pl">¼</text><text x="140" y="146" text-anchor="middle" class="ds-pl">¼</text>
        </svg>
        <div class="ds-plate-legend">
          <div style="--ds-accent:#f87171"><b>½ Proteína</b><span>Pollo, pavo, ternera magra, pescado, huevos, tofu…</span></div>
          <div style="--ds-accent:#4ade80"><b>¼ Verdura</b><span>Ensalada, verduras a la plancha, al horno o al vapor.</span></div>
          <div style="--ds-accent:#fb923c"><b>¼ Hidrato</b><span>Arroz, pasta, patata, pan integral, legumbres…</span></div>
          <div style="--ds-accent:#facc15"><b>+ Un toque de grasa</b><span>Un chorrito de aceite de oliva, unas aceitunas o un poco de aguacate.</span></div>
        </div>
      </div>
      <p class="ds-plan-note">Úsalo cuando comas fuera o tengas que improvisar: divide el plato en estas partes y no te equivocarás.</p>`;
    out.push(page(++n, 'Para comer fuera o improvisar', 'Tu plato improvisado', plate));
    const L = waterLiters(c.id);
    const lastW = weights[weights.length - 1];
    const waterWhy = lastW ? `Según tu peso (${fmtNum(lastW.weight)} kg)${Number(c.height) > 0 ? ` y tu altura (${fmtNum(c.height, 0)} cm)` : ''}` : '';
    const water = `<div class="ds-water">
        <div class="ds-water-big"><b>${fmtNum(L, 1)} L</b><span>de agua al día</span>${waterWhy ? `<em>${esc(waterWhy)}</em>` : ''}</div>
        <ul class="ds-tips">
          <li>Empieza el día con un vaso de agua al levantarte.</li>
          <li>Ten siempre una botella a mano y rellénala.</li>
          <li>Bebe un vaso con cada comida.</li>
          <li>Añade 500-750 ml por cada hora de entrenamiento.</li>
          <li>Si la orina es clara, vas bien hidratado.</li>
          <li>Infusiones y bebidas zero cuentan, pero la base es el agua.</li>
        </ul>
      </div>`;
    const suppsBox = supps.length ? `<h3 class="ds-sub">Suplementación</h3><ul class="ds-supps">${supps.map((x) => {
        const [name, ...rest] = x.split(/\s[·:\-–]\s|:\s/);
        return `<li><b>${esc(name)}</b>${rest.length ? `<span>${esc(rest.join(' · '))}</span>` : ''}</li>`;
      }).join('')}</ul>` : '';
    out.push(page(++n, supps.length ? 'Hábitos' : 'Hábitos', supps.length ? 'Agua y suplementación' : 'Hidratación', water + suppsBox, supps.length ? 'ds-dense-info' : ''));
    if (notes) out.push(page(++n, 'Para tener en cuenta', 'Indicaciones', `<div class="ds-notes">${esc(notes).replace(/\n/g, '<br>')}</div>`));
    return `<article class="ds">${out.join('')}</article>`;
  }

  /** Página «Tus datos» del PDF: altura, peso, IMC y evolución del peso con gráfica. */
  function dataPage(c, weights) {
    const cm = Number(c.height) > 0 ? Number(c.height) : null;
    const last = weights[weights.length - 1], first = weights[0];
    const kg = last ? Number(last.weight) : null;
    const imc = kg && cm ? kg / Math.pow(cm / 100, 2) : null;
    const diff = weights.length >= 2 ? Number(last.weight) - Number(first.weight) : null;
    const kpi = (label, val, unit, cls = '') => `<div class="ds-kpi ${cls}"><span>${label}</span><b>${val}${unit ? `<small>${unit}</small>` : ''}</b></div>`;
    const kpis = [
      cm ? kpi('Altura', fmtNum(cm, 0), 'cm') : '',
      kg ? kpi('Peso actual', fmtNum(kg), 'kg') : '',
      imc ? kpi('IMC', fmtNum(imc, 1), '') : '',
      diff !== null ? kpi(`Desde el ${esc(U.fmtDateShort(first.date))}`, `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${fmtNum(Math.abs(diff))}`, 'kg', diff < 0 ? 'ds-kpi-deficit' : diff > 0 ? 'ds-kpi-superavit' : '') : '',
    ].filter(Boolean).join('');
    let chart = '';
    if (weights.length >= 2) {
      const Wd = 600, Hd = 205, padL = 46, padR = 18, padT = 18, padB = 34;
      const vals = weights.map((m) => Number(m.weight));
      let lo = Math.min(...vals), hi = Math.max(...vals);
      const span = Math.max(2, hi - lo); lo -= span * 0.2; hi += span * 0.2;
      const t0 = U.parseDate(first.date).getTime(), t1 = U.parseDate(last.date).getTime();
      const X = (m) => padL + (t1 > t0 ? ((U.parseDate(m.date).getTime() - t0) / (t1 - t0)) : 0.5) * (Wd - padL - padR);
      const Y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (Hd - padT - padB);
      const pts = weights.map((m) => [X(m), Y(Number(m.weight))]);
      const ticks = [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15];
      const showLabel = (i) => weights.length <= 7 || i === 0 || i === weights.length - 1 || i % Math.ceil(weights.length / 6) === 0;
      chart = `<svg class="ds-chart" viewBox="0 0 ${Wd} ${Hd}" aria-hidden="true">
        <defs><linearGradient id="dsline" x1="0" x2="1"><stop offset="0" stop-color="#6e8bff"/><stop offset=".55" stop-color="#22d3ee"/><stop offset="1" stop-color="#3ee6a0"/></linearGradient>
        <linearGradient id="dsarea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22d3ee" stop-opacity=".28"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient></defs>
        ${ticks.map((v) => `<line x1="${padL}" x2="${Wd - padR}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="rgba(255,255,255,.08)"/><text x="${padL - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" class="ds-axis">${fmtNum(v, 0)}</text>`).join('')}
        <path d="M${pts.map((p) => p.map((x) => x.toFixed(1)).join(' ')).join('L')}L${pts[pts.length - 1][0].toFixed(1)} ${Hd - padB}L${pts[0][0].toFixed(1)} ${Hd - padB}Z" fill="url(#dsarea)"/>
        <path d="M${pts.map((p) => p.map((x) => x.toFixed(1)).join(' ')).join('L')}" fill="none" stroke="url(#dsline)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
        ${pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5" fill="#121722" stroke="#22d3ee" stroke-width="2.5"/>${showLabel(i) ? `<text x="${p[0].toFixed(1)}" y="${(p[1] - 11).toFixed(1)}" text-anchor="middle" class="ds-val">${fmtNum(vals[i])}</text><text x="${p[0].toFixed(1)}" y="${Hd - 12}" text-anchor="middle" class="ds-axis">${esc(U.fmtDateShort(weights[i].date))}</text>` : ''}`).join('')}
      </svg>`;
    }
    const rows = weights.slice(-5).map((m, i, arr) => {
      const prev = i > 0 ? arr[i - 1] : weights[weights.length - arr.length - 1];
      const d = prev ? Number(m.weight) - Number(prev.weight) : null;
      return `<tr><td>${esc(fmtDate(m.date))}</td><td><b>${fmtNum(m.weight)} kg</b></td><td class="${d < 0 ? 'down' : d > 0 ? 'up' : ''}">${d === null ? '—' : `${d > 0 ? '+' : d < 0 ? '−' : ''}${fmtNum(Math.abs(d))} kg`}</td></tr>`;
    }).reverse().join('');
    return `<div class="ds-plan ds-data">
        ${kpis ? `<div class="ds-kpis">${kpis}</div>` : ''}
        ${chart ? `<h3 class="ds-sub">Evolución de tu peso</h3>${chart}` : weights.length === 1 ? '<p class="ds-plan-note">Este es tu punto de partida. En las próximas revisiones verás aquí tu evolución.</p>' : ''}
        ${weights.length >= 2 ? `<table class="ds-table ds-weights"><thead><tr><th>Fecha</th><th>Peso</th><th>Cambio</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
      </div>`;
  }

  /** Abre el diálogo de impresión con la hoja de la dieta (desde ahí se guarda como PDF). */
  function printDiet(clientId) {
    const c = Store.get('clients', clientId);
    const d = Store.dietFor(clientId);
    if (!c || !d) return;
    let root = document.getElementById('print-root');
    if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
    root.innerHTML = dietSheet(c, d);
    const prevTitle = document.title;
    document.title = `Dieta ${c.name}`; // nombre propuesto para el PDF
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); document.title = prevTitle; root.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 50);
  }


  async function copyText(text, msg) {
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
    UI.toast(msg);
  }

  /** Borra la dieta completa del cliente (objetivos, comidas e indicaciones), con opción de deshacer. */
  function deleteDiet(clientId) {
    const d = Store.dietFor(clientId);
    if (!d) return;
    UI.confirm({ title: 'Eliminar toda la dieta', message: 'Se borrarán los objetivos de calorías y macros, todas las comidas con sus alimentos y las indicaciones. ¿Continuar?', confirmLabel: 'Eliminar todo' })
      .then((ok) => {
        if (!ok) return;
        const copy = Object.assign({}, d);
        Store.remove('diets', d.id);
        state.openMeal = null; state.editMealCount = false;
        App.render();
        UI.toast('Dieta eliminada', { label: 'Deshacer', onClick: () => { Store.add('diets', copy); App.render(); } });
      });
  }

  /** Suplementos habituales para marcar en la dieta, con la dosis propuesta. */
  const SUPPLEMENTS = [
    { k: 'whey', n: 'Proteína whey', d: '30 g después de entrenar' },
    { k: 'creatina', n: 'Creatina monohidrato', d: '5 g al día' },
    { k: 'eaa', n: 'Aminoácidos esenciales (EAA)', d: '10 g durante el entreno' },
    { k: 'bcaa', n: 'BCAA', d: '5–10 g durante el entreno' },
    { k: 'glutamina', n: 'Glutamina', d: '5 g al día' },
    { k: 'multi', n: 'Multivitamínico', d: '1 cápsula con el desayuno' },
    { k: 'omega3', n: 'Omega 3', d: '2 cápsulas con la comida' },
    { k: 'vitd', n: 'Vitamina D3', d: '2000 UI con el desayuno' },
    { k: 'magnesio', n: 'Magnesio', d: '300 mg antes de dormir' },
    { k: 'zinc', n: 'Zinc', d: '15 mg con la cena' },
    { k: 'cafeina', n: 'Cafeína', d: '200 mg antes de entrenar' },
    { k: 'pre', n: 'Preentreno', d: '1 cacito 20 min antes de entrenar' },
    { k: 'betaalanina', n: 'Beta-alanina', d: '3 g al día' },
    { k: 'citrulina', n: 'Citrulina malato', d: '6 g antes de entrenar' },
    { k: 'carbos', n: 'Carbohidratos intraentreno', d: '30 g durante el entreno' },
    { k: 'electrolitos', n: 'Electrolitos', d: '1 sobre durante el entreno' },
    { k: 'colageno', n: 'Colágeno', d: '10 g al día' },
    { k: 'melatonina', n: 'Melatonina', d: '1 mg antes de dormir' },
    { k: 'ashwagandha', n: 'Ashwagandha', d: '300 mg al día' },
  ];
  /** Líneas de suplementación de la dieta: las marcadas y las escritas a mano. */
  function suppLines(d) {
    if (!d) return [];
    const marked = (d.suppList || []).map((x) => { const s = SUPPLEMENTS.find((y) => y.k === x.k); return s ? `${s.n} · ${(x.dose || s.d).trim()}` : ''; }).filter(Boolean);
    return marked;
  }
  function suppChecklist(d) {
    const chosen = new Map(((d && d.suppList) || []).map((x) => [x.k, x.dose]));
    return `<div class="supp-list">${SUPPLEMENTS.map((sp) => {
      const on = chosen.has(sp.k);
      return `<label class="supp-item${on ? ' on' : ''}">
          <input type="checkbox" name="supp-${sp.k}" ${on ? 'checked' : ''} data-supp="${sp.k}">
          <span class="supp-name">${esc(sp.n)}</span>
          <input type="text" class="supp-dose" name="dose-${sp.k}" value="${esc(on ? chosen.get(sp.k) || sp.d : '')}" placeholder="${esc(sp.d)}" aria-label="Dosis de ${esc(sp.n)}">
        </label>`;
    }).join('')}</div>`;
  }

  function submitDietForm(form) {
    const clientId = form.dataset.client;
    const suppList = SUPPLEMENTS.filter((sp) => form.elements[`supp-${sp.k}`] && form.elements[`supp-${sp.k}`].checked)
      .map((sp) => ({ k: sp.k, dose: (form.elements[`dose-${sp.k}`].value || '').trim() || sp.d }));
    const d = Store.dietFor(clientId);
    if (d) Store.update('diets', d.id, { suppList });
    else Store.add('diets', { clientId, text: '', suppList });
    UI.toast('Suplementación guardada');
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
      <div class="card-header"><h2>Fotos ${photos.length ? `<span class="muted" style="font:500 1rem 'Archivo',sans-serif">${photos.length}</span>` : ''}</h2></div>
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

  /** Días que faltan para su próximo cumpleaños (0 = hoy) y los años que cumple, o null sin fecha. */
  const BIRTHDAY_NOTICE = 7;
  function birthdayInfo(c) {
    if (!c || !c.birthDate || !/^\d{4}-\d{2}-\d{2}/.test(c.birthDate)) return null;
    const b = U.parseDate(c.birthDate);
    const now = U.parseDate(today());
    let next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
    if (b.getMonth() === 1 && b.getDate() === 29 && next.getMonth() !== 1) next = new Date(now.getFullYear(), 1, 28); // 29 de febrero
    if (next < now) next = new Date(now.getFullYear() + 1, b.getMonth(), b.getDate());
    const days = Math.round((next - now) / 86400000);
    return { days, turns: next.getFullYear() - b.getFullYear(), date: U.toISODate(next), greeted: c.bdayGreeted === U.toISODate(next) };
  }
  function birthdayText(bi) {
    return bi.days === 0 ? `¡Hoy cumple ${bi.turns} años!` : bi.days === 1 ? `Mañana cumple ${bi.turns} años` : `Cumple ${bi.turns} años el ${fmtDate(bi.date)} (en ${bi.days} días)`;
  }
  /** Abre su chat de WhatsApp sin texto: la felicitación la escribes tú. */
  function birthdayWa(c) {
    return U.waLink(c.phone) || 'https://wa.me/';
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
    const birthdays = Store.clients()
      .filter((c) => clientStatus(c) !== 'inactivo')
      .map((c) => ({ c, bi: birthdayInfo(c), kind: 'cumple' }))
      .filter((x) => x.bi && x.bi.days <= BIRTHDAY_NOTICE)
      .sort((a, b) => a.bi.days - b.bi.days);
    const health = Store.clients()
      .filter((c) => clientStatus(c) !== 'inactivo' && !c.healthAsked && clientFlags(c).length)
      .map((c) => ({ c, flags: clientFlags(c), kind: 'salud' }));
    return pay.concat(health, birthdays, answers, reviews, plans, tasks);
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

  /** Aviso grande arriba del panel: personas que han rellenado el cuestionario y aún no son clientes. */
  function newFormsBanner() {
    const list = Store.data.forms.filter((f) => f.answeredAt && !f.clientId && !f.dismissed)
      .sort((a, b) => (b.answeredAt || '').localeCompare(a.answeredAt || ''));
    if (!list.length) return '';
    return `<section class="card new-forms" id="nuevos-cuestionarios">
        <div class="nf-head">
          <span class="nf-icon">${U.icon('file')}</span>
          <div><h2>${list.length === 1 ? '¡Te han rellenado el cuestionario!' : `¡${list.length} personas han rellenado el cuestionario!`}</h2>
          <p class="muted">Revisa sus respuestas y dalo de alta como cliente.</p></div>
        </div>
        <ul class="nf-list">${list.map((f) => {
          const who = formName(f) || 'Sin nombre';
          const goal = ((f.items || []).find((x) => /objetivo/i.test(x.q)) || {}).a;
          return `<li class="nf-item">
            <span class="avatar">${esc(who.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join(''))}</span>
            <div class="grow">
              <strong>${esc(who)}</strong>
              <div class="meta">Respondió el ${esc(fmtDate(f.answeredAt))}${goal ? ` · ${esc(goal)}` : ''}</div>
              ${healthFlags(f.items).length ? `<div class="nf-flags">${healthFlags(f.items).map((x) => `<span class="badge danger">${U.icon('alert')}${esc(x.label)}: ${esc(x.a)}</span>`).join('')}</div>` : ''}
            </div>
            <div class="nf-actions">
              <button class="btn sm" data-action="form-answers" data-id="${f.id}">${U.icon('file')}Ver respuestas</button>
              <button class="btn sm primary" data-action="form-client" data-id="${f.id}">${U.icon('plus')}Dar de alta</button>
              <button class="icon-btn" data-action="form-dismiss" data-id="${f.id}" aria-label="Quitar el aviso de ${esc(who)}" title="Quitar aviso (no se da de alta)">${U.icon('close')}</button>
            </div>
          </li>`;
        }).join('')}</ul>
      </section>`;
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
        ${newFormsBanner()}
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
    const bdayAlerts = alerts.filter((a) => a.kind === 'cumple');
    const healthAlerts = alerts.filter((a) => a.kind === 'salud');
    const formAlerts = []; // los formularios de personas nuevas van en el aviso grande de arriba
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
      section('salud', 'Preguntar por su salud', healthAlerts.length, '',
        `<ul class="list task-list">${healthAlerts.map((a) => `
          <li class="task review">
            ${avatar(a.c)}
            <div class="grow">
              <a class="title" href="#/clientes/${a.c.id}" style="color:inherit;text-decoration:none">${esc(a.c.name)}</a>
              <div class="nf-flags">${a.flags.map((x) => `<span class="badge danger">${U.icon('alert')}${esc(x.label)}: ${esc(x.a)}</span>`).join('')}</div>
            </div>
            <div class="review-actions">
              ${U.waLink(a.c.phone) ? `<a class="btn sm wa-btn" href="${U.waLink(a.c.phone)}" target="_blank" rel="noopener">${U.icon('message')}WhatsApp</a>` : ''}
              <button class="btn sm primary" data-action="health-asked" data-client="${a.c.id}" data-value="1">${U.icon('check')}Ya lo he hablado</button>
            </div>
          </li>`).join('')}</ul>`,
        'Nadie tiene lesiones, medicación ni alergias pendientes de preguntar'),
      section('cumpleanos', '🎂 Cumpleaños', bdayAlerts.length, '',
        `<ul class="list task-list">${bdayAlerts.map((a) => `
          <li class="task review bday${a.bi.days === 0 ? ' today' : ''}">
            ${avatar(a.c)}
            <div class="grow">
              <a class="title" href="#/clientes/${a.c.id}" style="color:inherit;text-decoration:none">${esc(a.c.name)}</a>
              <div class="meta"><span>${esc(birthdayText(a.bi))}</span></div>
            </div>
            <div class="review-actions">
              ${a.bi.greeted ? badge('Felicitado', 'success') : a.bi.days === 0 ? `<a class="btn sm primary wa-solid" href="${birthdayWa(a.c)}" target="_blank" rel="noopener" data-action="bday-greet" data-client="${a.c.id}">${U.icon('message')}Felicitar</a>` : badge(a.bi.days === 1 ? 'Mañana' : `En ${a.bi.days} días`, 'info')}
            </div>
          </li>`).join('')}</ul>`,
        `Ningún cumpleaños en los próximos ${BIRTHDAY_NOTICE} días`),
      section('cuestionarios', 'Cuestionarios respondidos', answerAlerts.length + formAlerts.length, formAlerts.length ? '<a class="btn sm" href="#/formularios">Formularios</a>' : '',
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
          </li>`).join('')}${formAlerts.map((f) => {
          const who = formName(f) || 'Sin nombre';
          return `<li class="task review">
            <span class="avatar">${esc(who.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join(''))}</span>
            <div class="grow">
              <span class="title">${esc(who)}</span>
              <div class="meta"><span>Formulario · aún no es cliente · respondió el ${esc(fmtDate(f.answeredAt))}</span></div>
            </div>
            <div class="review-actions">
              ${badge('Nuevo', 'success')}
              <button class="btn sm primary" data-action="form-answers" data-id="${f.id}">${U.icon('file')}Ver respuestas</button>
            </div>
          </li>`;
        }).join('')}</ul>`,
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

      ${newFormsBanner()}
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
          <td><div class="name-cell">${avatar(c)}<div><div style="font-weight:600">${esc(c.name)}</div>${clientStatus(c) !== 'activo' ? statusBadge(c) : ''}${clientFlags(c).length && !c.healthAsked ? `<span class="badge danger hf-badge" title="${esc(flagsText(clientFlags(c)))}">${U.icon('alert')}Preguntar: ${esc(clientFlags(c).map((f) => f.label.split(' ')[0].toLowerCase()).join(', '))}</span>` : ''}</div></div></td>
          <td class="hide-sm">${c.email ? esc(c.email) : '—'}</td>
          <td class="hide-sm">${c.phone ? esc(c.phone) : '—'}</td>
          <td class="num">${c.rate ? money(c.rate) : '<span class="muted">—</span>'}</td>
          <td>${di ? `${esc(U.fmtDateShort(di.date))} ${di.status !== 'al-dia' ? dueBadge(di) : ''}` : '<span class="muted">—</span>'}</td>
          <td class="hide-sm">${(() => { const ri = Store.reviewInfo(c); return ri ? `${esc(U.fmtDateShort(ri.date))} ${badge(ri.type === 'mensual' ? 'Mensual' : 'Seguimiento', REVIEW_STATUS[ri.status].badge)}` : '<span class="muted">—</span>'; })()}</td>
          <td class="hide-sm">${last ? esc(fmtDate(last.date)) : '<span class="muted">—</span>'}</td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }

  /** Lo que conviene preguntar al cliente según su cuestionario: lesión, salud o medicación y alergias. */
  const HEALTH_FLAGS = [
    { key: 'lesion', label: 'Lesión o dolor', re: /lesi[oó]n|dolor/i },
    { key: 'salud', label: 'Salud o medicación', re: /salud|medicaci/i },
    { key: 'alergia', label: 'Alergia o intolerancia', re: /alergi|intoleran/i },
  ];
  function healthFlags(items) {
    const out = [];
    for (const f of HEALTH_FLAGS) {
      const it = (items || []).find((x) => f.re.test(x.q || ''));
      const a = it && String(it.a || '').trim();
      if (a && !/^no\b|^ninguna?\b|^nada\b/i.test(a)) out.push({ key: f.key, label: f.label, a });
    }
    return out;
  }
  const clientFlags = (c) => healthFlags(c && c.questionnaire && c.questionnaire.items);
  /** Texto para el campo «Salud» de la ficha: «Lesión o dolor: Sí, leve · Alergia o intolerancia: Lactosa». */
  const flagsText = (flags) => flags.map((f) => `${f.label}: ${f.a}`).join(' · ');

  function healthFlagsCard(c) {
    const flags = clientFlags(c);
    if (!flags.length) return '';
    const asked = c.healthAsked;
    return `<div class="health-flags${asked ? ' asked' : ''}">
        <div class="hf-head">${U.icon('alert')}<strong>${asked ? `Hablado con ${esc(c.name.split(' ')[0])} el ${esc(fmtDate(asked))}` : `Pregúntale por esto: lo marcó en el cuestionario`}</strong></div>
        <ul class="hf-list">${flags.map((f) => `<li><span class="hf-label">${esc(f.label)}</span><span class="hf-answer">${esc(f.a)}</span></li>`).join('')}</ul>
        <div class="hf-actions">
          ${asked ? `<button class="btn sm" data-action="health-asked" data-client="${c.id}" data-value="">Volver a marcar como pendiente</button>`
            : `${U.waLink(c.phone) ? `<a class="btn sm wa-btn" href="${U.waLink(c.phone)}" target="_blank" rel="noopener">${U.icon('message')}Preguntarle por WhatsApp</a>` : ''}
               <button class="btn sm primary" data-action="health-asked" data-client="${c.id}" data-value="1">${U.icon('check')}Ya lo he hablado</button>`}
        </div>
      </div>`;
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
        ${c.health && c.health.trim() ? `<div class="health-note">${U.icon('alert')}<div><strong>Salud · tenlo siempre presente</strong><p>${esc(c.health.trim())}</p></div></div>` : ''}
        ${healthFlagsCard(c)}
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
        <div class="card stat"><div class="stat-label">Próximo pago</div><div class="stat-value" style="font-size:1.8rem">${di ? esc(U.fmtDateShort(di.date)) : '—'}</div><div class="stat-sub">${di ? esc(dueText(di).replace(/ \(.*\)$/, '')) : clientStatus(c) === 'activo' ? 'Sin fecha' : esc(CLIENT_STATUS[clientStatus(c)].label)}</div></div>
        <div class="card stat"><div class="stat-label">Último pago</div><div class="stat-value">${lastPay ? money(lastPay.amount) : '—'}</div><div class="stat-sub">${lastPay ? esc(fmtDate(lastPay.date)) : 'Sin pagos'}</div></div>
        <div class="card stat"><div class="stat-label">Último peso</div><div class="stat-value">${lastM ? `${fmtNum(lastM.weight)} kg` : '—'}</div><div class="stat-sub">${lastM ? `${esc(U.fmtDateShort(lastM.date))} · hace ${plural(U.daysBetween(lastM.date, t), 'día', 'días')}` : 'Sin peso registrado'}</div></div>
        <div class="card stat stat-height"><div class="stat-label">Altura</div><div class="stat-value">${Number(c.height) > 0 ? `${fmtNum(c.height)} cm` : '—'}</div><div class="stat-sub">${imc ? `IMC ${fmtNum(imc)}` : Number(c.height) > 0 ? 'Añade su peso para ver el IMC' : 'Sin altura'}</div><button class="btn sm review-done" data-action="set-height" data-client="${c.id}">${U.icon(Number(c.height) > 0 ? 'edit' : 'plus')}${Number(c.height) > 0 ? 'Cambiar' : 'Añadir'}</button></div>
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

  const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Gemelos', 'Aductores', 'Antebrazo', 'Core / Abdomen', 'Cuerpo completo', 'Cardio', 'Movilidad / Estiramientos', 'Otros'];

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

  /** Fotos del ejercicio (inicio y final del movimiento), si las tiene. */
  const STOP = new Set(['con', 'de', 'del', 'en', 'a', 'al', 'la', 'el', 'los', 'las', 'y', 'o', 'por', 'para', 'sin', 'una', 'un']);
  const words = (t) => normalizeText(t).replace(/[^a-z0-9ñ ]+/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
  const guessCache = new Map();
  /** Foto para un ejercicio añadido a mano: la del ejercicio de serie con el nombre más parecido. */
  function guessImg(name, group) {
    const key = `${name}|${group}`;
    if (guessCache.has(key)) return guessCache.get(key);
    const a = new Set(words(name));
    let best = '', score = 0;
    for (const b of window.LIBRARY_DEFAULT || []) {
      if (!b.img) continue;
      const w = new Set(words(b.name));
      const inter = [...a].filter((x) => w.has(x)).length;
      if (!inter) continue;
      const sc = inter / new Set([...a, ...w]).size + (group && b.group === group ? 0.15 : 0);
      if (sc > score) { score = sc; best = b.img; }
    }
    const out = score >= 0.45 ? best : '';
    guessCache.set(key, out);
    return out;
  }
  /** Foto de un ejercicio: la suya, la elegida a mano o, si no, la del ejercicio más parecido. */
  const imgOf = (ex) => (!ex ? '' : ex.img || (ex.builtIn || ex.imgOff ? '' : guessImg(ex.name, ex.group)));
  const exImg = (ex, n) => (imgOf(ex) ? `img/ejercicios/${imgOf(ex)}_${n}.webp` : '');
  /** Miniatura animada: alterna la posición inicial y la final para ver el movimiento. */
  function exThumb(ex, cls = '') {
    if (!imgOf(ex)) return '';
    return `<span class="ex-thumb ${cls}" aria-hidden="true"><img src="${exImg(ex, 0)}" alt="" loading="lazy" decoding="async"><img class="ex-thumb-b" src="${exImg(ex, 1)}" alt="" loading="lazy" decoding="async"></span>`;
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
      return empty('book', '<strong>La biblioteca está vacía.</strong>');
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
          <button class="lib-card${imgOf(ex) ? ' has-img' : ''}" data-action="lib-open" data-id="${ex.id}">
            ${exThumb(ex)}
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
        { name: 'img', label: 'Foto', type: 'select', full: true, options: photoOptions(), hint: 'Elige la foto de un ejercicio de la biblioteca, o deja «Automática» para usar la del más parecido por nombre.' },
      ],
      values: existing ? Object.assign({}, existing, { img: existing.imgOff ? '__none' : existing.img || '' }) : (state.libGroup !== 'todos' ? { group: state.libGroup } : {}),
      onReady: (dlg) => {
        const sel = dlg.querySelector('#f-img');
        const prev = document.createElement('div');
        prev.className = 'ex-photo-preview';
        sel.closest('.field').appendChild(prev);
        const paint = () => {
          const name = dlg.querySelector('#f-name').value;
          const group = dlg.querySelector('#f-group').value;
          const img = sel.value === '__none' ? '' : sel.value || guessImg(name, group);
          prev.innerHTML = img ? `<img src="img/ejercicios/${img}_0.webp" alt=""><img src="img/ejercicios/${img}_1.webp" alt="">` : '<span class="muted">Sin foto</span>';
        };
        sel.addEventListener('change', paint);
        dlg.querySelector('#f-name').addEventListener('change', paint);
        paint();
      },
      submitLabel: existing ? 'Guardar' : 'Añadir',
      onDelete: existing ? async () => {
        const ok = await UI.confirm({ title: 'Eliminar ejercicio', message: `¿Eliminar «${esc(existing.name)}» de la biblioteca? Las rutinas que ya lo usan no cambian.` });
        if (!ok) return;
        Store.removeLibraryExercise(id);
        UI.toast('Ejercicio eliminado');
        App.render();
      } : null,
      onSubmit: (v) => {
        v.imgOff = v.img === '__none';
        if (v.imgOff) v.img = '';
        if (existing) Store.update('library', id, v);
        else Store.add('library', v);
        UI.toast(existing ? 'Ejercicio actualizado' : 'Ejercicio añadido');
        App.render();
      },
    });
  }

  /** Opciones del selector de foto: las fotos de los ejercicios de serie, por grupo. */
  function photoOptions() {
    const seen = new Set();
    const opts = [{ value: '', label: 'Automática (según el nombre)' }, { value: '__none', label: 'Sin foto' }];
    for (const b of window.LIBRARY_DEFAULT || []) {
      if (!b.img || seen.has(b.img)) continue;
      seen.add(b.img);
      opts.push({ value: b.img, label: `${b.group} · ${b.name}` });
    }
    return opts;
  }

  function openLibraryExercise(id) {
    const ex = Store.get('library', id);
    if (!ex) return;
    const row = (k, v) => (v ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : '');
    UI.openModal({
      title: ex.name,
      body: `<div class="lib-detail">
        ${imgOf(ex) ? `<div class="ex-photos"><figure><img src="${exImg(ex, 0)}" alt="${esc(ex.name)}: posición inicial"><figcaption>Inicio</figcaption></figure><figure><img src="${exImg(ex, 1)}" alt="${esc(ex.name)}: posición final"><figcaption>Final</figcaption></figure></div>` : ''}
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

  const FOOD_CATEGORIES = ['Carnes y aves', 'Embutidos y fiambres', 'Pescados y mariscos', 'Huevos', 'Proteína vegetal', 'Lácteos', 'Cereales, pan y pasta', 'Tortitas', 'Tubérculos', 'Legumbres', 'Frutas', 'Frutos secos y semillas', 'Grasas y aceites', 'Bebidas', 'Suplementos', 'Salsas y condimentos', 'Otros'];

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
      return empty('apple', '<strong>La biblioteca de alimentos está vacía.</strong>');
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
    const kc = blockKcal(block);
    const per100 = kc ? num(f.kcal) : num(f[block.macro]);
    if (!per100) return null;
    const raw = ((kc || Number(block.amount)) / per100) * 100;
    const grams = raw >= 20 ? Math.round(raw / 5) * 5 : Math.max(1, Math.round(raw));
    const k = grams / 100;
    const v = (x) => (num(x) === null ? null : num(x) * k);
    return { grams, kcal: v(f.kcal), protein: v(f.protein), carbs: v(f.carbs), fat: v(f.fat) };
  }

  /**
   * Con equivalencias por calorías: las kcal de referencia del bloque son las que aporta su primer
   * alimento en la cantidad de referencia del macro (p. ej. 25 g de proteína de pechuga de pollo ≈ 120 kcal).
   */
  function blockKcal(b) {
    if (equivBy() !== 'kcal' || b.macro === 'kcal') return null;
    const f0 = (b.foodIds || []).map((id) => Store.get('foods', id)).find((f) => f && num(f[b.macro]) > 0 && num(f.kcal) > 0);
    if (!f0) return null;
    return Math.max(10, Math.round(((Number(b.amount) / num(f0[b.macro])) * num(f0.kcal)) / 10) * 10);
  }

  function blockRef(b) {
    const kc = blockKcal(b);
    if (kc) return `${fmtNum(kc, 0)} kcal`;
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
    return `<div class="block-intro"><p class="muted">Cada bloque reúne alimentos parecidos. La tabla indica cuánto de cada uno equivale ${equivBy() === 'kcal' ? 'a las mismas <strong>calorías</strong> (las de la ración de referencia del primer alimento)' : 'a la misma cantidad de su macronutriente'} (pesos en crudo salvo que el alimento diga otra cosa). Toca un bloque para verlo.</p>${equivSwitch()}</div>
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

  /**
   * Preguntas del cuestionario. «Pregunta | A | B | C | D» se contesta marcando una opción;
   * sin opciones (altura y peso) se escribe el número.
   */
  const DEFAULT_QUESTIONS = [
    'Correo electrónico',
    'Sexo | Hombre | Mujer',
    'Fecha de nacimiento',
    'Altura (cm)',
    'Peso actual (kg)',
    '¿Cuál es tu objetivo principal? | Perder grasa | Ganar músculo | Ganar fuerza o rendimiento | Mejorar mi salud y sentirme mejor',
    '¿Tienes alguna lesión o dolor ahora mismo? | No | Sí, leve, no me limita | Sí, me limita al entrenar | Estoy recuperándome de una lesión',
    '¿Tienes algún problema de salud o tomas medicación? | No | Sí, algún problema de salud | Sí, tomo medicación | Las dos cosas',
    '¿Qué experiencia tienes entrenando? | Ninguna, empiezo de cero | Menos de 1 año | De 1 a 3 años | Más de 3 años',
    '¿Cuántos días a la semana puedes entrenar? | 2 días | 3 días | 4 días | 5 días o más',
    '¿Cuánto tiempo tienes por sesión? | 30–45 minutos | 45–60 minutos | 60–90 minutos | Más de 90 minutos',
    '¿Dónde vas a entrenar? | Gimnasio | En casa con material | En casa sin material | Al aire libre',
    '¿Cómo es tu día a día? | Sentado casi todo el día | Me muevo algo, de pie a ratos | Activo, camino mucho | Trabajo físico intenso',
    '¿Cuántas horas duermes de media? | Menos de 6 horas | De 6 a 7 horas | De 7 a 8 horas | Más de 8 horas',
    '¿Cuántas comidas haces al día? | 2 o menos | 3 | 4 | 5 o más',
    '¿Tienes alergias o intolerancias alimentarias? | No | Lactosa | Gluten | Otra (te la comento por WhatsApp)',
    '¿Cuánta agua bebes al día? | Menos de 1 litro | De 1 a 1,5 litros | De 1,5 a 2 litros | Más de 2 litros',
    '¿Consumes alcohol? | Nunca | Muy de vez en cuando | Los fines de semana | Varias veces por semana',
    '¿Tomas algún suplemento? | Ninguno | Proteína | Creatina | Varios',
  ];
  /** Texto de la pregunta (sin las opciones) y sus opciones de respuesta. */
  const qText = (q) => String(q || '').split('|')[0].trim();
  const qOpts = (q) => String(q || '').split('|').slice(1).map((x) => x.trim()).filter(Boolean).slice(0, 4);

  const questions = () => (Array.isArray(Store.settings.questionnaire) && Store.settings.questionnaire.length ? Store.settings.questionnaire : DEFAULT_QUESTIONS);

  function questionnaireText(c) {
    const coach = (Store.settings.trainerName || 'David Orihuela').split(' ')[0];
    return [
      `Hola ${c.name.split(' ')[0]}, soy ${coach}. Para preparar tu plan necesito conocerte un poco mejor. ¿Me respondes a estas preguntas? Puedes contestar en un solo mensaje poniendo el número de cada pregunta y la letra de tu respuesta (por ejemplo: 1A, 2C…).`,
      '',
      ...questions().map((q, i) => `${i + 1}. ${qText(q)}${qOpts(q).length ? '\n' + qOpts(q).map((o, k) => `   ${'ABCD'[k]}) ${o}`).join('\n') : ''}`),
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
        const items = qs.map((q, i) => ({ q: qText(q), a: (doc.answers[i] || '').trim() }));
        const answeredAt = doc.answeredAt && doc.answeredAt.toDate ? U.toISODate(doc.answeredAt.toDate()) : today();
        Store.update('clients', c.id, { questionnaire: Object.assign({}, c.questionnaire, { items, answeredAt, reviewedAt: '' }) });
        found++;
        UI.toast(`${c.name.split(' ')[0]} ha respondido el cuestionario`);
      }
      // Formularios enviados desde «Formularios» a personas que aún no son clientes.
      for (const f of onlyClientId ? [] : Store.data.forms.filter((x) => x.token && !x.answeredAt)) {
        const doc = await Sync.fetchQuestionnaire(f.token).catch(() => null);
        if (!doc || !doc.answeredAt || !Array.isArray(doc.answers)) continue;
        const qs = Array.isArray(doc.questions) ? doc.questions : [];
        const items = qs.map((q, i) => ({ q: qText(q), a: (doc.answers[i] || '').trim() }));
        const answeredAt = doc.answeredAt && doc.answeredAt.toDate ? U.toISODate(doc.answeredAt.toDate()) : today();
        const ans = (re) => ((items.find((x) => re.test(x.q)) || {}).a || '');
        const name = f.name || ans(/^nombre/i) || 'Alguien';
        Store.update('forms', f.id, { items, answeredAt, reviewedAt: '', name: f.name || name, phone: f.phone || ans(/^tel[eé]fono/i) });
        found++;
        UI.toast(`${name.split(' ')[0]} ha rellenado el cuestionario: dale de alta desde el panel`);
        try {
          if ('Notification' in window && Notification.permission === 'granted') new Notification('📝 Cuestionario rellenado', { body: `${name} ha rellenado el cuestionario. Ábrelo para darle de alta.`, tag: 'form-' + f.id });
        } catch (e) { /* sin notificaciones */ }
      }
    } finally {
      checkingLinks = false;
    }
    if (found) App.render();
    else if (manual) UI.toast('Todavía no ha respondido');
  }

  /* =========================================================
   * Formularios: cuestionario inicial por enlace para personas que aún no son clientes
   * ======================================================= */

  const FORM_ID_QUESTIONS = ['Nombre y apellidos', 'Teléfono (WhatsApp)'];
  /** Nombre de quien rellena un formulario: el que pusiste al crearlo o el que respondió. */
  function formName(f) { return f.name || (((f.items || []).find((x) => /^nombre/i.test(x.q)) || {}).a) || ''; }
  /** Preguntas del formulario para alguien nuevo: nombre y teléfono solo si no los has puesto tú al crearlo. */
  const prospectQuestions = (name, phone) => [name ? '' : FORM_ID_QUESTIONS[0], phone ? '' : FORM_ID_QUESTIONS[1]].filter(Boolean)
    .concat(questions().filter((q) => !/^\s*(¿\s*)?(cu[aá]l es tu )?nombre/i.test(q)));
  const newToken = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const formUrl = (token) => new URL(`cuestionario.html?t=${token}`, location.href.split('#')[0]).href;
  const coachFirst = () => (Store.settings.trainerName || 'David Orihuela').split(' ')[0];
  function formMessage(f) {
    const hi = f.name ? `Hola ${f.name.split(' ')[0]}` : 'Hola';
    return `${hi}, soy ${coachFirst()}. Para preparar tu plan necesito conocerte un poco mejor. Rellena este cuestionario, son solo unos minutos:\n${formUrl(f.token)}\n¡Muchas gracias!`;
  }
  const formWa = (f) => `${U.waLink(f.phone) || 'https://wa.me/'}?text=${encodeURIComponent(formMessage(f))}`;

  async function needCloud() {
    if (location.protocol === 'file:') { UI.toast('Abre la app desde tu web publicada para poder enviar enlaces'); return true; }
    if (!window.Sync || !Sync.state.user) {
      const ok = await UI.confirm({
        title: 'Inicia sesión con Google',
        message: 'Para enviar formularios por enlace, la app tiene que estar conectada a la nube (sincronización con Google). Así las respuestas te llegan solas.',
        confirmLabel: 'Iniciar sesión', danger: false,
      });
      if (ok && window.Sync) Sync.signIn();
      return true;
    }
    return false;
  }

  /** Muestra el enlace de un formulario listo para enviar por WhatsApp o copiar. */
  function formShare(f) {
    UI.openModal({
      title: 'Formulario listo',
      body: `<p style="margin-top:0">Envíalo por WhatsApp${f.name ? ` a <strong>${esc(f.name)}</strong>` : ''} o copia el enlace para mandarlo por Instagram, email…</p>
        <div class="form-link"><input readonly value="${esc(formUrl(f.token))}" aria-label="Enlace del formulario" onclick="this.select()"></div>
        <p class="muted" style="font-size:.85rem;margin-bottom:0">Cuando lo rellene, sus respuestas aparecerán aquí, en Formularios, y en el panel.</p>`,
      footer: `<button type="button" class="btn" id="fs-copy">${U.icon('file')}Copiar enlace</button><a class="btn primary wa-solid" href="${formWa(f)}" target="_blank" rel="noopener" id="fs-wa">${U.icon('message')}Enviar por WhatsApp</a>`,
      onOpen: (dlg) => {
        dlg.querySelector('#fs-copy').addEventListener('click', () => copyText(formUrl(f.token), 'Enlace copiado'));
        dlg.querySelector('#fs-wa').addEventListener('click', () => setTimeout(() => UI.closeModal(), 300));
      },
    });
  }

  /**
   * Crea el enlace y abre WhatsApp con el mensaje ya escrito (elige tú el chat, o el de la persona
   * si se conoce su teléfono). La ventana se abre al momento para que el móvil no la bloquee.
   */
  async function sendForm(name = '', phone = '') {
    if (await needCloud()) return;
    const win = window.open('about:blank', '_blank');
    const token = newToken();
    try {
      await Sync.createQuestionnaire(token, { clientName: name.trim().split(' ')[0], coach: coachFirst(), questions: prospectQuestions(name.trim(), phone.trim()) });
    } catch (e) {
      console.error(e);
      if (win) win.close();
      UI.toast('No se ha podido crear el enlace (revisa la conexión y las reglas de Firebase)');
      return;
    }
    const f = Store.add('forms', { name: name.trim(), phone: phone.trim(), token, sentAt: today(), answeredAt: '', reviewedAt: '', items: [], clientId: '' });
    if (win) win.location.href = formWa(f); else window.open(formWa(f), '_blank');
    App.render();
    UI.toast('Formulario preparado en WhatsApp: elige a quién enviárselo', { label: 'Copiar enlace', onClick: () => copyText(formUrl(f.token), 'Enlace copiado') });
  }

  function newForm() {
    UI.form({
      title: 'Nuevo formulario',
      fields: [
        { name: 'name', label: 'Nombre (opcional)', placeholder: 'Ej.: Laura' },
        { name: 'phone', label: 'Teléfono (opcional)', type: 'tel', placeholder: 'Para abrir directamente su WhatsApp' },
      ],
      values: {},
      submitLabel: 'Abrir WhatsApp',
      onSubmit: (v) => { UI.closeModal(); sendForm(v.name || '', v.phone || ''); },
    });
  }

  function formAnswers(id) {
    const f = Store.get('forms', id);
    if (!f) return;
    const who = formName(f) || 'Sin nombre';
    UI.openModal({
      title: `Respuestas de ${who}`,
      body: `<p class="muted" style="margin-top:0">Respondió el ${esc(fmtDate(f.answeredAt))}.</p>
        <dl class="form-answers">${(f.items || []).map((x, i) => `<dt>${i + 1}. ${esc(x.q)}</dt><dd>${x.a ? esc(x.a).replace(/\n/g, '<br>') : '<span class="muted">Sin respuesta</span>'}</dd>`).join('')}</dl>`,
      footer: `${f.clientId ? `<a class="btn" href="#/clientes/${f.clientId}" data-close>${U.icon('users')}Ver su ficha</a>` : `<button type="button" class="btn primary" id="fa-client">${U.icon('plus')}Crear cliente</button>`}<button type="button" class="btn" data-close>Cerrar</button>`,
      onOpen: (dlg) => {
        if (!f.reviewedAt) { Store.update('forms', f.id, { reviewedAt: today() }); }
        const b = dlg.querySelector('#fa-client');
        if (b) b.addEventListener('click', () => { UI.closeModal(); formToClient(f.id); });
      },
    });
    setTimeout(() => App.render(), 0);
  }

  /** Da de alta como cliente a quien respondió el formulario (sus respuestas pasan a su ficha). */
  /**
   * Altura (cm) y peso (kg) a partir de la respuesta del cuestionario, p. ej. «1,75 y 80 kg»,
   * «175 cm, 80», «mido 168 y peso 62,5». Devuelve { height, weight } (los que se reconozcan).
   */
  function parseHeightWeight(text) {
    const out = {};
    const t = String(text || '').toLowerCase().replace(/(\d),(\d)/g, '$1.$2');
    const nums = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(cm|m|kg|kilos?|metros?)?/g)].map((m) => ({ v: Number(m[1]), u: m[2] || '' }));
    const asHeight = (n) => (n.v >= 1.2 && n.v <= 2.3 ? Math.round(n.v * 100) : n.v >= 120 && n.v <= 230 ? n.v : null);
    for (const n of nums) {
      if (/^(cm|m|metro)/.test(n.u) && out.height === undefined && asHeight(n)) out.height = asHeight(n);
      else if (/^(kg|kilo)/.test(n.u) && out.weight === undefined && n.v >= 30 && n.v <= 250) out.weight = n.v;
    }
    for (const n of nums) {
      if (/^(cm|m|metro|kg|kilo)/.test(n.u)) continue;
      if (out.height === undefined && asHeight(n)) { out.height = asHeight(n); continue; }
      if (out.weight === undefined && n.v >= 30 && n.v <= 250) out.weight = n.v;
    }
    return out;
  }

  const cleanEmail = (t) => { const m = String(t || '').trim().toLowerCase().match(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/); return m ? m[0] : ''; };
  /** «12/04/1990» (o «1990-04-12») → «1990-04-12»; vacío si no es una fecha válida. */
  function parseBirth(text) {
    const t = String(text || '').trim();
    let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    const [y, mo, d] = m ? [m[1], m[2], m[3]] : ((m = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/)) ? [m[3], m[2], m[1]] : []);
    if (!y) return '';
    const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dt = U.parseDate(iso);
    return dt && dt.getDate() === Number(d) && Number(y) > 1900 && iso <= today() ? iso : '';
  }

  function formToClient(id) {
    const f = Store.get('forms', id);
    if (!f) return;
    const ans = (re) => (((f.items || []).find((x) => re.test(x.q)) || {}).a || '');
    const name = formName(f);
    const phone = f.phone || ans(/^tel[eé]fono/i);
    const sex = ans(/^sexo/i);
    const gender = /^hombre/i.test(sex) ? 'Hombre' : /^mujer/i.test(sex) ? 'Mujer' : '';
    const birthDate = parseBirth(ans(/nacimiento/i));
    const email = cleanEmail(ans(/correo|e-?mail/i));
    const rate = Number(Store.settings.defaultRate) || 0;
    // Altura y peso de la respuesta del cuestionario («Altura (cm) y peso actual (kg)»).
    const hw = (f.items || []).filter((x) => /altura|peso|mides|pesas/i.test(x.q)).reduce((o, x) => Object.assign(parseHeightWeight(x.a), o), {});
    const c = Store.add('clients', Object.assign({
      name: name || 'Nuevo cliente', phone, status: 'activo', startDate: today(), rate, nextDue: today(),
      questionnaire: { items: (f.items || []).filter((x) => !FORM_ID_QUESTIONS.includes(x.q)), answeredAt: f.answeredAt, reviewedAt: today(), sentAt: f.sentAt, via: 'enlace' },
    }, hw.height ? { height: hw.height } : {}, gender ? { gender } : {}, birthDate ? { birthDate } : {}, email ? { email } : {}, healthFlags(f.items).length ? { health: flagsText(healthFlags(f.items)) } : {}));
    if (hw.weight) Store.add('measurements', { clientId: c.id, date: f.answeredAt || today(), weight: hw.weight, notes: 'Del cuestionario inicial' });
    Store.update('forms', f.id, { clientId: c.id, reviewedAt: f.reviewedAt || today() });
    UI.toast(`${(name || 'Cliente').split(' ')[0]} dado de alta: revisa su ficha`);
    location.hash = `#/clientes/${c.id}`;
    setTimeout(() => openClientForm(c.id), 150);
  }

  function renderForms() {
    const forms = Store.data.forms.slice().sort((a, b) => String(b.answeredAt || b.sentAt).localeCompare(String(a.answeredAt || a.sentAt)));
    const answered = forms.filter((f) => f.answeredAt);
    const who = (f) => formName(f) || 'Sin nombre';
    const initialsOf = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('') || '?';
    const row = (f) => `<li class="form-row">
        <span class="avatar">${esc(initialsOf(who(f)))}</span>
        <div class="grow">
          <div class="title">${esc(who(f))}${f.answeredAt && !f.reviewedAt ? ` ${badge('Nuevo', 'success')}` : ''}${f.clientId ? ` ${badge('Ya es cliente', 'info')}` : ''}</div>
          <div class="meta">${f.answeredAt ? `Respondió el ${esc(fmtDate(f.answeredAt))}` : `Enviado el ${esc(fmtDate(f.sentAt))} · sin responder`}${f.phone ? ` · ${esc(f.phone)}` : ''}</div>
        </div>
        <div class="actions">
          ${f.answeredAt
            ? `<button class="btn sm primary" data-action="form-answers" data-id="${f.id}">${U.icon('file')}Ver respuestas</button>${f.clientId ? '' : `<button class="btn sm" data-action="form-client" data-id="${f.id}">${U.icon('plus')}Crear cliente</button>`}`
            : `<button class="btn sm" data-action="form-share" data-id="${f.id}">${U.icon('message')}Reenviar</button>`}
          <button class="icon-btn" data-action="form-delete" data-id="${f.id}" aria-label="Eliminar formulario de ${esc(who(f))}" title="Eliminar">${U.icon('trash')}</button>
        </div>
      </li>`;
    return `
      <div class="page-header">
        <div><h1 class="display">Formularios</h1><p>Envía el cuestionario inicial por enlace a quien quieras, aunque todavía no sea cliente</p></div>
        <button class="btn primary pill" data-action="form-send">${U.icon('message')}Enviar formulario</button>
      </div>
      <section class="card form-hero">
        <div class="grow">
          <h2><button class="link-btn form-hero-title" data-action="form-send">${U.icon('message')}Cuestionario inicial</button></h2>
          <p class="muted">${plural(prospectQuestions().length, 'pregunta', 'preguntas')}: nombre, teléfono, objetivo, salud, experiencia, disponibilidad, hábitos… La persona lo rellena desde el móvil sin registrarse y las respuestas te llegan aquí. Si te contrata, con «Crear cliente» se da de alta con sus respuestas en la ficha.</p>
        </div>
        <div class="actions">
          <button class="btn primary wa-solid" data-action="form-send">${U.icon('message')}Enviar por WhatsApp</button>
        </div>
      </section>
      <section class="card">
        <div class="card-header"><h2>Respondidos ${answered.length ? `<span class="count">${answered.length}</span>` : ''}</h2></div>
        ${answered.length ? `<ul class="list">${answered.map(row).join('')}</ul>` : '<p class="muted" style="margin:0">Todavía no ha respondido nadie.</p>'}
      </section>`;
  }

  /** Reparte una respuesta pegada de WhatsApp («1. … 2. …») entre las preguntas. */
  function splitAnswers(text) {
    const out = {};
    let current = null;
    // «1A 2C 3B» o «1A, 2C…» en una sola línea: una respuesta por línea.
    const lines = String(text || '').split(/\r?\n/).flatMap((l) => l.split(/[\s,;]+(?=\d{1,2}\s*(?:[a-d]\b|[.)]\s))/i));
    for (const line of lines) {
      const m = line.match(/^\s*\*?(\d{1,2})\s*(?:[.)\-:ºª]+|(?=[a-d]\b))\s*\*?\s*(.*)$/i);
      if (m) { current = Number(m[1]) - 1; out[current] = m[2].trim(); }
      else if (current !== null && line.trim()) out[current] = `${out[current] ? out[current] + '\n' : ''}${line.trim()}`;
    }
    return out;
  }

  function questionnaireForm(clientId) {
    const c = Store.get('clients', clientId);
    if (!c) return;
    const saved = (c.questionnaire && c.questionnaire.items) || [];
    const all = questions();
    const qs = saved.length ? saved.map((x) => x.q) : all.map(qText);
    const optsFor = (q) => qOpts(all.find((x) => qText(x) === q) || '');
    const values = {};
    qs.forEach((q, i) => { values[`q${i}`] = (saved[i] && saved[i].a) || ''; });
    UI.form({
      title: `Respuestas de ${c.name.split(' ')[0]}`,
      fields: [
        { name: 'paste', label: 'Pega aquí su respuesta de WhatsApp (opcional)', type: 'textarea', placeholder: '1. …\n2. …', hint: 'Si contestó con el número de cada pregunta, se repartirá solo en las casillas de abajo. Revísalo antes de guardar.' },
        { type: 'section', label: 'Respuestas' },
        ...qs.map((q, i) => (optsFor(q).length
          ? { name: `q${i}`, label: `${i + 1}. ${q}`, type: 'select', options: ['', ...optsFor(q), ...((saved[i] && saved[i].a && !optsFor(q).includes(saved[i].a)) ? [saved[i].a] : [])].map((o) => ({ value: o, label: o || '—' })) }
          : { name: `q${i}`, label: `${i + 1}. ${q}`, type: 'textarea' })),
      ],
      values,
      submitLabel: 'Guardar respuestas',
      onReady: (dlg) => {
        const paste = dlg.querySelector('#f-paste');
        paste.addEventListener('input', () => {
          const parts = splitAnswers(paste.value);
          let n = 0;
          Object.entries(parts).forEach(([i, a]) => {
            const el = dlg.querySelector(`#f-q${i}`);
            if (!el) return;
            if (el.tagName === 'SELECT') {
              // «1A», «1 b)», o el texto de la opción.
              const opts = [...el.options].slice(1).map((o) => o.value);
              const m = String(a).trim().match(/^([a-d])\b\)?/i);
              const hit = m ? opts['abcd'.indexOf(m[1].toLowerCase())] : opts.find((o) => o.toLowerCase() === String(a).trim().toLowerCase());
              if (hit) { el.value = hit; n++; }
            } else { el.value = a; n++; }
          });
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
      <div class="page-header"><div><h1 class="display">Ajustes y copias de seguridad</h1><p>Avisos, sincronización y copias de seguridad de tus datos</p></div></div>
      <div class="grid-2">
        <section class="card">
          <div class="card-header"><h2>Avisos de pago</h2></div>
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
      const due = computeAlerts().filter((a) => a.kind === 'pago' || a.kind === 'revision' || (a.kind === 'cumple' && a.bi.days === 0 && !a.bi.greeted));
      if (!due.length && !force) return;
      const body = due.length
        ? due.slice(0, 6).map((a) => (a.kind === 'cumple' ? `🎂 ${a.c.name}: ¡hoy es su cumpleaños! Felicítale.` : `${a.c.name}: ${a.kind === 'pago' ? dueText(a.di) : reviewText(a.ri)}`)).join('\n')
        : `Nadie tiene que pagar en los próximos ${Store.REMIND_DAYS} días.`;
      new Notification(due.length ? (due.every((a) => a.kind === 'cumple') ? '🎂 Cumpleaños hoy' : `${plural(due.length, 'aviso', 'avisos')} de pagos, revisiones y cumpleaños`) : 'Avisos activados', { body, tag: 'pagos' });
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
    'ex-move': (d) => {
      // Se mueve dentro de su músculo: se intercambia con el ejercicio anterior/siguiente del mismo músculo.
      const r = Store.routineFor(d.client);
      const list = findDay(r, d.day).exercises;
      const ex = list.find((x) => x.id === d.ex);
      if (!ex) return;
      const same = list.filter((x) => exGroup(x) === exGroup(ex));
      const other = same[same.indexOf(ex) + Number(d.dir)];
      if (!other) return;
      const i = list.indexOf(ex), j = list.indexOf(other);
      [list[i], list[j]] = [list[j], list[i]];
      saveRoutine(r);
    },
    'routine-days': (d) => setRoutineDays(d.client, Number(d.value)),
    'health-asked': (d) => { Store.update('clients', d.client, { healthAsked: d.value ? today() : '' }); App.render(); if (d.value) UI.toast('Marcado como hablado'); },
    'day-muscle': (d) => toggleDayMuscle(d.client, d.day, d.value),
    'muscle-pick': (d) => musclePicker(d.client, d.day, d.value),
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
    'bday-greet': (d) => {
      const bi = birthdayInfo(Store.get('clients', d.client));
      if (bi) setTimeout(() => { Store.update('clients', d.client, { bdayGreeted: bi.date }); App.render(); }, 300);
    },
    'send-questionnaire': (d) => sendQuestionnaire(d.client),
    'send-questionnaire-link': (d) => sendQuestionnaireLink(d.client),
    'diet-targets': (d) => dietTargetsForm(d.client),
    'diet-delete': (d) => deleteDiet(d.client),
    'meal-pct': (d, el) => setMealShares(d.client, (meals) => setShare(meals, d.meal, Number(el.value) || 0)),
    'meal-pct-step': (d) => setMealShares(d.client, (meals) => {
      const cur = mealShares(meals).get(d.meal) || 0;
      setShare(meals, d.meal, Math.round(cur) + Number(d.dir));
    }),
    'meal-pct-equal': (d) => { setMealShares(d.client, (meals) => meals.forEach((m) => { delete m.pct; })); UI.toast('Calorías repartidas a partes iguales'); },
    'set-height': (d) => {
      const c = Store.get('clients', d.client);
      if (!c) return;
      UI.form({
        title: `Altura de ${c.name.split(' ')[0]}`,
        fields: [{ name: 'height', label: 'Altura (cm)', type: 'number', step: '0.5', min: 100, max: 230, required: true, placeholder: 'Ej.: 175', full: true, hint: 'Se usa para el IMC y para estimar sus calorías de mantenimiento en la dieta.' }],
        values: { height: c.height || '' },
        submitLabel: 'Guardar',
        onSubmit: (v) => { Store.update('clients', c.id, { height: v.height }); UI.toast('Altura guardada'); App.render(); },
      });
    },
    'diet-pdf': (d) => printDiet(d.client),
    'diet-copy': (d) => { const c = Store.get('clients', d.client); const dt = Store.dietFor(d.client); if (c && dt) copyText(dietText(c, dt), 'Dieta copiada: pégala donde quieras'); },
    'equiv-by': (d) => setEquivBy(d.value),
    'meal-count-pick': (d) => { state.mealCount = Number(d.value); App.render(); },
    'meal-count-apply': (d) => applyMealCount(d.client),
    'meal-count-edit': () => { state.editMealCount = !state.editMealCount; App.render(); },
    'meal-count-cancel': () => { state.editMealCount = false; App.render(); },
    'meal-toggle': (d, el) => { const det = el.closest('details'); det.open = !det.open; state.openMeal = det.open ? d.id : null; },
    'meal-veg': (d, el) => updateMeal(d.client, d.meal, (m) => { m.vegFree = el.checked; }, { solve: false }),
    'meal-rename': (d, el) => { const name = el.value.trim(); if (name) updateMeal(d.client, d.meal, (m) => { m.name = name; }, { solve: false }); },
    'meal-add': (d) => mealPicker(d.client, d.meal),
    'meal-solve': (d) => { updateMeal(d.client, d.meal, () => {}); UI.toast('Cantidades reajustadas'); },
    'meal-grams': (d, el) => updateMeal(d.client, d.meal, (m) => { const it = m.items.find((x) => x.id === d.item); if (it) { it.grams = Math.max(0, Number(el.value) || 0); it.locked = true; } }),
    'meal-lock': (d) => updateMeal(d.client, d.meal, (m) => { const it = m.items.find((x) => x.id === d.item); if (it) it.locked = !it.locked; }),
    'meal-remove': (d) => updateMeal(d.client, d.meal, (m) => { m.items = m.items.filter((x) => x.id !== d.item); }),
    'open-answers': (d) => {
      state.clientTab = 'resumen';
      state.keepTab = true;
      state.showAnswers = true;
      location.hash = `#/clientes/${d.client}`;
      setTimeout(() => document.querySelector('.questionnaire-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    },
    'form-new': () => newForm(),
    'form-send': () => sendForm(),
    'form-share': (d) => { const f = Store.get('forms', d.id); if (f) formShare(f); },
    'form-answers': (d) => formAnswers(d.id),
    'form-client': (d) => formToClient(d.id),
    'form-dismiss': (d) => {
      Store.update('forms', d.id, { dismissed: true, reviewedAt: Store.get('forms', d.id).reviewedAt || today() });
      App.render();
      UI.toast('Aviso quitado (sigue en Formularios)', { label: 'Deshacer', onClick: () => { Store.update('forms', d.id, { dismissed: false }); App.render(); } });
    },
    'form-check': () => checkQuestionnaireLinks(null, true),
    'form-delete': (d) => {
      const f = Store.get('forms', d.id);
      if (!f) return;
      UI.confirm({ title: 'Eliminar formulario', message: f.answeredAt ? 'Se borrarán sus respuestas de esta lista (si ya es cliente, su ficha no cambia).' : 'El enlace dejará de aparecer aquí y, si lo rellena, no te llegarán las respuestas.', confirmLabel: 'Eliminar' })
        .then((ok) => { if (ok) { Store.remove('forms', f.id); App.render(); UI.toast('Formulario eliminado', { label: 'Deshacer', onClick: () => { Store.add('forms', f); App.render(); } }); } });
    },
    'review-questionnaire': (d) => {
      const c = Store.get('clients', d.client);
      if (!c || !c.questionnaire) return;
      // Al revisarlo, sus datos del cuestionario rellenan lo que falte en la ficha (no pisa nada).
      const items = c.questionnaire.items || [];
      const ans = (re) => ((items.find((x) => re.test(x.q)) || {}).a || '');
      const hw = items.filter((x) => /altura|peso/i.test(x.q)).reduce((o, x) => Object.assign(parseHeightWeight(x.a), o), {});
      const sex = ans(/^sexo/i);
      const fill = {};
      if (!c.birthDate && parseBirth(ans(/nacimiento/i))) fill.birthDate = parseBirth(ans(/nacimiento/i));
      if (!c.email && cleanEmail(ans(/correo|e-?mail/i))) fill.email = cleanEmail(ans(/correo|e-?mail/i));
      if (!c.gender && /^(hombre|mujer)/i.test(sex)) fill.gender = /^hombre/i.test(sex) ? 'Hombre' : 'Mujer';
      if (!c.height && hw.height) fill.height = hw.height;
      if (!c.health && healthFlags(items).length) fill.health = flagsText(healthFlags(items));
      if (hw.weight && !Store.measurementsFor(c.id).length) Store.add('measurements', { clientId: c.id, date: c.questionnaire.answeredAt || today(), weight: hw.weight, notes: 'Del cuestionario inicial' });
      Store.update('clients', c.id, Object.assign({ questionnaire: Object.assign({}, c.questionnaire, { reviewedAt: today() }) }, fill));
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
    renderLibrary, onLibrarySearch, renderFoods, renderForms, parseHeightWeight, onFoodSearch, submitDietForm, saveQuestionnaire, checkQuestionnaireLinks,
    saveSettings, importFile, onClientSearch, computeAlerts, submitPayForm, submitTaskForm, uploadPhotos, notifyDue, greeting, greetingText,
  };
})();
