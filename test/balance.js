'use strict';
// Balance-Übersicht: Spieler-Bots mit unterschiedlichem Können gegen alle Gegner in allen Ligen.
// Aufruf: node test/balance.js [kämpfe pro Paarung]
const RF = require('../js/logik.js');
const { spielerBot, kampfRechnen } = require('./spielerbot.js');

const N = Number(process.argv[2]) || 40;
const KOENNEN = {
  anfaenger: { reaktion:0.38, genau:0.5, angriffe:0.8 },
  mittel:    { reaktion:0.3,  genau:0.72, angriffe:1.0 },
  gut:       { reaktion:0.24, genau:0.88, angriffe:1.2 }
};
// Gold und Weltmeister zusätzlich mit voll ausgebautem Boxer (alle Werte, beste Ausrüstung)
const VOLL = RF.spielerWerte({ kraft:5, ausdauer:5, kondition:5 }, RF.AUSRUESTUNG.map(a => a.id));
const TABELLEN = Object.keys(RF.LIGEN).map(liga => ({ liga, spieler:null }))
  .concat([{ liga:'gold', spieler:VOLL }, { liga:'welt', spieler:VOLL }]);
for (const { liga, spieler } of TABELLEN) {
  const gegner = RF.ligaGegner(liga);
  console.log(`\n${RF.LIGEN[liga].name}${spieler ? ' (ausgebaut)' : ''}`.padEnd(24) + gegner.map(g => g.kurz.padStart(8)).join(''));
  for (const [name, w] of Object.entries(KOENNEN)) {
    const zeile = gegner.map(g => {
      let siege = 0, dauer = 0;
      for (let i = 0; i < N; i++) {
        const k = kampfRechnen(g.id, liga, spielerBot({ ...w, startwert:i * 31 + 1 }), i * 7 + 3, { spieler });
        if (k.ergebnis.sieger === 0) siege++;
        dauer += k.tick / RF.TAKT;
      }
      return `${Math.round(siege / N * 100)}%`.padStart(8);
    });
    console.log(name.padEnd(24) + zeile.join(''));
  }
}
