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
  for (const g of RF.GEGNER) for (const liga of Object.keys(RF.LIGEN)) {
    const k = kampfRechnen(g.id, liga, spielerBot({ startwert:g.id.length }), 5);
    assert.equal(k.phase, 'ende', `${g.id} ${liga}`);
  }
});
