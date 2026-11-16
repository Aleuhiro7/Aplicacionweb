/* Fotos de los clientes.
 * La imagen se comprime y se guarda en IndexedDB de este navegador (cabe mucho más
 * que en localStorage). En los datos generales solo va una ficha pequeña de cada foto
 * (cliente, fecha), para no pasar del límite de la sincronización.
 * Si hay sesión iniciada con Google, cada imagen se sube además a la nube como un
 * documento aparte (ver Sync.uploadPhoto en sync.js), así se ve en otros dispositivos. */
(function () {
  'use strict';

  const DB_NAME = 'entrenapro-photos';
  const STORE_NAME = 'images';
  const MAX_SIDE = 1600; // píxeles del lado mayor
  const MAX_CHARS = 900 * 1024; // tamaño máximo de la imagen en texto (límite de un documento en la nube: 1 MB)

  let dbPromise = null;
  const cache = new Map(); // id -> dataURL

  function openDB() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  async function tx(mode, fn) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE_NAME, mode);
      const req = fn(t.objectStore(STORE_NAME));
      t.oncomplete = () => resolve(req && req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  const putLocal = (id, dataUrl) => tx('readwrite', (s) => s.put(dataUrl, id));
  const getLocal = (id) => tx('readonly', (s) => s.get(id)).catch(() => null);
  const delLocal = (id) => tx('readwrite', (s) => s.delete(id)).catch(() => {});
  const clearLocal = () => tx('readwrite', (s) => s.clear()).catch(() => {});

  /** Carga un archivo de imagen y lo devuelve como JPEG comprimido (dataURL). */
  function compress(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let side = MAX_SIDE;
        let quality = 0.82;
        let out = '';
        for (let i = 0; i < 6; i++) {
          const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.max(1, Math.round(img.naturalWidth * scale));
          const h = Math.max(1, Math.round(img.naturalHeight * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          out = canvas.toDataURL('image/jpeg', quality);
          if (out.length <= MAX_CHARS) break;
          side = Math.round(side * 0.8);
          quality = Math.max(0.55, quality - 0.08);
        }
        resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
      img.src = url;
    });
  }

  const cloud = () => (window.Sync && window.Sync.state && window.Sync.state.user ? window.Sync : null);

  async function uploadToCloud(meta, dataUrl) {
    const s = cloud();
    if (!s || !s.uploadPhoto) return false;
    const ok = await s.uploadPhoto(meta.id, dataUrl, meta.clientId);
    if (ok && Store.get('photos', meta.id)) Store.update('photos', meta.id, { cloud: true });
    return ok;
  }

  /** Comprime y guarda varias fotos de un cliente. Devuelve cuántas se guardaron. */
  async function addFiles(clientId, files, date) {
    let saved = 0;
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await compress(file);
      const meta = Store.add('photos', { clientId, date: date || U.today(), note: '', cloud: false });
      try {
        await putLocal(meta.id, dataUrl);
      } catch (e) {
        Store.remove('photos', meta.id);
        throw new Error('No hay espacio para guardar más fotos en este dispositivo');
      }
      cache.set(meta.id, dataUrl);
      saved++;
      uploadToCloud(meta, dataUrl);
    }
    return saved;
  }

  /** Devuelve la imagen de una foto: de memoria, de este navegador o de la nube. */
  async function src(id) {
    if (cache.has(id)) return cache.get(id);
    let dataUrl = await getLocal(id);
    if (!dataUrl) {
      const s = cloud();
      if (s && s.downloadPhoto) {
        dataUrl = await s.downloadPhoto(id);
        if (dataUrl) putLocal(id, dataUrl).catch(() => {});
      }
    }
    if (dataUrl) cache.set(id, dataUrl);
    return dataUrl || null;
  }

  async function remove(id) {
    cache.delete(id);
    await delLocal(id);
    const s = cloud();
    if (s && s.deletePhoto) s.deletePhoto(id);
    Store.remove('photos', id);
  }

  async function removeForClient(clientId) {
    for (const p of Store.photosFor(clientId)) {
      cache.delete(p.id);
      await delLocal(p.id);
      const s = cloud();
      if (s && s.deletePhoto) s.deletePhoto(p.id);
    }
  }

  async function clearAll() {
    cache.clear();
    await clearLocal();
  }

  /** Sube a la nube las fotos de este dispositivo que aún no estaban subidas. */
  async function uploadPending() {
    if (!cloud()) return;
    for (const meta of Store.data.photos.filter((p) => !p.cloud)) {
      const dataUrl = await getLocal(meta.id);
      if (dataUrl) await uploadToCloud(meta, dataUrl);
    }
  }

  /** Rellena las <img data-photo="id"> que haya en pantalla. */
  function hydrate(root) {
    (root || document).querySelectorAll('img[data-photo]:not([data-loaded])').forEach(async (img) => {
      img.dataset.loaded = '1';
      const dataUrl = await src(img.dataset.photo);
      if (dataUrl) img.src = dataUrl;
      else img.closest('.photo')?.classList.add('missing');
    });
  }

  window.Photos = { addFiles, src, remove, removeForClient, clearAll, uploadPending, hydrate };
})();
