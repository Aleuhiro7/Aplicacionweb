/* Zona del cliente (cliente.html): cada cliente entra con su correo y su contraseña y ve su rutina,
 * su dieta y la guía de entrenamiento. Lo que ve lo publica el entrenador desde la app (portal/{código}).
 *
 * - La primera vez llega con la invitación (cliente.html?c=CÓDIGO) y crea su cuenta: se apunta en
 *   members/{uid} qué zona es la suya y en la zona, quién es (para que el entrenador lo vea).
 * - Después entra solo con su correo y su contraseña (también sin el código en el enlace).
 * Usa una sesión de Firebase aparte («cliente»), así no se mezcla nunca con la del entrenador. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, signOut,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const app = initializeApp({
  apiKey: 'AIzaSyAKJyR04QdmU_IEWhiH_lwxaUBOFLsM9Ek',
  authDomain: 'aplicacionweb7.firebaseapp.com',
  projectId: 'aplicacionweb7',
  storageBucket: 'aplicacionweb7.firebasestorage.app',
  messagingSenderId: '1017996325873',
  appId: '1:1017996325873:web:413c917aecb3154d7c0a50',
}, 'cliente');
const auth = getAuth(app);
auth.languageCode = 'es';
const db = getFirestore(app);

const root = document.getElementById('cz-root');
const urlToken = (() => { const t = new URLSearchParams(location.search).get('c'); return t && /^[a-f0-9]{20,64}$/.test(t) ? t : ''; })();
let portal = null; // datos de su zona
let token = '';
let mode = 'login'; // en el formulario: «signup» (crear cuenta), «login» o «reset»
let busy = false;

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const firstName = (n) => String(n || '').trim().split(' ')[0];

/* ---------- Mensajes de error en español ---------- */
function authError(e) {
  const code = (e && e.code) || '';
  if (code === 'auth/email-already-in-use') return 'Ese correo ya tiene una cuenta. Entra con tu contraseña.';
  if (code === 'auth/invalid-email') return 'El correo no es válido.';
  if (code === 'auth/weak-password') return 'La contraseña tiene que tener al menos 6 caracteres.';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-login-credentials'].includes(code)) return 'Correo o contraseña incorrectos.';
  if (code === 'auth/too-many-requests') return 'Demasiados intentos. Espera unos minutos y vuelve a probar.';
  if (code === 'auth/network-request-failed') return 'Sin conexión. Comprueba tu internet y vuelve a probar.';
  if (code === 'auth/operation-not-allowed') return 'El acceso con correo todavía no está activado. Avisa a tu entrenador.';
  return 'No se ha podido completar. Vuelve a intentarlo.';
}

/* ---------- Pantallas de acceso ---------- */
function message(title, text, extra = '') {
  root.innerHTML = `<section class="card cz-card"><h1 class="q-title">${esc(title)}</h1><p class="q-intro">${esc(text)}</p>${extra}</section>`;
}

