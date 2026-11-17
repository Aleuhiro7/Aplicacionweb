/* Ilustraciones 3D de los ejercicios: figura anatómica gris oscura con líneas claras y los músculos
 * que trabaja el ejercicio marcados (rojo = principales, naranja = secundarios). Dos posiciones
 * fijas (inicio y final) con su máquina o material, y un mapa muscular de frente y de espaldas.
 * Se dibuja con three.js a partir de las plantillas de movimiento de js/avatars.js. */
(function () {
  'use strict';
  if (!window.THREE || !window.Avatar) return;
  const THREE = window.THREE;
  const A = window.Avatar;

  const COL = { body: 0x3b414b, line: 0xc9ced6, p: 0xe03a3e, s: 0xf2a20c, gear: 0x9aa1ac, gearDark: 0x6b7280 };
  const W = 360, H = 264;
  let R = null; // renderizador, escena, cámara y maniquí (se crean al primer uso)

  const matBody = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.05 });
  const matLine = new THREE.MeshBasicMaterial({ color: COL.line, side: THREE.BackSide });

  function setup() {
    if (R) return R;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { return null; }
    if (!renderer.getContext()) return null;
    renderer.setPixelRatio(1);
    renderer.setSize(W, H);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, W / H, 1, 2000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7380, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 0.6); key.position.set(80, 160, 140); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.25); fill.position.set(-90, 40, 120); scene.add(fill);
    const rig = buildRig(); scene.add(rig.group);
    const props = new THREE.Group(); scene.add(props);
    R = { renderer, scene, camera, rig, props };
    return R;
  }

  /* ---------- Maniquí por piezas (cada pieza puede colorearse por separado) ---------- */
  function outline(mesh, k = 1.07) {
    const o = new THREE.Mesh(mesh.geometry, matLine);
    o.scale.set(k, 1 + (k - 1) * 0.35, k);
    mesh.add(o);
    return mesh;
  }
  function buildRig() {
    const group = new THREE.Group();
    const add = (geo) => { const m = outline(new THREE.Mesh(geo, matBody(COL.body))); group.add(m); return m; };
    const sphere = (r) => add(new THREE.SphereGeometry(r, 22, 16));
    // Elipsoide unidad partido en mitad delantera (+Z) y trasera.
    const halfEll = (front) => add(new THREE.SphereGeometry(1, 26, 18, front ? 0 : Math.PI, Math.PI));
    // Segmento cónico (de 0 a 1 en Y) partido en mitad delantera y trasera.
    const halfSeg = (r1, r2, front) => { const g = new THREE.CylinderGeometry(r2, r1, 1, 18, 1, true, front ? -Math.PI / 2 : Math.PI / 2, Math.PI); g.translate(0, 0.5, 0); return add(g); };
    const limb = (r1, r2, r3) => ({
      aF: halfSeg(r1, r2, true), aB: halfSeg(r1, r2, false), bF: halfSeg(r2 * 0.96, r3, true), bB: halfSeg(r2 * 0.96, r3, false),
      j0: sphere(r1), j1: sphere(r2), j2: sphere(r3),
    });
    return {
      group,
      head: halfEll(true), headB: halfEll(false), neckF: halfSeg(2.2, 1.9, true), neckB: halfSeg(2.2, 1.9, false),
      chestF: halfEll(true), chestB: halfEll(false), absF: halfEll(true), absB: halfEll(false), pelvisF: halfEll(true), pelvisB: halfEll(false),
      traps: halfEll(false), delts: [sphere(3.4), sphere(3.4)],
      arms: [limb(2.8, 1.95, 1.3), limb(2.8, 1.95, 1.3)], hands: [halfEll(true), halfEll(true)],
      legs: [limb(3.8, 2.6, 1.6), limb(3.8, 2.6, 1.6)], calves: [halfEll(false), halfEll(false)], feet: [halfEll(true), halfEll(true)],
    };
  }

  const V = (p, z = 0) => new THREE.Vector3(p[0], -p[1], z);
  /** Orienta una pieza: eje Y de a a b y su cara delantera (+Z) hacia «fwd». */
  function basis(mesh, a, b, fwd) {
    const y = new THREE.Vector3().subVectors(b, a);
    const len = Math.max(0.01, y.length()); y.normalize();
    let z = fwd.clone().addScaledVector(y, -fwd.dot(y));
    if (z.lengthSq() < 1e-4) z = new THREE.Vector3(0, 0, 1).addScaledVector(y, -y.z);
    z.normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    return len;
  }
  function seg(mesh, a, b, fwd) { const len = basis(mesh, a, b, fwd); mesh.position.copy(a); mesh.scale.set(1, len, 1); }
  function ell(mesh, a, b, fwd, rx, rz) { const len = basis(mesh, a, b, fwd); mesh.position.copy(a).lerp(b, 0.5); mesh.scale.set(rx, len / 2, rz); }

  /** Coloca el maniquí en un fotograma (2D → 3D) y devuelve los puntos útiles. */
  function pose(f) {
    const r = R.rig;
    const hip = V(f.hip), sh = V(f.sh), headC = V(f.headC);
    const up = new THREE.Vector3().subVectors(sh, hip).normalize();
    const fwd = f.front ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(up.y, -up.x, 0);
    const side = f.front ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    let arms, legs;
    if (f.front) { arms = f.arms.map((a) => a.map((p) => V(p))); legs = f.legs.map((l) => l.map((p) => V(p))); } else {
      arms = [f.armN.map((p) => V(p, 7)), f.armF.map((p) => V(p, -7))];
      legs = [f.legN.map((p) => V(p, 4)), f.legF.map((p) => V(p, -4))];
    }
    const at = (k) => hip.clone().lerp(sh, k);
    // Tronco de frente: el ancho va de lado a lado; de perfil, en profundidad (Z).
    const w = (wide, deep) => [deep, wide];
    const [pd, pw] = w(6.4, 4.4), [ad, aw] = w(5.6, 3.9), [cd, cw] = w(8.2, 4.7);
    for (const [m, a0, a1, d, wd] of [[r.pelvisF, -0.1, 0.36, pd, pw], [r.pelvisB, -0.1, 0.36, pd, pw], [r.absF, 0.12, 0.72, ad, aw], [r.absB, 0.12, 0.72, ad, aw], [r.chestF, 0.42, 1.06, cd, cw], [r.chestB, 0.42, 1.06, cd, cw]]) {
      ell(m, at(a0), at(a1), fwd, f.front ? d : d, f.front ? wd : wd);
      // De perfil: X local = lado (ancho) → se ve la profundidad; ajustamos para que el ancho vaya a lo ancho del cuerpo.
      m.scale.x = d; m.scale.z = wd;
    }
    ell(r.traps, at(0.84), at(1.14), fwd, 6.2, 3.4);
    seg(r.neckF, at(1.0), headC.clone().addScaledVector(up, -3), fwd); seg(r.neckB, at(1.0), headC.clone().addScaledVector(up, -3), fwd);
    for (const h of [r.head, r.headB]) { ell(h, headC.clone().addScaledVector(up, -5.4), headC.clone().addScaledVector(up, 5.4), fwd, 4.4, 4.6); }
    void side;
    for (let i = 0; i < 2; i++) {
      const [s0, e0, h0] = arms[i];
      const l = r.arms[i];
      seg(l.aF, s0, e0, fwd); seg(l.aB, s0, e0, fwd); seg(l.bF, e0, h0, fwd); seg(l.bB, e0, h0, fwd);
      l.j0.position.copy(s0); l.j1.position.copy(e0); l.j2.position.copy(h0);
      r.delts[i].position.copy(s0);
      const hd = new THREE.Vector3().subVectors(h0, e0).normalize();
      ell(r.hands[i], h0, h0.clone().addScaledVector(hd, 4), fwd, 1.5, 1.2);
      const [p0, k0, a0, t0] = legs[i];
      const lg = r.legs[i];
      seg(lg.aF, p0, k0, fwd); seg(lg.aB, p0, k0, fwd); seg(lg.bF, k0, a0, fwd); seg(lg.bB, k0, a0, fwd);
      lg.j0.position.copy(p0); lg.j1.position.copy(k0); lg.j2.position.copy(a0);
      const sd = new THREE.Vector3().subVectors(a0, k0);
      ell(r.calves[i], k0.clone().addScaledVector(sd, 0.1), k0.clone().addScaledVector(sd, 0.62), fwd, 2.7, 2.9);
      const td = new THREE.Vector3().subVectors(t0, a0).normalize();
      ell(r.feet[i], a0.clone().addScaledVector(td, -1), t0.clone().addScaledVector(td, 1.5), new THREE.Vector3(0, 1, 0), 1.8, 1.4);
    }
    return { hip, sh, hands: arms.map((a) => a[2]), feet: legs.map((l) => l[2]), knees: legs.map((l) => l[1]) };
  }

  /** Colorea las piezas según los músculos (principales en rojo, secundarios en naranja). */
  function paint(m) {
    const r = R.rig;
    const all = [r.head, r.headB, r.neckF, r.neckB, r.chestF, r.chestB, r.absF, r.absB, r.pelvisF, r.pelvisB, r.traps, ...r.delts, ...r.hands, ...r.calves, ...r.feet,
      ...r.arms.flatMap((l) => Object.values(l)), ...r.legs.flatMap((l) => Object.values(l))];
    all.forEach((x) => x.material.color.setHex(COL.body));
    if (!m) return;
    const parts = {
      pecho: [r.chestF], dorsal: [r.chestB], trapecio: [r.traps, r.neckB], hombro_ant: r.delts, hombro_lat: r.delts, hombro_post: r.delts,
      biceps: r.arms.map((l) => l.aF), triceps: r.arms.map((l) => l.aB), antebrazo: r.arms.flatMap((l) => [l.bF, l.bB]),
      abdomen: [r.absF], lumbar: [r.absB], gluteo: [r.pelvisB], cuadriceps: r.legs.map((l) => l.aF), isquios: r.legs.map((l) => l.aB),
      aductores: r.legs.flatMap((l) => [l.aF, l.aB]), gemelos: [...r.calves, ...r.legs.map((l) => l.bB)],
    };
    for (const k of m.s || []) (parts[k] || []).forEach((x) => x.material.color.setHex(COL.s));
    for (const k of m.p || []) (parts[k] || []).forEach((x) => x.material.color.setHex(COL.p));
  }

  /* ---------- Material y máquinas ---------- */
  const gearMat = () => new THREE.MeshStandardMaterial({ color: COL.gear, roughness: 0.4, metalness: 0.5 });
  const darkMat = () => new THREE.MeshStandardMaterial({ color: COL.gearDark, roughness: 0.6, metalness: 0.2 });
  function clear() { const p = R.props; while (p.children.length) p.remove(p.children[0]); }
  function rod(a, b, rad, m) { const g = new THREE.CylinderGeometry(rad, rad, 1, 12); g.translate(0, 0.5, 0); const mesh = new THREE.Mesh(g, m); seg(mesh, a, b, new THREE.Vector3(0, 0, 1)); R.props.add(mesh); }
  function disc(c, r, t, m, axis = 'z') { const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, t, 28), m); if (axis === 'z') d.rotation.x = Math.PI / 2; d.position.copy(c); R.props.add(d); }
  function sceneFor(tpl, depth) {
    const dark = darkMat(), gear = gearMat();
    for (const s of tpl.scene || []) {
      if (s[0] === 'rect') { const b = new THREE.Mesh(new THREE.BoxGeometry(s[3], s[4], depth), dark); b.position.set(s[1] + s[3] / 2, -(s[2] + s[4] / 2), 0); R.props.add(b); } else rod(new THREE.Vector3(s[1], -s[2], 0), new THREE.Vector3(s[3], -s[4], 0), 1.1, gear);
    }
  }
  function loadFor(tpl, kind, j, f) {
    const dark = darkMat(), gear = gearMat();
    const where = tpl.load || 'hands';
    const pts = where === 'shoulders' ? [j.sh.clone().add(new THREE.Vector3(-1, 1.5, 0))] : where === 'hip' ? [j.hip.clone().add(new THREE.Vector3(0, 5, 0))]
      : where === 'chest' ? [j.hip.clone().lerp(j.sh, 0.8).add(new THREE.Vector3(3, 0, 0))] : where === 'feet' ? [j.feet[0]] : where === 'knees' ? [j.knees[0]] : j.hands;
    if (where === 'wheel') { disc(j.hands[0], 4.5, 3, dark); return; }
    if (kind === 'plate' && !f.front) {
      const c = pts[0].clone(); c.z = 0;
      rod(c.clone().setZ(-18), c.clone().setZ(18), 0.7, gear);
      for (const z of [-14, 14]) disc(c.clone().setZ(z), 7, 2.6, dark);
    } else if (kind === 'plate' || kind === 'db') {
      for (const q of (where === 'hands' ? j.hands : pts)) {
        rod(q.clone().add(new THREE.Vector3(0, 0, -3.6)), q.clone().add(new THREE.Vector3(0, 0, 3.6)), 0.6, gear);
        for (const dz of [-3.2, 3.2]) disc(q.clone().add(new THREE.Vector3(0, 0, dz)), 2.4, 1.8, dark);
      }
    } else if (kind === 'cable') {
      const anchors = tpl.cable === 'side-high' ? [[112, -6], [8, -6]] : tpl.cable === 'side-low' ? [[112, 70], [8, 70]] : tpl.cable === 'low-cross' ? [[50, 72], [70, 72]] : null;
      j.hands.slice(0, f.front ? 2 : 1).forEach((h, i) => {
        const an = anchors ? new THREE.Vector3(anchors[i][0], -anchors[i][1], 0) : Array.isArray(tpl.cable) ? new THREE.Vector3(tpl.cable[0], -tpl.cable[1], 0) : new THREE.Vector3(h.x + 26, -72, 0);
        rod(an, h, 0.35, gear); disc(an, 2.4, 1.6, dark);
      });
    } else if (kind === 'machine') {
      for (const q of j.hands) rod(q.clone().setZ(q.z - 3), q.clone().setZ(q.z + 3), 1, dark);
    }
  }

  function aim(points, view) {
    const box = new THREE.Box3();
    points.forEach((p) => box.expandByPoint(p));
    box.expandByScalar(5);
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const cam = R.camera;
    const fit = Math.max(size.y, (Math.max(size.x, size.z * 0.6)) / (W / H));
    const dist = (fit / 2) / Math.tan((cam.fov * Math.PI) / 360) * 1.08;
    const ang = view === 'back' ? Math.PI : view === 'front' ? 0 : view === 'front34' ? 0.3 : 0.62;
    cam.position.set(c.x + Math.sin(ang) * dist, c.y + dist * 0.12, c.z + Math.cos(ang) * dist);
    cam.lookAt(c);
  }

  function aimMap(points, view) {
    const box = new THREE.Box3(); points.forEach((p) => box.expandByPoint(p)); box.expandByScalar(4);
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const cam = R.camera;
    const dist = (size.y / 2) / Math.tan((cam.fov * Math.PI) / 360) * 1.05;
    const ang = view === 'back' ? Math.PI : 0;
    cam.position.set(c.x + Math.sin(ang) * dist, c.y + dist * 0.05, Math.cos(ang) * dist);
    cam.lookAt(c);
  }

  const cache = new Map();
  /** Ilustración fija de un ejercicio: which = 'start' | 'end'. Devuelve una imagen (data URL). */
  function image(ex, which) {
    const key = A.templateOf(ex) || (ex && ex.template);
    if (!key || !setup()) return '';
    const kind = A.loadKind(ex.equipment);
    const m = window.Muscles ? Muscles.musclesOf(ex) : null;
    const ck = `${key}|${kind}|${which}|${m ? m.p.join() + '/' + m.s.join() : ''}`;
    if (cache.has(ck)) return cache.get(ck);
    const tpl = A.templates[key];
    const frames = A.framesOf(key, 1);
    clear(); sceneFor(tpl, 16); paint(m);
    // Encuadre común a las dos posiciones para que se vean a la misma escala.
    const pts = [];
    for (const f of frames) { pose(f); R.rig.group.updateMatrixWorld(true); R.rig.group.traverse((o) => { if (o.isMesh && o.geometry.boundingSphere !== undefined) { o.geometry.computeBoundingSphere(); pts.push(o.localToWorld(o.geometry.boundingSphere.center.clone())); } }); }
    (tpl.scene || []).forEach((s) => { if (s[0] === 'rect') pts.push(new THREE.Vector3(s[1], -s[2], 0), new THREE.Vector3(s[1] + s[3], -(s[2] + s[4]), 0)); else pts.push(new THREE.Vector3(s[1], -s[2], 0), new THREE.Vector3(s[3], -s[4], 0)); });
    aim(pts, tpl.a.front ? 'front34' : 'side');
    const f = frames[which === 'end' ? frames.length - 1 : 0];
    const j = pose(f);
    loadFor(tpl, kind, j, f);
    R.renderer.render(R.scene, R.camera);
    const url = R.renderer.domElement.toDataURL('image/png');
    cache.set(ck, url);
    return url;
  }

  /** Mapa muscular: figura de pie de frente y de espaldas con los músculos marcados. */
  function muscleMap(ex) {
    if (!setup()) return null;
    const m = window.Muscles ? Muscles.musclesOf(ex) : null;
    const ck = `map|${m ? m.p.join() + '/' + m.s.join() : ''}`;
    if (cache.has(ck)) return cache.get(ck);
    const f = A.framesOf('laterales', 1)[0];
    clear(); paint(m);
    pose(f);
    const pts = [new THREE.Vector3(60, -73, 0), new THREE.Vector3(60, 0, 0), new THREE.Vector3(52, -40, 0), new THREE.Vector3(68, -40, 0)];
    const out = {};
    // Lienzo estrecho para que la figura de pie ocupe todo el alto.
    R.renderer.setSize(150, 264); R.camera.aspect = 150 / 264; R.camera.updateProjectionMatrix();
    const fitW = W; void fitW;
    for (const v of ['front', 'back']) { aimMap(pts, v); R.renderer.render(R.scene, R.camera); out[v] = R.renderer.domElement.toDataURL('image/png'); }
    R.renderer.setSize(W, H); R.camera.aspect = W / H; R.camera.updateProjectionMatrix();
    cache.set(ck, out);
    return out;
  }

  window.Avatar3D = { image, muscleMap, supported: () => !!setup(), W, H };
})();
