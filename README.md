# MatheSnack

**Kurze Mathe-Spiele zum Stundenbeginn – per QR-Code.** Die Lehrkraft wählt
Spiel und Thema und zeigt einen QR-Code am Beamer. Die Klasse scannt ihn mit
der App und spielt sofort: als Konzentrationsstarter, zur Wiederholung oder
als Bewegungspause mit Mathe.

Reine App für iOS und Android (Cordova), Deutsch und Englisch – offline, ohne
Server, ohne Konto, ohne Tracking. Aufbau und Workflows folgen Drawmory.

Version 0.2.0 · versionCode 200 · iOS-Build 200

## Spiele

| Spiel | Wie es läuft | Für die Klasse |
|---|---|---|
| ⚡ Kopfrechen-Sprint | 60–180 s, so viele Aufgaben wie möglich | frei |
| 🔍 Fehlersuche | sechs Rechnungen, ein bis drei sind falsch | frei |
| 🃏 Memory | Aufgabe ↔ Ergebnis, Graph ↔ Gleichung | frei |
| 🁫 Domino | Kette vom Start bis zum Ziel | Lehrkraft-Paket |
| 🔗 Zuordnen | je vier Paare verbinden | Lehrkraft-Paket |
| 🎯 Kopfrechen-Bingo | Beamer zieht, jede Karte anders, App prüft „Bingo!“ | Lehrkraft-Paket |
| 🚢 Schiffe versenken | Klasse gegen Lehrkraft, allein oder zu zweit | Lehrkraft-Paket |
| 🏃 Stationen-Rallye | QR-Karten als PDF, Lösungswort sammeln | Lehrkraft-Paket |
| 🤸 Move & Brain | „wahr → aufstehen“, „was ist mehr → Arm heben“ | Lehrkraft-Paket |

**Für Schülerinnen und Schüler ist alles kostenlos:** Jeder gescannte oder
eingetippte Code spielt sich frei, „Selbst üben“ ebenso. Das Lehrkraft-Paket
(Einmalkauf 4,99 €, Produkt-ID `de.mathesnack.app.lehrkraft`) schaltet nur das
**Erstellen** der übrigen Spiele für die Klasse frei. Ohne Paket gibt es je
Spiel 3 Probestarts.

**Themen:** Einmaleins, ganze Zahlen, Brüche und Dezimalzahlen, Prozent,
Potenzen und Wurzeln, Terme, lineare Gleichungen, lineare und quadratische
Funktionen (mit Graphen), Aufgabenbanken Klasse 7–10.

## Einstellungen (⚙️ auf der Startseite)

Sprache (auch per Flaggen 🇩🇪/🇬🇧 auf der Startseite) · Dunkelmodus-Schalter und
Farbschema · Schriftgröße am Beamer · Töne · Vibration · Lehrkraft-Paket mit
„Käufe wiederherstellen“ · **Schülergerät-Modus** (blendet Lehrerbereich und
Kauf aus, Ausschalten nur mit PIN) · Daten löschen · Datenschutz, Impressum,
Lizenzen.

## Wie das ohne Server geht

Der QR-Code enthält einen **Spielcode** aus 15 Zeichen:

```
https://simaehlmann-cloud.github.io/MatheSnack/open/#s=0SWK43X452NJ0F0
```

Darin stehen Spiel, Thema, zwei Einstellungen und ein Zufallssamen (9 Byte,
Crockford-Base32 mit Prüfsumme). Jedes Gerät erzeugt daraus **dieselben
Aufgaben** – unabhängig von der Sprache; nur die Schreibweise ändert sich
(2,5 · 3 bzw. 2.5 × 3). Der Teil hinter `#` geht nie an einen Server.

So kommt ein gescannter Code an:

| Lage | Was passiert |
|---|---|
| App installiert (iOS) | Universal Link: Die Kamera öffnet MatheSnack direkt mit dem Spiel |
| App installiert (Android) | Hinweisseite mit Knopf „In MatheSnack öffnen“ (`mathesnack://`) |
| App fehlt | Hinweisseite: „Dieses Spiel läuft in der kostenlosen App“ + Code zum Abtippen |
| In der App | „QR-Code scannen“ oder „Code eingeben“ |

