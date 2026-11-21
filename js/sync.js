/* Sincronización en la nube con Firebase: los datos se comparten entre todos
 * los dispositivos en los que entres con la misma cuenta de Google.
 * Los datos se siguen guardando también en este navegador, así que la app
 * funciona sin conexión y se pone al día cuando vuelve la cobertura. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, onSnapshot, setDoc, serverTimestamp,
  getDoc, deleteDoc, getDocFromServer, collection, getDocs,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAKJyR04QdmU_IEWhiH_lwxaUBOFLsM9Ek',
  authDomain: 'aplicacionweb7.firebaseapp.com',
  projectId: 'aplicacionweb7',
  storageBucket: 'aplicacionweb7.firebasestorage.app',
  messagingSenderId: '1017996325873',
  appId: '1:1017996325873:web:413c917aecb3154d7c0a50',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  db = initializeFirestore(app, {});
}

const state = { user: null, status: 'off', error: '' }; // off | busy | on | error
let ref = null;
let ready = false;
let unsub = null;

const esc = (s) => U.esc(s == null ? '' : String(s));

function syncedKey(uid) { return 'entrenapro:synced:' + uid; }

function setStatus(status, error) {
  if (status === 'on' && state.status !== 'on' && window.Photos) setTimeout(() => window.Photos.uploadPending(), 0);
  if (status === 'on' && state.status !== 'on' && window.Views && Views.checkQuestionnaireLinks) setTimeout(() => Views.checkQuestionnaireLinks(), 500);
  if (status === 'on' && state.status !== 'on' && window.Views && Views.syncPortals) Views.syncPortals(1500);
  state.status = status;
  state.error = error || '';
  const btn = document.querySelector('.sync-btn');
  if (btn) {
    btn.dataset.state = status === 'on' ? 'on' : status === 'busy' ? 'busy' : 'off';
    btn.title = status === 'on' ? 'Sincronizado' : status === 'busy' ? 'Sincronizando…' : 'Sin sincronizar: toca para entrar con Google';
  }
  if (location.hash.startsWith('#/ajustes')) App.render();
}

/* Cambios de este dispositivo que aún no han llegado a la nube (por ejemplo, hechos justo al abrir la app,
 * antes de conectar, o sin cobertura). Mientras haya, al llegar los datos de la nube se JUNTAN con los de
 * aquí (gana el cambio más reciente) en vez de sustituirlos, así no se pierde nada. */
const DIRTY = 'entrenapro:pendiente';
const markDirty = (v) => { try { if (v) localStorage.setItem(DIRTY, '1'); else localStorage.removeItem(DIRTY); } catch (e) { /* sin almacenamiento */ } };
const isDirty = () => { try { return !!localStorage.getItem(DIRTY); } catch (e) { return false; } };

async function push() {
  if (!ref || !ready) return;
  try {
    await setDoc(ref, { json: JSON.stringify(Store.data), updatedAt: serverTimestamp() });
    state.lastSync = new Date();
    markDirty(false);
  } catch (e) {
    console.error(e);
    markDirty(true);
    setStatus('error', 'No se pudieron subir los cambios: ' + (e.code || e.message));
  }
}

Store.onSave(() => { if (state.user) markDirty(true); push(); });

/** «Sincronizar ahora» (Ajustes): junta lo de este dispositivo con lo de la nube y lo sube. */
async function syncNow() {
  if (!ref) { signIn(); return; }
  setStatus('busy');
  try {
    let snap;
    try { snap = await getDocFromServer(ref); } catch (e) { snap = await getDoc(ref); }
    if (snap.exists()) Store.mergeIn(JSON.parse(snap.data().json));
    ready = true;
    await push();
    App.applyTheme();
    App.render();
    if (state.status !== 'error') { setStatus('on'); UI.toast('Sincronizado: este dispositivo y la nube tienen ya los mismos datos'); }
  } catch (e) {
    console.error(e);
    setStatus('error', 'No se pudo sincronizar: ' + (e.code || e.message));
    UI.toast('No se pudo sincronizar. Comprueba la conexión.');
  }
}

