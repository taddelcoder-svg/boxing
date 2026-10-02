/* Ringfieber – Eingabe: Tastatur, Controller und Touch werden zu Befehlen für den Kampf.
   Befehle: { a:'ausweichen', seite }, { a:'ducken' }, { a:'block', an }, { a:'schlag', art, seite }, { a:'stern' },
   dazu { a:'pause' } und { a:'roh' } (jede Taste / jeder Tipp – zum Aufstehen am Boden). 'L'/'R' = eigene Seite. */
'use strict';

const Eingabe = (() => {
  let ziel = () => {}, aktiv = false;
  const senden = b => { if (aktiv || b.a === 'pause') ziel(b); };

  /* ---------- Tastatur ---------- */
  const TASTEN = {
    KeyA:{ a:'ausweichen', seite:'L' }, ArrowLeft:{ a:'ausweichen', seite:'L' },
    KeyD:{ a:'ausweichen', seite:'R' }, ArrowRight:{ a:'ausweichen', seite:'R' },
    KeyS:{ a:'ducken' }, ArrowDown:{ a:'ducken' },
    KeyW:{ a:'block' }, ArrowUp:{ a:'block' },
    KeyJ:{ a:'schlag', art:'gerade', seite:'L' }, KeyK:{ a:'schlag', art:'gerade', seite:'R' },
    KeyU:{ a:'schlag', art:'haken', seite:'L' }, KeyI:{ a:'schlag', art:'haken', seite:'R' },
    KeyN:{ a:'schlag', art:'koerper', seite:'L' }, KeyM:{ a:'schlag', art:'koerper', seite:'R' },
    Space:{ a:'stern' }, KeyL:{ a:'stern' },
    Escape:{ a:'pause' }, KeyP:{ a:'pause' }
  };
  addEventListener('keydown', e => {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const b = TASTEN[e.code];
    if (!b) return;
    if (aktiv) e.preventDefault();
    if (e.repeat) return;
    if (b.a !== 'pause') senden({ a:'roh' });
    senden(b.a === 'block' ? { a:'block', an:true } : { ...b });
  });
  addEventListener('keyup', e => {
    const b = TASTEN[e.code];
    if (b && b.a === 'block') senden({ a:'block', an:false });
  });
  addEventListener('blur', () => senden({ a:'block', an:false }));

  /* ---------- Controller ---------- */
  const vorher = { knoepfe:[], links:false, rechts:false, unten:false, block:false };
  let wechselK = 0, wechselH = 0;
  function abfragen() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = [...pads].find(x => x && x.connected);
    if (!p) return;
    const k = i => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));
    const neu = i => k(i) && !vorher.knoepfe[i];
    const x = p.axes[0] || 0, y = p.axes[1] || 0;
    const links = x < -0.6 || k(14), rechts = x > 0.6 || k(15), unten = y > 0.6 || k(13), oben = y < -0.6 || k(12);
    for (let i = 0; i < 16; i++) if (neu(i) && i !== 9) { senden({ a:'roh' }); break; }
    if (links && !vorher.links) senden({ a:'ausweichen', seite:'L' });
    if (rechts && !vorher.rechts) senden({ a:'ausweichen', seite:'R' });
    if (unten && !vorher.unten) senden({ a:'ducken' });
    const block = k(4) || k(6);
    if (block !== vorher.block) senden({ a:'block', an:block });
    if (neu(2)) senden({ a:'schlag', art:oben ? 'haken' : 'gerade', seite:'L' });
    if (neu(1)) senden({ a:'schlag', art:oben ? 'haken' : 'gerade', seite:'R' });
    if (neu(0)) { wechselK = 1 - wechselK; senden({ a:'schlag', art:'koerper', seite:wechselK ? 'L' : 'R' }); }
    if (neu(3)) { wechselH = 1 - wechselH; senden({ a:'schlag', art:'haken', seite:wechselH ? 'L' : 'R' }); }
    if (neu(5) || neu(7)) senden({ a:'stern' });
    if (neu(9)) senden({ a:'pause' });
    Object.assign(vorher, { links, rechts, unten, block });
    vorher.knoepfe = p.buttons.map((b, i) => k(i));
  }

  /* ---------- Touch ----------
     Links: wischen = ausweichen (links/rechts) oder ducken (runter), halten = Deckung.
     Rechts: zwei Fäuste. Tippen = Gerade, nach oben wischen = Haken, nach unten = Körpertreffer. */
  const WISCH = 26, HALTEN_MS = 160;
  function touchEinrichten(root) {
    const zone = root.querySelector('#tZone'), stern = root.querySelector('#tStern'), pause = root.querySelector('#tPause');
    const finger = new Map();
    zone.addEventListener('pointerdown', e => {
      e.preventDefault();
      senden({ a:'roh' });
      const f = { x:e.clientX, y:e.clientY, getan:false, block:false };
      f.uhr = setTimeout(() => { if (!f.getan) { f.block = true; f.getan = true; senden({ a:'block', an:true }); zone.classList.add('block'); } }, HALTEN_MS);
      finger.set(e.pointerId, f);
    });
    zone.addEventListener('pointermove', e => {
      const f = finger.get(e.pointerId); if (!f || f.getan) return;
      const dx = e.clientX - f.x, dy = e.clientY - f.y;
      if (Math.abs(dx) > WISCH && Math.abs(dx) > Math.abs(dy)) { f.getan = true; clearTimeout(f.uhr); senden({ a:'ausweichen', seite:dx < 0 ? 'L' : 'R' }); }
      else if (dy > WISCH) { f.getan = true; clearTimeout(f.uhr); senden({ a:'ducken' }); }
    });
    const losZone = e => {
      const f = finger.get(e.pointerId); if (!f) return;
      clearTimeout(f.uhr); finger.delete(e.pointerId);
      if (f.block) { senden({ a:'block', an:false }); zone.classList.remove('block'); }
    };
    zone.addEventListener('pointerup', losZone); zone.addEventListener('pointercancel', losZone);

    for (const knopf of root.querySelectorAll('.faust')) {
      const seite = knopf.dataset.seite;
      const f = new Map();
      knopf.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        senden({ a:'roh' });
        knopf.setPointerCapture && knopf.setPointerCapture(e.pointerId);
        f.set(e.pointerId, { x:e.clientX, y:e.clientY, getan:false });
        knopf.classList.add('an');
      });
      knopf.addEventListener('pointermove', e => {
        const s = f.get(e.pointerId); if (!s || s.getan) return;
        const dy = e.clientY - s.y;
        if (dy < -WISCH) { s.getan = true; senden({ a:'schlag', art:'haken', seite }); }
        else if (dy > WISCH) { s.getan = true; senden({ a:'schlag', art:'koerper', seite }); }
      });
      const los = e => {
        const s = f.get(e.pointerId); if (!s) return;
        f.delete(e.pointerId); knopf.classList.remove('an');
        if (!s.getan && e.type === 'pointerup') senden({ a:'schlag', art:'gerade', seite });
      };
      knopf.addEventListener('pointerup', los); knopf.addEventListener('pointercancel', los);
    }
    stern.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); senden({ a:'roh' }); senden({ a:'stern' }); });
    pause.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); senden({ a:'pause' }); });
  }

  return {
    setzen(fn) { ziel = fn; },
    aktiv(wert) { aktiv = wert; if (!wert) ziel({ a:'block', an:false }); },
    abfragen, touchEinrichten,
    istTouch:() => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
  };
})();
