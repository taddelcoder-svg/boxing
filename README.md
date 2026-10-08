# Ringfieber – Arcade-Boxen

Boxen aus der Ich-Sicht im Browser (three.js): Lies den Gegner, weich aus – und schlag zurück, solange er offen ist.
Eigene Figuren und eigener Name (Vorbild ist das Spielgefühl von Punch-Out, ohne dessen Figuren).

## Modi

- **Karriere:** vier Ligen (Bronze, Silber, Gold, Weltmeister) mit je acht Gegnern, einer nach dem anderen. In der
  Weltmeister-Liga folgt als neunter der **Titelkampf** gegen Viktor „Vulkan“ Varga (Vulkan-Serie: Haken, Aufwärtshaken,
  Haken; unter halber Kraft einmal „zweite Luft“). Ligasiege schalten Farben frei, der Titel den Weltmeister-Gürtel.
- **Schnellkampf:** jeder Gegner in jeder Liga, drei Runden (der Weltmeister erst nach dem Titel).
- **Ausdauer:** Gegner um Gegner, je eine Runde, die Lebenskraft nimmt man mit (+20 % nach jedem Sieg); Bronze → Weltmeister.
- **Trainingslager:** Muster-Training (man kann nicht verlieren, bei jedem Ausholen steht da, was hilft, mit Zeitlupe),
  **Pratzen** (30 s den gerufenen Schlag treffen) und **Ausweich-Drill** (30 s ausweichen gegen Dauerfeuer).
- **Aufstieg & Ausrüstung:** Kämpfe gegen den Computer bringen Erfahrung und Münzen. Jede Stufe (bis 16) gibt einen
  Trainingspunkt für Kraft, Ausdauer oder Kondition; Münzen kaufen Handschuhe, Schuhe und Mundschutz. Gilt **nur gegen
  den Computer** – online und in der Olympiade boxen alle gleich stark. Gespeichert in localStorage (`rf-aufstieg`).
- **Online:** Duell (1 gegen 1, mit Revanche) oder **K.-o.-Turnier** für 2–16 Leute per Raumcode bzw. Einladungslink.
  Alle Kämpfe einer Runde laufen gleichzeitig, wer frei hat oder raus ist, schaut zu; Freilose, Kampf um Platz 3.
- **Olympiade:** Disziplin der Swimming-Lions-Olympiade (Ticket-Link `?olymp=…`). Die ganze Gruppe landet in einem
  Turnier; sind alle da, geht es nach 6 Sekunden los, fehlt jemand, spätestens nach 90 Sekunden. Die Platzierung geht
  an die Olympiade (Plätze 1–4 aus Finale und Kampf um Platz 3, dahinter erreichte Runde und ausgeteilter Schaden).

## Regeln (kurz)

Jeder Schlag hat ein sichtbares Ausholen (der Handschuh leuchtet). Gerade: ausweichen, ducken oder Deckung.
Körpertreffer: ausweichen oder Deckung. Haken: ducken oder weg vom leuchtenden Handschuh ausweichen.
Aufwärtshaken/Volltreffer: nur zur Seite ausweichen. Nach einem verfehlten Schlag ist der Angreifer offen –
Konter zählen mehr, betäuben länger und bringen einen Stern. Sterne machen den Volltreffer stärker.
Wer zu einem schweren Schlag ausholt, steckt leichte Treffer weg. Am Boden: schnell tippen. Drei Niederschläge
in einer Runde = technischer K.o.; nach Ablauf zählt der ausgeteilte Schaden (im Turnier gibt es dann Verlängerung).

## Steuerung

- **Tastatur:** A/D ausweichen, S ducken, W Deckung (halten), J/K Gerade, U/I Haken, N/M Körper, Leertaste Volltreffer, Esc Pause.
- **Touch:** links wischen = ausweichen/ducken, links halten = Deckung; rechte Fäuste: tippen = Gerade, hoch = Haken, runter = Körper; ★ = Volltreffer.
- **Controller:** Stick ausweichen/ducken, LB Deckung, X/B Gerade, Y Haken, A Körper, RB Volltreffer.

## Technik

- `js/logik.js` – Kampfregeln, Gegner-Verhalten, Ligen, Figuren-Daten. Rein und deterministisch (60 Takte/s, eigener
  Zufall): läuft im Browser (Solo) und auf dem Server (Online) gleich. Ein Gnadenfenster von 5 Takten gleicht online die Verzögerung aus.
- `turnier.js` – Räume, Duelle, K.-o.-Turniere, Zuschauen, Wiederverbinden, Olympia. Der Server rechnet jeden Kampf,
  die Browser schicken nur Eingaben – kein Gastgeber-Browser, der alle aufhalten kann.
- `server.js` – Auslieferung, Passwort-Tor (`zugang.js`), WebSocket `/ws`, 60-Hz-Takt.
- `js/figuren.js` (Boxer aus Grundkörpern, Arme/Beine per IK), `js/arena.js` (Halle, Publikum, Licht, Kameras),
  `js/eingabe.js`, `js/ton.js` (alles im Browser erzeugt, abschaltbar), `js/spiel.js` (Menüs, Modi, Anzeige).
- three.js r128 und die Schrift Barlow Semi Condensed liegen in `vendor/` (keine Verbindung zu fremden Diensten).
- `olymp.js` und `zugang.js` sind die Vorlagen aus `olympiade/geteilt/`; bei Änderungen dort hierher kopieren.

## Lokal

```bash
npm install
npm start
```

Dann http://localhost:10800 (Startbefehl „ringfieber“ in `.claude/launch.json`). Ohne `ZUGANG_PASSWORT` ist es lokal offen.

Tests: `npm test` (Regeln und Turnier-Server), Balance-Übersicht der Computer-Gegner: `npm run balance`.
Debug im Browser: `ringfieber.starten('karriere', 'vulkan', 'welt')`, `ringfieber.starten('pratzen')`, `ringfieber.aufstieg`, `ringfieber.sim(sekunden)`, `ringfieber.solo.kampf`.

## Render

Docker-Dienst per `render.yaml` (Blueprint). Umgebungsvariable `ZUGANG_PASSWORT` – dasselbe Passwort wie bei den
anderen Spielen und der Olympiade, denn daraus wird auch der Schlüssel für die Olympia-Tickets abgeleitet.
