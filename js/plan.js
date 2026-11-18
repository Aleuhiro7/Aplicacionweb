/* Página pública de la rutina o la dieta: el cliente la abre desde el enlace de WhatsApp
 * (rutina.html?t=TOKEN o dieta.html?t=TOKEN), ve su plan y se descarga el PDF. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const app = initializeApp({
  apiKey: 'AIzaSyAKJyR04QdmU_IEWhiH_lwxaUBOFLsM9Ek',
  authDomain: 'aplicacionweb7.firebaseapp.com',
  projectId: 'aplicacionweb7',
  storageBucket: 'aplicacionweb7.firebasestorage.app',
  messagingSenderId: '1017996325873',
  appId: '1:1017996325873:web:413c917aecb3154d7c0a50',
});
const db = getFirestore(app);

const KIND = document.body.dataset.kind; // «rutina» o «dieta»
const LABEL = KIND === 'rutina' ? 'rutina de entrenamiento' : 'plan de alimentación';
const head = document.getElementById('pv-head');
const pagesBox = document.getElementById('pv-pages');
const bar = document.getElementById('pv-bar');
const btn = document.getElementById('pv-download');

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function message(title, text) {
  head.innerHTML = `<h1 class="q-title">${esc(title)}</h1><p class="q-intro">${esc(text)}</p>`;
  bar.hidden = true;
}

/**
 * La hoja llega como HTML desde la nube: se limpia antes de usarla (sin scripts, sin eventos,
 * sin enlaces «javascript:» y solo imágenes de esta web), aunque solo el entrenador puede crearla.
 */
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

/** Las páginas A4 se muestran reducidas al ancho de la pantalla. */
function fit() {
  const art = pagesBox.querySelector('.ds');
  if (!art) return;
  const pageW = art.querySelector('.ds-page').offsetWidth;
  const s = Math.min(1, (pagesBox.clientWidth) / pageW);
  art.style.transform = `scale(${s})`;
  pagesBox.style.height = `${art.offsetHeight * s}px`;
}

async function start() {
  const token = new URLSearchParams(location.search).get('t');
  if (!token || !/^[a-f0-9]{20,64}$/.test(token)) {
    message('Enlace no válido', 'Este enlace no es correcto. Pide a tu entrenador que te lo vuelva a enviar.');
    return;
  }
  let snap;
  try {
    snap = await getDoc(doc(db, 'cuestionarios', token));
  } catch (e) {
    console.error(e);
    message('No se ha podido abrir', 'Comprueba tu conexión e inténtalo de nuevo en unos minutos.');
    return;
  }
  const data = snap.exists() ? snap.data() : null;
  if (!data || data.kind !== KIND || typeof data.html !== 'string') {
    message('Enlace no válido', `No se encuentra tu ${LABEL}. Pide a tu entrenador que te lo vuelva a enviar.`);
    return;
  }
  const html = sanitize(data.html);
  const first = String(data.clientName || '').split(' ')[0];
  head.innerHTML = `
    <h1 class="q-title">${first ? `${esc(first)}, aquí tienes tu ${esc(LABEL)}` : `Tu ${esc(LABEL)}`}</h1>
    <p class="q-intro">${KIND === 'rutina' ? 'Descárgala en PDF para tenerla' : 'Descárgalo en PDF para tenerlo'} siempre a mano en tu móvil.</p>`;
  pagesBox.innerHTML = html;
  await window.PdfMaker.loadFonts();
  fit();
  window.addEventListener('resize', fit);
  bar.hidden = false;
  btn.onclick = async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    const label = btn.innerHTML;
    btn.innerHTML = '<span class="pdf-spin sm"></span>Creando el PDF…';
    try {
      const blob = await window.PdfMaker.make(html);
      window.PdfMaker.save(blob, window.PdfMaker.fileName(data.title || `${LABEL} ${data.clientName || ''}`));
      btn.innerHTML = '✓ Descargado · búscalo en Descargas';
      setTimeout(() => { btn.innerHTML = label; btn.disabled = false; }, 4000);
    } catch (e) {
      console.error(e);
      btn.innerHTML = 'No se pudo crear. Toca para reintentar';
      btn.disabled = false;
    }
  };
}

start();