Gespielt wird **nur in der App**. GitHub Pages (Ordner `docs/`) liefert nur
die Hinweisseite, Datenschutz und Impressum aus.

## Ordner

```
www/                    die App (wird in die Cordova-Hülle kopiert)
  index.html            Oberfläche und Gestaltung
  js/core.js            Version, Link-Ziel, Zufall, Spielcode, Zahlformat, Töne
  js/i18n.js            Deutsch/Englisch und mathematische Schreibweise
  js/content.js         Themen, Generatoren, Aufgabenbank DE/EN, Graphen
  js/games.js           die neun Spiele
  js/shop.js            Lehrkraft-Paket (In-App-Kauf) und Probestarts
  js/pdf.js             Stationskarten als PDF
  js/teacher.js         Lehrkraft: Einstellen, QR präsentieren, Spielleitung
  js/app.js             Navigation, Startseite, Einstellungen, Scanner, Links
  js/qr.js, js/jsqr.js  QR erzeugen (aus Drawmory) und lesen (jsQR, Apache 2.0)
  datenschutz(-en).html, impressum(-en).html
docs/                   GitHub Pages: Infoseite, open/ (QR-Ziel), Rechtstexte
cordova-plugins/        mathesnack-links: Universal Links an die App weiterreichen
universal-links/        Freigabedatei für das Repo simaehlmann-cloud.github.io
config.xml              Cordova-Konfiguration (iOS und Android)
make-icons.py           erzeugt alle Icons (läuft auch in den Workflows)
res/                    Icons, Startbild, Privacy-Manifest
validate.js             statische Prüfung (~120 000 Prüfungen)
smoketest.js            Ablauftest im Browser (67 Abläufe, inkl. Kauf mit Test-Store)
.github/workflows/      Android (APK/AAB) und iOS (TestFlight)
TESTFLIGHT.md           Schritt für Schritt bis TestFlight
```

Die Rechtstexte liegen zweimal (in der App und auf Pages). Nach einer
Änderung in `www/` kopieren:
`cp www/datenschutz*.html www/impressum*.html docs/` – `validate.js` prüft,
dass beide gleich sind.

## Testen

**Android (APK):** Actions → *Build MatheSnack (Android)* → letzter grüner
Lauf → unten unter *Artifacts* `MatheSnack-debug-apk` → ZIP auf dem Handy
entpacken → APK installieren. Käufe lassen sich nur mit einer Version aus
Google Play testen; alles andere geht mit dem Debug-APK.

**iOS (TestFlight):** siehe [TESTFLIGHT.md](TESTFLIGHT.md).

**Am Rechner (Entwicklung):**

```bash
python3 -m http.server 8765        # dann http://localhost:8765/www/index.html
npm install                        # nur die Prüfwerkzeuge
node validate.js
node smoketest.js                  # Server muss laufen
```

Im Browser gibt es keinen Kauf; Probestarts und alle Spiele funktionieren.
Ein Spiel per Link: `http://localhost:8765/www/index.html#s=CODE`.

## Workflows

| Workflow | Bei jedem Push | Bei „Run workflow“ |
|---|---|---|
| Build MatheSnack (Android) | Prüfungen, Debug-APK; mit Keystore-Secrets auch APK und AAB | wie Push |
| Build MatheSnack (iOS) | Prüfungen, unsignierter und (mit Secrets) signierter Build | zusätzlich Upload nach TestFlight |

## Neue Version

1. `APP_VERSION` in `www/js/core.js`
2. `version`, `android-versionCode`, `ios-CFBundleVersion` in `config.xml`
   (versionCode = Major·10000 + Minor·100 + Patch)

## Erweitern

- **Thema:** Generator in `www/js/content.js`, **hinten** an `TOPICS` anfügen,
  Name in beiden Sprachen in `www/js/i18n.js` (`topic.…`, `grade.…`).
  Die Position steht in jedem Spielcode – nie umsortieren.
- **Spiel:** **hinten** an `GAMES` in `www/js/games.js`, Texte in `i18n.js`.
- **Aufgabenbank:** `BANK_DE` und `BANK_EN` Zeile für Zeile gleich halten.
- **Texte:** nur in `i18n.js`; `validate.js` meldet fehlende oder unbenutzte
  Übersetzungen.
