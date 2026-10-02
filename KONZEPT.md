# Ringfieber – Konzept

Arcade-Boxen im Browser für die Swimming-Lions-Sammlung und als neue Olympia-Disziplin.
Vorbild ist das Gefühl von Punch-Out (Muster lesen, ausweichen, kontern) – mit eigenem Namen,
eigenen Figuren und eigenem Look, ohne Nintendo-Figuren oder -Namen.

Entschieden (2026-10-02): Name **Ringfieber**, **menschliche Figuren**, Spielerfigur aus **Presets**,
Olympia als **K.-o.-Turnier gegeneinander**.

**Stand 2026-10-02: alles aus dem Fahrplan (0.1–0.5) ist umgesetzt** – siehe README. Abweichung vom Konzept:
Kampfansicht in der Ich-Sicht (Kamera im eigenen Kopf, eigene Handschuhe unten), weil der eigene Boxer von hinten
den Gegner verdeckt hat.

---

## 1. Kernidee in einem Satz

Du stehst von hinten gesehen im Ring, der Gegner groß vor dir. Jeder Gegner hat Angriffsmuster mit
deutlichen Vorzeichen. Wer sie liest, weicht aus, kontert im richtigen Moment und haut ihn um.
Es geht um **Timing und Lesen, nicht um Knöpfe hämmern** – deshalb eignet es sich gut als Wettkampf.

## 2. Warum dieser Stil (und nicht Fighting-Game von der Seite)

- **Handy-tauglich:** Zwei Schlag-Knöpfe + Wischen zum Ausweichen reichen. Kein Combo-Lernen.
- **Gut gegeneinander:** Auch Menschen-Schläge haben ein kurzes, sichtbares Ausholen. Wer den
  anderen liest, gewinnt – nicht wer schneller tippt. Das macht das K.-o.-Turnier spannend.
- **Kein Host-Problem:** Der Server rechnet jeden Kampf selbst (nicht ein Spieler-Browser). Legt
  jemand sein Handy weg, steht nur sein eigener Boxer still – kein Gastgeber, der alle aufhält.
- **3D bleibt klein:** Eine Arena, zwei Figuren, feste Kamera → läuft auch auf schwachen Handys.

## 3. Steuerung

| Aktion | Tastatur | Touch | Controller |
|---|---|---|---|
| Ausweichen links/rechts | A / D | links wischen ← → | Stick ← → |
| Ducken | S | links wischen ↓ | Stick ↓ |
| Blocken | W halten | links halten | Stick ↑ / LB |
| Linker / rechter Schlag (Körper) | J / K | rechte Knöpfe L / R | X / B |
| Schlag zum Kopf | W + J/K | Knopf nach oben wischen | Stick ↑ + Schlag |
| Volltreffer (Spezial) | Leertaste | großer Stern-Knopf | Y |

Touch wie bei Löwen-Kart: ein Vollbild-Layer `#touch`, links Bewegungszone, rechts Schlagzone.

## 4. Regeln & Systeme

- **Runden:** 3 Runden à 60 Sek. (einstellbar). KO, technischer KO (3 Niederschläge in einer
  Runde) oder Punktentscheidung der Ringrichter.
- **Lebensbalken** für beide. Am Boden: Ringrichter zählt, Aufstehen durch schnelles Tippen
  (wird mit jedem Niederschlag schwerer).
- **Puste (Ausdauer):** Jeder Schlag kostet Puste, getroffen werden auch. Bei 0 bist du kurz
  „platt“ (langsamer, kein Schlag) – verhindert Dauerhämmern.
- **Block:** Schlägt der Gegner in die Deckung, kostet dich das nur Puste, kein Leben. Gegner
  blocken auch – Schläge in die Deckung prallen ab.
- **Konterfenster:** Nach einem gut getimten Ausweichen ist der Gegner kurz offen (Zeitlupe-Flash
  + Ton). Treffer im Fenster zählen doppelt und laden die **Sterne**.
- **Sterne / Volltreffer:** Bis zu 3 Sterne sammeln (perfekte Konter, Treffer in Vorzeichen).
  Ein Volltreffer mit 1 Stern = schwer, mit 3 = fast KO. Getroffen werden kostet einen Stern.
- **Vorzeichen (Tells):** Jeder Gegnerangriff hat eine sichtbare Ankündigung (Augen blitzen,
  Ausholen, Glove leuchtet, Geräusch). Schwierigkeit verkürzt die Ankündigung, nicht die Fairness.
- **Mensch gegen Mensch:** Dieselben Regeln für beide Seiten. Jeder Schlag hat ein festes Ausholen
  (Jab ~0,25 s, Haken ~0,45 s, Volltreffer ~0,7 s), in dem man ihn sieht und ausweichen kann.
  Jeder sieht sich selbst von hinten, den Gegner von vorn – der Server dreht die Sicht nur um.

## 5. Gegner (8 eigene Figuren, Menschen)