function authForm(invite) {
  const name = invite && invite.clientName ? firstName(invite.clientName) : '';
  const titles = {
    signup: name ? `Hola, ${name}. Crea tu cuenta` : 'Crea tu cuenta',
    login: name ? `Hola, ${name}` : 'Entra en tu zona',
    reset: 'Recuperar contraseña',
  };
  const intros = {
    signup: 'Tu rutina, tu dieta y la guía de entrenamiento, siempre en el móvil. Pon tu correo y elige una contraseña: con ellos entrarás a partir de ahora.',
    login: 'Entra con tu correo y tu contraseña.',
    reset: 'Pon tu correo y te enviaremos un enlace para crear una contraseña nueva.',
  };
  root.innerHTML = `<section class="card cz-card">
    <h1 class="q-title">${esc(titles[mode])}</h1>
    <p class="q-intro">${esc(intros[mode])}</p>
    <form id="cz-form" class="cz-form" novalidate>
      <div class="field"><label for="cz-email">Correo electrónico</label><input id="cz-email" type="email" autocomplete="email" inputmode="email" required></div>
      ${mode === 'reset' ? '' : `<div class="field"><label for="cz-pass">${mode === 'signup' ? 'Elige una contraseña' : 'Contraseña'}</label><input id="cz-pass" type="password" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" minlength="6" required>${mode === 'signup' ? '<div class="hint">Mínimo 6 caracteres.</div>' : ''}</div>`}
      ${mode === 'signup' ? '<div class="field"><label for="cz-pass2">Repite la contraseña</label><input id="cz-pass2" type="password" autocomplete="new-password" minlength="6" required></div>' : ''}
      <p class="cz-error" id="cz-error" role="alert" hidden></p>
      <button type="submit" class="btn primary cz-submit">${mode === 'signup' ? 'Crear mi cuenta' : mode === 'login' ? 'Entrar' : 'Enviar enlace'}</button>
    </form>
    <div class="cz-links">
      ${mode !== 'login' ? '<button type="button" class="link-btn" data-mode="login">Ya tengo cuenta: entrar</button>' : ''}
      ${mode === 'login' && invite && !invite.memberUid ? '<button type="button" class="link-btn" data-mode="signup">Es mi primera vez: crear cuenta</button>' : ''}
      ${mode === 'login' ? '<button type="button" class="link-btn" data-mode="reset">He olvidado mi contraseña</button>' : ''}
    </div>
  </section>`;
  root.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => { mode = b.dataset.mode; authForm(invite); }; });
  document.getElementById('cz-form').onsubmit = (e) => { e.preventDefault(); submitAuth(invite); };
  document.getElementById('cz-email').focus();
}

async function submitAuth(invite) {
  if (busy) return;
  const err = document.getElementById('cz-error');
  const show = (t) => { err.textContent = t; err.hidden = !t; };
  const email = document.getElementById('cz-email').value.trim();
  const pass = document.getElementById('cz-pass') ? document.getElementById('cz-pass').value : '';
  if (!email) { show('Escribe tu correo.'); return; }
  if (mode !== 'reset' && pass.length < 6) { show('La contraseña tiene que tener al menos 6 caracteres.'); return; }
  if (mode === 'signup' && pass !== document.getElementById('cz-pass2').value) { show('Las dos contraseñas no coinciden.'); return; }
  show('');
  busy = true;
  const btn = root.querySelector('.cz-submit');
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Un momento…';
  try {
    if (mode === 'reset') {
      await sendPasswordResetEmail(auth, email);
      mode = 'login';
      authForm(invite);
      const e2 = document.getElementById('cz-error');
      e2.textContent = 'Te hemos enviado un correo para crear una contraseña nueva. Mira también en «spam».';
      e2.hidden = false; e2.classList.add('ok');
      return;
    }
    if (mode === 'signup') {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await claim(cred.user, urlToken);
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
    }
    // onAuthStateChanged carga su zona.
  } catch (e) {
    console.error(e);
    show(authError(e));
    btn.disabled = false; btn.textContent = label;
  } finally {
    busy = false;
  }
}

/** Vincula la cuenta recién creada con su zona: members/{uid} → código, y en la zona quién es. */
async function claim(user, code) {
  if (!code) return;
  await setDoc(doc(db, 'members', user.uid), { portal: code, email: user.email || '', createdAt: new Date().toISOString() });
  try {
    await updateDoc(doc(db, 'portal', code), { memberUid: user.uid, memberEmail: user.email || '', joinedAt: new Date().toISOString().slice(0, 10) });
  } catch (e) { console.error('No se pudo marcar la zona como activada', e); }
}

async function readPortal(code) {
  const snap = await getDoc(doc(db, 'portal', code));
  return snap.exists() ? snap.data() : null;
}

/* ---------- Arranque ---------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    portal = null;
    if (urlToken) {
      let invite = null;
      try { invite = await readPortal(urlToken); } catch (e) { console.error(e); }
      if (!invite) { message('Enlace no válido', 'Esta invitación no existe o ha caducado. Pide a tu entrenador que te la vuelva a enviar.'); return; }
      mode = invite.memberUid ? 'login' : (mode === 'reset' ? 'reset' : 'signup');
      authForm(invite);
    } else {
      mode = mode === 'reset' ? 'reset' : 'login';
      authForm(null);
    }
    return;
  }
  root.innerHTML = '<section class="card cz-card"><p class="muted">Cargando tu zona…</p></section>';
  try {
    const m = await getDoc(doc(db, 'members', user.uid));
    token = m.exists() ? m.data().portal : '';
    if (!token && urlToken) { await claim(user, urlToken); token = urlToken; }
    portal = token ? await readPortal(token) : null;
    if (portal) await loadWorkouts();
  } catch (e) {
    console.error(e);
    message('No se ha podido abrir', 'Comprueba tu conexión e inténtalo de nuevo en unos minutos.', logoutBtn());
    bindLogout();
    return;
  }
  if (!portal) {
    message('Tu cuenta no está vinculada', 'No encontramos tu zona. Pide a tu entrenador que te envíe otra vez la invitación y ábrela desde este móvil.', logoutBtn());
    bindLogout();
    return;
  }
  render();
});

const logoutBtn = () => '<div class="cz-links"><button type="button" class="link-btn" id="cz-logout">Cerrar sesión</button></div>';
/* ---------- Instalar la app en el móvil ----------
 * Chrome solo ofrece «Instalar» una vez por su cuenta; este botón está siempre mientras no esté instalada. */
let installEvt = null;
const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (portal) render(); });
window.addEventListener('appinstalled', () => { installEvt = null; if (portal) render(); });
function installBar() {
  if (isInstalled()) return '';
  try { if (sessionStorage.getItem('cz:noinstall')) return ''; } catch (e) { /* sin almacenamiento */ }
  return `<section class="card cz-install">
    <img src="img/icon-192.png?v=11" alt="" width="44" height="44">
    <div class="grow"><strong>Instala «Mi entreno» en tu móvil</strong><span class="muted">Para abrirla con un toque, como una app.</span></div>
    <button type="button" class="btn primary sm" id="cz-install">Instalar</button>
    <button type="button" class="cz-install-x" id="cz-install-x" aria-label="Ahora no">×</button>
  </section>`;
}
function bindInstall() {
  const b = document.getElementById('cz-install');
  if (b) b.onclick = async () => {
    if (installEvt) {
      installEvt.prompt();
      try { await installEvt.userChoice; } catch (e) { /* cancelado */ }
      installEvt = null;
      render();
      return;
    }
    // Sin el aviso de Chrome (iPhone, o Chrome ya lo usó): se explica cómo hacerlo a mano.
    choose('Instalar «Mi entreno»', isIOS()
      ? 'En Safari: toca el botón Compartir (el cuadrado con la flecha hacia arriba) y elige «Añadir a pantalla de inicio».'
      : 'En Chrome: toca los tres puntos ⋮ de arriba a la derecha y elige «Instalar aplicación» o «Añadir a pantalla de inicio».', [['ok', 'Entendido', 'primary']]);
  };
  const x = document.getElementById('cz-install-x');
  if (x) x.onclick = () => { try { sessionStorage.setItem('cz:noinstall', '1'); } catch (e) { /* sin almacenamiento */ } render(); };
}

function bindLogout() {
  const b = document.getElementById('cz-logout');
  if (b) b.onclick = async () => { await signOut(auth); location.hash = ''; };
}

/* ---------- Su zona ---------- */
window.addEventListener('hashchange', () => { if (portal) render(); });

function routine() {
  try { return JSON.parse(portal.routineJson || '{}'); } catch (e) { return {}; }
}

function render() {
  const r = routine();
  const days = r.days || [];
  const h = location.hash.slice(1);
  // Entreno en marcha: pantalla propia (sin pestañas) hasta que lo termines.
  if (h === 'entreno' && wk) { renderWorkout(); return; }
  stopTicker();
  const diaryRoute = h === 'diario' || h.startsWith('diario/') || h.startsWith('resumen/') || h === 'empezar';
  const tab = h.startsWith('dia-') ? 'rutina' : diaryRoute && !portal.noRoutine ? 'diario' : (['rutina', 'dieta', 'guia'].includes(h) ? h : (portal.noRoutine ? 'dieta' : 'diario'));
  const tabs = [
    portal.noRoutine ? null : ['diario', 'Diario'],
    portal.noRoutine ? null : ['rutina', 'Rutina'],
    portal.noDiet ? null : ['dieta', 'Dieta'],
    portal.noRoutine ? null : ['guia', 'Guía'],
  ].filter(Boolean);
  let body;
  if (h.startsWith('dia-') && days[Number(h.slice(4))]) body = dayView(days, Number(h.slice(4)));
  else if (tab === 'diario') body = h === 'empezar' ? chooseDayView(days) : h.startsWith('resumen/') ? summaryView(h.slice(8)) : h.startsWith('diario/') ? dateView(h.slice(7)) : diaryView(days);
  else if (tab === 'dieta') body = dietView();
  else if (tab === 'guia') body = guideView();
  else body = daysView(r);
  root.innerHTML = `
    <section class="card cz-hello">
      <div class="grow"><h1>Hola, ${esc(firstName(portal.clientName))}</h1><p class="muted">Tu zona de entrenamiento con David Orihuela.</p></div>
      <button type="button" class="link-btn" id="cz-logout">Salir</button>
    </section>
    ${installBar()}
    ${tabs.length > 1 ? `<nav class="tabs cz-tabs">${tabs.map(([k, l]) => `<a href="#${k}" class="${tab === k ? 'active' : ''}">${l}</a>`).join('')}</nav>` : ''}
    ${body}`;
  bindLogout();
  bindInstall();
  if (tab === 'dieta' && portal.dietHtml) setupDiet();
  const rb = document.getElementById('cz-routine-pdf');
  if (rb) pdfButton(rb, portal.routineHtml, `Rutina ${portal.clientName || ''}`, '✓ Descargada · búscala en Descargas');
  if (tab === 'diario') bindDiary();
  if (tab === 'diario' && h === '' || h === 'diario') maybeTour();
  const del = root.querySelector('[data-del]');
  if (del) del.onclick = async () => {
    const pick = await choose('¿Borrar este entreno?', 'Se quitará de tu diario y de tu historial. No se puede deshacer.', [['no', 'No, dejarlo', 'primary'], ['si', 'Sí, borrarlo', 'danger']]);
    if (pick !== 'si') return;
    try {
      await deleteDoc(doc(db, 'portal', token, 'workouts', del.dataset.del));
      workouts = workouts.filter((x) => x.id !== del.dataset.del);
      location.hash = '#diario';
    } catch (e) { console.error(e); alert('No se ha podido borrar (sin conexión). Inténtalo otra vez.'); }
  };
  if (h.startsWith('dia-') || h.startsWith('resumen/') || h === 'empezar') window.scrollTo(0, 0);
}

function daysView(r) {
  const days = r.days || [];
  if (!days.length) return '<section class="card cz-card"><p class="muted">Tu entrenador está preparando tu rutina. Cuando esté lista, la verás aquí.</p></section>';
  return `${portal.routineHtml ? '<div class="cz-diet-bar"><button type="button" class="btn primary" id="cz-routine-pdf">⬇ Descargar mi rutina en PDF</button></div>' : ''}
  <section class="cz-days">
    ${days.map((d, i) => `<a class="card cz-day" href="#dia-${i}">
      <span class="cz-day-n">${i + 1}</span>
      <span class="grow"><strong>${esc(d.name)}</strong><small>${esc(d.groups.map((g) => g.g).join(' · '))}</small></span>
      <span class="cz-day-count">${d.groups.reduce((n, g) => n + g.exs.length, 0)} ejercicios</span>
    </a>`).join('')}
  </section>
  ${r.notes ? `<section class="card cz-card"><h2>Indicaciones</h2><p class="cz-notes">${esc(r.notes)}</p></section>` : ''}`;
}

function dayView(days, i) {
  const d = days[i];
  const nav = `<div class="cz-daynav">
    <a class="btn sm" href="#rutina">← Días</a>
    <span class="grow"></span>
    ${i > 0 ? `<a class="btn sm" href="#dia-${i - 1}">Día ${i}</a>` : ''}
    ${i < days.length - 1 ? `<a class="btn sm" href="#dia-${i + 1}">Día ${i + 2} →</a>` : ''}
  </div>`;
  return `${nav}
    <h2 class="cz-day-title"><small>Día ${i + 1} de ${days.length}</small>${esc(d.name)}</h2>
    ${d.groups.map((g) => `<section class="card cz-group" style="--cz-accent:${esc(g.color)}">
      <div class="cz-glabel"><i></i>${esc(g.g)}<em>${g.exs.length} ${g.exs.length === 1 ? 'ejercicio' : 'ejercicios'}</em></div>
      ${g.exs.map((ex, k) => `<article class="cz-ex">
        ${ex.img0 ? `<div class="cz-photos"><figure><img src="${esc(ex.img0)}" alt="" loading="lazy"><figcaption>Inicio</figcaption></figure><figure><img src="${esc(ex.img1)}" alt="" loading="lazy"><figcaption>Final</figcaption></figure></div>` : ''}
        <div class="cz-ex-head"><span class="cz-num">${k + 1}</span><h3>${esc(ex.name)}</h3></div>
        ${ex.sets || ex.reps ? `<p class="cz-series">${esc([ex.sets && `${ex.sets} series`, ex.reps].filter(Boolean).join(' × '))}</p>` : ''}
        <div class="cz-meta">
          ${ex.rest ? `<span><b>Descanso</b>${esc(ex.rest)}</span>` : ''}
          ${ex.load ? `<span><b>Carga</b>${esc(ex.load)}</span>` : ''}
        </div>
        ${ex.notes ? `<p class="cz-notes">${esc(ex.notes)}</p>` : ''}
      </article>`).join('')}
    </section>`).join('')}
    ${nav}`;
}

function guideView() {
  const G = window.GUIDES;
  // Los textos de la guía son nuestros (guides.js), no vienen de la nube: pueden llevar <b>.
  return `<section class="card cz-card cz-guide">
      <h2>Protocolo innegociable</h2>
      <p class="muted cz-guide-intro">${G.protocolIntro}</p>
      <ol class="cz-proto">${G.protocol.map(([t, d], i) => `<li><i>${i + 1}</i><div><b>${t}</b><span>${d}</span></div></li>`).join('')}</ol>
    </section>
    <section class="card cz-card cz-guide">
      <h2>Cómo entrenar</h2>
      <ul class="cz-tips">${G.tips.map(([t, d]) => `<li><b>${t}</b>${Array.isArray(d) ? d.map((x) => `<span>${x}</span>`).join('') : `<span>${d}</span>`}</li>`).join('')}</ul>
    </section>`;
}

/* ---------- Dieta: las mismas páginas del PDF, reducidas al ancho de la pantalla ---------- */
function sanitize(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const BAD = 'script,iframe,object,embed,link,meta,base,form,input,button,textarea,select,style,foreignObject,animate,set';
  tpl.content.querySelectorAll(BAD).forEach((n) => n.remove());
  tpl.content.querySelectorAll('*').forEach((el) => {
    for (const at of [...el.attributes]) {
      const name = at.name.toLowerCase();
      const val = at.value.trim().toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(at.name);
      else if ((name === 'href' || name === 'xlink:href') && !val.startsWith('#')) el.removeAttribute(at.name);
      else if (name === 'src' && !/^img\/[\w./-]+$/i.test(at.value.trim())) el.removeAttribute(at.name);
      else if (name === 'style' && (/url\s*\(\s*['"]?(?!#)/i.test(val) || /expression|javascript:/i.test(val))) el.removeAttribute(at.name);
    }
  });
  const box = document.createElement('div');
  box.appendChild(tpl.content);
  return box.innerHTML;
}

function dietView() {
  if (!portal.dietHtml) return '<section class="card cz-card"><p class="muted">Tu entrenador está preparando tu dieta. Cuando esté lista, la verás aquí.</p></section>';
  return `<div class="cz-diet-bar"><button type="button" class="btn primary" id="cz-diet-pdf">⬇ Descargar mi dieta en PDF</button></div>
    <div id="cz-diet" class="pv-pages">${sanitize(portal.dietHtml)}</div>`;
}

function setupDiet() {
  const box = document.getElementById('cz-diet');
  const fit = () => {
    const art = box.querySelector('.ds');
    const page = art && art.querySelector('.ds-page');
    if (!page) return;
    const s = Math.min(1, box.clientWidth / page.offsetWidth);
    art.style.transform = `scale(${s})`;
    box.style.height = `${art.offsetHeight * s}px`;
  };
  window.PdfMaker.loadFonts().then(fit);
  fit();
  window.onresize = fit;
  pdfButton(document.getElementById('cz-diet-pdf'), portal.dietHtml, `Dieta ${portal.clientName || ''}`, '✓ Descargada · búscala en Descargas');
}

/** Botón que crea el PDF (en el propio móvil del cliente) a partir de la hoja y lo descarga. */
function pdfButton(btn, html, name, done) {
  btn.onclick = async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Creando el PDF…';
    try {
      const blob = await window.PdfMaker.make(sanitize(html));
      window.PdfMaker.save(blob, window.PdfMaker.fileName(name));
      btn.textContent = done;
    } catch (e) {
      console.error(e);
      btn.textContent = 'No se pudo crear. Toca para reintentar';
    }
    setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 4000);
  };
}

/* =====================================================================
 * Diario de entrenamiento
 * - Calendario con los días entrenados y la lista de entrenos.
 * - «Entrenar hoy»: eliges el día de tu rutina y te guía ejercicio a ejercicio, serie a serie,
 *   con la cuenta atrás del descanso (empezar, pausar, seguir). Apuntas el peso y las repeticiones.
 * - Al terminar, resumen: tiempo, series, volumen y mejoras de peso respecto a la vez anterior.
 * Se guarda en portal/{código}/workouts/{id} (lo ve también tu entrenador). El entreno en marcha se
 * guarda además en este móvil, así no se pierde si se cierra la página.
 * ===================================================================== */
let workouts = []; // entrenos guardados, del más reciente al más antiguo
let workoutsError = false;
let wk = null; // entreno en marcha
let cal = null; // mes que se ve en el calendario { y, m }
let ticker = null;
let wakeLock = null;

const wkKey = () => `cz:entreno:${token}`;
const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fmtDay = (s) => { const [y, m, d] = s.split('-').map(Number); return `${d} de ${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ` de ${y}` : ''}`; };
const fmtClock = (sec) => { sec = Math.max(0, Math.ceil(sec)); return `${Math.floor(sec / 60)}:${pad2(sec % 60)}`; };
const fmtDuration = (sec) => { const m = Math.round(sec / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad2(m % 60)} min`; };
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const fmtKg = (n) => (Math.round(n * 100) / 100).toLocaleString('es-ES');

