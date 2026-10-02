'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const RF = require('../js/logik.js');
const { raeume } = require('../turnier.js');

const warte = ms => new Promise(ok => setTimeout(ok, ms));
const SCHNELL = { pause:30, nachKampf:10, weg:200, countdown:20, warten:150, duell:30 };

// Ein Browser: schickt Nachrichten, sammelt Antworten; ein einfacher Bot boxt, wenn er im Kampf ist
function client(r, name, opt = {}) {
  const inbox = [];
  const tr = { send:t => inbox.push(JSON.parse(t)), close:() => { tr.zu = true; } };
  const c = r.verbinden(tr);
  const zufall = RF.zufall(name.length * 7 + (opt.staerke || 1));
  const me = {
    inbox, tr, c, name,
    send:d => c.nachricht(JSON.stringify(d)),
    last:t => [...inbox].reverse().find(m => m.t === t),
    alle:t => inbox.filter(m => m.t === t),
    // Bot: im eigenen Kampf zufällig schlagen, am Boden tippen
    boxen() {
      const k = me.last('kampf');
      const z = me.last('z');
      if (!k || k.ecke == null || !z || z.id !== k.id) return;
      const ich = RF.boxerAusZustand(z.s.b[k.ecke]);
      if (ich.aktion === 'boden') { if (zufall() < 0.4) me.send({ t:'b', b:{ a:'tippen' } }); return; }
      if (zufall() < 0.03 * (opt.staerke || 1)) me.send({ t:'b', b:{ a:'schlag', art:['gerade', 'koerper', 'haken'][Math.floor(zufall() * 3)], seite:zufall() < 0.5 ? 'L' : 'R' } });
    }
  };
  me.send({ t:'hallo', name, preset:'mia', hose:'#123456', handschuhe:'#abcdef' });
  return me;
}

// Turnier laufen lassen, bis es vorbei ist (Takte sind Kampf-Sekunden/60, Pausen echte Millisekunden)
async function bisEnde(r, spieler, raumCode, maxTakte = 200_000) {
  for (let n = 0; n < maxTakte; n++) {
    r.takt();
    for (const s of spieler) s.boxen();
    if (n % 500 === 0) await warte(1);
    const raum = r.liste.get(raumCode);
    if (!raum || raum.phase !== 'turnier') { if (raum && raum.phase === 'ende') return raum; if (!raum) return null; }
    if (raum.baum && raum.baum.pauseBis) await warte(5);
  }
  throw new Error('Turnier nicht fertig geworden');
}

test('Turnier mit 6 Boxern: Freilose, Halbfinale, Platz 3, Finale, vollständige Platzierung', async () => {
  const r = raeume({ zufall:RF.zufall(42), zeiten:SCHNELL });
  const namen = ['Anna', 'Ben', 'Cem', 'Dana', 'Emil', 'Fee'];
  const sp = namen.map((n, i) => client(r, n, { staerke:1 + i * 0.3 }));
  sp[0].send({ t:'erstellen', art:'turnier', einst:{ dauer:60, platz3:1 } });
  const code = sp[0].last('raum').code;
  for (const s of sp.slice(1)) s.send({ t:'beitreten', code });
  assert.equal(sp[5].last('raum').mitglieder.length, 6);
  sp[1].send({ t:'start' });
  assert.equal(sp[1].last('baum'), undefined, 'nur der Gastgeber startet');
  sp[0].send({ t:'start' });
  const baum = sp[3].last('baum');
  assert.equal(baum.runden[0].length, 4);
  const freilose = baum.runden[0].filter(k => k.status === 'freilos');
  assert.equal(freilose.length, 2);
  assert.ok(Math.abs(baum.runden[0].indexOf(freilose[0]) - baum.runden[0].indexOf(freilose[1])) !== 1 || baum.runden[0].indexOf(freilose[0]) % 2 === 1, 'zwei Freilose treffen nicht gleich aufeinander');
  // Jeder Boxer im Kampf bekommt seinen Kampf mit Ecke, die anderen schauen zu
  const imKampf = sp.filter(s => s.last('kampf') && s.last('kampf').ecke != null);
  assert.equal(imKampf.length, 4);
  for (const s of sp.filter(x => !imKampf.includes(x))) assert.equal(s.last('kampf').ecke, null);
  const raum = await bisEnde(r, sp, code);
  const ende = sp[2].last('ende');
  assert.ok(ende, 'Ende-Nachricht');
  assert.equal(ende.platzierung.length, 6);
  assert.deepEqual(ende.platzierung.slice(0, 4).map(p => p.platz), [1, 2, 3, 4]);
  assert.equal(ende.platzierung[0].text, 'Turniersieg');
  assert.ok(raum.baum.platz3 && raum.baum.platz3.status === 'fertig', 'Kampf um Platz 3 wurde geboxt');
  const fin = raum.baum.runden[raum.baum.runden.length - 1][0];
  assert.equal(ende.platzierung[0].id, fin.sieger);
  // Zuschauer haben Zustände bekommen
  assert.ok(sp.every(s => s.alle('z').length > 50));
});

