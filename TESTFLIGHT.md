# MatheSnack nach TestFlight bringen

Stand: Version 0.1.0, iOS-Build 100. Der Weg folgt Drawmory. Was du dort
schon hast, nutzt du weiter; neu ist nur, was an der Kennung
`de.mathesnack.app` hängt. MatheSnack hat **keinen In-App-Kauf** und **keine
Universal Links** – die Schritte dazu aus Drawmory entfallen.

| Bereits vorhanden (Drawmory/FairMix) | Neu für MatheSnack |
|---|---|
| Apple-Distribution-Zertifikat (.p12) samt Passwort | App-ID `de.mathesnack.app` |
| Team-ID, Signier-Identität | App-Store-Profil für diese App-ID |
| App-Store-Connect-API-Schlüssel (.p8, Key-ID, Issuer-ID) | App in App Store Connect |
| | Secrets im Repo **MatheSnack** (Secrets gelten je Repo) |

---

## 1. Repo vorbereiten

Repo `MatheSnack` anlegen, Dateien hochladen, **Settings → Pages** auf
Branch `main`, Ordner `/ (root)`. Danach ist die Datenschutzerklärung unter
`https://simaehlmann-cloud.github.io/MatheSnack/datenschutz.html`
erreichbar – diese Adresse verlangt App Store Connect.

## 2. App-ID anlegen

developer.apple.com → **Certificates, Identifiers & Profiles** →
**Identifiers** → **+**

- Typ: **App IDs** → **App**
- Beschreibung: `MatheSnack`
- Bundle ID: **Explicit**, `de.mathesnack.app`
- Capabilities: **keine** zusätzlichen anhaken. (In-App Purchase ist
  vorausgewählt und stört nicht.) Die Kamera braucht keine Capability, nur den
  Hinweistext – der steht schon in der `config.xml`.

## 3. App-Store-Profil erzeugen

**Profiles** → **+** → **Distribution: App Store Connect** →
App-ID `de.mathesnack.app` → dein vorhandenes **Apple-Distribution-Zertifikat**
→ Name `MatheSnack App Store` → herunterladen.

Als base64 in die Zwischenablage (Windows PowerShell, im Ordner Downloads):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\MatheSnack_App_Store.mobileprovision")) | Set-Clipboard
```

Das Drawmory-Profil funktioniert hier nicht. Der Workflow erkennt das und
bricht mit einer klaren Meldung ab, statt beim Signieren zu scheitern.

## 4. Secrets im Repo MatheSnack anlegen

Repo → **Settings → Secrets and variables → Actions → New repository secret**.

| Name | Inhalt |
|---|---|
| `IOS_CERTIFICATE_P12_BASE64` | wie bei Drawmory |
| `IOS_CERTIFICATE_PASSWORD` | wie bei Drawmory |
| `IOS_TEAM_ID` | wie bei Drawmory |
| `IOS_SIGNING_IDENTITY` | wie bei Drawmory, z. B. `Apple Distribution: Simon Mählmann (TEAMID)` |
| `IOS_PROVISIONING_PROFILE` | **neu:** base64 aus Schritt 3 |
| `ASC_KEY_ID` | wie bei Drawmory |
| `ASC_ISSUER_ID` | wie bei Drawmory |
| `ASC_KEY_P8` | wie bei Drawmory, vollständig mit BEGIN/END-Zeilen |

## 5. App in App Store Connect anlegen

appstoreconnect.apple.com → **Apps** → **+** → **Neue App**

- Plattform: iOS
- Name: `MatheSnack` (falls vergeben: `MatheSnack – Mathe-Einstieg`, max. 30 Zeichen)
- Primärsprache: Deutsch
- Bundle-ID: `de.mathesnack.app`
- SKU: `mathesnack-ios`

Danach unter **App-Informationen**:

- Untertitel: `Mathe-Spiele per QR-Code`
- Primäre Kategorie: **Bildung**, sekundäre: Spiele (Lernspiele)
- Datenschutzrichtlinie: die Pages-Adresse aus Schritt 1
- Altersfreigabe: alle Fragen mit „Keine“ → 4+

Unter **App-Datenschutz**: „Daten werden nicht erfasst“. Das deckt sich mit
der Datenschutzerklärung und dem Privacy-Manifest. Die Kamera zählt dabei
nicht als Datenerhebung, weil das Bild das Gerät nicht verlässt.

**Kids-Kategorie:** Bewusst *nicht* wählen. Sie verlangt eine elterliche
Schranke vor jedem Link nach außen (Datenschutz, Impressum) und wird strenger
geprüft. Für eine Unterrichts-App in Klasse 5–10 reicht „Bildung“ mit 4+.

## 6. Build hochladen

Repo → **Actions → Build MatheSnack (iOS) → Run workflow** (Branch `main`).

- Erst laufen auf Linux die Prüfungen (`validate.js` und der Ablauftest).
- Dann baut ein Mac die App. Im Schritt **„Erzeugtes Projekt bestätigen“**
  stehen Kennung, Version 0.1.0, Build 100, Export-Erklärung, Kamera-Hinweis
  und Privacy-Manifest. Jeder Fehler dort bricht ab, bevor eine Build-Nummer
  verbraucht ist.
- Hochgeladen wird **nur bei „Run workflow“**, nicht bei jedem Push.

Dauer etwa 15–25 Minuten.

## 7. TestFlight

Nach 5–30 Minuten Verarbeitung erscheint der Build unter **TestFlight**.
**Interne Tests → +** → Gruppe `Ich` → dich als Tester hinzufügen → Build
zuordnen. Mail öffnen, TestFlight-App installieren, MatheSnack laden.

## 8. Testen

1. Am Laptop (Pages-Fassung) „Spiel für die Klasse“ → QR-Code präsentieren.
2. In der App **QR-Code scannen** → iOS fragt einmal nach der Kamera →
   Spiel startet.
3. Mit der **Kamera-App** gescannt öffnet sich die Webfassung in Safari, nicht
   die App. Das ist so gewollt (ohne Universal Links); beide spielen dasselbe.

## Nächste Builds

Vor jedem weiteren Upload `ios-CFBundleVersion` in der `config.xml` anheben
(jede Nummer ist bei Apple dauerhaft belegt). Bei einer neuen Version auch
die übrigen Stellen aus der README, Abschnitt „Neue Version“.

## Prüfungsanmerkungen für Apple

Beim Einreichen zur Prüfung (nicht für TestFlight intern nötig) ins Feld
*Notizen*:

> MatheSnack is a classroom math warm-up. A teacher selects a game and shows
> a QR code; students scan it and play on their own device. No account, no
> server, no data collection. To test without a second device: tap
> "Selbst üben" (practice) on the home screen and pick any game, or tap
> "Code eingeben" and enter a code shown under "Spiel für die Klasse →
> QR-Code präsentieren". The camera is used only to read QR codes on-device.

Bei Apple 4.2 (Mindestfunktionalität) hilft, dass die App neun Spiele und
eigene Inhalte mitbringt und nicht nur eine Webseite einpackt; die Spiele
laufen vollständig offline.