/** «2 min» → 120 s · «90 s» → 90 · «2 a 3 min» → 120 (el primero). Sin dato: 2 min. */
function restSeconds(text) {
  const t = String(text || '').toLowerCase();
  const n = num((t.match(/\d+(?:[.,]\d+)?/) || [])[0]);
  if (n === null) return 120;
  return Math.round(/min|'/.test(t) ? n * 60 : n);
}

/** Nombre y pauta de cada serie: el método de las 3 series si la rutina lo usa. */
function setInfo(ex, i) {
  const method = /pesada/i.test(ex.reps || '') && ex.sets.length === 3;
  if (method) {
    return [
      ['Serie 1 · Efectiva', '12–15 reps, a 1 del fallo'],
      ['Serie 2 · Pesada', 'sube el peso · 6–8 reps al fallo total'],
      ['Serie 3 · Agotamiento', 'peso de la serie 1 · al fallo total'],
    ][i];
  }
  return [`Serie ${i + 1}`, ex.reps || ''];
}

async function loadWorkouts() {
  workoutsError = false;
  try {
    const snap = await getDocs(collection(db, 'portal', token, 'workouts'));
    workouts = snap.docs.map((d) => d.data()).sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
  } catch (e) {
    console.error(e);
    workouts = [];
    workoutsError = true;
  }
  try { wk = JSON.parse(localStorage.getItem(wkKey()) || 'null'); } catch (e) { wk = null; }
}

function saveWk() {
  try { if (wk) localStorage.setItem(wkKey(), JSON.stringify(wk)); else localStorage.removeItem(wkKey()); } catch (e) { /* sin espacio */ }
}

/** Lo que hiciste la última vez en ese ejercicio (antes del entreno `beforeId`). */
function lastSets(ex, beforeId) {
  for (const w of workouts) {
    if (w.id === beforeId) continue;
    const e = (w.exercises || []).find((x) => (ex.id && x.id === ex.id) || x.name === ex.name);
    if (e && e.sets.some((st) => st.done && num(st.kg) !== null)) return { w, sets: e.sets };
  }
  return null;
}
const bestKg = (sets) => Math.max(-Infinity, ...sets.filter((st) => st.done).map((st) => num(st.kg)).filter((n) => n !== null));

/* ---------- Calendario y lista ---------- */
function diaryView(days) {
  const now = new Date();
  if (!cal) cal = { y: now.getFullYear(), m: now.getMonth() };
  const first = new Date(cal.y, cal.m, 1);
  const lead = (first.getDay() + 6) % 7; // la semana empieza en lunes
  const total = new Date(cal.y, cal.m + 1, 0).getDate();
  const byDate = new Map();
  for (const w of workouts) byDate.set(w.date, (byDate.get(w.date) || 0) + 1);
  const today = ymd();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="cz-cal-cell empty"></span>');
  for (let d = 1; d <= total; d++) {
    const key = `${cal.y}-${pad2(cal.m + 1)}-${pad2(d)}`;
    const n = byDate.get(key) || 0;
    const cls = ['cz-cal-cell', n ? 'done' : '', key === today ? 'today' : ''].filter(Boolean).join(' ');
    cells.push(n ? `<a class="${cls}" href="#diario/${key}">${d}</a>` : `<span class="${cls}">${d}</span>`);
  }
  const monthCount = workouts.filter((w) => w.date.startsWith(`${cal.y}-${pad2(cal.m + 1)}`)).length;
  const recent = workouts.slice(0, 6);
  return `
    ${wk ? `<section class="card cz-card cz-resume">
      <h2>Tienes un entreno a medias</h2>
      <p class="muted">${esc(wk.dayName)} · empezado el ${esc(fmtDay(wk.date))}.</p>
      <div class="cz-row"><a class="btn primary" href="#entreno">▶ Continuar</a><button type="button" class="btn" id="cz-wk-discard">Descartar</button></div>
    </section>` : `<a class="btn primary cz-big" href="#empezar">▶ Entrenar hoy</a>`}
    ${workoutsError ? '<p class="cz-error">No se han podido cargar tus entrenos. Comprueba la conexión.</p>' : ''}
    <section class="card cz-card cz-cal">
      <div class="cz-cal-head">
        <button type="button" class="btn sm" data-cal="-1" aria-label="Mes anterior">‹</button>
        <strong>${MONTHS[cal.m][0].toUpperCase() + MONTHS[cal.m].slice(1)} ${cal.y}</strong>
        <button type="button" class="btn sm" data-cal="1" aria-label="Mes siguiente">›</button>
      </div>
      <div class="cz-cal-grid">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((x) => `<span class="cz-cal-dow">${x}</span>`).join('')}${cells.join('')}</div>
      <p class="muted cz-cal-foot">${monthCount ? `${monthCount} ${monthCount === 1 ? 'entreno' : 'entrenos'} este mes` : 'Aún no hay entrenos este mes'}</p>
    </section>
    <div class="cz-links cz-howto"><button type="button" class="link-btn" id="cz-tour">¿Cómo funciona el diario?</button></div>
    ${recent.length ? `<section class="card cz-card"><h2>Últimos entrenos</h2>
      <ul class="cz-wlist">${recent.map(workoutRow).join('')}</ul></section>` : ''}`;
}

const workoutRow = (w) => `<li><a href="#resumen/${esc(w.id)}">
    <span class="grow"><strong>${esc(w.dayName)}</strong><small>${esc(fmtDay(w.date))} · ${fmtDuration(w.durationSec || 0)}</small></span>
    <span class="cz-wlist-n">${(w.exercises || []).reduce((n, e) => n + e.sets.filter((st) => st.done).length, 0)} series</span>
  </a></li>`;

function dateView(date) {
  const list = workouts.filter((w) => w.date === date);
  return `<div class="cz-daynav"><a class="btn sm" href="#diario">← Diario</a></div>
    <h2 class="cz-day-title"><small>Entrenos</small>${esc(fmtDay(date))}</h2>
    ${list.length ? `<section class="card cz-card"><ul class="cz-wlist">${list.map(workoutRow).join('')}</ul></section>` : '<p class="muted">Ese día no entrenaste.</p>'}`;
}

/** Elegir el día de la rutina. Se propone el siguiente al último que hiciste (calendario continuo). */
function chooseDayView(days) {
  if (!days.length) return '<section class="card cz-card"><p class="muted">Todavía no tienes rutina. Cuando tu entrenador la prepare, podrás entrenar desde aquí.</p></section>';
  const last = workouts[0];
  const next = last && Number.isInteger(last.dayIndex) ? (last.dayIndex + 1) % days.length : 0;
  return `<div class="cz-daynav"><a class="btn sm" href="#diario">← Diario</a></div>
    <h2 class="cz-day-title"><small>Entrenar hoy</small>¿Qué día toca?</h2>
    <p class="muted">${last ? `La última vez hiciste <strong>${esc(last.dayName)}</strong>. Te toca el siguiente:` : 'Elige el día de tu rutina que vas a entrenar:'}</p>
    <section class="cz-days">
      ${days.map((d, i) => `<button type="button" class="card cz-day${i === next ? ' next' : ''}" data-start="${i}">
        <span class="cz-day-n">${i + 1}</span>
        <span class="grow"><strong>${esc(d.name)}</strong><small>${esc(d.groups.map((g) => g.g).join(' · '))}</small></span>
        ${i === next ? '<span class="cz-next">Te toca</span>' : `<span class="cz-day-count">${d.groups.reduce((n, g) => n + g.exs.length, 0)} ejercicios</span>`}
      </button>`).join('')}
    </section>`;
}

/* ---------- Tutorial del diario: sale solo la primera vez (y con «¿Cómo funciona el diario?») ---------- */
const TOUR = [
  ['📒', 'Tu diario de entrenamiento', 'Aquí entrenas cada día con tu rutina, paso a paso, y queda todo apuntado: lo que haces, los pesos que mueves y cómo mejoras.'],
  ['▶️', 'Entrenar hoy', 'Cuando vayas a entrenar, pulsa «Entrenar hoy» y elige el día de tu rutina. Te marcamos el que te toca.'],
  ['🏋️', 'Serie a serie', 'Te llevamos ejercicio a ejercicio. Antes de empezar cada uno, haz tus series de aproximación. Apunta el peso y las repeticiones de la serie y pulsa ▶.'],
  ['⏱️', 'El descanso', 'Al acabar la serie, pulsa ▶ para empezar la cuenta atrás del descanso. Puedes pausarla o reiniciarla. Cuando termine te avisamos y pasamos a la siguiente serie.'],
  ['📈', 'Tu progreso', 'Al terminar verás tu resumen con las mejoras. Los días entrenados se marcan en el calendario y tu entrenador lo ve todo para ajustar tu plan.'],
];
const tourKey = () => `cz:tour:${auth.currentUser ? auth.currentUser.uid : ''}`;
function maybeTour() {
  let seen = false;
  try { seen = !!localStorage.getItem(tourKey()); } catch (e) { seen = true; }
  if (!seen && !document.querySelector('.cz-tour')) showTour();
}
function showTour() {
  let i = 0;
  const box = document.createElement('div');
  box.className = 'cz-sheet cz-tour';
  const done = () => { try { localStorage.setItem(tourKey(), '1'); } catch (e) { /* sin almacenamiento */ } box.remove(); };
  const paint = () => {
    const [icon, title, text] = TOUR[i];
    const last = i === TOUR.length - 1;
    box.innerHTML = `<div class="cz-sheet-in card">
      <div class="cz-tour-icon">${icon}</div>
      <small class="cz-kicker">${i + 1} de ${TOUR.length}</small>
      <strong>${esc(title)}</strong>
      <p class="muted">${esc(text)}</p>
      <div class="cz-tour-dots">${TOUR.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <button type="button" class="btn primary" data-t="next">${last ? '¡Empezar!' : 'Siguiente ›'}</button>
      ${last ? '' : '<button type="button" class="link-btn" data-t="skip">Saltar</button>'}
    </div>`;
  };
  box.onclick = (e) => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    if (b.dataset.t === 'skip' || i === TOUR.length - 1) { done(); return; }
    i++; paint();
  };
  paint();
  document.body.appendChild(box);
}