test('Duell: zwei Boxer, danach zurück in die Lobby für die Revanche', async () => {
  const r = raeume({ zufall:RF.zufall(3), zeiten:SCHNELL });
  const a = client(r, 'Anna', { staerke:2 }), b = client(r, 'Ben');
  a.send({ t:'erstellen', art:'duell' });
  const code = a.last('raum').code;
  a.send({ t:'start' });
  assert.match(a.last('fehler').text, /zwei/);
  b.send({ t:'beitreten', code });
  client(r, 'Cem').send({ t:'beitreten', code });
  a.send({ t:'start' });
  assert.equal(b.last('kampf').ecke, 1);
  await bisEnde(r, [a, b], code);
  assert.equal(a.last('ende').platzierung.length, 2);
  await warte(60);
  assert.equal(a.last('raum').phase, 'lobby');
});

test('Wer im Kampf die Verbindung verliert, steht in Deckung und gibt nach der Frist auf; mit Token kommt man zurück', async () => {
  const r = raeume({ zufall:RF.zufall(9), zeiten:{ ...SCHNELL, weg:300 } });
  const a = client(r, 'Anna'), b = client(r, 'Ben'), c = client(r, 'Cem');
  a.send({ t:'erstellen', art:'turnier' });
  const code = a.last('raum').code;
  b.send({ t:'beitreten', code }); c.send({ t:'beitreten', code });
  a.send({ t:'start' });
  const raum = r.liste.get(code);
  const k = raum.baum.runden[0].find(x => x.status === 'laeuft');
  const id = k.a, spieler = [a, b, c].find(s => s.last('du').id === id || s.c.mitglied.id === id);
  // Kurz weg und mit Token zurück
  spieler.c.getrennt();
  for (let i = 0; i < 300; i++) r.takt();
  assert.equal(k.kampf.b[0].block, true, 'abwesend: Deckung');
  const neu = client(r, spieler.name);
  neu.send({ t:'hallo', name:spieler.name, token:spieler.last('du').token, code });
  assert.equal(neu.last('kampf').id, k.id, 'zurück im eigenen Kampf');
  for (let i = 0; i < 10; i++) r.takt();
  assert.equal(k.kampf.b[0].block, false);
  // Jetzt richtig weg: nach der Frist Aufgabe
  neu.c.getrennt();
  await warte(320);
  for (let i = 0; i < 5; i++) r.takt();
  assert.equal(k.status, 'fertig');
  assert.equal(k.art, 'aufgabe');
  assert.equal(k.sieger, k.b);
});

test('Olympia: Gruppe trifft sich per Ticket, fehlt jemand, geht es nach der Wartezeit los; Rangliste geht an die Olympiade', async () => {
  const gemeldet = [], status = [];
  const olymp = {
    ticketPruefen:t => t === 'falsch' ? null : { l:'lauf1', g:0, s:t, n:t.toUpperCase(), m:['anna', 'ben', 'cem'].map(s => ({ s, n:s.toUpperCase() })), c:{ dauer:60, platz3:1 }, z:'http://o/', ti:'Olympiade TEST' },
    rangMelden:(t, rang) => gemeldet.push(rang),
    status:(t, da, phase) => status.push([da.length, phase])
  };
  const r = raeume({ zufall:RF.zufall(5), olymp, zeiten:SCHNELL });
  const x = client(r, 'x'); x.send({ t:'olymp', ticket:'falsch' });
  assert.ok(x.last('fehler').olymp);
  const a = client(r, 'Anna'), b = client(r, 'Ben');
  a.send({ t:'olymp', ticket:'anna' });
  b.send({ t:'olymp', ticket:'ben' });
  const raumA = a.last('raum');
  assert.equal(raumA.code, null, 'Olympia-Räume zeigen keinen Code');
  assert.deepEqual(b.last('raum').olymp.erwartet.map(e => e.da), [true, true, false]);
  assert.ok(b.last('raum').olymp.startIn > 0);
  await warte(200);
  const code = [...r.liste.keys()][0];
  assert.equal(r.liste.get(code).phase, 'turnier', 'nach der Wartezeit gestartet');
  const spaet = client(r, 'Cem'); spaet.send({ t:'olymp', ticket:'cem' });
  assert.match(spaet.last('fehler').text, /läuft schon/);
  await bisEnde(r, [a, b], code);
  assert.equal(gemeldet.length, 1);
  assert.equal(gemeldet[0].length, 2);
  assert.deepEqual(gemeldet[0].map(x => x.s).sort(), ['anna', 'ben']);
  assert.ok(gemeldet[0][0].wert > gemeldet[0][1].wert);
  assert.ok(status.some(([, p]) => p === 'laeuft'));
});

