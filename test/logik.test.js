'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const RF = require('../js/logik.js');
const { spielerBot, kampfRechnen } = require('./spielerbot.js');

// Kampf ohne Intro, direkt in Runde 1
function kampf(opt = {}) {
  const k = new RF.Kampf({ intro:0, ...opt });
  k.schritt();
  assert.equal(k.phase, 'kampf');
  return k;
}
const laufen = (k, n) => { for (let i = 0; i < n; i++) k.schritt(); };
const ereignis = (k, typ) => k.ereignisse.filter(e => e.typ === typ);

test('Körpertreffer trifft, Block hält ihn auf', () => {
  const k = kampf();
  k.befehl(0, { a:'schlag', art:'koerper', seite:'L' });
  laufen(k, 30);
  assert.equal(k.b[1].hp, 95);
  k.befehl(1, { a:'block', an:true });
  k.befehl(0, { a:'schlag', art:'koerper', seite:'R' });
  laufen(k, 40);
  assert.equal(k.b[1].hp, 95, 'geblockt: kein Schaden');
  assert.equal(ereignis(k, 'geblockt').length, 1);
});

test('Haken: Ducken hilft, Ausweichen nur weg vom Haken', () => {
  for (const [abwehr, trifft] of [[{ a:'ducken' }, false], [{ a:'ausweichen', seite:'L' }, false], [{ a:'ausweichen', seite:'R' }, true]]) {
    const k = kampf();
    k.befehl(0, { a:'schlag', art:'haken', seite:'L' });
    laufen(k, RF.ANGRIFFE.haken.aus - 8);
    k.befehl(1, abwehr);
    laufen(k, 30);
    assert.equal(k.b[1].hp < 100, trifft, JSON.stringify(abwehr));
    if (!trifft) assert.equal(k.b[0].aktion, 'offen', 'nach dem Fehlschlag ist der Angreifer offen');
  }
});

test('Ducken unter einen Aufwärtshaken ist teuer, Block lässt die Hälfte durch', () => {
  const k = kampf();
  k.starten(0, { a:'schlag', art:'aufwaerts', seite:'R', intern:true });
  laufen(k, RF.ANGRIFFE.aufwaerts.aus - 8);
  k.befehl(1, { a:'ducken' });
  laufen(k, 30);
  assert.equal(k.b[1].hp, 100 - 21, '14 × 1,5');
  laufen(k, 30);
  k.befehl(1, { a:'block', an:true });
  k.starten(0, { a:'schlag', art:'aufwaerts', seite:'R', intern:true });
  laufen(k, 60);
  assert.equal(k.b[1].hp, 100 - 21 - 7, 'geblockt: die Hälfte');
});

test('Konter auf offenen Gegner zählt mehr und gibt einen Stern; Volltreffer braucht Sterne', () => {
  const k = kampf();
  k.befehl(1, { a:'stern' });
  laufen(k, 3);
  assert.equal(ereignis(k, 'keinStern').length, 1);
  k.befehl(0, { a:'schlag', art:'gerade', seite:'R' });
  laufen(k, 8);
  k.befehl(1, { a:'ausweichen', seite:'L' });
  laufen(k, 10);
  assert.equal(k.b[0].aktion, 'offen');
  assert.equal(k.b[1].aktion, 'ausweichen');
  k.befehl(1, { a:'schlag', art:'gerade', seite:'L' });
  laufen(k, 2);
  assert.equal(k.b[1].aktion, 'schlag', 'Ausweichen wird für den Konter abgebrochen');
  laufen(k, 20);
  assert.equal(k.b[0].hp, 100 - 8, '6 × 1,3');
  assert.equal(k.b[1].sterne, 1);
  laufen(k, 30);
  k.befehl(1, { a:'stern' });
  laufen(k, 50);
  assert.equal(k.b[0].hp, 100 - 8 - 17, 'Volltreffer mit einem Stern: 10 + 7');
  assert.equal(k.b[1].sterne, 0);
});