function bindDiary() {
  const tb = document.getElementById('cz-tour');
  if (tb) tb.onclick = () => showTour();
  root.querySelectorAll('[data-cal]').forEach((b) => { b.onclick = () => { cal.m += Number(b.dataset.cal); if (cal.m < 0) { cal.m = 11; cal.y--; } if (cal.m > 11) { cal.m = 0; cal.y++; } render(); }; });
  root.querySelectorAll('[data-start]').forEach((b) => { b.onclick = () => startWorkout(Number(b.dataset.start)); });
  const disc = document.getElementById('cz-wk-discard');
  if (disc) disc.onclick = () => { if (confirm('¿Descartar el entreno a medias? Se perderán los pesos que hayas apuntado.')) { wk = null; saveWk(); render(); } };
}

/* ---------- Entreno en marcha ---------- */
function startWorkout(i) {
  const d = (routine().days || [])[i];
  if (!d) return;
  const exercises = [];
  for (const g of d.groups) {
    for (const ex of g.exs) {
      const n = Math.min(10, Math.max(1, parseInt(ex.sets, 10) || 3));
      exercises.push({
        id: ex.id, name: ex.name, group: g.g, color: g.color, img0: ex.img0, img1: ex.img1,
        reps: ex.reps, rest: ex.rest, notes: ex.notes, sets: Array.from({ length: n }, () => ({ kg: '', reps: '', done: false })),
      });
    }
  }
  wk = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, date: ymd(), dayIndex: i, dayName: d.name, startedAt: Date.now(), ex: 0, set: 0, phase: 'set', timer: null, exercises };
  saveWk();
  location.hash = '#entreno';
}

