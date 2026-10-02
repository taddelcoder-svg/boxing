/* Ringfieber – Halle, Ring, Publikum, Licht, Effekte und Kameras (three.js r128). */
'use strict';

const Arena = (() => {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  let renderer, szene, kamera, spot, licht = {}, publikum = null, blitze = [], funken = [], qualitaet = 'hoch';
  const RING = 3.1;                 // halbe Kantenlänge der Ringfläche
  let aufregung = 0.2, wackeln = 0, zeit = 0;
  const kamZiel = { pos:V(5, 3, 5), blick:V(0, 1.2, 0) }, kamIst = { pos:V(5, 3, 5), blick:V(0, 1.2, 0) };

  function leinwand(b, h, malen) {
    const c = document.createElement('canvas'); c.width = b; c.height = h;
    malen(c.getContext('2d'), b, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    return t;
  }

  function bauen(canvas, q) {
    qualitaet = q || 'hoch';
    renderer = new THREE.WebGLRenderer({ canvas, antialias:qualitaet !== 'niedrig', powerPreference:'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualitaet === 'hoch' ? 2 : qualitaet === 'mittel' ? 1.5 : 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = qualitaet !== 'niedrig';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    szene = new THREE.Scene();
    szene.background = new THREE.Color('#06080e');
    szene.fog = new THREE.FogExp2('#06080e', 0.032);
    kamera = new THREE.PerspectiveCamera(55, 1, 0.05, 120);

    // Licht: ein starker Spot von oben auf den Ring, dazu kühles Hallenlicht und farbige Akzente
    szene.add(new THREE.HemisphereLight('#7b8bb8', '#120c10', 0.3));
    spot = new THREE.SpotLight('#fff4e0', 2.6, 30, 0.6, 0.5, 1.2);
    spot.position.set(0.6, 11, -0.4);
    spot.target.position.set(0, 0, 0);
    spot.castShadow = renderer.shadowMap.enabled;
    spot.shadow.mapSize.set(qualitaet === 'hoch' ? 2048 : 1024, qualitaet === 'hoch' ? 2048 : 1024);
    spot.shadow.bias = -0.0004;
    spot.shadow.camera.near = 5; spot.shadow.camera.far = 16;
    szene.add(spot, spot.target);
    const fuell = new THREE.DirectionalLight('#c8d4ff', 0.55); fuell.position.set(-5, 6, 6); szene.add(fuell);
    const gegen = new THREE.DirectionalLight('#ffd2b0', 0.45); gegen.position.set(6, 4, -6); szene.add(gegen);
    for (const [x, z, f] of [[-9, -9, '#ff3355'], [9, 9, '#2f6bff'], [-9, 9, '#ffb000'], [9, -9, '#9a4dff']]) {
      const l = new THREE.PointLight(f, 1.4, 22, 2); l.position.set(x, 5, z); szene.add(l); licht[f] = l;
    }

    ringBauen();
    halleBauen();
    funkenBauen();
    groesse();
    window.addEventListener('resize', groesse);
    return { renderer, szene, kamera };
  }

  function ringBauen() {
    const boden = leinwand(1024, 1024, (g, b, h) => {
      const v = g.createRadialGradient(b / 2, h / 2, 60, b / 2, h / 2, b * 0.72);
      v.addColorStop(0, '#2a6fd6'); v.addColorStop(1, '#123a80');
      g.fillStyle = v; g.fillRect(0, 0, b, h);
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 6; g.strokeRect(30, 30, b - 60, h - 60);
      g.beginPath(); g.arc(b / 2, h / 2, 230, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.1)'; g.fill();
      g.lineWidth = 10; g.strokeStyle = 'rgba(255,255,255,.55)'; g.stroke();
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '800 104px "Barlow Semi Condensed", Arial, sans-serif';
      g.fillText('RINGFIEBER', b / 2, h / 2 - 12);
      g.font = '700 38px "Barlow Semi Condensed", Arial, sans-serif'; g.fillStyle = '#ffd23f';
      g.fillText('SWIMMING LIONS', b / 2, h / 2 + 72);
      // Abnutzung
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * b, Math.random() * h, 3 + Math.random() * 12, 2 + Math.random() * 8); }
    });
    const flaeche = new THREE.Mesh(new THREE.BoxGeometry(RING * 2, 0.3, RING * 2), [
      new THREE.MeshStandardMaterial({ color:'#0f2c63', roughness:0.9 }), new THREE.MeshStandardMaterial({ color:'#0f2c63', roughness:0.9 }),
      new THREE.MeshStandardMaterial({ map:boden, roughness:0.85 }), new THREE.MeshStandardMaterial({ color:'#0f2c63' }),
      new THREE.MeshStandardMaterial({ color:'#0f2c63', roughness:0.9 }), new THREE.MeshStandardMaterial({ color:'#0f2c63', roughness:0.9 })
    ]);
    flaeche.position.y = -0.15; flaeche.receiveShadow = true; szene.add(flaeche);
    const schuerze = leinwand(1024, 128, (g, b, h) => {
      g.fillStyle = '#0b0d14'; g.fillRect(0, 0, b, h);
      g.fillStyle = '#d32f2f'; g.fillRect(0, 0, b, 10);
      g.font = '800 72px "Barlow Semi Condensed", Arial, sans-serif'; g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('RINGFIEBER  ★  RINGFIEBER', b / 2, h / 2 + 6);
    });
    const unten = new THREE.Mesh(new THREE.BoxGeometry(RING * 2 + 0.5, 1.0, RING * 2 + 0.5), new THREE.MeshStandardMaterial({ map:schuerze, roughness:0.8 }));
    unten.position.y = -0.8; szene.add(unten);
    // Pfosten, Polster, Seile
    const ecken = [[-1, -1, '#d32f2f'], [1, 1, '#1f5fbf'], [-1, 1, '#eeeeee'], [1, -1, '#eeeeee']];
    const pfostenGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.6, 10);
    for (const [sx, sz, f] of ecken) {
      const p = new THREE.Mesh(pfostenGeo, new THREE.MeshStandardMaterial({ color:'#b9c2cc', metalness:0.7, roughness:0.3 }));
      p.position.set(sx * RING, 0.8, sz * RING); p.castShadow = true; szene.add(p);
      const polster = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.2, 0.22), new THREE.MeshStandardMaterial({ color:f, roughness:0.6 }));
      polster.position.set(sx * (RING - 0.09), 0.85, sz * (RING - 0.09)); polster.rotation.y = Math.PI / 4; szene.add(polster);
    }
    const seilMat = [new THREE.MeshStandardMaterial({ color:'#d32f2f', roughness:0.4 }), new THREE.MeshStandardMaterial({ color:'#f2f2f2', roughness:0.4 }), new THREE.MeshStandardMaterial({ color:'#1f5fbf', roughness:0.4 })];
    const seilGeo = new THREE.CylinderGeometry(0.028, 0.028, RING * 2, 8);
    [0.48, 0.88, 1.28].forEach((y, i) => {
      for (let s = 0; s < 4; s++) {
        const seil = new THREE.Mesh(seilGeo, seilMat[i]);
        seil.rotation.z = Math.PI / 2;
        if (s < 2) { seil.position.set(0, y, (s ? 1 : -1) * RING); }
        else { seil.rotation.y = Math.PI / 2; seil.position.set((s === 3 ? 1 : -1) * RING, y, 0); }
        seil.castShadow = true; szene.add(seil);
      }
    });
    // Lichtrahmen über dem Ring
    const traverse = new THREE.MeshStandardMaterial({ color:'#30343c', metalness:0.6, roughness:0.4 });
    for (let s = 0; s < 4; s++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.18, 0.18), traverse);
      t.position.set(s < 2 ? 0 : (s === 3 ? 3.8 : -3.8), 7.2, s < 2 ? (s ? 3.8 : -3.8) : 0); if (s >= 2) t.rotation.y = Math.PI / 2; szene.add(t);
    }
    const lampeGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.25, 12), lampeMat = new THREE.MeshBasicMaterial({ color:'#fff3d6' });
    for (let i = 0; i < 12; i++) {
      const w = i / 12 * Math.PI * 2, l = new THREE.Mesh(lampeGeo, lampeMat);
      l.position.set(Math.cos(w) * 3.8, 7.0, Math.sin(w) * 3.8); szene.add(l);
    }
  }

  function halleBauen() {
    const boden = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color:'#0b0c10', roughness:0.95 }));
    boden.rotation.x = -Math.PI / 2; boden.position.y = -1.3; szene.add(boden);
    // Tribünen und Publikum (Instanzen, damit es auch auf Handys läuft)
    const reihen = qualitaet === 'niedrig' ? 5 : 8, abstand = 0.56;
    const plaetze = [];
    for (let seite = 0; seite < 4; seite++) {
      for (let r = 0; r < reihen; r++) {
        const tiefe = 5.2 + r * 0.85, hoehe = -1.3 + r * 0.42, breite = tiefe * 2 - 1.2;
        const n = Math.floor(breite / abstand);
        for (let i = 0; i < n; i++) {
          if (Math.random() < 0.08) continue;
          const u = -breite / 2 + (i + 0.5) * (breite / n) + (Math.random() - 0.5) * 0.12;
          const x = seite === 0 ? u : seite === 1 ? u : seite === 2 ? tiefe : -tiefe;
          const z = seite === 0 ? tiefe : seite === 1 ? -tiefe : u;
          plaetze.push({ x, y:hoehe + 0.35, z, phase:Math.random() * 10, f:1.5 + Math.random() * 2.5, groesse:0.85 + Math.random() * 0.3 });
        }
        const stufe = new THREE.Mesh(new THREE.BoxGeometry(seite < 2 ? breite + 1.7 : 0.85, 0.42, seite < 2 ? 0.85 : breite + 1.7), new THREE.MeshStandardMaterial({ color:'#15171e', roughness:0.9 }));
        stufe.position.set(seite < 2 ? 0 : (seite === 2 ? tiefe : -tiefe), hoehe - 0.21 + 0.42, seite < 2 ? (seite === 0 ? tiefe : -tiefe) : 0);
        stufe.position.y = hoehe; szene.add(stufe);
      }
    }
    const farben = ['#d32f2f', '#1f5fbf', '#f2f2f2', '#2e7d32', '#ffb000', '#6a3fb5', '#212121', '#e91e8c', '#00acc1', '#795548'];
    const haut = ['#f1c9a5', '#e0ac86', '#c99068', '#8d5a3b', '#5c3a24'];
    const koerper = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.55, 0.28), new THREE.MeshStandardMaterial({ roughness:0.9 }), plaetze.length);
    const koepfe = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.13, 0), new THREE.MeshStandardMaterial({ roughness:0.9 }), plaetze.length);
    const c = new THREE.Color();
    plaetze.forEach((p, i) => {
      koerper.setColorAt(i, c.set(farben[Math.floor(Math.random() * farben.length)]));
      koepfe.setColorAt(i, c.set(haut[Math.floor(Math.random() * haut.length)]));
    });
    szene.add(koerper, koepfe);
    publikum = { plaetze, koerper, koepfe, m:new THREE.Matrix4(), q:new THREE.Quaternion(), s:V(1, 1, 1), p:V() };
    publikumBewegen(0);
    // Blitzlichter im Publikum
    const blitzTex = leinwand(64, 64, (g) => { const v = g.createRadialGradient(32, 32, 0, 32, 32, 32); v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(0.3, 'rgba(255,255,240,.6)'); v.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = v; g.fillRect(0, 0, 64, 64); });
    for (let i = 0; i < 26; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:blitzTex, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending }));
      const p = plaetze[Math.floor(Math.random() * plaetze.length)];
      sp.position.set(p.x, p.y + 0.5, p.z); sp.scale.setScalar(0.9);
      szene.add(sp); blitze.push({ sp, an:0 });
    }
  }

  function publikumBewegen(dt) {
    if (!publikum) return;
    const P = publikum;
    P.plaetze.forEach((p, i) => {
      const hupf = Math.max(0, Math.sin(zeit * p.f + p.phase)) * 0.18 * aufregung;
      P.p.set(p.x, p.y + hupf, p.z); P.s.setScalar(p.groesse);
      P.m.compose(P.p, P.q, P.s); P.koerper.setMatrixAt(i, P.m);
      P.p.y += 0.42 * p.groesse; P.m.compose(P.p, P.q, P.s); P.koepfe.setMatrixAt(i, P.m);
    });
    P.koerper.instanceMatrix.needsUpdate = true; P.koepfe.instanceMatrix.needsUpdate = true;
  }

  /* ---------- Effekte ---------- */
  function funkenBauen() {
    const tex = leinwand(64, 64, (g) => {
      const v = g.createRadialGradient(32, 32, 0, 32, 32, 30); v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(0.35, 'rgba(255,220,120,.9)'); v.addColorStop(1, 'rgba(255,120,0,0)');
      g.fillStyle = v; g.beginPath();
      for (let i = 0; i < 10; i++) { const w = i / 10 * Math.PI * 2, r = i % 2 ? 10 : 30; g.lineTo(32 + Math.cos(w) * r, 32 + Math.sin(w) * r); }
      g.fill();
    });
    for (let i = 0; i < 60; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending }));
      sp.visible = false; szene.add(sp);
      funken.push({ sp, v:V(), leben:0, max:1 });
    }
  }
  function treffer(pos, staerke, farbe) {
    let n = Math.round(6 + staerke * 10);
    for (const f of funken) {
      if (n <= 0) break;
      if (f.leben > 0) continue;
      n--;
      f.sp.visible = true; f.sp.position.copy(pos);
      f.v.set((Math.random() - 0.5), (Math.random() - 0.2), (Math.random() - 0.5)).normalize().multiplyScalar(1.5 + Math.random() * 3 * staerke);
      f.max = f.leben = 0.25 + Math.random() * 0.25;
      f.sp.material.color.set(farbe || '#ffffff');
      f.groesse = 0.12 + Math.random() * 0.18 * (0.6 + staerke);
    }
    wackeln = Math.max(wackeln, 0.04 + staerke * 0.1);
    aufregung = Math.min(1.6, aufregung + 0.12 + staerke * 0.25);
  }
  function jubel(staerke) { aufregung = Math.min(2, aufregung + staerke); }

  /* ---------- Kameras ---------- */
  // modus: 'spieler' (hinter Ecke e), 'tv', 'menue', 'boxer' (Nahaufnahme für die Boxerwahl), 'boden'
  let schnell = false;
  function kameraSetzen(modus, opt = {}) {
    const t = zeit;
    schnell = false;
    if (modus === 'spieler') {
      const f = opt.ecke === 0 ? 1 : -1, eigenZ = -0.5 * f, schwank = opt.schwank || 0;
      // Hoch hinter dem eigenen Boxer: der Blick geht über seinen Kopf zum Gesicht des Gegners
      kamZiel.pos.set(-schwank * f * 0.3, 2.62 + (opt.hoch || 0), eigenZ - f * 1.5);
      kamZiel.blick.set(-schwank * f * 0.08, 1.32, 0.5 * f);
    } else if (modus === 'ich') {
      // Ich-Sicht: Kamera im eigenen Kopf, Blick geradeaus zum Gegner
      kamZiel.pos.copy(opt.pos);
      kamZiel.blick.set(opt.pos.x * 0.55, (opt.zielY || opt.pos.y) - 0.5, opt.pos.z + opt.f * 1.6);
      schnell = true;
    } else if (modus === 'tv') {
      const w = Math.sin(t * 0.08) * 0.35 + (opt.seite || 0);
      kamZiel.pos.set(Math.cos(w) * 4.3, 2.0 + Math.sin(t * 0.13) * 0.15, Math.sin(w) * 4.3);
      kamZiel.blick.set(0, 1.25, 0);
    } else if (modus === 'menue') {
      const w = t * 0.06;
      kamZiel.pos.set(Math.cos(w) * 7.2, 3.1, Math.sin(w) * 7.2);
      kamZiel.blick.set(0, 0.9, 0);
    } else if (modus === 'boxer') {
      const w = Math.sin(t * 0.25) * 0.5 + 0.3;
      kamZiel.pos.set(Math.sin(w) * 2.6 + (opt.x || 0), 1.55, -0.5 + Math.cos(w) * 2.6);
      kamZiel.blick.set(opt.x || 0, 1.15, -0.5);
    } else if (modus === 'boden') {
      const z = opt.z || 0;
      kamZiel.pos.set(2.4, 0.9, z - Math.sign(z || 1) * 0.6);
      kamZiel.blick.set(0, 0.35, z + Math.sign(z || 1) * 0.6);
    } else if (modus === 'intro') {
      const k = Math.min(1, opt.k || 0);
      kamZiel.pos.set(Math.cos(1.2 - k) * (6 - k * 1.8), 2.6 - k * 0.6, Math.sin(1.2 - k) * (6 - k * 1.8));
      kamZiel.blick.set(0, 1.2, 0);
    }
    if (opt.sofort) { kamIst.pos.copy(kamZiel.pos); kamIst.blick.copy(kamZiel.blick); }
  }

  function bild(dt) {
    zeit += dt;
    aufregung = Math.max(0.15, aufregung - dt * 0.35);
    const weich = 1 - Math.exp(-dt * (schnell ? 28 : 7));
    kamIst.pos.lerp(kamZiel.pos, weich); kamIst.blick.lerp(kamZiel.blick, weich);
    kamera.position.copy(kamIst.pos);
    if (wackeln > 0) {
      kamera.position.x += (Math.random() - 0.5) * wackeln; kamera.position.y += (Math.random() - 0.5) * wackeln;
      wackeln = Math.max(0, wackeln - dt * 0.6);
    }
    kamera.lookAt(kamIst.blick);
    publikumBewegen(dt);
    for (const b of blitze) {
      if (b.an > 0) { b.an -= dt; b.sp.material.opacity = Math.max(0, b.an / 0.09); }
      else if (Math.random() < dt * 0.08 * (0.3 + aufregung * 1.4)) { b.an = 0.09; b.sp.material.opacity = 1; }
    }
    for (const f of funken) {
      if (f.leben <= 0) continue;
      f.leben -= dt;
      if (f.leben <= 0) { f.sp.visible = false; continue; }
      f.v.y -= 6 * dt;
      f.sp.position.addScaledVector(f.v, dt);
      const k = f.leben / f.max;
      f.sp.scale.setScalar(f.groesse * (0.5 + k));
      f.sp.material.opacity = k;
    }
    renderer.render(szene, kamera);
  }

  function groesse() {
    if (!renderer) return;
    const b = window.innerWidth, h = window.innerHeight;
    renderer.setSize(b, h, false);
    kamera.aspect = b / h;
    kamera.fov = b / h < 0.8 ? 72 : b / h < 1.2 ? 62 : 52;
    kamera.updateProjectionMatrix();
  }

  // Weltpunkt → Bildschirm (für schwebende Zahlen)
  const tmp = V();
  function aufSchirm(pos) {
    tmp.copy(pos).project(kamera);
    return { x:(tmp.x + 1) / 2 * window.innerWidth, y:(1 - tmp.y) / 2 * window.innerHeight, sichtbar:tmp.z < 1 };
  }

  return { bauen, bild, kameraSetzen, treffer, jubel, aufSchirm, get szene() { return szene; }, get kamera() { return kamera; }, get renderer() { return renderer; } };
})();
