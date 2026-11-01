# MatheSnack

**Kurze Mathe-Spiele zum Stundenbeginn – per QR-Code.** Die Lehrkraft wählt
Spiel und Thema und zeigt einen QR-Code am Beamer. Die Klasse scannt ihn mit
der Kamera und spielt sofort: als Konzentrationsstarter, zur Wiederholung oder
als Bewegungspause mit Mathe.

Läuft als Web-App (GitHub Pages), Android-App und iOS-App aus einer Codebasis
– vollständig offline, ohne Server, ohne Konto, ohne Tracking, ohne
Abhängigkeiten zur Laufzeit. Aufbau und Workflows folgen Drawmory.

Version 0.1.0 · versionCode 100 · iOS-Build 100

## Spiele

| Spiel | Wie es läuft | Geräte |
|---|---|---|
| ⚡ Kopfrechen-Sprint | 60–180 s, so viele Aufgaben wie möglich, Serie und Bestleistung | Schülergeräte |
| 🔍 Fehlersuche | sechs Rechnungen, ein bis drei sind falsch – markieren, prüfen, Lösung sehen | Schülergeräte |
| 🃏 Memory | Aufgabe und Ergebnis als Paar, bei Funktionen Graph und Gleichung | Schülergeräte |
| 🁫 Domino | Kette vom Start bis zum Ziel legen, Ergebnis an Aufgabe | Schülergeräte |
| 🔗 Zuordnen | je vier Paare verbinden, auch Graph ↔ Gleichung | Schülergeräte |
| 🎯 Kopfrechen-Bingo | Beamer zieht die Aufgaben, jede Karte ist anders gemischt, die App prüft „Bingo!“ | Beamer + Schülergeräte |
| 🚢 Schiffe versenken | Koordinaten im 1. oder in allen Quadranten: Klasse gegen Lehrkraft, allein gegen die App oder Partnerspiel mit zwei Geräten | wahlweise |
| 🏃 Stationen-Rallye | ausgedruckte QR-Karten im Raum, jede Station liefert einen Buchstaben des Lösungsworts | Schülergeräte + Papier |
| 🤸 Move & Brain | „wahr → aufstehen“, „links/rechts ist mehr → Arm heben“, Bewegungsimpulse | nur Beamer |

**Themen:** Einmaleins, ganze Zahlen, Brüche und Dezimalzahlen, Prozent,
Potenzen und Wurzeln, Terme, lineare Gleichungen, lineare und quadratische
Funktionen (mit Graphen) sowie die vorbereiteten Aufgabenbanken Klasse 7–10.
Die Generatoren liefern typische Fehlantworten (Vorzeichen, Klammer vergessen,
Exponent falsch), die in Auswahl, Fehlersuche und Bewegungspause auftauchen.

## Wie das ohne Server geht

Der QR-Code enthält keine Aufgaben, sondern einen **Spielcode** aus 15 Zeichen:

```
https://simaehlmann-cloud.github.io/MatheSnack/#s=0SWK43X452NJ0F0
```

Darin stehen Spiel, Thema, zwei Einstellungen und ein Zufallssamen (9 Byte,
Crockford-Base32 ohne I, L, O, U, mit Prüfsumme). Jedes Gerät erzeugt aus dem
Samen **dieselben Aufgaben** – Bingo-Beamer und Schülerkarten passen deshalb
zusammen, ohne dass ein Gerät mit einem anderen spricht. Was jedes Gerät
eigenständig zufällig macht (Bingo-Karte, Flotte, Reihenfolge der
Memory-Karten), nutzt den Gerätezufall.

Der Teil hinter `#` wird beim Öffnen nie an den Webserver übertragen.
Ohne Kamera lässt sich der Code auch abtippen (Bindestriche und Groß-/
Kleinschreibung egal; 99,9 % der Tippfehler erkennt die Prüfsumme).

## Heute testen: GitHub Pages

1. Neues Repo **`MatheSnack`** unter `simaehlmann-cloud` anlegen (Public).
2. Den Inhalt dieses Ordners hochladen (siehe unten) und committen.
3. **Settings → Pages:** Source *Deploy from a branch*, Branch `main`,
   Ordner `/ (root)` → Save.
4. Nach 1–2 Minuten läuft die App unter
   **https://simaehlmann-cloud.github.io/MatheSnack/**

Test im Klassenraum-Ablauf: am Laptop „Spiel für die Klasse“ → Spiel und Thema
→ „QR-Code präsentieren“, dann mit der normalen Kamera-App des Handys scannen.

Heißt das Repo anders, funktioniert die Webfassung trotzdem (sie nimmt ihre
eigene Adresse in die QR-Codes). Nur für die Store-Apps muss dann
`APP_BASE_NATIVE` in `js/core.js` angepasst werden.

## Nächste Woche: APK für Android

