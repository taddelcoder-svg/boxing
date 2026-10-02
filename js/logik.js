/* Ringfieber – Kampfregeln.
   Rein und deterministisch (fester Takt, eigener Zufall mit Startwert): Derselbe Code rechnet die
   Solo-Kämpfe im Browser und die Online- und Turnierkämpfe auf dem Server.
   Seiten: 'L'/'R' ist bei Schlägen die Hand des Angreifers, beim Ausweichen die eigene Seite.
   Ein Haken mit links kommt beim Gegner von dessen rechter Seite – ausweichen also nach links. */
(function (wurzel, fabrik) {
  if (typeof module === 'object' && module.exports) module.exports = fabrik();
  else wurzel.RF = fabrik();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TAKT = 60;
  const s = sek => Math.round(sek * TAKT);
  const klemm = (v, a, b) => Math.max(a, Math.min(b, v));

  // Zufall mit Startwert (mulberry32)
  function zufall(startwert) {
    let a = (startwert >>> 0) || 1;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Schläge ----------
     aus = Ausholen (das sieht man und kann reagieren), tr = Treffermoment, erh = Erholung,
     stoss = so lange ist der Getroffene benommen. */
  const ANGRIFFE = {
    koerper:     { aus:s(.22), tr:s(.07), erh:s(.22), schaden:5,  puste:6,  stoss:s(.24), kopf:false, name:'Körpertreffer' },
    gerade:      { aus:s(.24), tr:s(.07), erh:s(.24), schaden:6,  puste:7,  stoss:s(.26), kopf:true,  name:'Gerade' },
    haken:       { aus:s(.42), tr:s(.08), erh:s(.32), schaden:11, puste:12, stoss:s(.38), kopf:true,  haken:true, schwer:true, name:'Haken' },
    aufwaerts:   { aus:s(.50), tr:s(.08), erh:s(.38), schaden:14, puste:15, stoss:s(.46), kopf:true,  unten:true, schwer:true, name:'Aufwärtshaken' },
    volltreffer: { aus:s(.55), tr:s(.10), erh:s(.42), schaden:10, puste:10, stoss:s(.60), kopf:true,  unten:true, schwer:true, stern:true, name:'Volltreffer' },
    ramm:        { aus:s(.95), tr:s(.12), erh:s(.80), schaden:20, puste:10, stoss:s(.60), kopf:true,  schwer:true, ramm:true, name:'Rammschlag' }
  };
  const ARTEN = Object.keys(ANGRIFFE);
  const MENSCH_ARTEN = ['koerper', 'gerade', 'haken'];

  const AUSWEICHEN = { dauer:s(.5), von:2, bis:s(.36) };   // unverwundbar in [von, bis)
  const DUCKEN = { dauer:s(.46), von:2, bis:s(.34) };
  const OFFEN = s(.65), OFFEN_SCHWER = s(.95);                // Konterfenster nach einem verfehlten Schlag
  const PLATT = s(1.2), GEBROCHEN = s(1.1), AUFSTEHEN = s(1.1);
  const PUFFER = s(.2);                                     // so lange wartet eine Eingabe, bis der Boxer frei ist
  const ZAEHL_TAKT = s(1);
  const PUSTE_MAX = 100;

  const AKTIONEN = ['bereit', 'block', 'ausweichen', 'ducken', 'schlag', 'offen', 'getroffen', 'gebrochen', 'boden', 'aufstehen', 'warten', 'jubel', 'enttaeuscht'];
  const PHASEN = ['intro', 'kampf', 'zaehlen', 'rundenpause', 'verlaengerung', 'ende'];

  /* ---------- Ligen und Computer-Gegner ---------- */
  const LIGEN = {
    bronze: { name:'Bronze', tempo:1.18, pause:1.25, deckung:0.75, abwehr:0.55, schaden:0.85, reaktion:1.35, liegen:0.40, hp:0.9 },
    silber: { name:'Silber', tempo:0.95, pause:0.95, deckung:1.0, abwehr:1.15, schaden:1.15, reaktion:0.92, liegen:0.25, hp:1.05 },
    gold:   { name:'Gold',   tempo:0.8,  pause:0.75, deckung:1.1, abwehr:1.6,  schaden:1.4,  reaktion:0.72, liegen:0.12, hp:1.2 }
  };

  // ki: tempo = Faktor fürs Ausholen (größer = deutlichere Vorzeichen), pause = Sekunden zwischen Angriffen,
  // abwehr = Chance, auf einen Schlag richtig zu reagieren, reaktion = Sekunden bis zur Reaktion,
  // serie = Chance auf einen schnellen Nachschlag, konter = Chance, ein offenes Fenster zu nutzen.
  const GEGNER = [
    { id:'bruno', name:'Bruno „Bulldozer“ Brandt', kurz:'Bruno', typ:'Hafenarbeiter, breit wie ein Schrank',
      tipp:'Holt lange aus. Weich seinen Haken aus und schlag zurück, solange er offen ist.',
      hp:110, schaden:1.05,
      ki:{ deckung:0.6, tempo:1.45, pause:[1.0, 1.9], abwehr:0.10, reaktion:.32, serie:0.05, konter:0.25, gewichte:{ haken:4, koerper:2, gerade:1 } },
      aussehen:{ haut:'#c98e6a', haare:'muetze', haarfarbe:'#2b4a6f', breite:1.25, groesse:0.98, hose:'#1d3b6e', handschuhe:'#c4342d', bart:'stoppeln' } },
    { id:'kiki', name:'Kiki Kessler', kurz:'Kiki', typ:'Flinke Kickboxerin',
      tipp:'Schlägt schnell und doppelt. Halt die Deckung oben und kontere nach der Serie.',
      hp:90, schaden:0.9,
      ki:{ deckung:0.65, tempo:1.28, pause:[0.85, 1.6], abwehr:0.22, reaktion:.3, serie:0.3, konter:0.35, gewichte:{ gerade:3, koerper:3, haken:1 } },
      aussehen:{ haut:'#f0c9a6', haare:'zopf', haarfarbe:'#d8a031', breite:0.88, groesse:0.96, frau:true, hose:'#c2185b', handschuhe:'#f5f5f5' } },
    { id:'finn', name:'Finn „Fuchs“ Falk', kurz:'Finn', typ:'Showman mit Sonnenbrille',
      tipp:'Täuscht gern an. Wart ab, bis der Schlag wirklich kommt.',
      hp:95, schaden:1.0,
      ki:{ deckung:0.75, tempo:1.22, pause:[0.75, 1.4], abwehr:0.35, reaktion:.25, serie:0.25, konter:0.45, finte:0.45, gewichte:{ haken:3, gerade:2, koerper:2 } },
      aussehen:{ haut:'#e7b48c', haare:'tolle', haarfarbe:'#e0621d', breite:0.98, groesse:1.0, hose:'#f08a1c', handschuhe:'#202020', brille:true } },
    { id:'flora', name:'Flora Funke', kurz:'Flora', typ:'Sehr groß, sehr lange Arme',
      tipp:'Ihre Haken kommen von oben. Ducken ist hier fast immer richtig.',
      hp:100, schaden:1.05,
      ki:{ deckung:0.75, tempo:1.15, pause:[0.75, 1.4], abwehr:0.42, reaktion:.24, serie:0.3, konter:0.45, gewichte:{ haken:5, gerade:2, aufwaerts:1 } },
      aussehen:{ haut:'#8d5a3b', haare:'kurz', haarfarbe:'#1a1a1a', breite:0.95, groesse:1.16, frau:true, arme:1.15, hose:'#6a3fb5', handschuhe:'#ffd23f' } },
    { id:'nero', name:'Nero Nagel', kurz:'Nero', typ:'Glatze, Stiernacken',
      tipp:'Sein Rammschlag dauert ewig – danach steht er lange offen. Ausweichen und draufhauen!',
      hp:115, schaden:1.0,
      ki:{ deckung:0.7, tempo:1.22, pause:[0.9, 1.7], abwehr:0.32, reaktion:.25, serie:0.12, konter:0.4, ramm:0.25, gewichte:{ haken:3, koerper:2, aufwaerts:2 } },
      aussehen:{ haut:'#d9a07c', haare:'glatze', haarfarbe:'#000000', breite:1.2, groesse:1.02, hose:'#111111', handschuhe:'#b71c1c', nacken:true } },
    { id:'gustav', name:'Gustav „Gorilla“ Grimm', kurz:'Gustav', typ:'Kraftprotz mit Bart',
      tipp:'Triffst du ihn oft, wird er wütend und haut eine Serie. Dann lieber blocken und ducken.',
      hp:115, schaden:1.1,
      ki:{ deckung:0.8, tempo:1.15, pause:[0.8, 1.4], abwehr:0.40, reaktion:.22, serie:0.2, konter:0.5, wut:true, gewichte:{ haken:3, aufwaerts:2, koerper:2, gerade:1 } },
      aussehen:{ haut:'#b07a52', haare:'kurz', haarfarbe:'#3b2314', breite:1.18, groesse:1.04, hose:'#2e7d32', handschuhe:'#2e7d32', bart:'voll' } },
    { id:'otto', name:'Otto Okta', kurz:'Otto', typ:'Akrobat, wechselt die Auslage',
      tipp:'Wechselt mitten im Haken die Hand. Achte auf den Handschuh, der zuletzt leuchtet.',
      hp:100, schaden:1.05,
      ki:{ deckung:0.85, tempo:1.1, pause:[0.7, 1.3], abwehr:0.45, reaktion:.2, serie:0.3, konter:0.55, wechsel:0.45, gewichte:{ haken:4, gerade:2, koerper:2, aufwaerts:1 } },
      aussehen:{ haut:'#f2d0b5', haare:'stirnband', haarfarbe:'#6d4c41', breite:0.9, groesse:1.0, hose:'#00897b', handschuhe:'#00bcd4' } },
    { id:'leo', name:'Leo König', kurz:'Leo', typ:'Champion mit goldenem Gürtel',
      tipp:'Kann alles: Finten, Handwechsel und einen eigenen Volltreffer. Bleib ruhig.',
      hp:125, schaden:1.15,
      ki:{ deckung:0.9, tempo:1.05, pause:[0.6, 1.2], abwehr:0.55, reaktion:.18, serie:0.3, konter:0.65, finte:0.18, wechsel:0.2, stern:0.6, gewichte:{ haken:3, gerade:2, koerper:2, aufwaerts:2 } },
      aussehen:{ haut:'#5c3a24', haare:'kurz', haarfarbe:'#0d0d0d', breite:1.08, groesse:1.06, hose:'#d4af37', handschuhe:'#d4af37', guertel:true } }
  ];

  // Spielerfiguren zur Auswahl (nur Aussehen, alle gleich stark)
  const PRESETS = [
    { id:'mia',   name:'Mia',   frau:true,  haut:'#f1c9a5', haare:'zopf',     haarfarbe:'#5a3825', breite:0.9,  groesse:0.97 },
    { id:'jonas', name:'Jonas', frau:false, haut:'#e9b893', haare:'kurz',     haarfarbe:'#c58b3a', breite:1.0,  groesse:1.0 },
    { id:'aylin', name:'Aylin', frau:true,  haut:'#c99068', haare:'dutt',     haarfarbe:'#1b1310', breite:0.92, groesse:0.99 },
    { id:'malik', name:'Malik', frau:false, haut:'#6b4329', haare:'locken',   haarfarbe:'#120c08', breite:1.06, groesse:1.03 },
    { id:'lena',  name:'Lena',  frau:true,  haut:'#f3d3bb', haare:'kurz',     haarfarbe:'#d9b26a', breite:0.94, groesse:1.02 },
    { id:'tom',   name:'Tom',   frau:false, haut:'#f0c4a0', haare:'glatze',   haarfarbe:'#000000', breite:1.12, groesse:0.98, bart:'voll' },
    { id:'zoe',   name:'Zoe',   frau:true,  haut:'#8a5636', haare:'locken',   haarfarbe:'#2a1a12', breite:0.96, groesse:1.05 },
    { id:'ben',   name:'Ben',   frau:false, haut:'#d7a37e', haare:'tolle',    haarfarbe:'#2c2c2c', breite:1.0,  groesse:1.08 }
  ];
  // Farben für Hose und Handschuhe; die mit "frei" schaltet die Karriere frei
  const FARBEN = [
    { id:'rot', name:'Rot', wert:'#d32f2f' }, { id:'blau', name:'Swimming-Lions-Blau', wert:'#1f5fbf' },
    { id:'schwarz', name:'Schwarz', wert:'#1b1b1b' }, { id:'weiss', name:'Weiß', wert:'#f2f2f2' },
    { id:'gruen', name:'Grün', wert:'#2e7d32' }, { id:'lila', name:'Lila', wert:'#6a3fb5' },
    { id:'orange', name:'Orange', wert:'#f57c00', frei:'bronze' }, { id:'pink', name:'Pink', wert:'#e91e8c', frei:'bronze' },
    { id:'silber', name:'Silber', wert:'#b9c2cc', frei:'silber' }, { id:'tuerkis', name:'Türkis', wert:'#00acc1', frei:'silber' },
    { id:'gold', name:'Gold', wert:'#d4af37', frei:'gold' }, { id:'flamme', name:'Flammenrot', wert:'#ff3d00', frei:'gold' }
  ];

  // Ki-Werte eines Gegners in einer Liga
  function gegnerWerte(id, liga) {
    const g = GEGNER.find(x => x.id === id) || GEGNER[0];
    const L = LIGEN[liga] || LIGEN.silber;
    const k = g.ki;
    return {
      hp:Math.round(g.hp * L.hp), schadenFaktor:g.schaden * L.schaden,
      ki:{
        tempo:k.tempo * L.tempo, pause:[k.pause[0] * L.pause, k.pause[1] * L.pause], abwehr:Math.min(0.92, k.abwehr * L.abwehr), deckung:Math.min(0.95, k.deckung * L.deckung),
        reaktion:s(k.reaktion * L.reaktion), serie:k.serie, konter:Math.min(0.95, k.konter * (L.abwehr > 1 ? 1.2 : L.abwehr < 1 ? 0.7 : 1)),
        finte:k.finte || 0, ramm:k.ramm || 0, wut:!!k.wut, wechsel:k.wechsel || 0, stern:k.stern || 0, gewichte:k.gewichte, liegen:L.liegen
      }
    };
  }

  // Welche Abwehr hilft gegen welchen Schlag? (für Hinweise im Training)
  function abwehrTipp(art, seite) {
    const a = ANGRIFFE[art];
    if (!a) return '';
    const s = seite === 'L' ? 'links' : 'rechts';
    if (a.ramm) return 'Ausweichen oder ducken!';
    if (a.unten) return 'Zur Seite ausweichen – nicht ducken!';
    if (a.haken) return `Ducken oder nach ${s} ausweichen!`;
    if (!a.kopf) return 'Ausweichen oder blocken!';
    return 'Ausweichen, ducken oder blocken!';
  }

  function boxerNeu(w) {
    w = w || {};
    return {
      hpMax:w.hp || 100, hp:w.hp || 100, puste:PUSTE_MAX, sterne:0, nd:0, ndRunde:0,
      aktion:'bereit', t:0, dauer:0, a:null, seite:'R', block:false, puffer:null, platt:0,
      aufgeloest:true, abwehr:0, angriffNr:0, offenGezaehlt:false, trefferArt:null, trefferSeite:'R',
      tippen:0, tippenNoetig:0, aufstehenBei:0, schadenAus:0, treffer:0, volltreffer:0, konter:0, ausgewichen:0, geblockt:0,
      schadenFaktor:w.schadenFaktor || 1, unverwundbar:!!w.unverwundbar,
      ki:w.ki || null, kiTimer:s(1.2), kiGesehen:-1, kiBlockBis:0, kiSerie:0, wut:0, wutTreffer:[]
    };
  }

  const RANG_ABWEHR = { treffer_schwer:0, treffer:1, block:2, aus:3 };

  class Kampf {
    // opt: { boxer:[werte, werte], runden, dauer (Sek.), gnade (Takte), verlaengerung, startwert, intro, pause }
    constructor(opt) {
      opt = opt || {};
      this.einst = {
        runden:opt.runden || 3, dauer:s(opt.dauer || 60), gnade:opt.gnade != null ? opt.gnade : 2,
        verlaengerung:!!opt.verlaengerung, maxNd:3, intro:opt.intro != null ? opt.intro : s(2.6), pause:opt.pause != null ? opt.pause : s(5)
      };
      this.rng = zufall(opt.startwert || 1);
      this.b = [boxerNeu((opt.boxer || [])[0]), boxerNeu((opt.boxer || [])[1])];
      this.tick = 0; this.phase = 'intro'; this.pt = 0; this.runde = 1; this.uhr = this.einst.dauer;
      this.zaehler = 0; this.ergebnis = null; this.ereignisse = []; this.befehle = [[], []]; this.vorPhase = 'kampf';
      for (const b of this.b) if (b.ki) b.kiTimer = s(0.8 + this.rng() * 0.8);
    }

    ev(e) { e.tick = this.tick; this.ereignisse.push(e); }
    befehl(i, b) { if (b && typeof b === 'object' && this.befehle[i].length < 30) this.befehle[i].push(b); }
    imKampf() { return this.phase === 'kampf' || this.phase === 'verlaengerung'; }

    schritt() {
      if (this.phase === 'ende') { this.befehle[0].length = this.befehle[1].length = 0; return; }
      this.tick++; this.pt++;
      const ph = this.phase;
      if (ph === 'intro') {
        this.befehleAnwenden(0); this.befehleAnwenden(1);
        for (const b of this.b) b.puffer = null;
        if (this.pt >= this.einst.intro) { this.phase = 'kampf'; this.pt = 0; this.ev({ typ:'gong', runde:this.runde }); }
        return;
      }
      if (ph === 'rundenpause') {
        this.befehle[0].length = this.befehle[1].length = 0;
        if (this.pt >= this.einst.pause) {
          this.runde++; this.uhr = this.einst.dauer; this.phase = 'kampf'; this.pt = 0;
          this.ev({ typ:'gong', runde:this.runde });
        }
        return;
      }
      if (ph === 'zaehlen') { this.zaehlSchritt(); return; }
      // Kampf oder Verlängerung
      this.befehleAnwenden(0); this.befehleAnwenden(1);
      if (this.b[0].ki) this.kiSchritt(0);
      if (this.b[1].ki) this.kiSchritt(1);
      this.boxerSchritt(0); this.boxerSchritt(1);
      this.trefferPruefen(0); this.trefferPruefen(1);
      if (this.phase === 'ende') return;
      const unten = [0, 1].filter(i => this.b[i].hp <= 0 && this.b[i].aktion !== 'boden');
      if (unten.length) { for (const i of unten) this.niederschlag(i); return; }
      this.uhr--;
      if (this.uhr <= 0) this.rundeEnde();
    }

    befehleAnwenden(i) {
      const b = this.b[i], q = this.befehle[i];
      for (const c of q) {
        if (c.a === 'block') { b.block = !!c.an; continue; }
        if (c.a === 'tippen') { if (b.aktion === 'boden') b.tippen++; continue; }
        if (!this.imKampf()) continue;
        if (['ausweichen', 'ducken', 'schlag', 'stern'].includes(c.a)) b.puffer = { a:c.a, art:c.art, seite:c.seite === 'L' ? 'L' : 'R', bis:this.tick + PUFFER };
      }
      q.length = 0;
    }

    pusteErholen(b, proSek) { b.puste = Math.min(PUSTE_MAX, b.puste + proSek / TAKT); }

    boxerSchritt(i) {
      const b = this.b[i];
      b.t++;
      if (b.platt > 0) b.platt--;
      switch (b.aktion) {
        case 'bereit':
          this.pusteErholen(b, 16);
          if (b.block) { b.aktion = 'block'; b.t = 0; }
          break;
        case 'block':
          this.pusteErholen(b, 7);
          if (!b.block) { b.aktion = 'bereit'; b.t = 0; }
          break;
        case 'ausweichen': if (b.t >= AUSWEICHEN.dauer) this.frei(b); break;
        case 'ducken': if (b.t >= DUCKEN.dauer) this.frei(b); break;
        case 'schlag': {
          const a = b.a;
          if (a.finteBei && b.t >= a.finteBei) { this.ev({ typ:'finte', wer:i }); this.frei(b); break; }
          if (a.wechselBei && b.t === a.wechselBei) { b.seite = b.seite === 'L' ? 'R' : 'L'; this.ev({ typ:'wechsel', wer:i, seite:b.seite }); }
          if (b.t === a.aus) { b.aufgeloest = false; b.abwehr = 0; }
          if (b.t >= a.aus + a.tr + a.erh) this.frei(b);
          break;
        }
        case 'offen': case 'getroffen': case 'gebrochen':
          if (b.t >= b.dauer) this.frei(b);
          break;
        case 'warten': this.pusteErholen(b, 30); break;
      }
      // Gepufferte Eingabe ausführen, sobald der Boxer frei ist
      if (b.puffer && b.puffer.bis < this.tick) b.puffer = null;
      // Nach gelungenem Ausweichen/Ducken darf man sofort kontern (die Bewegung wird abgebrochen)
      const konterBereit = b.erfolg && (b.aktion === 'ausweichen' || b.aktion === 'ducken') && b.puffer && (b.puffer.a === 'schlag' || b.puffer.a === 'stern');
      if (b.puffer && !(b.puffer.ab > this.tick) && (b.aktion === 'bereit' || b.aktion === 'block' || konterBereit)) { const p = b.puffer; b.puffer = null; this.starten(i, p); }
    }

    frei(b) {
      if (b.ki && b.kiDeckung && b.kiTimer > 0) b.block = true;
      b.aktion = b.block ? 'block' : 'bereit'; b.t = 0; b.a = null; b.dauer = 0; b.erfolg = false;
    }

    starten(i, c) {
      const b = this.b[i];
      b.erfolg = false;
      if (c.a === 'ausweichen') { b.aktion = 'ausweichen'; b.seite = c.seite; b.t = 0; return; }
      if (c.a === 'ducken') { b.aktion = 'ducken'; b.t = 0; return; }
      let art = c.a === 'stern' ? 'volltreffer' : c.art;
      if (!ANGRIFFE[art]) return;
      if (!b.ki && !c.intern && !MENSCH_ARTEN.includes(art) && art !== 'volltreffer') return;
      if (b.platt > 0) { this.ev({ typ:'platt', wer:i }); return; }
      const basis = ANGRIFFE[art];
      const a = { art, aus:basis.aus, tr:basis.tr, erh:basis.erh, schaden:basis.schaden, finteBei:0, wechselBei:0 };
      if (art === 'volltreffer') {
        if (b.sterne < 1) { this.ev({ typ:'keinStern', wer:i }); return; }
        a.schaden = basis.schaden + 7 * b.sterne; a.sterne = b.sterne; b.sterne = 0;
      }
      if (c.tempo) a.aus = Math.max(6, Math.round(a.aus * c.tempo));
      if (c.finte) a.finteBei = Math.max(4, Math.round(a.aus * 0.55));
      if (c.wechsel) a.wechselBei = Math.max(4, Math.round(a.aus * 0.5));
      b.puste -= basis.puste;
      if (b.puste <= 0) { b.puste = 0; b.platt = PLATT; this.ev({ typ:'platt', wer:i }); }
      b.a = a; b.seite = c.seite; b.aktion = 'schlag'; b.t = 0; b.aufgeloest = true; b.angriffNr++;
      this.ev({ typ:'ausholen', wer:i, art, seite:c.seite });
    }

    // Wie steht der Verteidiger gerade zu diesem Schlag?
    abwehrJetzt(i) {
      const b = this.b[i], g = this.b[1 - i], a = ANGRIFFE[b.a.art];
      switch (g.aktion) {
        case 'ausweichen':
          if (g.t >= AUSWEICHEN.von && g.t < AUSWEICHEN.bis) return a.haken && g.seite !== b.seite ? 'treffer' : 'aus';
          return 'treffer';
        case 'ducken':
          if (g.t >= DUCKEN.von && g.t < DUCKEN.bis) { if (!a.kopf) return 'treffer'; return a.unten ? 'treffer_schwer' : 'aus'; }
          return 'treffer';
        case 'block': return 'block';
        case 'boden': case 'aufstehen': case 'warten': return 'aus';
        default: return 'treffer';
      }
    }

    // Treffermoment: Abwehr im Gnadenfenster (gleicht die Verzögerung im Netz aus) – das Beste zählt
    trefferPruefen(i) {
      const b = this.b[i];
      if (b.aktion !== 'schlag' || b.aufgeloest || b.t < b.a.aus) return;
      const r = this.abwehrJetzt(i);
      const best = Object.keys(RANG_ABWEHR).find(k => RANG_ABWEHR[k] === Math.max(b.abwehr, RANG_ABWEHR[r]));
      b.abwehr = RANG_ABWEHR[best];
      if (best === 'aus' || b.t >= b.a.aus + this.einst.gnade) this.aufloesen(i, best);
    }

    aufloesen(i, erg) {
      const b = this.b[i], g = this.b[1 - i], a = b.a, basis = ANGRIFFE[a.art];
      b.aufgeloest = true;
      if (erg === 'aus') {
        b.aktion = 'offen'; b.t = 0; b.dauer = basis.schwer ? OFFEN_SCHWER : OFFEN; b.offenGezaehlt = false;
        b.puste = Math.max(0, b.puste - 5);
        g.ausgewichen++; g.erfolg = true;
        this.ev({ typ:'ausgewichen', wer:1 - i, art:a.art });
        return;
      }
      if (erg === 'block') {
        const durch = basis.unten || basis.ramm;
        const schaden = durch ? Math.round(a.schaden * 0.5 * b.schadenFaktor) : basis.schwer ? 2 : 0;
        g.puste -= durch ? 18 : basis.schwer ? 11 : 5;
        g.geblockt++;
        if (g.ki && !basis.schwer && this.rng() < g.ki.konter * 0.45) g.kiKonterAb = this.tick + s(0.12);
        if (schaden) this.schaden(1 - i, schaden);
        this.ev({ typ:'geblockt', wer:1 - i, art:a.art, schaden });
        if (g.puste <= 0) {
          g.puste = 0; g.aktion = 'gebrochen'; g.t = 0; g.dauer = GEBROCHEN; g.puffer = null;
          this.ev({ typ:'gebrochen', wer:1 - i });
        } else if (durch) { g.aktion = 'getroffen'; g.t = 0; g.dauer = s(.25); g.trefferArt = a.art; g.trefferSeite = b.seite; }
        return;
      }
      // Treffer. Steckt der Getroffene selbst gerade im Treffermoment, landet sein Schlag auch (Schlagabtausch).
      if (g.aktion === 'schlag' && !g.aufgeloest && g.t >= g.a.aus) this.aufloesen(1 - i, this.abwehrJetzt(1 - i));
      let faktor = erg === 'treffer_schwer' ? 1.5 : 1;
      let konter = false, unterbrochen = false;
      // Panzer: Wer zu einem schweren Schlag ausholt, steckt leichte Treffer weg (halber Schaden, kein Abbruch)
      if (g.aktion === 'schlag' && g.t < g.a.aus && ANGRIFFE[g.a.art].schwer && !basis.schwer) {
        const schaden = Math.max(1, Math.round(a.schaden * 0.5 * b.schadenFaktor));
        this.schaden(1 - i, schaden); b.treffer++;
        this.ev({ typ:'treffer', wer:i, art:a.art, seite:b.seite, schaden, panzer:true, kopf:basis.kopf, sterne:0 });
        return;
      }
      if (g.aktion === 'offen') {
        faktor *= 1.3; konter = true;
        if (!g.offenGezaehlt) { g.offenGezaehlt = true; b.sterne = Math.min(3, b.sterne + 1); b.konter++; }
      } else if (g.aktion === 'schlag' && g.t < g.a.aus) {
        unterbrochen = true; b.sterne = Math.min(3, b.sterne + 1);
      }
      if (g.aktion === 'gebrochen') faktor *= 1.25;
      const schaden = Math.max(1, Math.round(a.schaden * faktor * b.schadenFaktor));
      this.schaden(1 - i, schaden);
      b.treffer++;
      if (basis.stern) b.volltreffer++;
      if (basis.schwer && g.sterne > 0) g.sterne--;
      g.puste = Math.max(0, g.puste - 3);
      g.aktion = 'getroffen'; g.t = 0; g.dauer = Math.round(basis.stoss * (konter ? 2.0 : 1)); g.a = null; g.puffer = null; g.block = g.block && !g.ki;
      g.trefferArt = a.art; g.trefferSeite = b.seite;
      // Ein kassierter Treffer ohne Konter: Deckung hoch bis zum nächsten eigenen Angriff
      if (g.ki && !konter) { g.kiDeckung = true; g.kiBlockBis = Infinity; }
      if (g.ki && g.ki.wut) { g.wutTreffer.push(this.tick); g.wutTreffer = g.wutTreffer.filter(t => this.tick - t < s(3.5)); }
      this.ev({ typ:'treffer', wer:i, art:a.art, seite:b.seite, schaden, konter, unterbrochen, kopf:basis.kopf, sterne:a.sterne || 0 });
      if (this.phase === 'verlaengerung') this.ende(i, 'verlaengerung');
    }

    schaden(i, n) {
      const g = this.b[i];
      this.b[1 - i].schadenAus += n;
      if (!g.unverwundbar) g.hp = Math.max(0, g.hp - n);
    }

    niederschlag(i) {
      if (this.phase === 'ende') return;
      const b = this.b[i], g = this.b[1 - i];
      b.aktion = 'boden'; b.t = 0; b.nd++; b.ndRunde++; b.puffer = null; b.a = null; b.tippen = 0;
      this.ev({ typ:'niederschlag', wer:i, nd:b.nd });
      if (b.ndRunde >= this.einst.maxNd) { this.ende(1 - i, 'tko'); return; }
      if (g.aktion !== 'boden') { g.aktion = 'warten'; g.t = 0; g.a = null; g.puffer = null; }
      b.tippenNoetig = 10 + 8 * (b.nd - 1);
      if (b.ki) {
        const liegen = b.nd >= 2 && this.rng() < b.ki.liegen;
        b.aufstehenBei = liegen ? 99 : klemm(2 + b.nd * 2 + Math.floor(this.rng() * 3), 2, 9);
      }
      if (this.phase !== 'zaehlen') { this.vorPhase = this.phase; this.phase = 'zaehlen'; this.pt = 0; this.zaehler = 0; }
    }

    zaehlSchritt() {
      this.befehleAnwenden(0); this.befehleAnwenden(1);
      for (const b of this.b) {
        b.t++; b.puffer = null;
        if (b.aktion === 'warten') this.pusteErholen(b, 30);
      }
      if (this.pt >= s(0.8) && (this.pt - s(0.8)) % ZAEHL_TAKT === 0 && this.b.some(b => b.aktion === 'boden')) {
        this.zaehler++;
        this.ev({ typ:'zaehlen', n:this.zaehler });
        if (this.zaehler >= 10) {
          const unten = [0, 1].filter(i => this.b[i].aktion === 'boden');
          if (unten.length === 2) this.entscheidung(true); else this.ende(1 - unten[0], 'ko');
          return;
        }
      }
      for (let i = 0; i < 2; i++) {
        const b = this.b[i];
        if (b.aktion === 'boden') {
          const hoch = b.ki ? this.zaehler >= b.aufstehenBei : b.tippen >= b.tippenNoetig;
          if (hoch && this.pt >= s(1.2)) {
            b.aktion = 'aufstehen'; b.t = 0;
            b.hp = Math.round(b.hpMax * Math.max(0.3, 0.65 - 0.17 * (b.nd - 1)));
            b.puste = PUSTE_MAX;
            this.ev({ typ:'aufgestanden', wer:i, n:this.zaehler });
          }
        }
      }
      if (this.b.every(b => b.aktion !== 'boden' && !(b.aktion === 'aufstehen' && b.t < AUFSTEHEN))) {
        for (const b of this.b) { b.aktion = 'bereit'; b.t = 0; b.block = b.block && !b.ki; }
        this.phase = this.vorPhase; this.pt = 0;
        this.ev({ typ:'weiter' });
      }
    }

    rundeEnde() {
      this.ev({ typ:'gong', ende:true, runde:this.runde });
      if (this.phase === 'verlaengerung') { this.ende(this.rng() < 0.5 ? 0 : 1, 'los'); return; }
      if (this.runde >= this.einst.runden) { this.entscheidung(false); return; }
      this.phase = 'rundenpause'; this.pt = 0;
      for (const b of this.b) {
        b.aktion = 'bereit'; b.t = 0; b.a = null; b.puffer = null; b.ndRunde = 0; b.puste = PUSTE_MAX; b.platt = 0;
        b.hp = Math.min(b.hpMax, b.hp + Math.round(b.hpMax * 0.15));
      }
      this.ev({ typ:'rundenpause', runde:this.runde });
    }

    // Punktentscheidung: mehr ausgeteilter Schaden, dann weniger Niederschläge
    entscheidung(beideKo) {
      const [A, B] = this.b;
      let sieger = null;
      if (A.schadenAus !== B.schadenAus) sieger = A.schadenAus > B.schadenAus ? 0 : 1;
      else if (A.nd !== B.nd) sieger = A.nd < B.nd ? 0 : 1;
      if (sieger !== null) return this.ende(sieger, 'punkte');
      if (this.einst.verlaengerung) {
        this.phase = 'verlaengerung'; this.pt = 0; this.uhr = s(20);
        for (const b of this.b) { b.aktion = 'bereit'; b.t = 0; b.a = null; b.puffer = null; b.puste = PUSTE_MAX; if (b.hp <= 0) b.hp = 20; }
        this.ev({ typ:'verlaengerung' });
        return;
      }
      this.ende(null, 'unentschieden');
    }

    ende(sieger, art) {
      if (this.phase === 'ende') return;
      this.phase = 'ende'; this.pt = 0;
      const [A, B] = this.b;
      this.ergebnis = {
        sieger, art, runde:this.runde, schaden:[A.schadenAus, B.schadenAus], nd:[A.nd, B.nd],
        treffer:[A.treffer, B.treffer], konter:[A.konter, B.konter], volltreffer:[A.volltreffer, B.volltreffer],
        hp:[A.hp, B.hp], zeit:this.tick
      };
      for (let i = 0; i < 2; i++) {
        const b = this.b[i];
        b.puffer = null; b.a = null;
        if (b.aktion === 'boden') continue;
        b.aktion = sieger === i ? 'jubel' : sieger === null ? 'bereit' : 'enttaeuscht'; b.t = 0;
      }
      this.ev({ typ:'ende', sieger, art });
    }

    aufgeben(i) { if (this.phase !== 'ende') this.ende(1 - i, 'aufgabe'); }

    /* ---------- Computer-Gegner ---------- */
    kiSchritt(i) {
      const b = this.b[i], g = this.b[1 - i], k = b.ki, r = this.rng;
      const frei = b.aktion === 'bereit' || b.aktion === 'block';
      // Auf einen Schlag reagieren (einmal pro Schlag, nach der Reaktionszeit)
      if (g.aktion === 'schlag' && g.t < g.a.aus && g.angriffNr !== b.kiGesehen && g.t >= k.reaktion) {
        b.kiGesehen = g.angriffNr;
        const a = ANGRIFFE[g.a.art];
        // Leichte Schläge hält die Deckung ohnehin; sonst mit der Abwehr-Chance richtig reagieren
        if (frei && !(b.block && !a.schwer) && r() < k.abwehr) {
          const w = r();
          if (a.unten || a.ramm) b.puffer = { a:'ausweichen', seite:r() < 0.5 ? 'L' : 'R' };
          else if (a.haken) b.puffer = w < 0.5 ? { a:'ducken' } : { a:'ausweichen', seite:g.seite };
          else if (w < 0.5) { b.block = true; b.kiBlockBis = this.tick + s(0.6); }
          else if (!a.kopf || w < 0.8) b.puffer = { a:'ausweichen', seite:r() < 0.5 ? 'L' : 'R' };
          else b.puffer = { a:'ducken' };
          if (b.puffer) {
            b.puffer.bis = this.tick + PUFFER;
            // Nicht zu früh ausweichen, sonst ist die Bewegung vorbei, bevor der Schlag ankommt
            const rest = g.a.aus - g.t;
            if (rest > AUSWEICHEN.bis - 4) b.puffer.ab = this.tick + rest - (AUSWEICHEN.bis - 6);
          }
        }
      }
      if (b.puffer && b.puffer.ab && this.tick < b.puffer.ab) { b.puffer.bis = this.tick + PUFFER; return; }
      if (!frei) return;
      // Kurzer Gegenschlag nach einem geblockten Schlag
      if (b.kiKonterAb && this.tick >= b.kiKonterAb) {
        b.kiKonterAb = 0;
        if (g.aktion !== 'boden' && g.aktion !== 'aufstehen') { b.block = false; this.kiAngriff(i, 'gerade', 0.7); return; }
      }
      // Offenen Gegner bestrafen
      if (g.aktion === 'offen' && !b.kiKonterGeprueft) {
        b.kiKonterGeprueft = true;
        if (r() < k.konter) { b.block = false; this.kiAngriff(i, r() < 0.6 ? 'gerade' : 'haken', 0.75); b.kiTimer = s(0.5); return; }
      }
      if (g.aktion !== 'offen') b.kiKonterGeprueft = false;
      if (g.aktion === 'boden' || g.aktion === 'aufstehen') return;
      if (b.block && this.tick >= b.kiBlockBis) b.block = false;
      b.kiTimer--;
      if (b.kiTimer > 0) return;
      b.block = false;
      // Wut (Gustav): nach mehreren Treffern eine schnelle Serie
      if (k.wut && b.wut <= 0 && b.wutTreffer.length >= 3) { b.wut = 4; b.wutTreffer = []; this.ev({ typ:'wut', wer:i }); }
      if (b.wut > 0) {
        b.wut--;
        this.kiAngriff(i, b.wut % 2 ? 'haken' : 'aufwaerts', 0.78);
        b.kiTimer = b.wut > 0 ? s(0.18) : s(1.2);
        return;
      }
      let art;
      if (k.stern && b.sterne >= 1 && r() < k.stern) art = 'volltreffer';
      else if (k.ramm && r() < k.ramm * 0.5) art = 'ramm';
      else art = this.kiWahl(k.gewichte);
      this.kiAngriff(i, art, 1);
      const serie = b.kiSerie < 2 && r() < k.serie;
      b.kiSerie = serie ? b.kiSerie + 1 : 0;
      b.kiTimer = serie ? s(0.12) : s(k.pause[0] + r() * (k.pause[1] - k.pause[0]));
      // Zwischen den Angriffen: Deckung hoch (oder offen stehen)
      if (!serie && r() < k.deckung) { b.kiDeckung = true; b.kiBlockBis = Infinity; } else b.kiDeckung = false;
    }

    kiWahl(gewichte) {
      const liste = Object.entries(gewichte);
      let summe = 0;
      for (const [, w] of liste) summe += w;
      let x = this.rng() * summe;
      for (const [art, w] of liste) { x -= w; if (x < 0) return art; }
      return liste[0][0];
    }

    kiAngriff(i, art, tempoFaktor) {
      const b = this.b[i], k = b.ki, r = this.rng;
      const c = { a:art === 'volltreffer' ? 'stern' : 'schlag', art, seite:r() < 0.5 ? 'L' : 'R', bis:this.tick + PUFFER, tempo:k.tempo * tempoFaktor };
      if (art !== 'volltreffer' && art !== 'ramm' && k.finte && r() < k.finte) c.finte = true;
      else if (art === 'haken' && k.wechsel && r() < k.wechsel) c.wechsel = true;
      b.puffer = c;
    }

    /* ---------- Für das Netz: kompakter Zustand ---------- */
    zustand() {
      return {
        t:this.tick, ph:PHASEN.indexOf(this.phase), r:this.runde, u:this.uhr, z:this.zaehler, rn:this.einst.runden,
        b:this.b.map(b => [
          AKTIONEN.indexOf(b.aktion), b.t, b.a ? ARTEN.indexOf(b.a.art) : -1, b.a ? b.a.aus : 0, b.seite === 'L' ? 0 : 1,
          Math.round(b.hp), Math.round(b.puste), b.sterne, b.nd, b.dauer, b.block ? 1 : 0, b.platt > 0 ? 1 : 0,
          b.tippen, b.tippenNoetig, b.schadenAus, b.hpMax, b.wut > 0 ? 1 : 0, b.trefferArt ? ARTEN.indexOf(b.trefferArt) : -1,
          b.trefferSeite === 'L' ? 0 : 1, b.a ? b.a.finteBei : 0, b.a ? b.a.wechselBei : 0
        ]),
        e:this.ergebnis
      };
    }
  }

  // Aus einem Netz-Zustand die Felder machen, die Darstellung und Anzeige brauchen
  function boxerAusZustand(z) {
    const art = z[2] >= 0 ? ARTEN[z[2]] : null;
    return {
      aktion:AKTIONEN[z[0]] || 'bereit', t:z[1], a:art ? { art, aus:z[3], tr:ANGRIFFE[art].tr, erh:ANGRIFFE[art].erh, finteBei:z[19], wechselBei:z[20] } : null,
      seite:z[4] ? 'R' : 'L', hp:z[5], puste:z[6], sterne:z[7], nd:z[8], dauer:z[9], block:!!z[10], platt:z[11] ? 1 : 0,
      tippen:z[12], tippenNoetig:z[13], schadenAus:z[14], hpMax:z[15], wut:z[16], trefferArt:z[17] >= 0 ? ARTEN[z[17]] : null, trefferSeite:z[18] ? 'R' : 'L'
    };
  }

  return {
    TAKT, s, zufall, ANGRIFFE, ARTEN, MENSCH_ARTEN, AUSWEICHEN, DUCKEN, AKTIONEN, PHASEN, LIGEN, GEGNER, PRESETS, FARBEN,
    gegnerWerte, abwehrTipp, Kampf, boxerAusZustand, PUSTE_MAX
  };
});
