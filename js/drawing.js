/* Dibujo plano de los ejercicios: figura musculada en 2D (sin relieve), con contorno, líneas de
 * los músculos y los músculos trabajados coloreados. Dos posiciones fijas: inicio y final.
 * Usa las plantillas de movimiento de js/avatars.js. */
(function () {
  'use strict';
  if (!window.Avatar) return;
  const A = window.Avatar;
  // Figura clara de un solo tono, contorno oscuro y líneas suaves; material en gris metal y negro.
  const COL = { body: '#e4e9f0', far: '#c7cfda', line: '#a9b3c1', ink: '#273040', steel: '#9aa4b2', iron: '#2a313d', pad: '#33405a', padEdge: '#1d2533', frame: '#56627a', shadow: 'rgba(30,40,60,.13)' };

  /* Perfiles musculares de cada segmento: anchura hacia delante (f) y hacia atrás (b) a lo largo
   * del segmento (t de 0 a 1). Valores en unidades del lienzo. */
  const PROF = {
    ua: { f: [[-0.08, 2.4], [0.1, 3.3], [0.32, 2.7], [0.55, 3.3], [0.82, 2.4], [1.04, 1.9]], b: [[-0.08, 2.8], [0.15, 3.4], [0.42, 3.5], [0.75, 2.6], [1.04, 2.0]] },
    fa: { f: [[-0.04, 2.0], [0.22, 2.9], [0.6, 1.9], [1.02, 1.3]], b: [[-0.04, 2.2], [0.2, 3.0], [0.62, 2.0], [1.02, 1.3]] },
    th: { f: [[-0.05, 4.2], [0.3, 4.6], [0.65, 4.1], [0.86, 3.4], [1.03, 2.5]], b: [[-0.05, 4.3], [0.25, 4.3], [0.55, 3.9], [0.85, 2.9], [1.03, 2.5]] },
    sh: { f: [[-0.03, 2.3], [0.3, 2.1], [0.72, 1.7], [1.02, 1.3]], b: [[-0.03, 2.5], [0.24, 3.6], [0.46, 3.4], [0.72, 2.0], [1.02, 1.4]] },
    torso: { f: [[-0.1, 5.2], [0.12, 4.8], [0.42, 4.8], [0.66, 6.2], [0.84, 6.7], [1.0, 5.0], [1.06, 2.6]], b: [[-0.22, 4.2], [-0.05, 6.4], [0.16, 5.6], [0.38, 4.9], [0.62, 6.2], [0.86, 6.8], [1.0, 5.2], [1.06, 2.8]] },
    torsoFront: { f: [[-0.12, 6.6], [0.12, 6.0], [0.42, 6.6], [0.72, 9.6], [0.9, 10.8], [1.0, 8.6], [1.06, 3.2]] },
  };
  const interp = (pts, t) => {
    if (t <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [t0, v0] = pts[i - 1], [t1, v1] = pts[i]; return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0); }
    return pts[pts.length - 1][1];
  };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  const r1 = (n) => Math.round(n * 10) / 10;

  /** Contorno suave (curva de Catmull-Rom cerrada). */
  function smoothPath(pts, closed = true) {
    const n = pts.length;
    if (n < 3) return '';
    let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
    const P = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
    }
    return d + (closed ? 'Z' : '');
  }

  /** Mitades (delantera y trasera) de un segmento musculado entre a y b. fwd = hacia dónde mira el cuerpo. */
  function segShape(a, b, prof, fwd, k = 1) {
    const d = sub(b, a), len = Math.hypot(d[0], d[1]) || 1, u = norm(d);
    let n = [-u[1], u[0]];
    if (n[0] * fwd[0] + n[1] * fwd[1] < 0) n = [-n[0], -n[1]];
    const ts = [];
    const t0 = Math.min(prof.f[0][0], prof.b[0][0]), t1 = Math.max(prof.f[prof.f.length - 1][0], prof.b[prof.b.length - 1][0]);
    for (let i = 0; i <= 12; i++) ts.push(t0 + ((t1 - t0) * i) / 12);
    const at = (t, w, s) => [a[0] + u[0] * len * t + n[0] * w * s * k, a[1] + u[1] * len * t + n[1] * w * s * k];
    const front = ts.map((t) => at(t, interp(prof.f, t), 1));
    const back = ts.map((t) => at(t, interp(prof.b, t), -1));
    const axis = ts.map((t) => at(t, 0, 0));
    return { front, back, axis, full: front.concat(back.slice().reverse()), u, n, len, a };
  }
  const halfPath = (side, axis) => smoothPath(side.concat(axis.slice().reverse()));

  function muscleColors(m) {
    const c = {};
    const set = (keys, col) => (keys || []).forEach((k) => {
      const map = {
        pecho: ['torsoF_up'], dorsal: ['torsoB_up'], trapecio: ['traps'], hombro_ant: ['delt'], hombro_lat: ['delt'], hombro_post: ['delt'],
        biceps: ['uaF'], triceps: ['uaB'], antebrazo: ['faF', 'faB'], abdomen: ['torsoF_low'], lumbar: ['torsoB_low'], gluteo: ['glute'],
        cuadriceps: ['thF'], isquios: ['thB'], aductores: ['thF', 'thB'], gemelos: ['shB'],
      }[k] || [];
      map.forEach((p) => { c[p] = col; });
    });
    if (m) { set(m.s, COL.s); set(m.p, COL.p); }
    return c;
  }

  /** Dibujo de un fotograma (pose ya resuelta). */
  function figure(f, colors, opt) {
    const out = [];
    const line = (d, w = 0.7, col = COL.line, extra = '') => out.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`);
    const fill = (d, c) => out.push(`<path d="${d}" fill="${c}" stroke="${COL.ink}" stroke-width="0.85" stroke-linejoin="round"/>`);
    const up = norm(sub(f.sh, f.hip));
    const fwd = f.front ? [0, 0] : [-up[1], up[0]].map((v) => v) ;
    // De perfil el cuerpo mira hacia la derecha cuando está de pie: fwd = up girado -90°.
    const fw = f.front ? [1, 0] : [up[1] * -1 * -1, -up[0]];
    void fwd;
    const col = (key, base) => base; void colors;

    const limb = (pts, profA, profB, keyA, keyB, base, kk = 1) => {
      const [p0, p1, p2] = pts;
      const sA = segShape(p0, p1, profA, fw, kk), sB = segShape(p1, p2, profB, fw, kk);
      // Segmento inferior primero, superior encima (el músculo de arriba tapa la articulación).
      fill(smoothPath(sB.full), base);
      fill(smoothPath(sA.full), base);
      return { sA, sB };
    };
    const detailArm = (s) => {
      // Separación bíceps/tríceps y línea del deltoides.
      const m = s.sA; const P = (t, w) => [m.a[0] + m.u[0] * m.len * t + m.n[0] * w, m.a[1] + m.u[1] * m.len * t + m.n[1] * w];
      line(smoothPath([P(0.08, 2.9), P(0.25, 1.2), P(0.36, -2.6)], false), 0.6);
      line(smoothPath([P(0.4, 0.4), P(0.65, 0.2), P(0.85, 0)], false), 0.5);
    };
    const detailLeg = (s) => {
      const m = s.sA; const P = (t, w) => [m.a[0] + m.u[0] * m.len * t + m.n[0] * w, m.a[1] + m.u[1] * m.len * t + m.n[1] * w];
      line(smoothPath([P(0.1, 1.2), P(0.5, 0.8), P(0.85, 2.2)], false), 0.55);
      const c = s.sB; const Q = (t, w) => [c.a[0] + c.u[0] * c.len * t + c.n[0] * w, c.a[1] + c.u[1] * c.len * t + c.n[1] * w];
      line(smoothPath([Q(0.15, -1.4), Q(0.4, -2.6), Q(0.62, -1.2)], false), 0.5);
    };
    const foot = (ank, toe, base) => {
      const d = norm(sub(toe, ank)); const n = [-d[1], d[0]];
      const pts = [[ank[0] - d[0] * 1.6 + n[0] * 1.4, ank[1] - d[1] * 1.6 + n[1] * 1.4], [ank[0] - d[0] * 1.6 - n[0] * 1.6, ank[1] - d[1] * 1.6 - n[1] * 1.6],
        [toe[0] + d[0] * 1.5 - n[0] * 1.2, toe[1] + d[1] * 1.5 - n[1] * 1.2], [toe[0] + d[0] * 1.8 + n[0] * 0.6, toe[1] + d[1] * 1.8 + n[1] * 0.6], [ank[0] + n[0] * 1.6 + d[0], ank[1] + n[1] * 1.6 + d[1]]];
      fill(smoothPath(pts), base);
    };
    const hand = (el, ha, base) => {
      const d = norm(sub(ha, el));
      out.push(`<ellipse cx="${r1(ha[0] + d[0] * 1.6)}" cy="${r1(ha[1] + d[1] * 1.6)}" rx="1.9" ry="1.5" transform="rotate(${r1((Math.atan2(d[1], d[0]) * 180) / Math.PI)} ${r1(ha[0] + d[0] * 1.6)} ${r1(ha[1] + d[1] * 1.6)})" fill="${base}" stroke="${COL.ink}" stroke-width="0.8"/>`);
    };
    const head = () => {
      const hc = f.headC; const ang = (Math.atan2(up[1], up[0]) * 180) / Math.PI + 90;
      // Cuello
      const nb = [f.sh[0] + up[0] * 1, f.sh[1] + up[1] * 1], nt = [hc[0] - up[0] * 3.5, hc[1] - up[1] * 3.5];
      fill(smoothPath(segShape(nb, nt, { f: [[0, 2.4], [1, 2.0]], b: [[0, 2.6], [1, 2.0]] }, fw).full), col('traps', COL.body));
      out.push(`<ellipse cx="${r1(hc[0])}" cy="${r1(hc[1])}" rx="${f.front ? 4.4 : 4.7}" ry="5.6" transform="rotate(${r1(ang)} ${r1(hc[0])} ${r1(hc[1])})" fill="${COL.body}" stroke="${COL.ink}" stroke-width="0.9"/>`);
      if (!f.front) { const jaw = [hc[0] + fw[0] * 3.6 - up[0] * 2.4, hc[1] + fw[1] * 3.6 - up[1] * 2.4]; line(`M${r1(jaw[0])} ${r1(jaw[1])}L${r1(hc[0] + fw[0] * 0.6 - up[0] * 4.6)} ${r1(hc[1] + fw[1] * 0.6 - up[1] * 4.6)}`, 0.5); }
    };
    const torso = () => {
      if (f.front) {
        const prof = PROF.torsoFront;
        const s = segShape(f.hip, f.sh, { f: prof.f, b: prof.f }, [1, 0]);
        // Mitad superior (pecho) e inferior (abdomen): se colorean por separado.
        const split = 6;
        const upF = s.front.slice(split), upB = s.back.slice(split), loF = s.front.slice(0, split + 1), loB = s.back.slice(0, split + 1);
        void loF; void loB; void upF; void upB;
        fill(smoothPath(s.full), COL.body);
        const P = (t, w) => [s.a[0] + s.u[0] * s.len * t + s.n[0] * w, s.a[1] + s.u[1] * s.len * t + s.n[1] * w];
        // Pectorales y abdominales
        line(smoothPath([P(0.66, 7), P(0.6, 3.5), P(0.66, 0.2)], false), 0.6); line(smoothPath([P(0.66, -7), P(0.6, -3.5), P(0.66, -0.2)], false), 0.6);
        line(`M${P(0.62, 0).map(r1).join(' ')}L${P(0.05, 0).map(r1).join(' ')}`, 0.5);
        for (const t of [0.48, 0.36, 0.24]) line(`M${P(t, -3.4).map(r1).join(' ')}Q${P(t + 0.02, 0).map(r1).join(' ')} ${P(t, 3.4).map(r1).join(' ')}`, 0.45);
        line(smoothPath([P(0.1, 5.6), P(0.0, 2.2), P(-0.04, 0)], false), 0.5); line(smoothPath([P(0.1, -5.6), P(0.0, -2.2), P(-0.04, 0)], false), 0.5);
        return;
      }
      const s = segShape(f.hip, f.sh, PROF.torso, fw);
      const cut = 6;
      const P = (t, w) => [s.a[0] + s.u[0] * s.len * t + s.n[0] * w, s.a[1] + s.u[1] * s.len * t + s.n[1] * w];
      // Cuatro zonas: abdomen, pecho, lumbar y dorsal, más glúteo.
      void cut;
      const g = segShape(P(-0.2, -1.5), P(0.18, -1.2), { f: [[0, 1], [1, 1]], b: [[0, 3.6], [0.4, 4.6], [1, 2.4]] }, fw);
      fill(smoothPath(g.back.concat(g.axis.slice().reverse())), COL.body);
      fill(smoothPath(s.full), COL.body);
      // Líneas: borde del pectoral, abdominales, dorsal y trapecio
      line(smoothPath([P(0.86, 5.4), P(0.66, 5.6), P(0.62, 2.4)], false), 0.6);
      for (const t of [0.5, 0.38, 0.26]) line(`M${P(t, 4.2).map(r1).join(' ')}L${P(t + 0.01, 2.4).map(r1).join(' ')}`, 0.45);
      line(smoothPath([P(0.9, -5), P(0.6, -4.2), P(0.36, -3.8)], false), 0.5);
      line(smoothPath([P(1.0, -3.4), P(0.88, -5.4)], false), 0.5);
    };

    if (f.front) {
      const L0 = limb(f.legs[1], PROF.th, PROF.sh, 'th', 'sh', COL.body), L1 = limb(f.legs[0], PROF.th, PROF.sh, 'th', 'sh', COL.body);
      foot(f.legs[1][2], f.legs[1][3], COL.body); foot(f.legs[0][2], f.legs[0][3], COL.body);
      detailLeg(L0); detailLeg(L1);
      torso();
      for (const a of f.arms) { const s = limb(a, PROF.ua, PROF.fa, 'ua', 'fa', COL.body, 0.95); hand(a[1], a[2], COL.body); detailArm(s); }
      head();
    } else {
      const farCol = COL.far;
      limb(f.legF, PROF.th, PROF.sh, 'x', 'x', farCol, 0.92); foot(f.legF[2], f.legF[3], farCol);
      limb(f.armF, PROF.ua, PROF.fa, 'x', 'x', farCol, 0.9); hand(f.armF[1], f.armF[2], farCol);
      torso();
      const L = limb(f.legN, PROF.th, PROF.sh, 'th', 'sh', COL.body); foot(f.legN[2], f.legN[3], COL.body); detailLeg(L);
      head();
      const Ar = limb(f.armN, PROF.ua, PROF.fa, 'ua', 'fa', COL.body);
      hand(f.armN[1], f.armN[2], COL.body); detailArm(Ar);
    }
    void opt;
    return out.join('');
  }

  /* ---------- Material: bancos, máquinas, poleas, barras y mancuernas ---------- */
  const pad = (x, y, w, h, rx = 1.6) => `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${rx}" fill="${COL.pad}" stroke="${COL.padEdge}" stroke-width=".8"/>`;
  const tube = (x1, y1, x2, y2, w = 1.8, c = COL.frame) => `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  const pulley = (x, y) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="2.6" fill="${COL.iron}" stroke="${COL.steel}" stroke-width=".9"/><circle cx="${r1(x)}" cy="${r1(y)}" r=".8" fill="${COL.steel}"/>`;
  /** Torre de polea: columna desde el suelo hasta la polea (y pila de pesas). */
  function tower(an, top = -10) {
    const x = an[0];
    const out = [tube(x, 72.5, x, Math.min(top, an[1] - 4), 2.4)];
    out.push(`<rect x="${r1(x - 3.4)}" y="54" width="6.8" height="17" rx="1" fill="${COL.iron}" stroke="${COL.padEdge}" stroke-width=".6"/>`);
    for (let y = 56; y < 70; y += 2.6) out.push(tube(x - 3, y, x + 3, y, 0.4, COL.steel));
    out.push(pulley(an[0], an[1]));
    return out.join('');
  }
  /** Banco o asiento a partir de los elementos fijos de la plantilla. */
  function benchParts(tpl) {
    const out = [];
    for (const s of tpl.scene || []) {
      if (s[0] === 'rect') {
        out.push(pad(s[1], s[2], s[3], s[4]));
      } else {
        // Patas y estructuras: tubo metálico; las líneas inclinadas de los bancos, como respaldo acolchado.
        const len = Math.hypot(s[3] - s[1], s[4] - s[2]);
        const steep = Math.abs(s[3] - s[1]) > 4 && Math.abs(s[4] - s[2]) > 4 && len > 18;
        if (steep) out.push(`<line x1="${s[1]}" y1="${s[2]}" x2="${s[3]}" y2="${s[4]}" stroke="${COL.padEdge}" stroke-width="5" stroke-linecap="round"/><line x1="${s[1]}" y1="${s[2]}" x2="${s[3]}" y2="${s[4]}" stroke="${COL.pad}" stroke-width="3.6" stroke-linecap="round"/>`);
        else out.push(tube(s[1], s[2], s[3], s[4], 2));
      }
    }
    return out.join('');
  }
  /** Máquinas propias de cada movimiento (se dibujan si el ejercicio es en máquina o polea). */
  const MACHINES = {
    jalon: (f) => tower([64, -8], -12) + tube(64, -12, 86, -12, 2.4) + tube(86, -12, 86, 72.5, 2.4) + pad(64, 42, 8, 3.4, 1.4),
    'remo-sentado': () => tower([104, 58], 30) + pad(84, 54, 4, 16, 1),
    'extension-cuadriceps': (f) => tube(f.legN[1][0] + 1, f.legN[1][1], f.legN[1][0] + 1, 72.5, 2.2) + tube(f.legN[1][0] + 1, f.legN[1][1] + 1, f.legN[2][0], f.legN[2][1], 1.6) + `<circle cx="${r1(f.legN[2][0])}" cy="${r1(f.legN[2][1] - 1)}" r="2.8" fill="${COL.pad}" stroke="${COL.padEdge}" stroke-width=".8"/>`,
    'curl-femoral-sentado': (f) => tube(f.legN[1][0], f.legN[1][1] - 4, f.legN[1][0], 72.5, 2.2) + pad(f.legN[1][0] - 7, f.legN[1][1] - 6, 10, 3, 1.2) + tube(f.legN[1][0], f.legN[1][1], f.legN[2][0], f.legN[2][1], 1.6) + `<circle cx="${r1(f.legN[2][0])}" cy="${r1(f.legN[2][1] + 1.5)}" r="2.8" fill="${COL.pad}" stroke="${COL.padEdge}" stroke-width=".8"/>`,
    'curl-femoral-tumbado': (f) => tube(f.legN[1][0] + 3, 56, f.legN[1][0] + 3, 72.5, 2.2) + tube(f.legN[1][0] + 3, 52, f.legN[2][0], f.legN[2][1], 1.6) + `<circle cx="${r1(f.legN[2][0])}" cy="${r1(f.legN[2][1] - 1.5)}" r="2.8" fill="${COL.pad}" stroke="${COL.padEdge}" stroke-width=".8"/>`,
    prensa: (f) => tube(34, 70, 98, 18, 2.4) + tube(28, 72.5, 34, 70, 2.4) + `<g transform="rotate(-38 ${r1(f.legN[2][0])} ${r1(f.legN[2][1])})">${pad(f.legN[2][0] - 1, f.legN[2][1] - 9, 4, 18, 1)}</g>`,
    'sentadilla-maquina': (f) => tube(36, 72.5, 36, -8, 2.6) + tube(36, -8, 42, -8, 2.6) + pad(37, f.sh[1] - 3, 5, 26, 1.6) + pad(f.sh[0] - 3, f.sh[1] - 4, 7, 3, 1.2) + `<g transform="rotate(-10 62 70)">${pad(48, 68, 30, 3, 1)}</g>`,
    'gemelo-pie': (f) => tube(46, 72.5, 46, f.sh[1] - 4, 2.4) + tube(46, f.sh[1] - 4, f.sh[0] + 4, f.sh[1] - 4, 2.2) + pad(f.sh[0] - 4, f.sh[1] - 5.5, 8, 3, 1.2) + pad(56, 68.5, 14, 4, 1),
    'gemelo-sentado': (f) => tube(70, 72.5, 70, f.legN[1][1] - 4, 2.4) + pad(f.legN[1][0] - 6, f.legN[1][1] - 6, 12, 3, 1.2) + pad(56, 69, 12, 3.5, 1),
    contractor: (f) => tube(60, 72.5, 60, -4, 3) + tube(40, -4, 80, -4, 2.4) + f.arms.map((a) => pad(a[2][0] - 2, a[2][1] - 9, 4, 16, 1.4)).join(''),
    fondos: () => tube(52, 72.5, 52, 37, 2.2) + tube(76, 72.5, 76, 37, 2.2),
    dominadas: () => tube(40, 72.5, 40, -4, 2.4) + tube(80, 72.5, 80, -4, 2.4),
    'elevacion-piernas': () => tube(40, 72.5, 40, -4, 2.4) + tube(80, 72.5, 80, -4, 2.4),
    'remo-apoyado': () => tube(60, 72.5, 60, 40, 2.2),
    'hip-thrust': (f) => pad(f.hip[0] - 7, f.hip[1] - 8, 14, 3, 1.4),
    'press-hombro-sentado': () => '',
  };
  const CABLE_TOWERS = (anchors) => anchors.map((an) => tower(an, an[1] < 30 ? an[1] - 4 : -10)).join('');

  /** Carga: barra con discos, mancuernas, disco suelto o agarre de máquina. */
  function loadDraw(tpl, kind, f, eq, layer) {
    const where = tpl.load || 'hands';
    const hands = f.front ? [f.arms[0][2], f.arms[1][2]] : [f.armN[2]];
    const pts = where === 'shoulders' ? [[f.sh[0] - 1, f.sh[1] - 1.5]] : where === 'hip' ? [[f.hip[0], f.hip[1] - 5]] : where === 'chest' ? [[f.hip[0] + (f.sh[0] - f.hip[0]) * 0.8 + 3, f.hip[1] + (f.sh[1] - f.hip[1]) * 0.8]]
      : where === 'feet' ? [f.front ? f.legs[0][2] : f.legN[2]] : where === 'knees' ? [f.legN[1]] : hands;
    const e = String(eq || '').toLowerCase();
    const loose = /disco/.test(e) && !/barra|multipower/.test(e);
    const out = [];
    const plate = (p, r) => `<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r}" fill="${COL.iron}" stroke="${COL.padEdge}" stroke-width=".9"/><circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r1(r * 0.62)}" fill="none" stroke="#4a5466" stroke-width=".8"/><circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r1(r * 0.18)}" fill="${COL.steel}"/>`;
    if (where === 'wheel') return layer === 'front' ? `<circle cx="${r1(hands[0][0])}" cy="${r1(hands[0][1])}" r="4.4" fill="${COL.iron}" stroke="${COL.steel}" stroke-width="1"/>` : '';
    if (kind === 'plate' && loose) {
      if (layer === 'front') pts.forEach((p) => out.push(plate(p, 5.6)));
    } else if (kind === 'plate') {
      // Barra vista de lado: disco cercano, disco lejano un poco desplazado y la barra entre ambos.
      const D = [3.2, -2.4];
      pts.forEach((p) => {
        const far = [p[0] + D[0], p[1] + D[1]];
        if (layer === 'back') out.push(plate(far, 7.2), tube(p[0] - D[0] * 0.5, p[1] - D[1] * 0.5, far[0] + D[0] * 0.5, far[1] + D[1] * 0.5, 1.6, COL.steel));
        else out.push(tube(p[0] - D[0] * 0.6, p[1] - D[1] * 0.6, p[0] + D[0] * 0.2, p[1] + D[1] * 0.2, 1.6, COL.steel), plate(p, 7.2));
      });
      if (/multipower/.test(e) && layer === 'back') pts.forEach((p) => out.push(tube(p[0] + 1.6, -10, p[0] + 1.6, 72.5, 1.4, COL.steel)));
    } else if (kind === 'db') {
      (where === 'hands' ? hands : pts).forEach((p) => {
        if (f.front) {
          if (layer === 'front') out.push(`<g>${tube(p[0] - 3.6, p[1], p[0] + 3.6, p[1], 1.4, COL.steel)}<rect x="${r1(p[0] - 5.8)}" y="${r1(p[1] - 2.6)}" width="2.8" height="5.2" rx=".8" fill="${COL.iron}" stroke="${COL.padEdge}" stroke-width=".6"/><rect x="${r1(p[0] + 3)}" y="${r1(p[1] - 2.6)}" width="2.8" height="5.2" rx=".8" fill="${COL.iron}" stroke="${COL.padEdge}" stroke-width=".6"/></g>`);
        } else {
          const D = [2.4, -1.8];
          const hex = (c, r) => `<polygon points="${[0, 1, 2, 3, 4, 5].map((k) => `${r1(c[0] + r * Math.cos((Math.PI / 3) * k + Math.PI / 6))},${r1(c[1] + r * Math.sin((Math.PI / 3) * k + Math.PI / 6))}`).join(' ')}" fill="${COL.iron}" stroke="${COL.padEdge}" stroke-width=".7"/>`;
          if (layer === 'back') out.push(hex([p[0] + D[0], p[1] + D[1]], 2.7), tube(p[0], p[1], p[0] + D[0], p[1] + D[1], 1.2, COL.steel));
          else out.push(hex([p[0] - D[0] * 0.4, p[1] - D[1] * 0.4], 2.9));
        }
      });
    } else if (kind === 'machine' || kind === 'cable') {
      if (layer === 'front' && where === 'hands') hands.forEach((p) => out.push(`<rect x="${r1(p[0] - 1.6)}" y="${r1(p[1] - 1.6)}" width="3.2" height="3.2" rx="1" fill="${COL.iron}" stroke="${COL.steel}" stroke-width=".6"/>`));
      if (layer === 'front' && (where === 'feet' || where === 'knees') && kind === 'machine') pts.forEach((p) => out.push(`<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="2.8" fill="${COL.pad}" stroke="${COL.padEdge}" stroke-width=".8"/>`));
    }
    return out.join('');
  }

  /** Todo el material que va detrás de la figura. */
  function backGear(key, tpl, kind, f, eq) {
    const out = [benchParts(tpl)];
    const hands = f.front ? [f.arms[0][2], f.arms[1][2]] : [f.armN[2]];
    if (kind === 'cable') {
      const anchors = tpl.cable === 'side-high' ? [[112, -6], [8, -6]] : tpl.cable === 'side-low' ? [[112, 70], [8, 70]] : tpl.cable === 'low-cross' ? [[50, 72], [70, 72]] : Array.isArray(tpl.cable) ? [tpl.cable] : [[hands[0][0] + 26, 70]];
      if (!MACHINES[key] || !/jalon|remo-sentado/.test(key)) out.push(CABLE_TOWERS(anchors.filter((a) => a[1] < 71 || tpl.cable === 'side-low')));
      if (MACHINES[key] && /jalon|remo-sentado/.test(key)) out.push(MACHINES[key](f));
      anchors.forEach((an, i) => { const h = hands[i] || hands[0]; out.push(`<line x1="${an[0]}" y1="${an[1]}" x2="${r1(h[0])}" y2="${r1(h[1])}" stroke="${COL.ink}" stroke-width=".7"/>`); if (an[1] >= 71) out.push(pulley(an[0], an[1] - 1)); });
    } else if (kind === 'machine' && MACHINES[key]) {
      out.push(MACHINES[key](f));
    } else if (/^(dominadas|elevacion-piernas|fondos)$/.test(key)) {
      out.push(MACHINES[key](f));
    }
    out.push(loadDraw(tpl, kind, f, eq, 'back'));
    return out.join('');
  }

  /** Dibujo estático de un ejercicio en la posición which = 'start' | 'end'. */
  function draw(ex, which) {
    const key = A.templateOf(ex) || (ex && ex.template);
    const tpl = A.templates[key];
    if (!tpl) return '';
    const frames = A.framesOf(key, 1);
    const f = frames[which === 'end' ? 1 : 0];
    const kind = A.loadKind(ex.equipment);
    const m = window.Muscles ? Muscles.musclesOf(ex) : null;
    const colors = muscleColors(m);
    // Encuadre común a las dos posiciones.
    const pts = [];
    for (const g of frames) {
      if (g.front) { g.arms.forEach((a) => pts.push(...a)); g.legs.forEach((l) => pts.push(...l)); } else pts.push(...g.armN, ...g.armF, ...g.legN, ...g.legF);
      pts.push(g.headC, [g.headC[0], g.headC[1] - 6], g.hip, g.sh);
    }
    (tpl.scene || []).forEach((s) => { if (s[0] === 'rect') pts.push([s[1], s[2]], [s[1] + s[3], s[2] + s[4]]); else pts.push([s[1], s[2]], [s[3], s[4]]); });
    let x0 = Math.min(...pts.map((q) => q[0])) - 8, x1 = Math.max(...pts.map((q) => q[0])) + 8, y0 = Math.min(...pts.map((q) => q[1])) - 8, y1 = Math.max(...pts.map((q) => q[1])) + 5;
    let w = x1 - x0, h = y1 - y0;
    if (w / h < 4 / 3) { const nw = (h * 4) / 3; x0 -= (nw - w) / 2; w = nw; } else { const nh = (w * 3) / 4; y0 -= (nh - h) / 2; h = nh; }
    const ground = `<rect x="${r1(x0)}" y="72.6" width="${r1(w)}" height="${r1(Math.max(0, y0 + h - 72.6))}" fill="#e6eaf0"/><line x1="${r1(x0)}" y1="72.6" x2="${r1(x0 + w)}" y2="72.6" stroke="#cdd4de" stroke-width=".8"/>`;
    const feet = f.front ? f.legs.map((l) => l[2]) : [f.legN[2], f.legF[2]];
    const shadow = feet.filter((p) => p[1] > 66).length ? `<ellipse cx="${r1((Math.min(...feet.map((p) => p[0])) + Math.max(...feet.map((p) => p[0]))) / 2)}" cy="72.8" rx="${r1(Math.abs(feet[0][0] - feet[1][0]) / 2 + 9)}" ry="1.6" fill="${COL.shadow}"/>` : '';
    return `<svg class="ex-drawing" viewBox="${r1(x0)} ${r1(y0)} ${r1(w)} ${r1(h)}" role="img" aria-label="${String(ex.name || tpl.label).replace(/"/g, '&quot;')}">${ground}${shadow}${backGear(key, tpl, kind, f, ex.equipment)}${figure(f, colors)}${loadDraw(tpl, kind, f, ex.equipment, 'front')}</svg>`;
  }

  /** Mapa muscular de frente y de espaldas (figura de pie). */
  function muscleMap(ex) {
    const m = window.Muscles ? Muscles.musclesOf(ex) : null;
    const colors = muscleColors(m);
    const f = A.framesOf('laterales', 1)[0];
    const front = `<svg class="ex-map" viewBox="38 -4 44 80">${figure(f, Object.assign({}, colors, { torsoB_up: undefined }))}</svg>`;
    // Espalda: misma figura; los colores traseros pasan a la vista.
    const back = { torsoF_up: colors.torsoB_up, torsoF_low: colors.torsoB_low || colors.glute, uaF: colors.uaB, uaB: colors.uaB, thF: colors.thB, thB: colors.thB, shF: colors.shB, shB: colors.shB, delt: colors.delt, traps: colors.traps, faF: colors.faF, faB: colors.faB };
    const backSvg = `<svg class="ex-map" viewBox="38 -4 44 80">${figure(f, back)}</svg>`;
    return { front, back: backSvg };
  }

  window.Drawing = { draw, muscleMap };
})();
