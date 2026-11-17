/* Avatar 3D de los ejercicios: un maniquí liso (estilo escultura) con luz y sombras, hecho con
 * three.js a partir de las mismas plantillas de movimiento que js/avatars.js.
 * Un único renderizador WebGL dibuja los fotogramas; las miniaturas son tiras de imágenes
 * (sprites) que se animan con CSS, y el detalle se anima en vivo. */
(function () {
  'use strict';
  if (!window.THREE || !window.Avatar) return;
  const THREE = window.THREE;
  const A = window.Avatar;

  const SKIN = 0xc3c9d3;
  const W = 240, H = 176; // tamaño de cada fotograma de las miniaturas (proporción 120 × 88)
  const FRAMES = 12;

  let renderer = null, scene = null, camera = null, rig = null, props = null;

  function mat(color, rough = 0.55, metal = 0) { return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }); }

  function setup() {
    if (renderer) return true;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (e) { return false; }
    renderer.setPixelRatio(1);
    renderer.setSize(W, H);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, W / H, 1, 1000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5d6678, 0.62));
    const key = new THREE.DirectionalLight(0xffffff, 0.78); key.position.set(80, 140, 120); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.22); fill.position.set(-60, 20, 140); scene.add(fill);
    const rim = new THREE.DirectionalLight(0x8fd8ff, 0.6); rim.position.set(-120, 60, -100); scene.add(rim);
    rig = buildRig();
    scene.add(rig.group);
    props = new THREE.Group();
    scene.add(props);
    return true;
  }

  /* ---- Maniquí: piezas que se recolocan en cada fotograma ---- */
  function buildRig() {
    const group = new THREE.Group();
    const skin = mat(SKIN, 0.62);
    const joint = (r) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), skin); group.add(m); return m; };
    const seg = (r1, r2) => { const g = new THREE.CylinderGeometry(r2, r1, 1, 20, 1, true); g.translate(0, 0.5, 0); const m = new THREE.Mesh(g, skin); group.add(m); return m; };
    const ell = () => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), skin); group.add(m); return m; };
    const limb = (r1, r2, r3) => ({ a: seg(r1, r2), b: seg(r2 * 0.95, r3), j0: joint(r1), j1: joint(r2), j2: joint(r3) });
    return {
      group,
      head: ell(), neck: seg(2.2, 1.9), chest: ell(), abs: ell(), pelvis: ell(), glutes: ell(),
      delts: [joint(3.3), joint(3.3)], traps: ell(),
      arms: [limb(2.7, 1.9, 1.3), limb(2.7, 1.9, 1.3)], hands: [ell(), ell()],
      legs: [limb(3.7, 2.5, 1.55), limb(3.7, 2.5, 1.55)], calves: [ell(), ell()], feet: [ell(), ell()],
    };
  }

  const V = (p, z = 0) => new THREE.Vector3(p[0], -p[1], z);
  const UP = new THREE.Vector3(0, 1, 0);
  function placeSeg(m, a, b) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = Math.max(0.01, d.length());
    m.position.copy(a);
    m.quaternion.setFromUnitVectors(UP, d.clone().normalize());
    m.scale.set(1, len, 1);
  }
  function placeEll(m, a, b, rx, rz) {
    const d = new THREE.Vector3().subVectors(b, a);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(UP, d.clone().normalize());
    m.scale.set(rx, Math.max(0.01, d.length() / 2), rz);
  }

  /** Coloca el maniquí en un fotograma de la plantilla (2D → 3D). */
  function pose(f) {
    const r = rig;
    let sh, hip, armPts, legPts;
    if (f.front) {
      hip = V(f.hip); sh = V(f.sh);
      armPts = f.arms.map((a) => a.map((p) => V(p, 0)));
      legPts = f.legs.map((l) => l.map((p) => V(p, 0)));
    } else {
      hip = V(f.hip); sh = V(f.sh);
      armPts = [f.armN.map((p, i) => V(p, i === 0 ? 7 : 7)), f.armF.map((p, i) => V(p, i === 0 ? -7 : -7))];
      legPts = [f.legN.map((p) => V(p, 4)), f.legF.map((p) => V(p, -4))];
    }
    const up = new THREE.Vector3().subVectors(sh, hip).normalize();
    const headC = V(f.headC);
    // Tronco: pelvis, abdomen y pecho como elipsoides a lo largo de la línea cadera → hombros.
    const at = (k) => hip.clone().addScaledVector(new THREE.Vector3().subVectors(sh, hip), k);
    const wide = f.front ? 1 : 0; // de frente el ancho va en X; de perfil, en Z
    const sx = (side, front) => (f.front ? front : side);
    placeEll(r.pelvis, at(-0.1), at(0.36), sx(4.9, 6.6), sx(6.6, 4.4));
    placeEll(r.abs, at(0.12), at(0.72), sx(4.4, 5.8), sx(5.8, 4.0));
    placeEll(r.chest, at(0.42), at(1.06), sx(5.6, 8.6), sx(8.6, 5.4));
    placeEll(r.traps, at(0.86), at(1.12), sx(3.4, 6.2), sx(6.2, 3.2));
    // Glúteos: un poco por detrás de la cadera (de perfil, hacia atrás del tronco).
    const back = f.front ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(-up.y, up.x, 0).multiplyScalar(f.torso === undefined ? 1 : 1);
    placeEll(r.glutes, at(-0.05).addScaledVector(back, 1.6), at(0.22).addScaledVector(back, 1.6), sx(4.2, 6), sx(6, 3.6));
    placeSeg(r.neck, at(1.0), headC.clone().addScaledVector(up, -3));
    r.head.position.copy(headC); r.head.scale.set(4.4, 5.4, 4.4);
    r.head.quaternion.setFromUnitVectors(UP, up);
    void wide;
    for (let i = 0; i < 2; i++) {
      const [s0, e0, h0] = armPts[i];
      const l = r.arms[i];
      placeSeg(l.a, s0, e0); placeSeg(l.b, e0, h0);
      l.j0.position.copy(s0); l.j1.position.copy(e0); l.j2.position.copy(h0);
      r.delts[i].position.copy(s0); r.delts[i].scale.set(1, 1.05, 1);
      const hd = new THREE.Vector3().subVectors(h0, e0).normalize();
      r.hands[i].position.copy(h0).addScaledVector(hd, 1.6); r.hands[i].scale.set(1.6, 2.2, 1.3);
      r.hands[i].quaternion.setFromUnitVectors(UP, hd);
      const [p0, k0, a0, t0] = legPts[i];
      const lg = r.legs[i];
      placeSeg(lg.a, p0, k0); placeSeg(lg.b, k0, a0);
      lg.j0.position.copy(p0); lg.j1.position.copy(k0); lg.j2.position.copy(a0);
      // Gemelo: abultado en la parte alta de la pierna, hacia atrás.
      const sd = new THREE.Vector3().subVectors(a0, k0);
      const calfBack = new THREE.Vector3(-sd.y, sd.x, 0).normalize().multiplyScalar(f.front ? 0 : -0.9);
      placeEll(r.calves[i], k0.clone().addScaledVector(sd, 0.12).add(calfBack), k0.clone().addScaledVector(sd, 0.62).add(calfBack), 2.6, 2.6);
      placeEll(r.feet[i], a0, t0.clone().addScaledVector(new THREE.Vector3().subVectors(t0, a0).normalize(), 1.5), 1.7, 1.9);
    }
    return { hip, sh, hands: armPts.map((a) => a[2]), feet: legPts.map((l) => l[2]), knees: legPts.map((l) => l[1]) };
  }

  /* ---- Material y entorno ---- */
  const GREY = () => mat(0x3a4253, 0.45, 0.35);
  const STEEL = () => mat(0x9aa3b2, 0.3, 0.7);
  function clearProps() { while (props.children.length) props.remove(props.children[0]); }
  function box(x0, y0, w, h, d, m) { const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); g.position.set(x0 + w / 2, -(y0 + h / 2), 0); props.add(g); return g; }
  function bar(a, b, r, m) { const g = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12), m); const s = new THREE.Group(); s.add(g); g.position.y = 0.5; placeSeg(s, a, b); props.add(s); return s; }
  function sceneFor(tpl) {
    clearProps();
    const dark = GREY(), steel = STEEL();
    for (const s of tpl.scene || []) {
      if (s[0] === 'rect') box(s[1], s[2], s[3], s[4], 16, dark);
      else bar(new THREE.Vector3(s[1], -s[2], 0), new THREE.Vector3(s[3], -s[4], 0), 1.1, steel);
    }
    // Suelo con sombra suave
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(70, 26), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.set(60, -72.3, 0); props.add(sh);
  }
  /** Carga que acompaña al movimiento (barra, mancuernas, cable…). */
  function loadFor(tpl, kind, j, f) {
    const g = new THREE.Group();
    const dark = GREY(), steel = STEEL();
    const where = tpl.load || 'hands';
    const pts = where === 'shoulders' ? [j.sh.clone().add(new THREE.Vector3(-1, 1.5, 0))]
      : where === 'hip' ? [j.hip.clone().add(new THREE.Vector3(0, 5, 0))]
        : where === 'chest' ? [j.hip.clone().lerp(j.sh, 0.8).add(new THREE.Vector3(3, 0, 0))]
          : where === 'feet' ? [j.feet[0]] : where === 'knees' ? [j.knees[0]] : j.hands;
    const p = pts[0];
    if (where === 'wheel') {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 3, 24), dark); w.rotation.x = Math.PI / 2; w.position.copy(j.hands[0]); g.add(w);
    } else if (kind === 'plate' && !f.front) {
      const c = p.clone(); c.z = 0;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 34, 10), steel); shaft.rotation.x = Math.PI / 2; shaft.position.copy(c); g.add(shaft);
      for (const z of [-13, 13]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 2.6, 28), dark); d.rotation.x = Math.PI / 2; d.position.set(c.x, c.y, z); g.add(d); }
    } else if (kind === 'plate' || kind === 'db') {
      for (const q of (where === 'hands' ? j.hands : pts)) {
        const h = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 7, 8), steel); h.rotation.x = Math.PI / 2; h.position.copy(q); g.add(h);
        for (const dz of [-3.2, 3.2]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 1.8, 18), dark); d.rotation.x = Math.PI / 2; d.position.set(q.x, q.y, q.z + dz); g.add(d); }
      }
    } else if (kind === 'cable') {
      const anchor = Array.isArray(tpl.cable) ? new THREE.Vector3(tpl.cable[0], -tpl.cable[1], 0) : null;
      const anchors = tpl.cable === 'side-high' ? [[112, -6], [8, -6]] : tpl.cable === 'side-low' ? [[112, 70], [8, 70]] : tpl.cable === 'low-cross' ? [[50, 72], [70, 72]] : null;
      j.hands.forEach((h, i) => {
        const an = anchors ? new THREE.Vector3(anchors[i][0], -anchors[i][1], 0) : anchor || new THREE.Vector3(h.x + 26, -72, 0);
        bar(an, h, 0.35, steel);
        const pul = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 1.4, 18), dark); pul.rotation.x = Math.PI / 2; pul.position.copy(an); g.add(pul);
      });
    } else if (kind === 'machine') {
      for (const q of j.hands) { const h = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 6, 10), dark); h.rotation.x = Math.PI / 2; h.position.copy(q); g.add(h); }
    }
    return g;
  }

  /** Encuadre de la cámara para toda la animación. */
  function frameCamera(frames, front) {
    const box3 = new THREE.Box3();
    for (const f of frames) {
      const pts = f.front ? [f.hip, f.sh, f.headC, ...f.arms.flat(), ...f.legs.flat()] : [f.hip, f.sh, f.headC, ...f.armN, ...f.armF, ...f.legN, ...f.legF];
      pts.forEach((p) => box3.expandByPoint(new THREE.Vector3(p[0], -p[1], 0)));
    }
    box3.expandByScalar(7);
    const c = box3.getCenter(new THREE.Vector3());
    const size = box3.getSize(new THREE.Vector3());
    const fit = Math.max(size.y, size.x / (W / H));
    const dist = (fit / 2) / Math.tan((camera.fov * Math.PI) / 360) * 1.08;
    const ang = front ? 0.32 : 0.62; // giro de la cámara: tres cuartos
    camera.position.set(c.x + Math.sin(ang) * dist * (front ? 1 : 0.9), c.y + dist * 0.18, Math.cos(ang) * dist);
    camera.lookAt(c);
  }

  /** Dibuja todos los fotogramas de un ejercicio y devuelve una tira de imágenes. */
  const cache = new Map();
  function sprite(ex) {
    const key = A.templateOf(ex) || ex.avatar;
    const tplKey = key || (ex && ex.template);
    if (!tplKey || !setup()) return null;
    const kind = A.loadKind(ex.equipment);
    const ck = `${tplKey}|${kind}`;
    if (cache.has(ck)) return cache.get(ck);
    const tpl = A.templates[tplKey];
    const frames = A.framesOf(tplKey, FRAMES - 1);
    sceneFor(tpl);
    frameCamera(frames, !!tpl.a.front);
    const strip = document.createElement('canvas');
    strip.width = W * frames.length; strip.height = H;
    const ctx = strip.getContext('2d');
    frames.forEach((f, i) => {
      const j = pose(f);
      const load = loadFor(tpl, kind, j, f);
      scene.add(load);
      renderer.render(scene, camera);
      ctx.drawImage(renderer.domElement, i * W, 0);
      scene.remove(load);
    });
    const url = strip.toDataURL('image/webp', 0.85);
    const out = { url, frames: frames.length };
    cache.set(ck, out);
    return out;
  }

  window.Avatar3D = { sprite, W, H };
})();