Der Workflow **Build MatheSnack (Android)** läuft bei jedem Push automatisch.

1. Repo → **Actions** → letzter Lauf von *Build MatheSnack (Android)* → unten
   unter **Artifacts** `MatheSnack-debug-apk` herunterladen (ZIP).
2. ZIP auf dem Handy entpacken, `MatheSnack-debug.apk` antippen, Installation
   aus dieser Quelle erlauben.
3. Beim ersten Scan fragt Android nach der Kamera.

Für den Play Store später einen **eigenen** Keystore anlegen (nicht den von
Drawmory) und die vier Secrets `ANDROID_KEYSTORE_BASE64`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
hinterlegen – dann liefert derselbe Workflow ein signiertes APK und ein AAB.

## Danach: TestFlight

Schritt für Schritt in [TESTFLIGHT.md](TESTFLIGHT.md). Kurz: App-ID
`de.mathesnack.app` anlegen, Profil erzeugen, Secrets wie bei Drawmory
eintragen, **Actions → Build MatheSnack (iOS) → Run workflow**.

## Dateien hochladen

Am einfachsten mit GitHub Desktop oder per Kommandozeile:

```bash
cd MatheSnack
git remote add origin https://github.com/simaehlmann-cloud/MatheSnack.git
git push -u origin main
```

Über die Weboberfläche (*Add file → Upload files*) gehen versteckte Ordner wie
`.github` oft verloren – dann fehlen die Workflows. In dem Fall den Ordner
`.github/workflows` mit *Add file → Create new file* und dem Pfad
`.github/workflows/android.yml` von Hand anlegen und den Inhalt einfügen.

## Entwickeln und prüfen

```bash
python3 -m http.server 8765        # App unter http://localhost:8765
npm install                        # nur die Prüfwerkzeuge
node validate.js                   # ~84 000 statische Prüfungen
node smoketest.js                  # Ablauftest in Chromium (Server muss laufen)
```

`validate.js` prüft Versionen und Dateilisten, rechnet Generator-Aufgaben nach,
spielt 3000 Spielcodes hin und zurück, prüft Fehlantworten, Bingo-Karten,
Rallye-Buchstaben und Schiffsflotten. `smoketest.js` spielt jedes Spiel an und
liest präsentierte QR-Codes und Stationskarten mit jsQR zurück. Beide laufen in
den Workflows vor jedem Build.

## Neue Version

1. `APP_VERSION` in `js/core.js`
2. `version`, `android-versionCode`, `ios-CFBundleVersion` in `config.xml`
   (versionCode = Major·10000 + Minor·100 + Patch)
3. Cache-Name in `sw.js` und `?v=` an den Skripten in `index.html` und `sw.js`

`validate.js` meldet, wenn eine dieser Stellen vergessen wurde.

## Neue Themen oder Spiele

- **Thema:** Generator in `js/content.js` schreiben und **hinten** an `TOPICS`
  anfügen. Die Position steht in jedem Spielcode – nie umsortieren.
- **Spiel:** Eintrag **hinten** an `GAMES` in `js/games.js` mit `play(ctx)`.
- Vorbereitete Aufgaben: `BANK` in `js/content.js`, Format
  `[Frage, Antwort, [Auswahl], Erklärung]`. Ein `*` am Ende der Frage heißt
  „nur mit Auswahl sinnvoll“.

## Dateistruktur

```
index.html              Oberfläche und Gestaltung
js/core.js              Version, Zufall mit Samen, Spielcode, Zahlformat, Helfer
js/content.js           Themen, Aufgaben-Generatoren, Aufgabenbank 7–10, Graphen
js/games.js             die neun Spiele
js/teacher.js           Lehrkraft: Einstellen, QR präsentieren, Bingo-Leitung, Stationskarten
js/app.js               Navigation, Code-Eingabe, Kamera-Scanner, Ergebnis
js/qr.js                QR-Erzeugung (aus Drawmory)
js/jsqr.js              QR-Erkennung (jsQR 1.4.0, Apache 2.0)
sw.js, manifest.json    Offline-Fähigkeit und Installation als Web-App
datenschutz.html        Datenschutzerklärung
impressum.html          Impressum (§ 5 DDG)
config.xml              Cordova-Konfiguration für iOS und Android
make-icons.py           erzeugt alle Icons (läuft auch in den Workflows)
res/                    Icons, Startbild, Privacy-Manifest
validate.js             statische Prüfung
smoketest.js            Ablauftest im Browser
.github/workflows/      Android (APK/AAB) und iOS (TestFlight)
```

## Datenschutz in einem Satz

Kein Server, keine Namen, keine Ergebnisse, die das Gerät verlassen; die
Kamera wird nur zum Lesen des QR-Codes auf dem Gerät genutzt. Für den
Store gilt deshalb „Daten werden nicht erfasst“.
