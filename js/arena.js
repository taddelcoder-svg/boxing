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

  // Zufall mit festem Startwert: die Halle sieht bei jedem Start gleich aus (Publikum, Wandlichter)
  let zuf = 7;
  const rnd = () => { zuf = (zuf * 16807) % 2147483647; return (zuf - 1) / 2147483646; };
  const stufen = () => qualitaet === 'hoch' ? 2 : qualitaet === 'mittel' ? 1 : 0;
  let fovBasis = 55, stoss = 0, lichtShow = { t:0, farbe:new THREE.Color('#ffffff') };
  let konfettiSystem = null, led = null, strahlen = [], staub = null, schwindel = [null, null], boden = null, schutz = null;

  function bauen(canvas, q) {
    qualitaet = q || 'hoch';
    renderer = new THREE.WebGLRenderer({ canvas, antialias:qualitaet !== 'niedrig', powerPreference:'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualitaet === 'hoch' ? 2 : qualitaet === 'mittel' ? 1.5 : 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = qualitaet !== 'niedrig';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    szene = new THREE.Scene();
    szene.background = new THREE.Color('#05070d');
    szene.fog = new THREE.FogExp2('#070b17', 0.026);
    kamera = new THREE.PerspectiveCamera(55, 1, 0.05, 120);
    umgebungBauen();

    // Licht: ein starker warmer Spot von oben auf den Ring, kühles Hallenlicht von der Seite, farbige Gegenlichter
    szene.add(new THREE.HemisphereLight('#8aa0d8', '#1a1018', 0.3));
    spot = new THREE.SpotLight('#fff1d8', 2.6, 30, 0.62, 0.7, 1.2);
    spot.position.set(0.6, 11, -0.4);
    spot.target.position.set(0, 0, 0);
    spot.castShadow = renderer.shadowMap.enabled;
    spot.shadow.mapSize.set(qualitaet === 'hoch' ? 2048 : 1024, qualitaet === 'hoch' ? 2048 : 1024);
    spot.shadow.bias = -0.0004; spot.shadow.radius = 3;
    spot.shadow.camera.near = 5; spot.shadow.camera.far = 16;
    szene.add(spot, spot.target);
    const fuell = new THREE.DirectionalLight('#c8d4ff', 0.5); fuell.position.set(-5, 6, 6); szene.add(fuell);
    const gegen = new THREE.DirectionalLight('#ffd2b0', 0.5); gegen.position.set(6, 4, -6); szene.add(gegen);
    for (const [x, z, f] of [[-9, -9, '#ff3355'], [9, 9, '#2f6bff'], [-9, 9, '#ffb000'], [9, -9, '#9a4dff']]) {
      const l = new THREE.PointLight(f, 1.4, 22, 2); l.position.set(x, 5, z); l.userData.basis = 1.4; l.userData.phase = rnd() * 6; szene.add(l); licht[f] = l;
    }

    ringBauen();
    halleBauen();
    deckeBauen();
    effekteBauen();
    groesse();
    window.addEventListener('resize', groesse);
    return { renderer, szene, kamera };
  }

  // Weiche Studio-Umgebung für Glanzlichter auf Handschuhen, Haut und Seilen (einmal berechnet, kostet danach fast nichts)
  function umgebungBauen() {
    const pm = new THREE.PMREMGenerator(renderer);
    const s = new THREE.Scene();
    s.add(new THREE.Mesh(new THREE.BoxGeometry(40, 24, 40), new THREE.MeshBasicMaterial({ color:'#16203a', side:THREE.BackSide })));
    const flaeche = (b, h, x, y, z, farbe, st, ry, rx) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b, h), new THREE.MeshBasicMaterial({ color:new THREE.Color(farbe).multiplyScalar(st), side:THREE.DoubleSide }));
      m.position.set(x, y, z); if (ry) m.rotation.y = ry; if (rx) m.rotation.x = rx; s.add(m);
    };
    flaeche(14, 14, 0, 11, 0, '#fff0d8', 7, 0, Math.PI / 2);
    flaeche(8, 5, -14, 5, 6, '#9fb8ff', 3.2, Math.PI / 2);
    flaeche(8, 5, 14, 4, -6, '#ffc9a0', 3.0, -Math.PI / 2);
    flaeche(10, 4, 0, 3, -16, '#ff4d7a', 1.8, 0);
    flaeche(10, 4, 0, 3, 16, '#4d8bff', 1.8, Math.PI);
    szene.environment = pm.fromScene(s, 0.035).texture;
    pm.dispose();
  }

  function ringBauen() {
    const boden = leinwand(1024, 1024, (g, b, h) => {
      const v = g.createRadialGradient(b / 2, h / 2, 40, b / 2, h / 2, b * 0.74);
      v.addColorStop(0, '#2f72d8'); v.addColorStop(0.55, '#1f58b2'); v.addColorStop(1, '#0d2f6e');
      g.fillStyle = v; g.fillRect(0, 0, b, h);
      // Gewebe der Ringmatte
      g.save(); g.globalAlpha = 0.07; g.strokeStyle = '#000';
      for (let i = -h; i < b; i += 7) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); }
      g.strokeStyle = '#fff'; for (let i = 0; i < b + h; i += 7) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i - h, h); g.stroke(); }
      g.restore();
      // Ecken: rot und blau, wie die Eckpfosten
      const ecke = (x, y, f) => { g.fillStyle = f; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (x ? -190 : 190), y); g.lineTo(x, y + (y ? -190 : 190)); g.closePath(); g.fill(); };
      g.globalAlpha = 0.5; ecke(0, 0, '#d32f2f'); ecke(b, h, '#d32f2f'); ecke(b, 0, '#e8e8e8'); ecke(0, h, '#e8e8e8'); g.globalAlpha = 1;
      g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 7; g.strokeRect(34, 34, b - 68, h - 68);
      g.strokeStyle = 'rgba(255,210,63,.55)'; g.lineWidth = 3; g.strokeRect(54, 54, b - 108, h - 108);
      // Mittelkreis mit Sternkranz
      g.beginPath(); g.arc(b / 2, h / 2, 250, 0, Math.PI * 2); g.fillStyle = 'rgba(8,30,80,.28)'; g.fill();
      g.lineWidth = 12; g.strokeStyle = 'rgba(255,255,255,.7)'; g.stroke();
      g.beginPath(); g.arc(b / 2, h / 2, 228, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = 'rgba(255,210,63,.8)'; g.stroke();
      for (let i = 0; i < 16; i++) {
        const w = i / 16 * Math.PI * 2, x = b / 2 + Math.cos(w) * 275, y = h / 2 + Math.sin(w) * 275;
        g.save(); g.translate(x, y); g.rotate(w); g.fillStyle = '#ffd23f'; g.beginPath();
        for (let k = 0; k < 10; k++) { const r = k % 2 ? 6 : 15, ww = k / 10 * Math.PI * 2 - Math.PI / 2; g.lineTo(Math.cos(ww) * r, Math.sin(ww) * r); }
        g.fill(); g.restore();
      }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '800 104px "Bricolage Grotesque", Arial, sans-serif';
      g.fillStyle = 'rgba(0,10,40,.45)'; g.fillText('RINGFIEBER', b / 2 + 5, h / 2 - 7);
      g.fillStyle = '#ffffff'; g.fillText('RINGFIEBER', b / 2, h / 2 - 12);
      g.font = '700 38px "Bricolage Grotesque", Arial, sans-serif'; g.fillStyle = '#ffd23f';
      g.fillText('SWIMMING LIONS', b / 2, h / 2 + 72);
      // Abnutzung: Schuhspuren und Flecken
      for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * b, Math.random() * h, 3 + Math.random() * 14, 2 + Math.random() * 8); }
      for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`; g.fillRect(Math.random() * b, Math.random() * h, 2 + Math.random() * 18, 1 + Math.random() * 5); }
    });
    const seite = new THREE.MeshStandardMaterial({ color:'#143572', roughness:0.8 });
    const flaeche = new THREE.Mesh(new THREE.BoxGeometry(RING * 2, 0.3, RING * 2), [
      seite, seite, new THREE.MeshStandardMaterial({ map:boden, roughness:0.62, envMapIntensity:0.18 }), seite, seite, seite
    ]);
    flaeche.position.y = -0.15; flaeche.receiveShadow = true; szene.add(flaeche);
    const schuerze = leinwand(1024, 128, (g, b, h) => {
      const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, '#171b29'); v.addColorStop(1, '#090b12');
      g.fillStyle = v; g.fillRect(0, 0, b, h);
      g.fillStyle = '#d32f2f'; g.fillRect(0, 0, b, 9); g.fillStyle = '#ffd23f'; g.fillRect(0, 9, b, 3);
      g.fillStyle = '#1f5fbf'; g.fillRect(0, h - 9, b, 9);
      g.font = '800 64px "Bricolage Grotesque", Arial, sans-serif'; g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('RINGFIEBER  ★  SWIMMING LIONS  ★', b / 2, h / 2 + 2);
    });
    const unten = new THREE.Mesh(new THREE.BoxGeometry(RING * 2 + 0.5, 1.0, RING * 2 + 0.5), new THREE.MeshStandardMaterial({ map:schuerze, roughness:0.7, envMapIntensity:0.4 }));
    unten.position.y = -0.8; szene.add(unten);

    // Eckpfosten: gepolsterte Rundpfosten in Eckfarbe, Stahlkappe, Seilmanschetten
    const ecken = [[-1, -1, '#d32f2f'], [1, 1, '#1f5fbf'], [-1, 1, '#eeeeee'], [1, -1, '#eeeeee']];
    const stahl = new THREE.MeshStandardMaterial({ color:'#c9d1da', metalness:0.85, roughness:0.28, envMapIntensity:1.2 });
    const polsterGeo = new THREE.CylinderGeometry(0.125, 0.135, 1.36, 14);
    const kappeGeo = new THREE.CylinderGeometry(0.09, 0.13, 0.06, 14), manGeo = new THREE.TorusGeometry(0.135, 0.018, 6, 16);
    const seilY = [0.48, 0.88, 1.28], manT = [];
    for (const [sx, sz, f] of ecken) {
      const polster = new THREE.Mesh(polsterGeo, new THREE.MeshStandardMaterial({ color:f, roughness:0.38, envMapIntensity:0.9 }));
      polster.position.set(sx * (RING - 0.06), 0.8, sz * (RING - 0.06)); polster.castShadow = true; szene.add(polster);
      const kappe = new THREE.Mesh(kappeGeo, stahl); kappe.position.set(sx * (RING - 0.06), 1.5, sz * (RING - 0.06)); szene.add(kappe);
      for (const y of seilY) manT.push({ g:manGeo, p:[sx * (RING - 0.06), y, sz * (RING - 0.06)], r:[Math.PI / 2, 0, 0] });
    }
    szene.add(new THREE.Mesh(Figuren.fusion(manT), stahl));
    // Seile: leicht durchhängend, mit gedrehter Struktur
    const seilTex = leinwand(128, 16, (g, b, h) => {
      g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, b, h);
      g.fillStyle = '#9a9a9a'; for (let i = -h; i < b; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 8, 0); g.lineTo(i + 8 + h, h); g.lineTo(i + h, h); g.fill(); }
    });
    seilTex.wrapS = seilTex.wrapT = THREE.RepeatWrapping; seilTex.repeat.set(26, 1);
    const seilFarbe = ['#d32f2f', '#f2f2f2', '#1f5fbf'];
    seilY.forEach((y, i) => {
      const L = RING - 0.06, kurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-L, y, 0), new THREE.Vector3(-L / 2, y - 0.012, 0), new THREE.Vector3(0, y - 0.03 - i * 0.004, 0), new THREE.Vector3(L / 2, y - 0.012, 0), new THREE.Vector3(L, y, 0)]);
      const geo = new THREE.TubeGeometry(kurve, 20, 0.03, 8, false);
      const m = new THREE.MeshStandardMaterial({ color:seilFarbe[i], map:seilTex, roughness:0.4, envMapIntensity:0.7 });
      for (let sd = 0; sd < 4; sd++) {
        const seil = new THREE.Mesh(geo, m);
        if (sd < 2) seil.position.z = (sd ? 1 : -1) * (RING - 0.06); else { seil.rotation.y = Math.PI / 2; seil.position.x = (sd === 3 ? 1 : -1) * (RING - 0.06); }
        seil.castShadow = true; szene.add(seil);
      }
    });
    // Seilhalter: weiße Bänder, die die drei Seile je Seite verbinden
    const halterT = [], halterGeo = new THREE.BoxGeometry(0.035, 0.86, 0.02);
    for (let sd = 0; sd < 4; sd++) for (const o of [-1.0, 1.0]) {
      if (sd < 2) halterT.push({ g:halterGeo, p:[o, 0.87, (sd ? 1 : -1) * (RING - 0.06)] });
      else halterT.push({ g:halterGeo, p:[(sd === 3 ? 1 : -1) * (RING - 0.06), 0.87, o], r:[0, Math.PI / 2, 0] });
    }
    szene.add(new THREE.Mesh(Figuren.fusion(halterT), new THREE.MeshStandardMaterial({ color:'#f2f2f2', roughness:0.6 })));
    // Ringstufen an den neutralen Ecken, Hocker und Eimer an den Boxerecken
    const stufeMat = new THREE.MeshStandardMaterial({ color:'#2a2f3b', roughness:0.6, envMapIntensity:0.5 }), trittMat = new THREE.MeshStandardMaterial({ color:'#c9d1da', metalness:0.6, roughness:0.4 });
    for (const [sx, sz] of [[-1, 1], [1, -1]]) {
      const gr = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.42, 0.34), stufeMat); st.position.set(0, -1.3 + 0.21 + i * 0.42, -i * 0.34); st.scale.y = 1; gr.add(st);
        const tr = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.03, 0.36), trittMat); tr.position.set(0, -1.3 + 0.42 + i * 0.42, -i * 0.34); gr.add(tr);
        if (i) { const fu = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.42 * i, 0.34), stufeMat); fu.position.set(0, -1.3 + 0.21 * i, -i * 0.34); gr.add(fu); }
      }
      gr.position.set(sx * 4.0, 0, sz * 4.0); gr.rotation.y = Math.atan2(-sx, -sz) + Math.PI; szene.add(gr);
    }
    for (const [sx, sz, f] of [[-1, -1, '#d32f2f'], [1, 1, '#1f5fbf']]) {
      const gr = new THREE.Group();
      const sitz = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.05, 14), new THREE.MeshStandardMaterial({ color:f, roughness:0.5 })); sitz.position.y = -0.7;
      const bein = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.6, 8), stahl); bein.position.y = -1.0;
      const eimer = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.28, 12), new THREE.MeshStandardMaterial({ color:'#cfd6de', metalness:0.6, roughness:0.4 })); eimer.position.set(0.45, -1.16, 0.1);
      const flasche = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.2, 8), new THREE.MeshStandardMaterial({ color:'#9fd8ff', roughness:0.15, transparent:true, opacity:0.8 })); flasche.position.set(-0.35, -1.2, 0.1);
      const handtuch = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.2), new THREE.MeshStandardMaterial({ color:'#f2f2f2', roughness:0.9 })); handtuch.position.set(0, -0.67, 0); handtuch.rotation.y = 0.4;
      gr.add(sitz, bein, eimer, flasche, handtuch); gr.position.set(sx * 3.85, 0, sz * 3.85); szene.add(gr);
    }
    // LED-Bande rund um den Ring (laufender Text)
    const ledTex = leinwand(2048, 96, (g, b, h) => {
      const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, '#101a3a'); v.addColorStop(1, '#0a1026'); g.fillStyle = v; g.fillRect(0, 0, b, h);
      const worte = [['RINGFIEBER', '#ffffff'], ['★', '#ffd23f'], ['SWIMMING LIONS', '#ffd23f'], ['★', '#ff4d6d'], ['AUF DIE ZWÖLF!', '#7fd6ff'], ['★', '#ffd23f'], ['KEINE GNADE', '#ff6b6b'], ['★', '#7fd6ff']];
      g.textBaseline = 'middle'; g.font = '800 62px "Bricolage Grotesque", Arial, sans-serif';
      let x = 20; for (let k = 0; k < 3; k++) for (const [t, f] of worte) { g.fillStyle = f; g.fillText(t, x, h / 2 + 3); x += g.measureText(t).width + 56; if (x > b) break; }
      g.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, b, 1);
    });
    ledTex.wrapS = THREE.RepeatWrapping; ledTex.repeat.set(0.5, 1);
    const ledMat = new THREE.MeshBasicMaterial({ map:ledTex, toneMapped:false, color:'#e8eeff' });
    const rahmenMat = new THREE.MeshStandardMaterial({ color:'#0d1018', roughness:0.5, metalness:0.4 });
    const LB = 4.4;
    for (let sd = 0; sd < 4; sd++) {
      const bd = new THREE.Mesh(new THREE.BoxGeometry(LB * 2, 0.8, 0.12), [rahmenMat, rahmenMat, rahmenMat, rahmenMat, ledMat, rahmenMat]);
      bd.position.set(sd < 2 ? 0 : (sd === 3 ? LB : -LB), -0.9, sd < 2 ? (sd ? LB : -LB) : 0);
      bd.rotation.y = sd === 0 ? 0 : sd === 1 ? Math.PI : sd === 2 ? Math.PI / 2 : -Math.PI / 2; szene.add(bd);
    }
    led = ledTex;
  }

  function deckeBauen() {
    // Traversen mit Streben und Scheinwerfern, dazu sichtbare Lichtkegel
    const traverse = new THREE.MeshStandardMaterial({ color:'#3a3f4a', metalness:0.7, roughness:0.35, envMapIntensity:0.8 });
    const T = 3.8, H = 7.2, streben = [], strebeGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.4, 5);
    for (let s = 0; s < 4; s++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(T * 2, 0.1, 0.1), traverse), t2 = t.clone();
      const qx = s < 2 ? 0 : (s === 3 ? T : -T), qz = s < 2 ? (s ? T : -T) : 0, ry = s >= 2 ? Math.PI / 2 : 0;
      t.position.set(qx, H + 0.14, qz); t2.position.set(qx, H - 0.14, qz); t.rotation.y = t2.rotation.y = ry; szene.add(t, t2);
      for (let i = 0; i < 12; i++) {
        streben.push({ g:strebeGeo, p:[qx + (s < 2 ? (-T + (i + 0.5) * T / 6) : 0), H, qz + (s >= 2 ? (-T + (i + 0.5) * T / 6) : 0)], r:[(s >= 2 ? 1 : 0) * (i % 2 ? 0.6 : -0.6), 0, (s < 2 ? 1 : 0) * (i % 2 ? 0.6 : -0.6)] });
      }
    }
    szene.add(new THREE.Mesh(Figuren.fusion(streben), traverse));
    const gehaeuse = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.17, 0.22, 0.34, 12), new THREE.MeshStandardMaterial({ color:'#1c1f27', metalness:0.6, roughness:0.4 }), 16);
    const linse = new THREE.InstancedMesh(new THREE.CircleGeometry(0.16, 14), new THREE.MeshBasicMaterial({ color:'#fff6e0', toneMapped:false }), 16);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = V(1, 1, 1);
    for (let i = 0; i < 16; i++) {
      const w = i / 16 * Math.PI * 2, r = 3.8, x = Math.cos(w) * r, z = Math.sin(w) * r;
      const ziel = V(0, 0, 0).sub(V(x, H - 0.2, z)).normalize();
      q.setFromUnitVectors(V(0, -1, 0), ziel);
      m4.compose(V(x, H - 0.3, z), q, sc); gehaeuse.setMatrixAt(i, m4);
      m4.compose(V(x + ziel.x * 0.18, H - 0.3 + ziel.y * 0.18, z + ziel.z * 0.18), q.clone().multiply(new THREE.Quaternion().setFromEuler(e.set(Math.PI / 2, 0, 0))), sc); linse.setMatrixAt(i, m4);
    }
    szene.add(gehaeuse, linse);
    // Lichtkegel
    const kegelTex = leinwand(4, 128, (g, b, h) => { const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(255,255,255,0.95)'); v.addColorStop(0.5, 'rgba(255,255,255,0.35)'); v.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = v; g.fillRect(0, 0, b, h); });
    kegelTex.encoding = THREE.LinearEncoding;
    const kegelGeo = new THREE.CylinderGeometry(0.12, 1.5, 7.2, 24, 1, true); kegelGeo.translate(0, -3.6, 0);
    const n = qualitaet === 'niedrig' ? 0 : qualitaet === 'mittel' ? 6 : 10;
    const farben = ['#fff1d8', '#7fa8ff', '#ff6a8a', '#ffd23f', '#9a7bff'];
    for (let i = 0; i < n; i++) {
      const w = i / n * Math.PI * 2, r = 3.8;
      const k = new THREE.Mesh(kegelGeo, new THREE.MeshBasicMaterial({ map:kegelTex, color:farben[i % farben.length], transparent:true, opacity:0.1, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, fog:false }));
      k.position.set(Math.cos(w) * r, H - 0.3, Math.sin(w) * r);
      k.userData = { w, basis:V(Math.cos(w) * r, H - 0.3, Math.sin(w) * r), phase:rnd() * 6 };
      szene.add(k); strahlen.push(k);
    }
    // Staubflimmern im Licht
    if (qualitaet !== 'niedrig') {
      const N = qualitaet === 'hoch' ? 160 : 80, pos = new Float32Array(N * 3), basis = [];
      for (let i = 0; i < N; i++) { const r = Math.sqrt(rnd()) * 5, w = rnd() * 6.283, y = 0.3 + rnd() * 6.5; pos.set([Math.cos(w) * r, y, Math.sin(w) * r], i * 3); basis.push([Math.cos(w) * r, y, Math.sin(w) * r, rnd() * 6, 0.1 + rnd() * 0.25]); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const tex = leinwand(32, 32, (g) => { const v = g.createRadialGradient(16, 16, 0, 16, 16, 16); v.addColorStop(0, 'rgba(255,248,230,1)'); v.addColorStop(1, 'rgba(255,248,230,0)'); g.fillStyle = v; g.fillRect(0, 0, 32, 32); });
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map:tex, size:0.07, transparent:true, opacity:0.55, depthWrite:false, blending:THREE.AdditiveBlending, sizeAttenuation:true, fog:false }));
      pts.frustumCulled = false; szene.add(pts); staub = { pts, basis, pos };
    }
  }

  function halleBauen() {
    // Hallenboden: dunkler Teppich mit feinem Muster und Lichtpfütze unter dem Ring
    const teppich = leinwand(256, 256, (g, b, h) => {
      g.fillStyle = '#12141c'; g.fillRect(0, 0, b, h);
      for (let i = 0; i < 2200; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`; g.fillRect(Math.random() * b, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3); }
      g.strokeStyle = 'rgba(120,150,255,.06)'; g.lineWidth = 2; g.strokeRect(0, 0, b, h);
    });
    teppich.wrapS = teppich.wrapT = THREE.RepeatWrapping; teppich.repeat.set(26, 26);
    const bod = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map:teppich, roughness:0.85, envMapIntensity:0.3 }));
    bod.rotation.x = -Math.PI / 2; bod.position.y = -1.3; bod.receiveShadow = true; szene.add(bod);
    const pfuetze = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ map:leinwand(128, 128, (g) => { const v = g.createRadialGradient(64, 64, 4, 64, 64, 64); v.addColorStop(0, 'rgba(255,225,170,.34)'); v.addColorStop(0.5, 'rgba(120,150,255,.12)'); v.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = v; g.fillRect(0, 0, 128, 128); }), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, fog:false }));
    pfuetze.rotation.x = -Math.PI / 2; pfuetze.position.y = -1.285; szene.add(pfuetze);

    // Hallenwand: dunkler Verlauf, ferne Ränge als Lichtpunkte, Bänder
    const wand = leinwand(2048, 512, (g, b, h) => {
      const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, '#04060b'); v.addColorStop(0.5, '#0b1124'); v.addColorStop(1, '#141c36'); g.fillStyle = v; g.fillRect(0, 0, b, h);
      const cols = ['#ff5577', '#6aa0ff', '#ffd23f', '#9a7bff', '#ffffff', '#4ad0b0'];
      for (let r = 0; r < 7; r++) for (let i = 0; i < 520; i++) {
        const x = (i + Math.random() * 0.8) / 520 * b, y = h * 0.52 + r * 24 + Math.random() * 6; g.fillStyle = cols[Math.floor(Math.random() * cols.length)];
        g.globalAlpha = 0.18 + Math.random() * 0.4; g.fillRect(x, y, 4, 7);
      }
      g.globalAlpha = 1;
      for (let i = 0; i < 90; i++) { const x = Math.random() * b, y = h * (0.15 + Math.random() * 0.3), r = 6 + Math.random() * 16, gl = g.createRadialGradient(x, y, 0, x, y, r); const c = cols[Math.floor(Math.random() * cols.length)]; gl.addColorStop(0, c + '99'); gl.addColorStop(1, c + '00'); g.fillStyle = gl; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
      g.fillStyle = '#7fb4ff'; g.globalAlpha = 0.8; g.fillRect(0, h * 0.46, b, 3); g.fillStyle = '#ff4d7a'; g.fillRect(0, h * 0.47 + 4, b, 2); g.globalAlpha = 1;
    });
    wand.wrapS = THREE.RepeatWrapping;
    const huelle = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 22, 48, 1, true), new THREE.MeshBasicMaterial({ map:wand, side:THREE.BackSide, fog:false, color:'#cfd6ee' }));
    huelle.position.y = 8; szene.add(huelle);
    // Hängende Banner
    const banner = leinwand(256, 640, (g, b, h) => {
      const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, '#d32f2f'); v.addColorStop(1, '#6d1220'); g.fillStyle = v; g.fillRect(0, 0, b, h);
      g.fillStyle = '#ffd23f'; g.fillRect(0, 0, b, 14); g.fillRect(0, h - 14, b, 14);
      g.save(); g.translate(b / 2, h / 2); g.rotate(-Math.PI / 2); g.fillStyle = '#fff'; g.font = '800 96px "Bricolage Grotesque", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('RINGFIEBER', 0, 0);
      g.font = '700 34px "Bricolage Grotesque", Arial, sans-serif'; g.fillStyle = '#ffd23f'; g.fillText('★  SWIMMING LIONS  ★', 0, 70); g.restore();
    });
    const bnT = [], planEins = new THREE.PlaneGeometry(1, 1);
    for (let s = 0; s < 4; s++) for (const o of [-1, 1]) {
      const w = s * Math.PI / 2 + o * 0.5, r = 15;
      bnT.push({ g:planEins, s:[2.4, 6, 1], p:[Math.sin(w) * r, 6.2, Math.cos(w) * r], r:[0, w + Math.PI, 0] });
    }
    szene.add(new THREE.Mesh(Figuren.fusion(bnT), new THREE.MeshBasicMaterial({ map:banner, color:'#9aa0b4', side:THREE.DoubleSide })));

    // Tribünen und Publikum (Instanzen, damit es auch auf Handys läuft)
    const reihen = stufen() === 0 ? 5 : stufen() === 1 ? 7 : 8, abstand = stufen() === 2 ? 0.58 : 0.64;
    const plaetze = [];
    const stufeMat = new THREE.MeshStandardMaterial({ color:'#1a1d27', roughness:0.9, envMapIntensity:0.3 }), stufen_ = [], boxEins = new THREE.BoxGeometry(1, 1, 1);
    for (let seite = 0; seite < 4; seite++) {
      for (let r = 0; r < reihen; r++) {
        const tiefe = 5.2 + r * 0.85, hoehe = -1.3 + r * 0.42, breite = tiefe * 2 - 1.2;
        const n = Math.floor(breite / abstand);
        for (let i = 0; i < n; i++) {
          if (rnd() < 0.07) continue;
          const u = -breite / 2 + (i + 0.5) * (breite / n) + (rnd() - 0.5) * 0.1;
          const x = seite === 0 ? u : seite === 1 ? -u : seite === 2 ? tiefe : -tiefe;
          const z = seite === 0 ? tiefe : seite === 1 ? -tiefe : u;
          const hoch = rnd();
          plaetze.push({ x, y:hoehe + 0.3, z, phase:rnd() * 10, f:1.5 + rnd() * 2.5, groesse:0.88 + rnd() * 0.28, gier:0.1 + rnd() * 1.4, winkel:Math.atan2(-x, -z) + (rnd() - 0.5) * 0.25, hoch:hoch > 0.97 });
        }
        stufen_.push({ g:boxEins, s:[seite < 2 ? breite + 1.7 : 0.85, 0.42, seite < 2 ? 0.85 : breite + 1.7], p:[seite < 2 ? 0 : (seite === 2 ? tiefe : -tiefe), hoehe, seite < 2 ? (seite === 0 ? tiefe : -tiefe) : 0] });
      }
    }
    szene.add(new THREE.Mesh(Figuren.fusion(stufen_), stufeMat));
    publikumBauen(plaetze);
    // Blitzlichter im Publikum
    const blitzTex = leinwand(64, 64, (g) => { const v = g.createRadialGradient(32, 32, 0, 32, 32, 32); v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(0.3, 'rgba(255,255,240,.6)'); v.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = v; g.fillRect(0, 0, 64, 64); });
    for (let i = 0; i < (qualitaet === 'niedrig' ? 14 : 28); i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:blitzTex, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, fog:false }));
      const p = plaetze[Math.floor(rnd() * plaetze.length)];
      sp.position.set(p.x, p.y + 0.5, p.z); sp.scale.setScalar(0.9);
      szene.add(sp); blitze.push({ sp, an:0 });
    }
  }

  function publikumBauen(plaetze) {
    const st = stufen(), n = plaetze.length;
    const farben = ['#c0392b', '#2a6fd0', '#e8e8e8', '#2e8b57', '#f0a800', '#7a4fc2', '#2b2e36', '#e0408f', '#17a2b8', '#8a6a52', '#ff7a2f', '#3b4d78'];
    const haut = ['#f1c9a5', '#e0ac86', '#c99068', '#8d5a3b', '#5c3a24', '#f7d9bf'], haare = ['#1a1209', '#3b2314', '#6d4a2a', '#c58b3a', '#d9c07a', '#8a8a8a', '#a02a1a', '#222222'];
    const std = (o = {}) => new THREE.MeshStandardMaterial(Object.assign({ roughness:0.88, envMapIntensity:0.15 }, o));
    const koerperGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.5, st > 1 ? 9 : 7, 1, true); koerperGeo.scale(1, 1, 0.72);
    const kopfGeo = st > 1 ? new THREE.SphereGeometry(0.125, 8, 6) : st ? new THREE.SphereGeometry(0.125, 6, 4) : new THREE.IcosahedronGeometry(0.13, 0);
    const haarGeo = new THREE.SphereGeometry(0.136, st > 1 ? 8 : 6, 3, 0, Math.PI * 2, 0, Math.PI * 0.56);
    const armGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.36, 5, 1, false); armGeo.translate(0, -0.18, 0);
    const P = { plaetze, n, m:new THREE.Matrix4(), q:new THREE.Quaternion(), q2:new THREE.Quaternion(), s:V(1, 1, 1), p:V(), ax:V(0, 0, 1), takt:0 };
    P.koerper = new THREE.InstancedMesh(koerperGeo, std(), n); P.koepfe = new THREE.InstancedMesh(kopfGeo, std({ roughness:0.7 }), n);
    P.koerper.frustumCulled = P.koepfe.frustumCulled = false;
    const c = new THREE.Color();
    plaetze.forEach((p, i) => {
      P.koerper.setColorAt(i, c.set(farben[Math.floor(rnd() * farben.length)]).multiplyScalar(0.5 + rnd() * 0.25));
      p.haut = haut[Math.floor(rnd() * haut.length)];
      P.koepfe.setColorAt(i, c.set(p.haut));
    });
    szene.add(P.koerper, P.koepfe);
    if (st) {
      P.haare = new THREE.InstancedMesh(haarGeo, std({ roughness:0.6 }), n); P.haare.frustumCulled = false;
      plaetze.forEach((p, i) => P.haare.setColorAt(i, c.set(haare[Math.floor(rnd() * haare.length)])));
      P.armL = new THREE.InstancedMesh(armGeo, std({ side:THREE.DoubleSide }), n); P.armR = new THREE.InstancedMesh(armGeo, std({ side:THREE.DoubleSide }), n);
      P.armL.frustumCulled = P.armR.frustumCulled = false;
      plaetze.forEach((p, i) => { P.armL.setColorAt(i, c.set(p.haut)); P.armR.setColorAt(i, c.set(p.haut)); });
      szene.add(P.haare, P.armL, P.armR);
    }
    if (st > 1) {
      // Sitzlehnen
      const lehnen = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.62, 0.06), std({ color:'#232733' }), n);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pp = V();
      plaetze.forEach((p, i) => { q.setFromAxisAngle(V(0, 1, 0), p.winkel); pp.set(p.x - Math.sin(p.winkel) * 0.24, p.y - 0.02, p.z - Math.cos(p.winkel) * 0.24); m.compose(pp, q, V(1, 1, 1)); lehnen.setMatrixAt(i, m); });
      lehnen.frustumCulled = false; szene.add(lehnen);
    }
    publikum = P;
    publikumBewegen(0, true);
  }

  function publikumBewegen(dt, alle) {
    if (!publikum) return;
    const P = publikum, st = stufen();
    P.takt++;
    const ax = V(0, 1, 0), zq = new THREE.Quaternion();
    for (let i = alle ? 0 : P.takt & 1; i < P.n; i += alle ? 1 : 2) {
      const p = P.plaetze[i], sn = Math.sin(p.winkel), cs = Math.cos(p.winkel);
      const welle = Math.max(0, Math.sin(zeit * p.f + p.phase));
      const hupf = welle * 0.2 * Math.min(1.4, aufregung) * (p.hoch ? 1.4 : 1);
      P.q.setFromAxisAngle(ax, p.winkel);
      P.s.setScalar(p.groesse);
      P.p.set(p.x, p.y + hupf, p.z); P.m.compose(P.p, P.q, P.s); P.koerper.setMatrixAt(i, P.m);
      P.p.set(p.x, p.y + hupf + 0.42 * p.groesse, p.z); P.m.compose(P.p, P.q, P.s); P.koepfe.setMatrixAt(i, P.m);
      if (P.haare) { P.p.set(p.x, p.y + hupf + 0.43 * p.groesse, p.z); P.m.compose(P.p, P.q, P.s); P.haare.setMatrixAt(i, P.m); }
      if (P.armL) {
        // Arme: hängen locker, bei Aufregung gehen sie hoch und winken
        const hoeh = Math.max(0, Math.min(1, (aufregung - 0.4 - p.gier * 0.5) * 1.8));
        const w = hoeh * (2.55 + 0.45 * Math.sin(zeit * 8 + p.phase)) + 0.06 * Math.sin(zeit + p.phase);
        for (const [mesh, sd] of [[P.armL, -1], [P.armR, 1]]) {
          const sw = sd * 0.19 * p.groesse;
          zq.setFromAxisAngle(P.ax, sd * w); P.q2.copy(P.q).multiply(zq);
          P.p.set(p.x + cs * sw, p.y + hupf + 0.2 * p.groesse, p.z - sn * sw); P.m.compose(P.p, P.q2, P.s); mesh.setMatrixAt(i, P.m);
        }
      }
    }
    P.koerper.instanceMatrix.needsUpdate = P.koepfe.instanceMatrix.needsUpdate = true;
    if (P.haare) P.haare.instanceMatrix.needsUpdate = true;
    if (P.armL) P.armL.instanceMatrix.needsUpdate = P.armR.instanceMatrix.needsUpdate = true;
  }

  /* ---------- Effekte: Funken, Schweiß, Schockwellen, Sterne, Konfetti ---------- */
  const T = {};
  function effekteBauen() {
    T.funke = leinwand(64, 64, (g) => {
      const v = g.createRadialGradient(32, 32, 0, 32, 32, 30); v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(0.35, 'rgba(255,220,120,.9)'); v.addColorStop(1, 'rgba(255,120,0,0)');
      g.fillStyle = v; g.beginPath();
      for (let i = 0; i < 10; i++) { const w = i / 10 * Math.PI * 2, r = i % 2 ? 10 : 30; g.lineTo(32 + Math.cos(w) * r, 32 + Math.sin(w) * r); }
      g.fill();
    });
    T.glut = leinwand(64, 64, (g) => { const v = g.createRadialGradient(32, 32, 0, 32, 32, 32); v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(0.4, 'rgba(255,255,255,.45)'); v.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = v; g.fillRect(0, 0, 64, 64); });
    T.tropfen = leinwand(32, 32, (g) => {
      g.beginPath(); g.arc(16, 18, 9, 0, Math.PI * 2); g.fillStyle = 'rgba(200,230,255,.95)'; g.fill();
      g.beginPath(); g.moveTo(16, 3); g.lineTo(9.4, 14); g.lineTo(22.6, 14); g.closePath(); g.fill();
      g.beginPath(); g.arc(12.5, 15.5, 2.6, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,1)'; g.fill();
    });
    T.staub = leinwand(64, 64, (g) => { const v = g.createRadialGradient(32, 32, 0, 32, 32, 32); v.addColorStop(0, 'rgba(210,215,225,.8)'); v.addColorStop(0.6, 'rgba(180,186,200,.35)'); v.addColorStop(1, 'rgba(160,166,180,0)'); g.fillStyle = v; g.fillRect(0, 0, 64, 64); });
    T.ring = leinwand(128, 128, (g) => {
      const v = g.createRadialGradient(64, 64, 34, 64, 64, 62); v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(0.55, 'rgba(255,255,255,.95)'); v.addColorStop(0.75, 'rgba(255,255,255,.35)'); v.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = v; g.fillRect(0, 0, 128, 128);
    });
    T.stern = leinwand(64, 64, (g) => {
      g.beginPath(); for (let i = 0; i < 10; i++) { const w = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 12 : 29; g.lineTo(32 + Math.cos(w) * r, 32 + Math.sin(w) * r); } g.closePath();
      g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#ff9b00'; g.stroke();
      g.beginPath(); g.arc(28, 27, 5, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
    });
    T.burst = leinwand(128, 128, (g) => {
      const v = g.createRadialGradient(64, 64, 0, 64, 64, 60); v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(0.3, 'rgba(255,240,170,.9)'); v.addColorStop(1, 'rgba(255,140,0,0)');
      g.fillStyle = v; g.beginPath(); for (let i = 0; i < 16; i++) { const w = i / 16 * Math.PI * 2, r = i % 2 ? 22 : 62; g.lineTo(64 + Math.cos(w) * r, 64 + Math.sin(w) * r); } g.fill();
    });
    // Comic-Wörter bei harten Treffern
    T.woerter = ['BAM!', 'POW!', 'WUMM!', 'KRACH!', 'PENG!'].map(w => leinwand(256, 128, (g) => {
      g.translate(128, 64); g.rotate(-0.08);
      g.beginPath(); for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2, r = i % 2 ? 46 : 62; g.lineTo(Math.cos(a) * r * 1.9, Math.sin(a) * r); } g.closePath();
      g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#d32f2f'; g.stroke();
      g.font = '800 54px "Bricolage Grotesque", Impact, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 8; g.strokeStyle = '#2a0a10'; g.strokeText(w, 0, 3); g.fillStyle = '#ffffff'; g.fillText(w, 0, 3);
    }));
    const N = qualitaet === 'hoch' ? 150 : qualitaet === 'mittel' ? 90 : 50;
    for (let i = 0; i < N; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:T.funke, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, fog:false }));
      sp.visible = false; szene.add(sp);
      teile.push({ sp, v:V(), leben:0, max:1, g:0, s0:0.1, s1:0.1, drag:0, spin:0, a0:1 });
    }
    for (let i = 0; i < 2; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:T.woerter[0], transparent:true, depthWrite:false, depthTest:false, fog:false }));
      sp.visible = false; sp.renderOrder = 10; szene.add(sp); woerterPool.push({ sp, leben:0, max:0.55, rot:0, gf:1 });
    }
    // Kreisende Sterne über dem Kopf eines Angeschlagenen
    for (let i = 0; i < 2; i++) {
      const gr = []; for (let k = 0; k < 5; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:T.stern, transparent:true, depthWrite:false, fog:false })); sp.visible = false; szene.add(sp); gr.push(sp); }
      schwindel[i] = { sterne:gr, an:0, pos:V(), aktiv:false };
    }
    // Schockwelle am Boden
    boden = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 56), new THREE.MeshBasicMaterial({ color:'#ffe6a8', transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, fog:false }));
    boden.rotation.x = -Math.PI / 2; boden.visible = false; szene.add(boden); boden.userData = { t:0, max:0.8 };
    // Herausgeschleuderter Mundschutz
    schutz = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color:'#eaf6ff', roughness:0.25, envMapIntensity:1 }));
    schutz.visible = false; schutz.userData = { v:V(), w:V(), t:0 }; schutz.castShadow = true; szene.add(schutz);
    // Konfetti (eine einzige Instanzgruppe)
    const KN = qualitaet === 'hoch' ? 220 : qualitaet === 'mittel' ? 130 : 70;
    const km = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.11, 0.07), new THREE.MeshBasicMaterial({ side:THREE.DoubleSide, fog:false }), KN);
    km.frustumCulled = false; km.count = 0;
    const kc = new THREE.Color(), kf = ['#ff4d6d', '#ffd23f', '#3fa7ff', '#5ee08a', '#ffffff', '#b07cff', '#ff9b3d'];
    const teilchen = [];
    for (let i = 0; i < KN; i++) { km.setColorAt(i, kc.set(kf[i % kf.length])); teilchen.push({ p:V(), v:V(), r:V(), w:V(), leben:0 }); }
    szene.add(km); konfettiSystem = { mesh:km, teilchen, aktiv:0, m:new THREE.Matrix4(), q:new THREE.Quaternion(), e:new THREE.Euler(), s:V(1, 1, 1) };
  }
  const teile = [], woerterPool = [];
  let gf = 1;   // Größenfaktor der Effekte (klein, wenn die Kamera nah dran ist)

  function teilchen(tex, pos, v, leben, s0, s1, g, farbe, a0, add = true, drag = 0, spin = 0) {
    for (const f of teile) {
      if (f.leben > 0) continue;
      f.sp.visible = true; f.sp.position.copy(pos); f.v.copy(v); f.max = f.leben = leben; f.g = g; f.s0 = s0 * gf; f.s1 = s1 * gf; f.drag = drag; f.spin = spin; f.a0 = a0;
      f.sp.material.map = T[tex]; f.sp.material.color.set(farbe); f.sp.material.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending; f.sp.material.rotation = Math.random() * 6.28;
      f.sp.scale.setScalar(s0 * gf); f.sp.material.opacity = a0;
      return f;
    }
    return null;
  }
  const tv = V(), tp = V(), zb = V();
  const rv = (s) => tv.set((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(s);

  // opt: { kopf, richtung (Vector3 vom Angreifer zum Ziel), sterne, konter }
  function treffer(pos, staerke, farbe, opt = {}) {
    const dir = opt.richtung ? opt.richtung : null;
    const st = staerke, f = farbe || '#ffffff';
    gf = Math.max(0.3, Math.min(1.15, kamera.position.distanceTo(pos) / 3.4));
    // Funken: schnell, mit Schweif aus Glut
    let n = Math.round(6 + st * 10);
    for (let i = 0; i < n; i++) {
      tv.set((Math.random() - 0.5), (Math.random() - 0.2), (Math.random() - 0.5)).normalize().multiplyScalar(1.5 + Math.random() * 3 * st);
      if (dir) tv.addScaledVector(dir, 1.2 * st);
      teilchen('funke', pos, tv, 0.25 + Math.random() * 0.25, 0.12 + Math.random() * 0.18 * (0.6 + st), 0.03, 6, f, 1, true, 0.5);
    }
    // Aufleuchten und Schockwelle (zum Betrachter hin gedreht)
    zb.copy(kamera.position).sub(pos).normalize();
    tp.copy(zb).multiplyScalar(0.12).add(pos);
    teilchen('burst', tp, tv.set(0, 0, 0), 0.12, 0.35 + st * 0.3, 0.6 + st * 0.6, 0, f === '#ffffff' ? '#ffe9b0' : f, 0.85, true);
    teilchen('ring', tp, tv.set(0, 0, 0), 0.3 + st * 0.1, 0.2, 0.8 + st * 1.0, 0, f === '#ffffff' ? '#ffe9b0' : f, 0.8, true);
    if (st > 0.7) teilchen('ring', tp, tv.set(0, 0, 0), 0.4, 0.12, 0.6 + st * 0.7, 0, '#ffffff', 0.55, true);
    // Schweiß und Staub
    const kopf = opt.kopf !== false && (opt.kopf || !opt.koerper);
    const sw = Math.round((kopf ? 5 : 2) + st * (kopf ? 8 : 3));
    for (let i = 0; i < sw; i++) {
      tv.set((Math.random() - 0.5) * 1.6, Math.random() * 1.6 + 0.4, (Math.random() - 0.5) * 1.6);
      if (dir) tv.addScaledVector(dir, 1.6 + Math.random() * 2.6 * st);
      teilchen('tropfen', pos, tv, 0.5 + Math.random() * 0.5, 0.05 + Math.random() * 0.045, 0.03, 9, '#ffffff', 0.95, false, 0.2);
    }
    if (opt.koerper) for (let i = 0; i < 3; i++) teilchen('staub', pos, rv(1), 0.7, 0.2, 0.7, -0.3, '#c9ced8', 0.5, false, 1.5);
    // Comic-Wort bei richtig harten Treffern
    if (opt.wort || st > 1.05) {
      const w = woerterPool.find(x => x.leben <= 0);
      if (w) {
        w.leben = w.max = 0.6; w.gf = gf; w.sp.visible = true; w.sp.material.map = T.woerter[Math.floor(Math.random() * T.woerter.length)];
        w.sp.position.copy(pos).addScaledVector(zb, 0.4); w.sp.position.y += 0.35; w.rot = (Math.random() - 0.5) * 0.5;
      }
    }
    gf = 1;
    wackeln = Math.max(wackeln, 0.04 + st * 0.1);
    stoss = Math.min(1.2, Math.max(stoss, 0.25 + st * 0.5));
    aufregung = Math.min(1.6, aufregung + 0.12 + st * 0.25);
    spot.userData.blitz = Math.min(1.5, (spot.userData.blitz || 0) + st * 0.5);
  }
  function jubel(staerke) { aufregung = Math.min(2, aufregung + staerke); }

  // Niederschlag: Schockwelle am Boden, Staub, herausfliegender Mundschutz, Blitzgewitter im Publikum
  function ko(pos, opt = {}) {
    gf = Math.max(0.5, Math.min(1.15, kamera.position.distanceTo(pos) / 3.4));
    boden.position.set(pos.x, 0.03, pos.z); boden.userData.t = boden.userData.max; boden.visible = true;
    for (let i = 0; i < 14; i++) {
      const w = i / 14 * 6.283 + Math.random() * 0.3;
      tv.set(Math.cos(w) * (0.8 + Math.random()), 0.15 + Math.random() * 0.3, Math.sin(w) * (0.8 + Math.random()));
      tp.set(pos.x, 0.12, pos.z);
      teilchen('staub', tp, tv, 1.1, 0.35, 1.5, -0.2, '#cfd4de', 0.55, false, 1.6);
    }
    if (opt.kopf && opt.kopfPos) {
      schutz.visible = true; schutz.position.copy(opt.kopfPos); schutz.material.color.set(opt.farbe || '#eaf6ff');
      schutz.userData.v.set((Math.random() - 0.5) * 1.5, 3.2, (Math.random() - 0.5) * 1.5).addScaledVector(opt.richtung || tv.set(0, 0, 0), 2.2);
      schutz.userData.w.set(Math.random() * 14, Math.random() * 14, Math.random() * 14); schutz.userData.t = 3.2;
      for (let i = 0; i < 14; i++) { tv.set((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3); teilchen('tropfen', opt.kopfPos, tv, 0.9, 0.06, 0.04, 9, '#ffffff', 0.9, false, 0.3); }
    }
    for (const b of blitze) if (Math.random() < 0.7) b.an = 0.09 + Math.random() * 0.4;
    gf = 1;
    wackeln = Math.max(wackeln, 0.16); stoss = 1.2; aufregung = Math.min(2, aufregung + 0.8);
    lichtEffekt('#ffb347', 1.4);
  }
  function lichtEffekt(farbe, sek) { lichtShow.farbe.set(farbe); lichtShow.t = lichtShow.max = sek; }
  // Sterne über dem Kopf (Boxer i, pos = Kopfposition oder null zum Ausschalten)
  function benommen(i, pos) {
    const s = schwindel[i]; if (!s) return;
    if (pos) { s.pos.copy(pos); s.aktiv = true; } else s.aktiv = false;
  }
  function konfetti(menge) {
    const K = konfettiSystem; if (!K) return;
    const n = Math.round(K.teilchen.length * Math.min(1, menge));
    for (let i = 0, k = 0; i < K.teilchen.length && k < n; i++) {
      const t = K.teilchen[i]; if (t.leben > 0) continue; k++;
      t.leben = 5 + Math.random() * 3; t.p.set((Math.random() - 0.5) * 6.5, 6 + Math.random() * 2.5, (Math.random() - 0.5) * 6.5);
      t.v.set((Math.random() - 0.5) * 1.5, -0.5 - Math.random() * 1.2, (Math.random() - 0.5) * 1.5); t.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); t.w.set(3 + Math.random() * 6, 3 + Math.random() * 6, 3 + Math.random() * 6);
    }
    K.mesh.count = K.teilchen.length;
  }


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
    } else if (modus === 'frei') {
      // Freie Kamera für Tests und Nahaufnahmen (opt.pos, opt.blick)
      kamZiel.pos.copy(opt.pos); kamZiel.blick.copy(opt.blick);
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
    // Kurzer Zoom-Stoß bei harten Treffern
    if (stoss > 0.002) {
      stoss = Math.max(0, stoss - dt * 4.5);
      kamera.fov = fovBasis * (1 - stoss * 0.06); kamera.updateProjectionMatrix();
    } else if (kamera.fov !== fovBasis) { kamera.fov = fovBasis; kamera.updateProjectionMatrix(); }
    publikumBewegen(dt);
    for (const b of blitze) {
      if (b.an > 0) { b.an -= dt; b.sp.material.opacity = Math.max(0, b.an / 0.09); }
      else if (Math.random() < dt * 0.08 * (0.3 + aufregung * 1.4)) { b.an = 0.09; b.sp.material.opacity = 1; }
    }
    // Hallenlicht: pulsiert mit der Stimmung, Treffer und Niederschläge blitzen kurz auf
    const ub = spot.userData; ub.blitz = Math.max(0, (ub.blitz || 0) - dt * 4);
    spot.intensity = 2.6 + ub.blitz * 1.4;
    const ls = lichtShow; if (ls.t > 0) ls.t -= dt;
    const lk = ls.t > 0 ? ls.t / ls.max : 0;
    for (const f in licht) {
      const l = licht[f];
      l.intensity = l.userData.basis * (0.85 + 0.4 * Math.min(1.5, aufregung) + 0.2 * Math.sin(zeit * 2.2 + l.userData.phase)) + lk * 2.2;
    }
    for (const k of strahlen) {
      const u = k.userData, sw = Math.sin(zeit * (0.5 + aufregung * 0.5) + u.phase);
      k.rotation.x = sw * 0.07 * (0.6 + aufregung); k.rotation.z = Math.cos(zeit * 0.6 + u.phase) * 0.07 * (0.6 + aufregung);
      k.material.opacity = 0.075 + 0.045 * Math.min(1.5, aufregung) + lk * 0.1;
      if (lk > 0) k.material.color.lerp(lichtShow.farbe, 0.15);
    }
    if (staub) {
      const pos = staub.pts.geometry.attributes.position;
      staub.basis.forEach((b, i) => { pos.setXYZ(i, b[0] + Math.sin(zeit * b[4] + b[3]) * 0.25, b[1] + Math.sin(zeit * b[4] * 0.8 + b[3] * 2) * 0.3, b[2] + Math.cos(zeit * b[4] + b[3]) * 0.25); });
      pos.needsUpdate = true;
    }
    if (led) led.offset.x = (led.offset.x + dt * 0.02) % 1;
    // Partikel
    for (const f of teile) {
      if (f.leben <= 0) continue;
      f.leben -= dt;
      if (f.leben <= 0) { f.sp.visible = false; continue; }
      f.v.y -= f.g * dt;
      if (f.drag) f.v.multiplyScalar(Math.max(0, 1 - f.drag * dt));
      f.sp.position.addScaledVector(f.v, dt);
      const k = f.leben / f.max;
      f.sp.scale.setScalar(f.s1 + (f.s0 - f.s1) * k);
      f.sp.material.opacity = f.a0 * Math.min(1, k * 2.2);
      if (f.spin) f.sp.material.rotation += f.spin * dt;
    }
    for (const w of woerterPool) {
      if (w.leben <= 0) continue;
      w.leben -= dt;
      if (w.leben <= 0) { w.sp.visible = false; continue; }
      const k = 1 - w.leben / w.max;
      const pop = k < 0.2 ? k / 0.2 * 1.25 : 1.25 - 0.2 * Math.min(1, (k - 0.2) / 0.15);
      w.sp.scale.set(1.15 * pop * w.gf, 0.58 * pop * w.gf, 1); w.sp.material.rotation = w.rot; w.sp.material.opacity = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      w.sp.position.y += dt * 0.25;
    }
    // Sterne kreisen über dem Kopf
    for (const s of schwindel) {
      if (!s) continue;
      s.an += ((s.aktiv ? 1 : 0) - s.an) * Math.min(1, dt * 10);
      s.sterne.forEach((sp, k) => {
        sp.visible = s.an > 0.03;
        if (!sp.visible) return;
        const w = zeit * 4.2 + k * 1.2566;
        sp.position.set(s.pos.x + Math.cos(w) * 0.26, s.pos.y + 0.3 + Math.sin(w * 2) * 0.03, s.pos.z + Math.sin(w) * 0.26);
        sp.scale.setScalar(0.13 * s.an * (0.8 + 0.2 * Math.sin(zeit * 9 + k))); sp.material.opacity = s.an; sp.material.rotation = zeit * 3 + k;
      });
    }
    if (boden.visible) {
      boden.userData.t -= dt;
      const k = 1 - boden.userData.t / boden.userData.max;
      if (k >= 1) boden.visible = false;
      else { boden.scale.setScalar(0.3 + k * 3.4); boden.material.opacity = 0.85 * (1 - k) * (1 - k); }
    }
    if (schutz.visible) {
      const u = schutz.userData; u.t -= dt;
      u.v.y -= 9.5 * dt; schutz.position.addScaledVector(u.v, dt);
      schutz.rotation.x += u.w.x * dt; schutz.rotation.y += u.w.y * dt; schutz.rotation.z += u.w.z * dt;
      if (schutz.position.y < 0.04 && Math.abs(schutz.position.x) < RING && Math.abs(schutz.position.z) < RING) {
        schutz.position.y = 0.04; u.v.y *= -0.38; u.v.x *= 0.6; u.v.z *= 0.6; u.w.multiplyScalar(0.6);
      }
      if (u.t <= 0 || schutz.position.y < -1.2) schutz.visible = false;
    }
    const K = konfettiSystem;
    if (K && K.mesh.count) {
      let leben = 0;
      for (let i = 0; i < K.teilchen.length; i++) {
        const t = K.teilchen[i];
        if (t.leben > 0) {
          t.leben -= dt; leben++;
          t.v.x += (Math.sin(zeit * 2 + i) * 0.6 - t.v.x) * dt * 1.5; t.v.z += (Math.cos(zeit * 2.3 + i) * 0.6 - t.v.z) * dt * 1.5; t.v.y = Math.max(t.v.y - 0.8 * dt, -1.4);
          t.p.addScaledVector(t.v, dt);
          if (t.p.y < 0.02 && Math.abs(t.p.x) < RING && Math.abs(t.p.z) < RING) { t.p.y = 0.02; t.v.set(0, 0, 0); t.w.multiplyScalar(0); }
          if (t.p.y < -1.28) t.leben = 0;
          t.r.x += t.w.x * dt; t.r.y += t.w.y * dt; t.r.z += t.w.z * dt;
          K.e.set(t.r.x, t.r.y, t.r.z); K.q.setFromEuler(K.e); K.s.setScalar(t.leben < 0.6 ? Math.max(0.001, t.leben / 0.6) : 1);
          K.m.compose(t.p, K.q, K.s);
        } else { K.m.makeScale(0, 0, 0); }
        K.mesh.setMatrixAt(i, K.m);
      }
      K.mesh.instanceMatrix.needsUpdate = true;
      if (!leben) K.mesh.count = 0;
    }
    renderer.render(szene, kamera);
  }

  function groesse() {
    if (!renderer) return;
    const b = window.innerWidth, h = window.innerHeight;
    renderer.setSize(b, h, false);
    kamera.aspect = b / h;
    kamera.fov = fovBasis = b / h < 0.8 ? 72 : b / h < 1.2 ? 62 : 52;
    kamera.updateProjectionMatrix();
  }

  // Weltpunkt → Bildschirm (für schwebende Zahlen)
  const tmp = V();
  function aufSchirm(pos) {
    tmp.copy(pos).project(kamera);
    return { x:(tmp.x + 1) / 2 * window.innerWidth, y:(1 - tmp.y) / 2 * window.innerHeight, sichtbar:tmp.z < 1 };
  }

  return { bauen, bild, kameraSetzen, treffer, jubel, ko, benommen, konfetti, lichtEffekt, aufSchirm, get szene() { return szene; }, get kamera() { return kamera; }, get renderer() { return renderer; } };
})();