/* El entreno es guiado, paso a paso, en tres fases:
 *  - «set»:  la serie que toca (solo esa se puede rellenar: kg y reps) → ▶
 *  - «rest»: la cuenta atrás del descanso; ▶ para empezarla cuando acabes la serie, ⏸ pausar, ↺ reiniciar
 *  - «ask»:  descanso terminado → «¿Pasamos a la siguiente serie?» (o al siguiente ejercicio)
 * Tras la última serie del último ejercicio se termina el entreno. */
function renderWorkout() {
  if (!wk.phase) { wk.phase = 'set'; wk.set = nextOpenSet(wk.exercises[wk.ex]); }
  const e = wk.exercises[wk.ex];
  const total = wk.exercises.length;
  const doneSets = wk.exercises.reduce((n, x) => n + x.sets.filter((st) => st.done).length, 0);
  const allSets = wk.exercises.reduce((n, x) => n + x.sets.length, 0);
  const last = lastSets(e, wk.id);
  const cur = e.sets[wk.set] || {};
  const prev = last && last.sets[wk.set];
  const [label, hint] = setInfo(e, Math.min(wk.set, e.sets.length - 1));
  const isLastSet = wk.set >= e.sets.length - 1;
  const isLastEx = wk.ex >= total - 1;
  const t = wk.timer;
  let step;
  if (wk.phase === 'set') {
    step = `<section class="card cz-step">
      <small class="cz-kicker">Ahora · ${esc(label)}</small>
      <p class="muted cz-step-hint">${esc(hint)}</p>
      <div class="cz-step-inputs">
        <label class="cz-in big"><input type="text" inputmode="decimal" id="cz-kg" value="${esc(cur.kg || '')}" placeholder="${prev && prev.kg ? esc(prev.kg) : '0'}"><span>kg</span></label>
        <label class="cz-in big"><input type="text" inputmode="numeric" id="cz-reps" value="${esc(cur.reps || '')}" placeholder="${prev && prev.reps ? esc(prev.reps) : '0'}"><span>reps</span></label>
      </div>
      ${prev && prev.kg ? `<p class="muted cz-step-prev">La última vez en esta serie: ${esc(prev.kg)} kg × ${esc(prev.reps || '—')}</p>` : ''}
      <button type="button" class="btn primary cz-play" id="cz-go">▶ ${isLastSet && isLastEx ? 'Última serie · terminar entreno' : 'Hecho · ir al descanso'}</button>
    </section>`;
  } else if (wk.phase === 'rest') {
    step = `<section class="card cz-timer${t && t.running ? ' running' : ''}">
      <small>Descanso · serie ${wk.set + 1} hecha${cur.kg ? ` (${esc(cur.kg)} kg × ${esc(cur.reps || '—')})` : ''}</small>
      <strong id="cz-timer-clock">${fmtClock(t ? timerLeft() : restSeconds(e.rest))}</strong>
      <p class="muted cz-step-hint">${!t ? 'Cuando termines la serie, pulsa ▶ para empezar el descanso.' : t.running ? 'Descansando…' : 'En pausa.'}</p>
      <div class="cz-row">
        ${!t ? '<button type="button" class="btn primary cz-play" id="cz-t-start">▶ Empezar descanso</button>'
          : t.running ? '<button type="button" class="btn primary" id="cz-t-pause">⏸ Pausar</button>'
          : '<button type="button" class="btn primary" id="cz-t-resume">▶ Seguir</button>'}
        ${t ? '<button type="button" class="btn" id="cz-t-reset">↺ Reiniciar</button>' : ''}
      </div>
      <button type="button" class="link-btn cz-edit-set" id="cz-edit">Corregir el peso de esta serie</button>
    </section>`;
  } else {
    const nextText = !isLastSet ? `¿Pasamos a la serie ${wk.set + 2}?` : !isLastEx ? `¿Pasamos al siguiente ejercicio?<br><small>${esc(wk.exercises[wk.ex + 1].name)}</small>` : '¿Terminamos el entreno?';
    step = `<section class="card cz-ask">
      <strong class="cz-ask-title">¡Descanso terminado!</strong>
      <p>${nextText}</p>
      <button type="button" class="btn primary cz-play" id="cz-next">${!isLastSet ? 'Sí, siguiente serie ›' : !isLastEx ? 'Sí, siguiente ejercicio ›' : 'Terminar entreno ✓'}</button>
      <button type="button" class="link-btn" id="cz-t-again">↺ Repetir el descanso</button>
    </section>`;
  }
  root.innerHTML = `<div class="cz-wkscreen">
    <header class="cz-wk-bar">
      <div class="grow"><small>${esc(wk.dayName)} · ejercicio ${wk.ex + 1} de ${total}</small><strong id="cz-elapsed">${fmtClock((Date.now() - wk.startedAt) / 1000)}</strong></div>
      <button type="button" class="btn sm" id="cz-wk-finish">Terminar</button>
    </header>
    <div class="cz-progress"><i style="width:${Math.round((doneSets / allSets) * 100)}%"></i></div>
    <p class="cz-approach"><b>Aproximación:</b> 1–3 series de 7–8 reps al 50, 70 y 90 % del peso · grande o frío: 3 · pequeño o caliente: 2 (70 y 90 %) o 1 (70 %)</p>
    <section class="cz-wk" style="--cz-accent:${esc(e.color || '#6e8bff')}">
      ${e.img0 ? `<div class="cz-photos"><figure><img src="${esc(e.img0)}" alt=""><figcaption>Inicio</figcaption></figure><figure><img src="${esc(e.img1)}" alt=""><figcaption>Final</figcaption></figure></div>` : ''}
      <div class="cz-wk-info">
        <div class="cz-glabel"><i></i>${esc(e.group)}</div>
        <h2 class="cz-wk-name">${esc(e.name)}</h2>
        <p class="cz-series">${esc([`${e.sets.length} series`, e.reps].filter(Boolean).join(' × '))} · descanso ${esc(e.rest || '2 min')}</p>
      </div>
      ${e.notes ? `<div class="cz-wk-how"><b>Cómo se hace</b><p>${esc(e.notes)}</p></div>` : ''}
      <ol class="cz-setlist">${e.sets.map((st, i) => {
        const state = st.done ? 'done' : i === wk.set ? 'now' : 'next';
        return `<li class="${state}"><span>S${i + 1}</span><b>${st.done ? `${st.kg ? `${esc(st.kg)}` : '—'}×${esc(st.reps || '—')}` : i === wk.set ? 'Ahora' : '·'}</b></li>`;
      }).join('')}</ol>
    </section>
    <div class="cz-wk-step">${step}</div>
  </div>`;
  bindWorkout();
  startTicker();
  keepAwake();
  document.body.classList.add('cz-in-workout');
  window.scrollTo(0, 0);
}

