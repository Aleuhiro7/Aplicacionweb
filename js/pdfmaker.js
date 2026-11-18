/* Crea PDFs A4 a partir de las hojas de la app (dieta y rutina).
 * Cada página (.ds-page) se convierte en imagen con html-to-image y se monta un PDF con ellas,
 * así sale igual en cualquier móvil (sin pasar por «Imprimir»).
 * Lo usan la app (para preparar la hoja) y las páginas que abre el cliente (rutina.html, dieta.html). */
(function () {
  let libReady = null;
  function loadLib() {
    if (window.htmlToImage) return Promise.resolve();
    if (!libReady) {
      libReady = new Promise((res, rej) => {
        const sc = document.createElement('script');
        sc.src = 'js/vendor/html-to-image.js';
        sc.onload = res;
        sc.onerror = () => { libReady = null; rej(new Error('No se pudo cargar el generador de PDF')); };
        document.head.appendChild(sc);
      });
    }
    return libReady;
  }

  /** Carga ya todas las letras de las hojas: si se mide o se dibuja con otra fuente, sale descolocado. */
  async function loadFonts() {
    if (!document.fonts) return;
    const list = ['400', '500', '600', '700', '800'].map((w) => `${w} 12px Archivo`)
      .concat(['600', '700', '800'].map((w) => `${w} 12px "Barlow Condensed"`), ['400 12px Anton']);
    await Promise.all(list.map((f) => document.fonts.load(f))).catch(() => {});
    await document.fonts.ready;
  }

  /** Monta la hoja fuera de la vista (tamaño real A4) para medirla o convertirla. */
  async function stage(html, prepare) {
    const el = document.createElement('div');
    el.className = 'pdf-stage';
    el.innerHTML = html;
    document.body.appendChild(el);
    await loadFonts();
    if (prepare) prepare(el);
    return el;
  }

  /** HTML de la hoja ya preparada (por ejemplo, la rutina con el tamaño de cada día ajustado). */
  async function prepared(html, prepare) {
    const el = await stage(html, prepare);
    const out = el.innerHTML;
    el.remove();
    return out;
  }

  function bytes(dataUrl) {
    const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /** PDF mínimo: una imagen JPEG a página completa (A4) por página. */
  function jpegsToPdf(pages) {
    const enc = new TextEncoder();
    const parts = []; const offsets = []; let len = 0;
    const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
    const W = 595.28, H = 841.89;
    const n = pages.length;
    push('%PDF-1.4\n');
    obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`));
    pages.forEach((pg, i) => {
      const pId = 3 + i * 3, cId = pId + 1, iId = pId + 2;
      obj(pId, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${iId} 0 R >> >> /Contents ${cId} 0 R >>`));
      const content = `q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`;
      obj(cId, () => { push(`<< /Length ${content.length} >>\nstream\n`); push(content); push('\nendstream'); });
      obj(iId, () => {
        push(`<< /Type /XObject /Subtype /Image /Width ${pg.w} /Height ${pg.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>\nstream\n`);
        push(pg.jpeg); push('\nendstream');
      });
    });
    const total = 3 + n * 3;
    const xref = len;
    push(`xref\n0 ${total}\n0000000000 65535 f \n`);
    for (let k = 1; k < total; k++) push(`${String(offsets[k]).padStart(10, '0')} 00000 n \n`);
    push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(parts, { type: 'application/pdf' });
  }

  /** Convierte una hoja (HTML ya preparado) en un PDF. */
  async function make(html) {
    await loadLib();
    const el = await stage(html);
    try {
      await Promise.all([...el.querySelectorAll('img')].map((im) => (im.complete ? null : new Promise((res) => { im.onload = im.onerror = res; }))));
      const pagesEl = [...el.querySelectorAll('.ds-page')];
      const box = pagesEl[0].getBoundingClientRect();
      const opts = { quality: 0.9, pixelRatio: 2, width: box.width, height: box.height, backgroundColor: '#121722', cacheBust: false };
      try { opts.fontEmbedCSS = await window.htmlToImage.getFontEmbedCSS(pagesEl[0]); } catch (e) { /* sin fuentes incrustadas */ }
      const pages = [];
      for (const p of pagesEl) {
        const url = await window.htmlToImage.toJpeg(p, opts);
        pages.push({ jpeg: bytes(url), w: Math.round(box.width * 2), h: Math.round(box.height * 2) });
      }
      return jpegsToPdf(pages);
    } finally {
      el.remove();
    }
  }

  /** Nombre de archivo sin tildes ni símbolos (algunos navegadores ignoran el nombre si los lleva). */
  function fileName(title) {
    const clean = String(title || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 _-]/gi, '').trim();
    return `${clean.replace(/\b\w/g, (m) => m.toUpperCase()) || 'Plan'}.pdf`;
  }

  function save(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 1000);
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }

  window.PdfMaker = { make, prepared, save, fileName, loadFonts };
})();
