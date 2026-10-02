'use strict';
/* Ringfieber – Räume, Duelle und K.-o.-Turniere. Der Server rechnet jeden Kampf selbst (js/logik.js),
   die Browser schicken nur Eingaben. Ohne WebSocket testbar: verbinden(transport) liefert die
   Funktionen für eingehende Nachrichten und das Trennen, takt() rechnet alle Kämpfe einen Schritt weiter.

   Raum:  { code, art:'duell'|'turnier', host, phase:'lobby'|'turnier'|'ende', einst, mitglieder:Map, baum, olymp }
   Baum:  { runden:[[Kampf-Eintrag]], platz3, rundeNr, pauseBis }
   Kampf-Eintrag: { id, a, b, sieger, verlierer, status:'wartet'|'laeuft'|'fertig'|'freilos', kampf, art, schaden } */
const crypto = require('crypto');
const RF = require('./js/logik.js');

const MAX_TURNIER = 16, MAX_RAEUME = 80;
const PAUSE_MS = 12_000;             // zwischen den Turnierrunden
const NACH_KAMPF_MS = 4_000;         // Ergebnis zeigen, bevor es weitergeht
const WEG_MS = 30_000;               // so lange darf man im Kampf fehlen, dann zählt es als Aufgabe
const OLYMP_COUNTDOWN = 6_000, OLYMP_WARTEN = 90_000;
const SENDE_JEDE = 2;                // Zustand an die Browser: jeder 2. Takt = 30 pro Sekunde
const CODE_ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DAUERN = [60, 90, 120];

