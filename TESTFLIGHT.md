# MatheSnack nach TestFlight bringen

Stand: Version 0.2.0, iOS-Build 200. Der Weg folgt Drawmory.

**Schon mit 0.1 in TestFlight?** Dann gilt nur der Abschnitt
[Update auf 0.2](#update-auf-02-einmalig) – dort steht alles, was für
In-App-Kauf, Universal Links und die neue Pages-Einstellung dazukommt.

| Bereits vorhanden (Drawmory/FairMix) | Neu für MatheSnack |
|---|---|
| Apple-Distribution-Zertifikat (.p12) samt Passwort | App-ID `de.mathesnack.app` mit **Associated Domains** |
| Team-ID `7LPBMXVK6D`, Signier-Identität | App-Store-Profil für diese App-ID |
| App-Store-Connect-API-Schlüssel (.p8, Key-ID, Issuer-ID) | App in App Store Connect |
| Vertrag „Kostenpflichtige Apps“ | In-App-Kauf `de.mathesnack.app.lehrkraft` |
| Repo `simaehlmann-cloud.github.io` mit Freigabedatei | MatheSnack-Eintrag in dieser Freigabedatei |

---

## Update auf 0.2 (einmalig)

### A. GitHub Pages auf den Ordner `docs` umstellen

Die App liegt jetzt in `www/` und wird **nicht mehr** als Webseite
veröffentlicht. Pages liefert nur noch die Hinweisseite für QR-Codes,
Datenschutz und Impressum aus.

Repo **MatheSnack** → **Settings → Pages** → Branch `main`, Ordner **`/docs`**
→ **Save**. Nach 1–2 Minuten prüfen:

- `https://simaehlmann-cloud.github.io/MatheSnack/` – kleine Infoseite
- `https://simaehlmann-cloud.github.io/MatheSnack/datenschutz.html` – Datenschutz
  (diese Adresse verlangt App Store Connect)
- `https://simaehlmann-cloud.github.io/MatheSnack/open/#s=0SWK43X452NJ0F0` –
  Hinweisseite „Mathe-Spiel bereit“

### B. App-ID um „Associated Domains“ erweitern

Damit die Handy-Kamera einen QR-Code **direkt in der App** öffnet.

1. developer.apple.com → **Identifiers** → `de.mathesnack.app` →
   **Associated Domains** anhaken → **Save** (Hinweis zu Profilen bestätigen).
   „In-App Purchase“ ist schon aktiv – nichts weiter anhaken.
2. **Profiles** → `MatheSnack App Store` → **Edit** → **Save** → **Download**.
   Das alte Profil ist durch die neue Fähigkeit ungültig geworden.
3. In base64 umwandeln (PowerShell, im Ordner Downloads):
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\MatheSnack_App_Store.mobileprovision")) | Set-Clipboard
   ```
4. Repo MatheSnack → **Settings → Secrets and variables → Actions** →
   `IOS_PROVISIONING_PROFILE` → **Update** → einfügen.

Vergisst du B, bricht der Workflow mit „Das Profil erlaubt keine Associated
Domains“ ab – bevor eine Build-Nummer verbraucht ist.

### C. Freigabedatei ergänzen (Repo `simaehlmann-cloud.github.io`)

Genaue Anleitung: [`universal-links/LIESMICH.md`](universal-links/LIESMICH.md).
Kurz: Den Inhalt von `universal-links/.well-known/apple-app-site-association`
in die gleichnamige Datei im Repo `simaehlmann-cloud.github.io` kopieren. Die
Datei enthält Drawmory **und** MatheSnack mit deiner Team-ID – Drawmory
funktioniert unverändert weiter.

### D. In-App-Kauf anlegen

App Store Connect → MatheSnack → **Monetarisierung → In-App-Käufe** → **+**

- Typ: **Nicht-Verbrauchsartikel**
- Referenzname: `Lehrkraft-Paket`
- Produkt-ID: **`de.mathesnack.app.lehrkraft`** – exakt so, sie steht in der App fest
- Preis: **4,99 €**, Verfügbarkeit: alle Länder
- **Familienfreigabe**: einschalten (die App wirbt damit)
- Lokalisierung Deutsch: Anzeigename `Lehrkraft-Paket`,
  Beschreibung `Alle Spiele für die ganze Klasse freischalten` (Apple erlaubt
  höchstens 30 bzw. 45 Zeichen)
- Lokalisierung Englisch (USA und UK): `Teacher Pack`,
  `Unlock every game for the whole class`
- Prüfungsinformationen: Bildschirmfoto des Paket-Bildschirms
  (Einstellungen → „Lehrkraft-Paket ansehen“, 1290 × 2796) und als Notiz der Text aus
  [Prüfungsanmerkungen](#prüfungsanmerkungen-für-apple).

Ziel: Status **„Bereit zur Einreichung“**. Steht dort „Fehlende Metadaten“,
lädt das Produkt in TestFlight unter Umständen nicht („Preis wird geladen …“).

Den Vertrag „Kostenpflichtige Apps“ hast du von Drawmory – er gilt für das
ganze Konto. Falls noch nicht geschehen: Beim **App Store Small Business
Program** anmelden (Provision 15 % statt 30 %).

### E. Englische Store-Seite

App Store Connect → MatheSnack → **App-Informationen** → oben rechts
**Englisch (USA)** und **Englisch (UK)** hinzufügen. Untertitel z. B.
`Maths games via QR code`, Datenschutz-URL
`https://simaehlmann-cloud.github.io/MatheSnack/datenschutz-en.html`.
Die App selbst wählt die Sprache nach dem Gerät und lässt sich mit den
Flaggen auf der Startseite umschalten.

### F. Build hochladen

Repo → **Actions → Build MatheSnack (iOS) → Run workflow** (Branch `main`).
Im Schritt **„Erzeugtes Projekt bestätigen“** stehen Kennung, Version 0.2.0,
Build 200, Kamera- und Foto-Hinweis, URL-Schema `mathesnack://`, die Plugins
für Kauf, Teilen und Links, StoreKit, Associated Domains und das
Privacy-Manifest.

### G. Testen in TestFlight

1. **MatheSnack löschen** und Build 200 neu installieren (nur bei der
   Installation holt iOS die Link-Freigabe ab).
2. **Sprache:** Flaggen 🇩🇪/🇬🇧 oben auf der Startseite.
3. **Dunkelmodus:** ⚙️ → Darstellung → Schalter „Dunkelmodus“.
4. **Probestarts:** „Spiel für die Klasse“ → Domino → „QR-Code präsentieren“ →
   Dialog „noch 3 von 3 Probestarts“.
5. **Kauf:** ⚙️ → „Lehrkraft-Paket ansehen“ → „Für 4,99 € freischalten“.
   TestFlight-Käufe laufen in Apples Testumgebung: **es wird nichts
   abgebucht**, auch wenn ein Preis erscheint.
6. **Wiederherstellen:** App löschen, neu installieren → ⚙️ →
   „Käufe wiederherstellen“.
7. **QR-Code mit der Kamera-App:** Von einem zweiten Gerät (oder vom Laptop
   über die Hinweisseite) einen Code zeigen und mit der normalen Kamera
   scannen → Banner „In MatheSnack öffnen“. Öffnet sich stattdessen Safari mit
   der Hinweisseite, kennt Apples Zwischenspeicher die Freigabe noch nicht
   (bis zu 24 Stunden) – der Knopf „In MatheSnack öffnen“ dort funktioniert
   trotzdem.
8. **Scanner in der App:** „QR-Code scannen“. Falls das Live-Bild nicht
   erscheint, „Foto aufnehmen“ nutzen und mir Bescheid geben – das
   Kamerabild im iOS-WebView lässt sich nur auf einem echten Gerät prüfen.
9. **Stationskarten:** Rallye → „Stationskarten erstellen“ → „Als PDF teilen /
   drucken“ → im Teilen-Menü „Drucken“ oder „In Dateien sichern“.

---

## Erstmalige Einrichtung (falls noch nicht geschehen)

1. **App-ID** `de.mathesnack.app` anlegen (Explicit), Capabilities
   **In-App Purchase** und **Associated Domains**.
2. **Profil** „Distribution: App Store Connect“ für diese App-ID mit dem
   vorhandenen Distribution-Zertifikat, Name `MatheSnack App Store`.
3. **Secrets** im Repo MatheSnack (Werte wie bei Drawmory, nur das Profil ist neu):
   `IOS_CERTIFICATE_P12_BASE64`, `IOS_CERTIFICATE_PASSWORD`, `IOS_TEAM_ID`,
   `IOS_SIGNING_IDENTITY`, `IOS_PROVISIONING_PROFILE`, `ASC_KEY_ID`,
   `ASC_ISSUER_ID`, `ASC_KEY_P8`.
4. **App in App Store Connect:** Name `MatheSnack`, Primärsprache Deutsch,
   Bundle-ID `de.mathesnack.app`, SKU `mathesnack-ios`. Kategorie **Bildung**,
   sekundär Spiele. Altersfreigabe 4+. Datenschutz: „Daten werden nicht
   erfasst“ (die Kamera zählt nicht, das Bild verlässt das Gerät nicht).
   **Nicht** die Kids-Kategorie wählen (sie verlangt Elternschranken vor
   jedem Link und vor dem Kauf).
5. Danach weiter mit [Update auf 0.2](#update-auf-02-einmalig), Schritte A–G.

## Nächste Builds

Vor jedem weiteren Upload `ios-CFBundleVersion` in der `config.xml` anheben
(jede Nummer ist bei Apple dauerhaft belegt). Bei einer neuen Version auch
`APP_VERSION` in `www/js/core.js` und `version`/`android-versionCode` in der
`config.xml` – `validate.js` meldet Abweichungen.

## Android (Play Console, später)

- In-App-Produkt: **Monetarisieren → Produkte → In-App-Produkte** →
  Produkt-ID `de.mathesnack.app.lehrkraft`, 4,99 €.
- Käufe lassen sich nur mit einer App testen, die aus Google Play kommt
  (interner Test-Track) – im Debug-APK aus GitHub Actions bleibt der Kaufknopf
  bei „Preis wird geladen“. Alles andere (Probestarts, Spiele, Scanner) lässt
  sich mit dem Debug-APK testen.
- Lizenztester: Play Console → Einstellungen → Lizenztests → eigenes Konto.

## Prüfungsanmerkungen für Apple

> MatheSnack is a classroom maths warm-up. A teacher selects a game and shows
> a QR code; students scan it and play on their own device. No account, no
> server, no data collection. Students never see purchase offers – playing a
> scanned game is always free. The "Teacher Pack" (non-consumable in-app
> purchase) unlocks six additional class games for teachers; three trial
> starts per game are included. To test: tap "Game for the class" →
> "Dominoes" → "Show QR code". The purchase screen is also under Settings
> (gear icon) → "View Teacher Pack", including "Restore purchases". The camera
> is used only to read QR codes on-device. The app is available in German
> and English (flags on the home screen).
