/* Componentes de interfaz: formularios modales, confirmaciones, avisos y gráficos. */
(function () {
  'use strict';

  const { esc } = U;
  const dialog = () => document.getElementById('modal');

  /* ---------- Toast ---------- */
  let toastTimer;
  /** Aviso breve. Con `action` muestra un botón (p. ej. «Deshacer») durante unos segundos más. */
  function toast(message, action) {
    const el = document.getElementById('toast');
    el.textContent = '';
    const text = document.createElement('span');
    text.textContent = message;
    el.appendChild(text);
    if (action) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast-action';
      btn.textContent = action.label;
      btn.onclick = () => { el.classList.remove('show'); action.onClick(); };
      el.appendChild(btn);
    }
    el.classList.toggle('has-action', !!action);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), action ? 6000 : 2600);
  }

  /* ---------- Modal base ---------- */
  function openModal({ title, body, footer, onSubmit, onOpen }) {
    const dlg = dialog();
    const form = document.getElementById('modal-form');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-footer').innerHTML = footer;

    form.onsubmit = (e) => {
      e.preventDefault();
      if (onSubmit) onSubmit(e.submitter);
    };
    dlg.querySelectorAll('[data-close]').forEach((b) => {
      b.onclick = () => dlg.close('cancel');
    });
    if (!dlg.open) dlg.showModal();
    if (onOpen) onOpen(dlg);
    return dlg;
  }

  function closeModal() {
    const dlg = dialog();
    if (dlg.open) dlg.close();
  }

  /* ---------- Formularios ---------- */
  function renderField(f, value) {
    if (f.type === 'section') return `<div class="form-section">${esc(f.label)}</div>`;
    const id = `f-${f.name}`;
    const req = f.required ? 'required' : '';
    const full = f.full || f.type === 'textarea' ? ' full' : '';
    const v = value === undefined || value === null ? (f.default ?? '') : value;
    const hint = f.hint ? `<div class="hint">${esc(f.hint)}</div>` : '';
    const label = `<label for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>`;
    let input;

    switch (f.type) {
      case 'textarea':
        input = `<textarea id="${id}" name="${f.name}" ${req} placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
        break;
      case 'select':
        input = `<select id="${id}" name="${f.name}" ${req}>` +
          (f.placeholder ? `<option value="">${esc(f.placeholder)}</option>` : '') +
          f.options.map((o) => {
            const ov = typeof o === 'object' ? o.value : o;
            const ol = typeof o === 'object' ? o.label : o;
            return `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`;
          }).join('') +
          `</select>`;
        break;
      case 'checkbox':
        return `<div class="field check${full}"><label><input type="checkbox" id="${id}" name="${f.name}" ${v ? 'checked' : ''}> ${esc(f.label)}</label>${hint}</div>`;
      default: {
        const extra = [
          f.step ? `step="${f.step}"` : '',
          f.min !== undefined ? `min="${f.min}"` : '',
          f.max !== undefined ? `max="${f.max}"` : '',
          f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '',
          f.type === 'number' ? 'inputmode="decimal"' : '',
        ].join(' ');
        input = `<input type="${f.type || 'text'}" id="${id}" name="${f.name}" value="${esc(v)}" ${req} ${extra}>`;
      }
    }
    return `<div class="field${full}" data-field="${f.name}">${label}${input}${hint}</div>`;
  }

  function readForm(fields) {
    const out = {};
    for (const f of fields) {
      if (f.type === 'section') continue;
      const el = document.getElementById(`f-${f.name}`);
      if (!el) continue;
      if (f.type === 'checkbox') out[f.name] = el.checked;
      else if (f.type === 'number') out[f.name] = el.value === '' ? '' : Number(el.value);
      else out[f.name] = el.value.trim();
    }
    return out;
  }

  function validate(fields, values) {
    let firstBad = null;
    document.querySelectorAll('#modal-body .field').forEach((el) => {
      el.classList.remove('invalid');
      el.querySelector('.error')?.remove();
    });
    for (const f of fields) {
      if (f.type === 'section') continue;
      const el = document.getElementById(`f-${f.name}`);
      let msg = '';
      if (f.required && (values[f.name] === '' || values[f.name] === undefined)) msg = 'Campo obligatorio';
      else if (el && el.validity && !el.validity.valid) msg = el.validationMessage || 'Valor no válido';
      if (msg) {
        const wrap = el.closest('.field');
        wrap.classList.add('invalid');
        wrap.insertAdjacentHTML('beforeend', `<div class="error">${esc(msg)}</div>`);
        firstBad = firstBad || el;
      }
    }
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  /**
   * Abre un formulario modal.
   * onSubmit(values) se llama con los valores validados; devolver false mantiene el modal abierto.
   */
  function form({ title, fields, values = {}, submitLabel = 'Guardar', onSubmit, onDelete }) {
    const body = `<div class="form-grid">${fields.map((f) => renderField(f, values[f.name])).join('')}</div>`;
    const footer =
      (onDelete ? `<button type="button" class="btn danger" id="modal-delete" style="margin-right:auto">Eliminar</button>` : '') +
      `<button type="button" class="btn" data-close>Cancelar</button>` +
      `<button type="submit" class="btn primary">${esc(submitLabel)}</button>`;

    openModal({
      title,
      body,
      footer,
      onSubmit: () => {
        const v = readForm(fields);
        if (!validate(fields, v)) return;
        if (onSubmit(v) !== false) closeModal();
      },
      onOpen: (dlg) => {
        const first = dlg.querySelector('#modal-body input, #modal-body select, #modal-body textarea');
        if (first) first.focus();
        const del = document.getElementById('modal-delete');
        if (del) del.onclick = () => { closeModal(); onDelete(); };
      },
    });
  }

  function confirm({ title, message, confirmLabel = 'Eliminar', danger = true }) {
    return new Promise((resolve) => {
      let answered = false;
      const dlg = openModal({
        title,
        body: `<p style="margin:0">${message}</p>`,
        footer:
          `<button type="button" class="btn" data-close>Cancelar</button>` +
          `<button type="submit" class="btn ${danger ? 'danger-solid' : 'primary'}">${esc(confirmLabel)}</button>`,
        onSubmit: () => { answered = true; closeModal(); resolve(true); },
      });
      dlg.addEventListener('close', () => { if (!answered) resolve(false); }, { once: true });
    });
  }

  /* ---------- Gráfico de líneas (SVG) ---------- */
  let chartSeq = 0;
  function lineChart(points, { unit = '', height = 220 } = {}) {
    const pts = points.filter((p) => p.y !== '' && p.y !== null && !isNaN(p.y));
    if (pts.length < 2) {
      return `<div class="empty">Se necesitan al menos dos registros para mostrar la evolución.</div>`;
    }
    const W = 640, H = height, padL = 44, padR = 16, padT = 22, padB = 30;
    const xs = pts.map((p) => U.parseDate(p.x).getTime());
    const ys = pts.map((p) => Number(p.y));
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    let minY = Math.min(...ys), maxY = Math.max(...ys);
    const spread = maxY - minY || Math.max(1, Math.abs(maxY) * 0.05);
    minY -= spread * 0.15;
    maxY += spread * 0.15;

    const sx = (x) => padL + (maxX === minX ? 0.5 : (x - minX) / (maxX - minX)) * (W - padL - padR);
    const sy = (y) => padT + (1 - (y - minY) / (maxY - minY)) * (H - padT - padB);

    const ticks = 4;
    let grid = '';
    for (let i = 0; i <= ticks; i++) {
      const val = minY + ((maxY - minY) * i) / ticks;
      const y = sy(val);
      grid += `<line class="grid-line" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"/>`;
      grid += `<text class="axis-label" x="${padL - 6}" y="${y + 4}" text-anchor="end">${U.fmtNum(val, 1)}</text>`;
    }

    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(xs[i]).toFixed(1)},${sy(ys[i]).toFixed(1)}`).join(' ');
    const step = Math.ceil(pts.length / 6);
    let dots = '';
    pts.forEach((p, i) => {
      const cx = sx(xs[i]), cy = sy(ys[i]);
      dots += `<circle class="dot" cx="${cx}" cy="${cy}" r="4"><title>${U.fmtDate(p.x)}: ${U.fmtNum(p.y, 1)} ${esc(unit)}</title></circle>`;
      const isLast = i === pts.length - 1;
      if (i % step === 0 || isLast) {
        const ta = i === 0 ? 'start' : isLast ? 'end' : 'middle';
        dots += `<text class="axis-label" x="${cx}" y="${H - 8}" text-anchor="${ta}">${U.fmtDateShort(p.x)}</text>`;
      }
      if (i === 0 || isLast) {
        dots += `<text class="value-label" x="${cx}" y="${cy - 10}" text-anchor="${anchor(i, pts.length)}">${U.fmtNum(p.y, 1)}</text>`;
      }
    });

    const gid = `chart-fill-${++chartSeq}`;
    const area = `${path} L${sx(xs[xs.length - 1]).toFixed(1)},${H - padB} L${sx(xs[0]).toFixed(1)},${H - padB} Z`;
    const defs = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop class="grad-stop" offset="0" stop-opacity=".28"/><stop class="grad-stop" offset="1" stop-opacity="0"/></linearGradient></defs>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución en ${esc(unit)}">${defs}${grid}<path d="${area}" fill="url(#${gid})"/><path class="line" d="${path}"/>${dots}</svg>`;
  }

  function anchor(i, n) { return i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'; }

  window.UI = { toast, openModal, closeModal, form, confirm, lineChart };
})();
