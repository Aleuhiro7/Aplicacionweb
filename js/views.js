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
  const STALE_DAYS = 14; // días sin actualizar progreso para avisar

  /* Estado de la interfaz (no se guarda). */
  const state = {
    clientSearch: '',
    clientFilter: 'activo',
    clientTab: 'resumen',
    payFilter: 'todos',
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
      { name: 'startDate', label: 'Fecha de alta', type: 'date', default: today() },
      { name: 'status', label: 'Estado', type: 'select', options: Object.entries(CLIENT_STATUS).map(([value, s]) => ({ value, label: s.label })), default: 'activo' },
      { name: 'rate', label: `Importe habitual (${Store.settings.currency})`, type: 'number', step: '0.01', min: 0, default: Store.settings.defaultRate, hint: 'Se propone al registrar un pago.' },
      { name: 'nextDue', label: 'Próximo pago', type: 'date', default: today(), hint: `Te avisaré ${Store.REMIND_DAYS} días antes.` },
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

  /** Desplegable para registrar un pago: cantidad y fecha del próximo pago. */
  function payForm(c) {
    const amount = Number(c.rate) || Store.lastPaidAmount(c.id) || Store.settings.defaultRate || '';
    const base = payBase(c);
    const quick = [1, 2, 3, 6].map((n) => `<button type="button" class="chip" data-action="pay-months" data-months="${n}">${n === 1 ? '1 mes' : `${n} meses`}</button>`).join('');
    return `<form class="pay-form" data-client="${c.id}" data-base="${base}">
      <div class="pay-fields">
        <div class="field"><label for="pa-${c.id}">Cantidad (${esc(Store.settings.currency)})</label><input id="pa-${c.id}" name="amount" type="number" step="0.01" min="0" inputmode="decimal" required value="${esc(amount)}"></div>
        <div class="field"><label for="pd-${c.id}">Próximo pago</label><input id="pd-${c.id}" name="nextDue" type="date" required value="${U.addMonths(base, 1)}"></div>
      </div>
      <div class="pay-quick"><span class="muted">Siguiente pago dentro de:</span>${quick}</div>
      <p class="hint">Te avisaré ${Store.REMIND_DAYS} días antes de la fecha del próximo pago.</p>
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

  /** «a, b y c» */
  function joinList(parts) {
    const p = parts.filter(Boolean);
    return p.length <= 1 ? p.join('') : `${p.slice(0, -1).join(', ')} y ${p[p.length - 1]}`;
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

  /** Avisos: pagos vencidos o que vencen en los próximos días y clientes sin actualizar su progreso. */
  function computeAlerts() {
    const t = today();
    const pay = [];
    const progress = [];
    for (const c of Store.clients().filter((x) => clientStatus(x) === 'activo')) {
      const di = Store.dueInfo(c);
      if (di && di.status !== 'al-dia') pay.push({ c, di, kind: 'pago' });
      const last = Store.lastMeasurement(c.id);
      const days = last ? U.daysBetween(last.date, t) : null;
      if (days === null || days >= STALE_DAYS) {
        progress.push({ c, kind: 'progreso', text: last ? `Sin actualizar el peso desde hace ${days} días` : 'Sin peso registrado todavía' });
      }
    }
    pay.sort((a, b) => a.di.date.localeCompare(b.di.date));
    const tasks = Store.pendingTasks().map((task) => ({ c: Store.get('clients', task.clientId), task, kind: 'tarea' }));
    return pay.concat(progress, tasks);
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
    const otherAlerts = alerts.filter((a) => a.kind === 'progreso');
    const taskAlerts = alerts.filter((a) => a.kind === 'tarea');

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
      section('proximos-pagos', 'Pagos pendientes', payAlerts.length, '<a href="#/pagos" class="btn sm">Ver todos</a>',
        `<ul class="list pay-list">${payAlerts.map((a) => payRow(a.c)).join('')}</ul>`,
        `Nadie tiene que pagar en los próximos ${Store.REMIND_DAYS} días`),
      section('atencion', 'Pesos pendientes', otherAlerts.length, '',
        `<ul class="list">${otherAlerts.map((a) => `
          <li>
            ${avatar(a.c)}
            <div class="grow"><a class="title" href="#/clientes/${a.c.id}" style="color:inherit;text-decoration:none">${esc(a.c.name)}</a><div class="meta">${esc(a.text)}</div></div>
            <button class="btn primary sm" data-action="new-measurement" data-client="${a.c.id}">${U.icon('plus')}Peso</button>
          </li>`).join('')}</ul>`,
        'Todos han registrado su peso'),
      section('tareas-pendientes', 'Tareas pendientes', taskAlerts.length, '',
        `<ul class="list task-list">${taskAlerts.map((a) => taskItem(a.task, { showClient: true })).join('')}</ul>`,
        'Sin tareas pendientes'),
    ].sort((x, y) => (y.n > 0) - (x.n > 0)); // las que tienen avisos, arriba (sin cambiar su orden)

    return `
      <div class="page-header">
        <div>
          ${dateLine}
          <h1 class="display" data-greeting data-day="${t}">${esc(greetingText())}</h1>
          <p>${payAlerts.length || otherAlerts.length || taskAlerts.length
            ? `Tienes ${joinList([payAlerts.length ? plural(payAlerts.length, 'pago pendiente', 'pagos pendientes') : '', otherAlerts.length ? plural(otherAlerts.length, 'peso pendiente', 'pesos pendientes') : '', taskAlerts.length ? plural(taskAlerts.length, 'tarea pendiente', 'tareas pendientes') : ''])}${overdue ? ` · ${plural(overdue, 'pago vencido', 'pagos vencidos')}` : ''}.`
            : 'Todo al día: no tienes pagos, pesos ni tareas pendientes.'}</p>
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
      <thead><tr><th>Cliente</th><th class="hide-sm">Email</th><th class="hide-sm">Teléfono</th><th class="num">Importe</th><th>Próximo pago</th><th class="hide-sm">Último peso</th></tr></thead>
      <tbody>${list.map((c) => {
        const di = Store.dueInfo(c);
        const last = Store.lastMeasurement(c.id);
        return `<tr class="clickable" data-href="#/clientes/${c.id}" tabindex="0">
          <td><div class="name-cell">${avatar(c)}<div><div style="font-weight:600">${esc(c.name)}</div>${clientStatus(c) !== 'activo' ? statusBadge(c) : ''}</div></div></td>
          <td class="hide-sm">${c.email ? esc(c.email) : '—'}</td>
          <td class="hide-sm">${c.phone ? esc(c.phone) : '—'}</td>
          <td class="num">${c.rate ? money(c.rate) : '<span class="muted">—</span>'}</td>
          <td>${di ? `${esc(U.fmtDateShort(di.date))} ${di.status !== 'al-dia' ? dueBadge(di) : ''}` : '<span class="muted">—</span>'}</td>
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
    const tabs = [['resumen', 'Resumen'], ['progreso', 'Progreso'], ['pagos', 'Pagos'], ['fotos', 'Fotos'], ['tareas', `Tareas${pendingCount ? ` <span class="tab-count">${pendingCount}</span>` : ''}`]];
    if (!tabs.some(([k]) => k === state.clientTab)) state.clientTab = 'resumen';
    const ageVal = U.age(c.birthDate);
    const sub = [ageVal !== null ? `${ageVal} años` : null, c.startDate ? `Cliente desde ${fmtDate(c.startDate)}` : null].filter(Boolean).join(' · ');
    let body;
    switch (state.clientTab) {
      case 'progreso': body = clientProgress(c); break;
      case 'pagos': body = clientPayments(c); break;
      case 'fotos': body = clientPhotos(c); break;
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
            ${c.phone ? `<a class="btn" href="https://wa.me/${esc(c.phone.replace(/[^\d]/g, ''))}" target="_blank" rel="noopener">${U.icon('message')}WhatsApp</a>` : ''}
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
      ${clientManage(c)}`;
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
        <div><h1 class="display">Pagos</h1><p>Pulsa «Pago» cuando un cliente te pague e indica cuándo le toca el siguiente</p></div>
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
          <p class="muted" style="margin:0 0 12px">Te aviso ${Store.REMIND_DAYS} días antes de que a un cliente le toque pagar: en el resumen, en la campana y, si lo activas, con una notificación del navegador.</p>
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
        rate: p.rate, nextDue, height: p.height, health: p.health || '', notes: '', startDate: U.addMonths(nextDue, -p.months), status: p.status || 'activo',
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
      const due = computeAlerts().filter((a) => a.kind === 'pago');
      if (!due.length && !force) return;
      const body = due.length
        ? due.slice(0, 5).map((a) => `${a.c.name}: ${dueText(a.di)}`).join('\n')
        : `Nadie tiene que pagar en los próximos ${Store.REMIND_DAYS} días.`;
      new Notification(due.length ? `${plural(due.length, 'pago', 'pagos')} próximos o vencidos` : 'Avisos activados', { body, tag: 'pagos' });
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
    alerts: () => {
      const kinds = computeAlerts().map((a) => a.kind);
      const target = kinds.includes('pago') ? 'proximos-pagos' : kinds.includes('progreso') ? 'atencion' : 'tareas-pendientes';
      const go = () => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (location.hash.replace(/^#\/?/, '') === 'panel' || !location.hash) go();
      else { location.hash = '#/panel'; setTimeout(go, 60); }
    },
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
      form.elements.nextDue.value = U.addMonths(form.dataset.base, Number(d.months));
      form.querySelectorAll('.chip').forEach((b) => b.classList.toggle('active', b === el));
    },
    'mark-paid': (d) => markPaid(d.id),
    'client-tab': (d) => { state.clientTab = d.value; App.render(); },
    'open-client-tab': (d) => { state.clientTab = d.value; state.keepTab = true; location.hash = `#/clientes/${d.client}`; },
    'toggle-task': (d) => toggleTask(d.id),
    'edit-task': (d) => editTask(d.id),
    'toggle-done-list': (d, el) => { const det = el.closest('details'); det.open = !det.open; state.showDone = det.open; },
    'open-photo': (d) => openPhoto(d.id),
    'client-filter': (d) => { state.clientFilter = d.value; App.render(); },
    'pay-filter': (d) => { state.payFilter = d.value; App.render(); },
    export: () => { download(`david-orihuela-coach-copia-${today()}.json`, Store.exportJSON(), 'application/json'); UI.toast('Copia exportada'); },
    'export-csv': () => exportCSV(),
    'sample-data': () => loadSample(),
    'enable-notifications': () => enableNotifications(),
    'reset-data': () => resetData(),
  };

  function onClientSearch(value) {
    state.clientSearch = value;
    const el = document.getElementById('clients-table');
    if (el) el.innerHTML = clientsTable();
  }

  window.Views = {
    state, actions, renderPanel, renderClients, renderClient, renderPayments, renderSettings,
    saveSettings, importFile, onClientSearch, computeAlerts, submitPayForm, submitTaskForm, uploadPhotos, notifyDue, greeting, greetingText,
  };
})();
