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
  // Kurve für Ausweichen/Ducken: schnell hin, halten, zurück
  const hinHalten = (t, hin = 0.22, ab = 0.62) => t < hin ? raus(t / hin) : t < ab ? 1 : 1 - glatt((t - ab) / (1 - ab));

  const GEO = {
    zyl: new THREE.CylinderGeometry(1, 1, 1, 8, 1),
    zylSpitz: new THREE.CylinderGeometry(0.75, 1, 1, 8, 1),
    hose: new THREE.CylinderGeometry(1, 1.07, 1, 10, 1),
    kugel: new THREE.IcosahedronGeometry(1, 1),
    kugelFein: new THREE.SphereGeometry(1, 14, 10),
    kappe: new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    kiste: new THREE.BoxGeometry(1, 1, 1),
    ring: new THREE.TorusGeometry(1, 0.18, 6, 16)
  };

  function mat(farbe, opt = {}) {
    return new THREE.MeshStandardMaterial({ color:farbe, roughness:opt.rau != null ? opt.rau : 0.7, metalness:opt.metall || 0, flatShading:opt.flach !== false });
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
      this.aussehenSetzen(aussehen);
    }

    m(farbe, opt) { const x = mat(farbe, opt); x.userData.deckkraft = 1; this.materialien.push(x); return x; }
    mesh(geo, material, eltern) { const x = new THREE.Mesh(geo, material); x.castShadow = true; (eltern || this.rumpf).add(x); return x; }

    aussehenSetzen(a) {
      // Alte Teile weg
      for (const g of [this.huefte, this.rumpf, this.koerper]) for (const k of [...g.children]) if (k !== this.huefte && k !== this.rumpf) { g.remove(k); }
      for (const x of this.materialien) x.dispose();
      this.materialien = [];
      this.a = a = Object.assign({ haut:'#e0ac86', haare:'kurz', haarfarbe:'#3a2a1e', breite:1, groesse:1, hose:'#d32f2f', handschuhe:'#d32f2f', arme:1 }, a);
      const g = a.groesse, w = a.breite;
      this.mass = {
        hueftHoehe:0.88 * g, schulterY:0.5 * g, schulterX:0.215 * w * (a.frau ? 0.93 : 1), halsY:0.6 * g,
        oberarm:0.29 * g * a.arme, unterarm:0.27 * g * a.arme, ober:0.44 * g, unter:0.43 * g, kopf:0.12 * g,
        fussX:0.2 * w, armDicke:0.062 * w, beinDicke:0.085 * w
      };
      const M = this.mass;
      const haut = this.m(a.haut, { rau:0.8 }), hose = this.m(a.hose, { rau:0.55 }), handschuh = this.m(a.handschuhe, { rau:0.32, flach:false });
      const schuh = this.m('#f4f4f4', { rau:0.6 }), sohle = this.m('#222222');
      this.mat = { haut, hose, handschuh, schuh };

      // Rumpf: Brustkorb breit oben, schmal an der Taille
      const brust = this.mesh(GEO.zylSpitz, haut);
      brust.scale.set(0.19 * w, 0.48 * g, 0.13 * w); brust.position.set(0, 0.27 * g, 0); brust.rotation.x = Math.PI;
      const schultern = this.mesh(GEO.kugel, haut);
      schultern.scale.set(0.24 * w * (a.frau ? 0.92 : 1), 0.1 * g, 0.12 * w); schultern.position.set(0, M.schulterY - 0.02, 0);
      if (a.frau) {
        const top = this.mesh(GEO.zyl, this.m(a.hose, { rau:0.5 }));
        top.scale.set(0.185 * w, 0.17 * g, 0.135 * w); top.position.set(0, 0.36 * g, 0.004);
      }
      if (a.nacken) { const n = this.mesh(GEO.zyl, haut); n.scale.set(0.11 * w, 0.14, 0.1 * w); n.position.set(0, M.halsY, 0); }
      else { const n = this.mesh(GEO.zyl, haut); n.scale.set(0.055, 0.12, 0.055); n.position.set(0, M.halsY, 0); }

      // Hose an der Hüfte, Gürtel
      const h = this.mesh(GEO.hose, hose, this.huefte);
      h.scale.set(0.2 * w, 0.17 * g, 0.15 * w); h.position.set(0, -0.025 * g, 0);
      const streifen = this.mesh(GEO.kiste, this.m('#f2f2f2'), this.huefte);
      for (const sx of [-1, 1]) { const st = sx < 0 ? streifen : this.mesh(GEO.kiste, streifen.material, this.huefte); st.scale.set(0.012, 0.19 * g, 0.03); st.position.set(sx * 0.215 * w, -0.04 * g, 0); }
      const bund = this.mesh(GEO.zyl, this.m(a.guertel ? '#d4af37' : '#f2f2f2', { rau:0.4, metall:a.guertel ? 0.6 : 0 }), this.huefte);
      bund.scale.set(0.205 * w, a.guertel ? 0.08 : 0.035, 0.155 * w); bund.position.set(0, 0.07 * g, 0);
      if (a.guertel) { const sch = this.mesh(GEO.kiste, this.m('#fff3b0', { metall:0.7, rau:0.3 }), this.huefte); sch.scale.set(0.12, 0.09, 0.03); sch.position.set(0, 0.07 * g, 0.16 * w); }

      // Kopf
      this.kopf = new THREE.Group();
      this.kopf.position.set(0, M.halsY + 0.06 + M.kopf, 0.01);
      this.rumpf.add(this.kopf);
      const k = this.mesh(GEO.kugel, haut, this.kopf);
      k.scale.set(M.kopf * 0.92, M.kopf * 1.05, M.kopf);
      const nase = this.mesh(GEO.kugel, haut, this.kopf); nase.scale.set(0.022, 0.03, 0.03); nase.position.set(0, -0.005, M.kopf * 0.98);
      const augeM = this.m('#141414', { rau:0.3 });
      for (const sx of [-1, 1]) {
        const au = this.mesh(GEO.kugel, augeM, this.kopf); au.scale.setScalar(0.014); au.position.set(sx * 0.04, 0.025, M.kopf * 0.9);
        const br = this.mesh(GEO.kiste, this.m(a.haare === 'glatze' ? '#3a2a1e' : a.haarfarbe), this.kopf);
        br.scale.set(0.045, 0.012, 0.015); br.position.set(sx * 0.042, 0.055, M.kopf * 0.9); br.rotation.z = sx * 0.18;
      }
      const mund = this.mesh(GEO.kiste, this.m('#7a3b32'), this.kopf); mund.scale.set(0.05, 0.012, 0.01); mund.position.set(0, -0.06, M.kopf * 0.92);
      this.haareBauen(a, M);
      if (a.brille) {
        const glas = this.m('#0b0b0b', { rau:0.15, metall:0.4 });
        for (const sx of [-1, 1]) { const gl = this.mesh(GEO.kiste, glas, this.kopf); gl.scale.set(0.06, 0.035, 0.012); gl.position.set(sx * 0.042, 0.025, M.kopf * 0.98); }
        const steg = this.mesh(GEO.kiste, glas, this.kopf); steg.scale.set(0.03, 0.008, 0.01); steg.position.set(0, 0.03, M.kopf * 0.99);
      }
      if (a.bart) {
        const bart = this.mesh(GEO.kugel, this.m(a.bart === 'voll' ? a.haarfarbe : '#4a3426', { rau:0.95 }), this.kopf);
        if (a.bart === 'voll') { bart.scale.set(M.kopf * 0.9, M.kopf * 0.62, M.kopf * 0.75); bart.position.set(0, -0.055, 0.035); }
        else { bart.scale.set(M.kopf * 0.93, M.kopf * 0.5, M.kopf * 0.93); bart.position.set(0, -0.045, 0.004); bart.material.userData.deckkraft = 0.55; }
      }

      // Arme: Oberarm, Unterarm, Handschuh – je Seite (Index 0 = links = +x)
      this.arme = [0, 1].map(i => {
        const oben = this.mesh(GEO.zyl, haut), unten = this.mesh(GEO.zyl, haut), schulter = this.mesh(GEO.kugel, haut);
        const hs = this.mesh(GEO.kugelFein, handschuh); const daumen = this.mesh(GEO.kugelFein, handschuh);
        const band = this.mesh(GEO.zyl, this.m('#f2f2f2'));
        return { oben, unten, schulter, hs, daumen, band, ziel:V(0, 0, 0), zielAkt:V(i ? -0.12 : 0.12, 0.55, 0.28), E:V(), T:V() };
      });
      // Beine
      this.beine = [0, 1].map(() => ({ ober:this.mesh(GEO.zyl, haut, this.koerper), unter:this.mesh(GEO.zylSpitz, haut, this.koerper),
        hosenbein:this.mesh(GEO.hose, hose, this.koerper), knie:this.mesh(GEO.kugel, haut, this.koerper),
        schuh:this.mesh(GEO.kiste, schuh, this.koerper), sohle:this.mesh(GEO.kiste, sohle, this.koerper), E:V(), T:V(), M:V() }));
      this.stand = { hx:0, hy:0, hz:0, dreh:0, neig:0, roll:0, kopfX:0, kopfY:0, kopfZ:0, kipp:0, rueck:0 };
      this.ichSicht(!!this.ich);
    }

    haareBauen(a, M) {
      if (a.haare === 'glatze') { this.mat.haut.roughness = 0.45; return; }
      const hm = this.m(a.haarfarbe, { rau:0.9 });
      const kappe = (sy = 1) => { const x = this.mesh(GEO.kappe, hm, this.kopf); x.scale.set(M.kopf * 0.98, M.kopf * 1.08 * sy, M.kopf * 1.04); x.position.set(0, 0.012, -0.005); x.rotation.x = -0.25; return x; };
      switch (a.haare) {
        case 'muetze': {
          const mu = this.mesh(GEO.kappe, hm, this.kopf); mu.scale.set(M.kopf * 1.04, M.kopf * 1.2, M.kopf * 1.06); mu.position.set(0, 0.02, -0.005); mu.rotation.x = -0.2;
          const r = this.mesh(GEO.ring, this.m('#e8e8e8', { rau:0.9 }), this.kopf); r.scale.set(M.kopf * 0.98, M.kopf * 0.98, M.kopf * 0.7); r.rotation.x = Math.PI / 2 - 0.2; r.position.set(0, 0.035, 0.0);
          break;
        }
        case 'zopf': {
          kappe();
          const z1 = this.mesh(GEO.kugel, hm, this.kopf); z1.scale.set(0.045, 0.05, 0.05); z1.position.set(0, 0.05, -M.kopf * 1.0);
          const z2 = this.mesh(GEO.zylSpitz, hm, this.kopf); z2.scale.set(0.035, 0.2, 0.035); z2.position.set(0, -0.06, -M.kopf * 1.12); z2.rotation.x = 0.35;
          this.zopf = z2;
          break;
        }
        case 'dutt': { kappe(); const d = this.mesh(GEO.kugel, hm, this.kopf); d.scale.setScalar(0.06); d.position.set(0, M.kopf * 0.95, -M.kopf * 0.45); break; }
        case 'locken': {
          for (let i = 0; i < 14; i++) {
            const w = i / 14 * Math.PI * 2, h = i % 2 ? 0.55 : 0.85;
            const l = this.mesh(GEO.kugel, hm, this.kopf); l.scale.setScalar(0.045);
            l.position.set(Math.cos(w) * M.kopf * 0.82 * Math.sin(h * 1.5), M.kopf * 0.55 * h + 0.03, Math.sin(w) * M.kopf * 0.82 * Math.sin(h * 1.5) - 0.01);
          }
          const top = this.mesh(GEO.kugel, hm, this.kopf); top.scale.set(M.kopf * 0.9, M.kopf * 0.5, M.kopf * 0.9); top.position.set(0, M.kopf * 0.62, -0.01);
          break;
        }
        case 'tolle': { kappe(0.95); const t = this.mesh(GEO.kugel, hm, this.kopf); t.scale.set(0.075, 0.05, 0.08); t.position.set(0, M.kopf * 0.95, M.kopf * 0.45); t.rotation.x = 0.4; break; }
        case 'stirnband': {
          kappe();
          const r = this.mesh(GEO.ring, this.m(a.handschuhe, { rau:0.7 }), this.kopf); r.scale.set(M.kopf * 0.97, M.kopf * 0.97, M.kopf * 0.5); r.rotation.x = Math.PI / 2 - 0.15; r.position.set(0, 0.04, 0);
          break;
        }
        default: kappe(0.9);
      }
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
      for (const kind of this.wurzel.children) kind.traverse(o => { if (o.isMesh) o.castShadow = st < 0.5; });
    }

    // Ich-Sicht: nur Unterarme und Handschuhe bleiben sichtbar (die Kamera sitzt im Kopf)
    ichSicht(an) {
      this.ich = an;
      const bleiben = new Set();
      for (const arm of this.arme) for (const x of [arm.unten, arm.hs, arm.daumen, arm.band]) bleiben.add(x);
      this.wurzel.traverse(o => { if (o.isMesh) o.visible = !an || bleiben.has(o); });
    }

    farbenSetzen(hose, handschuhe) {
      this.mat.hose.color.set(hose); this.mat.handschuh.color.set(handschuhe);
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
      // Arme im Rumpf-Raum
      for (let i = 0; i < 2; i++) {
        const arm = this.arme[i], sx = i === 0 ? 1 : -1;
        const S = tmpD.set(sx * M.schulterX, M.schulterY, 0);
        const pol = V(sx * 0.75, -1, -0.35);
        ik(S, arm.zielAkt, M.oberarm, M.unterarm, pol, arm.E, arm.T);
        glied(arm.oben, S, arm.E, M.armDicke * 1.1);
        glied(arm.unten, arm.E, arm.T, M.armDicke);
        arm.schulter.position.copy(S); arm.schulter.scale.setScalar(M.armDicke * 1.35);
        // Handschuh: etwas über das Handgelenk hinaus, zeigt in Unterarm-Richtung
        tmpA.subVectors(arm.T, arm.E).normalize();
        arm.hs.position.copy(arm.T).addScaledVector(tmpA, 0.07);
        arm.hs.quaternion.setFromUnitVectors(ACHSE_Y, tmpA);
        arm.hs.scale.set(0.085, 0.11, 0.095);
        arm.daumen.position.copy(arm.hs.position).addScaledVector(tmpA, -0.02).add(tmpB.set(-sx * 0.0, 0.05, 0).applyQuaternion(arm.hs.quaternion));
        arm.daumen.scale.set(0.035, 0.05, 0.035);
        arm.band.position.copy(arm.T).addScaledVector(tmpA, -0.02); arm.band.quaternion.copy(arm.hs.quaternion); arm.band.scale.set(0.058, 0.04, 0.058);
      }
      const e = this.mat.handschuh.emissive;
      const g = Math.max(this.glut[0], this.glut[1]);
      e.setRGB(1, 0.5, 0.08).multiplyScalar(Math.min(1.2, g) * 0.9);
      // Beine: Hüftgelenke (im Körper-Raum) zu festen Füßen
      for (let i = 0; i < 2; i++) {
        const b = this.beine[i], sx = i === 0 ? 1 : -1;
        const H = tmpD.set(sx * 0.1 * this.a.breite, 0, 0).applyEuler(this.huefte.rotation).add(this.huefte.position);
        H.y -= 0.05;
        const F = V(sx * M.fussX, 0.13, (i === 0 ? 0.17 : -0.17) - st.rueck);
        ik(H, F, M.ober, M.unter, V(sx * 0.25, 0, 1), b.E, b.T);
        glied(b.ober, H, b.E, M.beinDicke);
        glied(b.unter, b.T, b.E, M.beinDicke * 0.85);
        b.knie.position.copy(b.E); b.knie.scale.setScalar(M.beinDicke * 0.78);
        // Hosenbein: das obere Drittel des Oberschenkels
        b.M.lerpVectors(H, b.E, 0.42);
        glied(b.hosenbein, H, b.M, M.beinDicke * 1.45);
        b.schuh.position.set(b.T.x, 0.08, b.T.z + 0.03); b.schuh.scale.set(0.11, 0.16, 0.24);
        b.sohle.position.set(b.T.x, 0.012, b.T.z + 0.035); b.sohle.scale.set(0.115, 0.024, 0.25);
      }
    }

    // Weltposition eines Handschuhs (für Treffer-Funken)
    handschuhWelt(i, out) { return this.arme[i].hs.getWorldPosition(out || V()); }
    kopfWelt(out) { return this.kopf.getWorldPosition(out || V()); }
  }

  return { Boxer3D, glatt, raus, lerp, klemm };
})();
