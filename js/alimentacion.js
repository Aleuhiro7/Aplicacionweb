/* Cuestionario de alimentación (alimentacion.html?t=CÓDIGO): el cliente, sin cuenta, elige cuántas comidas quiere
 * hacer al día, sus alimentos favoritos (hasta 10 de proteínas, de hidratos y de grasas, de la biblioteca de su
 * entrenador) y los suplementos que quiere tomar. Se guarda en cuestionarios/{código} (solo una vez) y le llega al
 * entrenador a la dieta del cliente. Respuestas: [comidas, proteínas, hidratos, grasas, suplementos] («|» separa). */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const app = initializeApp({
  apiKey: 'AIzaSyAKJyR04QdmU_IEWhiH_lwxaUBOFLsM9Ek',
  authDomain: 'aplicacionweb7.firebaseapp.com',
  projectId: 'aplicacionweb7',
  storageBucket: 'aplicacionweb7.firebasestorage.app',
  messagingSenderId: '1017996325873',
  appId: '1:1017996325873:web:413c917aecb3154d7c0a50',
});
const db = getFirestore(app);
const root = document.getElementById('q-root');
const MAX = 10; // favoritos por grupo
const GROUPS = [
  ['proteinas', 'Proteínas', '🥩', 'Carne, pescado, huevos, lácteos…'],
  ['hidratos', 'Hidratos', '🍚', 'Arroz, pasta, pan, patata, fruta…'],
  ['grasas', 'Grasas', '🥑', 'Aceite, frutos secos, aguacate…'],
];
const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** Nombre para mostrar: sin el «(crudo)», que aquí ya se sobreentiende (todos son en crudo). */
const shown = (n) => String(n || '').replace(/\s*\(crud[oa]s?\)/i, '').trim();
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function message(title, text) { root.innerHTML = `<h1 class="q-title">${esc(title)}</h1><p class="q-intro">${esc(text)}</p>`; }
function thanks(name, coach) {
  root.innerHTML = `<div class="q-done"><div class="q-done-icon" aria-hidden="true">✓</div>
    <h1 class="q-title">¡Gracias${name ? ', ' + esc(name) : ''}!</h1>
    <p class="q-intro">${esc(coach || 'Tu entrenador')} ya tiene tus preferencias y las tendrá en cuenta para prepararte la dieta. Te escribirá por WhatsApp. 🍽️</p></div>`;
}

