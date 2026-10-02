/* Ringfieber – Ton, komplett im Browser erzeugt (Web Audio). Bewusst kurz und zurückhaltend;
   ausschaltbar, die Wahl wird gespeichert. */
'use strict';

const Ton = (() => {
  let ctx = null, haupt = null, menge = null, mengeGain = null, rauschen = null;
  let an = true;
  try { an = localStorage.getItem('rf-ton') !== 'aus'; } catch (_) { /* egal */ }

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    haupt = ctx.createGain(); haupt.gain.value = an ? 0.55 : 0;
    const kompressor = ctx.createDynamicsCompressor();
    kompressor.threshold.value = -14; kompressor.ratio.value = 4;
    haupt.connect(kompressor); kompressor.connect(ctx.destination);
    // Rauschen als Grundlage für Publikum, Luftzug und Lederklatschen
    const n = ctx.sampleRate * 2;
    rauschen = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = rauschen.getChannelData(0);
    let braun = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; braun = (braun + 0.02 * w) / 1.02; d[i] = i % 2 ? w * 0.5 : braun * 3.5; }
    // Publikum: gefiltertes Rauschen, Lautstärke folgt der Aufregung
    menge = ctx.createBufferSource(); menge.buffer = rauschen; menge.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const bp = ctx.createBiquadFilter(); bp.type = 'peaking'; bp.frequency.value = 350; bp.gain.value = 6;
    mengeGain = ctx.createGain(); mengeGain.gain.value = 0;
    menge.connect(lp); lp.connect(bp); bp.connect(mengeGain); mengeGain.connect(haupt);
    menge.start();
  }

  function setzen(wert) {
    an = wert;
    try { localStorage.setItem('rf-ton', an ? 'an' : 'aus'); } catch (_) { /* egal */ }
    if (haupt) haupt.gain.setTargetAtTime(an ? 0.55 : 0, ctx.currentTime, 0.05);
  }

  const bereit = () => ctx && an && ctx.state === 'running';
  function huelle(g, t, a, spitze, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(spitze, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function osz(typ, f0, f1, dauer, spitze, verz = 0) {
    const t = ctx.currentTime + verz, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = typ; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dauer);
    huelle(g, t, 0.004, spitze, dauer);
    o.connect(g); g.connect(haupt); o.start(t); o.stop(t + dauer + 0.05);
  }
  function rausch(filter, frequenz, q, dauer, spitze, bisFrequenz, verz = 0) {
    const t = ctx.currentTime + verz, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = rauschen; f.type = filter; f.frequency.setValueAtTime(frequenz, t); f.Q.value = q;
    if (bisFrequenz) f.frequency.exponentialRampToValueAtTime(bisFrequenz, t + dauer);
    huelle(g, t, 0.003, spitze, dauer);
    s.connect(f); f.connect(g); g.connect(haupt);
    s.start(t, Math.random() * 1.5); s.stop(t + dauer + 0.05);
  }

  return {
    start, setzen, get an() { return an; },
    // Treffer: dumpfer Schlag mit Lederklatschen, schwere Treffer mit Bass
    schlag(staerke = 0.5, kopf = true) {
      if (!bereit()) return;
      osz('sine', kopf ? 140 : 105, 42, 0.16 + staerke * 0.1, 0.55 + staerke * 0.35);
      rausch('bandpass', kopf ? 1500 : 900, 0.9, 0.06, 0.35 + staerke * 0.25);
      if (staerke > 0.6) osz('sine', 70, 30, 0.35, 0.5 * staerke);
    },
    block() { if (!bereit()) return; osz('triangle', 230, 140, 0.08, 0.3); rausch('highpass', 2200, 0.7, 0.04, 0.18); },
    wusch() { if (!bereit()) return; rausch('bandpass', 380, 1.4, 0.2, 0.22, 1900); },
    // Ringglocke: kurzer Ding mit Obertönen, am Rundenende dreimal
    gong(mal = 1) {
      if (!bereit()) return;
      for (let i = 0; i < mal; i++) for (const [f, v] of [[720, 0.28], [1987, 0.12], [3890, 0.05]]) osz('sine', f, f * 0.995, 1.4, v, i * 0.32);
    },
    zaehlen(n) { if (!bereit()) return; osz('square', n >= 10 ? 520 : 760, n >= 10 ? 500 : 750, 0.09, 0.07); },
    stern() { if (!bereit()) return; [990, 1320, 1760].forEach((f, i) => osz('triangle', f, f, 0.12, 0.12, i * 0.06)); },
    klick() { if (!bereit()) return; osz('triangle', 900, 600, 0.04, 0.08); },
    fehler() { if (!bereit()) return; osz('square', 220, 180, 0.12, 0.06); },
    // Publikum: Grundrauschen nach Aufregung, Aufschrei bei großen Momenten
    publikum(aufregung) { if (ctx && mengeGain) mengeGain.gain.setTargetAtTime(an ? Math.min(0.32, 0.035 + aufregung * 0.12) : 0, ctx.currentTime, 0.25); },
    aufschrei(st = 1) {
      if (!bereit()) return;
      rausch('bandpass', 600, 0.6, 1.4 * st, 0.32 * st, 900);
      rausch('lowpass', 500, 0.5, 1.8 * st, 0.25 * st);
    }
  };
})();