test('Gnadenfenster: eine Abwehr kurz nach dem Treffermoment zählt noch', () => {
  const k = kampf({ gnade:5 });
  k.befehl(0, { a:'schlag', art:'gerade', seite:'R' });
  laufen(k, RF.ANGRIFFE.gerade.aus + 1);
  k.befehl(1, { a:'ducken' });
  laufen(k, 20);
  assert.equal(k.b[1].hp, 100);
  const k2 = kampf({ gnade:0 });
  k2.befehl(0, { a:'schlag', art:'gerade', seite:'R' });
  laufen(k2, RF.ANGRIFFE.gerade.aus + 1);
  k2.befehl(1, { a:'ducken' });
  laufen(k2, 20);
  assert.equal(k2.b[1].hp, 94);
});

test('Niederschlag, Aufstehen durch Tippen, Technischer K.o. nach drei Niederschlägen', () => {
  const k = kampf();
  k.b[1].hp = 5;
  k.befehl(0, { a:'schlag', art:'gerade', seite:'R' });
  laufen(k, 20);
  assert.equal(k.phase, 'zaehlen');
  assert.equal(k.b[1].aktion, 'boden');
  for (let i = 0; i < 10; i++) k.befehl(1, { a:'tippen' });
  laufen(k, RF.s(3));
  assert.equal(k.phase, 'kampf');
  assert.ok(k.b[1].hp > 50);
  for (let n = 0; n < 2; n++) {
    k.b[1].hp = 1;
    k.befehl(0, { a:'schlag', art:'gerade', seite:'R' });
    laufen(k, 20);
    if (n === 0) { for (let i = 0; i < 18; i++) k.befehl(1, { a:'tippen' }); laufen(k, RF.s(3)); }
  }
  assert.equal(k.phase, 'ende');
  assert.deepEqual([k.ergebnis.sieger, k.ergebnis.art], [0, 'tko']);
});

test('Liegen bleiben bis zehn ist ein K.o.', () => {
  const k = kampf({ boxer:[{}, { hp:5 }] });
  k.befehl(0, { a:'schlag', art:'gerade', seite:'R' });
  laufen(k, RF.s(13));
  assert.deepEqual([k.ergebnis.sieger, k.ergebnis.art], [0, 'ko']);
});

test('Punktsieg nach Zeit, Verlängerung bei Gleichstand, erster Treffer entscheidet', () => {
  const k = kampf({ runden:1, dauer:2 });
  k.befehl(1, { a:'schlag', art:'koerper', seite:'L' });
  laufen(k, RF.s(2.2));
  assert.deepEqual([k.ergebnis.sieger, k.ergebnis.art], [1, 'punkte']);
  const v = kampf({ runden:1, dauer:1, verlaengerung:true });
  laufen(v, RF.s(1.1));
  assert.equal(v.phase, 'verlaengerung');
  v.befehl(0, { a:'schlag', art:'gerade', seite:'L' });
  laufen(v, 30);
  assert.deepEqual([v.ergebnis.sieger, v.ergebnis.art], [0, 'verlaengerung']);
});

test('Gleicher Startwert, gleiche Eingaben: gleicher Kampf (der Server kann nachrechnen)', () => {
  const a = kampfRechnen('leo', 'gold', spielerBot({ startwert:3 }), 99);
  const b = kampfRechnen('leo', 'gold', spielerBot({ startwert:3 }), 99);
  assert.deepEqual(a.ergebnis, b.ergebnis);
  assert.equal(JSON.stringify(a.zustand()), JSON.stringify(b.zustand()));
});

test('Netz-Zustand lässt sich zurückübersetzen', () => {
  const k = kampf();
  k.befehl(0, { a:'schlag', art:'haken', seite:'L' });
  laufen(k, 10);
  const b = RF.boxerAusZustand(k.zustand().b[0]);
  assert.equal(b.aktion, 'schlag'); assert.equal(b.a.art, 'haken'); assert.equal(b.seite, 'L'); assert.equal(b.t, k.b[0].t);
});

test('Jeder Computer-Gegner beendet seine Kämpfe in jeder Liga', () => {
  for (const liga of Object.keys(RF.LIGEN)) for (const g of RF.ligaGegner(liga)) {
    const k = kampfRechnen(g.id, liga, spielerBot({ startwert:g.id.length }), 5);
    assert.equal(k.phase, 'ende', `${g.id} ${liga}`);
  }
});

