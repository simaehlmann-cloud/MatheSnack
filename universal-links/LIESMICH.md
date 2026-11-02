# Freigabe für Universal Links (Repo `simaehlmann-cloud.github.io`)

Damit ein mit der Handy-Kamera gescannter MatheSnack-QR-Code **direkt die App**
öffnet, muss Apple auf deiner Domain eine Freigabe finden. Die liegt nicht in
diesem Repo, sondern im Repo **`simaehlmann-cloud.github.io`** – dort, wo schon
die Freigabe für Drawmory liegt.

**Einmal erledigen:**

1. Im Repo `simaehlmann-cloud.github.io` die Datei
   `.well-known/apple-app-site-association` öffnen → Stift (Bearbeiten).
2. Den gesamten Inhalt durch den Inhalt von
   `universal-links/.well-known/apple-app-site-association` aus diesem Repo
   ersetzen → **Commit changes**.
3. Nach 1–2 Minuten im Browser prüfen:
   `https://simaehlmann-cloud.github.io/.well-known/apple-app-site-association`
   – dort müssen jetzt **beide** Apps stehen (`de.drawmory.app` und
   `de.mathesnack.app`).

Die Datei enthält deine Team-ID `7LPBMXVK6D` bereits (dieselbe wie bei
Drawmory). Der Drawmory-Teil ist unverändert übernommen – Drawmory-Links
funktionieren weiter.

iOS holt die Freigabe beim **Installieren** der App ab. Wer MatheSnack schon
aus TestFlight installiert hat, löscht die App nach dem Hochladen der Datei
einmal und installiert sie neu. Apples Zwischenspeicher kann bis zu 24 Stunden
brauchen; bis dahin öffnen QR-Codes die Hinweisseite mit dem Knopf
„In MatheSnack öffnen“.
