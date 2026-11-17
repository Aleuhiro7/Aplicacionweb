/* Página pública del cuestionario: el cliente la abre desde el enlace de WhatsApp
 * (cuestionario.html?t=TOKEN), responde sin necesidad de cuenta y sus respuestas
 * quedan guardadas en la nube para que aparezcan en su ficha. */
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
const MAX = 3000; // caracteres por respuesta

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function message(title, text) {
  root.innerHTML = `<h1 class="q-title">${esc(title)}</h1><p class="q-intro">${esc(text)}</p>`;
}

function thanks(name, coach) {
  root.innerHTML = `
    <div class="q-done">
      <div class="q-done-icon" aria-hidden="true">✓</div>
      <h1 class="q-title">¡Gracias${name ? ', ' + esc(name) : ''}!</h1>
      <p class="q-intro">Tus respuestas se han enviado correctamente. ${esc(coach || 'Tu entrenador')} las revisará para preparar tu plan y te escribirá por WhatsApp.</p>
    </div>`;
}

async function start() {
  const token = new URLSearchParams(location.search).get('t');
  if (!token || !/^[a-f0-9]{20,64}$/.test(token)) {
    message('Enlace no válido', 'Este enlace no es correcto. Pide a tu entrenador que te lo vuelva a enviar.');
    return;
  }
  const ref = doc(db, 'cuestionarios', token);
  let snap;
  try {
    snap = await getDoc(ref);
  } catch (e) {
    console.error(e);
    message('No se ha podido abrir', 'Comprueba tu conexión e inténtalo de nuevo en unos minutos.');
    return;
  }
  if (!snap.exists()) {
    message('Enlace no válido', 'Este cuestionario ya no existe. Pide a tu entrenador que te envíe uno nuevo.');
    return;
  }
  const data = snap.data();
  const questions = Array.isArray(data.questions) ? data.questions : [];
  if (data.answeredAt) { thanks(data.clientName, data.coach); return; }

  const draftKey = 'cuestionario:' + token;
  let draft = {};
  try { draft = JSON.parse(localStorage.getItem(draftKey) || '{}'); } catch (e) { /* sin borrador */ }

  // «Pregunta | A | B | C | D» se contesta marcando; sin opciones, se escribe (altura, peso…).
  const parsed = questions.map((raw) => {
    const parts = String(raw || '').split('|').map((x) => x.trim());
    const text = parts[0];
    const opts = parts.slice(1).filter(Boolean).slice(0, 4);
    const kind = opts.length ? 'choice'
      : /^altura/i.test(text) ? 'height'
      : /^peso/i.test(text) ? 'weight'
      : /nacimiento/i.test(text) ? 'birth'
      : /tel[eé]fono/i.test(text) ? 'tel'
      : /correo|e-?mail/i.test(text) ? 'email'
      : /^nombre/i.test(text) ? 'name' : 'text';
    return { text, opts, kind };
  });
  const field = (q, i) => {
    const v = draft['a' + i] || '';
    if (q.kind === 'choice') {
      return `<fieldset class="field q-field q-choice" id="f${i}">
          <legend><span class="q-num">${i + 1}</span>${esc(q.text)}</legend>
          <div class="q-opts${q.opts.length > 2 ? '' : ' two'}">${q.opts.map((o, k) => `
            <label class="q-opt"><input type="radio" name="a${i}" value="${esc(o)}" ${v === o ? 'checked' : ''}>
              <span class="q-letter">${'ABCD'[k]}</span><span class="q-opt-text">${esc(o)}</span></label>`).join('')}
          </div>
        </fieldset>`;
    }
    if (q.kind === 'birth') {
      const [dd, mm, yy] = v.split('/');
      const year = new Date().getFullYear();
      const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const sel = (part, label, opts, cur) => `<select id="a${i}${part}" name="a${i}${part}" aria-label="${label}"><option value="">${label}</option>${opts.map(([val, txt]) => `<option value="${val}" ${String(Number(cur)) === String(Number(val)) && cur ? 'selected' : ''}>${txt}</option>`).join('')}</select>`;
      return `<div class="field q-field" id="f${i}">
          <label for="a${i}d"><span class="q-num">${i + 1}</span>${esc(q.text)}</label>
          <div class="q-birth">
            ${sel('d', 'Día', Array.from({ length: 31 }, (_, k) => [String(k + 1).padStart(2, '0'), k + 1]), dd)}
            ${sel('m', 'Mes', MONTHS.map((n, k) => [String(k + 1).padStart(2, '0'), n]), mm)}
            ${sel('y', 'Año', Array.from({ length: 86 }, (_, k) => [year - 14 - k, year - 14 - k]), yy)}
          </div>
        </div>`;
    }
    if (q.kind === 'height' || q.kind === 'weight') {
      const h = q.kind === 'height';
      return `<div class="field q-field" id="f${i}">
          <label for="a${i}"><span class="q-num">${i + 1}</span>${esc(q.text)}</label>
          <div class="q-measure"><input id="a${i}" name="a${i}" type="number" inputmode="decimal" step="${h ? 1 : 0.1}" min="${h ? 120 : 30}" max="${h ? 230 : 250}" placeholder="${h ? 'Ej.: 175' : 'Ej.: 78,5'}" value="${esc(v)}"><span>${h ? 'cm' : 'kg'}</span></div>
        </div>`;
    }
    const type = q.kind === 'tel' ? 'tel' : q.kind === 'email' ? 'email' : 'text';
    return q.kind === 'text'
      ? `<div class="field q-field" id="f${i}"><label for="a${i}"><span class="q-num">${i + 1}</span>${esc(q.text)}</label>
          <textarea id="a${i}" name="a${i}" rows="2" maxlength="${MAX}">${esc(v)}</textarea></div>`
      : `<div class="field q-field" id="f${i}"><label for="a${i}"><span class="q-num">${i + 1}</span>${esc(q.text)}</label>
          <input id="a${i}" name="a${i}" type="${type}" maxlength="120" ${type === 'tel' ? 'inputmode="tel" autocomplete="tel"' : type === 'email' ? 'inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="tucorreo@ejemplo.com"' : 'autocomplete="name"'} value="${esc(v)}"></div>`;
  };
  const valueOf = (i) => {
    if (parsed[i].kind === 'birth') {
      const p = ['d', 'm', 'y'].map((k) => (form.elements[`a${i}${k}`] || {}).value || '');
      if (!p.every(Boolean)) return '';
      const dt = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
      return dt.getDate() === Number(p[0]) ? `${p[0]}/${p[1]}/${p[2]}` : '';
    }
    const el = form.elements['a' + i];
    if (!el) return '';
    return String(el.value || '').trim();
  };

  root.innerHTML = `
    <h1 class="q-title">Hola${data.clientName ? ', ' + esc(data.clientName) : ''}</h1>
    <p class="q-intro">Para preparar tu plan necesito conocerte un poco mejor. Solo tienes que marcar una respuesta en cada pregunta y escribir tu altura y tu peso. Es un minuto.</p>
    <form id="q-form" novalidate>
      ${parsed.map(field).join('')}
      <p class="q-error" id="q-error" role="alert" hidden></p>
      <button type="submit" class="btn primary q-submit">Enviar respuestas</button>
      <p class="muted q-note">Tus respuestas solo las verá ${esc(data.coach || 'tu entrenador')}.</p>
    </form>`;

  const form = document.getElementById('q-form');
  // Guarda un borrador en el móvil por si se cierra la página antes de enviar.
  const saveDraft = () => {
    const d = {};
    questions.forEach((_, i) => { d['a' + i] = valueOf(i); });
    try { localStorage.setItem(draftKey, JSON.stringify(d)); } catch (e) { /* sin espacio */ }
  };
  const clearMissing = (e) => {
    saveDraft();
    const fs = e.target.closest('.q-field');
    if (fs && valueOf(Number(fs.id.slice(1)))) fs.classList.remove('q-missing');
    if (!form.querySelector('.q-missing')) document.getElementById('q-error').hidden = true;
  };
  form.addEventListener('input', clearMissing);
  form.addEventListener('change', clearMissing);
  // Los cuadros de texto crecen con lo escrito.
  form.querySelectorAll('textarea').forEach((t) => {
    const fit = () => { t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight, 52) + 'px'; };
    t.addEventListener('input', fit);
    fit();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('q-error');
    const answers = parsed.map((q, i) => {
      const v = valueOf(i).slice(0, MAX);
      if (!v) return '';
      if (q.kind === 'height') return `${v.replace('.', ',')} cm`;
      if (q.kind === 'weight') return `${v.replace('.', ',')} kg`;
      return v;
    });
    // Hay que marcar todas las opciones y poner altura y peso (lo escrito a mano es opcional).
    const badEmail = (q, a) => q.kind === 'email' && a && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(a);
    const missing = parsed.map((q, i) => (q.kind !== 'text' && (!answers[i] || badEmail(q, answers[i])) ? i : -1)).filter((i) => i >= 0);
    form.querySelectorAll('.q-missing').forEach((x) => x.classList.remove('q-missing'));
    if (missing.length) {
      missing.forEach((i) => document.getElementById('f' + i).classList.add('q-missing'));
      err.textContent = missing.length === 1 ? (badEmail(parsed[missing[0]], answers[missing[0]]) ? 'Revisa tu correo electrónico: no parece correcto.' : `Te falta la pregunta ${missing[0] + 1}.`) : `Te faltan ${missing.length} preguntas (marcadas en rojo).`;
      err.hidden = false;
      document.getElementById('f' + missing[0]).scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const btn = form.querySelector('.q-submit');
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    err.hidden = true;
    try {
      await updateDoc(ref, { answers, answeredAt: serverTimestamp() });
      try { localStorage.removeItem(draftKey); } catch (x) { /* nada */ }
      thanks(data.clientName, data.coach);
      window.scrollTo(0, 0);
    } catch (x) {
      console.error(x);
      err.textContent = 'No se han podido enviar las respuestas. Comprueba tu conexión e inténtalo de nuevo.';
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Enviar respuestas';
    }
  });
}

start();
