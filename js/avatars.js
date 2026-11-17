/* Avatares animados de los ejercicios: un muñeco dibujado en SVG (sin fotos de personas) que hace
 * el movimiento en bucle. Cada ejercicio usa una plantilla de movimiento (posición inicial → final);
 * el material (barra, mancuernas, polea, máquina…) se dibuja según el ejercicio.
 * Coordenadas: lienzo 120 × 88 (viewBox 0 -8 120 88), suelo en y = 72. Ángulos en grados:
 * 0 = derecha, 90 = arriba (el muñeco mira a la derecha). */
(function () {
  'use strict';

  const L = { torso: 24, neck: 3, head: 5.5, ua: 12, fa: 11, th: 15, sh: 14, foot: 5 };
  const rad = (d) => (d * Math.PI) / 180;
  const dirOf = (deg) => [Math.cos(rad(deg)), -Math.sin(rad(deg))];
  const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpP = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

  /** Cinemática inversa de dos segmentos: punto intermedio (codo/rodilla) para llegar de a a b. */
  function ik(a, b, l1, l2, s) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    let d = Math.hypot(dx, dy);
    const base = Math.atan2(dy, dx);
    d = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
    const al = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    const ang = base + s * al;
    const mid = [a[0] + l1 * Math.cos(ang), a[1] + l1 * Math.sin(ang)];
    const ang2 = Math.atan2(b[1] - mid[1], b[0] - mid[0]);
    const end = [mid[0] + l2 * Math.cos(ang2), mid[1] + l2 * Math.sin(ang2)];
    return [mid, end];
  }

  /** Posición de todas las articulaciones para una pose. */
  function solve(p) {
    const hip = p.hip;
    if (p.front) {
      const cx = hip[0];
      const sh = [cx, hip[1] - L.torso + (p.lift || 0)];
      const headC = [cx, sh[1] - L.neck - L.head];
      const out = { front: true, hip, sh, headC, arms: [], legs: [] };
      for (const side of [1, -1]) {
        const shS = [cx + side * 7, sh[1] + 1];
        const hand = [cx + side * Math.abs(p.hand[0] - cx), p.hand[1]];
        const [el, ha] = ik(shS, hand, L.ua, L.fa, side * (p.es || 1));
        out.arms.push([shS, el, ha]);
        const hipS = [cx + side * 4.5, hip[1]];
        const ank = p.ankle ? [cx + side * Math.abs(p.ankle[0] - cx), p.ankle[1]] : [hipS[0] + side * 1.5, hip[1] + L.th + L.sh];
        const [kn, an] = ik(hipS, ank, L.th, L.sh, -side * (p.ks || 1));
        out.legs.push([hipS, kn, an, add(an, [side * 4, 0])]);
      }
      return out;
    }
    const td = dirOf(p.torso);
    const sh = add(add(hip, td, L.torso), [0, -(p.lift || 0)]);
    const headC = add(sh, td, L.neck + L.head);
    const arm = (hand, s) => { const [el, ha] = ik(sh, hand, L.ua, L.fa, s); return [sh, el, ha]; };
    const leg = (ank, s, fdeg) => {
      const [kn, an] = ik(hip, ank, L.th, L.sh, s);
      return [hip, kn, an, add(an, dirOf(fdeg), L.foot)];
    };
    const handF = p.handF || add(p.hand, [-1.5, -0.5]);
    const ankF = p.ankleF || add(p.ankle, [-1.5, 0]);
    return {
      front: false, hip, sh, headC,
      armN: arm(p.hand, p.es || 1), armF: arm(handF, p.esF || p.es || 1),
      legN: leg(p.ankle, p.ks || -1, p.foot ?? 0), legF: leg(ankF, p.ksF || p.ks || -1, p.footF ?? p.foot ?? 0),
    };
  }

  const f1 = (n) => Math.round(n * 10) / 10;
  const pt = (p) => `${f1(p[0])} ${f1(p[1])}`;
  const poly = (pts) => `M${pts.map(pt).join('L')}`;

  /* ------------------------------------------------------------------------------------------
   * Plantillas: a = posición inicial, b = final. Campos: hip, torso, hand, ankle (y opcionales
   * handF, ankleF, es/ks = sentido del codo/rodilla, foot = ángulo del pie, lift = encoger
   * hombros, front = vista de frente). scene = elementos fijos; load = dónde va la carga;
   * cable = anclaje de la polea si el ejercicio es en polea.
   * ---------------------------------------------------------------------------------------- */
  const STAND = { hip: [58, 43], torso: 90, ankle: [59, 72], hand: [60, 43] };
  const st = (o) => Object.assign({}, STAND, o);
  const BENCH = [['rect', 38, 52, 42, 4], ['line', 42, 56, 42, 72], ['line', 76, 56, 76, 72]];
  const SEAT = [['rect', 44, 52, 22, 4], ['line', 55, 56, 55, 72], ['rect', 42, 22, 4, 30]];
  const LYING = { hip: [72, 49], torso: 180, ankle: [86, 72], ks: 1, es: -1 };
  const ly = (o) => Object.assign({}, LYING, o);

  const T = {
    'press-banca': { label: 'Press de banca', scene: BENCH, a: ly({ hand: [48, 41] }), b: ly({ hand: [48, 26] }), cable: [48, 72] },
    'press-inclinado': { label: 'Press inclinado', scene: [['line', 74, 56, 42, 37], ['line', 74, 56, 74, 72], ['line', 50, 44, 50, 72]],
      a: { hip: [74, 53], torso: 148, ankle: [88, 72], ks: 1, es: -1, hand: [53, 34] }, b: { hip: [74, 53], torso: 148, ankle: [88, 72], ks: 1, es: -1, hand: [57, 17] }, cable: [50, 72] },
    'press-declinado': { label: 'Press declinado', scene: [['line', 82, 50, 44, 62], ['line', 50, 61, 50, 72], ['line', 78, 52, 78, 72]],
      a: { hip: [76, 52], torso: 198, ankle: [90, 50], ks: 1, es: -1, hand: [53, 52] }, b: { hip: [76, 52], torso: 198, ankle: [90, 50], ks: 1, es: -1, hand: [53, 36] } },
    'floor-press': { label: 'Press en el suelo', scene: [], a: { hip: [74, 66], torso: 180, ankle: [88, 72], ks: 1, es: -1, hand: [50, 56] }, b: { hip: [74, 66], torso: 180, ankle: [88, 72], ks: 1, es: -1, hand: [50, 43] } },
    'aperturas': { label: 'Aperturas tumbado', scene: BENCH, a: ly({ hand: [40, 60], es: -1 }), b: ly({ hand: [49, 27], es: -1 }), cable: [40, 72] },
    'pullover': { label: 'Pullover tumbado', scene: BENCH, a: ly({ hand: [27, 52], es: 1 }), b: ly({ hand: [52, 28], es: 1 }) },
    'press-francés': { label: 'Press francés tumbado', scene: BENCH, a: ly({ hand: [40, 40], es: 1 }), b: ly({ hand: [49, 27], es: 1 }) },
    'fondos': { label: 'Fondos', scene: [['line', 52, 37, 76, 37], ['line', 72, 37, 72, 72]],
      a: { hip: [58, 40], torso: 96, ankle: [52, 62], ks: 1, hand: [63, 37], es: 1 }, b: { hip: [58, 52], torso: 100, ankle: [50, 72], ks: 1, hand: [63, 37], es: 1 } },
    'flexiones': { label: 'Flexiones', scene: [],
      a: { hip: [62, 57], torso: 159, ankle: [89, 69], foot: -60, ks: 1, hand: [40, 71], es: 1 }, b: { hip: [65, 63], torso: 171, ankle: [92, 69], foot: -60, ks: 1, hand: [40, 71], es: 1 } },
    'cruce-poleas': { label: 'Cruce de poleas', scene: [], front: true, cable: 'side-high',
      a: { front: true, hip: [60, 44], hand: [88, 12], es: -1 }, b: { front: true, hip: [60, 44], hand: [64, 36], es: -1 } },
    'cruce-bajo': { label: 'Cruce de abajo arriba', scene: [], front: true, cable: 'side-low',
      a: { front: true, hip: [60, 44], hand: [86, 46], es: -1 }, b: { front: true, hip: [60, 44], hand: [64, 14], es: -1 } },
    'contractor': { label: 'Aperturas en máquina', scene: [], front: true,
      a: { front: true, hip: [60, 44], hand: [88, 22], es: -1 }, b: { front: true, hip: [60, 44], hand: [64, 22], es: -1 } },
    'press-svend': { label: 'Press con disco al frente', a: st({ hand: [66, 27], es: -1 }), b: st({ hand: [86, 27], es: -1 }) },

    'jalon': { label: 'Jalón al pecho', scene: SEAT.slice(0, 2), cable: [62, -8],
      a: { hip: [55, 50], torso: 96, ankle: [74, 72], ks: 1, hand: [60, -4], es: 1 }, b: { hip: [55, 50], torso: 100, ankle: [74, 72], ks: 1, hand: [62, 24], es: 1 } },
    'dominadas': { label: 'Dominadas', scene: [['line', 40, -4, 80, -4]],
      a: { hip: [59, 44], torso: 92, ankle: [56, 72], ks: 1, hand: [62, -4], es: 1 }, b: { hip: [59, 28], torso: 94, ankle: [56, 56], ks: 1, hand: [62, -4], es: 1 } },
    'remo-inclinado': { label: 'Remo inclinado', load: 'hands',
      a: { hip: [50, 42], torso: 32, ankle: [58, 72], ks: -1, hand: [71, 54], es: -1 }, b: { hip: [50, 42], torso: 34, ankle: [58, 72], ks: -1, hand: [62, 43], es: -1 } },
    'remo-sentado': { label: 'Remo sentado en polea', scene: [['rect', 36, 56, 26, 3], ['line', 86, 58, 86, 72]], cable: [104, 58],
      a: { hip: [48, 54], torso: 70, ankle: [84, 64], ks: 1, hand: [86, 50], es: -1 }, b: { hip: [48, 54], torso: 96, ankle: [84, 64], ks: 1, hand: [60, 44], es: -1 } },
    'remo-apoyado': { label: 'Remo con pecho apoyado', scene: [['line', 46, 68, 74, 34], ['line', 52, 62, 52, 72]],
      a: { hip: [48, 52], torso: 48, ankle: [52, 72], ks: -1, hand: [76, 64], es: -1 }, b: { hip: [48, 52], torso: 48, ankle: [52, 72], ks: -1, hand: [62, 46], es: -1 } },
    'remo-mancuerna': { label: 'Remo a una mano', scene: [['rect', 60, 48, 38, 4], ['line', 66, 52, 66, 72], ['line', 94, 52, 94, 72]],
      a: { hip: [52, 40], torso: 12, ankle: [46, 72], ks: 1, hand: [72, 62], handF: [86, 48], es: -1 }, b: { hip: [52, 40], torso: 12, ankle: [46, 72], ks: 1, hand: [62, 44], handF: [86, 48], es: -1 } },
    'pullover-polea': { label: 'Pullover en polea de pie', cable: [96, -8],
      a: st({ torso: 76, hand: [82, -2], es: -1 }), b: st({ torso: 80, hand: [66, 44], es: -1 }) },
    'encogimientos': { label: 'Encogimientos', a: st({ hand: [61, 44] }), b: st({ hand: [61, 39], lift: 4 }), cable: [62, 72] },
    'peso-muerto': { label: 'Peso muerto', anchor: 'foot',
      a: { hip: [47, 48], torso: 40, ankle: [60, 72], ks: 1, hand: [66, 60], es: 1 }, b: st({ hand: [61, 44] }) },
    'rumano': { label: 'Peso muerto rumano', anchor: 'foot',
      a: { hip: [50, 42], torso: 22, ankle: [59, 72], ks: 1, hand: [70, 58], es: 1 }, b: st({ hand: [61, 44] }), cable: [40, 72] },
    'buenos-dias': { label: 'Buenos días', load: 'shoulders',
      a: st({ hand: [64, 20], es: -1 }), b: { hip: [52, 42], torso: 18, ankle: [59, 72], ks: 1, hand: [76, 30], es: -1 } },
    'hiperextension': { label: 'Hiperextensión', scene: [['line', 52, 52, 64, 40], ['line', 58, 46, 58, 72], ['line', 30, 66, 38, 72]], load: 'chest',
      a: { hip: [60, 44], torso: -72, ankle: [36, 66], ks: -1, hand: [66, 58], es: 1 }, b: { hip: [60, 44], torso: 42, ankle: [36, 66], ks: -1, hand: [72, 34], es: 1 } },
    'pull-through': { label: 'Pull-through', cable: [30, 72],
      a: { hip: [54, 42], torso: 28, ankle: [60, 72], ks: 1, hand: [52, 62], es: 1 }, b: st({ hand: [62, 46] }) },

    'press-militar': { label: 'Press militar de pie', a: st({ hand: [65, 18], es: -1 }), b: st({ hand: [61, -6], es: -1 }) },
    'press-hombro-sentado': { label: 'Press de hombro sentado', scene: SEAT,
      a: { hip: [52, 50], torso: 92, ankle: [72, 72], ks: 1, hand: [58, 26], es: -1 }, b: { hip: [52, 50], torso: 92, ankle: [72, 72], ks: 1, hand: [54, 2], es: -1 } },
    'press-landmine': { label: 'Press en landmine', a: st({ hand: [66, 22], es: -1 }), b: st({ hand: [84, 4], es: -1 }) },
    'laterales': { label: 'Elevaciones laterales', front: true, cable: 'low-cross',
      a: { front: true, hip: [60, 44], hand: [70, 44], es: 1 }, b: { front: true, hip: [60, 44], hand: [88, 20], es: 1 } },
    'pajaros': { label: 'Pájaros (deltoides posterior)', front: true,
      a: { front: true, hip: [60, 44], hand: [64, 38], es: -1 }, b: { front: true, hip: [60, 44], hand: [89, 24], es: -1 } },
    'face-pull': { label: 'Face pull', cable: [104, 14], a: st({ hand: [88, 18], es: -1 }), b: st({ hand: [66, 10], es: 1 }) },
    'frontales': { label: 'Elevaciones frontales', a: st({ hand: [62, 44], es: -1 }), b: st({ hand: [83, 18], es: -1 }), cable: [52, 72] },
    'remo-menton': { label: 'Remo al mentón', a: st({ hand: [62, 44] }), b: st({ hand: [64, 21], es: 1 }), cable: [62, 72] },

    'sentadilla': { label: 'Sentadilla', anchor: 'foot', load: 'shoulders',
      a: st({ hand: [62, 18], es: 1 }), b: { hip: [46, 57], torso: 58, ankle: [59, 72], ks: -1, hand: [70, 37], es: 1 } },
    'sentadilla-copa': { label: 'Sentadilla goblet', anchor: 'foot', load: 'chest',
      a: st({ hand: [64, 28], es: -1 }), b: { hip: [47, 58], torso: 70, ankle: [59, 72], ks: -1, hand: [62, 40], es: -1 } },
    'sentadilla-maquina': { label: 'Sentadilla en máquina', anchor: 'foot', load: 'shoulders', scene: [['line', 38, 6, 38, 72], ['line', 44, 72, 78, 66]],
      a: { hip: [52, 44], torso: 80, ankle: [62, 68], ks: -1, hand: [58, 18], es: 1 }, b: { hip: [42, 57], torso: 72, ankle: [62, 68], ks: -1, hand: [50, 32], es: 1 } },
    'prensa': { label: 'Prensa de piernas', scene: [['line', 30, 66, 44, 56], ['line', 22, 50, 34, 64]], load: 'feet',
      a: { hip: [40, 58], torso: 140, ankle: [78, 30], ks: 1, foot: 90, hand: [44, 62], es: 1 }, b: { hip: [40, 58], torso: 140, ankle: [62, 42], ks: 1, foot: 90, hand: [44, 62], es: 1 } },
    'zancada': { label: 'Zancada', anchor: 'none',
      a: st({ hand: [60, 43], ankle: [62, 72], ankleF: [52, 72] }), b: { hip: [56, 55], torso: 90, ankle: [72, 72], ankleF: [34, 70], foot: 0, footF: -30, ks: -1, ksF: -1, hand: [58, 55] } },
    'bulgara': { label: 'Sentadilla búlgara', scene: [['rect', 18, 46, 18, 4], ['line', 27, 50, 27, 72]],
      a: { hip: [50, 44], torso: 90, ankle: [64, 72], ankleF: [30, 46], footF: 180, ks: -1, ksF: 1, hand: [52, 44] }, b: { hip: [48, 56], torso: 84, ankle: [64, 72], ankleF: [30, 46], footF: 180, ks: -1, ksF: 1, hand: [50, 56] } },
    'step-up': { label: 'Subida al cajón', scene: [['rect', 62, 56, 30, 16]],
      a: { hip: [58, 43], torso: 84, ankle: [74, 56], ankleF: [56, 72], ks: -1, hand: [60, 43] }, b: { hip: [74, 28], torso: 90, ankle: [76, 56], ankleF: [70, 54], ksF: -1, ks: -1, hand: [76, 28] } },
    'extension-cuadriceps': { label: 'Extensión de cuádriceps', scene: [['rect', 42, 50, 28, 4], ['line', 54, 54, 54, 72], ['rect', 40, 24, 4, 28]], load: 'feet',
      a: { hip: [48, 49], torso: 96, ankle: [70, 64], ks: -1, hand: [56, 50], es: 1 }, b: { hip: [48, 49], torso: 96, ankle: [86, 46], ks: -1, hand: [56, 50], es: 1 } },
    'sissy': { label: 'Sissy squat', anchor: 'foot',
      a: st({ hand: [64, 30], es: -1 }), b: { hip: [64, 57], torso: 106, ankle: [59, 72], foot: -30, ks: -1, hand: [60, 32], es: -1 } },

    'curl-femoral-tumbado': { label: 'Curl femoral tumbado', scene: [['rect', 28, 52, 54, 4], ['line', 36, 56, 36, 72], ['line', 76, 56, 76, 72]], load: 'feet',
      a: { hip: [62, 48], torso: 180, ankle: [90, 48], ks: 1, hand: [34, 54], es: 1 }, b: { hip: [62, 48], torso: 180, ankle: [72, 30], ks: 1, hand: [34, 54], es: 1 } },
    'curl-femoral-sentado': { label: 'Curl femoral sentado', scene: SEAT, load: 'feet',
      a: { hip: [50, 50], torso: 100, ankle: [80, 48], ks: 1, hand: [58, 46], es: 1 }, b: { hip: [50, 50], torso: 100, ankle: [64, 66], ks: 1, hand: [58, 46], es: 1 } },
    'curl-femoral-pie': { label: 'Curl femoral de pie', load: 'feet',
      a: st({ hand: [60, 43], ankle: [60, 72] }), b: st({ hand: [60, 43], ankle: [46, 52], ankleF: [58, 72], ks: 1 }) },
    'nordico': { label: 'Curl nórdico', scene: [],
      a: { hip: [58, 50], torso: 92, ankle: [38, 70], ks: 1, hand: [64, 44], es: -1 }, b: { hip: [70, 64], torso: 18, ankle: [38, 70], ks: 1, hand: [98, 64], es: -1 } },

    'hip-thrust': { label: 'Hip thrust', scene: [['rect', 26, 46, 16, 6], ['line', 34, 52, 34, 72]], load: 'hip',
      a: { hip: [60, 62], torso: 147, ankle: [76, 72], ks: 1, hand: [58, 58], es: 1 }, b: { hip: [64, 46], torso: 180, ankle: [76, 72], ks: 1, hand: [62, 44], es: 1 } },
    'puente-gluteo': { label: 'Puente de glúteo', load: 'hip',
      a: { hip: [60, 68], torso: 180, ankle: [76, 72], ks: 1, hand: [58, 66], es: 1 }, b: { hip: [60, 55], torso: 146, ankle: [76, 72], ks: 1, hand: [60, 53], es: 1 } },
    'patada-gluteo': { label: 'Patada de glúteo', cable: [24, 70], load: 'feet',
      a: { hip: [56, 44], torso: 60, ankle: [60, 72], ankleF: [58, 72], ks: 1, hand: [70, 40], es: 1 }, b: { hip: [56, 44], torso: 60, ankle: [30, 52], ankleF: [58, 72], ks: 1, hand: [70, 40], es: 1 } },
    'abduccion': { label: 'Abducción de cadera', front: true,
      a: { front: true, hip: [60, 43], hand: [68, 43], ankle: [64, 72] }, b: { front: true, hip: [60, 43], hand: [68, 43], ankle: [80, 68] } },
    'aduccion': { label: 'Aducción de cadera', front: true,
      a: { front: true, hip: [60, 43], hand: [68, 43], ankle: [80, 68] }, b: { front: true, hip: [60, 43], hand: [68, 43], ankle: [62, 72] } },

    'gemelo-pie': { label: 'Elevación de talones de pie', load: 'shoulders',
      a: st({ hand: [62, 20], es: 1 }), b: { hip: [58, 38], torso: 90, ankle: [59, 67], foot: -50, hand: [62, 15], es: 1 } },
    'gemelo-sentado': { label: 'Elevación de talones sentado', scene: [['rect', 36, 52, 22, 4], ['line', 47, 56, 47, 72]], load: 'knees',
      a: { hip: [44, 50], torso: 92, ankle: [62, 70], ks: -1, foot: 0, hand: [56, 50], es: 1 }, b: { hip: [44, 50], torso: 92, ankle: [62, 66], ks: -1, foot: -45, hand: [56, 47], es: 1 } },
    'gemelo-burro': { label: 'Gemelo tipo burro', scene: [['rect', 80, 30, 6, 16]],
      a: { hip: [54, 42], torso: 8, ankle: [56, 72], ks: 1, hand: [80, 40], es: 1 }, b: { hip: [54, 37], torso: 8, ankle: [56, 67], foot: -50, ks: 1, hand: [80, 38], es: 1 } },
    'tibial': { label: 'Elevación de punteras', scene: [['line', 46, -4, 46, 72]],
      a: { hip: [52, 43], torso: 92, ankle: [62, 72], ks: -1, foot: 0, hand: [56, 43] }, b: { hip: [52, 43], torso: 92, ankle: [62, 72], ks: -1, foot: 35, hand: [56, 43] } },

    'curl': { label: 'Curl de bíceps', cable: [64, 72], a: st({ hand: [62, 44], es: 1 }), b: st({ hand: [67, 23], es: 1 }) },
    'curl-scott': { label: 'Curl en banco Scott', scene: [['line', 64, 30, 80, 48], ['line', 70, 40, 70, 72], ['rect', 40, 54, 18, 4]],
      a: { hip: [50, 52], torso: 82, ankle: [70, 72], ks: 1, hand: [82, 46], es: -1 }, b: { hip: [50, 52], torso: 82, ankle: [70, 72], ks: 1, hand: [66, 18], es: -1 } },
    'curl-inclinado': { label: 'Curl en banco inclinado', scene: [['line', 66, 56, 40, 24], ['line', 60, 50, 60, 72]],
      a: { hip: [64, 54], torso: 128, ankle: [82, 72], ks: 1, hand: [48, 54], es: 1 }, b: { hip: [64, 54], torso: 128, ankle: [82, 72], ks: 1, hand: [58, 28], es: 1 } },
    'curl-concentrado': { label: 'Curl concentrado', scene: [['rect', 34, 54, 20, 4], ['line', 44, 58, 44, 72]],
      a: { hip: [44, 52], torso: 50, ankle: [70, 72], ks: 1, hand: [64, 66], es: 1 }, b: { hip: [44, 52], torso: 50, ankle: [70, 72], ks: 1, hand: [58, 42], es: 1 } },
    'curl-bayesian': { label: 'Curl Bayesian en polea', cable: [26, 54], a: st({ hand: [48, 44], es: 1 }), b: st({ hand: [66, 22], es: 1 }) },
    'curl-polea-alta': { label: 'Curl en polea alta', front: true, cable: 'side-high',
      a: { front: true, hip: [60, 44], hand: [92, 16], es: 1 }, b: { front: true, hip: [60, 44], hand: [70, 6], es: 1 } },
    'pushdown': { label: 'Extensión de tríceps en polea', cable: [74, -8],
      a: st({ torso: 84, hand: [68, 28], es: 1 }), b: st({ torso: 84, hand: [66, 46], es: 1 }) },
    'extension-trasnuca': { label: 'Extensión de tríceps tras nuca', cable: [44, 72],
      a: st({ hand: [52, 12], es: 1 }), b: st({ hand: [60, -6], es: 1 }) },
    'extension-adelante': { label: 'Extensión de tríceps hacia delante', cable: [30, 0],
      a: st({ torso: 80, hand: [62, 4], es: 1 }), b: st({ torso: 80, hand: [88, 6], es: 1 }) },
    'patada-triceps': { label: 'Patada de tríceps', cable: [96, 66],
      a: { hip: [50, 42], torso: 30, ankle: [58, 72], ks: -1, hand: [66, 46], es: 1 }, b: { hip: [50, 42], torso: 30, ankle: [58, 72], ks: -1, hand: [46, 32], es: 1 } },
    'curl-muneca': { label: 'Curl de muñeca', scene: [['rect', 40, 52, 22, 4], ['line', 51, 56, 51, 72]],
      a: { hip: [46, 50], torso: 60, ankle: [72, 72], ks: 1, hand: [74, 52], es: 1 }, b: { hip: [46, 50], torso: 60, ankle: [72, 72], ks: 1, hand: [73, 46], es: 1 } },
    'paseo-granjero': { label: 'Paseo del granjero', a: st({ hand: [61, 44], ankle: [66, 72], ankleF: [50, 72] }), b: st({ hand: [61, 44], ankle: [52, 72], ankleF: [66, 72] }) },

    'crunch-polea': { label: 'Crunch en polea de rodillas', cable: [64, -8],
      a: { hip: [58, 48], torso: 96, ankle: [36, 70], ks: 1, hand: [62, 12], es: -1 }, b: { hip: [58, 48], torso: 36, ankle: [36, 70], ks: 1, hand: [72, 34], es: -1 } },
    'crunch': { label: 'Crunch', scene: [['line', 34, 66, 92, 58]],
      a: { hip: [66, 60], torso: 172, ankle: [84, 52], ks: 1, hand: [44, 52], es: 1 }, b: { hip: [66, 60], torso: 140, ankle: [84, 52], ks: 1, hand: [52, 38], es: 1 } },
    'elevacion-piernas': { label: 'Elevación de piernas colgado', scene: [['line', 40, -4, 80, -4]],
      a: { hip: [59, 42], torso: 92, ankle: [58, 70], ks: 1, hand: [62, -4], es: 1 }, b: { hip: [59, 42], torso: 96, ankle: [84, 30], ks: 1, hand: [62, -4], es: 1 } },
    'rueda': { label: 'Rueda abdominal', load: 'wheel',
      a: { hip: [62, 50], torso: 120, ankle: [86, 70], ks: 1, foot: 0, hand: [52, 68], es: 1 }, b: { hip: [58, 62], torso: 170, ankle: [86, 70], ks: 1, hand: [26, 68], es: 1 } },
    'plancha': { label: 'Plancha', scene: [],
      a: { hip: [62, 58], torso: 170, ankle: [90, 68], foot: -60, ks: 1, hand: [44, 70], es: 1 }, b: { hip: [62, 56], torso: 169, ankle: [90, 68], foot: -60, ks: 1, hand: [44, 70], es: 1 } },
    'inclinacion-lateral': { label: 'Inclinación lateral', front: true,
      a: { front: true, hip: [60, 43], hand: [70, 46] }, b: { front: true, hip: [60, 43], hand: [70, 52], lift: 3 } },
    'pallof': { label: 'Pallof press', cable: [108, 30], a: st({ hand: [66, 30], es: -1 }), b: st({ hand: [86, 30], es: -1 }) },
    'lenador': { label: 'Leñador en polea', cable: [100, -6], a: st({ hand: [84, 4], es: -1 }), b: st({ hand: [52, 44], es: -1 }) },
  };

  /* Plantilla de cada ejercicio de serie. */
  const BY_ID = {
    'bic-p1-1': 'curl-scott', 'bic-p1-2': 'curl', 'bic-p1-3': 'curl', 'bic-p1-4': 'curl', 'bic-p1-5': 'curl-scott', 'bic-p1-6': 'curl', 'bic-p1-7': 'curl',
    'bic-p2-1': 'curl-scott', 'bic-p2-2': 'curl-scott', 'bic-p2-3': 'curl-scott', 'bic-p2-4': 'curl-concentrado', 'bic-p2-5': 'curl-concentrado', 'bic-p2-6': 'curl-polea-alta',
    'bic-p3-1': 'curl', 'bic-p3-2': 'curl', 'bic-p3-3': 'curl', 'bic-p3-4': 'curl-inclinado', 'bic-p3-5': 'curl-bayesian', 'bic-p3-6': 'curl-bayesian',
    'bic-p4-1': 'dominadas', 'bic-p4-2': 'curl',
    'tri-p1-1': 'fondos', 'tri-p1-2': 'fondos', 'tri-p1-3': 'press-banca', 'tri-p1-4': 'press-banca', 'tri-p1-5': 'fondos', 'tri-p1-6': 'flexiones', 'tri-p1-7': 'press-francés', 'tri-p1-8': 'floor-press',
    'tri-p2-1': 'extension-trasnuca', 'tri-p2-2': 'extension-adelante', 'tri-p2-3': 'press-francés', 'tri-p2-4': 'press-francés', 'tri-p2-5': 'extension-adelante', 'tri-p2-6': 'extension-trasnuca', 'tri-p2-7': 'extension-trasnuca',
    'tri-p3-1': 'pushdown', 'tri-p3-2': 'pushdown', 'tri-p3-3': 'pushdown', 'tri-p3-4': 'patada-triceps', 'tri-p3-5': 'pushdown', 'tri-p3-6': 'extension-adelante',
    'tri-p4-1': 'pushdown', 'tri-p4-2': 'pushdown', 'tri-p4-3': 'pushdown', 'tri-p4-4': 'patada-triceps',
    'pec-p1-1': 'press-banca', 'pec-p1-2': 'press-banca', 'pec-p1-3': 'press-banca', 'pec-p1-4': 'press-banca', 'pec-p1-5': 'press-hombro-sentado', 'pec-p1-6': 'press-banca',
    'pec-p2-1': 'press-inclinado', 'pec-p2-2': 'press-inclinado', 'pec-p2-3': 'press-inclinado', 'pec-p2-4': 'press-inclinado', 'pec-p2-5': 'aperturas', 'pec-p2-6': 'cruce-bajo',
    'pec-p3-1': 'press-declinado', 'pec-p3-2': 'press-declinado', 'pec-p3-3': 'press-declinado', 'pec-p3-4': 'fondos', 'pec-p3-5': 'fondos', 'pec-p3-6': 'cruce-poleas',
    'pec-p4-1': 'aperturas', 'pec-p4-2': 'contractor', 'pec-p4-3': 'contractor', 'pec-p4-4': 'aperturas', 'pec-p4-5': 'contractor', 'pec-p4-6': 'pullover',
    'pec-p5-1': 'flexiones', 'pec-p5-2': 'flexiones', 'pec-p5-3': 'press-banca', 'pec-p5-4': 'press-svend',
    'esp-p1-1': 'dominadas', 'esp-p1-2': 'dominadas', 'esp-p1-3': 'jalon', 'esp-p1-4': 'jalon', 'esp-p1-5': 'jalon', 'esp-p1-6': 'jalon', 'esp-p1-7': 'jalon',
    'esp-p2-1': 'remo-inclinado', 'esp-p2-2': 'remo-inclinado', 'esp-p2-3': 'remo-inclinado', 'esp-p2-4': 'remo-mancuerna', 'esp-p2-5': 'remo-apoyado', 'esp-p2-6': 'remo-sentado', 'esp-p2-7': 'remo-apoyado', 'esp-p2-8': 'remo-inclinado', 'esp-p2-9': 'remo-inclinado',
    'esp-p3-1': 'pullover-polea', 'esp-p3-2': 'pullover', 'esp-p3-3': 'pullover', 'esp-p3-4': 'remo-sentado', 'esp-p3-5': 'pullover-polea',
    'esp-p4-1': 'encogimientos', 'esp-p4-2': 'encogimientos', 'esp-p4-3': 'encogimientos', 'esp-p4-4': 'encogimientos', 'esp-p4-5': 'face-pull',
    'esp-p5-1': 'peso-muerto', 'esp-p5-2': 'peso-muerto', 'esp-p5-3': 'hiperextension', 'esp-p5-4': 'buenos-dias',
    'hom-p1-1': 'press-militar', 'hom-p1-2': 'press-hombro-sentado', 'hom-p1-3': 'press-hombro-sentado', 'hom-p1-4': 'press-hombro-sentado', 'hom-p1-5': 'press-hombro-sentado', 'hom-p1-6': 'press-hombro-sentado', 'hom-p1-7': 'press-landmine',
    'hom-p2-1': 'laterales', 'hom-p2-2': 'laterales', 'hom-p2-3': 'laterales', 'hom-p2-4': 'laterales', 'hom-p2-5': 'laterales', 'hom-p2-6': 'remo-menton',
    'hom-p3-1': 'pajaros', 'hom-p3-2': 'pajaros', 'hom-p3-3': 'face-pull', 'hom-p3-4': 'pajaros', 'hom-p3-5': 'pajaros',
    'hom-p4-1': 'frontales', 'hom-p4-2': 'frontales', 'hom-p4-3': 'frontales', 'hom-p5-1': 'laterales', 'hom-p5-2': 'laterales',
    'cua-p1-1': 'sentadilla', 'cua-p1-2': 'sentadilla', 'cua-p1-3': 'sentadilla', 'cua-p1-4': 'sentadilla-maquina', 'cua-p1-5': 'sentadilla-maquina', 'cua-p1-6': 'sentadilla-copa', 'cua-p1-7': 'prensa',
    'cua-p2-1': 'prensa', 'cua-p2-2': 'prensa', 'cua-p2-3': 'bulgara', 'cua-p2-4': 'bulgara', 'cua-p2-5': 'zancada', 'cua-p2-6': 'step-up', 'cua-p2-7': 'sentadilla-copa',
    'cua-p3-1': 'extension-cuadriceps', 'cua-p3-2': 'extension-cuadriceps', 'cua-p3-3': 'sissy', 'cua-p3-4': 'extension-cuadriceps', 'cua-p4-1': 'prensa', 'cua-p4-2': 'extension-cuadriceps',
    'isq-p1-1': 'rumano', 'isq-p1-2': 'rumano', 'isq-p1-3': 'rumano', 'isq-p1-4': 'rumano', 'isq-p1-5': 'rumano', 'isq-p1-6': 'pull-through',
    'isq-p2-1': 'curl-femoral-tumbado', 'isq-p2-2': 'curl-femoral-sentado', 'isq-p2-3': 'curl-femoral-pie', 'isq-p2-4': 'curl-femoral-tumbado', 'isq-p2-5': 'curl-femoral-pie', 'isq-p2-6': 'curl-femoral-tumbado', 'isq-p2-7': 'nordico',
    'isq-p3-1': 'curl-femoral-sentado', 'isq-p3-2': 'hiperextension',
    'glu-p1-1': 'hip-thrust', 'glu-p1-2': 'hip-thrust', 'glu-p1-3': 'hip-thrust', 'glu-p1-4': 'puente-gluteo', 'glu-p1-5': 'hip-thrust',
    'glu-p2-1': 'bulgara', 'glu-p2-2': 'zancada', 'glu-p2-3': 'peso-muerto', 'glu-p2-4': 'step-up', 'glu-p2-5': 'prensa', 'glu-p2-6': 'hiperextension',
    'glu-p3-1': 'abduccion', 'glu-p3-2': 'abduccion', 'glu-p3-3': 'patada-gluteo', 'glu-p3-4': 'patada-gluteo', 'glu-p4-1': 'abduccion', 'glu-p4-2': 'puente-gluteo',
    'adu-p1-1': 'aduccion', 'adu-p1-2': 'aduccion', 'adu-p1-3': 'sentadilla-copa', 'adu-p1-4': 'plancha',
    'gem-p1-1': 'gemelo-pie', 'gem-p1-2': 'gemelo-pie', 'gem-p1-3': 'prensa', 'gem-p1-4': 'gemelo-burro', 'gem-p1-5': 'gemelo-pie',
    'gem-p2-1': 'gemelo-sentado', 'gem-p2-2': 'gemelo-sentado', 'gem-p2-3': 'gemelo-sentado', 'gem-p3-1': 'tibial', 'gem-p3-2': 'gemelo-pie',
    'abd-p1-1': 'crunch-polea', 'abd-p1-2': 'crunch', 'abd-p1-3': 'crunch', 'abd-p2-1': 'elevacion-piernas', 'abd-p2-2': 'elevacion-piernas', 'abd-p2-3': 'crunch', 'abd-p2-4': 'rueda',
    'abd-p3-1': 'pallof', 'abd-p3-2': 'lenador', 'abd-p3-3': 'inclinacion-lateral', 'abd-p3-4': 'plancha',
    'ant-p1-1': 'curl-muneca', 'ant-p1-2': 'curl-muneca', 'ant-p1-3': 'curl', 'ant-p1-4': 'paseo-granjero',
  };

  /** Tipo de carga según el material del ejercicio. */
  function loadKind(eq) {
    const e = String(eq || '').toLowerCase();
    if (/polea|cable/.test(e)) return 'cable';
    if (/mancuern|kettle/.test(e)) return 'db';
    if (/barra|multipower|landmine|disco/.test(e)) return 'plate';
    if (/máquina|maquina/.test(e)) return 'machine';
    return 'none';
  }

  const N = 7; // fotogramas entre la posición inicial y la final
  const ease = (t) => (1 - Math.cos(Math.PI * t)) / 2;

  /** Anclaje: mantiene fijos los pies (o lo que diga la plantilla) entre fotogramas. */
  function frames(tpl) {
    const out = [];
    for (let i = 0; i <= N; i++) {
      const t = ease(i / N);
      const a = tpl.a, b = tpl.b;
      const p = {
        front: !!a.front, hip: lerpP(a.hip, b.hip, t), torso: lerp(a.torso ?? 90, b.torso ?? 90, t), hand: lerpP(a.hand, b.hand, t),
        ankle: a.ankle && b.ankle ? lerpP(a.ankle, b.ankle, t) : a.ankle, es: t < 0.5 ? a.es : b.es, ks: a.ks, ksF: a.ksF,
        foot: lerp(a.foot ?? 0, b.foot ?? 0, t), footF: lerp(a.footF ?? a.foot ?? 0, b.footF ?? b.foot ?? 0, t), lift: lerp(a.lift || 0, b.lift || 0, t),
      };
      if (a.handF || b.handF) p.handF = lerpP(a.handF || add(a.hand, [-1.5, -0.5]), b.handF || add(b.hand, [-1.5, -0.5]), t);
      if (a.ankleF || b.ankleF) p.ankleF = lerpP(a.ankleF || add(a.ankle, [-1.5, 0]), b.ankleF || add(b.ankle, [-1.5, 0]), t);
      out.push(solve(p));
    }
    return out;
  }

  const SEQ = (list) => list.concat(list.slice(0, -1).reverse());
  const anim = (attr, vals, dur) => `<animate attributeName="${attr}" values="${vals.join(';')}" dur="${dur}s" repeatCount="indefinite" calcMode="spline" keySplines="${vals.slice(1).map(() => '.45 0 .55 1').join(';')}"/>`;

  let uid = 0;
  /** SVG animado de un ejercicio (o de una plantilla concreta). */
  function svg(ex, opts = {}) {
    const key = opts.template || (ex && (ex.avatar || BY_ID[ex.id])) || '';
    const tpl = T[key];
    if (!tpl) return '';
    const fr = SEQ(frames(tpl));
    const dur = 2.6;
    const kind = loadKind(ex && ex.equipment);
    const gid = `avg${++uid}`;
    const C = { body: `url(#${gid})`, far: '#5d6b8a', prop: '#8b98ad', dark: '#2b3446', line: '#6b7891' };
    const parts = [];
    // Elementos fijos (banco, asiento, barra…)
    for (const s of tpl.scene || []) {
      if (s[0] === 'rect') parts.push(`<rect x="${s[1]}" y="${s[2]}" width="${s[3]}" height="${s[4]}" rx="1.5" fill="${C.dark}" stroke="${C.line}" stroke-width=".8"/>`);
      else parts.push(`<line x1="${s[1]}" y1="${s[2]}" x2="${s[3]}" y2="${s[4]}" stroke="${C.line}" stroke-width="2.4" stroke-linecap="round"/>`);
    }
    parts.push(`<line x1="4" y1="72.5" x2="116" y2="72.5" stroke="${C.line}" stroke-width="1" opacity=".5"/>`);
    // Polea: cable desde el anclaje hasta la mano.
    const handsOf = (f) => (f.front ? [f.arms[0][2], f.arms[1][2]] : [f.armN[2]]);
    if (kind === 'cable') {
      const anchors = (f) => {
        if (tpl.cable === 'side-high') return [[112, -6], [8, -6]];
        if (tpl.cable === 'side-low') return [[112, 70], [8, 70]];
        if (tpl.cable === 'low-cross') return [[50, 72], [70, 72]];
        if (Array.isArray(tpl.cable)) return [tpl.cable];
        return [[handsOf(f)[0][0] + 26, 72]];
      };
      const a0 = anchors(fr[0]);
      a0.forEach((an, i) => {
        parts.push(`<path d="${poly([an, handsOf(fr[0])[i] || handsOf(fr[0])[0]])}" stroke="${C.prop}" stroke-width="1" fill="none" opacity=".9">${anim('d', fr.map((f) => poly([an, handsOf(f)[i] || handsOf(f)[0]])), dur)}</path>`);
        parts.push(`<circle cx="${an[0]}" cy="${an[1]}" r="2.6" fill="${C.dark}" stroke="${C.prop}" stroke-width="1"/>`);
      });
    }
    const limb = (get, w, color) => `<path d="${poly(get(fr[0]))}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none">${anim('d', fr.map((f) => poly(get(f))), dur)}</path>`;
    if (fr[0].front) {
      parts.push(limb((f) => f.legs[1], 5.4, C.body), limb((f) => f.legs[0], 5.4, C.body));
      parts.push(limb((f) => [f.hip, f.sh], 11, C.body));
      parts.push(limb((f) => f.arms[1], 4.6, C.body), limb((f) => f.arms[0], 4.6, C.body));
    } else {
      parts.push(limb((f) => f.armF, 4.4, C.far), limb((f) => f.legF, 5.2, C.far));
      parts.push(limb((f) => [f.hip, f.sh], 10, C.body));
      parts.push(limb((f) => f.legN, 5.6, C.body));
    }
    parts.push(`<circle cx="${f1(fr[0].headC[0])}" cy="${f1(fr[0].headC[1])}" r="${L.head}" fill="${C.body}">${anim('cx', fr.map((f) => f1(f.headC[0])), dur)}${anim('cy', fr.map((f) => f1(f.headC[1])), dur)}</circle>`);
    if (!fr[0].front) parts.push(limb((f) => f.armN, 4.8, C.body));
    // Carga: barra/disco, mancuerna o agarre de máquina.
    const loadAt = (f) => {
      switch (tpl.load) {
        case 'shoulders': return [add(f.sh, [-1, -1])];
        case 'hip': return [add(f.hip, [0, -5])];
        case 'chest': return [add(lerpP(f.hip, f.sh, 0.8), [3, 0])];
        case 'feet': return [f.front ? f.legs[0][2] : f.legN[2]];
        case 'knees': return [f.legN[1]];
        default: return handsOf(f);
      }
    };
    const disc = (r, fill, stroke) => loadAt(fr[0]).map((p0, i) => `<circle cx="${f1(p0[0])}" cy="${f1(p0[1])}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.4">${anim('cx', fr.map((f) => f1(loadAt(f)[i][0])), dur)}${anim('cy', fr.map((f) => f1(loadAt(f)[i][1])), dur)}</circle>`).join('');
    if (tpl.load === 'wheel') parts.push(disc(4.5, C.dark, C.prop));
    else if (kind === 'plate') parts.push(disc(tpl.load && tpl.load !== 'hands' ? 6.5 : 6.5, C.dark, C.prop));
    else if (kind === 'db') parts.push(disc(3.4, C.prop, C.dark));
    else if (kind === 'machine' && (tpl.load === 'feet' || tpl.load === 'knees')) parts.push(disc(3.2, C.dark, C.prop));
    else if (kind === 'machine') parts.push(disc(2.4, C.prop, C.dark));
    const cls = opts.cls ? ` ${opts.cls}` : '';
    // Encuadre: el muñeco y su material ocupan todo el recuadro (proporción 120 × 88).
    const pts = [];
    for (const f of fr) {
      pts.push(f.hip, f.sh, add(f.headC, [0, -L.head - 1]), add(f.headC, [L.head, 0]), add(f.headC, [-L.head, 0]));
      if (f.front) { f.arms.forEach((a) => pts.push(...a)); f.legs.forEach((l) => pts.push(...l)); } else pts.push(...f.armN, ...f.armF, ...f.legN, ...f.legF);
      pts.push(...loadAt(f).map((q) => add(q, [0, -7])), ...loadAt(f).map((q) => add(q, [0, 7])));
    }
    for (const sc of tpl.scene || []) {
      if (sc[0] === 'rect') pts.push([sc[1], sc[2]], [sc[1] + sc[3], sc[2] + sc[4]]);
      else pts.push([sc[1], sc[2]], [sc[3], sc[4]]);
    }
    pts.push([pts[0][0], 72.5]);
    let x0 = Math.min(...pts.map((q) => q[0])) - 5, x1 = Math.max(...pts.map((q) => q[0])) + 5;
    let y0 = Math.min(...pts.map((q) => q[1])) - 5, y1 = Math.max(...pts.map((q) => q[1])) + 4;
    let w = x1 - x0, h = y1 - y0;
    if (w / h < 120 / 88) { const nw = (h * 120) / 88; x0 -= (nw - w) / 2; w = nw; } else { const nh = (w * 88) / 120; y0 -= (nh - h) / 2; h = nh; }
    if (w < 60) { const k = 60 / w; x0 -= ((k - 1) * w) / 2; y0 -= ((k - 1) * h) / 2; w *= k; h *= k; }
    const vb = `${f1(x0)} ${f1(y0)} ${f1(w)} ${f1(h)}`;
    return `<svg class="ex-avatar${cls}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${(ex && ex.name ? String(ex.name).replace(/"/g, '&quot;') : tpl.label)}"><defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="10" y1="-8" x2="110" y2="80"><stop offset="0" stop-color="#8aa2ff"/><stop offset=".55" stop-color="#22d3ee"/><stop offset="1" stop-color="#3ee6a0"/></linearGradient></defs>${parts.join('')}</svg>`;
  }

  /** Plantilla asignada (o deducida) para un ejercicio. */
  const templateOf = (ex) => (ex ? ex.avatar || BY_ID[ex.id] || '' : '');

  window.Avatar = { svg, templateOf, templates: T, byId: BY_ID };
})();