onAuthStateChanged(auth, (user) => {
  // La app de gestión es solo para el entrenador (cuenta de Google): una cuenta de cliente (correo y
  // contraseña) nunca se sincroniza aquí. La zona del cliente usa su propia sesión aparte (cliente.js).
  if (user && !user.providerData.some((p) => p.providerId === 'google.com')) { signOut(auth); return; }
  if (unsub) { unsub(); unsub = null; }
  ref = null;
  ready = false;
  state.user = user;
  const first = !state.authChecked;
  state.authChecked = true; // ya se sabe si hay sesión: las pantallas vacías pueden decir «entra con Google»
  if (first && window.App) App.render();
  if (!user) { setStatus('off'); return; }

  setStatus('busy');
  ref = doc(db, 'users', user.uid, 'app', 'data');
  let firstTime = !localStorage.getItem(syncedKey(user.uid));

  unsub = onSnapshot(ref, (snap) => {
    if (snap.metadata.hasPendingWrites) return; // es nuestro propio cambio
    if (!snap.exists()) {
      if (snap.metadata.fromCache) return; // esperamos a confirmar con el servidor
      ready = true;
      firstTime = false;
      localStorage.setItem(syncedKey(user.uid), '1');
      push();
      setStatus('on');
      return;
    }
    let remote;
    try { remote = JSON.parse(snap.data().json); } catch (e) { setStatus('error', 'Los datos de la nube están dañados.'); return; }
    if (firstTime) {
      if (snap.metadata.fromCache) return;
      // Primera vez en este dispositivo: se juntan los datos de aquí con los de la nube.
      Store.mergeIn(remote);
      ready = true;
      firstTime = false;
      localStorage.setItem(syncedKey(user.uid), '1');
      push();
    } else if (isDirty() && !snap.metadata.fromCache) {
      // Hay cambios de aquí sin subir: se juntan con los de la nube y se sube el resultado.
      Store.mergeIn(remote);
      ready = true;
      push();
    } else {
      ready = true;
      if (snap.data().json === JSON.stringify(Store.data)) { state.lastSync = state.lastSync || new Date(); setStatus(snap.metadata.fromCache ? 'busy' : 'on'); return; }
      Store.replaceAll(remote);
      if (!snap.metadata.fromCache) state.lastSync = new Date();
    }
    App.applyTheme();
    App.render();
    setStatus(snap.metadata.fromCache ? 'busy' : 'on');
  }, (err) => {
    console.error(err);
    setStatus('error', 'Error de sincronización: ' + (err.code || err.message));
  });
});

/* ---------- Fotos: cada imagen va en su propio documento (users/{uid}/photos/{id}) ---------- */
async function uploadPhoto(id, dataUrl, clientId) {
  if (!state.user) return false;
  try {
    await setDoc(doc(db, 'users', state.user.uid, 'photos', id), { data: dataUrl, clientId, updatedAt: serverTimestamp() });
    return true;
  } catch (e) {
    console.error('No se pudo subir la foto', e);
    return false;
  }
}

async function downloadPhoto(id) {
  if (!state.user) return null;
  try {
    const snap = await getDoc(doc(db, 'users', state.user.uid, 'photos', id));
    return snap.exists() ? snap.data().data : null;
  } catch (e) {
    console.error('No se pudo descargar la foto', e);
    return null;
  }
}

async function deletePhoto(id) {
  if (!state.user) return;
  try { await deleteDoc(doc(db, 'users', state.user.uid, 'photos', id)); } catch (e) { console.error(e); }
}

/* ---------- Cuestionario por enlace: cuestionarios/{token} ----------
 * El entrenador crea el documento (con su uid como dueño) y el cliente, sin cuenta,
 * solo puede añadir sus respuestas una vez. Ver firestore.rules. */
async function createQuestionnaire(token, payload) {
  if (!state.user) throw new Error('Inicia sesión con Google para crear enlaces');
  await setDoc(doc(db, 'cuestionarios', token), Object.assign({}, payload, {
    owner: state.user.uid, answers: null, answeredAt: null, createdAt: serverTimestamp(),
  }));
}

/* Rutina y dieta por enlace: se guardan en la misma colección que los cuestionarios
 * (cuestionarios/{token}, con kind «rutina» o «dieta»), así sirven las mismas reglas de Firebase. */
async function publishPlan(token, payload) {
  if (!state.user) throw new Error('Inicia sesión con Google para crear enlaces');
  await setDoc(doc(db, 'cuestionarios', token), Object.assign({}, payload, {
    owner: state.user.uid, answers: null, answeredAt: null, updatedAt: serverTimestamp(),
  }));
}

