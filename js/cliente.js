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

const NAV_ICONS = {
  diario: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18M8 15h3"/></svg>',
  rutina: '<svg viewBox="0 0 24 24"><path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/></svg>',
  dieta: '<svg viewBox="0 0 24 24"><path d="M12 6.5c-1.5-1.5-5-1.5-6.5 1S4 15 7 19c1.5 2 3 2 5 1 2 1 3.5 1 5-1 3-4 3-9 1.5-11.5S13.5 5 12 6.5Z"/><path d="M12 6.5C12 4 13 3 15 2.5"/></svg>',
  guia: '<svg viewBox="0 0 24 24"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
  datos: '<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/></svg>',
  estudio: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
};

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
  return '<button type="button" class="cz-install-pill" id="cz-install" title="Instala «Mi entreno» en tu móvil">⬇ Instalar app</button>';
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

/** Rutina: cada tarjeta enseña lo que le quepa. Con sitio, los ejercicios en lista (uno por línea); si no, en
 * una línea de texto recortada; si tampoco, se ocultan; y si no caben los músculos, solo el nombre del día. */
function fitDayCards() {
  for (const card of root.querySelectorAll('.cz-day')) {
    const list = card.querySelector('.cz-day-list');
    const join = card.querySelector('.cz-day-exs');
    const mus = card.querySelector('.grow small');
    const title = card.querySelector('.grow strong');
    if (!list || !join) continue;
    list.style.display = 'none'; join.style.display = 'none'; mus.style.display = '';
    const cs = getComputedStyle(card);
    const inner = card.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (title.offsetHeight + mus.offsetHeight > inner) { mus.style.display = 'none'; continue; }
    const free = inner - title.offsetHeight - mus.offsetHeight - 6;
    const lh = parseFloat(getComputedStyle(join).lineHeight) || 16;
    const n = list.children.length;
    const listLh = lh + 2;
    if (n && free >= n * listLh) { list.style.display = ''; continue; }
    const lines = Math.floor(free / lh);
    if (lines >= 1) { join.style.display = ''; join.style.webkitLineClamp = String(lines); }
  }
}
window.addEventListener('resize', () => { if (document.body.dataset.tab === 'rutina') fitDayCards(); });

function bindLogout() {
  const b = document.getElementById('cz-logout');
  if (b) b.onclick = async () => {
    if (b.classList.contains('cz-avatar')) {
      const pick = await choose(portal ? portal.clientName : 'Tu cuenta', auth.currentUser ? auth.currentUser.email : '', [['salir', 'Cerrar sesión', 'danger'], ['no', 'Cancelar', '']]);
      if (pick !== 'salir') return;
    }
    await signOut(auth); location.hash = '';
  };
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
  const tab = h.startsWith('dia-') ? 'rutina' : diaryRoute && !portal.noRoutine ? 'diario' : (['rutina', 'dieta', 'guia', 'estudio', 'datos'].includes(h) ? h : (portal.noRoutine ? 'dieta' : 'diario'));
  const tabs = [
    portal.noRoutine ? null : ['diario', 'Diario'],
    portal.noRoutine ? null : ['rutina', 'Rutina'],
    portal.noDiet ? null : ['dieta', 'Dieta'],
    portal.noRoutine ? null : ['estudio', 'Estudio'],
    ['datos', 'Tus datos'],
    portal.noRoutine ? null : ['guia', 'Guía'],
  ].filter(Boolean);
  let body;
  if (h.startsWith('dia-') && days[Number(h.slice(4))]) body = dayView(days, Number(h.slice(4)));
  else if (tab === 'diario') body = h === 'empezar' ? chooseDayView(days) : h.startsWith('resumen/') ? summaryView(h.slice(8)) : h.startsWith('diario/') ? dateView(h.slice(7)) : diaryView(days);
  else if (tab === 'dieta') body = dietView();
  else if (tab === 'guia') body = guideView();
  else if (tab === 'datos') body = statsView();
  else if (tab === 'estudio') body = studyView();
  else body = daysView(r);
  const initials = String(portal.clientName || '').trim().split(/\s+/).slice(0, 2).map((x) => x[0] || '').join('').toUpperCase();
  const todayTxt = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  root.innerHTML = `
    <header class="cz-hero">
      <div class="cz-hero-top">
        <span class="cz-hero-logo"><svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="czlogo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6e8bff"/><stop offset=".55" stop-color="#22d3ee"/><stop offset="1" stop-color="#3ee6a0"/></linearGradient></defs><path d="M50 6 88 28v44L50 94 12 72V28Z" fill="none" stroke="url(#czlogo)" stroke-width="9" stroke-linejoin="round"/><path fill="#fff" fill-rule="evenodd" d="M23 35H40L49 44V56L40 65H23Z M30 42.5L42 50L30 57.5Z M57 35H72L79 42V58L72 65H57L50 58V42Z M58 43H71V57H58Z"/></svg><span>David Orihuela<small>Entrenador online</small></span></span>
        <span class="cz-hero-actions">${installBar()}<button type="button" class="cz-refresh" id="cz-refresh" title="Actualizar" aria-label="Actualizar">↻</button><button type="button" class="cz-avatar" id="cz-logout" title="Salir">${esc(initials || '·')}</button></span>
      </div>
      <small class="cz-hero-date">${esc(todayTxt)}</small>
      <div class="cz-title-row"><h1>${tab === 'diario' ? `Hola, ${esc(firstName(portal.clientName))} 👋` : esc({ rutina: 'Tu rutina', dieta: 'Tu dieta', guia: 'Tu guía', datos: 'Tus datos', estudio: 'Tu estudio' }[tab] || '')}</h1>
        ${tab === 'rutina' && portal.routineHtml ? '<button type="button" class="cz-dl" id="cz-dl" aria-label="Descargar tu rutina en PDF"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg><span>PDF</span></button>' : ''}
        ${tab === 'dieta' && portal.dietHtml ? '<button type="button" class="cz-dl" id="cz-dl" aria-label="Descargar tu dieta en PDF"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg><span>PDF</span></button>' : ''}</div>
    </header>
    <div class="cz-body">${body}</div>
    ${tabs.length > 1 ? `<nav class="cz-nav">${tabs.map(([k, l]) => `<a href="#${k}" class="${tab === k ? 'active' : ''}">${NAV_ICONS[k]}<span>${l}</span></a>`).join('')}</nav>` : ''}`;
  // Pestañas principales (no la dieta ni las subpáginas): ocupan justo la pantalla y no se desliza.
  // En móviles muy pequeños (menos de 340 de ancho o 540 de alto) no cabe todo: ahí sí se puede deslizar.
  const main = (h === '' || h === tab) && tab !== 'dieta' && tab !== 'estudio' && window.innerWidth >= 340 && window.innerHeight >= 540;
  document.body.classList.toggle('cz-lock', main);
  document.body.dataset.tab = main ? tab : '';
  // Botón discreto para descargar la rutina o la dieta en PDF (se crea en el propio móvil).
  const dl = document.getElementById('cz-dl');
  if (dl) {
    const isDiet = tab === 'dieta';
    pdfButton(dl, isDiet ? portal.dietHtml : portal.routineHtml, `${isDiet ? 'Dieta' : 'Rutina'} ${portal.clientName || ''}`, '✓');
  }
  bindLogout();
  bindInstall();
  const rf = document.getElementById('cz-refresh');
  if (rf) rf.onclick = () => { rf.classList.add('spin'); refreshNow(true); };
  if (tab === 'dieta' && portal.dietHtml) setupDiet();
  if (tab === 'diario') bindDiary();
  if (main && tab === 'rutina') requestAnimationFrame(fitDayCards);
  root.querySelectorAll('[data-guide]').forEach((b) => { b.onclick = () => openPanel(guideFull(b.dataset.guide)); });
  root.querySelectorAll('[data-study-weeks]').forEach((b) => { b.onclick = () => { studyWeeks = Number(b.dataset.studyWeeks); if (!b.classList.contains('locked')) { try { localStorage.setItem('cz:studyWeeks', String(studyWeeks)); } catch (e) { /* nada */ } } render(); }; });
  root.querySelectorAll('[data-open-w]').forEach((b) => { b.onclick = () => { location.hash = `#resumen/${b.dataset.openW}`; }; });
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
  return `<section class="cz-days" style="--n:${days.length}" data-n="${days.length}">
    ${days.map((d, i) => `<a class="card cz-day" href="#dia-${i}">
      <span class="cz-day-n">${i + 1}</span>
      <span class="grow"><strong>${esc(d.name)}</strong><small>${esc(d.groups.map((g) => g.g).join(' · '))}</small>
        <span class="cz-day-list">${d.groups.flatMap((g) => g.exs).map((ex) => `<i>${esc(ex.name)}</i>`).join('')}</span>
        <span class="cz-day-exs">${esc(d.groups.flatMap((g) => g.exs).map((ex) => ex.name).join(' · '))}</span></span>
      <span class="cz-day-count">${d.groups.reduce((n, g) => n + g.exs.length, 0)}<small>ejerc.</small></span>
    </a>`).join('')}
  </section>
  ${r.notes ? `<section class="card cz-card"><h2>Indicaciones</h2><p class="cz-notes">${esc(r.notes)}</p></section>` : ''}
`;
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
  return `<button type="button" class="cz-guide-card proto" data-guide="proto">
      <span class="cz-guide-ico">🛡️</span>
      <span class="grow"><strong>Protocolo innegociable</strong><small>${G.protocol.length} normas para que el plan funcione</small></span><b>›</b>
    </button>
    <button type="button" class="cz-guide-card tips" data-guide="tips">
      <span class="cz-guide-ico">🏋️</span>
      <span class="grow"><strong>Cómo entrenar</strong><small>Calentamiento, las 3 series, técnica y progreso</small></span><b>›</b>
    </button>
    <button type="button" class="cz-guide-card app" data-guide="app">
      <span class="cz-guide-ico">📱</span>
      <span class="grow"><strong>Cómo usar la app</strong><small>Diario, entreno paso a paso, descansos, estudio, tus datos y más</small></span><b>›</b>
    </button>`;
}

