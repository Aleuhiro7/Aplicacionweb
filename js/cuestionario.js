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

  root.innerHTML = `
    <h1 class="q-title">Hola${data.clientName ? ', ' + esc(data.clientName) : ''}</h1>
    <p class="q-intro">Para preparar tu plan necesito conocerte un poco mejor. Responde con calma; puedes dejar en blanco lo que no sepas.</p>
    <form id="q-form" novalidate>
      ${questions.map((q, i) => `
        <div class="field q-field">
          <label for="a${i}"><span class="q-num">${i + 1}</span>${esc(q)}</label>
          <textarea id="a${i}" name="a${i}" rows="2" maxlength="${MAX}">${esc(draft['a' + i] || '')}</textarea>
        </div>`).join('')}
      <p class="q-error" id="q-error" role="alert" hidden></p>
      <button type="submit" class="btn primary q-submit">Enviar respuestas</button>
      <p class="muted q-note">Tus respuestas solo las verá ${esc(data.coach || 'tu entrenador')}.</p>
    </form>`;

  const form = document.getElementById('q-form');
  // Guarda un borrador en el móvil por si se cierra la página antes de enviar.
  form.addEventListener('input', () => {
    const d = {};
    questions.forEach((_, i) => { d['a' + i] = form.elements['a' + i].value; });
    try { localStorage.setItem(draftKey, JSON.stringify(d)); } catch (e) { /* sin espacio */ }
  });
  // Los cuadros crecen con el texto.
  form.querySelectorAll('textarea').forEach((t) => {
    const fit = () => { t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight, 52) + 'px'; };
    t.addEventListener('input', fit);
    fit();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const answers = questions.map((_, i) => form.elements['a' + i].value.trim().slice(0, MAX));
    const err = document.getElementById('q-error');
    if (!answers.some(Boolean)) {
      err.textContent = 'Responde al menos una pregunta antes de enviar.';
      err.hidden = false;
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