Überzeichnete Karikaturen mit klarer Silhouette und Farbe, damit man sie auch auf dem Handy sofort
erkennt. Keine echten Boxer als Vorbild, keine Nationalitäten-Klischees als Gag.

| # | Name | Typ | Eigenart | Lernt dir |
|---|---|---|---|---|
| 1 | Bruno „Bulldozer“ Brandt | breiter Hafenarbeiter | langsam, lange Vorzeichen, schwerer Haken | Ausweichen + Kontern |
| 2 | Kiki Kessler | flinke Kickboxerin, Zopf | schnelle Doppel-Jabs | Blocken statt Ausweichen |
| 3 | Finn „Fuchs“ Falk | Showman mit Sonnenbrille | Finten – holt aus, schlägt nicht | Nicht zu früh reagieren |
| 4 | Flora Funke | sehr groß, lange Arme | Schlag kommt von oben | Ducken |
| 5 | Nero Nagel | Glatze, Stiernacken | Anlauf-Rammschlag, danach lange offen | Großes Konterfenster nutzen |
| 6 | Gustav „Gorilla“ Grimm | Kraftprotz mit Bart | lädt Kraft auf, Wut-Serie nach 3 Treffern | Serien lesen |
| 7 | Otto Okta | Akrobat, wechselt die Auslage | Links/rechts-Wechsel mitten im Angriff | Seiten lesen |
| 8 | Leo König | amtierender Champion, goldener Gürtel | mischt alles + eigener Volltreffer | Alles |

### Eigene Figur: Presets

Kein freier Editor, sondern **8 fertige Boxer zur Auswahl** (je 4 Frauen und Männer, verschiedene
Statur, Hautfarbe und Frisur). Dazu wählbar: **Farbe von Hose und Handschuhen** (6 Farben, darunter
Swimming-Lions-Blau). Alle Presets spielen sich gleich – nur Aussehen, keine Werte, damit es in der
Olympiade fair bleibt. Weitere Hosen/Handschuhe schaltet die Karriere frei.

Gegner-Verhalten als **Musterlisten in einer reinen Logikdatei** (`logik.js`, wie bei Weltreiche):
Zustände `warten → vorzeichen → schlag → erholung`, Auswahl über festen Zufallsstartwert.

## 6. Modi

1. **Karriere (Solo):** Rangliste der 8 Gegner, drei Ligen (Bronze/Silber/Gold) mit schärferen
   Mustern. Fortschritt in localStorage, wie Iron-Horizon-Karriere. Freischaltbare Hosen/Handschuhe.
2. **Training:** Sandsack + „Muster-Puppe“, die einen Gegner-Angriff in Zeitlupe zeigt.
3. **Online-Duell 1 gegen 1:** Raumcode wie überall. Server rechnet (Node, 30 Hz, gleiche
   `logik.js`), Clients schicken nur Eingaben – kein Host-Browser, keine Pause-Probleme.
4. **Turnier (Raumcode, 2–16 Leute):** dasselbe K.-o.-System wie in der Olympiade, für Spieleabende
   ohne Olympiade.
5. **Olympia-Modus** = Turnier mit den Leuten der Olympia-Gruppe (siehe unten).

## 7. Turnier im K.-o.-System (auch die Olympia-Disziplin)

**Ablauf**
- Alle aus der Gruppe landen im selben Turnierraum (Olympia-Ticket, wie bei den anderen Spielen).
  Fehlt jemand, geht es spätestens nach 90 Sekunden los (wie inzwischen überall).
- Der Server lost den **Turnierbaum** aus. Ist die Zahl keine Zweierpotenz, bekommen einige in
  Runde 1 ein **Freilos** (bei 6 Leuten: 2 Freilose, dann Halbfinale mit 4).
- **Alle Kämpfe einer Runde laufen gleichzeitig.** Wer frei hat oder ausgeschieden ist, schaut zu:
  Turnierbaum-Übersicht + Live-Ansicht eines Kampfs nach Wahl (Seitenkamera wie im Fernsehen).
- Ein Turnierkampf: **eine Runde à 90 Sek.** (einstellbar 60/90/120). KO, technischer KO (3
  Niederschläge) oder Punktsieg. Punktsieg: mehr Schaden ausgeteilt, dann weniger Niederschläge,
  dann mehr Volltreffer; ist alles gleich, 20 Sekunden Verlängerung, in der der erste Treffer gewinnt.
- 15 Sekunden Pause zwischen den Runden (Turnierbaum mit Glückwünschen, nächste Paarungen).
- **Kampf um Platz 3** zwischen den Halbfinal-Verlierern (läuft parallel zum Finale) – damit es
  echte Bronze-Medaillen gibt.
- Dauer: 8 Leute ≈ 3 Runden + Platz 3 ≈ **8–10 Min.**, 16 Leute ≈ 4 Runden ≈ **11–13 Min.**

**Verbindung weg / Handy weggelegt**
- Der Server rechnet weiter, der Boxer ohne Eingaben steht in Deckung (blockt, schlägt nicht).
- Wer innerhalb von 30 Sek. zurückkommt, kämpft weiter. Sonst gewinnt der Gegner durch Aufgabe.
- Ist jemand beim Turnierstart nicht da, verliert er seinen Erstrundenkampf kampflos.

