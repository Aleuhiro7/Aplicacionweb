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
    return moneyFormatters[cur].format(Number(amount) || 0);
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

  window.U = {
    pad, toISODate, parseDate, today, addDays, startOfWeek, daysBetween, age,
    fmtDate, fmtDateShort, fmtWeekday, fmtWeekdayShort, relativeDay, fmtMoney, fmtNum,
    esc, uid, initials, avatar,
  };
})();