async function start() {
  const token = new URLSearchParams(location.search).get('t');
  if (!token || !/^[a-f0-9]{20,64}$/.test(token)) { message('Enlace no válido', 'Este enlace no es correcto. Pide a tu entrenador que te lo vuelva a enviar.'); return; }
  const ref = doc(db, 'cuestionarios', token);
  let snap;
  try { snap = await getDoc(ref); } catch (e) { console.error(e); message('No se ha podido abrir', 'Comprueba tu conexión e inténtalo de nuevo en unos minutos.'); return; }
  if (!snap.exists() || snap.data().kind !== 'alimentacion') { message('Enlace no válido', 'Este cuestionario ya no existe. Pide a tu entrenador que te envíe uno nuevo.'); return; }
  const data = snap.data();
  if (data.answeredAt) { thanks(data.clientName, data.coach); return; }
  const foods = data.foods || {};
  const supps = Array.isArray(data.supps) ? data.supps : [];

  const draftKey = 'alimentacion:' + token;
  let st = { meals: '', proteinas: [], hidratos: [], grasas: [], supps: [] };
  try { st = Object.assign(st, JSON.parse(localStorage.getItem(draftKey) || '{}')); } catch (e) { /* sin borrador */ }
  const saveDraft = () => { try { localStorage.setItem(draftKey, JSON.stringify(st)); } catch (e) { /* sin espacio */ } };
  const filters = { proteinas: '', hidratos: '', grasas: '' };

  const groupList = (g) => {
    const f = norm(filters[g]);
    const items = (foods[g] || []).filter((x) => !f || norm(x.n).includes(f) || norm(x.c).includes(f));
    const cats = [...new Set(items.map((x) => x.c))];
    if (!items.length) return '<p class="muted" style="margin:6px 0">No hay ningún alimento con ese nombre.</p>';
    return cats.map((c) => `<div class="fq-cat"><small>${esc(c)}</small><div class="fq-opts">${items.filter((x) => x.c === c).map((x) => {
      const on = st[g].includes(x.n);
      return `<button type="button" class="fq-opt${on ? ' on' : ''}" data-g="${g}" data-n="${esc(x.n)}" aria-pressed="${on}">${on ? '✓ ' : ''}${esc(shown(x.n))}</button>`;
    }).join('')}</div></div>`).join('');
  };
  const groupBox = ([g, label, ic, hint]) => `
    <section class="fq-group" id="fq-${g}">
      <div class="fq-head"><h2>${ic} ${label}</h2><span class="fq-count${st[g].length ? ' some' : ''}">${st[g].length}/${MAX}</span></div>
      <p class="muted fq-hint">${hint} Elige hasta ${MAX} favoritos.</p>
      <div class="fq-picked">${st[g].map((n) => `<button type="button" class="fq-opt on" data-g="${g}" data-n="${esc(n)}">✓ ${esc(shown(n))} ✕</button>`).join('') || '<span class="muted">Todavía no has elegido ninguno.</span>'}</div>
      <input type="search" class="fq-search" data-g="${g}" placeholder="Buscar (p. ej. pollo, arroz…)" value="${esc(filters[g])}" autocomplete="off">
      <div class="fq-all" data-list="${g}">${groupList(g)}</div>
    </section>`;

  function render() {
    root.innerHTML = `
      <h1 class="q-title">Tu alimentación${data.clientName ? `, ${esc(data.clientName)}` : ''}</h1>
      <p class="q-intro">Para hacerte una dieta que te guste y puedas cumplir, dime cuántas comidas quieres hacer, tus alimentos favoritos y qué suplementos quieres tomar. Son 3 minutos.</p>
      <section class="fq-group">
        <div class="fq-head"><h2>🕒 ¿Cuántas comidas quieres hacer al día?</h2></div>
        <div class="fq-meals">${['2', '3', '4', '5', '6'].map((n) => `<button type="button" class="fq-meal${st.meals === n ? ' on' : ''}" data-meals="${n}">${n}</button>`).join('')}</div>
      </section>
      ${GROUPS.map(groupBox).join('')}
      <section class="fq-group">
        <div class="fq-head"><h2>💊 Suplementos</h2></div>
        <p class="muted fq-hint">Marca los que quieras tomar (puedes marcar varios). Si no quieres ninguno, marca «Ninguno».</p>
        <div class="fq-opts">${supps.map((s) => `<button type="button" class="fq-opt${st.supps.includes(s.k) ? ' on' : ''}" data-supp="${esc(s.k)}">${st.supps.includes(s.k) ? '✓ ' : ''}${esc(s.n)}</button>`).join('')}
          <button type="button" class="fq-opt${st.supps.includes('ninguno') ? ' on' : ''}" data-supp="ninguno">${st.supps.includes('ninguno') ? '✓ ' : ''}Ninguno</button></div>
      </section>
      <p class="rv-error" id="fq-error" hidden></p>
      <button type="button" class="btn primary q-submit" id="fq-send">Enviar</button>`;
    bind();
  }
  function refreshGroup(g) {
    const box = document.getElementById('fq-' + g);
    const search = box.querySelector('.fq-search');
    const pos = search === document.activeElement ? search.selectionStart : null;
    box.outerHTML = groupBox(GROUPS.find((x) => x[0] === g));
    bind();
    if (pos !== null) { const s = document.querySelector(`#fq-${g} .fq-search`); s.focus(); s.setSelectionRange(pos, pos); }
  }
  function bind() {
    root.querySelectorAll('[data-meals]').forEach((b) => { b.onclick = () => { st.meals = b.dataset.meals; saveDraft(); root.querySelectorAll('[data-meals]').forEach((x) => x.classList.toggle('on', x === b)); }; });
    root.querySelectorAll('.fq-opt[data-g]').forEach((b) => {
      b.onclick = () => {
        const g = b.dataset.g; const n = b.dataset.n;
        if (st[g].includes(n)) st[g] = st[g].filter((x) => x !== n);
        else if (st[g].length >= MAX) { showError(`Ya tienes ${MAX} ${GROUPS.find((x) => x[0] === g)[1].toLowerCase()}. Quita uno para elegir otro.`); return; }
        else st[g].push(n);
        showError(''); saveDraft(); refreshGroup(g);
      };
    });
    root.querySelectorAll('.fq-search').forEach((inp) => { inp.oninput = () => { filters[inp.dataset.g] = inp.value; document.querySelector(`[data-list="${inp.dataset.g}"]`).innerHTML = groupList(inp.dataset.g); bind(); }; });
    root.querySelectorAll('[data-supp]').forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.supp;
        if (k === 'ninguno') st.supps = st.supps.includes('ninguno') ? [] : ['ninguno'];
        else st.supps = st.supps.includes(k) ? st.supps.filter((x) => x !== k) : [...st.supps.filter((x) => x !== 'ninguno'), k];
        saveDraft();
        root.querySelectorAll('[data-supp]').forEach((x) => { const on = st.supps.includes(x.dataset.supp); x.classList.toggle('on', on); x.textContent = (on ? '✓ ' : '') + x.textContent.replace(/^✓ /, ''); });
      };
    });
    const send = document.getElementById('fq-send');
    if (send) send.onclick = submit;
  }
  const showError = (t) => { const el = document.getElementById('fq-error'); if (!el) return; el.textContent = t; el.hidden = !t; };

  async function submit() {
    if (!st.meals) { showError('Elige cuántas comidas quieres hacer al día.'); document.querySelector('.fq-meals').scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    const empty = GROUPS.filter(([g]) => !st[g].length).map((x) => x[1].toLowerCase());
    if (empty.length) { showError(`Elige al menos un alimento de ${empty.join(' y de ')}.`); document.getElementById('fq-' + GROUPS.find(([g]) => !st[g].length)[0]).scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    if (!st.supps.length) { showError('Marca los suplementos que quieras tomar, o «Ninguno».'); return; }
    showError('');
    const btn = document.getElementById('fq-send');
    btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      await updateDoc(ref, { answers: [st.meals, st.proteinas.join('|'), st.hidratos.join('|'), st.grasas.join('|'), st.supps.join('|')], answeredAt: serverTimestamp() });
      try { localStorage.removeItem(draftKey); } catch (e) { /* nada */ }
      thanks(data.clientName, data.coach); window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      showError('No se ha podido enviar. Comprueba tu conexión y vuelve a intentarlo.');
      btn.disabled = false; btn.textContent = 'Enviar';
    }
  }
  render();
}
start();