/** «Cómo usar la app»: qué hace cada parte de la app de entrenamiento. */
const APP_HELP = [
  ['📅 Diario', [
    'Es la pantalla principal. Arriba te dice qué día de tu rutina <b>te toca hoy</b>: pulsa <b>Entrenar hoy</b> para empezar.',
    'Si te saltas un día (por ejemplo, haces el día 3 antes que el 2), la app te vuelve a proponer el que te falta y luego se salta el que ya adelantaste.',
    'Debajo ves tus entrenos de este mes, las semanas seguidas que llevas entrenando y el total. En el calendario, los días que entrenaste salen marcados: toca uno para ver qué hiciste.',
  ]],
  ['🏋️ El entreno, paso a paso', [
    'Te guía ejercicio a ejercicio y serie a serie. Arriba tienes el recordatorio de las <b>series de aproximación</b>; en cada ejercicio, las fotos de inicio y final y <b>cómo se hace</b>.',
    'En cada serie apunta los <b>kg</b> y las <b>repeticiones</b>. Te recuerda lo que hiciste en el <b>entreno anterior</b>; si no escribes nada, se guarda ese mismo peso.',
    'Pulsa <b>Hecho · ir al descanso</b> al terminar la serie. Si te equivocas, en el descanso tienes <b>Corregir el peso de esta serie</b>.',
  ]],
  ['⏱️ Descansos y alarma', [
    'Pulsa <b>Empezar descanso</b> y la app cuenta el tiempo de ese ejercicio (3 min en pierna; 1:30 en bíceps, tríceps y hombros; 2 min en el resto). Puedes pausarlo o reiniciarlo.',
    'Al terminar suena una <b>alarma</b> y vibra hasta que respondas si pasas a la siguiente serie o repites el descanso.',
    'Deja la app abierta mientras descansas: si la cierras o bloqueas el móvil, puede que no suene. Durante el entreno la pantalla no se apaga sola.',
    'Mientras descansas ves <b>tu siguiente serie</b> y el peso y las repeticiones que hiciste en ella <b>el entreno anterior</b>, para que sepas a qué apuntar.',
    'En la última serie de un ejercicio te avisa de cuál es el siguiente, para que lo vayas preparando.',
  ]],
  ['⏭ ¿Máquina ocupada?', [
    'Antes de empezar un ejercicio puedes pulsar <b>¿Máquina ocupada?</b>: haces antes el siguiente y luego te vuelve a salir el que te saltaste.',
  ]],
  ['⬆ Toca subir el peso', [
    'Cuando tu entrenador ve que ya puedes con más, en esa serie te sale el aviso verde <b>Toca subir el peso en esta serie</b>. Sube un poco y apúntalo.',
  ]],
  ['✅ Terminar el entreno', [
    'Al acabar la última serie, o con el botón <b>Terminar</b>, se guarda tu entreno y ves el resumen: tiempo, series y en qué has mejorado.',
    'Si sales a mitad, el entreno se queda guardado: en el Diario te sale <b>Continuar</b> para seguir donde lo dejaste.',
    'Tu entrenador ve tus entrenos y tus pesos para ajustar tu plan.',
  ]],
  ['💪 Rutina y 🍎 Dieta', [
    '<b>Rutina:</b> todos los días de tu plan con sus ejercicios, fotos, series y descansos.',
    '<b>Dieta:</b> tu plan de alimentación completo, tal cual te lo ha preparado tu entrenador.',
    'Con el botón <b>⬇ PDF</b>, al lado del título, te descargas tu rutina o tu dieta en PDF para tenerla guardada o imprimirla.',
  ]],
  ['📊 Estudio', [
    'Tu <b>estudio del entrenamiento</b>: tu constancia (cuántas veces entrenas a la semana frente a los días de tu rutina), los kilos que mueves, tus récords y cómo evoluciona tu fuerza en <b>cada ejercicio</b>, con gráficas.',
    'Cada ejercicio sale marcado como <b>mejorando</b>, <b>estable</b>, <b>estancado</b> o <b>bajando</b>, y al final tienes <b>mis recomendaciones</b> para seguir progresando.',
    'Puedes verlo de la <b>última semana</b> o de las <b>últimas 4, 8 o 12 semanas</b>. Cada periodo se desbloquea cuando llevas ese tiempo entrenando con la app (🔒 te dice cuántos días faltan).',
    'Todo sale de los pesos que apuntas: cuanto más constante seas apuntándolos, más completo será tu estudio.',
  ]],
  ['📈 Tus datos', [
    'Tu peso y tu cintura con su evolución, tus calorías y macros pautados, tu mantenimiento y una estimación de cuánto peso perderás o ganarás por semana.',
    'También ves cuánto entrenas: entrenos de las últimas semanas, duración media y mejoras.',
  ]],
  ['🔄 Actualizar, instalar y salir', [
    'Si tu entrenador te cambia algo, pulsa <b>↻</b> arriba (o desliza la pantalla hacia abajo) para verlo al momento.',
    'Con <b>Instalar app</b> la tienes en la pantalla de inicio del móvil, como cualquier otra app.',
    'Para cerrar la sesión, toca tus iniciales arriba a la derecha.',
  ]],
];