test('Olympia: kommt nur einer, gewinnt er kampflos (die Olympiade hängt nicht)', async () => {
  const gemeldet = [];
  const olymp = { ticketPruefen:t => ({ l:'lauf2', g:0, s:t, n:t, m:[{ s:'anna', n:'A' }, { s:'ben', n:'B' }], c:{} }), rangMelden:(t, rang) => gemeldet.push(rang), status:() => {} };
  const r = raeume({ olymp, zeiten:SCHNELL });
  const a = client(r, 'Anna'); a.send({ t:'olymp', ticket:'anna' });
  await warte(200);
  assert.equal(gemeldet.length, 1);
  assert.equal(gemeldet[0][0].s, 'anna');
  assert.ok(a.last('ende'));
});

test('Eingaben von außerhalb eines Kampfs werden ignoriert; nur erlaubte Schläge', () => {
  const r = raeume({ zeiten:SCHNELL });
  const a = client(r, 'Anna'), b = client(r, 'Ben');
  a.send({ t:'erstellen', art:'duell' }); b.send({ t:'beitreten', code:a.last('raum').code });
  b.send({ t:'b', b:{ a:'schlag', art:'gerade', seite:'L' } });
  a.send({ t:'start' });
  const raum = [...r.liste.values()][0];
  const k = raum.baum.runden[0][0];
  for (let i = 0; i < RF.s(3.2); i++) r.takt();
  const ecke = k.a === a.c.mitglied.id ? 0 : 1;
  a.send({ t:'b', b:{ a:'schlag', art:'ramm', seite:'L', tempo:0.01 } });
  for (let i = 0; i < 5; i++) r.takt();
  assert.notEqual(k.kampf.b[ecke].aktion, 'schlag', 'Rammschlag gibt es nur für den Computer');
  a.send({ t:'b', b:{ a:'schlag', art:'gerade', seite:'L', tempo:0.01 } });
  for (let i = 0; i < 3; i++) r.takt();
  assert.equal(k.kampf.b[ecke].aktion, 'schlag');
  assert.equal(k.kampf.b[ecke].a.aus, RF.ANGRIFFE.gerade.aus, 'Tempo vom Browser wird nicht übernommen');
});

test('Jede Teilnehmerzahl von 2 bis 16 ergibt ein vollständiges Turnier', async () => {
  for (const n of [2, 3, 4, 5, 7, 8, 9, 12, 16]) {
    const r = raeume({ zufall:RF.zufall(n * 13), zeiten:SCHNELL });
    const sp = Array.from({ length:n }, (_, i) => client(r, 'Boxer' + i, { staerke:1 + (i % 4) * 0.4 }));
    sp[0].send({ t:'erstellen', art:'turnier', einst:{ dauer:60, platz3:n % 2 } });
    const code = sp[0].last('raum').code;
    for (const s of sp.slice(1)) s.send({ t:'beitreten', code });
    sp[0].send({ t:'start' });
    await bisEnde(r, sp, code);
    const p = sp[n - 1].last('ende').platzierung;
    assert.equal(p.length, n, `n=${n}`);
    assert.equal(new Set(p.map(x => x.id)).size, n);
    for (let i = 1; i < n; i++) assert.ok(p[i].platz >= p[i - 1].platz && p[i].wert <= p[i - 1].wert, `n=${n} Reihenfolge`);
    assert.equal(p[0].platz, 1); assert.equal(p[1].platz, 2);
  }
});