function bindWorkout() {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  const e = wk.exercises[wk.ex];
  const kg = document.getElementById('cz-kg');
  const reps = document.getElementById('cz-reps');
  if (kg) {
    kg.oninput = () => { e.sets[wk.set].kg = kg.value.trim(); saveWk(); };
    reps.oninput = () => { e.sets[wk.set].reps = reps.value.trim(); saveWk(); };
  }
  // ▶ en la serie: queda hecha y vamos al descanso (o se termina el entreno si era la última).
  on('cz-go', () => {
    const st = e.sets[wk.set];
    if (!st.kg && kg && kg.placeholder && kg.placeholder !== '0') st.kg = kg.placeholder; // mismo peso que la última vez
    st.done = true;
    unlockAudio();
    if (wk.set >= e.sets.length - 1 && wk.ex >= wk.exercises.length - 1) { saveWk(); finishWorkout(); return; }
    wk.phase = 'rest'; wk.timer = null; saveWk(); renderWorkout();
  });
  on('cz-t-start', () => { unlockAudio(); wk.timer = { running: true, endAt: Date.now() + restSeconds(e.rest) * 1000 }; saveWk(); renderWorkout(); });
  on('cz-t-pause', () => { wk.timer = { running: false, left: timerLeft() }; saveWk(); renderWorkout(); });
  on('cz-t-resume', () => { wk.timer = { running: true, endAt: Date.now() + wk.timer.left * 1000 }; saveWk(); renderWorkout(); });
  on('cz-t-reset', () => { wk.timer = null; saveWk(); renderWorkout(); });
  on('cz-t-again', () => { stopAlarm(); wk.phase = 'rest'; wk.timer = null; saveWk(); renderWorkout(); });
  on('cz-edit', () => { e.sets[wk.set].done = false; wk.phase = 'set'; wk.timer = null; saveWk(); renderWorkout(); });
  on('cz-next', () => { stopAlarm(); advance(); });
  on('cz-wk-finish', () => { stopAlarm(); finishWorkout(); });
}

