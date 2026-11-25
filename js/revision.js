/* Página pública de la revisión (revision.html?t=CÓDIGO): el cliente la abre desde el enlace de WhatsApp y, sin
 * cuenta, envía su peso, su cintura y 3 fotos (frente, perfil y espalda). Lo recibe la función «enviarRevision»
 * (functions/index.js), que lo deja en la ficha del cliente en la app del entrenador. Solo se puede enviar una vez. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';

const app = initializeApp({
  apiKey: 'AIzaSyAKJyR04QdmU_IEWhiH_lwxaUBOFLsM9Ek',
  authDomain: 'aplicacionweb7.firebaseapp.com',
  projectId: 'aplicacionweb7',
  storageBucket: 'aplicacionweb7.firebasestorage.app',
  messagingSenderId: '1017996325873',
  appId: '1:1017996325873:web:413c917aecb3154d7c0a50',
});
const db = getFirestore(app);
const enviar = httpsCallable(getFunctions(app, 'europe-west1'), 'enviarRevision', { timeout: 120000 });

const root = document.getElementById('q-root');
const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* Siluetas de cada foto (de frente, de lado y de espaldas). */
const BODY = 'M50 22a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-13 4h26l9 30-6 2-7-22v28l4 44h-7l-6-38-6 38h-7l4-44V36l-7 22-6-2Z';
const SIDE = 'M51 22a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-6 4h12l5 12-2 22-4 1 1-18-1 21 2 44h-7l-4-38-2 38h-6l3-44-1-26-2-10Z';
const POSES = [
  { id: 'frente', label: 'Frente', hint: 'Mirando a la cámara', path: BODY },
  { id: 'perfil', label: 'Perfil', hint: 'De lado (lado derecho)', path: SIDE },
  { id: 'espalda', label: 'Espalda', hint: 'De espaldas a la cámara', path: BODY, back: true },
];
const silhouette = (p) => `<svg viewBox="22 0 56 112" aria-hidden="true"><path d="${p.path}"/>${p.back ? '<path d="M44 28h12v3H44z" opacity=".5"/>' : ''}</svg>`;

function message(title, text) {
  root.innerHTML = `<h1 class="q-title">${esc(title)}</h1><p class="q-intro">${esc(text)}</p>`;
}
function thanks(name, coach) {
  root.innerHTML = `<div class="q-done">
      <div class="q-done-icon" aria-hidden="true">✓</div>
      <h1 class="q-title">¡Recibido${name ? ', ' + esc(name) : ''}!</h1>
      <p class="q-intro">Tu peso, tu cintura y tus fotos han llegado a ${esc(coach || 'tu entrenador')}. Las revisará y te escribirá por WhatsApp. ¡Buen trabajo! 💪</p>
    </div>`;
}

/** Reduce la foto (lado mayor 1400 px, JPEG) para que pese poco y suba rápido. */
function compress(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let side = 1400; let q = 0.82; let out = '';
      for (let i = 0; i < 6; i++) {
        const k = Math.min(1, side / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q);
        if (out.length < 900 * 1024) break;
        side *= 0.8; q = Math.max(0.6, q - 0.06);
      }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se ha podido leer la foto. Prueba con otra.')); };
    img.src = url;
  });
}

