/* Estudio del entrenamiento: lo comparten la app de gestión (PDF en la pestaña Entrenos) y la app de entrenamiento
 * del cliente (apartado «Estudio»). Calcula constancia, carga de trabajo y evolución de cada ejercicio a partir de los
 * entrenos apuntados, escribe las conclusiones hablándole al cliente y dibuja las gráficas (SVG).
 * Entrada: TrainingStudy.compute({ name, startDate, routineDays: [{ name, exercises: [{ name }] }], subir }, entrenos, semanas). */
(function () {
  'use strict';
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const U = {
    parseDate: (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d, 12); },
    toISODate: iso,
    addDays: (s, n) => { const d = U.parseDate(s); d.setDate(d.getDate() + n); return iso(d); },
    daysBetween: (a, b) => Math.round((U.parseDate(b) - U.parseDate(a)) / 864e5),
  };
  const today = () => iso(new Date());
  const fmtNum = (n, dec) => Number(n || 0).toLocaleString('es-ES', { maximumFractionDigits: dec == null ? 1 : dec });
  const plural = (n, one, many) => `${fmtNum(n, 1)} ${n === 1 ? one : many}`;
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const normName = (n) => String(n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const mins = (m) => { const v = Math.round(m || 0); return v < 60 ? `${v} min` : `${Math.floor(v / 60)} h ${pad(v % 60)} min`; };

  const ST_BLUE = '#6e8bff';
  const ST_STATUS = { mejorando: ['#3ee6a0', 'Mejorando'], estable: ['#94a3b8', 'Estable'], estancado: ['#fbbf24', 'Estancado'], bajando: ['#f87171', 'Bajando'], pocos: ['#64748b', 'Pocos datos'] };
  const e1rm = (kg, reps) => (kg > 0 && reps > 0 ? kg * (1 + Math.min(reps, 15) / 30) : 0);
  /** Medida de fuerza de una serie: 1RM estimado; con peso corporal (0 kg), las repeticiones. */
  const strength = (kg, reps) => (kg > 0 ? e1rm(kg, reps) : reps > 0 ? reps : 0);
  const setTxt = (x) => (x.kg > 0 ? `${kgTxt(x.kg)} × ${x.reps}` : `${x.reps} rep. (peso corporal)`);
  const kgTxt = (n) => `${fmtNum(Math.round(n * 10) / 10)} kg`;
  const mondayOf = (iso) => { const d = U.parseDate(iso); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return U.toISODate(d); };
  const shortDate = (iso) => { const d = U.parseDate(iso); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };

  /** Todo el estudio: números por semana, por día de la rutina y por ejercicio, y las conclusiones. */
  function trainingStudy(c, all, W) {
    const t = today();
    const from = U.addDays(mondayOf(t), -7 * (W - 1));
    const list = (all || []).filter((w) => w.date && w.date >= from && w.date <= t).sort((a, b) => (a.date < b.date ? -1 : 1));
    const rDays = (c.routineDays || []).filter((d) => (d.exercises || []).length);
    const done = (e) => (e.sets || []).filter((x) => x.done);
    const vol = (e) => done(e).reduce((n, x) => n + (Number(x.kg) || 0) * (Number(x.reps) || 0), 0);
    // Semanas (de lunes a domingo)
    const weeks = Array.from({ length: W }, (_, i) => { const s = U.addDays(from, 7 * i); return { start: s, n: 0, vol: 0, sets: 0, planned: 0, min: 0 }; });
    for (const w of list) {
      const wk = weeks[Math.floor(U.daysBetween(from, w.date) / 7)];
      if (!wk) continue;
      wk.n++; wk.min += (w.durationSec || 0) / 60;
      for (const e of w.exercises || []) { wk.vol += vol(e); wk.sets += done(e).length; wk.planned += (e.sets || []).length; }
    }
    // Semanas que cuentan: desde que empezó (alta o primer entreno), para no penalizar las anteriores.
    const oldest = (all || []).reduce((m, w) => (w.date && w.date < m ? w.date : m), t);
    const startAt = [oldest, c.startDate].filter(Boolean).sort()[0];
    const activeWeeks = weeks.filter((wk) => U.addDays(wk.start, 6) >= startAt);
    const effW = Math.max(1, activeWeeks.length - (U.daysBetween(mondayOf(t), t) < 3 ? 0.5 : 0));
    const trainedDays = new Set(list.map((w) => w.date));
    // Por día de la rutina
    const porDia = rDays.map((d, i) => { const nm = normName(d.name || `Día ${i + 1}`); const ws = list.filter((w) => normName(w.dayName) === nm); return { dia: d.name || `Día ${i + 1}`, veces: ws.length, ultimo: ws.length ? ws[ws.length - 1].date : null }; });
    // Por ejercicio
    const byEx = new Map();
    for (const w of list) for (const e of w.exercises || []) {
      const ss = done(e).map((x) => ({ kg: Number(x.kg) || 0, reps: Number(x.reps) || 0 }));
      if (!ss.length) continue;
      const best = ss.reduce((a, x) => (strength(x.kg, x.reps) > strength(a.kg, a.reps) ? x : a), ss[0]);
      const k = normName(e.name);
      if (!byEx.has(k)) byEx.set(k, { name: e.name, ses: [] });
      byEx.get(k).ses.push({ date: w.date, best, f: strength(best.kg, best.reps), vol: vol(e), sets: ss });
    }
    let prs = 0;
    const exercises = [...byEx.values()].map(({ name, ses }) => {
      const f = ses.map((x) => x.f);
      const valid = f.filter((x) => x > 0);
      let run = 0; f.forEach((x, i) => { if (i && x > Math.max(...f.slice(0, i))) run++; });
      prs += run;
      const first = valid[0] || 0; const last = valid[valid.length - 1] || 0;
      // Estancado: sesiones desde la PRIMERA vez que llegó a su mejor marca (repetir el mismo peso no cuenta como mejorar).
      const peak = Math.max(0, ...f); const pi = peak ? f.indexOf(peak) : -1;
      const since = pi >= 0 ? f.length - 1 - pi : 0;
      const pct = first ? Math.round(((last - first) / first) * 100) : null;
      const status = valid.length < 2 ? 'pocos' : pct != null && pct < -5 ? 'bajando' : since >= 3 && valid.length >= 4 ? 'estancado' : pct != null && pct > 2 ? 'mejorando' : 'estable';
      return { name, ses, status, pct, since, prs: run, peak: pi >= 0 ? ses[pi] : null, first: ses[0], last: ses[ses.length - 1], kgDiff: ses[ses.length - 1].best.kg - ses[0].best.kg };
    }).sort((a, b) => b.ses.length - a.ses.length || a.name.localeCompare(b.name, 'es'));
    const enRutina = rDays.flatMap((d) => (d.exercises || []).map((e) => e.name));
    const noHechos = [...new Set(enRutina)].filter((n) => !byEx.has(normName(n)));
    const totalSets = list.reduce((n, w) => n + (w.exercises || []).reduce((m, e) => m + done(e).length, 0), 0);
    const planned = list.reduce((n, w) => n + (w.exercises || []).reduce((m, e) => m + (e.sets || []).length, 0), 0);
    const totalReps = list.reduce((n, w) => n + (w.exercises || []).reduce((m, e) => m + done(e).reduce((k, x) => k + (Number(x.reps) || 0), 0), 0), 0);
    const totalVol = weeks.reduce((n, wk) => n + wk.vol, 0);
    const gaps = list.slice(1).map((w, i) => U.daysBetween(list[i].date, w.date));
    const lastW = (all || []).filter((w) => w.date).sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;
    const perWeek = list.length / effW;
    const target = rDays.length || null;
    const adherence = target ? Math.min(100, Math.round((perWeek / target) * 100)) : null;
    const count = (s) => exercises.filter((e) => e.status === s).length;
    const half = Math.floor(activeWeeks.length / 2);
    const volA = half ? activeWeeks.slice(0, half).reduce((n, wk) => n + wk.vol, 0) / half : 0;
    const volB = half ? activeWeeks.slice(half).reduce((n, wk) => n + wk.vol, 0) / (activeWeeks.length - half) : 0;
    const volTrend = volA ? Math.round(((volB - volA) / volA) * 100) : null;
    const st = { c, W, from, list, weeks, activeWeeks, trainedDays, porDia, exercises, noHechos, totalSets, planned, totalReps, totalVol, gaps, lastW, perWeek, target, adherence, prs,
      counts: { mejorando: count('mejorando'), estable: count('estable'), estancado: count('estancado'), bajando: count('bajando'), pocos: count('pocos') },
      durMin: list.length ? list.reduce((n, w) => n + (w.durationSec || 0), 0) / list.length / 60 : 0,
      setsPct: planned ? Math.round((totalSets / planned) * 100) : null, volTrend,
      subir: c.subir || [] };
    st.notes = studyNotes(st);
    return st;
  }

  /** Conclusiones y recomendaciones, por escrito y hablándole al cliente (de tú), como si se lo dijera David. Sin IA. */
  function studyNotes(st) {
    const first = st.c.name.split(' ')[0];
    const out = { constancia: [], progreso: [], recomendaciones: [] };
    const since = st.lastW ? U.daysBetween(st.lastW.date, today()) : null;
    const pw = fmtNum(Math.round(st.perWeek * 10) / 10);
    const veces = (n) => (n === 1 ? 'vez' : 'veces');
    if (st.target) {
      out.constancia.push(`${first}, ${st.W === 1 ? 'esta semana' : `en estas ${st.W} semanas`} has entrenado ${st.list.length} ${veces(st.list.length)}, una media de ${pw} por semana. Tu rutina tiene ${plural(st.target, 'día', 'días')}: ${st.adherence >= 90 ? 'cumples prácticamente todo lo planificado' : st.adherence >= 70 ? 'cumples la mayor parte, aunque se te escapa algún entreno' : st.adherence >= 40 ? 'haces más o menos la mitad de lo planificado' : 'estás entrenando bastante menos de lo planificado'} (${st.adherence} %).`);
    } else out.constancia.push(`${first}, ${st.W === 1 ? 'esta semana' : `en estas ${st.W} semanas`} has entrenado ${st.list.length} ${veces(st.list.length)}, una media de ${pw} por semana.`);
    const maxGap = st.gaps.length ? Math.max(...st.gaps) : 0;
    if (maxGap >= 10) out.constancia.push(`Tu parón más largo ha sido de ${maxGap} días.`);
    const low = st.porDia.filter((d) => st.porDia.length > 1 && d.veces < Math.max(...st.porDia.map((x) => x.veces)) * 0.5);
    if (low.length) out.constancia.push(`Haces mucho menos ${low.map((d) => `«${d.dia}» (${plural(d.veces, 'vez', 'veces')})`).join(' y ')} que el resto de días de tu rutina.`);
    if (st.setsPct != null) out.constancia.push(st.setsPct >= 95 ? `Completas el ${st.setsPct} % de tus series: no dejas trabajo a medias.` : `Completas el ${st.setsPct} % de las series que tienes programadas.`);
    const ups = st.exercises.filter((e) => e.status === 'mejorando').sort((a, b) => (b.pct || 0) - (a.pct || 0));
    const stuck = st.exercises.filter((e) => e.status === 'estancado');
    const down = st.exercises.filter((e) => e.status === 'bajando');
    if (ups.length) out.progreso.push(`Estás mejorando en ${plural(ups.length, 'ejercicio', 'ejercicios')}. Lo más destacado: ${ups.slice(0, 3).map((e) => `${e.name} (de ${setTxt(e.first.best)} a ${setTxt(e.last.best)}, +${e.pct} %)`).join('; ')}.`);
    if (st.prs) out.progreso.push(`Has batido tu mejor marca ${plural(st.prs, 'vez', 'veces')} en este tiempo.`);
    if (stuck.length) out.progreso.push(`Te has estancado (3 sesiones o más sin superar tu mejor marca) en: ${stuck.map((e) => e.name).join(', ')}.`);
    if (down.length) out.progreso.push(`Estás perdiendo algo de fuerza en: ${down.map((e) => `${e.name} (${e.pct} %)`).join(', ')}.`);
    if (st.volTrend != null && Math.abs(st.volTrend) >= 5) out.progreso.push(`Tu volumen de trabajo (kilos × repeticiones) ${st.volTrend > 0 ? 'ha subido' : 'ha bajado'} un ${Math.abs(st.volTrend)} % en la segunda mitad de este periodo.`);
    if (!out.progreso.length) out.progreso.push('Todavía no hay suficientes sesiones repetidas para ver una tendencia clara. Sigue apuntando tus pesos.');
    // Recomendaciones, para el cliente
    if (st.target && st.adherence < 70) out.recomendaciones.push(`Intenta llegar a tus ${st.target} días por semana. Si no te encajan, dímelo y ajustamos la rutina a ${Math.max(2, Math.round(st.perWeek))} días.`);
    if (since != null && since > 7) out.recomendaciones.push(`Llevas ${since} días sin entrenar: retómalo esta semana, aunque sea con un entreno más corto.`);
    for (const d of low) out.recomendaciones.push(`Te estás saltando «${d.dia}». Si ese día te cuesta (horario, material…), cuéntamelo y lo cambiamos.`);
    for (const e of stuck.slice(0, 4)) out.recomendaciones.push(`${e.name}: llevas varias sesiones sin superar ${setTxt(e.peak.best)}. Intenta sumar una repetición antes de subir el peso.`);
    if (down.length >= 2) out.recomendaciones.push('Varios ejercicios están bajando a la vez: cuida el descanso y el sueño, y avísame si te notas más cansado de lo normal.');
    else for (const e of down) out.recomendaciones.push(`${e.name}: estás perdiendo algo de fuerza. Cuida la técnica y dime si notas alguna molestia.`);
    for (const x of st.subir.slice(0, 4)) out.recomendaciones.push(`${x.ex}: toca subir el peso en la serie ${x.serie}.`);
    if (st.noHechos.length) out.recomendaciones.push(`No has apuntado nunca: ${st.noHechos.slice(0, 6).join(', ')}${st.noHechos.length > 6 ? ' y otros' : ''}. Apúntalos en la app o dime si no los haces para cambiarlos.`);
    if (ups.length && !stuck.length && !down.length && (!st.target || st.adherence >= 80)) out.recomendaciones.push('Vas muy bien: sigue así, con la misma constancia y subiendo cargas poco a poco.');
    if (!out.recomendaciones.length) out.recomendaciones.push('Sigue así y en unas semanas volvemos a revisar tu progreso.');
    return out;
  }

  /* --- Gráficas (SVG, una sola serie cada una; la tabla o el texto acompañan siempre) --- */
  function stBars(vals, labels, { h = 220, w = 680, target = null, targetLabel = '', fmt = (v) => fmtNum(v), color = ST_BLUE } = {}) {
    const W = w; const padL = 40; const padB = 26; const padT = 22; const n = vals.length;
    const top0 = Math.max(1, target || 0, ...vals);
    const raw = top0 / 3; const mag = 10 ** Math.floor(Math.log10(raw)); const nn = raw / mag;
    const stepV = Math.max(vals.every(Number.isInteger) ? 1 : 0, (nn <= 1 ? 1 : nn <= 2 ? 2 : nn <= 5 ? 5 : 10) * mag);
    const max = Math.max(top0 * 1.12, stepV * 3);
    const step = (W - padL - 8) / n; const bw = Math.min(38, step - 6);
    const y = (v) => padT + (h - padT - padB) * (1 - v / max);
    const ticks = []; for (let v = 0; v <= max * 0.92; v += stepV) ticks.push(v);
    const peak = vals.indexOf(Math.max(...vals));
    let s = `<svg class="st-chart" viewBox="0 0 ${W} ${h}" role="img">`;
    s += ticks.map((v) => `<line x1="${padL}" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}" class="st-grid"/><text x="${padL - 6}" y="${y(v) + 4}" class="st-ax" text-anchor="end">${fmt(v)}</text>`).join('');
    vals.forEach((v, i) => {
      const x = padL + step * i + (step - bw) / 2; const top = y(v); const base = y(0); const r = Math.min(4, (base - top) / 2);
      if (v > 0) s += `<path d="M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z" fill="${color}"><title>${esc(labels[i])}: ${esc(fmt(v))}</title></path>`;
      if (i % Math.ceil(n / (W < 500 ? 6 : 12)) === 0) s += `<text x="${x + bw / 2}" y="${h - 8}" class="st-ax" text-anchor="middle">${esc(labels[i])}</text>`;
      if ((i === peak || i === n - 1) && v > 0) s += `<text x="${x + bw / 2}" y="${top - 6}" class="st-val" text-anchor="middle">${esc(fmt(v))}</text>`;
    });
    s += `<line x1="${padL}" x2="${W - 4}" y1="${y(0)}" y2="${y(0)}" class="st-base"/>`;
    if (target) s += `<line x1="${padL}" x2="${W - 4}" y1="${y(target)}" y2="${y(target)}" class="st-target"/><text x="${W - 6}" y="${y(target) - 6}" class="st-tlabel" text-anchor="end">${esc(targetLabel)}</text>`;
    return s + '</svg>';
  }
  function stSpark(ses, color) {
    const W = 260; const H = 64; const p = 6;
    const pts = ses.filter((x) => x.f > 0);
    if (pts.length < 2) return '<div class="st-spark-empty">Hace falta más de una sesión</div>';
    const min = Math.min(...pts.map((x) => x.f)); const max = Math.max(...pts.map((x) => x.f));
    const sx = (i) => p + ((W - 2 * p) * i) / (pts.length - 1);
    const sy = (v) => (max === min ? H / 2 : p + (H - 2 * p) * (1 - (v - min) / (max - min)));
    const d = pts.map((x, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(x.f).toFixed(1)}`).join(' ');
    const pk = pts.map((x) => x.f).lastIndexOf(max);
    const dot = (i, big) => `<circle cx="${sx(i).toFixed(1)}" cy="${sy(pts[i].f).toFixed(1)}" r="${big ? 4 : 3}" fill="${color}" stroke="#121722" stroke-width="2"><title>${esc(shortDate(pts[i].date))}: ${esc(setTxt(pts[i].best))}</title></circle>`;
    return `<svg class="st-spark" viewBox="0 0 ${W} ${H}" role="img"><path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dot(0)}${pk !== 0 && pk !== pts.length - 1 ? dot(pk, true) : ''}${dot(pts.length - 1, true)}</svg>`;
  }


  window.TrainingStudy = { compute: trainingStudy, bars: stBars, spark: stSpark, STATUS: ST_STATUS, BLUE: ST_BLUE, setTxt, kgTxt, shortDate, mins, fmtNum, plural, esc };
})();