**Wertung für die Olympiade** (wertung `'rang'`, eine Gruppe bis 16, keine Vorläufe nötig)
- Plätze 1–4 aus Finale und Kampf um Platz 3.
- Ab Platz 5 nach erreichter Runde, innerhalb derselben Runde nach ausgeteiltem Schaden (so gibt
  es kaum geteilte Plätze). Gemeldet wird `wert` = Runde × 10.000 + Schaden.

**Fairness bei Verzögerung (Ping)**
- Der Server rechnet mit 30 Hz und ist die einzige Wahrheit (Treffer, Leben, KO).
- Der eigene Boxer reagiert im Browser sofort (Ausweichen/Ausholen wird gleich angezeigt), der
  Server bestätigt. Das Ausholen ist lang genug (≥ 0,25 s), dass 100 ms Verzögerung nicht stören.

Eintrag in `olympiade/spiele.js` (Entwurf):

```js
boxen:{
  sp:'ringfieber', name:'Ringfieber', emoji:'🥊', pfad:'/', wertung:'rang', gruppeMax:16,
  online:'https://ringfieber.onrender.com', lokal:10800,
  regel:'Boxturnier im K.-o.-System: Ihr kämpft eins gegen eins, wer verliert, scheidet aus und schaut zu. Mit Kampf um Platz 3. Ab Platz 5 zählt, wie weit man kam und wie viel Schaden man austeilte.',
  einst:[
    { id:'dauer', name:'Kampfdauer', std:90, werte:[[60, '60 Sek.'], [90, '90 Sek.'], [120, '2 Min.']] },
    { id:'platz3', name:'Kampf um Platz 3', std:1, werte:[[1, 'Ja'], [0, 'Nein']] }
  ]
}
```

## 8. Technik (wie die anderen Spiele)

- Node + `ws`, `server.js` mit Whitelist, `zugang.js` (Passwort-Tor), `olymp.js` aus
  `olympiade/geteilt/`, `datenschutz.html`, Dockerfile + `render.yaml`, Eintrag in der Spielesammlung.
- three.js r128 selbst ausgeliefert, klassische Skripte ohne Build.
- Dateien: `logik.js` (Regeln, Gegner-Muster, rein + deterministisch, UMD für Server),
  `figuren.js` (Low-Poly-Boxer aus Grundkörpern, Animation per Keyframes im Code),
  `spiel.js` (Kamera, Eingabe, HUD, Menüs), `online.js` (Raum, Duell, Vorhersage des eigenen Boxers),
  `turnier.js` (Server: Turnierbaum, Freilose, parallele Kämpfe, Zuschauer, Olympia-Meldung).
- Look: Low-Poly, kräftige Farben, Halle mit Scheinwerfern und Publikum als Silhouetten
  (InstancedMesh), Treffer-Effekte: Kamerawackeln, Zeitlupe beim Konter, Comic-Sterne.
- Ton: nur wenn er gut wird – kurze, satte Treffer-Geräusche + Gong. Lieber stumm als nervig
  (Lehre aus Iron Horizon). Ton-Aus-Knopf von Anfang an.
- Debug wie gewohnt: `ringfieber.sim(sec)`, `ringfieber.zustand`, Bot-Spieler zum Testen.
- Testen des Turniers: Node-Skript mit 16 Bot-Clients per WebSocket (läuft ein ganzes Turnier in
  Sekunden durch, prüft Baum, Freilose, Abbrüche und die Olympia-Meldung).

## 9. Fahrplan

| Schritt | Inhalt | Ergebnis |
|---|---|---|
| 0.1 | Ring, Kamera, Spielerfigur, **ein** Computer-Gegner (Bruno), Ausweichen/Schlagen/Block, Leben + KO; Regeln von Anfang an in `logik.js` (deterministisch, auch für den Server) | Erster spielbarer Kampf |
| 0.2 | Puste, Sterne, Konterfenster, Niederschläge + Zählen, Ausholzeiten, Touch + Controller, Presets | Fühlt sich wie ein Boxspiel an |
| 0.3 | **Online-Duell 1 gegen 1**: Server rechnet, Eingaben + Vorhersage, Raumcode, Aufgabe bei Abbruch | Gegeneinander boxen |
| 0.4 | **Turnier**: Baum, Freilose, parallele Kämpfe, Zuschauer, Platz 3, **Olympia-Anbindung**, Deploy auf Render, Spielesammlung | **Olympia-bereit** |
| 0.5 | alle 8 Computer-Gegner, Karriere mit 3 Ligen, Training, freischaltbare Outfits | Volles Solo-Spiel |

## 10. Entscheidungen

1. Name → Ringfieber
2. Figuren → Menschen
3. Olympia → K.-o.-Turnier gegeneinander (mit Kampf um Platz 3, Freilose bei ungerader Zahl)
4. Eigene Figur → Presets + Farben