async function start() {
  const token = new URLSearchParams(location.search).get('t');
  if (!token || !/^[a-f0-9]{20,64}$/.test(token)) { message('Enlace no válido', 'Este enlace no es correcto. Pide a tu entrenador que te lo vuelva a enviar.'); return; }
  let snap;
  try { snap = await getDoc(doc(db, 'cuestionarios', token)); } catch (e) {
    console.error(e); message('No se ha podido abrir', 'Comprueba tu conexión e inténtalo de nuevo en unos minutos.'); return;
  }
  if (!snap.exists() || snap.data().kind !== 'revision') { message('Enlace no válido', 'Esta revisión ya no existe. Pide a tu entrenador que te envíe un enlace nuevo.'); return; }
  const data = snap.data();
  if (data.answeredAt) { thanks(data.clientName, data.coach); return; }
  const first = !!data.first;
  const fotos = {};

  root.innerHTML = `
    <h1 class="q-title">${first ? 'Tus primeras medidas' : 'Tu revisión'}${data.clientName ? `, ${esc(data.clientName)}` : ''}</h1>
    <p class="q-intro">${first
      ? 'Antes de empezar necesito tu punto de partida: tu peso, tu cintura y 3 fotos. Así podremos ver tu progreso con datos reales.'
      : 'Toca revisar cómo vas. Envíame tu peso, tu cintura y 3 fotos nuevas, igual que la última vez, para comparar.'}</p>

    <section class="rv-how">
      <h2>📋 Cómo hacerlo bien</h2>
      <ol>
        <li><b>Cuándo:</b> por la mañana, en ayunas y después de ir al baño. Siempre en las mismas condiciones.</li>
        <li><b>Peso:</b> en la misma báscula, en el suelo duro (no en alfombra), con la menor ropa posible.</li>
        <li><b>Cintura:</b> con una cinta métrica a la altura del ombligo, de pie, relajado y sin meter tripa. La cinta recta y sin apretar. Mídela al final de soltar el aire.</li>
        <li><b>Fotos:</b> ropa ajustada (ropa interior, bañador o top y pantalón corto), con buena luz y fondo liso. Que salga el cuerpo entero, de la cabeza a los pies.</li>
        <li><b>Postura:</b> de pie, relajado, brazos un poco separados del cuerpo, sin posar ni apretar. El móvil a la altura del pecho y a unos 2–3 metros (mejor si te la hace otra persona o con temporizador).</li>
      </ol>
    </section>

    <form id="rv-form" novalidate>
      <div class="rv-nums">
        <label class="field"><span>Peso</span><div class="rv-unit"><input id="rv-peso" type="text" inputmode="decimal" placeholder="75,4" autocomplete="off"><em>kg</em></div></label>
        <label class="field"><span>Cintura</span><div class="rv-unit"><input id="rv-cintura" type="text" inputmode="decimal" placeholder="84" autocomplete="off"><em>cm</em></div></label>
      </div>
      <h2 class="rv-h">📸 Tus 3 fotos</h2>
      <div class="rv-photos">${POSES.map((p) => `
        <label class="rv-photo" id="rv-${p.id}">
          <input type="file" accept="image/*" data-pose="${p.id}" hidden>
          <span class="rv-pic">${silhouette(p)}<img alt=""></span>
          <strong>${p.label}</strong><small>${p.hint}</small>
          <em class="rv-change">Toca para elegir</em>
        </label>`).join('')}</div>
      <label class="field"><span>¿Algo que quieras contarme? <small class="muted">(opcional)</small></span>
        <textarea id="rv-nota" rows="3" maxlength="1500" placeholder="Cómo te has sentido, hambre, energía, descanso, dudas…"></textarea></label>
      <p class="rv-error" id="rv-error" hidden></p>
      <button type="submit" class="btn primary q-submit" id="rv-send">Enviar mi revisión</button>
      <p class="muted rv-privacy">Tus fotos solo las ve tu entrenador.</p>
    </form>`;

  root.querySelectorAll('input[type=file]').forEach((inp) => {
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const box = document.getElementById('rv-' + inp.dataset.pose);
      box.classList.add('loading');
      try {
        fotos[inp.dataset.pose] = await compress(f);
        box.querySelector('img').src = fotos[inp.dataset.pose];
        box.classList.add('done');
        box.querySelector('.rv-change').textContent = '✓ Lista · toca para cambiar';
        if (/foto/i.test(document.getElementById('rv-error').textContent)) showError('');
      } catch (e) { showError(e.message); }
      box.classList.remove('loading');
    });
  });
  const showError = (t) => { const el = document.getElementById('rv-error'); el.textContent = t; el.hidden = !t; if (t) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
  const num = (id) => Number(String(document.getElementById(id).value || '').replace(',', '.').trim());

  document.getElementById('rv-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const peso = num('rv-peso'); const cintura = num('rv-cintura');
    if (!(peso >= 25 && peso <= 350)) { showError('Escribe tu peso en kilos (por ejemplo 75,4).'); return; }
    if (!(cintura >= 30 && cintura <= 250)) { showError('Escribe tu cintura en centímetros (por ejemplo 84).'); return; }
    const missing = POSES.filter((p) => !fotos[p.id]).map((p) => p.label.toLowerCase());
    if (missing.length) { showError(`Falta la foto de ${missing.join(' y ')}.`); return; }
    showError('');
    const btn = document.getElementById('rv-send');
    btn.disabled = true; btn.textContent = 'Enviando… (puede tardar un poco)';
    try {
      await enviar({ token, peso, cintura, fotos, nota: document.getElementById('rv-nota').value.trim() });
      thanks(data.clientName, data.coach);
      window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      if (String(e.code || '').includes('already-exists')) { thanks(data.clientName, data.coach); return; }
      showError(e.message && !/internal/i.test(e.message) ? e.message : 'No se ha podido enviar. Comprueba tu conexión y vuelve a intentarlo.');
      btn.disabled = false; btn.textContent = 'Enviar mi revisión';
    }
  });
}
start();
