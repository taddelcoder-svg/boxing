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
for (const liga of Object.keys(RF.LIGEN)) {
  console.log(`\n${RF.LIGEN[liga].name}`.padEnd(10) + RF.GEGNER.map(g => g.kurz.padStart(8)).join(''));
  for (const [name, w] of Object.entries(KOENNEN)) {
    const zeile = RF.GEGNER.map(g => {
      let siege = 0, dauer = 0;
      for (let i = 0; i < N; i++) {
        const k = kampfRechnen(g.id, liga, spielerBot({ ...w, startwert:i * 31 + 1 }), i * 7 + 3);
        if (k.ergebnis.sieger === 0) siege++;
        dauer += k.tick / RF.TAKT;
      }
      return `${Math.round(siege / N * 100)}%`.padStart(8);
    });
    console.log(name.padEnd(10) + zeile.join(''));
  }
}
