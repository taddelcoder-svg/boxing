/* Ringfieber – Hauptprogramm: Menüs, Karriere, Solo-Kämpfe, Online (Duell/Turnier), Anzeige und Schleife. */
'use strict';

(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const TAKT_S = 1 / RF.TAKT;
  const klemm = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const speicher = {
    lesen(k, std) { try { const v = localStorage.getItem(k); return v ? Object.assign({}, std, JSON.parse(v)) : { ...std }; } catch (_) { return { ...std }; } },
    schreiben(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* privat */ } }
  };
  const sitzung = {
    lesen(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (_) { return null; } },
    schreiben(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* egal */ } },
    weg(k) { try { sessionStorage.removeItem(k); } catch (_) { /* egal */ } }
  };
  const LIGEN = Object.keys(RF.LIGEN);

  /* ---------- Profil und Karriere ---------- */
  const profil = speicher.lesen('rf-profil', { name:'', preset:RF.PRESETS[Math.floor(Math.random() * RF.PRESETS.length)].id, hose:'#d32f2f', handschuhe:'#d32f2f' });
  const karriere = speicher.lesen('rf-karriere', { bronze:0, silber:0, gold:0, kaempfe:0 });
  const profilSpeichern = () => speicher.schreiben('rf-profil', profil);
  const karriereSpeichern = () => speicher.schreiben('rf-karriere', karriere);
  const ligaFrei = liga => liga === 'bronze' || karriere[LIGEN[LIGEN.indexOf(liga) - 1]] >= 8;
  const farbeFrei = f => !f.frei || karriere[f.frei] >= 8;
  const aussehenAus = p => Object.assign({}, RF.PRESETS.find(x => x.id === p.preset) || RF.PRESETS[0], { hose:p.hose || '#d32f2f', handschuhe:p.handschuhe || '#d32f2f' });
  const gegner = id => RF.GEGNER.find(g => g.id === id) || RF.GEGNER[0];

  let grafik = (() => { try { return localStorage.getItem('rf-grafik'); } catch (_) { return null; } })() || (Eingabe.istTouch() ? 'mittel' : 'hoch');

  /* ---------- 3D ---------- */
  Arena.bauen($('#welt'), grafik);
  const B3 = [new Figuren.Boxer3D(aussehenAus(profil)), new Figuren.Boxer3D(gegner('bruno').aussehen)];
  B3[0].wurzel.position.set(0, 0, -0.5);
  B3[1].wurzel.position.set(0, 0, 0.5); B3[1].wurzel.rotation.y = Math.PI;
  for (const b of B3) Arena.szene.add(b.wurzel);

  const leer = () => ({ aktion:'bereit', t:0, a:null, seite:'R', hp:100, hpMax:100, puste:100, sterne:0, nd:0, dauer:0, block:false, platt:0, tippen:0, tippenNoetig:1 });
  const anzeige = { boxer:[leer(), leer()], phase:'kampf', runde:1, runden:3, uhr:0, zaehler:0, ecke:0, namen:['Du', 'Gegner'], introK:1 };

  /* ---------- Bildschirme ---------- */
  let schirm = 'start', modus = 'menue';
  const SCHIRME = { start:'#sStart', karriere:'#sKarriere', gegner:'#sGegner', boxer:'#sBoxer', online:'#sOnline', lobby:'#sLobby', baum:'#sBaum', pause:'#sPause', ergebnis:'#sErgebnis', hilfe:'#sHilfe', hud:'#hud' };
  function zeige(name) {
    for (const [n, sel] of Object.entries(SCHIRME)) $(sel).hidden = n !== name && !(name === 'pause' && n === 'hud');
    schirm = name;
    Eingabe.aktiv(name === 'hud' && anzeige.ecke != null && (modus === 'solo' || modus === 'online'));
    const f = $(SCHIRME[name]).querySelector('.knopf.haupt, button');
    if (f && name !== 'hud' && !Eingabe.istTouch()) setTimeout(() => f.focus({ preventScroll:true }), 0);
  }
  let hilfeZurueck = 'start', boxerZurueck = 'start';
  for (const b of $$('[data-gehe]')) b.addEventListener('click', () => {
    Ton.klick();
    const z = b.dataset.gehe;
    if (z === 'start') startZeigen();
    else if (z === 'karriere') karriereZeigen();
    else if (z === 'online') onlineZeigen();
    else if (z === 'schnell' || z === 'training') gegnerZeigen(z);
    else if (z === 'boxer') { boxerZurueck = 'start'; boxerZeigen(); }
    else if (z === 'hilfe') { hilfeZurueck = b.dataset.zurueck || 'start'; zeige('hilfe'); }
  });
  $('#hilfeZurueck').onclick = () => { Ton.klick(); if (hilfeZurueck === 'pause') zeige('pause'); else startZeigen(); };

  function startZeigen() {
    modus = 'menue';
    demoStarten();
    const liga = LIGEN.find(l => karriere[l] < 8);
    $('#karriereStand').textContent = liga ? `${RF.LIGEN[liga].name} ${karriere[liga]}/8` : 'Champion ★';
    $('#tonKnopf').textContent = Ton.an ? '🔊 Ton an' : '🔇 Ton aus';
    $('#grafikWahl').value = grafik;
    zeige('start');
  }
  $('#tonKnopf').onclick = () => { Ton.start(); Ton.setzen(!Ton.an); $('#tonKnopf').textContent = Ton.an ? '🔊 Ton an' : '🔇 Ton aus'; };
  $('#grafikWahl').onchange = e => { try { localStorage.setItem('rf-grafik', e.target.value); } catch (_) { /* egal */ } location.reload(); };

  /* ---------- Gegnerkarten (Karriere, Schnellkampf, Training) ---------- */
  function gegnerKarte(g, i, { marke, markeArt, gesperrt, gewaehlt }) {
    const b = document.createElement('button');
    b.className = 'wahl'; b.type = 'button'; b.disabled = !!gesperrt;
    b.setAttribute('aria-pressed', gewaehlt ? 'true' : 'false');
    b.innerHTML = `<span class="nr">Gegner ${i + 1} <span class="farbpunkt" style="background:${g.aussehen.hose}"></span></span><span class="name">${esc(g.name)}</span><span class="typ">${esc(g.typ)}</span>${marke ? `<span class="marke ${markeArt || ''}">${esc(marke)}</span>` : ''}`;
    return b;
  }
  function ligaReiter(el, aktiv, nurFreie, wahl) {
    el.innerHTML = '';
    for (const l of LIGEN) {
      const b = document.createElement('button');
      b.textContent = (nurFreie && !ligaFrei(l) ? '🔒 ' : '') + RF.LIGEN[l].name;
      b.disabled = nurFreie && !ligaFrei(l);
      b.setAttribute('aria-pressed', l === aktiv ? 'true' : 'false');
      b.onclick = () => { Ton.klick(); wahl(l); };
      el.appendChild(b);
    }
  }

  let karriereLiga = LIGEN.slice().reverse().find(ligaFrei) || 'bronze', karriereWahl = null;
  function karriereZeigen() {
    modus = 'menue';
    if (!ligaFrei(karriereLiga)) karriereLiga = 'bronze';
    const n = karriere[karriereLiga];
    if (karriereWahl == null || karriereWahl > Math.min(n, 7)) karriereWahl = Math.min(n, 7);
    ligaReiter($('#ligaReiter'), karriereLiga, true, l => { karriereLiga = l; karriereWahl = null; karriereZeigen(); });
    const liste = $('#karriereListe'); liste.innerHTML = '';
    RF.GEGNER.forEach((g, i) => {
      const besiegt = i < n, naechster = i === n;
      const k = gegnerKarte(g, i, { marke:besiegt ? 'Besiegt' : naechster ? 'Nächster' : '🔒', markeArt:besiegt ? 'sieg' : naechster ? 'jetzt' : '', gesperrt:i > n, gewaehlt:i === karriereWahl });
      k.onclick = () => { Ton.klick(); karriereWahl = i; karriereZeigen(); };
      liste.appendChild(k);
    });
    const g = RF.GEGNER[karriereWahl];
    $('#karriereTipp').hidden = false;
    $('#karriereTipp').textContent = `${g.kurz}: ${g.tipp}`;
    $('#karriereInfo').textContent = n >= 8 ? `${RF.LIGEN[karriereLiga].name}-Liga geschafft – Revanche gegen jeden möglich.` : `${n} von 8 besiegt`;
    $('#karriereStart').onclick = () => { Ton.klick(); soloStarten('karriere', g.id, karriereLiga); };
    zeige('karriere');
  }

  let gegnerModus = 'schnell', gegnerLiga = 'silber', gegnerWahl = 0;
  function gegnerZeigen(m) {
    modus = 'menue';
    if (m) gegnerModus = m;
    const training = gegnerModus === 'training';
    $('#gegnerTitel').textContent = training ? 'Training' : 'Schnellkampf';
    $('#gegnerText').textContent = training
      ? 'Du kannst nicht verlieren. Bei jedem Ausholen des Gegners steht unten, was hilft. Mit Zeitlupe übst du das Timing.'
      : 'Ein Kampf über drei Runden gegen einen Gegner deiner Wahl – in jeder Liga.';
    $('#zeitlupeWahl').hidden = !training;
    ligaReiter($('#gegnerLiga'), gegnerLiga, false, l => { gegnerLiga = l; gegnerZeigen(); });
    const liste = $('#gegnerListe'); liste.innerHTML = '';
    RF.GEGNER.forEach((g, i) => {
      const k = gegnerKarte(g, i, { gewaehlt:i === gegnerWahl });
      k.onclick = () => { Ton.klick(); gegnerWahl = i; gegnerZeigen(); };
      liste.appendChild(k);
    });
    const g = RF.GEGNER[gegnerWahl];
    $('#gegnerTipp').hidden = false; $('#gegnerTipp').textContent = `${g.kurz}: ${g.tipp}`;
    $('#gegnerStart').onclick = () => { Ton.klick(); soloStarten(gegnerModus, g.id, gegnerLiga); };
    zeige('gegner');
  }

  /* ---------- Mein Boxer ---------- */
  function boxerZeigen() {
    modus = 'menue'; demo = null;
    anzeige.boxer = [leer(), leer()];
    B3[0].aussehenSetzen(aussehenAus(profil)); B3[0].ichSicht(false); durchsicht[0] = false;
    $('#nameFeld').value = profil.name;
    const presets = $('#presetListe'); presets.innerHTML = '';
    for (const p of RF.PRESETS) {
      const b = document.createElement('button');
      b.className = 'wahl'; b.type = 'button'; b.setAttribute('aria-pressed', p.id === profil.preset ? 'true' : 'false');
      b.innerHTML = `<span class="farbpunkt" style="background:${p.haut};width:22px;height:22px"></span><span class="name" style="font-size:1.15rem">${esc(p.name)}</span>`;
      b.onclick = () => { Ton.klick(); profil.preset = p.id; profilSpeichern(); boxerZeigen(); };
      presets.appendChild(b);
    }
    for (const [el, feld] of [[$('#hoseListe'), 'hose'], [$('#handschuhListe'), 'handschuhe']]) {
      el.innerHTML = '';
      for (const f of RF.FARBEN) {
        const b = document.createElement('button');
        b.className = 'farbe'; b.type = 'button'; b.style.background = f.wert;
        b.disabled = !farbeFrei(f);
        b.title = farbeFrei(f) ? f.name : `${f.name} – freischalten: ${RF.LIGEN[f.frei].name}-Liga gewinnen`;
        b.setAttribute('aria-label', b.title);
        b.setAttribute('aria-pressed', profil[feld] === f.wert ? 'true' : 'false');
        b.onclick = () => { Ton.klick(); profil[feld] = f.wert; profilSpeichern(); boxerZeigen(); };
        el.appendChild(b);
      }
    }
    zeige('boxer');
  }
  $('#nameFeld').addEventListener('input', e => { profil.name = e.target.value.slice(0, 16); profilSpeichern(); });
  $('#boxerZurueck').onclick = () => {
    Ton.klick();
    if (netz.ws) hallo(false);
    if (boxerZurueck === 'lobby') lobbyZeigen(); else startZeigen();
  };

  /* ---------- Solo-Kämpfe ---------- */
  let solo = null, demo = null, zeitlupeBis = 0;
  function soloStarten(art, gegnerId, liga) {
    netzBeenden();
    const g = gegner(gegnerId), gw = RF.gegnerWerte(gegnerId, liga);
    const training = art === 'training';
    if (training) { gw.hp = 260; gw.ki.liegen = 0; }
    const kampf = new RF.Kampf({ boxer:[{ unverwundbar:training }, gw], runden:training ? 1 : 3, dauer:training ? 300 : 60, startwert:1 + Math.floor(Math.random() * 2 ** 30), gnade:2 });
    solo = { kampf, art, gegnerId, liga, zeitlupe:training && $('#zeitlupe').checked, pausiert:false, endeBei:0, gezeigt:false };
    demo = null;
    B3[0].aussehenSetzen(aussehenAus(profil)); B3[1].aussehenSetzen(g.aussehen);
    anzeige.namen = [profil.name || 'Du', g.kurz]; anzeige.ecke = 0;
    modus = 'solo';
    karriere.kaempfe = (karriere.kaempfe || 0) + 1; karriereSpeichern();
    kampfAnsicht();
    meldung(g.kurz, `${g.typ} · ${RF.LIGEN[liga].name}`, 2400);
  }
  function kampfAnsicht() {
    zeige('hud');
    const touch = Eingabe.istTouch();
    $('#touch').hidden = !touch || anzeige.ecke == null;
    $('#tPause').hidden = modus !== 'solo';
    $('#tastenHilfe').hidden = touch || anzeige.ecke == null || (karriere.kaempfe || 0) > 4;
    $('#hudBaum').hidden = !(modus === 'online' && netz.raum && netz.raum.art === 'turnier');
    $('#hudZeitlupe').hidden = !(modus === 'solo' && solo.art === 'training');
    $('#hudZeitlupe').textContent = solo && solo.zeitlupe ? 'Zeitlupe: an' : 'Zeitlupe: aus';
    $('#tippHinweis').hidden = true; $('#aufstehen').hidden = true;
    hudCache = {};
  }
  $('#hudZeitlupe').onclick = () => { if (solo) { solo.zeitlupe = !solo.zeitlupe; $('#hudZeitlupe').textContent = solo.zeitlupe ? 'Zeitlupe: an' : 'Zeitlupe: aus'; } };

  function pauseUmschalten() {
    if (modus !== 'solo' || !solo || solo.kampf.phase === 'ende') return;
    solo.pausiert = !solo.pausiert;
    if (solo.pausiert) zeige('pause'); else zeige('hud');
  }
  $('#weiter').onclick = () => { Ton.klick(); pauseUmschalten(); };
  $('#aufgeben').onclick = () => { Ton.klick(); if (solo) { solo.pausiert = false; solo.kampf.aufgeben(0); zeige('hud'); } };

  function soloErgebnis() {
    const k = solo.kampf, e = k.ergebnis, sieg = e.sieger === 0, g = gegner(solo.gegnerId);
    const titel = $('#ergTitel');
    titel.textContent = sieg ? 'Sieg!' : e.sieger === null ? 'Unentschieden' : 'Niederlage';
    titel.className = 'ergebnisTitel ' + (sieg ? 'sieg' : e.sieger === null ? '' : 'niederlage');
    const wie = {
      ko:sieg ? `${g.kurz} wurde in Runde ${e.runde} ausgezählt – K.o.!` : `Du wurdest in Runde ${e.runde} ausgezählt.`,
      tko:sieg ? `Technischer K.o.: ${g.kurz} ging dreimal in einer Runde zu Boden.` : 'Technischer K.o.: dreimal in einer Runde am Boden.',
      punkte:sieg ? `Sieg nach Punkten – mehr Schaden ausgeteilt (${e.schaden[0]} : ${e.schaden[1]}).` : `Niederlage nach Punkten (${e.schaden[0]} : ${e.schaden[1]} Schaden).`,
      aufgabe:sieg ? `${g.kurz} hat aufgegeben.` : 'Du hast aufgegeben.',
      unentschieden:`Gleich viel Schaden ausgeteilt (${e.schaden[0]} : ${e.schaden[1]}).`
    };
    $('#ergText').textContent = solo.art === 'training' ? 'Training beendet. Weiter so!' : (wie[e.art] || '');
    const zeilen = [['', 'Du', g.kurz], ['Schaden ausgeteilt', e.schaden[0], e.schaden[1]], ['Treffer', e.treffer[0], e.treffer[1]], ['Konter', e.konter[0], e.konter[1]], ['Volltreffer', e.volltreffer[0], e.volltreffer[1]], ['Niederschläge kassiert', e.nd[0], e.nd[1]]];
    $('#ergTabelle').innerHTML = zeilen.map((z, i) => `<tr>${z.map(x => i ? `<td>${esc(x)}</td>` : `<th>${esc(x)}</th>`).join('')}</tr>`).join('');
    // Karriere-Fortschritt
    const bel = $('#ergBelohnung'); bel.hidden = true;
    const index = RF.GEGNER.findIndex(x => x.id === solo.gegnerId);
    if (solo.art === 'karriere' && sieg && index === karriere[solo.liga]) {
      karriere[solo.liga]++; karriereSpeichern();
      const texte = [];
      if (karriere[solo.liga] < 8) texte.push(`Nächster Gegner: ${RF.GEGNER[karriere[solo.liga]].name}`);
      else {
        const naechste = LIGEN[LIGEN.indexOf(solo.liga) + 1];
        texte.push(naechste ? `${RF.LIGEN[solo.liga].name}-Liga gewonnen! Die ${RF.LIGEN[naechste].name}-Liga ist offen.` : 'Du bist Champion von Ringfieber! 🏆');
        const neu = RF.FARBEN.filter(f => f.frei === solo.liga).map(f => f.name);
        if (neu.length) texte.push(`Neue Farben in „Mein Boxer“: ${neu.join(', ')}`);
        if (naechste) karriereLiga = naechste;
        karriereWahl = null;
      }
      bel.hidden = false; bel.textContent = texte.join(' · ');
      Ton.stern();
    }
    $('#ergWeiter').textContent = solo.art === 'karriere' ? 'Weiter' : 'Andere Gegner';
    $('#ergWeiter').onclick = () => { Ton.klick(); if (solo.art === 'karriere') karriereZeigen(); else gegnerZeigen(solo.art); };
    $('#ergNochmal').onclick = () => { Ton.klick(); soloStarten(solo.art, solo.gegnerId, solo.liga); };
    $('#ergMenue').onclick = () => { Ton.klick(); startZeigen(); };
    zeige('ergebnis');
  }

  /* ---------- Hintergrund-Kampf im Menü ---------- */
  function demoStarten() {
    if (demo) return;
    const ids = RF.GEGNER.map(g => g.id);
    const a = ids[Math.floor(Math.random() * ids.length)], b = ids[Math.floor(Math.random() * ids.length)];
    const wa = RF.gegnerWerte(a, 'silber'), wb = RF.gegnerWerte(b, 'silber');
    wa.hp = wb.hp = 2000;
    demo = new RF.Kampf({ boxer:[wa, wb], runden:1, dauer:900, startwert:1 + Math.floor(Math.random() * 1e9), intro:0 });
    B3[0].aussehenSetzen(aussehenAus(profil)); B3[1].aussehenSetzen(gegner(b).aussehen);
    B3[0].ichSicht(false); B3[1].ichSicht(false); durchsicht = [false, false];
  }

  /* ---------- Online ---------- */
  const netz = { ws:null, soll:false, versuch:0, id:null, token:null, raum:null, baum:null, kampf:null, z:null, zZeit:0, ende:null, ticket:null, ausstehend:null, vorher:null, baumGewaehlt:false, kampfVorbei:0, startBis:0 };
  function onlineZeigen(fehler, verbindungBehalten) {
    if (!verbindungBehalten) netzBeenden();
    modus = 'menue'; demoStarten();
    $('#onlineName').value = profil.name;
    $('#onlineFehler').textContent = fehler || '';
    zeige('online');
  }
  $('#onlineName').addEventListener('input', e => { profil.name = e.target.value.slice(0, 16); profilSpeichern(); });
  function nameNoetig() {
    if (profil.name.trim()) return false;
    $('#onlineFehler').textContent = 'Gib zuerst deinen Namen ein.'; $('#onlineName').focus(); Ton.fehler();
    return true;
  }
  $('#neuTurnier').onclick = () => { Ton.klick(); if (nameNoetig()) return; netzAktion({ t:'erstellen', art:'turnier', einst:{ dauer:Number($('#neuDauer').value), platz3:Number($('#neuPlatz3').value) } }); };
  $('#neuDuell').onclick = () => { Ton.klick(); if (nameNoetig()) return; netzAktion({ t:'erstellen', art:'duell', einst:{ dauer:Number($('#neuDauer').value) } }); };
  $('#beitreten').onclick = () => {
    Ton.klick(); if (nameNoetig()) return;
    const code = $('#codeFeld').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 4) { $('#onlineFehler').textContent = 'Der Code hat vier Zeichen.'; return; }
    netzAktion({ t:'beitreten', code });
  };
  $('#codeFeld').addEventListener('keydown', e => { if (e.key === 'Enter') $('#beitreten').click(); });

  function netzAktion(d) {
    $('#onlineFehler').textContent = 'Verbinde …';
    sitzung.weg('rf-sitzung');
    if (netz.ws && netz.ws.readyState === 1) { hallo(false); senden(d); } else { netz.ausstehend = d; netzStarten(); }
  }
  function netzStarten() { netz.soll = true; if (!netz.ws) verbinden(); }
  function netzBeenden() {
    netz.soll = false;
    if (netz.ws) { try { senden({ t:'verlassen' }); netz.ws.close(); } catch (_) { /* egal */ } }
    netz.ws = null; netz.raum = null; netz.baum = null; netz.kampf = null; netz.z = null; netz.ende = null;
    sitzung.weg('rf-sitzung');
  }
  function verbinden() {
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws${netz.ticket ? '?olymp=' + encodeURIComponent(netz.ticket) : ''}`;
    let ws;
    try { ws = new WebSocket(url); } catch (_) { return wiederVerbinden(); }
    netz.ws = ws;
    ws.onopen = () => {
      netz.versuch = 0;
      hallo(true);
      if (netz.ticket) senden({ t:'olymp', ticket:netz.ticket });
      else if (netz.ausstehend) { senden(netz.ausstehend); netz.ausstehend = null; }
      senden({ t:'sicht', v:!document.hidden });
    };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } netzNachricht(m); };
    ws.onclose = () => { if (netz.ws === ws) { netz.ws = null; wiederVerbinden(); } };
  }
  function wiederVerbinden() {
    if (!netz.soll) return;
    netz.versuch++;
    const text = 'Verbindung weg – verbinde neu …';
    if (schirm === 'lobby') $('#lobbyFehler').textContent = text; else if (schirm === 'online') $('#onlineFehler').textContent = text; else klein(text, 2000);
    setTimeout(() => { if (netz.soll && !netz.ws) verbinden(); }, Math.min(5000, 600 * netz.versuch));
  }
  function senden(d) { if (netz.ws && netz.ws.readyState === 1) netz.ws.send(JSON.stringify(d)); }
  function hallo(mitToken) {
    const s = mitToken ? sitzung.lesen('rf-sitzung') : null;
    senden({ t:'hallo', name:profil.name, preset:profil.preset, hose:profil.hose, handschuhe:profil.handschuhe, token:s && s.token, code:s && s.code });
  }

  function netzNachricht(m) {
    switch (m.t) {
      case 'du': netz.id = m.id; netz.token = m.token; break;
      case 'raum':
        if (!m.code && m.phase === 'aus') { netz.raum = null; if (!netz.ticket) onlineZeigen(); return; }
        netz.raum = m;
        if (m.code) sitzung.schreiben('rf-sitzung', { token:netz.token, code:m.code });
        if (m.olymp && m.olymp.startIn != null) netz.startBis = performance.now() + m.olymp.startIn; else netz.startBis = 0;
        if (m.phase === 'lobby') { netz.baum = null; netz.ende = null; if (!(modus === 'online' && netz.kampf && schirm === 'hud' && !netz.kampfVorbei)) lobbyZeigen(); }
        else if (schirm === 'lobby' || schirm === 'online') baumZeigen(false);
        break;
      case 'baum':
        netz.baum = m;
        if (schirm === 'baum') baumZeichnen();
        else if (schirm === 'lobby' || schirm === 'online') baumZeigen(false);
        break;
      case 'kampf': {
        netz.kampf = m; netz.z = null; netz.kampfVorbei = 0; netz.vorher = null; netz.kampfStart = performance.now();
        if (m.ecke == null && netz.baumGewaehlt && schirm === 'baum') { $('#baumZurueckKampf').hidden = false; return; }
        kampfOnlineZeigen();
        break;
      }
      case 'z':
        if (!netz.kampf || m.id !== netz.kampf.id) return;
        netz.z = m.s; netz.zZeit = performance.now();
        for (const e of m.e || []) ereignis(e);
        break;
      case 'kampfEnde':
        if (netz.kampf && m.id === netz.kampf.id) {
          netz.kampfVorbei = performance.now();
          const kid = m.id;
          setTimeout(() => {
            if (netz.kampf && netz.kampf.id === kid && netz.raum && netz.raum.art === 'turnier' && !netz.ende) { netz.kampf = null; baumZeigen(false); }
          }, 4600);
        }
        break;
      case 'zuschauen':
        if (m.id == null && modus === 'online' && (!netz.kampf || netz.kampfVorbei) && !netz.ende) { netz.kampf = null; baumZeigen(false); }
        break;
      case 'ende':
        netz.ende = m.platzierung;
        setTimeout(() => { if (netz.ende === m.platzierung) baumZeigen(false); }, netz.kampf && !netz.kampfVorbei ? 0 : 3000);
        break;
      case 'fehler': {
        Ton.fehler();
        if (m.olymp) { olympiaFehler(m.text, m.zurueck); return; }
        if (schirm === 'online') $('#onlineFehler').textContent = m.text;
        else if (schirm === 'lobby') $('#lobbyFehler').textContent = m.text;
        else klein(m.text, 2500);
        break;
      }
    }
  }

  function kampfOnlineZeigen() {
    const m = netz.kampf;
    modus = 'online'; demo = null; solo = null;
    netz.baumGewaehlt = false; $('#baumZurueckKampf').hidden = true;
    B3[0].aussehenSetzen(aussehenAus(m.boxer[0])); B3[1].aussehenSetzen(aussehenAus(m.boxer[1]));
    anzeige.ecke = m.ecke; anzeige.namen = m.boxer.map(b => b.name);
    anzeige.boxer = [leer(), leer()]; anzeige.phase = 'intro';
    kampfAnsicht();
    const wer = m.ecke == null ? `${m.boxer[0].name} gegen ${m.boxer[1].name}` : `gegen ${m.boxer[1 - m.ecke].name}`;
    meldung(m.runde || 'Kampf', wer, 2600);
  }

  function lobbyZeigen() {
    const r = netz.raum;
    if (!r) return;
    modus = 'menue'; demoStarten();
    netz.kampf = null;
    const ich = r.du, host = r.host === ich, olymp = r.olymp;
    $('#lobbyArt').textContent = olymp ? olymp.titel + ' · Ringfieber' : r.art === 'duell' ? 'Duell · Code' : 'K.-o.-Turnier · Code';
    $('#lobbyCode').textContent = r.code || 'Olympia';
    $('#lobbyCode').hidden = !r.code;
    $('#lobbyLink').hidden = !r.code;
    $('#lobbyOlymp').hidden = !olymp;
    $('#lobbyLeute').innerHTML = r.mitglieder.map(x => `<li class="${x.online ? '' : 'weg'}"><span class="farbpunkt" style="background:${esc(x.hose)}"></span>${esc(x.name)}${x.id === ich ? ' (du)' : ''}<small>${x.id === r.host && !olymp ? 'Gastgeber' : ''}${x.online ? '' : ' offline'}</small></li>`).join('');
    $('#lobbyEinst').hidden = !!olymp || !host;
    $('#lobbyDauer').value = String(r.einst.dauer); $('#lobbyPlatz3').value = r.einst.platz3 ? '1' : '0';
    $('#lobbyPlatz3').closest('label').hidden = r.art === 'duell';
    const genug = r.art === 'duell' ? r.mitglieder.length === 2 : r.mitglieder.length >= 2;
    $('#lobbyStart').hidden = !host || !!olymp;
    $('#lobbyStart').disabled = !genug;
    $('#lobbyStart').textContent = r.art === 'duell' ? (netz.ende ? 'Revanche!' : 'Duell starten') : 'Turnier starten';
    $('#lobbyRaus').textContent = olymp ? 'Zurück zur Olympiade' : 'Verlassen';
    const hostName = (r.mitglieder.find(x => x.id === r.host) || {}).name || '';
    $('#lobbyHinweis').textContent = olymp ? '' : !genug ? (r.art === 'duell' ? 'Warte auf deinen Gegner – schick ihm den Code.' : 'Warte auf mindestens einen weiteren Boxer.') : host ? 'Alle da? Dann los!' : `${hostName} startet gleich.`;
    $('#lobbyFehler').textContent = '';
    lobbyOlympText();
    if (schirm !== 'lobby' && schirm !== 'boxer') zeige('lobby');
  }
  function lobbyOlympText() {
    const r = netz.raum;
    if (!r || !r.olymp || schirm !== 'lobby') return;
    const fehlt = r.olymp.erwartet.filter(e => !e.da);
    const sek = netz.startBis ? Math.max(0, Math.ceil((netz.startBis - performance.now()) / 1000)) : null;
    $('#lobbyOlympText').innerHTML = `<b>${esc(r.olymp.titel)}</b> – Boxturnier im K.-o.-System. ` + r.olymp.erwartet.map(e => `${e.da ? '✓' : '…'} ${esc(e.n)}`).join(' · ') + '<br>' +
      (sek == null ? 'Warte auf deine Gruppe …' : fehlt.length ? `Warte auf ${fehlt.length} – spätestens in ${sek} s geht es los.` : `Alle da! Es geht los in ${sek} …`);
  }
  setInterval(lobbyOlympText, 250);
  $('#lobbyStart').onclick = () => { Ton.klick(); senden({ t:'start' }); };
  $('#lobbyDauer').onchange = $('#lobbyPlatz3').onchange = () => senden({ t:'einst', einst:{ dauer:Number($('#lobbyDauer').value), platz3:Number($('#lobbyPlatz3').value) } });
  $('#lobbyBoxer').onclick = () => { Ton.klick(); boxerZurueck = 'lobby'; boxerZeigen(); };
  $('#lobbyRaus').onclick = () => {
    Ton.klick();
    if (netz.raum && netz.raum.olymp) { const z = netz.raum.olymp.zurueck; netzBeenden(); sitzung.weg('rf-olymp'); location.href = z || '/'; return; }
    netzBeenden(); onlineZeigen();
  };
  $('#lobbyLink').onclick = async () => {
    const link = `${location.origin}/?raum=${netz.raum.code}`;
    try { await navigator.clipboard.writeText(link); $('#lobbyLink').textContent = 'Kopiert!'; } catch (_) { prompt('Einladungslink:', link); }
    setTimeout(() => { $('#lobbyLink').textContent = 'Einladungslink kopieren'; }, 1800);
  };

  function olympiaFehler(text, zurueck) {
    modus = 'menue'; demoStarten();
    $('#baumTitel').textContent = 'Olympiade';
    $('#baumHinweis').textContent = text;
    $('#baum').innerHTML = ''; $('#baumEnde').hidden = false; $('#podest').innerHTML = ''; $('#platzliste').innerHTML = '';
    const z = zurueck || (netz.raum && netz.raum.olymp && netz.raum.olymp.zurueck);
    $('#zurOlympiade').hidden = !z; if (z) $('#zurOlympiade').href = z;
    netz.soll = false;
    zeige('baum');
  }

  /* ---------- Turnierbaum ---------- */
  function baumZeigen(gewaehlt) {
    netz.baumGewaehlt = !!gewaehlt;
    if (!gewaehlt) { modus = 'menue'; demoStarten(); }
    $('#baumZurueckKampf').hidden = !(gewaehlt && netz.kampf);
    baumZeichnen();
    zeige('baum');
  }
  $('#hudBaum').onclick = () => { Ton.klick(); baumZeigen(true); };
  $('#baumZurueckKampf').onclick = () => { Ton.klick(); if (netz.kampf) kampfOnlineZeigen(); };
  $('#baumMenue').onclick = () => { Ton.klick(); netzBeenden(); startZeigen(); };

  function baumZeichnen() {
    const b = netz.baum, r = netz.raum, ich = r ? r.du : null;
    const namen = b ? b.namen : {};
    const name = id => id ? esc(namen[id] || '?') : '–';
    $('#baumTitel').textContent = r && r.art === 'duell' ? 'Duell' : r && r.olymp ? 'Olympia-Turnier' : 'Turnier';
    // Ende: Podest und Platzierung
    if (netz.ende) {
      $('#baumEnde').hidden = false;
      const p = netz.ende;
      const pl = n => p.find(x => x.platz === n);
      $('#podest').innerHTML = [2, 1, 3].map(n => { const x = pl(n); return x ? `<div class="p${n}">${n}.<br>${esc(x.name)}</div>` : ''; }).join('');
      $('#platzliste').innerHTML = p.map(x => `<li${x.id === ich ? ' style="outline:2px solid var(--gold)"' : ''}><b>${x.platz}.</b><span>${esc(x.name)}</span><span class="leise">${esc(x.text)}</span></li>`).join('');
      const meins = p.find(x => x.id === ich);
      $('#baumHinweis').textContent = meins ? (meins.platz === 1 ? 'Du hast gewonnen! 🏆' : `Du bist auf Platz ${meins.platz}.`) : '';
      const z = r && r.olymp && r.olymp.zurueck;
      $('#zurOlympiade').hidden = !z; if (z) $('#zurOlympiade').href = z;
      $('#baumMenue').hidden = !!z;
      if (r && r.art === 'duell') $('#baumHinweis').textContent += ' Gleich geht es zurück in die Lobby für die Revanche.';
    } else $('#baumEnde').hidden = true;
    if (!b) { $('#baum').innerHTML = ''; return; }
    const spalten = b.runden.map((runde, ri) => {
      const n = runde.length;
      const titel = r && r.art === 'duell' ? 'Duell' : n === 1 ? 'Finale' : n === 2 ? 'Halbfinale' : n === 4 ? 'Viertelfinale' : n === 8 ? 'Achtelfinale' : 'Runde';
      return `<div class="spalte"><h4>${titel}</h4>${runde.map(k => paarHtml(k, ich, name)).join('')}</div>`;
    });
    if (b.platz3) spalten.push(`<div class="spalte"><h4>Platz 3</h4>${paarHtml(b.platz3, ich, name)}</div>`);
    $('#baum').innerHTML = spalten.join('');
    for (const knopf of $$('#baum [data-schauen]')) knopf.onclick = () => { Ton.klick(); senden({ t:'zuschauen', id:knopf.dataset.schauen }); netz.baumGewaehlt = false; };
    if (!netz.ende) {
      const laeuftMeiner = [...b.runden.flat(), b.platz3].some(k => k && k.status === 'laeuft' && (k.a === ich || k.b === ich));
      const raus = [...b.runden.flat(), b.platz3].some(k => k && k.status === 'fertig' && k.sieger !== ich && (k.a === ich || k.b === ich)) && !(b.platz3 && (b.platz3.a === ich || b.platz3.b === ich) && b.platz3.status !== 'fertig');
      $('#baumHinweis').textContent = b.pauseIn ? `Nächste Runde in ${Math.ceil(b.pauseIn / 1000)} s.` : laeuftMeiner ? 'Dein Kampf läuft!' : raus ? 'Du bist ausgeschieden – schau den anderen zu.' : 'Die Kämpfe laufen. Tipp auf „Zuschauen“.';
      if (b.pauseIn) netz.pauseBis = performance.now() + b.pauseIn;
    }
  }
  function paarHtml(k, ich, name) {
    const zeile = id => {
      if (id == null) return `<div class="verlierer"><span>Freilos</span></div>`;
      const cls = [k.sieger === id && k.status !== 'freilos' ? 'sieger' : '', k.status === 'fertig' && k.sieger !== id ? 'verlierer' : '', id === ich ? 'ich' : ''].join(' ');
      const s = k.schaden && k.schaden[id] != null ? `<span class="art">${k.schaden[id]}</span>` : '';
      return `<div class="${cls}"><span>${name(id)}</span>${s}</div>`;
    };
    const artText = { ko:'K.o.', tko:'T.K.o.', punkte:'Punkte', verlaengerung:'Verlängerung', los:'Los', aufgabe:'Aufgabe' };
    const fuss = k.status === 'laeuft' && k.a !== ich && k.b !== ich ? `<button data-schauen="${k.id}">● Zuschauen</button>` : k.status === 'fertig' && k.art ? `<div class="art">${artText[k.art] || ''}</div>` : '';
    return `<div class="paar ${k.status}">${zeile(k.a)}${zeile(k.b)}${fuss}</div>`;
  }
  setInterval(() => { if (schirm === 'baum' && netz.baum && netz.pauseBis) { const s = Math.ceil((netz.pauseBis - performance.now()) / 1000); if (s > 0) $('#baumHinweis').textContent = `Nächste Runde in ${s} s.`; } }, 250);

  /* ---------- Eingabe ---------- */
  Eingabe.touchEinrichten($('#touch'));
  Eingabe.setzen(b => {
    if (b.a === 'pause') { if (schirm === 'hud' || schirm === 'pause') pauseUmschalten(); return; }
    if (schirm !== 'hud' || anzeige.ecke == null) return;
    const eigen = anzeige.boxer[anzeige.ecke];
    if (b.a === 'roh') { if (eigen.aktion === 'boden') befehl({ a:'tippen' }); return; }
    if (eigen.aktion === 'boden' && b.a !== 'block') return;
    befehl(b);
  });
  function befehl(b) {
    if (modus === 'solo' && solo && !solo.pausiert) solo.kampf.befehl(0, b);
    else if (modus === 'online' && netz.kampf && netz.kampf.ecke != null) {
      senden({ t:'b', b });
      if (b.a !== 'block' && b.a !== 'tippen') netz.vorher = { b, zeit:performance.now() };
    }
  }

  /* ---------- Anzeige aus Kampf oder Netz ---------- */
  function anzeigeAusKampf(k) {
    anzeige.boxer = k.b; anzeige.phase = k.phase; anzeige.runde = k.runde; anzeige.runden = k.einst.runden;
    anzeige.uhr = k.uhr; anzeige.zaehler = k.zaehler;
    anzeige.introK = k.phase === 'intro' ? k.pt / Math.max(1, k.einst.intro) : 1;
  }
  function anzeigeAusNetz(jetzt) {
    const z = netz.z;
    if (!z) { anzeige.phase = 'intro'; anzeige.introK = Math.min(1, (jetzt - (netz.kampfStart || jetzt)) / 3000); return; }
    const phase = RF.PHASEN[z.ph];
    const vor = phase === 'ende' ? 0 : Math.min(8, (jetzt - netz.zZeit) / (1000 / RF.TAKT));
    anzeige.boxer = z.b.map(x => { const b = RF.boxerAusZustand(x); b.t += vor; return b; });
    anzeige.phase = phase; anzeige.runde = z.r; anzeige.runden = z.rn; anzeige.uhr = z.u; anzeige.zaehler = z.z;
    anzeige.introK = phase === 'intro' ? Math.min(1, (jetzt - (netz.kampfStart || jetzt)) / 3000) : 1;
    // Vorhersage: die eigene Aktion sofort zeigen, bis der Server sie bestätigt
    const e = netz.kampf.ecke, v = netz.vorher;
    if (e != null && v) {
      const alt = jetzt - v.zeit, eigen = anzeige.boxer[e];
      if (alt > 220 || !['bereit', 'block'].includes(eigen.aktion) || !['kampf', 'verlaengerung'].includes(phase)) netz.vorher = alt > 220 || eigen.aktion !== 'bereit' ? null : v;
      else {
        const t = alt / (1000 / RF.TAKT);
        if (v.b.a === 'ausweichen') anzeige.boxer[e] = Object.assign({}, eigen, { aktion:'ausweichen', seite:v.b.seite, t });
        else if (v.b.a === 'ducken') anzeige.boxer[e] = Object.assign({}, eigen, { aktion:'ducken', t });
        else if ((v.b.a === 'schlag' && RF.ANGRIFFE[v.b.art]) || (v.b.a === 'stern' && eigen.sterne > 0)) {
          const art = v.b.a === 'stern' ? 'volltreffer' : v.b.art, A = RF.ANGRIFFE[art];
          anzeige.boxer[e] = Object.assign({}, eigen, { aktion:'schlag', seite:v.b.seite || 'R', t, a:{ art, aus:A.aus, tr:A.tr, erh:A.erh } });
        }
      }
    }
  }

  /* ---------- Ereignisse → Effekte, Ton, Meldungen ---------- */
  const tmpV = new THREE.Vector3();
  function name(i) { return anzeige.namen[i] || ''; }
  function ereignis(e) {
    const ich = anzeige.ecke, solo_ = modus === 'solo', echt = modus !== 'menue';
    switch (e.typ) {
      case 'treffer': {
        const ziel = 1 - e.wer, hand = e.seite === 'L' ? 0 : 1;
        B3[e.wer].handschuhWelt(hand, tmpV);
        const staerke = klemm(e.schaden / 16, 0.2, 1.5);
        Arena.treffer(tmpV, staerke, e.sterne ? '#ffd23f' : e.konter ? '#ffe08a' : e.panzer ? '#aab4c4' : '#ffffff');
        if (!echt) return;
        Ton.schlag(staerke, e.kopf);
        zahl(ziel, `−${e.schaden}`, ziel === ich ? 'wehe' : e.konter || e.sterne ? 'konter' : '');
        if (e.sterne) { meldung('Volltreffer!', '', 900); blitz(); Ton.aufschrei(0.7); if (solo_) zeitlupeBis = performance.now() + 380; }
        else if (e.konter) { klein(e.wer === ich ? 'Konter! ★' : `Konter von ${name(e.wer)}`, 900); if (e.wer === ich) Ton.stern(); if (solo_) zeitlupeBis = performance.now() + 160; }
        else if (e.unterbrochen) { klein(e.wer === ich ? 'Unterbrochen! ★' : 'Unterbrochen!', 900); if (e.wer === ich) Ton.stern(); }
        else if (e.panzer && e.wer === ich) klein('Er holt aus – leichte Schläge halten ihn nicht auf!', 1100);
        else if (staerke > 0.6 && solo_) zeitlupeBis = performance.now() + 70;
        break;
      }
      case 'geblockt':
        B3[e.wer].kopfWelt(tmpV); tmpV.y -= 0.1;
        Arena.treffer(tmpV, 0.15, '#9fb3d1');
        if (echt) { Ton.block(); if (e.schaden) zahl(e.wer, `−${e.schaden}`, e.wer === ich ? 'wehe' : ''); }
        break;
      case 'ausgewichen':
        if (!echt) return;
        Ton.wusch();
        if (e.wer === ich) klein('Ausgewichen – jetzt kontern!', 700);
        break;
      case 'ausholen':
        if (echt && solo_ && solo.art === 'training' && e.wer !== ich) tipp(RF.abwehrTipp(e.art, e.seite));
        break;
      case 'niederschlag':
        Arena.jubel(1.6);
        if (!echt) return;
        Ton.aufschrei(1.2);
        meldung('Niederschlag!', e.wer === ich ? 'Gleich tippen, um aufzustehen!' : `${name(e.wer)} liegt am Boden`, 1500);
        break;
      case 'zaehlen': if (echt) { meldung(String(e.n), '', 800); Ton.zaehlen(e.n); } break;
      case 'aufgestanden': if (echt) { Ton.aufschrei(0.5); klein(`${name(e.wer)} steht wieder!`, 1200); } break;
      case 'gong':
        if (!echt) return;
        Ton.gong(e.ende ? 3 : 1);
        if (!e.ende) meldung(anzeige.runden > 1 ? `Runde ${e.runde}` : 'Box!', anzeige.runden > 1 ? 'Box!' : '', 1300);
        break;
      case 'rundenpause': if (echt) meldung('Rundenpause', 'Kurz durchatmen', 2500); break;
      case 'verlaengerung': if (echt) { Ton.gong(1); meldung('Verlängerung!', 'Der erste saubere Treffer gewinnt', 2600); } break;
      case 'ende': {
        if (!echt) { demo = null; demoStarten(); return; }
        Arena.jubel(2); Ton.gong(3); Ton.aufschrei(1);
        const art = { ko:'K.o.!', tko:'T.K.o.!', punkte:'Punktsieg', verlaengerung:'Entschieden!', los:'Losentscheid', aufgabe:'Aufgabe', unentschieden:'Unentschieden' }[e.art] || 'Ende';
        const sub = e.sieger == null ? 'Kein Sieger' : e.sieger === ich ? 'Du gewinnst!' : `${name(e.sieger)} gewinnt`;
        meldung(art, sub, 3200);
        break;
      }
      case 'finte': if (echt && e.wer !== ich) klein('Finte!', 700); break;
      case 'wechsel': if (echt && e.wer !== ich) klein('Handwechsel!', 700); break;
      case 'wut': if (echt) meldung(`${name(e.wer)} wird wütend!`, 'Deckung hoch!', 1400); break;
      case 'platt': if (echt && e.wer === ich) klein('Keine Puste – kurz nicht schlagen', 1000); break;
      case 'keinStern': if (echt && e.wer === ich) klein('Noch kein Stern – erst kontern!', 1000); break;
      case 'gebrochen': if (echt) klein(e.wer === ich ? 'Deckung gebrochen!' : `${name(e.wer)}: Deckung gebrochen!`, 1000); break;
    }
  }

  let meldungUhr = 0, kleinUhr = 0, tippUhr = 0;
  function meldung(text, unter, ms = 1200) {
    const el = $('#meldung');
    el.innerHTML = esc(text) + (unter ? `<small>${esc(unter)}</small>` : '');
    el.classList.remove('an'); void el.offsetWidth; el.classList.add('an');
    clearTimeout(meldungUhr); meldungUhr = setTimeout(() => el.classList.remove('an'), ms);
  }
  function klein(text, ms = 900) {
    const el = $('#klein'); el.textContent = text; el.classList.add('an');
    clearTimeout(kleinUhr); kleinUhr = setTimeout(() => el.classList.remove('an'), ms);
  }
  function tipp(text) {
    const el = $('#tippHinweis'); el.textContent = text; el.hidden = false;
    clearTimeout(tippUhr); tippUhr = setTimeout(() => { el.hidden = true; }, 1300);
  }
  function blitz() { const el = $('#blitz'); el.style.transition = 'none'; el.style.opacity = '0.65'; requestAnimationFrame(() => { el.style.transition = 'opacity .35s'; el.style.opacity = '0'; }); }
  function zahl(i, text, art) {
    B3[i].kopfWelt(tmpV); tmpV.y += 0.25;
    const p = Arena.aufSchirm(tmpV);
    if (!p.sichtbar) return;
    const el = document.createElement('div');
    el.className = 'zahl ' + (art || ''); el.textContent = text;
    el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
    $('#zahlen').appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

  /* ---------- HUD ---------- */
  let hudCache = {};
  const zeitText = takte => { const s = Math.max(0, Math.ceil(takte / RF.TAKT)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function setze(key, el, prop, wert) { if (hudCache[key] !== wert) { hudCache[key] = wert; if (prop === 'text') el.textContent = wert; else if (prop === 'html') el.innerHTML = wert; else el.style[prop] = wert; } }
  function hudAktualisieren() {
    if (schirm !== 'hud' && schirm !== 'pause') return;
    const links = anzeige.ecke == null ? 0 : anzeige.ecke;
    [[$('#k0'), links], [$('#k1'), 1 - links]].forEach(([el, i], seite) => {
      const b = anzeige.boxer[i];
      const anteil = klemm(b.hp / (b.hpMax || 100), 0, 1);
      setze('n' + seite, el.querySelector('.n'), 'text', (anzeige.ecke === i ? '★ ' : '') + name(i));
      setze('hp' + seite, el.querySelector('.hp'), 'transform', `scaleX(${anteil.toFixed(3)})`);
      setze('spur' + seite, el.querySelector('.spur'), 'transform', `scaleX(${anteil.toFixed(3)})`);
      const bk = el.querySelector('.balken'), stufe = anteil < 0.25 ? 'kritisch' : anteil < 0.5 ? 'niedrig' : '';
      if (hudCache['st' + seite] !== stufe) { hudCache['st' + seite] = stufe; bk.classList.toggle('niedrig', stufe === 'niedrig'); bk.classList.toggle('kritisch', stufe === 'kritisch'); }
      setze('pu' + seite, el.querySelector('.puste i'), 'transform', `scaleX(${klemm(b.puste / 100, 0, 1).toFixed(2)})`);
      setze('ster' + seite, el.querySelector('.sterne'), 'html', `<b>${'★'.repeat(b.sterne)}</b>${'☆'.repeat(3 - b.sterne)}`);
      setze('nd' + seite, el.querySelector('.nd'), 'text', b.nd ? '●'.repeat(b.nd) : '');
    });
    setze('runde', $('#runde'), 'text', anzeige.phase === 'verlaengerung' ? 'Verlängerung' : anzeige.runden > 1 ? `Runde ${anzeige.runde}/${anzeige.runden}` : (netz.kampf && netz.kampf.runde) || 'Runde');
    setze('zeit', $('#zeit'), 'text', zeitText(anzeige.uhr));
    // Aufstehen
    const eigen = anzeige.ecke != null ? anzeige.boxer[anzeige.ecke] : null;
    const unten = !!eigen && eigen.aktion === 'boden' && anzeige.phase === 'zaehlen';
    if (hudCache.unten !== unten) { hudCache.unten = unten; $('#aufstehen').hidden = !unten; }
    if (unten) setze('auf', $('#aufstehen .fort i'), 'transform', `scaleX(${klemm(eigen.tippen / Math.max(1, eigen.tippenNoetig), 0, 1).toFixed(2)})`);
    if (eigen) { const d = eigen.sterne < 1; if (hudCache.stern !== d) { hudCache.stern = d; $('#tStern').disabled = d; } }
  }

  /* ---------- Kamera und Durchsicht ---------- */
  let durchsicht = [false, false];
  function kameraWaehlen() {
    if (modus === 'menue') {
      // In "Mein Boxer" steht die Figur rechts neben dem Menü (auf breiten Bildschirmen)
      if (schirm === 'boxer') Arena.kameraSetzen('boxer', { x:innerWidth / innerHeight > 1.15 ? -0.85 : 0 });
      else Arena.kameraSetzen('menue');
      return;
    }
    const ph = anzeige.phase;
    if (ph === 'intro') Arena.kameraSetzen('intro', { k:anzeige.introK });
    else if (ph === 'zaehlen') {
      const d = anzeige.boxer.findIndex(b => b.aktion === 'boden' || b.aktion === 'aufstehen');
      Arena.kameraSetzen('boden', { z:d === 1 ? 0.5 : -0.5 });
    } else if (anzeige.ecke == null || ph === 'ende' || ph === 'rundenpause') Arena.kameraSetzen('tv');
    else {
      // Ich-Sicht: Kamera im Kopf des eigenen Boxers (etwas dahinter, damit die Handschuhe ins Bild passen)
      const f = anzeige.ecke === 0 ? 1 : -1;
      B3[anzeige.ecke].kopfWelt(kamPos);
      kamPos.z -= f * 0.58; kamPos.y += 0.12;
      // Blickhöhe nach dem Gegner (große Gegner nicht oben abschneiden)
      const gg = B3[1 - anzeige.ecke];
      const zielY = gg.mass.hueftHoehe + gg.mass.halsY + 0.18 + 0.08;
      Arena.kameraSetzen('ich', { pos:kamPos, f, zielY });
    }
  }
  const kamPos = new THREE.Vector3();
  function durchsichtSetzen() {
    const ph = anzeige.phase;
    for (let i = 0; i < 2; i++) {
      const soll = modus !== 'menue' && anzeige.ecke === i && ['kampf', 'verlaengerung'].includes(ph);
      if (durchsicht[i] !== soll) { durchsicht[i] = soll; B3[i].ichSicht(soll); }
    }
  }

  /* ---------- Hauptschleife ---------- */
  let letzte = performance.now(), akku = 0;
  function schleife(jetzt) {
    requestAnimationFrame(schleife);
    const dt = Math.min(0.1, Math.max(0, (jetzt - letzte) / 1000)); letzte = jetzt;
    Eingabe.abfragen();
    let faktor = 1;
    if (modus === 'solo' && solo) {
      if (solo.zeitlupe) faktor *= 0.45;
      if (jetzt < zeitlupeBis) faktor *= 0.3;
      if (solo.pausiert) faktor = 0;
      akku += dt * faktor;
      let n = 0;
      while (akku >= TAKT_S && n < 10) {
        solo.kampf.schritt(); akku -= TAKT_S; n++;
        for (const e of solo.kampf.ereignisse.splice(0)) ereignis(e);
      }
      anzeigeAusKampf(solo.kampf);
      if (solo.kampf.phase === 'ende' && !solo.endeBei) solo.endeBei = jetzt + 3000;
      if (solo.endeBei && jetzt > solo.endeBei && !solo.gezeigt) { solo.gezeigt = true; soloErgebnis(); }
    } else if (modus === 'online' && netz.kampf) {
      anzeigeAusNetz(jetzt);
    } else {
      if (schirm === 'boxer') { anzeige.boxer = [leer(), leer()]; anzeige.phase = 'kampf'; }
      else if (demo) {
        akku += dt; let n = 0;
        while (akku >= TAKT_S && n < 6) { demo.schritt(); akku -= TAKT_S; n++; for (const e of demo.ereignisse.splice(0)) ereignis(e); }
        if (demo) anzeigeAusKampf(demo);
      }
    }
    if (akku > 1) akku = 0;
    for (let i = 0; i < 2; i++) B3[i].pose(anzeige.boxer[i], dt * (modus === 'solo' ? faktor : 1), anzeige.phase);
    // Im Boxer-Menü steht der eigene Boxer allein im Ring
    B3[1].wurzel.visible = schirm !== 'boxer';
    kameraWaehlen();
    durchsichtSetzen();
    hudAktualisieren();
    Ton.publikum(modus === 'menue' ? 0.25 : 0.7);
    Arena.bild(dt);
  }

  /* ---------- Sonstiges ---------- */
  const tonStart = () => Ton.start();
  addEventListener('pointerdown', tonStart, { passive:true });
  addEventListener('keydown', tonStart);
  document.addEventListener('visibilitychange', () => {
    if (netz.ws) senden({ t:'sicht', v:!document.hidden });
    if (document.hidden && modus === 'solo' && solo && !solo.pausiert && solo.kampf.phase !== 'ende') pauseUmschalten();
  });

  // Debug und Tests: ringfieber.sim(sek) rechnet den Solo-Kampf weiter
  window.ringfieber = {
    get solo() { return solo; }, get netz() { return netz; }, anzeige, B3, profil, karriere,
    sim(sek) { if (!solo) return; for (let i = 0; i < sek * RF.TAKT; i++) { solo.kampf.schritt(); for (const e of solo.kampf.ereignisse.splice(0)) ereignis(e); } },
    starten:soloStarten
  };

  /* ---------- Start: Olympia-Ticket, Einladungslink oder Menü ---------- */
  const params = new URLSearchParams(location.search);
  let ticket = params.get('olymp');
  if (ticket) sitzung.schreiben('rf-olymp', ticket); else ticket = sitzung.lesen('rf-olymp');
  if (ticket) {
    netz.ticket = ticket;
    demoStarten();
    $('#baumTitel').textContent = 'Olympiade'; $('#baumHinweis').textContent = 'Verbinde mit deiner Olympia-Gruppe …'; $('#baum').innerHTML = ''; $('#baumEnde').hidden = true;
    zeige('baum');
    netzStarten();
  } else if (params.get('raum')) {
    onlineZeigen();
    $('#codeFeld').value = params.get('raum').toUpperCase().slice(0, 4);
    history.replaceState(null, '', location.pathname);
    if (profil.name.trim()) $('#beitreten').click(); else { $('#onlineFehler').textContent = 'Gib deinen Namen ein und tipp auf „Beitreten“.'; $('#onlineName').focus(); }
  } else {
    const s = sitzung.lesen('rf-sitzung');
    if (s && s.code && s.token) { onlineZeigen('Verbinde wieder mit deinem Raum …', true); netzStarten(); }
    else startZeigen();
  }
  requestAnimationFrame(schleife);
})();