const nameOk = n => String(n || '').replace(/[\u0000-\u001f\u007f<>&"]/g, '').trim().slice(0, 16);
const farbeOk = f => /^#[0-9a-f]{6}$/i.test(String(f)) ? String(f) : null;
const presetOk = p => RF.PRESETS.some(x => x.id === p) ? p : RF.PRESETS[0].id;

function raeume({ zufall = Math.random, olymp = null, jetzt = () => Date.now(), zeiten = {} } = {}) {
  const Z = { pause:PAUSE_MS, nachKampf:NACH_KAMPF_MS, weg:WEG_MS, countdown:OLYMP_COUNTDOWN, warten:OLYMP_WARTEN, duell:6000, ...zeiten };
  const liste = new Map(), olympRaeume = new Map();
  let naechsteId = 1, takte = 0;
  const zufallInt = n => Math.floor(zufall() * n);
  const code = () => { let c; do { c = Array.from({ length:4 }, () => CODE_ZEICHEN[zufallInt(CODE_ZEICHEN.length)]).join(''); } while (liste.has(c)); return c; };
  const senden = (m, daten) => { if (!m.transport) return; try { m.transport.send(typeof daten === 'string' ? daten : JSON.stringify(daten)); } catch (_) { /* zu */ } };
  const mitglieder = raum => [...raum.mitglieder.values()];
  const anAlle = (raum, daten) => { const text = JSON.stringify(daten); for (const m of raum.mitglieder.values()) senden(m, text); };
  const einstPruefen = (e, alt) => ({
    dauer:DAUERN.includes(Number(e && e.dauer)) ? Number(e.dauer) : (alt ? alt.dauer : 90),
    platz3:e && e.platz3 != null ? !!Number(e.platz3) : (alt ? alt.platz3 : true)
  });

  /* ---------- Was die Browser sehen ---------- */
  function raumFuer(raum, m) {
    const o = raum.olymp;
    const da = new Set(mitglieder(raum).map(x => x.olympId).filter(Boolean));
    return {
      t:'raum', code:raum.olymp ? null : raum.code, art:raum.art, host:raum.host, phase:raum.phase, einst:raum.einst, du:m.id,
      mitglieder:mitglieder(raum).map(x => ({ id:x.id, name:x.name, preset:x.preset, hose:x.hose, handschuhe:x.handschuhe, online:!!x.transport, versteckt:!!x.versteckt })),
      olymp:o ? { titel:o.t.ti || 'Olympiade', erwartet:o.t.m.map(e => ({ n:e.n, da:da.has(e.s) })), startIn:o.startBis ? Math.max(0, o.startBis - jetzt()) : null, zurueck:o.t.z || null } : null
    };
  }
  function raumSenden(raum) { for (const m of raum.mitglieder.values()) senden(m, raumFuer(raum, m)); olympStatus(raum); }

  function baumFuer(raum) {
    const b = raum.baum; if (!b) return null;
    const eintrag = k => k && ({ id:k.id, a:k.a, b:k.b, sieger:k.sieger, status:k.status, art:k.art || null, schaden:k.schaden || null });
    return { t:'baum', runden:b.runden.map(r => r.map(eintrag)), platz3:eintrag(b.platz3), rundeNr:b.rundeNr,
      pauseIn:b.pauseBis ? Math.max(0, b.pauseBis - jetzt()) : null, namen:Object.fromEntries(mitglieder(raum).map(x => [x.id, x.name])) };
  }
  function baumSenden(raum) { const b = baumFuer(raum); if (b) anAlle(raum, b); }

  /* ---------- Raum betreten und verlassen ---------- */
  function raumErstellen(art, einst, olympInfo) {
    if (liste.size >= MAX_RAEUME) return null;
    const raum = { code:code(), art, host:null, phase:'lobby', einst:einstPruefen(einst), mitglieder:new Map(), baum:null, olymp:olympInfo || null, zuletzt:jetzt() };
    liste.set(raum.code, raum);
    return raum;
  }
  function beitreten(m, raum) {
    if (m.raum && m.raum !== raum) verlassen(m, true);
    m.raum = raum; m.schaut = null; m.schautWahl = false;
    raum.mitglieder.set(m.id, m);
    if (!raum.host || !raum.mitglieder.has(raum.host)) raum.host = m.id;
    raumSenden(raum);
    baumSendenAn(raum, m);
    olympPruefen(raum);
  }
  function baumSendenAn(raum, m) {
    const b = baumFuer(raum); if (b) senden(m, b);
    // Läuft gerade ein Kampf mit mir oder zum Zuschauen? Dann gleich hinein
    if (raum.phase === 'turnier') zuschauerSetzen(raum);
  }
  // endgueltig: auch während des Turniers austragen (sonst bleibt man als Abwesender drin)
  function verlassen(m, endgueltig) {
    const raum = m.raum; if (!raum) return;
    if (raum.phase === 'lobby' || endgueltig) {
      // Im laufenden Kampf: Aufgabe
      const k = laufenderKampf(raum, m.id);
      if (k) k.kampf.aufgeben(k.a === m.id ? 0 : 1);
      if (raum.phase === 'lobby' || !imBaum(raum, m.id)) raum.mitglieder.delete(m.id);
      else { m.transport = null; m.weg = 1; }       // ausgestiegen: künftige Kämpfe gelten sofort als aufgegeben
      m.raum = null;
    } else { m.transport = null; m.weg = jetzt(); }
    if (raum.host === m.id) {
      const neu = mitglieder(raum).find(x => x.transport);
      raum.host = neu ? neu.id : (mitglieder(raum)[0] || {}).id || null;
    }
    if (!mitglieder(raum).some(x => x.transport) && (raum.phase !== 'turnier' || !mitglieder(raum).length)) {
      if (!raum.olymp || raum.phase !== 'lobby') { aufraeumen(raum); return; }
    }
    raumSenden(raum);
    olympPruefen(raum);
  }
  function aufraeumen(raum) {
    liste.delete(raum.code);
    if (raum.olymp) { clearTimeout(raum.olymp.uhr); if (olympRaeume.get(raum.olymp.schluessel) === raum.code && raum.phase === 'lobby') olympRaeume.delete(raum.olymp.schluessel); }
  }
  const imBaum = (raum, id) => !!raum.baum && raum.baum.teilnehmer.includes(id);

  /* ---------- Turnier ---------- */
  function mischen(a) { for (let i = a.length - 1; i > 0; i--) { const j = zufallInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const kampfId = () => crypto.randomBytes(4).toString('hex');

  function turnierStarten(raum) {
    const ids = mischen(mitglieder(raum).filter(m => m.transport || raum.olymp).map(m => m.id)).slice(0, MAX_TURNIER);
    if (ids.length < 2) return 'Für ein Turnier braucht es mindestens zwei Boxer.';
    // Baum auf die nächste Zweierpotenz auffüllen; Freilose verteilt, damit sie sich nicht treffen
    let groesse = 2; while (groesse < ids.length) groesse *= 2;
    const anzahl = groesse / 2, freilose = groesse - ids.length;
    const reihenfolge = [];
    for (let i = 0; i < anzahl; i += 2) reihenfolge.push(i);
    for (let i = 1; i < anzahl; i += 2) reihenfolge.push(i);
    const mitFreilos = new Set(reihenfolge.slice(0, freilose));
    const runde = [];
    let n = 0;
    for (let i = 0; i < anzahl; i++) {
      if (mitFreilos.has(i)) { const a = ids[n++]; runde.push({ id:kampfId(), a, b:null, sieger:a, verlierer:null, status:'freilos' }); }
      else { const a = ids[n++], b = ids[n++]; runde.push({ id:kampfId(), a, b, sieger:null, verlierer:null, status:'wartet' }); }
    }
    raum.baum = { runden:[runde], platz3:null, rundeNr:0, pauseBis:0, teilnehmer:ids, ausgeschieden:{} };
    raum.phase = 'turnier';
    if (raum.olymp) { raum.olymp.gestartet = true; clearTimeout(raum.olymp.uhr); raum.olymp.uhr = null; raum.olymp.startBis = 0; }
    raumSenden(raum);
    rundeStarten(raum);
    return null;
  }

  function rundeStarten(raum) {
    const b = raum.baum;
    b.pauseBis = 0;
    for (const k of aktuelleKaempfe(raum)) if (k.status === 'wartet') kampfStarten(raum, k);
    baumSenden(raum);
    zuschauerSetzen(raum);
    pruefeRundeFertig(raum);
  }
  const aktuelleKaempfe = raum => { const b = raum.baum; return [...b.runden[b.rundeNr], ...(b.platz3 && b.rundeNr === b.runden.length - 1 ? [b.platz3] : [])]; };
  const laufenderKampf = (raum, id) => raum.baum && aktuelleKaempfe(raum).find(k => k.status === 'laeuft' && (k.a === id || k.b === id));

  function kampfStarten(raum, k) {
    const startwert = 1 + zufallInt(2 ** 30);
    k.kampf = new RF.Kampf({ runden:1, dauer:raum.einst.dauer, gnade:5, verlaengerung:true, startwert, intro:RF.s(3) });
    k.status = 'laeuft'; k.startwert = startwert; k.zuschauer = new Set(); k.blockGesetzt = [false, false];
    const boxer = [k.a, k.b].map(id => { const m = raum.mitglieder.get(id) || {}; return { id, name:m.name || '?', preset:m.preset, hose:m.hose, handschuhe:m.handschuhe }; });
    k.kopf = { t:'kampf', id:k.id, boxer, einst:{ dauer:raum.einst.dauer }, platz3:raum.baum.platz3 === k, runde:rundenName(raum, k) };
    for (const id of [k.a, k.b]) { const m = raum.mitglieder.get(id); if (m) { m.schaut = k.id; senden(m, { ...k.kopf, ecke:id === k.a ? 0 : 1 }); } }
  }

  function rundenName(raum, k) {
    if (raum.baum.platz3 === k) return 'Kampf um Platz 3';
    if (raum.art === 'duell') return 'Duell';
    const n = raum.baum.runden[raum.baum.rundeNr].length;
    return n === 1 ? 'Finale' : n === 2 ? 'Halbfinale' : n === 4 ? 'Viertelfinale' : n === 8 ? 'Achtelfinale' : 'Runde';
  }

  // Wer nicht selbst boxt, schaut einen Kampf: den gewählten oder den "Hauptkampf"
  function zuschauerSetzen(raum) {
    if (raum.phase !== 'turnier' || !raum.baum) return;
    const laufend = aktuelleKaempfe(raum).filter(k => k.status === 'laeuft');
    const haupt = laufend.find(k => !k.kopf.platz3) || laufend[0];
    for (const m of raum.mitglieder.values()) {
      if (laufend.some(k => k.a === m.id || k.b === m.id)) continue;
      let ziel = m.schautWahl ? laufend.find(k => k.id === m.schaut) : null;
      if (!ziel) { ziel = haupt; m.schautWahl = false; }
      for (const k of laufend) k.zuschauer.delete(m.id);
      if (!ziel) { if (m.schaut) { m.schaut = null; senden(m, { t:'zuschauen', id:null }); } continue; }
      ziel.zuschauer.add(m.id);
      if (m.schaut !== ziel.id || m.kopfGesendet !== ziel.id) { m.schaut = ziel.id; m.kopfGesendet = ziel.id; senden(m, { ...ziel.kopf, ecke:null }); }
    }
  }

  function kampfEnde(raum, k) {
    const e = k.kampf.ergebnis;
    k.status = 'fertig'; k.art = e.art;
    k.sieger = e.sieger === 0 ? k.a : k.b; k.verlierer = k.sieger === k.a ? k.b : k.a;
    k.schaden = { [k.a]:e.schaden[0], [k.b]:e.schaden[1] };
    const b = raum.baum;
    b.ausgeschieden[k.verlierer] = { runde:b.rundeNr, schaden:(b.ausgeschieden[k.verlierer] || {}).schaden || 0 };
    for (const id of [k.a, k.b]) b.schaden = Object.assign(b.schaden || {}, { [id]:((b.schaden || {})[id] || 0) + k.schaden[id] });
    const nachricht = { t:'kampfEnde', id:k.id, ergebnis:e, sieger:k.sieger };
    for (const m of raum.mitglieder.values()) if (m.schaut === k.id || k.a === m.id || k.b === m.id) senden(m, nachricht);
    setTimeout(() => { if (liste.get(raum.code) === raum && raum.phase === 'turnier') { zuschauerSetzen(raum); baumSenden(raum); } }, Z.nachKampf);
    baumSenden(raum);
    pruefeRundeFertig(raum);
  }

  function pruefeRundeFertig(raum) {
    if (raum.phase !== 'turnier') return;
    const b = raum.baum;
    if (aktuelleKaempfe(raum).some(k => k.status === 'wartet' || k.status === 'laeuft')) return;
    const runde = b.runden[b.rundeNr];
    if (runde.length === 1) return turnierEnde(raum);
    // Nächste Runde aus den Siegern; nach dem Halbfinale auch der Kampf um Platz 3
    const naechste = [];
    for (let i = 0; i < runde.length; i += 2) naechste.push({ id:kampfId(), a:runde[i].sieger, b:runde[i + 1].sieger, sieger:null, verlierer:null, status:'wartet' });
    if (runde.length === 2 && raum.einst.platz3 && runde.every(k => k.status === 'fertig'))
      b.platz3 = { id:kampfId(), a:runde[0].verlierer, b:runde[1].verlierer, sieger:null, verlierer:null, status:'wartet' };
    b.runden.push(naechste);
    b.rundeNr++;
    b.pauseBis = jetzt() + Z.pause;
    baumSenden(raum);
    setTimeout(() => { if (liste.get(raum.code) === raum && raum.phase === 'turnier') rundeStarten(raum); }, Z.pause);
  }

  function platzierung(raum) {
    const b = raum.baum, fin = b.runden[b.runden.length - 1][0], schaden = b.schaden || {};
    const name = id => (raum.mitglieder.get(id) || {}).name || '?';
    const liste = [];
    const rein = (id, platz, text, wert) => { if (id && !liste.some(x => x.id === id)) liste.push({ id, name:name(id), platz, text, wert }); };
    rein(fin.sieger, 1, raum.art === 'duell' ? 'Sieg' : 'Turniersieg', 1e6);
    rein(fin.verlierer, 2, raum.art === 'duell' ? 'Niederlage' : 'Finale', 9e5);
    if (b.platz3 && b.platz3.status === 'fertig') { rein(b.platz3.sieger, 3, 'Platz 3', 8e5); rein(b.platz3.verlierer, 4, 'Halbfinale', 7e5); }
    const rundenNamen = n => n === 2 ? 'Halbfinale' : n === 4 ? 'Viertelfinale' : n === 8 ? 'Achtelfinale' : '1. Runde';
    // Alle anderen: wer weiter kam zuerst, dann nach ausgeteiltem Schaden
    const rest = b.teilnehmer.filter(id => !liste.some(x => x.id === id)).map(id => {
      const r = (b.ausgeschieden[id] || { runde:0 }).runde;
      return { id, r, s:schaden[id] || 0, text:rundenNamen(b.runden[r].length) };
    }).sort((x, y) => y.r - x.r || y.s - x.s);
    for (const x of rest) {
      const wert = !b.platz3 && x.r === b.runden.length - 2 ? 8e5 : (x.r + 1) * 1e4 + x.s;
      const vorher = liste[liste.length - 1];
      const platz = vorher && vorher.wert === wert ? vorher.platz : liste.length + 1;
      rein(x.id, platz, x.text, wert);
    }
    return liste;
  }

  function turnierEnde(raum) {
    raum.phase = 'ende';
    const plaetze = platzierung(raum);
    raum.ergebnis = plaetze;
    anAlle(raum, { t:'ende', platzierung:plaetze });
    raumSenden(raum);
    if (raum.olymp && !raum.olymp.gemeldet) {
      raum.olymp.gemeldet = true;
      const schaden = raum.baum.schaden || {};
      olymp && olymp.rangMelden(raum.olymp.t, plaetze.map(p => {
        const m = raum.mitglieder.get(p.id);
        return { s:m && m.olympId, wert:p.wert, text:`${p.text} · ${schaden[p.id] || 0} Schaden` };
      }).filter(x => x.s));
    }
    if (raum.art === 'duell') {
      // Duell: zurück in die Lobby für die Revanche
      setTimeout(() => { if (liste.get(raum.code) === raum && raum.phase === 'ende') { raum.phase = 'lobby'; raum.baum = null; for (const m of [...raum.mitglieder.values()]) if (!m.transport) raum.mitglieder.delete(m.id); raumSenden(raum); } }, Z.duell);
    }
  }

  /* ---------- Olympiade ---------- */
  function olympStatus(raum) {
    const o = raum.olymp; if (!o || !olymp || o.gemeldet) return;
    const da = mitglieder(raum).filter(m => m.transport).map(m => m.olympId).filter(Boolean);
    const schluessel = da.join(',') + raum.phase;
    if (schluessel === o.letzterStatus && jetzt() - (o.statusZeit || 0) < 20_000) return;
    o.letzterStatus = schluessel; o.statusZeit = jetzt();
    olymp.status(o.t, da, raum.phase === 'lobby' ? 'warten' : 'laeuft');
  }
  // Alle da: kurzer Countdown. Fehlt jemand: spätestens 90 s nach dem Öffnen des Raums.
  function olympPruefen(raum) {
    const o = raum.olymp; if (!o || o.gestartet || raum.phase !== 'lobby') return;
    const da = mitglieder(raum).filter(m => m.transport).map(m => m.olympId);
    let ziel = 0;
    if (da.length) {
      ziel = o.spaetestens;
      if (o.t.m.every(e => da.includes(e.s))) ziel = Math.min(ziel, o.uhr && o.startBis < o.spaetestens ? o.startBis : jetzt() + Z.countdown);
    }
    if (ziel === o.startBis && (o.uhr || !ziel)) return;
    clearTimeout(o.uhr); o.uhr = null; o.startBis = 0;
    if (ziel) {
      o.startBis = ziel;
      o.uhr = setTimeout(() => {
        o.uhr = null;
        if (liste.get(raum.code) !== raum || raum.phase !== 'lobby') return;
        if (mitglieder(raum).filter(m => m.transport).length < 2) { o.startBis = 0; raumSenden(raum); return olympAllein(raum); }
        turnierStarten(raum);
      }, Math.max(0, ziel - jetzt()));
      o.uhr.unref?.();
    }
    raumSenden(raum);
  }
  // Nur einer gekommen: er gewinnt kampflos (sonst hinge die Olympiade)
  function olympAllein(raum) {
    const m = mitglieder(raum).find(x => x.transport);
    if (!m || raum.olymp.gemeldet) return;
    raum.olymp.gemeldet = true; raum.olymp.gestartet = true; raum.phase = 'ende';
    const plaetze = [{ id:m.id, name:m.name, platz:1, text:'Kampflos (niemand sonst da)', wert:1e6 }];
    anAlle(raum, { t:'ende', platzierung:plaetze });
    raumSenden(raum);
    olymp && olymp.rangMelden(raum.olymp.t, [{ s:m.olympId, wert:1e6, text:plaetze[0].text }]);
  }
  function olympBeitreten(m, ticket) {
    const t = olymp && olymp.ticketPruefen(ticket);
    if (!t) return senden(m, { t:'fehler', text:'Das Olympia-Ticket ist ungültig oder abgelaufen. Geh zurück zur Olympiade.', olymp:true });
    const schluessel = t.l + ':' + t.g;
    let raum = liste.get(olympRaeume.get(schluessel));
    m.olympId = t.s; m.name = nameOk(t.n) || 'Boxer';
    if (raum) {
      // Wiederkommen: den alten Platz übernehmen
      const alt = mitglieder(raum).find(x => x.olympId === t.s && x !== m);
      if (alt) { uebernehmen(m, alt, raum); return; }
      if (raum.phase !== 'lobby') return senden(m, { t:'fehler', text:'Das Turnier deiner Gruppe läuft schon ohne dich.', olymp:true, zurueck:t.z || null });
    } else {
      raum = raumErstellen('turnier', { dauer:t.c && t.c.dauer, platz3:t.c && t.c.platz3 }, { t, schluessel, gestartet:false, gemeldet:false, uhr:null, startBis:0, spaetestens:jetzt() + Z.warten });
      if (!raum) return senden(m, { t:'fehler', text:'Gerade sind zu viele Räume offen. Versuch es gleich nochmal.' });
      olympRaeume.set(schluessel, raum.code);
    }
    if (raum.mitglieder.size >= MAX_TURNIER) return senden(m, { t:'fehler', text:'Das Turnier ist voll (16 Boxer).' });
    beitreten(m, raum);
  }
  // Eine neue Verbindung übernimmt einen bestehenden Platz (Neuladen, Netz weg)
  function uebernehmen(m, alt, raum) {
    if (alt.transport && alt.transport !== m.transport) { const tr = alt.transport; alt.transport = null; try { tr.close && tr.close(); } catch (_) { /* egal */ } }
    alt.transport = m.transport; alt.weg = 0; alt.versteckt = false;
    m.ersetzt = alt;
    alt.preset = m.preset || alt.preset; alt.hose = m.hose || alt.hose; alt.handschuhe = m.handschuhe || alt.handschuhe;
    const k = raum.baum && aktuelleKaempfe(raum).find(x => x.status === 'laeuft' && (x.a === alt.id || x.b === alt.id));
    if (k) { k.blockGesetzt[k.a === alt.id ? 0 : 1] = false; k.kampf.befehl(k.a === alt.id ? 0 : 1, { a:'block', an:false }); }
    senden(alt, { t:'du', id:alt.id, token:alt.token });
    raumSenden(raum);
    baumSendenAn(raum, alt);
    if (k) senden(alt, { ...k.kopf, ecke:k.a === alt.id ? 0 : 1 });
  }

  /* ---------- Verbindungen ---------- */
  function verbinden(transport) {
    const m0 = { id:'s' + (naechsteId++), token:crypto.randomBytes(12).toString('hex'), name:'', preset:RF.PRESETS[0].id, hose:'#d32f2f', handschuhe:'#d32f2f',
      raum:null, transport, weg:0, versteckt:false, zaehler:0, fenster:jetzt(), schaut:null, schautWahl:false };
    senden(m0, { t:'du', id:m0.id, token:m0.token });
    const ich = () => m0.ersetzt || m0;      // nach dem Übernehmen eines alten Platzes zählt der alte Eintrag
    function nachricht(text) {
      const m = ich();
      const j = jetzt();
      if (j - m0.fenster > 1000) { m0.fenster = j; m0.zaehler = 0; }
      if (++m0.zaehler > 60) return;
      let d; try { d = JSON.parse(text); } catch (_) { return; }
      if (!d || typeof d.t !== 'string') return;
      const raum = m.raum;
      const fehler = t => senden(m, { t:'fehler', text:t });
      switch (d.t) {
        case 'hallo': {
          m.preset = presetOk(d.preset); m.hose = farbeOk(d.hose) || m.hose; m.handschuhe = farbeOk(d.handschuhe) || m.handschuhe;
          if (!m.olympId) { const n = nameOk(d.name); if (n) m.name = n; }
          // Wiederkommen in einen laufenden Raum per Token
          if (typeof d.token === 'string' && d.code && !raum) {
            const r = liste.get(String(d.code).toUpperCase());
            const alt = r && mitglieder(r).find(x => x.token === d.token);
            if (alt) { uebernehmen(m0, alt, r); return; }
            // In der Lobby wurde man beim Neuladen schon ausgetragen: einfach wieder hinein
            const voll = r && r.mitglieder.size >= (r.art === 'duell' ? 2 : MAX_TURNIER);
            if (r && r.phase === 'lobby' && !r.olymp && m.name && !voll && !mitglieder(r).some(x => x.name.toLowerCase() === m.name.toLowerCase())) { beitreten(m, r); return; }
            return senden(m, { t:'raum', code:null, phase:'aus' });
          }
          if (raum && raum.phase === 'lobby') raumSenden(raum);
          return;
        }
        case 'erstellen': {
          if (!m.name) return fehler('Gib zuerst deinen Namen ein.');
          const neu = raumErstellen(d.art === 'duell' ? 'duell' : 'turnier', d.einst);
          if (!neu) return fehler('Gerade sind zu viele Räume offen. Versuch es später nochmal.');
          return beitreten(m, neu);
        }
        case 'beitreten': {
          if (!m.name) return fehler('Gib zuerst deinen Namen ein.');
          const ziel = liste.get(String(d.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4));
          if (!ziel || ziel.olymp) return fehler('Diesen Raum gibt es nicht. Stimmt der Code?');
          if (ziel === raum) return raumSenden(raum);
          if (ziel.phase !== 'lobby') return fehler('In diesem Raum läuft gerade ein Turnier.');
          if (ziel.mitglieder.size >= (ziel.art === 'duell' ? 2 : MAX_TURNIER)) return fehler(ziel.art === 'duell' ? 'Das Duell ist schon voll.' : 'Das Turnier ist voll (16 Boxer).');
          if (mitglieder(ziel).some(x => x.name.toLowerCase() === m.name.toLowerCase())) return fehler('Diesen Namen gibt es im Raum schon.');
          return beitreten(m, ziel);
        }
        case 'olymp': return olympBeitreten(m, d.ticket);
        case 'verlassen': verlassen(m, true); return senden(m, { t:'raum', code:null, phase:'aus' });
        case 'sicht': m.versteckt = d.v === false; return;
      }
      if (!raum) return;
      const istHost = raum.host === m.id;
      switch (d.t) {
        case 'einst':
          if (!istHost || raum.phase !== 'lobby' || raum.olymp) return;
          raum.einst = einstPruefen(d.einst, raum.einst); raumSenden(raum); return;
        case 'start': {
          if (!istHost || raum.phase !== 'lobby') return;
          if (raum.olymp && raum.olymp.gestartet) return;
          if (raum.art === 'duell' && raum.mitglieder.size !== 2) return fehler('Für ein Duell braucht es genau zwei Boxer.');
          const f = turnierStarten(raum); if (f) fehler(f);
          return;
        }
        case 'b': {
          // Eingabe im Kampf
          const k = laufenderKampf(raum, m.id);
          if (!k || !d.b || typeof d.b !== 'object') return;
          k.kampf.befehl(k.a === m.id ? 0 : 1, { a:String(d.b.a), art:String(d.b.art || ''), seite:d.b.seite === 'L' ? 'L' : 'R', an:!!d.b.an });
          return;
        }
        case 'zuschauen': {
          if (raum.phase !== 'turnier' || laufenderKampf(raum, m.id)) return;
          m.schaut = typeof d.id === 'string' ? d.id : null; m.schautWahl = !!m.schaut; m.kopfGesendet = null;
          zuschauerSetzen(raum); return;
        }
        case 'aufgeben': { const k = laufenderKampf(raum, m.id); if (k) k.kampf.aufgeben(k.a === m.id ? 0 : 1); return; }
      }
    }
    return { nachricht, getrennt:() => { const m = ich(); if (m.transport === transport) verlassen(m, false); }, mitglied:m0 };
  }

  /* ---------- Takt: alle laufenden Kämpfe einen Schritt weiter ---------- */
  function takt() {
    takte++;
    const j = jetzt();
    for (const raum of liste.values()) {
      if (raum.phase !== 'turnier' || !raum.baum || raum.baum.pauseBis) continue;
      for (const k of aktuelleKaempfe(raum)) {
        if (k.status !== 'laeuft') continue;
        // Abwesende und versteckte Boxer stehen in Deckung; wer zu lange fehlt, gibt auf
        [k.a, k.b].forEach((id, ecke) => {
          const m = raum.mitglieder.get(id);
          const fehlt = !m || !m.transport || m.versteckt;
          if (fehlt !== k.blockGesetzt[ecke]) { k.blockGesetzt[ecke] = fehlt; if (fehlt) k.kampf.befehl(ecke, { a:'block', an:true }); }
          if ((!m || !m.transport) && m && m.weg && j - m.weg > Z.weg) k.kampf.aufgeben(ecke);
          if (!m) k.kampf.aufgeben(ecke);
        });
        k.kampf.schritt();
        if (takte % SENDE_JEDE === 0 || k.kampf.phase === 'ende') {
          const z = { t:'z', id:k.id, s:k.kampf.zustand(), e:k.kampf.ereignisse.splice(0) };
          const text = JSON.stringify(z);
          for (const id of [k.a, k.b, ...k.zuschauer]) { const m = raum.mitglieder.get(id); if (m && m.schaut === k.id) senden(m, text); }
        }
        if (k.kampf.phase === 'ende') kampfEnde(raum, k);
      }
    }
  }

  // Alte Räume aufräumen
  function aufraeumenAlt() {
    const j = jetzt();
    for (const raum of [...liste.values()]) {
      const aktiv = mitglieder(raum).some(m => m.transport);
      if (aktiv) raum.zuletzt = j;
      else if (j - raum.zuletzt > 15 * 60_000) aufraeumen(raum);
    }
  }

  return { verbinden, takt, liste, aufraeumenAlt, platzierung };
}

module.exports = { raeume, MAX_TURNIER };