/** Siguiente paso tras el descanso: siguiente serie, o primera serie del siguiente ejercicio, o terminar. */
function advance() {
  const e = wk.exercises[wk.ex];
  wk.timer = null;
  if (wk.set < e.sets.length - 1) { wk.set++; wk.phase = 'set'; saveWk(); renderWorkout(); return; }
  if (wk.ex < wk.exercises.length - 1) { wk.ex++; wk.set = 0; wk.phase = 'set'; saveWk(); renderWorkout(); window.scrollTo(0, 0); flash('Siguiente ejercicio'); return; }
  finishWorkout();
}

const nextOpenSet = (e) => { const i = e.sets.findIndex((st) => !st.done); return i < 0 ? e.sets.length - 1 : i; };
const timerLeft = () => (!wk || !wk.timer ? 0 : wk.timer.running ? (wk.timer.endAt - Date.now()) / 1000 : wk.timer.left);

function updateClock() {
  const c = document.getElementById('cz-timer-clock');
  if (c && wk && wk.timer) c.textContent = fmtClock(timerLeft());
  const el = document.getElementById('cz-elapsed');
  if (el && wk) el.textContent = fmtClock((Date.now() - wk.startedAt) / 1000);
}

function startTicker() {
  if (ticker) { clearInterval(ticker); ticker = null; } // (sin parar la alarma: suena hasta que respondes)
  ticker = setInterval(() => {
    if (!wk || location.hash !== '#entreno') { stopTicker(); return; }
    updateClock();
    if (wk.phase === 'rest' && wk.timer && wk.timer.running && timerLeft() <= 0) restDone();
  }, 250);
}
function stopTicker() { stopAlarm(); if (ticker) { clearInterval(ticker); ticker = null; } releaseAwake(); document.body.classList.remove('cz-in-workout'); }

/** Fin del descanso: aviso (pitido y vibración) y la pregunta de si pasamos a la siguiente serie. */
function restDone() {
  startAlarm();
  wk.timer = null;
  wk.phase = 'ask';
  saveWk();
  renderWorkout();
}

function flash(text) {
  const el = document.createElement('div');
  el.className = 'cz-flash';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

/* Pitido al terminar el descanso (el móvil necesita que el sonido se active con un toque). */
let audio = null;
function unlockAudio() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) { audio = null; } }
/* Alarma de fin de descanso: fuerte y repetida (pitidos + vibración) hasta que respondes a la pregunta. */
let alarm = null;
function beepBurst() {
  if (!audio) return;
  if (audio.state === 'suspended') audio.resume();
  const out = audio.createDynamicsCompressor(); // más volumen sin distorsionar
  out.connect(audio.destination);
  [0, 0.18, 0.36, 0.54].forEach((t, k) => {
    const o = audio.createOscillator(); const g = audio.createGain();
    o.type = 'square';
    o.frequency.value = k % 2 ? 1320 : 990;
    o.connect(g); g.connect(out);
    const at = audio.currentTime + t;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(1, at + 0.01);
    g.gain.setValueAtTime(1, at + 0.13);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.15);
    o.start(at); o.stop(at + 0.16);
  });
}
function startAlarm() {
  stopAlarm();
  const ring = () => { beepBurst(); if (navigator.vibrate) navigator.vibrate([400, 150, 400]); };
  ring();
  alarm = setInterval(ring, 1300);
}
function stopAlarm() {
  if (alarm) { clearInterval(alarm); alarm = null; }
  if (navigator.vibrate) navigator.vibrate(0);
}

/* La pantalla no se apaga mientras entrenas (si el móvil lo permite). */
async function keepAwake() { try { if (!wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { wakeLock = null; } }
function releaseAwake() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wk && location.hash === '#entreno') { keepAwake(); updateClock(); } });

