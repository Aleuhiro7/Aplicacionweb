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
  getDoc, deleteDoc, getDocFromServer,
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
  state.status = status;
  state.error = error || '';
  const btn = document.querySelector('.sync-btn');
  if (btn) {
    btn.dataset.state = status === 'on' ? 'on' : status === 'busy' ? 'busy' : 'off';
    btn.title = status === 'on' ? 'Sincronizado' : status === 'busy' ? 'Sincronizando…' : 'Sin sincronizar: toca para entrar con Google';
  }
  if (location.hash.startsWith('#/ajustes')) App.render();
}

async function push() {
  if (!ref || !ready) return;
  try {
    await setDoc(ref, { json: JSON.stringify(Store.data), updatedAt: serverTimestamp() });
  } catch (e) {
    console.error(e);
    setStatus('error', 'No se pudieron subir los cambios: ' + (e.code || e.message));
  }
}

Store.onSave(() => { push(); });

onAuthStateChanged(auth, (user) => {
  if (unsub) { unsub(); unsub = null; }
  ref = null;
  ready = false;
  state.user = user;
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
    } else {
      ready = true;
      if (snap.data().json === JSON.stringify(Store.data)) { setStatus(snap.metadata.fromCache ? 'busy' : 'on'); return; }
      Store.replaceAll(remote);
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
  return `<div class="sync-box">
    <p><strong>${label}</strong></p>
    <p class="muted">Conectado como ${esc(state.user.email)}. Entra con esta misma cuenta en tus otros dispositivos y verás los mismos clientes.</p>
    <div class="actions"><button class="btn" data-sync="logout">Cerrar sesión</button></div>
  </div>`;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-sync]');
  if (!el) return;
  e.preventDefault();
  const what = el.dataset.sync;
  if (what === 'login') signIn();
  else if (what === 'logout') logout();
  else if (what === 'open') {
    if (!state.user) signIn();
    else location.hash = '#/ajustes';
  }
});

window.Sync = { signIn, logout, settingsHTML, state, uploadPhoto, downloadPhoto, deletePhoto, createQuestionnaire, fetchQuestionnaire, publishPlan };
setStatus(state.status);
App.render();