/** Contenido completo de la guía (en una ventana). */
function guideFull(which) {
  const G = window.GUIDES;
  // Los textos de la guía son nuestros (guides.js), no vienen de la nube: pueden llevar <b>.
  if (which === 'proto') return `<section class="card cz-card cz-guide">
      <h2>Protocolo innegociable</h2>
      <p class="muted cz-guide-intro">${G.protocolIntro}</p>
      <ol class="cz-proto">${G.protocol.map(([t, d], i) => `<li><i>${i + 1}</i><div><b>${t}</b><span>${d}</span></div></li>`).join('')}</ol>
    </section>`;
  if (which === 'app') return `<section class="card cz-card cz-guide">
      <h2>Cómo usar la app</h2>
      <p class="muted cz-guide-intro">Todo lo que puedes hacer con tu app de entrenamiento, paso a paso.</p>
      <ul class="cz-tips">${APP_HELP.map(([t, d]) => `<li><b>${t}</b>${d.map((x) => `<span>${x}</span>`).join('')}</li>`).join('')}</ul>
    </section>`;
  return `<section class="card cz-card cz-guide">
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
  return `<div id="cz-diet" class="pv-pages">${sanitize(portal.dietHtml)}</div>
`;
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
}

/** Botón que crea el PDF (en el propio móvil del cliente) a partir de la hoja y lo descarga. */
function pdfButton(btn, html, name, done) {
  btn.dataset.html = btn.innerHTML;
  btn.onclick = async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    const label = btn.textContent;
    btn.classList.add('busy');
    btn.textContent = btn.classList.contains('cz-dl') ? '…' : 'Creando el PDF…';
    try {
      const blob = await window.PdfMaker.make(sanitize(html));
      window.PdfMaker.save(blob, window.PdfMaker.fileName(name));
      btn.textContent = done;
    } catch (e) {
      console.error(e);
      btn.textContent = btn.classList.contains('cz-dl') ? '✕' : 'No se pudo crear. Toca para reintentar';
    }
    setTimeout(() => { if (btn.dataset.html) btn.innerHTML = btn.dataset.html; else btn.textContent = label; btn.disabled = false; btn.classList.remove('busy'); }, 3000);
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
  const ms = t.match(/(\d+)\s*:\s*(\d{1,2})/); // «1:30 min»
  if (ms) return Number(ms[1]) * 60 + Number(ms[2]);
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
      ['Serie 3 · Agotamiento', 'máximas repeticiones con el peso de la serie 1'],
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
/* Series en las que toca subir peso (las marca el entrenador a partir del resumen de la IA). Cada marca se quita
 * sola en cuanto el cliente hace esa serie en un entreno posterior a la marca. */
const normName = (n) => String(n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
function upMarks() {
  let up = null;
  try { up = JSON.parse((portal && portal.upJson) || 'null'); } catch (e) { up = null; }
  return up && Array.isArray(up.list) ? up : null;
}
/** ¿Toca subir peso en esta serie (índice desde 0) de este ejercicio? */
function upNow(ex, setIdx) {
  const up = upMarks();
  if (!up) return false;
  if (!up.list.some((x) => normName(x.ex) === normName(ex.name) && Number(x.serie) === setIdx + 1)) return false;
  const since = Date.parse(up.at) || 0;
  // Ya la hizo después de la marca (en otro entreno, o en este mismo si ya la tiene hecha): se quita.
  return !workouts.some((w) => (w.endedAt || 0) > since && (w.exercises || []).some((e) => normName(e.name) === normName(ex.name) && e.sets[setIdx] && e.sets[setIdx].done));
}
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const shortDate = (ymdStr) => { const [, m, d] = String(ymdStr).split('-').map(Number); return m && d ? `${d} ${MESES[m - 1]}` : ''; };
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
  for (let i = 0; i < lead; i++) cells.push("<span class=\"cz-cal-cell cz-cal-blank\"></span>");
  for (let d = 1; d <= total; d++) {
    const key = `${cal.y}-${pad2(cal.m + 1)}-${pad2(d)}`;
    const n = byDate.get(key) || 0;
    const cls = ['cz-cal-cell', n ? 'done' : '', key === today ? 'today' : ''].filter(Boolean).join(' ');
    cells.push(n ? `<a class="${cls}" href="#diario/${key}">${d}</a>` : `<span class="${cls}">${d}</span>`);
  }
  const monthCount = workouts.filter((w) => w.date.startsWith(`${cal.y}-${pad2(cal.m + 1)}`)).length;
  const recent = workouts.slice(0, 6);
  // Estadísticas: este mes, semanas seguidas entrenando y total.
  const thisMonth = workouts.filter((w) => w.date.startsWith(today.slice(0, 7))).length;
  const weekKey = (s) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
  const weeks = new Set(workouts.map((w) => weekKey(w.date)));
  let streak = 0;
  for (let d = new Date(`${weekKey(today)}T12:00:00`); ; d.setDate(d.getDate() - 7)) {
    if (weeks.has(ymd(d))) streak++;
    else if (!(streak === 0 && ymd(d) === weekKey(today))) break; // la semana actual aún puede no tener entreno
  }
  const next = days.length ? roundInfo(days).next : -1;
  const nd = next >= 0 ? days[next] : null;
  return `
    ${wk ? `<section class="cz-today resume">
      <small>Entreno a medias</small>
      <h2>${esc(wk.dayName)}</h2>
      <p>Empezado el ${esc(fmtDay(wk.date))}. Sigue donde lo dejaste.</p>
      <div class="cz-row"><a class="btn cz-today-btn" href="#entreno">▶ Continuar</a><button type="button" class="btn cz-ghost" id="cz-wk-discard">Descartar</button></div>
    </section>` : nd ? `<a class="cz-today" href="#empezar">
      <small>Hoy te toca</small>
      <h2>${esc(nd.name)}</h2>
      <p>${esc(nd.groups.map((g) => g.g).join(' · '))} · ${nd.groups.reduce((n, g) => n + g.exs.length, 0)} ejercicios</p>
      <span class="btn cz-today-btn">▶ Entrenar hoy</span>
    </a>` : ''}
    <div class="cz-stats3">
      <div><strong>${thisMonth}</strong><small>este mes</small></div>
      <div><strong>${streak}<em>🔥</em></strong><small>${streak === 1 ? 'semana seguida' : 'semanas seguidas'}</small></div>
      <div><strong>${workouts.length}</strong><small>en total</small></div>
    </div>
    ${workoutsError ? '<p class="cz-error">No se han podido cargar tus entrenos. Comprueba la conexión.</p>' : ''}
    <section class="card cz-card cz-cal">
      <div class="cz-cal-head">
        <button type="button" class="btn sm" data-cal="-1" aria-label="Mes anterior">‹</button>
        <strong>${MONTHS[cal.m][0].toUpperCase() + MONTHS[cal.m].slice(1)} ${cal.y}</strong>
        <button type="button" class="btn sm" data-cal="1" aria-label="Mes siguiente">›</button>
      </div>
      <div class="cz-cal-grid">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((x) => `<span class="cz-cal-dow">${x}</span>`).join('')}${cells.join('')}</div>
      <p class="muted cz-cal-foot">${monthCount ? `${monthCount} ${monthCount === 1 ? 'entreno' : 'entrenos'} este mes` : 'Aún no hay entrenos este mes'} · <button type="button" class="link-btn" id="cz-tour">¿Cómo funciona?</button></p>
    </section>`;
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

/** Vuelta de la rutina: qué días ya has hecho en la vuelta actual y cuál te toca. Te toca el primero que te falta
 * (si te saltaste uno, vuelves a él y luego se salta el que adelantaste); al completar todos, empieza otra vuelta. */
function roundInfo(days) {
  const n = days.length;
  let done = new Set();
  for (const w of workouts.slice().reverse()) { // del más antiguo al más reciente
    if (!Number.isInteger(w.dayIndex) || w.dayIndex < 0 || w.dayIndex >= n) continue;
    done.add(w.dayIndex);
    if (done.size === n) done = new Set();
  }
  let next = 0;
  while (next < n && done.has(next)) next++;
  return { done, next: next < n ? next : 0 };
}

/** Elegir el día de la rutina. Se propone el primero que te falta de la vuelta actual. */
function chooseDayView(days) {
  if (!days.length) return '<section class="card cz-card"><p class="muted">Todavía no tienes rutina. Cuando tu entrenador la prepare, podrás entrenar desde aquí.</p></section>';
  const last = workouts[0];
  const { done, next } = roundInfo(days);
  const skipped = last && done.size > 0 && Number.isInteger(last.dayIndex) && next !== (last.dayIndex + 1) % days.length;
  return `<div class="cz-daynav"><a class="btn sm" href="#diario">← Diario</a></div>
    <h2 class="cz-day-title"><small>Entrenar hoy</small>¿Qué día toca?</h2>
    <p class="muted">${!last ? 'Elige el día de tu rutina que vas a entrenar:' : !done.size ? `Has completado todos los días de tu rutina. Empiezas otra vuelta con <strong>${esc(days[next].name)}</strong>:` : skipped ? `La última vez hiciste <strong>${esc(last.dayName)}</strong>. Te queda pendiente <strong>${esc(days[next].name)}</strong>:` : `La última vez hiciste <strong>${esc(last.dayName)}</strong>. Te toca el siguiente:`}</p>
    <section class="cz-days">
      ${days.map((d, i) => `<button type="button" class="card cz-day${i === next ? ' next' : ''}" data-start="${i}">
        <span class="cz-day-n">${i + 1}</span>
        <span class="grow"><strong>${esc(d.name)}</strong><small>${esc(d.groups.map((g) => g.g).join(' · '))}</small></span>
        ${i === next ? '<span class="cz-next">Te toca</span>' : done.has(i) ? '<span class="cz-day-done">✓ Hecho<br>esta vuelta</span>' : `<span class="cz-day-count">${d.groups.reduce((n, g) => n + g.exs.length, 0)} ejercicios</span>`}
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
  ['📊', 'Tu estudio', 'En «Estudio» verás cómo evolucionas: tu constancia, tu fuerza en cada ejercicio y mis recomendaciones. Se desbloquea a la semana de entrenar con la app, y luego a las 4, 8 y 12 semanas.'],
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
  // En la última serie de un ejercicio (y en su descanso) se avisa de cuál es el siguiente, para ir preparándolo.
  const nx = isLastSet && !isLastEx ? wk.exercises[wk.ex + 1] : null;
  const nextCard = nx ? `<div class="cz-nextex">
      ${nx.img0 ? `<img src="${esc(nx.img0)}" alt="">` : ''}
      <div class="grow"><small>${wk.phase === 'set' ? 'Después de esta serie' : 'Ve preparando'} · siguiente ejercicio</small><strong>${esc(nx.name)}</strong><span>${esc(nx.group)}${nx.rest ? ` · descanso ${esc(nx.rest)}` : ''}</span></div>
    </div>` : '';
  const t = wk.timer;
  let step;
  if (wk.phase === 'set') {
    step = `<section class="card cz-step">
      ${nextCard}
      <small class="cz-kicker">Ahora · ${esc(label)}</small>
      <p class="muted cz-step-hint">${esc(hint)}</p>
      ${prev && prev.done && prev.kg
        ? `<p class="cz-last">Entreno anterior${last.w.date ? ` (${esc(shortDate(last.w.date))})` : ''}: <b>${esc(prev.kg)} kg × ${esc(prev.reps || '—')}</b></p>`
        : `<p class="cz-last none">${last ? 'En el entreno anterior no hiciste esta serie' : 'Primera vez con este ejercicio: apunta el peso que uses'}</p>`}
      ${upNow(e, wk.set) ? '<p class="cz-up">⬆ <b>Toca subir el peso en esta serie</b> · según tu progreso, ya puedes con más</p>' : ''}
      <div class="cz-step-inputs">
        <label class="cz-in big"><input type="text" inputmode="decimal" id="cz-kg" value="${esc(cur.kg || '')}" placeholder="${prev && prev.kg ? esc(prev.kg) : '0'}"><span>kg</span></label>
        <label class="cz-in big"><input type="text" inputmode="numeric" id="cz-reps" value="${esc(cur.reps || '')}" placeholder="${prev && prev.reps ? esc(prev.reps) : '0'}"><span>reps</span></label>
      </div>
      <button type="button" class="btn primary cz-play" id="cz-go">▶ ${isLastSet && isLastEx ? 'Última serie · terminar entreno' : 'Hecho · ir al descanso'}</button>
      ${canSkip() ? `<button type="button" class="link-btn cz-skip" id="cz-skip">⏭ ¿Máquina ocupada? Haz antes «${esc(wk.exercises[wk.ex + 1].name)}» y vuelve luego a este</button>` : ''}
    </section>`;
  } else if (wk.phase === 'rest') {
    step = `<section class="card cz-timer${t && t.running ? ' running' : ''}">
      <small>Descanso · serie ${wk.set + 1} hecha${cur.kg ? ` (${esc(cur.kg)} kg × ${esc(cur.reps || '—')})` : ''}</small>
      <strong id="cz-timer-clock">${fmtClock(t ? timerLeft() : restSeconds(e.rest))}</strong>
      <p class="muted cz-step-hint">${!t ? 'Cuando termines la serie, pulsa ▶ para empezar el descanso.' : t.running ? 'Descansando…' : 'En pausa.'}</p>
      ${nextSetHint()}
      ${nextCard}
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
    <div class="cz-approach cz-approach-grid">
      <p class="cz-ap-title"><b>Series de aproximación</b> · 7–8 repeticiones · <b>1 min</b> de descanso entre series</p>
      <div class="cz-ap-opts">
        <div><span>Músculo grande o en frío</span><em><b>3 series</b><i> ·</i> al 50, 70 y 90 % del peso efectivo</em></div>
        <div><span>Músculo mediano o templado</span><em><b>2 series</b><i> ·</i> al 50 y 70 % del peso efectivo</em></div>
        <div><span>Músculo pequeño o ya caliente</span><em><b>1 serie</b><i> ·</i> al 50 % del peso efectivo</em></div>
      </div>
    </div>
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
        return `<li class="${state}${!st.done && upNow(e, i) ? ' up' : ''}"><span>S${i + 1}${!st.done && upNow(e, i) ? ' ⬆' : ''}</span><b>${st.done ? `${st.kg ? `${esc(st.kg)}` : '—'}×${esc(st.reps || '—')}` : i === wk.set ? 'Ahora' : '·'}</b></li>`;
      }).join('')}</ol>
    </section>
    <div class="cz-wk-step">${step}</div>
  </div>`;
  bindWorkout();
  startTicker();
  keepAwake();
  document.body.classList.add('cz-in-workout');
  document.body.classList.remove('cz-lock');
  window.scrollTo(0, 0);
  fitWorkout();
}

/* El entreno cabe siempre en una pantalla: si en este móvil no cabe todo, se va compactando por orden
 * (primero lo menos importante) hasta que entra. Niveles en styles.css (body.cz-fit-1 … cz-fit-7). */
const FIT_MAX = 7;
function fitWorkout() {
  const b = document.body;
  for (let i = 1; i <= FIT_MAX; i++) b.classList.remove(`cz-fit-${i}`);
  const scr = document.querySelector('.cz-wkscreen');
  // La pantalla del entreno está fija (no se desliza): se mira si su contenido cabe dentro.
  // Cabe si ni la pantalla ni la tarjeta del ejercicio tienen contenido que se salga (si no, se montan cosas).
  const boxes = scr ? [scr, ...scr.querySelectorAll('.cz-wk, .cz-wk-step > .card')] : [];
  const over = () => (scr ? boxes.some((el) => el.scrollHeight > el.clientHeight + 1) : document.documentElement.scrollHeight > window.innerHeight + 1);
  for (let lvl = 1; lvl <= FIT_MAX && over(); lvl++) b.classList.add(`cz-fit-${lvl}`);
}
window.addEventListener('resize', () => { if (wk && location.hash === '#entreno' && document.querySelector('.cz-wkscreen')) fitWorkout(); });

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
  on('cz-skip', () => skipExercise());
  on('cz-edit', () => { e.sets[wk.set].done = false; wk.phase = 'set'; wk.timer = null; saveWk(); renderWorkout(); });
  on('cz-next', () => { stopAlarm(); advance(); });
  on('cz-wk-finish', () => { stopAlarm(); finishWorkout(); });
}

/* Saltar un ejercicio (máquina ocupada): antes de empezarlo, se cambia de sitio con el siguiente. Así haces el
 * siguiente y al terminarlo te vuelve a salir el que saltaste; los que ya están hechos no vuelven a salir. */
const canSkip = () => {
  if (!wk || wk.phase !== 'set' || wk.ex >= wk.exercises.length - 1) return false;
  const e = wk.exercises[wk.ex];
  const n = wk.exercises[wk.ex + 1];
  return !e.sets.some((st) => st.done) && !n.sets.some((st) => st.done);
};
function skipExercise() {
  if (!canSkip()) return;
  const i = wk.ex;
  const skipped = wk.exercises[i];
  wk.exercises[i] = wk.exercises[i + 1];
  wk.exercises[i + 1] = skipped;
  wk.set = 0; wk.phase = 'set'; wk.timer = null;
  saveWk(); renderWorkout(); window.scrollTo(0, 0);
  flash(`«${skipped.name}» lo haces después`);
}

/** En el descanso: qué toca después (la siguiente serie, o la primera del siguiente ejercicio) y qué peso y
 * repeticiones hiciste en esa serie el entreno anterior, para tener el peso preparado antes de que acabe. */
function nextSetHint() {
  if (!wk) return '';
  const e = wk.exercises[wk.ex];
  let ex = e; let i = wk.set + 1;
  if (i >= e.sets.length) { if (wk.ex >= wk.exercises.length - 1) return ''; ex = wk.exercises[wk.ex + 1]; i = 0; }
  const last = lastSets(ex, wk.id);
  const prev = last && last.sets[i];
  const label = setInfo(ex, i)[0];
  const what = ex === e ? label : `${label} de ${ex.name}`;
  const up = upNow(ex, i) ? ' · <b class="cz-up-mini">⬆ toca subir el peso</b>' : '';
  return prev && prev.done && prev.kg
    ? `<p class="cz-last cz-last-next">Siguiente: ${esc(what)} · entreno anterior${last.w.date ? ` (${esc(shortDate(last.w.date))})` : ''}: <b>${esc(prev.kg)} kg × ${esc(prev.reps || '—')}</b>${up}</p>`
    : `<p class="cz-last cz-last-next none">Siguiente: ${esc(what)} · sin datos del entreno anterior${up}</p>`;
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
function unlockAudio() { unlockAudioRaw(); loadVoice(); }
function unlockAudioRaw() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) { audio = null; } }
/* Alarma de fin de descanso: fuerte y repetida (pitidos + vibración) hasta que respondes a la pregunta. */
let alarm = null;
function beepBurst() {
  if (!audio) return;
  if (audio.state === 'suspended') audio.resume();
  // Timbre de campanilla: tres notas que suben (Do–Mi–Sol agudos). Cada nota es una onda suave (seno) con un
  // armónico que le da brillo de campana; ataque rápido y caída natural. Fuerte, pero sin el zumbido áspero.
  const out = audio.createDynamicsCompressor();
  out.threshold.value = -12; out.ratio.value = 4;
  const master = audio.createGain();
  master.gain.value = 0.85; // al máximo sin saturar (saturar es lo que lo hace áspero)
  out.connect(master); master.connect(audio.destination);
  const notes = [1046.5, 1318.5, 1568]; // Do6, Mi6, Sol6
  notes.forEach((f, k) => {
    const at = audio.currentTime + k * 0.16;
    for (const [mult, vol, dur] of [[1, 0.9, 0.9], [2.01, 0.25, 0.45], [3, 0.08, 0.25]]) {
      const o = audio.createOscillator(); const g = audio.createGain();
      o.type = 'sine';
      o.frequency.value = f * mult;
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.start(at); o.stop(at + dur + 0.05);
    }
  });
}
/* Sonido grabado por el entrenador (portal.alarmAudio): se descodifica una vez y suena con el mismo audio
 * del móvil que la campanilla (ya desbloqueado al pulsar ▶), así se oye aunque no se toque la pantalla. */
let voice = null; // { src, buf }
async function loadVoice() {
  const src = portal && portal.alarmAudio;
  if (!src || !audio) return null;
  if (voice && voice.src === src) return voice.buf;
  try {
    const bin = atob(src.slice(src.indexOf(',') + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const buf = await audio.decodeAudioData(bytes.buffer);
    voice = { src, buf };
    return buf;
  } catch (e) { console.error('No se pudo cargar el sonido del entrenador', e); voice = { src, buf: null }; return null; }
}
function playVoice(buf) {
  if (audio.state === 'suspended') audio.resume();
  const s = audio.createBufferSource(); const g = audio.createGain();
  g.gain.value = 1;
  s.buffer = buf; s.connect(g); g.connect(audio.destination); s.start();
}

async function startAlarm() {
  stopAlarm();
  const buf = await loadVoice();
  if (buf) {
    const ring = () => { playVoice(buf); if (navigator.vibrate) navigator.vibrate([250, 120, 250]); };
    ring();
    alarm = setInterval(ring, Math.max(1700, (buf.duration + 0.9) * 1000));
    return;
  }
  const ring = () => { beepBurst(); if (navigator.vibrate) navigator.vibrate([250, 120, 250]); };
  ring();
  alarm = setInterval(ring, 1700);
}
function stopAlarm() {
  if (alarm) { clearInterval(alarm); alarm = null; }
  if (navigator.vibrate) navigator.vibrate(0);
}

/* Se quitaron los avisos por notificación del fin de descanso: se borra lo que quedó instalado en el móvil. */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach(async (r) => {
    const sw = r.active || r.waiting || r.installing;
    if (!sw || !/sw-cliente\.js/.test(sw.scriptURL)) return;
    try { const sub = await r.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch (e) { /* nada */ }
    try { (await r.getNotifications()).forEach((n) => n.close()); } catch (e) { /* nada */ }
    r.unregister().catch(() => {});
  })).catch(() => {});
}
try { localStorage.removeItem('cz:pushkey'); } catch (e) { /* sin almacenamiento */ }

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

/* ---------- Ventana a pantalla completa (guía) ---------- */
function openPanel(html) {
  const box = document.createElement('div');
  box.className = 'cz-panel';
  box.innerHTML = `<div class="cz-panel-in"><button type="button" class="cz-panel-x" aria-label="Cerrar">✕</button>${html}</div>`;
  box.onclick = (e) => { if (e.target === box || e.target.closest('.cz-panel-x')) box.remove(); };
  document.body.appendChild(box);
}

/* ---------- Tus datos: resumen general ---------- */
function spark(points, color) {
  if (points.length < 2) return '';
  const W = 300, H = 70, P = 6;
  const ys = points.map((p) => p.v);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi === lo) { hi += 1; lo -= 1; }
  const x = (i) => P + (i * (W - 2 * P)) / (points.length - 1);
  const y = (v) => P + (1 - (v - lo) / (hi - lo)) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const id = `g${Math.random().toString(36).slice(2, 7)}`;
  return `<svg class="cz-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${d} L${x(points.length - 1)},${H} L${x(0)},${H} Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