/** Ventana propia (no la del navegador, que se acepta sin querer) con las opciones. Devuelve la elegida. */
function choose(title, text, options) {
  return new Promise((resolve) => {
    const box = document.createElement('div');
    box.className = 'cz-sheet';
    box.innerHTML = `<div class="cz-sheet-in card"><strong>${esc(title)}</strong><p class="muted">${esc(text)}</p>
      ${options.map(([k, l, cls]) => `<button type="button" class="btn ${cls || ''}" data-k="${k}">${esc(l)}</button>`).join('')}</div>`;
    box.onclick = (e) => { const b = e.target.closest('[data-k]'); if (b || e.target === box) { box.remove(); resolve(b ? b.dataset.k : 'cancel'); } };
    document.body.appendChild(box);
  });
}

/** Botón «Terminar» de arriba o fin del entreno. Si quedan series, pregunta qué hacer (seguir es lo primero). */
async function finishWorkout() {
  const doneSets = wk.exercises.reduce((n, x) => n + x.sets.filter((st) => st.done).length, 0);
  const allSets = wk.exercises.reduce((n, x) => n + x.sets.length, 0);
  if (doneSets < allSets) {
    const pick = await choose('¿Terminar el entreno ahora?', doneSets
      ? `Llevas ${doneSets} de ${allSets} series. Si terminas, se guarda solo lo que has hecho.`
      : 'Todavía no has hecho ninguna serie.', [
      ['seguir', 'Seguir entrenando', 'primary'],
      ...(doneSets ? [['guardar', `Terminar y guardar (${doneSets} ${doneSets === 1 ? 'serie' : 'series'})`]] : []),
      ['descartar', 'Descartar el entreno (no se guarda)', 'danger'],
    ]);
    if (pick === 'descartar') { wk = null; saveWk(); stopTicker(); location.hash = '#diario'; return; }
    if (pick !== 'guardar') return;
  }
  const endedAt = Date.now();
  const w = {
    id: wk.id, date: wk.date, dayIndex: wk.dayIndex, dayName: wk.dayName, startedAt: wk.startedAt, endedAt,
    durationSec: Math.round((endedAt - wk.startedAt) / 1000),
    exercises: wk.exercises.map((x) => ({ id: x.id || '', name: x.name, group: x.group, sets: x.sets.map((st) => ({ kg: st.kg, reps: st.reps, done: !!st.done })) })),
  };
  root.querySelector('#cz-wk-finish').disabled = true;
  try {
    await setDoc(doc(db, 'portal', token, 'workouts', w.id), w);
  } catch (e) {
    console.error(e);
    alert('No se ha podido guardar el entreno (sin conexión). No cierres la página e inténtalo otra vez en un momento.');
    root.querySelector('#cz-wk-finish').disabled = false;
    return;
  }
  workouts.unshift(w);
  wk = null; saveWk();
  stopTicker();
  location.hash = `#resumen/${w.id}`;
}

/* ---------- Resumen de un entreno ---------- */
function summaryView(id) {
  const w = workouts.find((x) => x.id === id);
  if (!w) return '<div class="cz-daynav"><a class="btn sm" href="#diario">← Diario</a></div><p class="muted">No se encuentra este entreno.</p>';
  const sets = w.exercises.flatMap((e) => e.sets.filter((st) => st.done));
  // Mejoras respecto a la vez anterior en cada ejercicio (mejor serie): más peso, o el mismo peso con más repeticiones.
  const best = (list) => { let b = null; for (const st of list) { const kg = num(st.kg); if (!st.done || kg === null) continue; const r = num(st.reps) || 0; if (!b || kg > b.kg || (kg === b.kg && r > b.reps)) b = { kg, reps: r }; } return b; };
  const ups = [];
  const firsts = [];
  for (const e of w.exercises) {
    const now = best(e.sets);
    if (!now) continue;
    // «La vez anterior» = el entreno anterior a este con ese ejercicio.
    const same = (y) => (e.id && y.id === e.id) || y.name === e.name;
    const older = workouts.slice(workouts.indexOf(w) + 1).find((x) => (x.exercises || []).some((y) => same(y) && best(y.sets)));
    const before = older ? best(older.exercises.find(same).sets) : null;
    if (!before) firsts.push(e.name);
    else if (now.kg > before.kg) ups.push({ name: e.name, text: `${fmtKg(before.kg)} → ${fmtKg(now.kg)} kg`, plus: `+${fmtKg(now.kg - before.kg)} kg` });
    else if (now.kg === before.kg && now.reps > before.reps) ups.push({ name: e.name, text: `${fmtKg(now.kg)} kg: ${before.reps} → ${now.reps} reps`, plus: `+${now.reps - before.reps} reps` });
  }
  const fresh = workouts[0] === w && Date.now() - w.endedAt < 3600e3;
  return `<div class="cz-daynav"><a class="btn sm" href="#diario">← Diario</a></div>
    <section class="card cz-card cz-summary">
      <small class="cz-kicker">${esc(fmtDay(w.date))}</small>
      <h2>${fresh ? '¡Entreno completado! 💪' : esc(w.dayName)}</h2>
      ${fresh ? `<p class="muted">${esc(w.dayName)}</p>` : ''}
      <div class="cz-stats">
        <div><strong>${fmtDuration(w.durationSec || 0)}</strong><small>Tiempo</small></div>
        <div><strong>${sets.length}</strong><small>Series</small></div>
        <div class="${ups.length ? 'up' : ''}"><strong>${ups.length}</strong><small>${ups.length === 1 ? 'Mejora' : 'Mejoras'}</small></div>
      </div>
      ${ups.length ? `<h3>Has mejorado en</h3><ul class="cz-ups">${ups.map((u) => `<li><span>${esc(u.name)}</span><b>${esc(u.text)} <em>${esc(u.plus)}</em></b></li>`).join('')}</ul>`
        : '<p class="muted">Sin mejoras de peso ni repeticiones esta vez. Recuerda: aumentar la intensidad también es progreso.</p>'}
      ${firsts.length ? `<p class="muted cz-firsts">Primera vez que apuntas: ${esc(firsts.join(', '))}. La próxima vez verás si mejoras.</p>` : ''}
    </section>
    <section class="card cz-card">
      <h2>Detalle</h2>
      ${w.exercises.map((e) => `<div class="cz-sum-ex"><strong>${esc(e.name)}</strong>
        <span>${e.sets.map((st, i) => (st.done ? `<i>${num(st.kg) !== null ? `${fmtKg(num(st.kg))} kg` : '—'} × ${esc(st.reps || '—')}</i>` : `<i class="skip">S${i + 1} sin hacer</i>`)).join('')}</span></div>`).join('')}
    </section>
    <div class="cz-links"><button type="button" class="link-btn cz-del" data-del="${esc(w.id)}">Borrar este entreno</button></div>`;
}
