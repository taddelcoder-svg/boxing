'use strict';
// Ein Bot, der wie ein Mensch spielt: sieht das Ausholen erst nach seiner Reaktionszeit, wehrt mit
// einer gewissen Trefferquote richtig ab, kontert offene Gegner und schlägt zwischendurch selbst.
// Für Balance-Tests und für die Turnier-Tests mit Bot-Clients.
const RF = require('../js/logik.js');

function spielerBot({ reaktion = 0.3, genau = 0.7, angriffe = 0.9, startwert = 7 } = {}) {
  const r = RF.zufall(startwert);
  let gesehen = -1, plan = null, naechsterAngriff = 0, konterGesehen = false;
  // b: eigener Boxer, g: Gegner (gleiche Felder wie in RF.Kampf), tick: aktueller Takt
  // Rückgabe: Liste von Befehlen
  return function denken(b, g, tick, phase) {
    const aus = [];
    if (phase === 'zaehlen') { if (b.aktion === 'boden' && r() < 0.5) aus.push({ a:'tippen' }); return aus; }
    if (phase !== 'kampf' && phase !== 'verlaengerung') return aus;
    if (plan && tick >= plan.bei) { aus.push(plan.befehl); plan = null; }
    if (b.block && !(g.aktion === 'schlag' && g.t < g.a.aus + 6)) aus.push({ a:'block', an:false });
    if (g.aktion === 'schlag' && g.a && g.t < g.a.aus && g.angriffNr !== gesehen) {
      const sicht = RF.s(reaktion * (0.8 + r() * 0.4));
      if (g.t >= sicht) {
        gesehen = g.angriffNr;
        const A = RF.ANGRIFFE[g.a.art];
        if (r() < genau) {
          if (A.unten || A.ramm) aus.push({ a:'ausweichen', seite:r() < 0.5 ? 'L' : 'R' });
          else if (A.haken) aus.push(r() < 0.6 ? { a:'ducken' } : { a:'ausweichen', seite:g.seite });
          else if (r() < 0.4) aus.push({ a:'block', an:true });
          else aus.push({ a:'ausweichen', seite:r() < 0.5 ? 'L' : 'R' });
        } else {
          const w = r();
          aus.push(w < 0.33 ? { a:'ducken' } : w < 0.66 ? { a:'ausweichen', seite:r() < 0.5 ? 'L' : 'R' } : { a:'block', an:true });
        }
      }
    }
    if (g.aktion === 'offen' && !konterGesehen) {
      konterGesehen = true;
      if (r() < genau) {
        const bei = tick + RF.s(reaktion * 0.8);
        plan = { bei, befehl:b.sterne >= 2 ? { a:'stern' } : { a:'schlag', art:r() < 0.5 ? 'haken' : 'gerade', seite:r() < 0.5 ? 'L' : 'R' } };
      }
    }
    if (g.aktion !== 'offen') konterGesehen = false;
    if ((b.aktion === 'bereit') && g.aktion !== 'schlag' && tick >= naechsterAngriff && r() < angriffe / 30) {
      naechsterAngriff = tick + RF.s(0.6);
      const w = r();
      aus.push(b.sterne >= 3 ? { a:'stern' } : { a:'schlag', art:w < 0.45 ? 'gerade' : w < 0.8 ? 'koerper' : 'haken', seite:r() < 0.5 ? 'L' : 'R' });
    }
    return aus;
  };
}

// Einen ganzen Kampf rechnen: Spieler-Bot (Ecke 0) gegen Computer-Gegner (Ecke 1)
function kampfRechnen(gegner, liga, bot, startwert, opt = {}) {
  const k = new RF.Kampf({ boxer:[{}, RF.gegnerWerte(gegner, liga)], startwert, ...opt });
  let n = 0;
  while (k.phase !== 'ende' && n < RF.s(60 * 12)) {
    for (const b of bot(k.b[0], k.b[1], k.tick, k.phase)) k.befehl(0, b);
    k.schritt(); n++;
  }
  return k;
}

module.exports = { spielerBot, kampfRechnen };
