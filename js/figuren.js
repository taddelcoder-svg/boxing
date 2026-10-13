/* Ringfieber – Boxer in 3D (three.js r128).
   Low-Poly-Figuren aus Grundkörpern. Arme und Beine werden jedes Bild per Zwei-Gelenk-IK gestellt:
   Jede Pose ist nur eine Handvoll Zielpunkte (Handschuhe, Hüfte, Oberkörper). Lokale Achsen eines
   Boxers: +z nach vorn (zum Gegner), +x = seine linke Seite, +y nach oben. */
'use strict';

const Figuren = (() => {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const ACHSE_Y = V(0, 1, 0);
  const tmpA = V(0, 0, 0), tmpB = V(0, 0, 0), tmpC = V(0, 0, 0), tmpD = V(0, 0, 0);
  const klemm = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const glatt = t => { t = klemm(t, 0, 1); return t * t * (3 - 2 * t); };
  const raus = t => 1 - Math.pow(1 - klemm(t, 0, 1), 3);
  const clamp01 = t => Math.max(0, Math.min(1, t));
  // Kurve für Ausweichen/Ducken: schnell hin, halten, zurück
  const hinHalten = (t, hin = 0.22, ab = 0.62) => t < hin ? raus(t / hin) : t < ab ? 1 : 1 - glatt((t - ab) / (1 - ab));

  // Gliedmaßen als Drehkörper (Höhe 1, Radius 1 an der dicksten Stelle): rundere Muskeln statt Kanten
  const drehkoerper = profil => {
    const pts = [new THREE.Vector2(0.001, -0.5)];
    for (const [r, y] of profil) pts.push(new THREE.Vector2(r, y));
    pts.push(new THREE.Vector2(0.001, 0.5));
    return new THREE.LatheGeometry(pts, 12);
  };
  const GEO = {
    zyl: new THREE.CylinderGeometry(1, 1, 1, 12, 1),
    zylSpitz: new THREE.CylinderGeometry(0.75, 1, 1, 12, 1),
    hose: new THREE.CylinderGeometry(1, 1.1, 1, 14, 1),
    klein: new THREE.SphereGeometry(1, 7, 5),
    kugel: new THREE.SphereGeometry(1, 10, 8),
    kugelFein: new THREE.SphereGeometry(1, 16, 12),
    kopf: new THREE.SphereGeometry(1, 20, 14),
    kappe: new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    kiste: new THREE.BoxGeometry(1, 1, 1),
    ring: new THREE.TorusGeometry(1, 0.18, 6, 16),
    bogen: new THREE.TorusGeometry(1, 0.2, 6, 14, Math.PI),
    // Muskelprofile: [Radius, Höhe von -0.5 (Anfang) bis 0.5 (Ende des Glieds)]
    oberarm: drehkoerper([[0.5, -0.47], [0.86, -0.38], [1.06, -0.2], [1.16, 0.0], [1.1, 0.2], [0.92, 0.38], [0.62, 0.48]]),
    unterarm: drehkoerper([[0.5, -0.47], [0.9, -0.38], [1.1, -0.22], [1.0, -0.02], [0.82, 0.22], [0.66, 0.42], [0.5, 0.48]]),
    schenkel: drehkoerper([[0.55, -0.47], [0.95, -0.38], [1.14, -0.2], [1.12, 0.05], [0.98, 0.27], [0.8, 0.42], [0.58, 0.48]]),
    wade: drehkoerper([[0.5, -0.47], [0.62, -0.38], [0.86, -0.15], [1.12, 0.12], [1.04, 0.3], [0.88, 0.43], [0.62, 0.48]])
  };

  const GEO_SET = new Set(Object.values(GEO));
  // Mehrere Formen zu einer Geometrie verschmelzen (weniger Zeichenaufrufe). Teil: { g, p:[x,y,z], s:[x,y,z]|zahl, r:[x,y,z] }
  const mT = new THREE.Matrix4(), mQ = new THREE.Quaternion(), mE = new THREE.Euler(), mP = V(0, 0, 0), mS = V(1, 1, 1), mN = new THREE.Matrix3(), mV = V(0, 0, 0);
  function fusion(teile) {
    let nv = 0, ni = 0;
    for (const t of teile) { nv += t.g.attributes.position.count; ni += t.g.index.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint16Array(ni);
    let ov = 0, oi = 0;
    for (const t of teile) {
      const sk = typeof t.s === 'number' ? [t.s, t.s, t.s] : (t.s || [1, 1, 1]), r = t.r || [0, 0, 0], p = t.p || [0, 0, 0];
      mT.compose(mP.set(p[0], p[1], p[2]), mQ.setFromEuler(mE.set(r[0], r[1], r[2])), mS.set(sk[0], sk[1], sk[2]));
      mN.getNormalMatrix(mT);
      const gp = t.g.attributes.position, gn = t.g.attributes.normal, gu = t.g.attributes.uv;
      for (let i = 0; i < gp.count; i++) {
        mV.fromBufferAttribute(gp, i).applyMatrix4(mT); pos[(ov + i) * 3] = mV.x; pos[(ov + i) * 3 + 1] = mV.y; pos[(ov + i) * 3 + 2] = mV.z;
        mV.fromBufferAttribute(gn, i).applyMatrix3(mN).normalize(); nor[(ov + i) * 3] = mV.x; nor[(ov + i) * 3 + 1] = mV.y; nor[(ov + i) * 3 + 2] = mV.z;
        uv[(ov + i) * 2] = gu.getX(i); uv[(ov + i) * 2 + 1] = gu.getY(i);
      }
      for (let i = 0; i < t.g.index.count; i++) idx[oi + i] = t.g.index.getX(i) + ov;
      ov += gp.count; oi += t.g.index.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    return geo;
  }
  // Augentextur: Weiß, Regenbogenhaut, Pupille und Glanzpunkt in einem Bild (Vorderseite der Kugel liegt bei u = 0.25)
  const augTexturen = {};
  function augenTex(iris) {
    if (augTexturen[iris]) return augTexturen[iris];
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#f6f5f0'; g.fillRect(0, 0, 256, 128);
    const x = 64, y = 64;
    const v = g.createRadialGradient(x, y, 4, x, y, 24); v.addColorStop(0, '#000'); v.addColorStop(0.01, iris); v.addColorStop(0.75, iris); v.addColorStop(1, '#10080a');
    g.fillStyle = v; g.beginPath(); g.arc(x, y, 24, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#050506'; g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - 8, y - 9, 5, 0, Math.PI * 2); g.fill(); g.globalAlpha = 0.6; g.beginPath(); g.arc(x + 9, y + 8, 2.5, 0, Math.PI * 2); g.fill();
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 2;
    return (augTexturen[iris] = t);
  }

  // Gemeinsame Bänder-Textur (Hosenbund mit Schrift), einmal je Seite
  let bundTextur = null;
  function bundTex() {
    if (bundTextur) return bundTextur;
    const c = document.createElement('canvas'); c.width = 512; c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 512, 32);
    g.fillStyle = '#1b1f2a'; g.font = '800 22px "Bricolage Grotesque", Arial, sans-serif'; g.textBaseline = 'middle';
    g.fillText('RINGFIEBER ★ RINGFIEBER ★ RINGFIEBER ★ ', 4, 17);
    g.fillRect(0, 0, 512, 3); g.fillRect(0, 29, 512, 3);
    bundTextur = new THREE.CanvasTexture(c); bundTextur.encoding = THREE.sRGBEncoding; bundTextur.wrapS = THREE.RepeatWrapping; bundTextur.anisotropy = 4;
    return bundTextur;
  }

  function mat(farbe, opt = {}) {
    const m = new THREE.MeshStandardMaterial({ color:farbe, roughness:opt.rau != null ? opt.rau : 0.7, metalness:opt.metall || 0, flatShading:!!opt.flach });
    m.envMapIntensity = opt.env != null ? opt.env : 0.35;
    if (opt.map) m.map = opt.map;
    if (opt.glut) m.emissive.set(opt.glut);
    return m;
  }

  // Ein Glied (Zylinder) zwischen zwei Punkten
  function glied(mesh, A, B, dicke) {
    tmpA.subVectors(B, A);
    const l = tmpA.length() || 1e-4;
    mesh.position.addVectors(A, B).multiplyScalar(0.5);
    mesh.scale.set(dicke, l, dicke);
    mesh.quaternion.setFromUnitVectors(ACHSE_Y, tmpA.divideScalar(l));
  }

  // Zwei-Gelenk-IK: Schulter S, Ziel T, Längen a/b, Pol zeigt die Richtung, in die das Gelenk knickt
  function ik(S, T, a, b, pol, outE, outT) {
    tmpB.subVectors(T, S);
    let d = tmpB.length();
    const dir = tmpB.divideScalar(d || 1);
    d = klemm(d, Math.abs(a - b) + 1e-3, a + b - 1e-3);
    outT.copy(S).addScaledVector(dir, d);
    const cosA = klemm((a * a + d * d - b * b) / (2 * a * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    tmpC.copy(pol).addScaledVector(dir, -pol.dot(dir));
    if (tmpC.lengthSq() < 1e-6) tmpC.set(0, -1, 0);
    tmpC.normalize();
    outE.copy(S).addScaledVector(dir, a * cosA).addScaledVector(tmpC, a * sinA);
  }

  // Faust dreht sich beim Schlag ein: Gerade und Haken mit der Handfläche nach unten, Aufwärtshaken nach oben
  function rollFuer(z) {
    const a = z.a, tt = z.t, p = tt < a.aus ? tt / a.aus : tt < a.aus + a.tr ? 1 + (tt - a.aus) / a.tr : 2;
    const k = p < 1 ? 0 : p < 2 ? raus(p - 1) : 1 - glatt(Math.min(1, (tt - a.aus - a.tr) / a.erh));
    if (a.art === 'haken') return 1.45 * Math.max(k, p < 1 ? 0.5 * p : 0);
    if (a.art === 'aufwaerts' || a.art === 'volltreffer') return -1.0 * (p < 1 ? p : k);
    if (a.art === 'koerper') return 0.5 * k;
    return 1.2 * k;
  }
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpX = V(0, 0, 0), tmpZ = V(0, 0, 0);
  const GOLD = '#d4af37';

  class Boxer3D {
    constructor(aussehen) {
      this.wurzel = new THREE.Group();          // Position im Ring, Blickrichtung
      this.koerper = new THREE.Group();         // kippt beim Niederschlag um die Füße
      this.wurzel.add(this.koerper);
      this.huefte = new THREE.Group();
      this.koerper.add(this.huefte);
      this.rumpf = new THREE.Group();
      this.huefte.add(this.rumpf);
      this.materialien = [];
      this.zeit = Math.random() * 10;
      this.glut = [0, 0];                       // Vorzeichen-Leuchten links/rechts
      this.rollZiel = [0, 0];
      this.gesichtZeit = 1 + Math.random() * 3;
      this.fz = { lid:0, mund:0, braue:0, blinzeln:0, blessur:0, schweiss:0 };
      this.aussehenSetzen(aussehen);
    }

    // Material (je Aussehen nach Farbe und Eigenschaften geteilt, damit es wenige Zustandswechsel gibt)
    m(farbe, opt) {
      const key = farbe + JSON.stringify(opt || {});
      if (this.cache[key]) return this.cache[key];
      const x = mat(farbe, opt); x.userData.deckkraft = 1; this.materialien.push(x); this.cache[key] = x; return x;
    }
    // Eigenes Material, das sich später ändert (nicht geteilt)
    mEigen(farbe, opt) { const x = mat(farbe, opt); x.userData.deckkraft = 1; this.materialien.push(x); return x; }
    mesh(geo, material, eltern, schatten = true) { const x = new THREE.Mesh(geo, material); x.castShadow = schatten; (eltern || this.rumpf).add(x); return x; }

    // Verschmolzene Teile aus einer Liste (Form, Material, Eltern)
    fuse(teile, material, eltern, schatten = true) { return this.mesh(fusion(teile), material, eltern, schatten); }

    aussehenSetzen(a) {
      // Alte Teile weg
      for (const g of [this.huefte, this.rumpf, this.koerper]) for (const k of [...g.children]) if (k !== this.huefte && k !== this.rumpf) { g.remove(k); k.traverse(o => { if (o.geometry && !GEO_SET.has(o.geometry)) o.geometry.dispose(); }); }
      for (const x of this.materialien) x.dispose();
      this.materialien = []; this.cache = {};
      this.zopf = null;
      this.a = a = Object.assign({ haut:'#e0ac86', haare:'kurz', haarfarbe:'#3a2a1e', breite:1, groesse:1, hose:'#d32f2f', handschuhe:'#d32f2f', arme:1, ausr:{} }, a);
      const ausr = a.ausr || {}, tHs = ausr.handschuhe || 0, tSch = ausr.schuhe || 0, tMs = ausr.schutz || 0;
      const g = a.groesse, w = a.breite;
      this.mass = {
        hueftHoehe:0.88 * g, schulterY:0.5 * g, schulterX:0.215 * w * (a.frau ? 0.93 : 1), halsY:0.6 * g,
        oberarm:0.29 * g * a.arme, unterarm:0.27 * g * a.arme, ober:0.44 * g, unter:0.43 * g, kopf:0.12 * g,
        fussX:0.2 * w, armDicke:0.062 * w, beinDicke:0.085 * w
      };
      const M = this.mass, K = M.kopf;
      const haut = this.mEigen(a.haut, { rau:0.62, env:0.28 }), hose = this.m(a.hose, { rau:0.5, env:0.6 });
      const handschuh = this.mEigen(a.handschuhe, { rau:tHs > 1 ? 0.2 : 0.28, env:0.9, metall:tHs > 1 ? 0.15 : 0 });
      const weiss = this.m('#f4f4f4', { rau:0.55 }), dunkel = this.m('#1b1d24', { rau:0.5 }), akzent = this.m(a.handschuhe, { rau:0.5 });
      this.mat = { haut, hose, handschuh, schuh:weiss };
      const P = (g, p, s, r) => ({ g, p, s, r });

      // Rumpf in einem Stück: Brustkorb, Schultern, Brust- und Bauchmuskeln, Nacken
      const rumpfTeile = [
        P(GEO.zylSpitz, [0, 0.27 * g, 0], [0.19 * w, 0.48 * g, 0.13 * w], [Math.PI, 0, 0]),
        P(GEO.kugel, [0, M.schulterY - 0.02, 0], [0.245 * w * (a.frau ? 0.92 : 1), 0.1 * g, 0.125 * w]),
        a.nacken ? P(GEO.zyl, [0, M.halsY, 0], [0.115 * w, 0.14, 0.105 * w]) : P(GEO.zyl, [0, M.halsY, 0], [0.058, 0.12, 0.058])
      ];
      for (const sx of [-1, 1]) {
        if (!a.frau) {
          rumpfTeile.push(P(GEO.kugel, [sx * 0.082 * w, 0.405 * g, 0.088 * w], [0.088 * w, 0.065 * g, 0.05 * w]));
          for (let r = 0; r < 3; r++) rumpfTeile.push(P(GEO.kugel, [sx * 0.042 * w, (0.30 - r * 0.062) * g, (0.112 - r * 0.004) * w], [0.04 * w, 0.03 * g, 0.022 * w]));
          rumpfTeile.push(P(GEO.kugel, [sx * 0.07 * w, M.halsY - 0.03, -0.01], [0.07 * w, 0.04 * g, 0.05 * w], [0, 0, -sx * 0.5]));
        } else rumpfTeile.push(P(GEO.kugel, [sx * 0.04 * w, 0.24 * g, 0.11 * w], [0.045 * w, 0.03 * g, 0.022 * w]));
      }
      this.fuse(rumpfTeile, haut, this.rumpf);
      if (a.frau) {
        // Sporttop mit Trägern
        const top = [P(GEO.zyl, [0, 0.36 * g, 0.004], [0.188 * w, 0.17 * g, 0.138 * w])];
        for (const sx of [-1, 1]) top.push(P(GEO.kiste, [sx * 0.1 * w, 0.46 * g, 0], [0.035, 0.2 * g, 0.03], [0, 0, -sx * 0.08]));
        this.fuse(top, this.m(a.hose, { rau:0.5 }), this.rumpf);
      }

      // Hose an der Hüfte: Bund mit Schrift, Seitenstreifen, Gürtel
      this.mesh(GEO.hose, hose, this.huefte).scale.set(0.2 * w, 0.17 * g, 0.15 * w);
      this.huefte.children[this.huefte.children.length - 1].position.set(0, -0.025 * g, 0);
      const streif = [], streif2 = [];
      for (const sx of [-1, 1]) { streif.push(P(GEO.kiste, [sx * 0.215 * w, -0.04 * g, 0], [0.012, 0.19 * g, 0.03])); streif2.push(P(GEO.kiste, [sx * 0.222 * w, -0.04 * g, 0.026], [0.006, 0.19 * g, 0.012])); }
      this.fuse(streif, weiss, this.huefte, false); this.fuse(streif2, akzent, this.huefte, false);
      if (a.guertel) {
        const gold = this.m(GOLD, { rau:0.3, metall:0.8, env:1.1 });
        const bund = this.mesh(GEO.zyl, gold, this.huefte); bund.scale.set(0.208 * w, 0.085, 0.158 * w); bund.position.set(0, 0.07 * g, 0);
        const plat = [P(GEO.kiste, [0, 0.07 * g, 0.16 * w], [0.14, 0.1, 0.03])];
        for (const sx of [-1, 1]) plat.push(P(GEO.kiste, [sx * 0.1, 0.07 * g, 0.157 * w], [0.06, 0.06, 0.02]));
        this.fuse(plat, this.m('#fff3b0', { metall:0.85, rau:0.25, env:1.2 }), this.huefte);
        const stein = this.mesh(GEO.kugel, this.m('#d32f2f', { rau:0.15, env:1 }), this.huefte, false); stein.scale.set(0.028, 0.028, 0.012); stein.position.set(0, 0.07 * g, 0.178 * w);
      } else {
        const bund = this.mesh(GEO.zyl, this.m('#ffffff', { rau:0.6, map:bundTex() }), this.huefte, false);
        bund.scale.set(0.206 * w, 0.045, 0.156 * w); bund.position.set(0, 0.072 * g, 0);
      }

      // Kopf in einem Stück: Schädel, Kinn, Nase, Ohren
      this.kopf = new THREE.Group();
      this.kopf.position.set(0, M.halsY + 0.06 + K, 0.01);
      this.rumpf.add(this.kopf);
      const kopfTeile = [
        P(GEO.kopf, [0, 0, 0], [K * 0.92, K * 1.05, K]),
        P(GEO.kugel, [0, -K * 0.62, K * 0.45], [K * 0.55, K * 0.4, K * 0.5]),
        P(GEO.kugel, [0, -0.008, K * 1.0], [0.024, 0.032, 0.034]),
        P(GEO.klein, [0, 0.02, K * 0.96], [0.016, 0.034, 0.02])
      ];
      for (const sx of [-1, 1]) { kopfTeile.push(P(GEO.klein, [sx * 0.017, -0.017, K * 0.97], 0.012)); kopfTeile.push(P(GEO.kugel, [sx * K * 0.9, 0.0, -0.005], [0.015, 0.032, 0.022])); }
      this.fuse(kopfTeile, haut, this.kopf);
      // Augen mit Textur, Lider, Brauen, Mund mit Mundschutz, blaues Auge
      const irisFarbe = a.augen || (['#d8a031', '#c58b3a', '#d9b26a', '#e0621d'].includes(a.haarfarbe) ? '#4a86b8' : '#4a2e1a');
      const augM = this.m('#ffffff', { rau:0.2, env:0.7, map:augenTex(irisFarbe) });
      this.lider = []; this.brauen = [];
      const braueM = this.m(a.haare === 'glatze' ? '#3a2a1e' : a.haarfarbe, { rau:0.9 });
      for (const sx of [-1, 1]) {
        const au = this.mesh(GEO.kugelFein, augM, this.kopf, false); au.scale.set(0.0175, 0.0165, 0.0125); au.position.set(sx * 0.042, 0.024, K * 0.9);
        const lid = this.mesh(GEO.kugel, haut, this.kopf, false); lid.scale.set(0.0195, 0.0175, 0.0145); lid.position.set(sx * 0.042, 0.04, K * 0.9 + 0.003);
        this.lider.push(lid);
        const br = this.mesh(GEO.kiste, braueM, this.kopf, false);
        br.scale.set(0.05, 0.0125, 0.016); br.position.set(sx * 0.043, 0.056, K * 0.9 + 0.006); br.rotation.z = sx * 0.12;
        this.brauen.push({ m:br, sx });
      }
      const lippe = this.m(a.frau ? '#b8505a' : '#8a4038', { rau:0.45, env:0.6 });
      const hoehle = this.m('#3b0d12', { rau:0.8 });
      const msFarbe = tMs > 1 ? '#3f8cff' : tMs > 0 ? '#9fd0ff' : '#f2f2f2';
      this.mundHoehle = this.mesh(GEO.kugel, hoehle, this.kopf, false); this.mundHoehle.scale.set(0.034, 0.004, 0.02); this.mundHoehle.position.set(0, -0.063, K * 0.9);
      this.mundSchutz = this.mesh(GEO.kiste, this.m(msFarbe, { rau:0.3, env:0.8 }), this.kopf, false); this.mundSchutz.scale.set(0.044, 0.007, 0.012); this.mundSchutz.position.set(0, -0.058, K * 0.92); this.mundSchutz.visible = false;
      this.lippeO = this.mesh(GEO.kugel, lippe, this.kopf, false); this.lippeO.scale.set(0.036, 0.0075, 0.012); this.lippeO.position.set(0, -0.056, K * 0.925);
      this.lippeU = this.mesh(GEO.kugel, lippe, this.kopf, false); this.lippeU.scale.set(0.033, 0.0085, 0.013); this.lippeU.position.set(0, -0.069, K * 0.915);
      this.blessur = this.mEigen('#6b2f6e', { rau:0.5, env:0.2 }); this.blessur.transparent = true; this.blessur.opacity = 0; this.blessur.userData.deckkraft = 0; this.blessur.depthWrite = false;
      this.blessurMesh = this.mesh(GEO.kugel, this.blessur, this.kopf, false); this.blessurMesh.scale.set(0.034, 0.028, 0.012); this.blessurMesh.position.set(-0.046, 0.021, K * 0.915); this.blessurMesh.visible = false;
      this.haareBauen(a, M);
      if (a.brille) {
        const glas = this.m('#0b0b0b', { rau:0.1, metall:0.5, env:1.4 }), rahmen = this.m('#f2c230', { rau:0.3, metall:0.6, env:1 });
        const gl = [], rh = [P(GEO.kiste, [0, 0.03, K * 0.995], [0.03, 0.008, 0.01])];
        for (const sx of [-1, 1]) {
          gl.push(P(GEO.kiste, [sx * 0.042, 0.025, K * 0.99], [0.066, 0.04, 0.012]));
          rh.push(P(GEO.kiste, [sx * 0.042, 0.047, K * 0.99], [0.07, 0.005, 0.012])); rh.push(P(GEO.kiste, [sx * K * 0.9, 0.03, K * 0.5], [0.004, 0.005, 0.1]));
        }
        this.fuse(gl, glas, this.kopf, false); this.fuse(rh, rahmen, this.kopf, false);
      }
      if (a.bart) {
        const bart = this.mesh(GEO.kugel, this.m(a.bart === 'voll' ? a.haarfarbe : '#4a3426', { rau:0.95 }), this.kopf, false);
        if (a.bart === 'voll') { bart.scale.set(K * 0.9, K * 0.62, K * 0.75); bart.position.set(0, -0.055, 0.035); }
        else { bart.scale.set(K * 0.93, K * 0.5, K * 0.93); bart.position.set(0, -0.045, 0.004); bart.material = this.mEigen('#4a3426', { rau:0.95 }); bart.material.userData.deckkraft = 0.55; bart.material.opacity = 0.55; bart.material.transparent = true; }
      }

      // Arme: Oberarm, Unterarm, Handschuh – je Seite (Index 0 = links = +x). Daumen sitzt im Handschuh-Mesh.
      const handM = this.m('#ece7dc', { rau:0.9, env:0.2 });
      const manschetteM = this.m(tHs > 0 ? GOLD : '#f2f2f2', { rau:tHs > 0 ? 0.3 : 0.6, metall:tHs > 0 ? 0.6 : 0, env:tHs > 0 ? 1.1 : 0.5 });
      const flickM = this.m('#f6f6f6', { rau:0.5 });
      const faustGeo = fusion([P(GEO.kugelFein, [0, 0, 0], 1), P(GEO.kugelFein, [0.82, -0.3, 0.1], [0.38, 0.5, 0.36])]);
      this.arme = [0, 1].map(() => {
        const oben = this.mesh(GEO.oberarm, haut), unten = this.mesh(GEO.unterarm, haut), schulter = this.mesh(GEO.kugel, haut);
        const hs = this.mesh(faustGeo, handschuh);
        const flick = this.mesh(GEO.kugel, flickM, hs, false);
        const manschette = this.mesh(GEO.zyl, manschetteM, hs, false);
        const band = this.mesh(GEO.zyl, handM);
        flick.userData.keinSchatten = manschette.userData.keinSchatten = true;
        return { oben, unten, schulter, hs, band, flick, manschette, roll:0, ziel:V(0, 0, 0), zielAkt:V(0.12, 0.55, 0.28), E:V(), T:V() };
      });
      this.arme[1].zielAkt.x = -0.12;
      // Beine mit Muskelprofil, Hosenbein mit Saum, hohe Boxstiefel mit Schnürung
      const sohleM = this.m(tSch > 1 ? GOLD : a.handschuhe, { rau:0.5, metall:tSch > 1 ? 0.6 : 0 });
      const stiefelGeo = fusion([P(GEO.kugelFein, [0, 0.07, 0.05], [0.062, 0.062, 0.145]), P(GEO.kugelFein, [0, 0.055, 0.15], [0.058, 0.05, 0.06]), P(GEO.zyl, [0, 0.165, -0.005], [0.054, 0.155, 0.056])]);
      const sohleGeo = fusion([P(GEO.kiste, [0, 0.012, 0.062], [0.12, 0.024, 0.27]), P(GEO.zyl, [0, 0.2, -0.005], [0.059, 0.025, 0.061])]);
      const schnuerGeo = fusion([0, 1, 2].map(n => P(GEO.kiste, [0, 0.13 + n * 0.035 - (n === 0 ? 0.04 : 0), 0.05 - n * 0.016 + (n === 0 ? 0.09 : 0)], [0.05, 0.007, 0.012], [n === 0 ? 0.5 : -0.2, 0, 0])));
      this.beine = [0, 1].map(() => {
        const b = { ober:this.mesh(GEO.schenkel, haut, this.koerper), unter:this.mesh(GEO.wade, haut, this.koerper),
          hosenbein:this.mesh(GEO.hose, hose, this.koerper), saum:this.mesh(GEO.zyl, weiss, this.koerper, false),
          stiefel:this.mesh(stiefelGeo, weiss, this.koerper), sohle:this.mesh(sohleGeo, sohleM, this.koerper, false), schnuer:this.mesh(schnuerGeo, dunkel, this.koerper, false), E:V(), T:V(), M:V() };
        return b;
      });
      this.stand = { hx:0, hy:0, hz:0, dreh:0, neig:0, roll:0, kopfX:0, kopfY:0, kopfZ:0, kipp:0, rueck:0 };
      this.ichSicht(!!this.ich);
    }

    haareBauen(a, M) {
      if (a.haare === 'glatze') { this.mat.haut.roughness = 0.42; return; }
      const hm = this.m(a.haarfarbe, { rau:0.55, env:0.7 }), K = M.kopf;
      const P = (g, p, s, r) => ({ g, p, s, r });
      const kappe = (sy = 1) => P(GEO.kappe, [0, 0.012, -0.005], [K * 0.98, K * 1.08 * sy, K * 1.04], [-0.25, 0, 0]);
      let t = [];
      switch (a.haare) {
        case 'muetze': {
          t = [P(GEO.kappe, [0, 0.02, -0.005], [K * 1.04, K * 1.2, K * 1.06], [-0.2, 0, 0])];
          const wm = this.m('#e8e8e8', { rau:0.9 });
          this.fuse([P(GEO.ring, [0, 0.035, 0], [K * 0.98, K * 0.98, K * 0.7], [Math.PI / 2 - 0.2, 0, 0]), P(GEO.kugel, [0, K * 1.18, -0.01], 0.03)], wm, this.kopf, false);
          break;
        }
        case 'zopf': {
          t = [kappe(), P(GEO.kugel, [0, 0.05, -K * 1.0], [0.045, 0.05, 0.05])];
          const z2 = this.mesh(GEO.zylSpitz, hm, this.kopf, false); z2.scale.set(0.035, 0.2, 0.035); z2.position.set(0, -0.06, -K * 1.12); z2.rotation.x = 0.35;
          this.zopf = z2;
          const gum = this.mesh(GEO.ring, this.m('#e0245e', { rau:0.5 }), this.kopf, false); gum.scale.set(0.034, 0.034, 0.034); gum.position.set(0, 0.03, -K * 1.05); gum.rotation.x = Math.PI / 2 + 0.3;
          break;
        }
        case 'dutt': t = [kappe(), P(GEO.kugel, [0, K * 0.95, -K * 0.45], 0.06)]; break;
        case 'locken': {
          for (let i = 0; i < 14; i++) {
            const w = i / 14 * Math.PI * 2, h = i % 2 ? 0.55 : 0.85;
            t.push(P(GEO.kugel, [Math.cos(w) * K * 0.82 * Math.sin(h * 1.5), K * 0.55 * h + 0.03, Math.sin(w) * K * 0.82 * Math.sin(h * 1.5) - 0.01], 0.046));
          }
          t.push(P(GEO.kugel, [0, K * 0.62, -0.01], [K * 0.9, K * 0.5, K * 0.9]));
          break;
        }
        case 'tolle': t = [kappe(0.95), P(GEO.kugel, [0, K * 0.95, K * 0.45], [0.075, 0.05, 0.08], [0.4, 0, 0])]; break;
        case 'stirnband': {
          t = [kappe()];
          const r = this.mesh(GEO.ring, this.m(a.handschuhe, { rau:0.7 }), this.kopf, false); r.scale.set(K * 0.97, K * 0.97, K * 0.5); r.rotation.x = Math.PI / 2 - 0.15; r.position.set(0, 0.04, 0);
          break;
        }
        default:
          t = [kappe(0.9)];
          for (const sx of [-1, 1]) t.push(P(GEO.kugel, [sx * K * 0.88, 0.03, 0.0], [0.014, 0.03, 0.03]));
      }
      this.fuse(t, hm, this.kopf, false);
    }

    // Eigener Boxer in der Spielersicht: halb durchsichtig, damit man den Gegner sieht
    durchsichtig(st) {
      this.transparenz = st;
      for (const x of this.materialien) {
        x.opacity = x.userData.deckkraft * (1 - st);
        x.transparent = x.opacity < 1;
        x.depthWrite = true;
        x.needsUpdate = true;
      }
      for (const kind of this.wurzel.children) kind.traverse(o => { if (o.isMesh) o.castShadow = st < 0.5 && !o.userData.keinSchatten; });
    }

    // Ich-Sicht: nur Unterarme und Handschuhe bleiben sichtbar (die Kamera sitzt im Kopf)
    ichSicht(an) {
      this.ich = an;
      const bleiben = new Set();
      for (const arm of this.arme) for (const x of [arm.unten, arm.hs, arm.band, arm.flick, arm.manschette]) bleiben.add(x);
      this.wurzel.traverse(o => { if (o.isMesh) o.visible = !an || bleiben.has(o); });
      if (!an) { this.mundSchutz.visible = this.fz.mund > 0.2; this.blessurMesh.visible = this.fz.blessur > 0.02; }
    }

    farbenSetzen(hose, handschuhe) {
      this.mat.hose.color.set(hose); this.mat.handschuh.color.set(handschuhe);
    }

    /* Gesicht und Haut: Blinzeln, Schmerz, Schreien, Freude, blaues Auge, Schweiß */
    gesicht(z, dt) {
      const F = this.fz, M = this.mass;
      this.gesichtZeit -= dt;
      let lid = 0, mund = 0, braue = 0;
      const pu = klemm((z.puste != null ? z.puste : 100) / 100, 0, 1);
      if (pu < 0.4) mund = 0.25 + 0.15 * Math.sin(this.zeit * 9);          // hechelt
      switch (z.aktion) {
        case 'getroffen': case 'gebrochen': lid = 0.8; mund = 0.85; braue = 0.7; break;
        case 'schlag': lid = 0.1; mund = z.a && (z.a.art === 'volltreffer' || z.a.art === 'ramm') ? 0.9 : 0.4; braue = -0.9; break;
        case 'block': lid = 0.55; mund = 0; braue = -0.5; break;
        case 'ausweichen': case 'ducken': lid = -0.2; braue = 0.5; break;
        case 'boden': lid = 1; mund = 0.5; braue = 0.5; break;
        case 'aufstehen': lid = 0.45; mund = 0.3; braue = 0.6; break;
        case 'offen': lid = 0.3; mund = 0.6; braue = 0.8; break;
        case 'jubel': lid = 0.35; mund = 0.95; braue = 0.7; break;
        case 'enttaeuscht': lid = 0.5; braue = 0.9; break;
        default: if (this.gesichtZeit < 0) { if (this.gesichtZeit < -0.12) this.gesichtZeit = 2 + Math.random() * 3; lid = 1; } else if (z.aktion === 'bereit') braue = -0.2;
      }
      const f = 1 - Math.exp(-dt * (lid === 1 ? 40 : 14));
      F.lid = lerp(F.lid, lid, f); F.mund = lerp(F.mund, mund, 1 - Math.exp(-dt * 16)); F.braue = lerp(F.braue, braue, 1 - Math.exp(-dt * 14));
      // Blaues Auge und Schweiß: aus dem Zustand des Kämpfers
      const verletzt = z.hpMax ? 1 - klemm(z.hp / z.hpMax, 0, 1) : 0;
      F.blessur = lerp(F.blessur, klemm((verletzt - 0.2) / 0.5, 0, 1), 1 - Math.exp(-dt * 2));
      F.schweiss = lerp(F.schweiss, klemm(1 - pu * 0.8 + verletzt * 0.4 - 0.05, 0, 1), 1 - Math.exp(-dt * 0.6));
      const K = M.kopf;
      for (const lidMesh of this.lider) {
        const zu = klemm(F.lid, -0.3, 1);
        lidMesh.position.y = lerp(0.043, 0.026, Math.max(0, zu)) + (zu < 0 ? -zu * 0.012 : 0);
        lidMesh.scale.y = lerp(0.006, 0.0175, Math.max(0, zu));
        lidMesh.visible = !this.ich && zu > 0.02;
      }
      for (const b of this.brauen) {
        b.m.position.y = 0.056 + F.braue * 0.007; b.m.rotation.z = b.sx * (0.12 + F.braue * (F.braue > 0 ? -0.2 : -0.35));
        if (F.braue < -0.05) b.m.position.y -= 0.004 * -F.braue;
      }
      const offen = clamp01(F.mund);
      this.lippeU.position.y = -0.069 - offen * 0.02; this.lippeU.scale.y = 0.0085 + offen * 0.002;
      this.lippeO.position.y = -0.056 + offen * 0.001;
      this.mundHoehle.scale.y = 0.004 + offen * 0.0165; this.mundHoehle.position.y = -0.063 - offen * 0.0085;
      this.mundSchutz.visible = !this.ich && offen > 0.18; this.mundSchutz.position.y = -0.058 - offen * 0.002;
      this.blessur.opacity = this.blessur.userData.deckkraft = F.blessur * 0.55;
      this.blessur.opacity *= 1 - (this.transparenz || 0);
      this.blessurMesh.visible = !this.ich && F.blessur > 0.03;
      // Schweiß: Haut wird glänzender
      this.mat.haut.roughness = this.a.haare === 'glatze' ? lerp(0.5, 0.26, F.schweiss) : lerp(0.64, 0.3, F.schweiss);
    }

    /* Pose aus dem Zustand des Boxers (gleiche Felder wie in RF.Kampf).
       z: Boxer-Zustand, takt: RF.TAKT, dt: Sekunden seit dem letzten Bild, phase: Kampfphase */
    pose(z, dt, phase) {
      this.zeit += dt;
      const M = this.mass, T = 1 / 60;
      const sek = z.t * T;
      // Grundhaltung: Deckung vor dem Kinn, leichtes Wippen
      const wipp = Math.sin(this.zeit * 5.2) * 0.012, weben = Math.sin(this.zeit * 2.1) * 0.03;
      const st = { hx:weben, hy:-0.04 + wipp, hz:0, dreh:Math.sin(this.zeit * 2.1) * 0.06, neig:0.12, roll:0, kopfX:0.05, kopfY:0, kopfZ:0, kipp:0, rueck:0 };
      const hand = [V(0.12, 0.5, 0.26), V(-0.12, 0.5, 0.26)];
      const glut = [0, 0];
      const ziel = (i, x, y, zz) => hand[i].set(i === 0 ? x : -x, y, zz);
      const L = (i, a0, a1, t) => { hand[i].lerpVectors(a0, a1, t); };

      switch (z.aktion) {
        case 'block':
          ziel(0, 0.06, 0.6, 0.2); ziel(1, 0.06, 0.6, 0.2); st.neig = 0.28; st.kopfX = 0.3; st.hy -= 0.05;
          break;
        case 'ausweichen': {
          const k = hinHalten(z.t / RF.AUSWEICHEN.dauer);
          const sx = z.seite === 'L' ? 1 : -1;
          st.hx = sx * 0.4 * k; st.roll = -sx * 0.32 * k; st.kopfZ = -sx * 0.15 * k; st.hy -= 0.06 * k;
          ziel(0, 0.11, 0.55, 0.22); ziel(1, 0.11, 0.55, 0.22);
          break;
        }
        case 'ducken': {
          const k = hinHalten(z.t / RF.DUCKEN.dauer, 0.2, 0.6);
          st.hy -= 0.36 * k; st.neig = 0.12 + 0.45 * k; st.kopfX = 0.2 * k;
          ziel(0, 0.1, 0.48, 0.24); ziel(1, 0.1, 0.48, 0.24);
          break;
        }
        case 'schlag': this.schlagPose(z, st, hand, glut); break;
        case 'offen': {
          const k = Math.min(1, z.t / 8);
          st.neig = 0.12 + 0.22 * k; st.hz = 0.08 * k; st.dreh = Math.sin(this.zeit * 9) * 0.1; st.roll = Math.sin(this.zeit * 6) * 0.08;
          ziel(0, 0.2, 0.25, 0.25); ziel(1, 0.2, 0.25, 0.25); st.kopfX = -0.1;
          break;
        }
        case 'getroffen': case 'gebrochen': {
          const k = z.aktion === 'gebrochen' ? 0.7 : 1 - glatt(z.t / Math.max(1, z.dauer));
          const kopf = z.trefferArt ? RF.ANGRIFFE[z.trefferArt].kopf : true;
          const sx = z.trefferSeite === 'L' ? -1 : 1;     // Hand des Angreifers: links trifft meine rechte Seite
          if (kopf) { st.kopfX = -0.45 * k; st.kopfY = sx * 0.35 * k; st.neig = 0.12 - 0.25 * k; st.hz = -0.08 * k; st.roll = sx * 0.1 * k; }
          else { st.neig = 0.12 + 0.45 * k; st.hz = -0.05 * k; st.kopfX = 0.15; }
          ziel(0, 0.2, 0.38, 0.18); ziel(1, 0.2, 0.38, 0.18);
          if (z.aktion === 'gebrochen') { st.dreh = Math.sin(this.zeit * 7) * 0.15; ziel(0, 0.24, 0.2, 0.15); ziel(1, 0.24, 0.2, 0.15); }
          break;
        }
        case 'boden': {
          const k = glatt(sek / 0.7);
          st.kipp = -1.42 * k; st.hy = -0.02; st.neig = -0.1 * k; st.kopfX = -0.2 * k;
          ziel(0, 0.32, 0.25 + 0.15 * k, 0.05 + Math.sin(this.zeit * 3) * 0.04 * k); ziel(1, 0.32, 0.25 + 0.15 * k, 0.05);
          if (z.tippen && k > 0.9) st.roll = Math.sin(this.zeit * 14) * 0.05;
          break;
        }
        case 'aufstehen': {
          const k = 1 - glatt(sek / 0.9);
          st.kipp = -1.42 * k; st.neig = 0.2;
          break;
        }
        case 'warten':
          st.rueck = Math.min(1, sek / 0.6) * 0.75; ziel(0, 0.2, 0.3, 0.12); ziel(1, 0.2, 0.3, 0.12); st.neig = 0.05;
          break;
        case 'jubel': {
          const k = raus(sek / 0.5);
          ziel(0, 0.25, lerp(0.5, 1.15, k), lerp(0.26, 0.05, k)); ziel(1, 0.25, lerp(0.5, 1.15, k), lerp(0.26, 0.05, k));
          st.hy += Math.abs(Math.sin(this.zeit * 6)) * 0.08 * k; st.kopfX = -0.3 * k; st.neig = -0.08;
          break;
        }
        case 'enttaeuscht':
          ziel(0, 0.2, 0.15, 0.12); ziel(1, 0.2, 0.15, 0.12); st.kopfX = 0.45; st.neig = 0.25;
          break;
      }
      // Ich-Sicht: Deckung etwas weiter auseinander und tiefer, damit der Gegner zu sehen bleibt
      if (this.ich) for (let i = 0; i < 2; i++) {
        if (z.aktion === 'schlag' && (z.seite === 'L' ? 0 : 1) === i) continue;
        hand[i].x *= 1.6; hand[i].y -= 0.08;
      }
      if (z.platt && z.aktion === 'bereit') { st.neig += 0.15; st.hy -= 0.03 + Math.sin(this.zeit * 8) * 0.02; ziel(0, 0.16, 0.38, 0.22); ziel(1, 0.16, 0.38, 0.22); }

      // Weich nachführen (schnell, damit Schläge knackig bleiben)
      const f = 1 - Math.exp(-dt * (z.aktion === 'schlag' ? 40 : 18));
      for (const key of Object.keys(st)) this.stand[key] = lerp(this.stand[key], st[key], key === 'kipp' ? 1 - Math.exp(-dt * 12) : f);
      for (let i = 0; i < 2; i++) {
        this.arme[i].zielAkt.lerp(hand[i], 1 - Math.exp(-dt * (z.aktion === 'schlag' ? 45 : 20)));
        this.glut[i] = lerp(this.glut[i], glut[i], 1 - Math.exp(-dt * 20));
      }
      for (let i = 0; i < 2; i++) this.rollZiel[i] = 0;
      if (z.aktion === 'schlag' && z.a) this.rollZiel[z.seite === 'L' ? 0 : 1] = rollFuer(z);
      this.gesicht(z, dt);
      this.anwenden();
    }

    // Ausholen, Treffermoment, Erholung – für jede Schlagart eigene Wege der Hand
    schlagPose(z, st, hand, glut) {
      const a = z.a; if (!a) return;
      const i = z.seite === 'L' ? 0 : 1, sx = i === 0 ? 1 : -1;
      const anderer = 1 - i;
      const aus = a.aus, tr = a.tr, erh = a.erh, t = z.t;
      const p = t < aus ? t / aus : t < aus + tr ? 1 + (t - aus) / tr : 2 + (t - aus - tr) / erh;   // 0..1 ausholen, 1..2 treffer, 2..3 zurück
      const V3 = (x, y, zz) => V(sx * x, y, zz);
      let rueck, vor, dreh = 0.25, neig = 0.12, hy = 0;
      switch (a.art) {
        case 'koerper': rueck = V3(0.2, 0.36, 0.06); vor = V3(0.04, 0.14, 0.7); neig = 0.3; hy = -0.08; break;
        case 'gerade': rueck = V3(0.18, 0.52, 0.04); vor = V3(0.03, 0.56, 0.76); break;
        case 'haken': rueck = V3(0.44, 0.5, -0.06); vor = V3(-0.08, 0.56, 0.58); dreh = 0.55; break;
        case 'aufwaerts': case 'volltreffer': rueck = V3(0.16, 0.0, 0.12); vor = V3(0.0, 0.78, 0.55); dreh = 0.35; hy = -0.12; break;
        case 'ramm': rueck = V3(0.32, 0.62, -0.38); vor = V3(0.03, 0.56, 0.88); dreh = 0.5; break;
        default: rueck = V3(0.18, 0.5, 0.05); vor = V3(0.05, 0.55, 0.75);
      }
      const guard = V3(0.12, 0.5, 0.26);
      if (p < 1) {
        // Ausholen: das sichtbare Vorzeichen. Der Handschuh glüht immer stärker.
        const k = glatt(p);
        hand[i].lerpVectors(guard, rueck, k);
        st.dreh = sx * dreh * k; st.hy += hy * k * 0.6; st.neig = 0.12 - (a.art === 'ramm' ? 0.25 * k : 0);
        if (a.art === 'aufwaerts' || a.art === 'volltreffer') { st.hy -= 0.14 * k; st.roll = sx * 0.12 * k; }
        glut[i] = 0.25 + 0.75 * k;
        if (a.finteBei && t >= a.finteBei * 0.8) glut[i] *= 0.6;
      } else if (p < 2) {
        const k = raus(p - 1);
        if (a.art === 'haken') {
          // Bogen von außen nach innen
          const w = k * Math.PI / 2;
          hand[i].set(sx * (0.44 * Math.cos(w) - 0.08 * Math.sin(w)), 0.56, lerp(-0.06, 0.58, Math.sin(w)));
        } else hand[i].lerpVectors(rueck, vor, k);
        st.dreh = -sx * dreh * 0.8 * k; st.neig = neig; st.hy += hy;
        st.hz = a.art === 'ramm' ? 0.28 * k : 0.06 * k;
        glut[i] = 1;
      } else {
        const k = glatt(p - 2);
        hand[i].lerpVectors(vor, guard, k);
        st.dreh = -sx * dreh * 0.8 * (1 - k); st.neig = lerp(neig, 0.12, k); st.hz = (a.art === 'ramm' ? 0.28 : 0.06) * (1 - k);
      }
      hand[anderer].set(-sx * 0.1, 0.56, 0.22);
      if (a.art === 'volltreffer' && p < 2) glut[i] = 1.6;
    }

    anwenden() {
      const M = this.mass, st = this.stand;
      this.wurzel.updateMatrixWorld();
      // Hüfte und Oberkörper
      this.huefte.position.set(st.hx, M.hueftHoehe + st.hy, st.hz - st.rueck);
      this.huefte.rotation.set(0, st.dreh * 0.4, st.roll * 0.4);
      this.rumpf.rotation.set(st.neig, st.dreh * 0.6, st.roll * 0.6);
      this.kopf.rotation.set(st.kopfX, st.kopfY, st.kopfZ);
      this.koerper.rotation.x = st.kipp;
      this.koerper.position.z = -st.rueck * 0 + (st.kipp ? Math.sin(-st.kipp) * -0.05 : 0);
      if (this.zopf) this.zopf.rotation.x = 0.35 + Math.sin(this.zeit * 5) * 0.12;
      // Atmung: Brustkorb hebt und senkt sich leicht
      this.rumpf.scale.set(1 + Math.sin(this.zeit * (4 + this.fz.schweiss * 4)) * 0.008, 1, 1 + Math.sin(this.zeit * (4 + this.fz.schweiss * 4)) * 0.012);
      // Arme im Rumpf-Raum
      for (let i = 0; i < 2; i++) {
        const arm = this.arme[i], sx = i === 0 ? 1 : -1;
        const S = tmpD.set(sx * M.schulterX, M.schulterY, 0);
        const pol = V(sx * 0.75, -1, -0.35);
        ik(S, arm.zielAkt, M.oberarm, M.unterarm, pol, arm.E, arm.T);
        glied(arm.oben, S, arm.E, M.armDicke * 1.1);
        glied(arm.unten, arm.E, arm.T, M.armDicke);
        arm.schulter.position.copy(S); arm.schulter.scale.set(M.armDicke * 1.5, M.armDicke * 1.4, M.armDicke * 1.4);
        // Handschuh: etwas über das Handgelenk hinaus, zeigt in Unterarm-Richtung. Die Handfläche zeigt nach innen,
        // bei Geraden und Haken dreht sich die Faust ein (Roll)
        tmpA.subVectors(arm.T, arm.E).normalize();
        arm.roll = lerp(arm.roll, this.rollZiel[i], 0.35);
        tmpX.set(-sx, 0, 0).addScaledVector(tmpA, sx * tmpA.x);
        if (tmpX.lengthSq() < 1e-4) tmpX.set(0, 0, 1);
        tmpX.normalize(); tmpZ.crossVectors(tmpX, tmpA);
        tmpM.makeBasis(tmpX, tmpA, tmpZ); tmpQ.setFromRotationMatrix(tmpM);
        tmpQ2.setFromAxisAngle(ACHSE_Y, arm.roll * sx); tmpQ.multiply(tmpQ2);
        arm.hs.position.copy(arm.T).addScaledVector(tmpA, 0.075);
        arm.hs.quaternion.copy(tmpQ);
        arm.hs.scale.set(0.092, 0.118, 0.1);
        // Kindmeshes im lokalen Raum des Handschuhs (Skalierung des Elternteils ausgleichen)
        const kS = arm.hs.scale;
        arm.flick.position.set(-0.93, 0.1, 0); arm.flick.scale.set(0.09, 0.4, 0.34);
        arm.manschette.position.set(0, -0.78, 0); arm.manschette.scale.set(0.62, 0.33, 0.62 * 0.92);
        arm.band.position.copy(arm.T).addScaledVector(tmpA, -0.055); arm.band.quaternion.copy(tmpQ); arm.band.scale.set(0.056, 0.05, 0.056);
      }
      const e = this.mat.handschuh.emissive;
      const g = Math.max(this.glut[0], this.glut[1]);
      e.setRGB(1, 0.5, 0.08).multiplyScalar(Math.min(1.2, g) * 0.9);
      // Beine: Hüftgelenke (im Körper-Raum) zu festen Füßen
      for (let i = 0; i < 2; i++) {
        const b = this.beine[i], sx = i === 0 ? 1 : -1;
        const H = tmpD.set(sx * 0.1 * this.a.breite, 0, 0).applyEuler(this.huefte.rotation).add(this.huefte.position);
        H.y -= 0.05;
        // Am Boden liegen die Beine gestreckt (sonst stünden die Knie in die Luft)
        const liegt = klemm(-st.kipp / 1.42, 0, 1);
        const F = V(sx * M.fussX * (1 - liegt * 0.3), lerp(0.13, H.y - (M.ober + M.unter) * 0.97, liegt), lerp((i === 0 ? 0.17 : -0.17) - st.rueck, H.z + 0.1, liegt));
        ik(H, F, M.ober, M.unter, V(sx * 0.25, 0, 1), b.E, b.T);
        glied(b.ober, H, b.E, M.beinDicke * 1.08);
        glied(b.unter, b.T, b.E, M.beinDicke * 0.9);
        // Hosenbein: das obere Drittel des Oberschenkels, mit hellem Saum
        b.M.lerpVectors(H, b.E, 0.42);
        glied(b.hosenbein, H, b.M, M.beinDicke * 1.5);
        tmpA.subVectors(b.M, H); const saumL = 0.028;
        b.saum.position.copy(b.M); b.saum.quaternion.copy(b.hosenbein.quaternion); b.saum.scale.set(M.beinDicke * 1.62, saumL, M.beinDicke * 1.62);
        // Stiefel: ein Stück (Schuh, Kappe, Schaft), dazu Sohle mit Zierstreifen und Schnürung; sie folgen dem Fuß
        b.stiefel.position.set(b.T.x, 0, b.T.z); b.sohle.position.copy(b.stiefel.position); b.schnuer.position.copy(b.stiefel.position);
      }
    }

    // Weltposition eines Handschuhs (für Treffer-Funken)
    handschuhWelt(i, out) { return this.arme[i].hs.getWorldPosition(out || V()); }
    kopfWelt(out) { return this.kopf.getWorldPosition(out || V()); }
  }

  return { Boxer3D, glatt, raus, lerp, klemm, fusion };
})();
