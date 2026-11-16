/* Utilidades generales: fechas, formato, escape de HTML. */
(function () {
  'use strict';

  const pad = (n) => String(n).padStart(2, '0');

  /** Fecha local en formato YYYY-MM-DD. */
  function toISODate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** Convierte YYYY-MM-DD en Date local (sin desfase de zona horaria). */
  function parseDate(s) {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function today() { return toISODate(new Date()); }

  function addDays(iso, n) {
    const d = parseDate(iso);
    d.setDate(d.getDate() + n);
    return toISODate(d);
  }

  /** Suma meses a una fecha YYYY-MM-DD (si el día no existe, usa el último del mes). */
  function addMonths(iso, n) {
    const d = parseDate(iso);
    const day = d.getDate();
    const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, last));
    return toISODate(target);
  }

  /** Lunes de la semana de la fecha dada. */
  function startOfWeek(iso) {
    const d = parseDate(iso);
    const day = (d.getDay() + 6) % 7; // 0 = lunes
    d.setDate(d.getDate() - day);
    return toISODate(d);
  }

  function daysBetween(a, b) {
    return Math.round((parseDate(b) - parseDate(a)) / 86400000);
  }

  function age(birthISO) {
    if (!birthISO) return null;
    const b = parseDate(birthISO);
    const now = new Date();
    let a = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
    return a;
  }

  const dateFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });
  const dateShortFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
  const weekdayFmt = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });
  const weekdayShortFmt = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short' });

  function fmtDate(iso) { return iso ? dateFmt.format(parseDate(iso)) : '—'; }
  function fmtDateShort(iso) { return iso ? dateShortFmt.format(parseDate(iso)) : '—'; }
  function fmtWeekday(iso) { return weekdayFmt.format(parseDate(iso)); }
  function fmtWeekdayShort(iso) { return weekdayShortFmt.format(parseDate(iso)); }

  function relativeDay(iso) {
    const diff = daysBetween(today(), iso);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Mañana';
    if (diff === -1) return 'Ayer';
    return fmtWeekdayShort(iso);
  }

  const moneyFormatters = {};
  function fmtMoney(amount, currency) {
    const cur = currency || 'EUR';
    if (!moneyFormatters[cur]) {
      try {
        moneyFormatters[cur] = new Intl.NumberFormat('es', { style: 'currency', currency: cur });
      } catch (e) {
        moneyFormatters[cur] = new Intl.NumberFormat('es', { style: 'currency', currency: 'EUR' });
      }
    }
    const n = Number(amount) || 0;
    const key = cur + (Number.isInteger(n) ? ':int' : '');
    if (Number.isInteger(n) && !moneyFormatters[key]) {
      const base = moneyFormatters[cur].resolvedOptions().currency;
      moneyFormatters[key] = new Intl.NumberFormat('es', { style: 'currency', currency: base, minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    return moneyFormatters[key].format(n);
  }

  function fmtNum(n, digits = 1) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
    return Number(n).toLocaleString('es', { maximumFractionDigits: digits });
  }

  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  /** Enlace para abrir el chat de WhatsApp con un teléfono (añade +34 a los móviles españoles sin prefijo). */
  function waLink(phone) {
    let digits = String(phone || '').replace(/[^\d+]/g, '');
    if (!digits) return '';
    if (digits.startsWith('+')) digits = digits.slice(1);
    else if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.length === 9 && /^[6789]/.test(digits)) digits = '34' + digits;
    return digits.length >= 8 ? `https://wa.me/${digits}` : '';
  }

  function initials(name) {
    return (name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  const AVATAR_COLORS = ['#0f766e', '#7c3aed', '#c2410c', '#1d4ed8', '#be185d', '#15803d', '#a16207', '#0e7490'];
  function avatarColor(seed) {
    let h = 0;
    for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  function avatar(client, size) {
    const cls = size === 'lg' ? 'avatar lg' : 'avatar';
    return `<span class="${cls}" style="background:${avatarColor(client.id)}" aria-hidden="true">${esc(initials(client.name))}</span>`;
  }

  /* Iconos de trazo (estilo Lucide, 24x24). */
  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z"/>',
    euro: '<path d="M18 7a7 7 0 1 0 0 10M4 10h10M4 14h10"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M9 7h7M9 11h5"/>',
    apple: '<path d="M12 6.5c-1.5-1.3-3.6-1.7-5.4-.9C4.2 6.7 3 9.4 3.5 12.6c.6 3.9 3.3 8.4 6.1 8.4 1 0 1.5-.5 2.4-.5s1.4.5 2.4.5c2.8 0 5.5-4.5 6.1-8.4.5-3.2-.7-5.9-3.1-7-1.8-.8-3.9-.4-5.4.9Z"/><path d="M12 6.5c0-2 1-3.5 3-4.5"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    back: '<path d="m12 19-7-7 7-7M19 12H5"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    trend: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    done: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2"/>',
    note: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8M10 9H8"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    logo: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  };
  function icon(name, cls) {
    return `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  window.U = {
    icon,
    pad, toISODate, parseDate, today, addDays, addMonths, startOfWeek, daysBetween, age,
    fmtDate, fmtDateShort, fmtWeekday, fmtWeekdayShort, relativeDay, fmtMoney, fmtNum,
    esc, uid, initials, avatar, waLink,
  };
})();
