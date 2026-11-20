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
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

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
  const tab = h.startsWith('dia-') ? 'rutina' : (['rutina', 'dieta', 'guia'].includes(h) ? h : (portal.noRoutine ? 'dieta' : 'rutina'));
  const tabs = [
    portal.noRoutine ? null : ['rutina', 'Rutina'],
    portal.noDiet ? null : ['dieta', 'Dieta'],
    portal.noRoutine ? null : ['guia', 'Guía'],
  ].filter(Boolean);
  let body;
  if (h.startsWith('dia-') && days[Number(h.slice(4))]) body = dayView(days, Number(h.slice(4)));
  else if (tab === 'dieta') body = dietView();
  else if (tab === 'guia') body = guideView();
  else body = daysView(r);
  root.innerHTML = `
    <section class="card cz-hello">
      <div class="grow"><h1>Hola, ${esc(firstName(portal.clientName))}</h1><p class="muted">Tu zona de entrenamiento con David Orihuela.</p></div>
      <button type="button" class="link-btn" id="cz-logout">Salir</button>
    </section>
    ${tabs.length > 1 ? `<nav class="tabs cz-tabs">${tabs.map(([k, l]) => `<a href="#${k}" class="${tab === k ? 'active' : ''}">${l}</a>`).join('')}</nav>` : ''}
    ${body}`;
  bindLogout();
  if (tab === 'dieta' && portal.dietHtml) setupDiet();
  const rb = document.getElementById('cz-routine-pdf');
  if (rb) pdfButton(rb, portal.routineHtml, `Rutina ${portal.clientName || ''}`, '✓ Descargada · búscala en Descargas');
  if (h.startsWith('dia-')) window.scrollTo(0, 0);
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
