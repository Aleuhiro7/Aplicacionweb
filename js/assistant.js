/* Asistente por voz de la app del entrenador.
 * Botón 🎙️: David habla (o escribe), Claude entiende lo que pide (función «asistente», ver functions/index.js) y usa
 * las herramientas de la app. Las de consultar se hacen solas; las que cambian algo (apuntar una medida, crear una
 * tarea, registrar un pago, enviar un enlace) se enseñan en una tarjeta y se dicen en voz alta, y solo se hacen si
 * David pulsa «Confirmar». Responde por escrito y en voz alta (con la voz del móvil). */
(function () {
  'use strict';

  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const first = (c) => (c && c.name ? c.name.split(' ')[0] : '');
  const today = () => U.today();
  const num = (n) => (n == null || n === '' ? '' : String(Math.round(Number(n) * 10) / 10).replace('.', ','));
  const A = () => Views.assistant;
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  let history = []; // conversación tal cual la usa Claude (se reenvía entera en cada turno)
  let busy = false;
  let pending = null; // { blocks, results } acciones esperando confirmación
  let muted = false;
  try { muted = localStorage.getItem('entrenapro:asis-mute') === '1'; } catch (e) { /* sin almacenamiento */ }

  /* ---------- Herramientas (se ejecutan aquí, con los datos de la app) ---------- */
  const READ = ['buscar_clientes', 'ficha_cliente', 'resumen_panel', 'abrir', 'ver_rutina', 'buscar_ejercicio'];
  const client = (id) => Store.get('clients', id);

  function clientBrief(c) {
    const ms = Store.measurementsFor(c.id);
    const last = ms[ms.length - 1];
    return { id: c.id, nombre: c.name, estado: A().clientStatus(c), ultimoPeso: last ? `${last.weight} kg (${last.date})` : null };
  }

  const tools = {
    buscar_clientes({ texto, estado }) {
      const all = Store.data.clients.filter((c) => !estado || estado === 'todos' || A().clientStatus(c) === estado);
      const q = norm(texto);
      let found = q ? all.filter((c) => norm(c.name).includes(q) || q.split(/\s+/).every((w) => norm(c.name).includes(w))) : all;
      if (q && !found.length) found = all.filter((c) => q.split(/\s+/).some((w) => w.length > 2 && norm(c.name).split(/\s+/).some((p) => p.startsWith(w.slice(0, 3)))));
      if (q && !found.length) return { resultado: 'Ninguno coincide. Estos son todos los clientes:', clientes: all.map((c) => ({ id: c.id, nombre: c.name })) };
      return { clientes: found.slice(0, 30).map(clientBrief) };
    },
    ficha_cliente({ cliente_id }) {
      const c = client(cliente_id);
      if (!c) return { error: 'No existe ese cliente' };
      const di = Store.dueInfo(c);
      const ri = Store.reviewInfo(c);
      const r = Store.routineFor(c.id);
      const d = Store.dietFor(c.id);
      return {
        nombre: c.name, estado: A().clientStatus(c), edad: U.age(c.birthDate) || null, alturaCm: Number(c.height) || null, telefono: c.phone || null,
        alta: c.startDate || null, cuota: Number(c.rate) || null, gratis: !!c.free,
        proximoPago: di ? { fecha: di.date, estado: di.status } : null,
        revision: ri ? { fecha: ri.date, estado: ri.status } : null,
        medidas: Store.measurementsFor(c.id).slice(-6).map((m) => ({ fecha: m.date, peso: m.weight || null, cintura: m.waist || null })),
        fotos: Store.photosFor(c.id).length,
        lesiones: Store.injuriesFor(c.id).filter((x) => !x.recoveredDate).map((x) => x.name),
        tareasPendientes: Store.data.tasks.filter((t) => t.clientId === c.id && !t.done).map((t) => ({ id: t.id, texto: t.text, fecha: t.dueDate || null })),
        rutina: c.noTraining ? 'no lleva' : r ? (r.days || []).map((x) => x.name).join(', ') : 'sin rutina',
        dieta: c.noDiet ? 'no lleva' : d && d.targets && d.targets.kcal ? `${d.targets.kcal} kcal` : 'sin dieta',
        enlaceMedidasPendiente: !!A().pendingRevision(c),
        cuestionarioAlimentacion: c.foodQuiz ? (c.foodQuiz.answeredAt ? `respondido: ${c.foodQuiz.meals} comidas` : 'enviado, sin responder') : 'no enviado',
      };
    },
    resumen_panel() {
      const al = Views.computeAlerts();
      const name = (x) => (x.c ? x.c.name : '');
      const active = Store.data.clients.filter((c) => A().clientStatus(c) === 'activo');
      return {
        pagos: al.filter((a) => a.kind === 'pago').map((a) => ({ cliente: name(a), fecha: a.di.date, estado: a.di.status, importe: a.di.amount })),
        revisiones: al.filter((a) => a.kind === 'revision').map((a) => ({ cliente: name(a), fecha: a.ri.date, estado: a.ri.status })),
        tareas: al.filter((a) => a.kind === 'tarea').map((a) => ({ id: a.task.id, cliente: name(a), texto: a.task.text, fecha: a.task.dueDate || null })),
        sinRutina: al.filter((a) => a.kind === 'plan' && a.gaps.noRoutine).map(name),
        sinDieta: al.filter((a) => a.kind === 'plan' && a.gaps.noDiet).map(name),
        sinMedidasIniciales: active.filter((c) => !Store.measurementsFor(c.id).length || !Store.photosFor(c.id).length).map((c) => c.name),
        sinCuestionarioAlimentacion: active.filter((c) => !c.noDiet && !(c.foodQuiz && c.foodQuiz.token)).map((c) => c.name),
        entrenosNuevos: A().unseenWorkouts().map((x) => x.c.name),
      };
    },
    abrir({ pantalla, cliente_id, pestana }) {
      if (pantalla === 'panel') location.hash = '#/';
      else if (pantalla === 'pagos') location.hash = '#/pagos';
      else {
        const c = client(cliente_id);
        if (!c) return { error: 'No existe ese cliente' };
        const tabs = { resumen: 'resumen', progreso: 'progreso', rutina: 'rutina', dieta: 'dieta', fotos: 'fotos', pagos: 'pagos', entrenos: 'entrenos' };
        if (pestana && tabs[norm(pestana)]) { Views.state.clientTab = tabs[norm(pestana)]; Views.state.keepTab = true; }
        location.hash = `#/clientes/${c.id}`;
      }
      return { ok: true };
    },
    ver_rutina({ cliente_id }) {
      const c = client(cliente_id);
      if (!c) return { error: 'No existe ese cliente' };
      const r = Store.routineFor(c.id);
      if (!r || !(r.days || []).length) return { resultado: c.noTraining ? 'No lleva rutina' : 'Todavía no tiene rutina' };
      return { dias: r.days.map((d, i) => ({ dia: i + 1, nombre: d.name || `Día ${i + 1}`, ejercicios: (d.exercises || []).map((e) => ({ id: e.id, nombre: e.name, musculo: e.group || null, series: e.sets || null, repeticiones: e.reps || null, descanso: e.rest || null })) })) };
    },
    buscar_ejercicio({ texto }) {
      const q = norm(texto).split(/\s+/).filter(Boolean);
      const found = Store.library().filter((x) => q.every((w) => norm(`${x.name} ${x.group} ${x.equipment || ''}`).includes(w)));
      return { ejercicios: found.slice(0, 25).map((x) => ({ id: x.id, nombre: x.name, musculo: x.group })) };
    },
    quitar_ejercicio({ cliente_id, ejercicio_id }) {
      const f = findEx(cliente_id, ejercicio_id);
      if (f.error) return f;
      f.day.exercises = f.day.exercises.filter((e) => e.id !== ejercicio_id);
      Store.update('routines', f.r.id, { days: f.r.days });
      return { ok: true };
    },
    anadir_ejercicio({ cliente_id, dia, biblioteca_id, sustituir_id }) {
      const c = client(cliente_id);
      const r = c && Store.routineFor(c.id);
      const day = r && (r.days || [])[Number(dia) - 1];
      const lib = Store.get('library', biblioteca_id);
      if (!day) return { error: 'No existe ese día en su rutina' };
      if (!lib) return { error: 'No existe ese ejercicio en la biblioteca' };
      const notes = [lib.tempo ? `Tempo: ${lib.tempo}` : '', lib.description].filter(Boolean).join('\n');
      const ex = { id: U.uid(), libraryId: lib.id, group: lib.group, name: lib.name, sets: lib.sets || '', reps: lib.reps || '', load: '', rest: lib.rest || '', notes };
      day.exercises = day.exercises || [];
      const i = sustituir_id ? day.exercises.findIndex((e) => e.id === sustituir_id) : -1;
      if (i >= 0) day.exercises.splice(i, 1, ex); else day.exercises.push(ex);
      if (!(day.muscles || []).includes(lib.group)) day.muscles = (day.muscles || []).concat(lib.group);
      Store.update('routines', r.id, { days: r.days });
      return { ok: true };
    },
    cambiar_ejercicio({ cliente_id, ejercicio_id, series, repeticiones, descanso }) {
      const f = findEx(cliente_id, ejercicio_id);
      if (f.error) return f;
      const own = new Set(f.ex.custom || []);
      for (const [k, v] of [['sets', series], ['reps', repeticiones], ['rest', descanso]]) if (v != null && v !== '') { f.ex[k] = String(v); own.add(k); }
      f.ex.custom = [...own]; // así no lo pisa la biblioteca
      Store.update('routines', f.r.id, { days: f.r.days });
      return { ok: true };
    },
    apuntar_medida({ cliente_id, peso, cintura, fecha, notas }) {
      const c = client(cliente_id);
      if (!c) return { error: 'No existe ese cliente' };
      if (!(Number(peso) > 0) && !(Number(cintura) > 0)) return { error: 'Falta el peso o la cintura' };
      Store.add('measurements', { clientId: c.id, date: fecha || today(), weight: Number(peso) > 0 ? Number(peso) : null, waist: Number(cintura) > 0 ? Number(cintura) : null, notes: notas || '' });
      return { ok: true };
    },
    crear_tarea({ cliente_id, texto, fecha }) {
      const c = client(cliente_id);
      if (!c) return { error: 'No existe ese cliente' };
      Store.add('tasks', { clientId: c.id, text: String(texto || '').trim(), dueDate: fecha || '', done: false });
      return { ok: true };
    },
    completar_tarea({ tarea_id }) {
      if (!Store.get('tasks', tarea_id)) return { error: 'No existe esa tarea' };
      Store.update('tasks', tarea_id, { done: true, doneAt: new Date().toISOString() });
      return { ok: true };
    },
    registrar_pago({ cliente_id, importe, meses, metodo }) {
      const c = client(cliente_id);
      if (!c) return { error: 'No existe ese cliente' };
      const amount = payAmount(c, importe);
      if (!(amount >= 0)) return { error: 'Falta el importe' };
      const next = Store.nextDueAfter(c, A().payBase(c), Math.max(1, Number(meses) || 1));
      Store.add('payments', { clientId: c.id, date: today(), amount, concept: 'Pago', method: metodo || A().lastMethod(c.id), status: 'pagado', nextDue: next, notes: '' });
      Store.update('clients', c.id, { nextDue: next, rate: amount });
      return { ok: true, proximoPago: next };
    },
    enviar_enlace({ cliente_id, tipo }) {
      const c = client(cliente_id);
      if (!c) return { error: 'No existe ese cliente' };
      A().sendLink(c.id, tipo); // abre WhatsApp con el mensaje y el enlace
      return { ok: true, nota: 'Se ha abierto WhatsApp con el mensaje: David solo tiene que enviarlo.' };
    },
  };
  /** Busca un ejercicio en la rutina de un cliente. */
  function findEx(cliente_id, ejercicio_id) {
    const c = client(cliente_id);
    const r = c && Store.routineFor(c.id);
    if (!r) return { error: 'Ese cliente no tiene rutina' };
    for (const day of r.days || []) { const ex = (day.exercises || []).find((e) => e.id === ejercicio_id); if (ex) return { r, day, ex }; }
    return { error: 'No encuentro ese ejercicio en su rutina' };
  }
  const payAmount = (c, importe) => (Number(importe) >= 0 && importe !== null && importe !== undefined && importe !== '' ? Number(importe) : Number(c.rate) || Store.lastPaidAmount(c.id) || Number(Store.settings.defaultRate) || NaN);

  /** Lo que se va a hacer, en una frase (para la tarjeta de confirmación y para decirlo en voz alta). */
  function describe(b) {
    const i = b.input || {};
    const c = client(i.cliente_id);
    const who = c ? c.name : '(cliente desconocido)';
    const when = (f) => (!f || f === today() ? 'hoy' : U.fmtDateShort ? U.fmtDateShort(f) : f);
    switch (b.name) {
      case 'apuntar_medida': return `Apuntar a ${who}: ${[i.peso ? `${num(i.peso)} kg` : '', i.cintura ? `${num(i.cintura)} cm de cintura` : ''].filter(Boolean).join(' y ')} (${when(i.fecha)})`;
      case 'crear_tarea': return `Tarea para ${who}: «${i.texto}»${i.fecha ? `, para el ${when(i.fecha)}` : ''}`;
      case 'completar_tarea': { const t = Store.get('tasks', i.tarea_id); return `Marcar como hecha la tarea «${t ? t.text : i.tarea_id}»`; }
      case 'registrar_pago': { const a = c ? payAmount(c, i.importe) : i.importe; return `Registrar el pago de ${who}: ${num(a)} ${Store.settings.currency === 'EUR' ? 'euros' : Store.settings.currency}${(Number(i.meses) || 1) > 1 ? ` (${i.meses} meses)` : ''}${i.metodo ? ` por ${i.metodo}` : ''}`; }
      case 'enviar_enlace': return `Enviar a ${who} el enlace de ${{ medidas: 'medidas y fotos', alimentacion: 'alimentación', cuestionario: 'cuestionario inicial', zona: 'su app de entrenamiento' }[i.tipo] || i.tipo} por WhatsApp`;
      case 'quitar_ejercicio': { const f = findEx(i.cliente_id, i.ejercicio_id); return `Quitar «${f.ex ? f.ex.name : '?'}» de la rutina de ${who}${f.day ? ` (${f.day.name})` : ''}`; }
      case 'anadir_ejercicio': { const l = Store.get('library', i.biblioteca_id); const f = i.sustituir_id ? findEx(i.cliente_id, i.sustituir_id) : {}; return `${f.ex ? `Cambiar «${f.ex.name}» por` : 'Añadir'} «${l ? l.name : '?'}» en el día ${i.dia} de la rutina de ${who}`; }
      case 'cambiar_ejercicio': { const f = findEx(i.cliente_id, i.ejercicio_id); return `Cambiar «${f.ex ? f.ex.name : '?'}» de ${who}: ${[i.series ? `${i.series} series` : '', i.repeticiones ? `repeticiones ${i.repeticiones}` : '', i.descanso ? `descanso ${i.descanso}` : ''].filter(Boolean).join(', ')}`; }
      default: return b.name;
    }
  }

  /* ---------- Conversación con Claude ---------- */
  async function send(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    if (pending) cancelPending('David ha dicho otra cosa en lugar de confirmar.');
    history.push({ role: 'user', content: text });
    addBubble('me', text);
    await turn();
  }

  async function turn() {
    busy = true; render();
    try {
      for (let guard = 0; guard < 8; guard++) {
        const hoy = `${today()} (${DIAS[new Date().getDay()]})`;
        const res = await Sync.assistantCall(history, hoy);
        history.push({ role: 'assistant', content: res.content });
        const said = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
        const uses0 = (res.content || []).filter((b) => b.type === 'tool_use');
        const needsConfirm = uses0.some((b) => !READ.includes(b.name) && tools[b.name]);
        // Si pregunta algo, vuelve a escuchar sola al terminar de hablar (así no hace falta tocar la pantalla).
        if (said) { addBubble('ai', said); speak(said, !needsConfirm && /\?\s*$/.test(said) ? autoListen : null); }
        if (res.stop_reason === 'refusal') { addBubble('ai', 'No puedo ayudarte con eso.'); break; }
        const uses = (res.content || []).filter((b) => b.type === 'tool_use');
        if (!uses.length) break;
        const results = [];
        const toConfirm = [];
        for (const b of uses) {
          if (READ.includes(b.name)) results.push(run(b));
          else if (tools[b.name]) toConfirm.push(b);
          else results.push({ type: 'tool_result', tool_use_id: b.id, content: 'Herramienta desconocida', is_error: true });
        }
        if (toConfirm.length) {
          pending = { blocks: toConfirm, results };
          const phrase = toConfirm.map(describe).join('. ');
          busy = false; render();
          // Lo dice y se queda escuchando: basta con decir «sí» o «no».
          speak(`${phrase}. ¿Lo confirmo?`, autoListen);
          return; // se sigue al confirmar o cancelar
        }
        history.push({ role: 'user', content: results });
      }
    } catch (e) {
      console.error(e);
      const msg = String((e && e.message) || e);
      addBubble('err', /not-found|internal$/i.test(String(e && e.code)) ? 'El asistente todavía no está activado en el servidor. Prueba dentro de unos minutos.' : msg);
      // Si falló a mitad, la conversación queda coherente quitando el último mensaje sin respuesta.
      while (history.length && history[history.length - 1].role === 'user') history.pop();
    }
    busy = false; render();
  }

  function run(b) {
    try {
      const out = tools[b.name](b.input || {});
      return { type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(out), ...(out && out.error ? { is_error: true } : {}) };
    } catch (e) {
      console.error(e);
      return { type: 'tool_result', tool_use_id: b.id, content: `Error: ${e.message || e}`, is_error: true };
    }
  }

  function confirmPending(byVoice) {
    if (!pending) return;
    const { blocks, results } = pending;
    pending = null;
    // Confirmado con la voz no hay toque, y el móvil no deja abrir otra pestaña: WhatsApp se abre en esta misma.
    const orig = window.open;
    if (byVoice === true) window.open = (url) => { if (url && url !== 'about:blank') setTimeout(() => { location.href = url; }, 600); return null; };
    try { for (const b of blocks) results.push(run(b)); } finally { if (byVoice === true) setTimeout(() => { window.open = orig; }, 3000); }
    App.render();
    addBubble('ok', `✓ ${blocks.map(describe).join(' · ')}`);
    history.push({ role: 'user', content: results });
    turn();
  }
  function cancelPending(why) {
    if (typeof why !== 'string') why = '';
    if (!pending) return;
    const { blocks, results } = pending;
    pending = null;
    for (const b of blocks) results.push({ type: 'tool_result', tool_use_id: b.id, content: why || 'David lo ha cancelado: no se ha hecho.' });
    history.push({ role: 'user', content: results });
    if (!why) { addBubble('ok', '✕ Cancelado'); turn(); }
  }

  /* ---------- Voz ---------- */
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null; let listening = false;
  /** Volver a escuchar sola (sin tocar): solo si el asistente está abierto y no está ya escuchando ni pensando. */
  const autoListen = () => { if (open && !listening && !busy) listen(); };
  function listen() {
    if (!Rec) { UI.toast('Este navegador no entiende la voz: escribe abajo (en Android, usa Chrome).'); return; }
    if (listening) { rec.stop(); return; }
    window.speechSynthesis && speechSynthesis.cancel();
    rec = new Rec();
    rec.lang = 'es-ES'; rec.interimResults = true; rec.continuous = false;
    const input = document.getElementById('asis-text');
    let finalText = '';
    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) finalText += ev.results[i][0].transcript; else interim += ev.results[i][0].transcript;
      }
      if (input) input.value = (finalText + interim).trim();
    };
    rec.onerror = (ev) => { if (ev.error === 'not-allowed') UI.toast('Permite el micrófono para hablar con el asistente'); };
    rec.onend = () => {
      listening = false; render();
      const t = (finalText || (input && input.value) || '').trim();
      if (!t) return;
      if (input) input.value = '';
      // «Sí» / «confirma» con una acción esperando: se confirma; «no» / «cancela»: se cancela.
      if (pending && /^(s[ií]|vale|ok|okay|confirm[ao]?|hazlo|adelante|dale|correcto|perfecto|venga)(?=$|[\s,.!¡?¿])/i.test(t)) { confirmPending(true); return; }
      if (pending && /^(no|cancela|cancelar|d[eé]jalo|para|espera)(?=$|[\s,.!¡?¿])/i.test(t)) { cancelPending(); return; }
      send(t);
    };
    listening = true; render();
    rec.start();
  }
  /** Dice el texto en voz alta; al terminar, «then» (por ejemplo, volver a escuchar). */
  function speak(text, then) {
    const done = () => { if (then && open) setTimeout(then, 250); };
    if (muted || !window.speechSynthesis) { done(); return; }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/[*_#`]/g, ''));
      u.lang = 'es-ES';
      const v = speechSynthesis.getVoices().find((x) => /^es(-|_)ES/i.test(x.lang)) || speechSynthesis.getVoices().find((x) => /^es/i.test(x.lang));
      if (v) u.voice = v;
      u.rate = 1.05;
      let fired = false;
      const once = () => { if (!fired) { fired = true; done(); } };
      u.onend = once; u.onerror = once;
      // Por si el móvil no avisa al acabar de hablar: se calcula lo que tarda (unos 14 caracteres por segundo).
      if (then) setTimeout(once, 1500 + String(text).length * 75);
      speechSynthesis.speak(u);
    } catch (e) { done(); }
  }

  /* ---------- Pantalla ---------- */
  const log = []; // { who, text }
  function addBubble(who, text) { log.push({ who, text }); render(); }
  let open = false;

  function ensureDom() {
    if (document.getElementById('asis-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'asis-fab'; fab.type = 'button'; fab.title = 'Asistente por voz'; fab.setAttribute('aria-label', 'Asistente por voz');
    fab.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3"/></svg>';
    fab.onclick = () => { open = true; render(); if (!log.length) setTimeout(listen, 150); };
    document.body.appendChild(fab);
    const panel = document.createElement('section');
    panel.id = 'asis-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Asistente');
    document.body.appendChild(panel);
  }

  function render() {
    ensureDom();
    const fab = document.getElementById('asis-fab');
    const panel = document.getElementById('asis-panel');
    const signed = window.Sync && Sync.state && Sync.state.user;
    fab.hidden = open || !signed;
    panel.hidden = !open;
    if (!open) return;
    const typed = document.getElementById('asis-text');
    const keep = typed ? typed.value : '';
    panel.innerHTML = `
      <header class="asis-head">
        <strong>🎙️ Asistente</strong>
        <span class="grow"></span>
        <button type="button" class="icon-btn" id="asis-mute" title="${muted ? 'Activar la voz' : 'Silenciar la voz'}" aria-label="${muted ? 'Activar la voz' : 'Silenciar la voz'}">${muted ? '🔇' : '🔊'}</button>
        <button type="button" class="icon-btn" id="asis-new" title="Nueva conversación" aria-label="Nueva conversación">↺</button>
        <button type="button" class="icon-btn" id="asis-close" aria-label="Cerrar">${U.icon('close')}</button>
      </header>
      <div class="asis-log" id="asis-log">
        ${log.length ? '' : `<div class="asis-hint"><p>Pulsa el micrófono y dime qué quieres hacer. Por ejemplo:</p>
          <ul><li>«Apunta a Eduardo 78,4 kilos y 86 de cintura»</li><li>«Ponme una tarea para el viernes: llamar a Laura»</li><li>«Registra el pago de Carlos»</li><li>«Mándale a Marta el enlace de medidas»</li><li>«Quita las sentadillas de la rutina de Eduardo»</li><li>«¿Quién tiene pagos pendientes?» · «¿Cómo va Eduardo?»</li></ul>
          <p class="muted">Antes de cambiar nada te lo enseño para que lo confirmes.</p></div>`}
        ${log.map((m) => `<div class="asis-msg ${m.who}">${esc(m.text)}</div>`).join('')}
        ${pending ? `<div class="asis-confirm"><strong>¿Lo hago?</strong><ul>${pending.blocks.map((b) => `<li>${esc(describe(b))}</li>`).join('')}</ul>
          <div class="asis-confirm-btns"><button type="button" class="btn primary" id="asis-yes">${U.icon('check')}Confirmar</button><button type="button" class="btn" id="asis-no">Cancelar</button></div></div>` : ''}
        ${busy ? '<div class="asis-msg ai asis-dots"><i></i><i></i><i></i></div>' : ''}
      </div>
      <form class="asis-bar" id="asis-form">
        <button type="button" class="asis-mic${listening ? ' on' : ''}" id="asis-mic" aria-label="${listening ? 'Parar' : 'Hablar'}">${listening ? '■' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3"/></svg>'}</button>
        <input id="asis-text" type="text" placeholder="${listening ? 'Te escucho…' : 'O escribe aquí…'}" autocomplete="off" value="${esc(keep)}">
        <button type="submit" class="btn primary" ${busy ? 'disabled' : ''} aria-label="Enviar">➤</button>
      </form>`;
    const logEl = document.getElementById('asis-log');
    logEl.scrollTop = logEl.scrollHeight;
    document.getElementById('asis-close').onclick = () => { open = false; if (rec && listening) rec.stop(); window.speechSynthesis && speechSynthesis.cancel(); render(); };
    document.getElementById('asis-new').onclick = () => { history = []; log.length = 0; pending = null; window.speechSynthesis && speechSynthesis.cancel(); render(); };
    document.getElementById('asis-mute').onclick = () => { muted = !muted; try { localStorage.setItem('entrenapro:asis-mute', muted ? '1' : '0'); } catch (e) { /* nada */ } if (muted && window.speechSynthesis) speechSynthesis.cancel(); render(); };
    document.getElementById('asis-mic').onclick = listen;
    document.getElementById('asis-form').onsubmit = (ev) => { ev.preventDefault(); const t = document.getElementById('asis-text'); const v = t.value; t.value = ''; send(v); };
    const yes = document.getElementById('asis-yes'); if (yes) yes.onclick = () => confirmPending(false);
    const no = document.getElementById('asis-no'); if (no) no.onclick = () => cancelPending();
  }

  // El botón aparece cuando hay sesión de Google (la IA solo funciona con ella).
  setInterval(() => { const fab = document.getElementById('asis-fab'); const signed = window.Sync && Sync.state && Sync.state.user; if (!fab || fab.hidden !== (open || !signed)) render(); }, 1500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};

  window.Assistant = { send, open: () => { open = true; render(); } };
})();