</svg>`;
}

function statsView() {
  let st = {};
  try { st = JSON.parse(portal.statsJson || '{}'); } catch (e) { st = {}; }
  const ms = (st.measures || []);
  const wts = ms.filter((m) => m.weight).map((m) => ({ d: m.date, v: m.weight }));
  const wsts = ms.filter((m) => m.waist).map((m) => ({ d: m.date, v: m.waist }));
  const delta = (arr, unit) => {
    if (arr.length < 2) return '<small class="muted">desde el inicio</small>';
    const dd = Math.round((arr[arr.length - 1].v - arr[0].v) * 10) / 10;
    return `<small class="${dd < 0 ? 'down' : dd > 0 ? 'up' : 'muted'}">${dd > 0 ? '+' : dd < 0 ? '−' : ''}${fmtKg(Math.abs(dd))} ${unit} desde el inicio</small>`;
  };
  const metric = (label, arr, unit, color) => `<div class="cz-metric">
      <span class="cz-metric-l">${label}</span>
      <strong>${arr.length ? `${fmtKg(arr[arr.length - 1].v)}<em>${unit}</em>` : '—'}</strong>
      ${arr.length ? delta(arr, unit) : '<small class="muted">sin datos todavía</small>'}
      ${spark(arr, color)}
    </div>`;
  // Entrenamiento
  const today = ymd();
  const in30 = workouts.filter((w) => (Date.parse(`${today}T12:00:00`) - Date.parse(`${w.date}T12:00:00`)) / 864e5 < 30);
  const avg = workouts.length ? workouts.reduce((t, w) => t + (w.durationSec || 0), 0) / workouts.length : 0;
  const ups30 = in30.reduce((n, w) => n + improvements(w).length, 0);
  // Entrenos por semana (últimas 8)
  const weekStart = (d) => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const w0 = weekStart(new Date());
  const bars = [];
  for (let k = 7; k >= 0; k--) {
    const a = new Date(w0); a.setDate(a.getDate() - 7 * k);
    const b = new Date(a); b.setDate(b.getDate() + 7);
    bars.push(workouts.filter((w) => { const t = new Date(`${w.date}T12:00:00`); return t >= a && t < b; }).length);
  }
  const maxB = Math.max(3, ...bars);
  const last = workouts[0];
  const dt = st.diet;
  let dietCard = '';
  if (dt) {
    const diff = dt.maintenance ? dt.kcal - dt.maintenance : null;
    const kind = diff === null ? '' : Math.abs(diff) < 50 ? 'Mantenimiento' : diff < 0 ? 'Déficit' : 'Superávit';
    const mk = [['Proteínas', dt.protein, 4, '#6e8bff'], ['Hidratos', dt.carbs, 4, '#22d3ee'], ['Grasas', dt.fat, 9, '#3ee6a0']];
    const totK = mk.reduce((t, [, g, f]) => t + g * f, 0) || 1;
    dietCard = `<section class="cz-dietcard card">
      <div class="cz-train-head"><span class="cz-metric-l">Tu dieta</span>${kind ? `<small class="cz-kind ${kind === 'Déficit' ? 'def' : kind === 'Superávit' ? 'sup' : ''}">${kind}</small>` : ''}</div>
      <div class="cz-kcal3">
        <div><strong>${dt.maintenance ? dt.maintenance.toLocaleString('es-ES') : '—'}</strong><small>mantenimiento</small></div>
        <div class="main"><strong>${dt.kcal.toLocaleString('es-ES')}</strong><small>kcal de tu dieta</small></div>
        <div><strong class="${diff < 0 ? 'def' : diff > 0 ? 'sup' : ''}">${diff === null ? '—' : `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(diff).toLocaleString('es-ES')}`}</strong><small>kcal diferencia</small></div>
      </div>
      ${diff !== null && Math.abs(diff) >= 50 ? `<p class="cz-estimate ${diff < 0 ? 'def' : 'sup'}">Estimación: <b>${diff < 0 ? '−' : '+'}${fmtKg(Math.round((Math.abs(diff) * 7 / 7700) * 100) / 100)} kg por semana</b> <small>(≈ ${fmtKg(Math.round(Math.abs(diff) * 30 / 7700 * 10) / 10)} kg al mes)</small></p>` : ''}
      <div class="cz-macrobar">${mk.map(([, g, f, col]) => `<i style="flex:${(g * f) / totK};background:${col}"></i>`).join('')}</div>
      <div class="cz-macros">${mk.map(([l, g, , col]) => `<div><b style="color:${col}">${g} g</b><small>${l}</small></div>`).join('')}</div>
    </section>`;
  }
  return `<div class="cz-metrics">
      ${metric('Peso', wts, 'kg', '#6e8bff')}
      ${metric('Cintura', wsts, 'cm', '#22d3ee')}
    </div>
    ${dietCard}
    <section class="cz-train card">
      <div class="cz-train-head"><span class="cz-metric-l">Entrenamiento</span><small class="muted">últimas 8 semanas</small></div>
      <div class="cz-bars">${bars.map((n, i) => `<span style="--h:${Math.round((n / maxB) * 100)}%" class="${i === 7 ? 'now' : ''}"><i></i><b>${n || ''}</b></span>`).join('')}</div>
      <div class="cz-train-kpis">
        <div><strong>${in30.length}</strong><small>entrenos · 30 días</small></div>
        <div><strong>${workouts.length ? fmtDuration(avg) : '—'}</strong><small>duración media</small></div>
        <div class="${ups30 ? 'up' : ''}"><strong>${ups30}</strong><small>mejoras · 30 días</small></div>
      </div>
    </section>
    ${last ? `<button type="button" class="cz-last-w card" data-open-w="${esc(last.id)}"><span class="cz-metric-l">Último entreno</span><span class="grow"><strong>${esc(last.dayName)}</strong><small class="muted">${esc(fmtDay(last.date))} · ${fmtDuration(last.durationSec || 0)}</small></span><b>›</b></button>` : ''}`;
}

/* ---------- Estudio del entrenamiento ----------
 * Los mismos datos que el estudio que ve el entrenador (js/study.js), hablándote a ti. Se puede ver de las últimas 4, 8 o
 * 12 semanas, y cada periodo se desbloquea cuando llevas ese tiempo entrenando con la app. */
let studyWeeks = 0;
try { studyWeeks = Number(localStorage.getItem('cz:studyWeeks')) || 0; } catch (e) { studyWeeks = 0; }
function studyView() {
  const TS = window.TrainingStudy;
  if (!TS) return '<p class="muted">No se ha podido cargar el estudio. Actualiza la app.</p>';
  const first = workouts.reduce((m, w) => (w.date && (!m || w.date < m) ? w.date : m), '');
  const days = first ? Math.round((Date.parse(`${ymd()}T12:00:00`) - Date.parse(`${first}T12:00:00`)) / 864e5) : 0;
  const OPTS = [1, 4, 8, 12];
  const open = OPTS.filter((n) => days >= n * 7);
  // El elegido puede estar bloqueado: entonces se ve qué falta para desbloquearlo.
  if (!OPTS.includes(studyWeeks)) studyWeeks = open.length ? open[open.length - 1] : 1;
  const filter = `<div class="cz-st-filter" role="group" aria-label="Periodo">${OPTS.map((n) => {
    const ok = open.includes(n);
    return `<button type="button" class="${n === studyWeeks ? 'on' : ''}${ok ? '' : ' locked'}" data-study-weeks="${n}" aria-pressed="${n === studyWeeks}"><b>${ok ? '' : '<i aria-hidden="true">🔒</i>'}${n}</b><small>${n === 1 ? 'semana' : 'semanas'}</small></button>`;
  }).join('')}</div>`;
  if (!open.includes(studyWeeks)) {
    const n = studyWeeks; const need = n * 7;
    const left = Math.max(1, need - days);
    const pct = Math.min(100, Math.round((days / need) * 100));
    const per = n === 1 ? 'tu primera semana' : `estas ${n} semanas`;
    return `${filter}<section class="card cz-st-locked">
      <div class="cz-st-lock-ico">🔒</div>
      <h2>Tu estudio de ${n} ${n === 1 ? 'semana' : 'semanas'} se desbloquea en ${left} ${left === 1 ? 'día' : 'días'}</h2>
      <p class="muted">Sigue entrenando y <b>apunta tus pesos en cada entreno</b>. Cuando lleves ${n} ${n === 1 ? 'semana' : 'semanas'} con la app verás cómo has evolucionado en ${per}: tu constancia, cuánto ha subido tu fuerza en cada ejercicio, tus récords y mis recomendaciones para seguir progresando.</p>
      <div class="cz-st-progress"><i style="width:${pct}%"></i></div><small class="muted">${first ? `${days} de ${need} días` : 'Empieza tu primer entreno desde el Diario'}</small>
      ${open.length ? `<p class="cz-st-hint">Mientras tanto, mira tu estudio de <button type="button" class="link-btn" data-study-weeks="${open[open.length - 1]}">${open[open.length - 1]} ${open[open.length - 1] === 1 ? 'semana' : 'semanas'}</button>.</p>` : ''}
    </section>`;
  }
  const r = routine();
  let stats = {};
  try { stats = JSON.parse(portal.statsJson || '{}'); } catch (e) { stats = {}; }
  const up = upMarks();
  const st = TS.compute({
    name: portal.clientName || '', startDate: stats.startDate || '',
    routineDays: (r.days || []).map((d, i) => ({ name: d.name || `Día ${i + 1}`, exercises: (d.groups || []).flatMap((g) => g.exs || []).map((e) => ({ name: e.name })) })),
    subir: up ? up.list.filter((x) => !workouts.some((w) => (w.endedAt || 0) > (Date.parse(up.at) || 0) && (w.exercises || []).some((e) => normName(e.name) === normName(x.ex) && e.sets[x.serie - 1] && e.sets[x.serie - 1].done))) : [],
  }, workouts, studyWeeks);
  const S = TS.STATUS;
  const f = TS.fmtNum;
  const kpi = (l, v, sub) => `<div class="cz-st-kpi"><span>${l}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  const list = (arr) => `<ul class="cz-st-list">${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  const badge = (s) => `<span class="st-badge" style="--c:${S[s][0]}"><i></i>${S[s][1]}</span>`;
  const labels = st.weeks.map((w) => TS.shortDate(w.start));
  if (!st.list.length) return `${filter}<section class="card"><p class="muted" style="margin:0">No has apuntado entrenos ${studyWeeks === 1 ? 'en la última semana' : `en las últimas ${studyWeeks} semanas`}.</p></section>`;
  const cal = st.weeks.map((wk) => `<div class="st-cal-w"><span>${esc(TS.shortDate(wk.start))}</span>${Array.from({ length: 7 }, (_, k) => { const d = new Date(`${wk.start}T12:00:00`); d.setDate(d.getDate() + k); const dd = ymd(d); return `<i class="${st.trainedDays.has(dd) ? 'on' : ''}${dd > ymd() ? ' fut' : ''}"></i>`; }).join('')}</div>`).join('');
  const maxDia = Math.max(1, ...st.porDia.map((d) => d.veces));
  return `${filter}
    <section class="card cz-st">
      <div class="cz-st-kpis">
        ${kpi('Entrenos', st.list.length, studyWeeks === 1 ? 'esta semana' : `en ${studyWeeks} semanas`)}
        ${kpi('Por semana', f(Math.round(st.perWeek * 10) / 10), st.target ? `de ${st.target} en tu rutina` : '')}
        ${kpi('Constancia', st.adherence != null ? `${st.adherence} %` : '—', st.target ? 'de lo planificado' : '')}
        ${kpi('Duración', st.durMin ? TS.mins(st.durMin) : '—', 'media por entreno')}
        ${kpi('Series hechas', f(st.totalSets), st.setsPct != null ? `${st.setsPct} % de las programadas` : '')}
        ${kpi('Repeticiones', f(st.totalReps), 'en total')}
        ${kpi('Kilos movidos', `${f(Math.round(st.totalVol / 100) / 10)} t`, 'kilos × repeticiones')}
        ${kpi('Récords', st.prs, 'veces que has batido tu marca')}
      </div>
    </section>
    <section class="card cz-st"><h3>Estado de tus ejercicios</h3>
      <div class="cz-st-states">${['mejorando', 'estable', 'estancado', 'bajando'].map((k) => `<div style="--c:${S[k][0]}"><b>${st.counts[k]}</b>${badge(k)}</div>`).join('')}</div>
    </section>
    <section class="card cz-st"><h3>Lo más importante</h3>${list([...st.notes.constancia, ...st.notes.progreso])}</section>
    <section class="card cz-st"><h3>Entrenos por semana</h3>${st.target ? `<small class="muted">La línea son los ${st.target} días de tu rutina</small>` : ''}
      ${TS.bars(st.weeks.map((w) => w.n), labels, { w: 360, h: 210, target: st.target, targetLabel: st.target ? `Objetivo: ${st.target}` : '' })}</section>
    <section class="card cz-st"><h3>Días que entrenaste <small class="muted">L M X J V S D</small></h3><div class="st-cal">${cal}</div></section>
    ${st.porDia.length ? `<section class="card cz-st"><h3>Días de tu rutina</h3><div class="st-hbars">${st.porDia.map((d) => `<div class="st-hbar"><span>${esc(d.dia)}</span><div><i style="width:${(d.veces / maxDia) * 100}%"></i></div><b>${d.veces}</b></div>`).join('')}</div></section>` : ''}
    <section class="card cz-st"><h3>Kilos movidos por semana</h3><small class="muted">Kilos × repeticiones de todas tus series</small>
      ${TS.bars(st.weeks.map((w) => Math.round(w.vol)), labels, { w: 360, h: 210, fmt: (v) => (v >= 1000 ? `${f(Math.round(v / 100) / 10)} t` : f(Math.round(v))) })}</section>
    <section class="card cz-st"><h3>Ejercicio a ejercicio</h3><small class="muted">La línea es tu fuerza estimada con tu mejor serie de cada sesión.</small>
      <div class="cz-st-exs">${st.exercises.map((e) => `<div class="st-ex" style="--c:${S[e.status][0]}">
        <div class="st-ex-head"><b>${esc(e.name)}</b>${badge(e.status)}</div>
        ${TS.spark(e.ses, S[e.status][0])}
        <div class="st-ex-nums"><span>${e.ses.length} ${e.ses.length === 1 ? 'sesión' : 'sesiones'}</span><span>Primera: ${esc(TS.setTxt(e.first.best))}</span><span>Última: <b>${esc(TS.setTxt(e.last.best))}</b></span>${e.peak ? `<span>Mejor: ${esc(TS.setTxt(e.peak.best))}</span>` : ''}${e.pct != null && e.ses.length > 1 ? `<span>Fuerza: <b>${e.pct > 0 ? '+' : ''}${e.pct} %</b></span>` : ''}</div>
      </div>`).join('')}</div></section>
    <section class="card cz-st"><h3>Mis recomendaciones</h3><ol class="cz-st-list cz-st-reco">${st.notes.recomendaciones.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></section>`;
}

/** Mejoras de un entreno respecto a la vez anterior en cada ejercicio (más peso, o mismo peso con más reps). */
function improvements(w) {
  const best = (list) => { let b = null; for (const st of list || []) { const kg = num(st.kg); if (!st.done || kg === null) continue; const r = num(st.reps) || 0; if (!b || kg > b.kg || (kg === b.kg && r > b.reps)) b = { kg, reps: r }; } return b; };
  const out = [];
  const older = workouts.slice(workouts.indexOf(w) + 1);
  for (const e of w.exercises || []) {
    const now = best(e.sets);
    if (!now) continue;
    const same = (y) => (e.id && y.id === e.id) || y.name === e.name;
    const pw = older.find((x) => (x.exercises || []).some((y) => same(y) && best(y.sets)));
    const before = pw && best(pw.exercises.find(same).sets);
    if (before && (now.kg > before.kg || (now.kg === before.kg && now.reps > before.reps))) out.push(e.name);
  }
  return out;
}

/* ---------- Tirar hacia abajo para actualizar (también con la app instalada y con la pantalla bloqueada) ---------- */
(function pullToRefresh() {
  let y0 = null; let dy = 0; let el = null;
  const atTop = () => (window.scrollY || document.documentElement.scrollTop) <= 0;
  const blocked = (t) => location.hash === '#entreno' || (t && t.closest && t.closest('.cz-sheet, .cz-panel, input, textarea, .pv-pages'));
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || !atTop() || blocked(e.target)) { y0 = null; return; }
    y0 = e.touches[0].clientY; dy = 0;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (y0 === null) return;
    dy = e.touches[0].clientY - y0;
    if (dy <= 0) { if (el) el.style.opacity = 0; return; }
    if (!el) { el = document.createElement('div'); el.className = 'cz-ptr'; el.innerHTML = '<span>↻</span>'; document.body.appendChild(el); }
    const d = Math.min(dy, 140);
    el.style.opacity = Math.min(1, d / 70);
    el.style.transform = `translate(-50%, ${d * 0.6}px) rotate(${d * 2.5}deg)`;
    el.classList.toggle('ready', dy > 90);
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (y0 === null) return;
    y0 = null;
    if (dy > 90 && el) { el.classList.add('spin'); const x = el; el = null; refreshNow(true).finally(() => x.remove()); return; }
    if (el) { el.remove(); el = null; }
  });
})();

/* ---------- Actualizar: datos nuevos y versión nueva de la app ---------- */
const MY_VERSION = (document.querySelector('script[src*="js/cliente.js"]') || { src: '' }).src.split('v=')[1] || '';
let refreshing = false;
async function refreshNow(manual) {
  if (refreshing || location.hash === '#entreno') return;
  refreshing = true;
  try {
    // ¿Hay una versión nueva publicada? Entonces se recarga la página entera.
    const html = await fetch(`cliente.html?nc=${Date.now()}`, { cache: 'no-store' }).then((r) => r.text());
    const m = html.match(/js\/cliente\.js\?v=([\w.-]+)/);
    if (m && MY_VERSION && m[1] !== MY_VERSION) { location.reload(); return; }
  } catch (e) { /* sin conexión: se sigue con los datos */ }
  try {
    if (token) { portal = (await readPortal(token)) || portal; await loadWorkouts(); }
    if (portal) render();
    if (manual) flash('Actualizado ✓');
  } catch (e) {
    console.error(e);
    if (manual) flash('Sin conexión');
  } finally {
    refreshing = false;
    const rf = document.getElementById('cz-refresh');
    if (rf) rf.classList.remove('spin');
  }
}
// Al volver a la app (desde otra app o tras bloquear el móvil) se pone al día sola.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && portal) refreshNow(false); });