/* ---------- Zona del cliente: portal/{token} ----------
 * Lo que ve cada cliente en su zona (cliente.html): su rutina, su dieta y la guía. Lo publica el
 * entrenador; el cliente, al crear su cuenta, solo puede apuntar quién es (memberUid). Ver firestore.rules. */
async function publishPortal(token, payload) {
  if (!state.user) throw new Error('Inicia sesión con Google para publicar la zona del cliente');
  // merge: no se pisan los datos de la cuenta del cliente (memberUid, memberEmail, joinedAt).
  await setDoc(doc(db, 'portal', token), Object.assign({}, payload, { owner: state.user.uid, updatedAt: serverTimestamp() }), { merge: true });
}

async function fetchPortal(token) {
  if (!state.user) return null;
  const ref = doc(db, 'portal', token);
  let snap;
  try { snap = await getDocFromServer(ref); } catch (e) { snap = await getDoc(ref); }
  return snap.exists() ? snap.data() : null;
}

/** Entrenos que el cliente ha apuntado en su diario (portal/{código}/workouts), del más reciente al más antiguo. */
async function fetchWorkouts(token) {
  if (!state.user) return null;
  const snap = await getDocs(collection(db, 'portal', token, 'workouts'));
  return snap.docs.map((d) => d.data()).sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
}

async function fetchQuestionnaire(token) {
  if (!state.user) return null;
  const ref = doc(db, 'cuestionarios', token);
  let snap;
  try { snap = await getDocFromServer(ref); } catch (e) { snap = await getDoc(ref); }
  return snap.exists() ? snap.data() : null;
}

async function signIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
    } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
      UI.toast('No se pudo iniciar sesión: ' + (e.code || e.message));
    }
  }
}

async function logout() {
  await signOut(auth);
  UI.toast('Sesión cerrada. Los datos siguen guardados en este dispositivo.');
}

function settingsHTML() {
  if (!state.user) {
    return `<div class="sync-box">
      <p class="muted">Ahora los datos están <strong>solo en este dispositivo</strong>. Entra con tu cuenta de Google para compartirlos entre el móvil y la tablet. Lo que tengas aquí no se pierde: se sube a la nube.</p>
      <div class="actions"><button class="btn primary" data-sync="login">${U.icon('cloud')} Entrar con Google y sincronizar</button></div>
    </div>`;
  }
  const label = state.status === 'on' ? '✅ Sincronizado' : state.status === 'error' ? '⚠️ ' + esc(state.error) : '⏳ Sincronizando…';
  const t = state.lastSync;
  const when = t ? `${t.toLocaleDateString('es-ES')} a las ${t.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : '';
  const kb = Math.round(new Blob([JSON.stringify(Store.data)]).size / 1024);
  return `<div class="sync-box">
    <p><strong>${label}</strong>${when ? ` <span class="muted">· última vez: ${esc(when)}</span>` : ''}</p>
    <p class="muted">Conectado como <strong>${esc(state.user.email)}</strong>. En el móvil y en la tablet tiene que salir <strong>esta misma cuenta</strong>: si en otro dispositivo sale otra, cierra sesión allí y entra con esta.</p>
    <p class="muted">En este dispositivo: ${Store.data.clients.length} ${Store.data.clients.length === 1 ? "cliente" : "clientes"} · ${kb} KB${isDirty() ? ' · <strong>hay cambios pendientes de subir</strong>' : ''}${kb > 850 ? ' · <strong>cerca del límite de la nube (1 MB)</strong>' : ''}.</p>
    <div class="actions"><button class="btn primary" data-sync="now">${U.icon('refresh')} Sincronizar ahora</button><button class="btn" data-sync="logout">Cerrar sesión</button></div>
    <p class="muted" style="font-size:.85rem;margin-top:8px">Si el móvil y la tablet no muestran lo mismo, pulsa «Sincronizar ahora» en los dos (uno después del otro): se juntan los datos de los dos sin perder nada.</p>
  </div>`;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-sync]');
  if (!el) return;
  e.preventDefault();
  const what = el.dataset.sync;
  if (what === 'login') signIn();
  else if (what === 'logout') logout();
  else if (what === 'now') syncNow();
  else if (what === 'open') {
    if (!state.user) signIn();
    else location.hash = '#/ajustes';
  }
});

window.Sync = { signIn, logout, settingsHTML, state, uploadPhoto, downloadPhoto, deletePhoto, createQuestionnaire, fetchQuestionnaire, publishPlan, publishPortal, fetchPortal, fetchWorkouts };
setStatus(state.status);
App.render();