test('Weltmeister-Liga: neun Gegner, der letzte ist der Weltmeister', () => {
  assert.equal(RF.ligaGegner('welt').length, 9);
  assert.equal(RF.ligaGegner('gold').length, 8);
  assert.equal(RF.ligaGegner('welt')[8].id, 'vulkan');
  assert.ok(RF.gegnerWerte('vulkan', 'welt').hp > RF.gegnerWerte('leo', 'welt').hp);
  assert.ok(!RF.GEGNER.some(g => g.champion), 'der Weltmeister taucht nicht in den anderen Ligen auf');
});

test('Weltmeister: Vulkan-Serie und zweite Luft', () => {
  const gw = RF.gegnerWerte('vulkan', 'welt');
  gw.ki.vulkan = 1;
  const k = new RF.Kampf({ intro:0, boxer:[{ unverwundbar:true }, gw], startwert:3 });
  const arten = [];
  for (let i = 0; i < RF.s(6); i++) { k.schritt(); for (const e of k.ereignisse.splice(0)) if (e.typ === 'ausholen' && e.wer === 1) arten.push(e.art); }
  assert.deepEqual(arten.slice(0, 3), ['haken', 'aufwaerts', 'haken']);
  const k2 = new RF.Kampf({ intro:0, boxer:[{}, RF.gegnerWerte('vulkan', 'welt')], startwert:5 });
  k2.schritt();
  const tempo = k2.b[1].ki.tempo;
  k2.b[1].hp = Math.round(k2.b[1].hpMax * 0.4);
  laufen(k2, 3);
  assert.equal(ereignis(k2, 'zweiteLuft').length, 1);
  assert.ok(k2.b[1].ki.tempo < tempo, 'danach schneller');
  laufen(k2, 60);
  assert.equal(ereignis(k2, 'zweiteLuft').length, 1, 'nur einmal');
});

test('Aufstieg: Stufen, Werte und Ausrüstung', () => {
  assert.equal(RF.stufeAus(0), 1);
  assert.equal(RF.stufeAus(RF.epFuer(2)), 2);
  assert.equal(RF.stufeAus(RF.epFuer(2) - 1), 1);
  assert.equal(RF.stufeAus(1e9), RF.STUFE_MAX);
  // so viele Trainingspunkte wie Werte-Stufen
  assert.equal(RF.STUFE_MAX - 1, Object.values(RF.WERTE).reduce((a, w) => a + w.max, 0));
  assert.deepEqual(RF.spielerWerte(), { hp:100, schadenFaktor:1, pusteFaktor:1 });
  const w = RF.spielerWerte({ kraft:2, ausdauer:5, kondition:1 }, ['handschuhe1', 'handschuhe2', 'schutz1']);
  assert.equal(w.hp, Math.round(100 * 1.2 * 1.08));
  assert.ok(Math.abs(w.schadenFaktor - 1.06 * 1.10) < 1e-9, 'nur die besten Handschuhe zählen');
  assert.ok(Math.abs(w.pusteFaktor - 0.96) < 1e-9);
  assert.equal(RF.spielerWerte({ kraft:99 }).schadenFaktor, 1.15, 'Werte sind gedeckelt');
});

test('Spielerwerte wirken: Schaden, Puste und Startleben', () => {
  const k = kampf({ boxer:[{ schadenFaktor:1.5, pusteFaktor:0.5, hp:120, hpStart:70 }, {}] });
  assert.equal(k.b[0].hp, 70); assert.equal(k.b[0].hpMax, 120);
  k.befehl(0, { a:'schlag', art:'gerade', seite:'R' });
  laufen(k, 30);
  assert.equal(k.b[1].hp, 100 - 9);
  assert.equal(Math.round(k.b[0].puste * 10) / 10 < 100, true);
  assert.ok(100 - k.b[0].puste < RF.ANGRIFFE.gerade.puste, 'halbe Puste-Kosten');
});
