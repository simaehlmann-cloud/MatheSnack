/* MatheSnack – statische Prüfung (läuft in beiden Workflows vor jedem Build)
   node validate.js
   Prüft Versionen, Dateilisten, Store-Einträge, Spielcodes und alle
   Aufgaben-Generatoren. Bricht mit Fehlercode ab, sobald etwas nicht passt. */
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const { execFileSync } = require("child_process");

const R = p => fs.readFileSync(path.join(__dirname, p), "utf8");
let fehler = 0, pruefungen = 0;
function ok(cond, msg) {
  pruefungen++;
  if (!cond) { fehler++; console.error("✗ " + msg); }
}
function info(msg) { console.log("✓ " + msg); }

/* ---------- Dateien und Syntax ---------- */
const index = R("index.html"), sw = R("sw.js"), config = R("config.xml");
const core = R("js/core.js");
const scripts = [...index.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => s !== "cordova.js");
ok(scripts.length >= 7, "index.html bindet die Skripte ein");
for (const s of scripts) {
  const file = s.split("?")[0];
  ok(fs.existsSync(path.join(__dirname, file)), `Skript fehlt: ${file}`);
  try { execFileSync(process.execPath, ["--check", path.join(__dirname, file)], { stdio: "pipe" }); }
  catch (e) { ok(false, `Syntaxfehler in ${file}:\n${e.stderr}`); }
}
ok(!/(src|href)="https?:\/\//.test(index.replace(/<a [^>]*>/g, "")), "index.html lädt nichts von fremden Servern");
info(`${scripts.length} Skripte vorhanden und syntaktisch korrekt`);

/* ---------- Versionen ---------- */
const version = (core.match(/const APP_VERSION = "([^"]+)"/) || [])[1];
const cfgVersion = (config.match(/<widget[^>]* version="([^"]+)"/) || [])[1];
const vCode = Number((config.match(/android-versionCode="(\d+)"/) || [])[1]);
const iosBuild = Number((config.match(/ios-CFBundleVersion="(\d+)"/) || [])[1]);
const swCache = (sw.match(/const CACHE = 'mathesnack-([^']+)'/) || [])[1];
ok(version && version === cfgVersion, `APP_VERSION (${version}) = config.xml version (${cfgVersion})`);
ok(swCache === version, `sw.js-Cache (${swCache}) = APP_VERSION (${version})`);
const [ma, mi, pa] = (version || "0.0.0").split(".").map(Number);
ok(vCode === ma * 10000 + mi * 100 + pa, `android-versionCode ${vCode} passt zu ${version} (erwartet ${ma * 10000 + mi * 100 + pa})`);
ok(iosBuild >= vCode, `ios-CFBundleVersion ${iosBuild} ist mindestens versionCode ${vCode}`);
for (const s of scripts) ok(s.endsWith("?v=" + version), `${s} trägt ?v=${version} (sonst liefert der Service Worker alte Fassungen)`);
info(`Version ${version} überall gleich`);

/* ---------- Service Worker ---------- */
const assets = [...sw.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
for (const a of assets) ok(fs.existsSync(path.join(__dirname, a.split("?")[0])), `sw.js nennt fehlende Datei ${a}`);
for (const s of scripts) ok(assets.includes(s), `sw.js cacht ${s} nicht – offline fehlt dann ein Teil`);
info(`Service Worker: ${assets.length} Dateien vorhanden`);

/* ---------- Store-Einträge ---------- */
const appId = (config.match(/<widget id="([^"]+)"/) || [])[1];
for (const wf of [".github/workflows/android.yml", ".github/workflows/ios.yml"]) {
  const y = R(wf);
  ok(y.includes(`APP_ID: ${appId}`), `${wf}: APP_ID ist nicht ${appId}`);
  ok(/cp -r js build\/www\/js/.test(y), `${wf} kopiert den Ordner js nicht in die App`);
  for (const f of ["index.html", "manifest.json", "sw.js", "datenschutz.html", "impressum.html"]) ok(y.includes(f), `${wf} kopiert ${f} nicht`);
}
ok(/NSCameraUsageDescription/.test(config), "config.xml: NSCameraUsageDescription fehlt (iOS beendet sonst die App beim Scannen)");
ok(/android\.permission\.CAMERA/.test(config), "config.xml: Android-Kameraberechtigung fehlt");
ok(/cordova-plugin-android-permissions/.test(config), "config.xml: Plugin für die Kamera-Erlaubnis unter Android fehlt");
ok(/ITSAppUsesNonExemptEncryption/.test(config), "config.xml: Export-Erklärung fehlt");
ok(/<string>CA92\.1<\/string>/.test(R("res/ios/PrivacyInfo.xcprivacy")), "PrivacyInfo.xcprivacy ohne Grund CA92.1");
ok(/APP_BASE_NATIVE = "https:\/\/[^"]+\/"/.test(core), "APP_BASE_NATIVE muss eine https-Adresse mit / am Ende sein");
info(`Store-Einträge für ${appId} stimmig`);

/* ---------- Spiellogik in einer Sandbox laden ---------- */
const sandbox = {
  window: {}, console, Math, JSON, Date, Number, String, Array, Object, Set, Map, isFinite, parseInt,
  location: { protocol: "https:", origin: "https://example.org", pathname: "/MatheSnack/", hash: "", search: "" },
  navigator: {}, localStorage: { getItem: () => null, setItem: () => {} },
  document: { createElement: () => ({ setAttribute() {}, append() {}, addEventListener() {}, classList: { add() {} }, style: {} }), createElementNS: () => ({ setAttribute() {}, append() {} }), createTextNode: () => ({}) }
};
vm.createContext(sandbox);
const code = ["js/core.js", "js/content.js", "js/games.js"].map(R).join("\n") +
  "\n;this.__api = { encodeCode, decodeCode, makeRng, makeItems, TOPICS, GAMES, validConfig, bingoSetup, rallyeSetup, makeFleet, statementText };";
vm.runInContext(code, sandbox);
const A = sandbox.__api;

/* Spielcodes: Hin und zurück, Tippfehler werden erkannt */
const rnd = A.makeRng(20261029);
let roundtrip = 0, typosCaught = 0, typos = 0;
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
for (let i = 0; i < 3000; i++) {
  const g = rnd.int(0, A.GAMES.length - 1), G = A.GAMES[g];
  const a = rnd.int(0, G.a.values.length - 1);
  const b = G.key === "rallye" ? rnd.int(0, G.a.values[a]) : G.b ? rnd.int(0, G.b.values.length - 1) : 0;
  const cfg = { g, t: G.noTopic ? 0 : rnd.int(0, A.TOPICS.length - 1), a, b, seed: rnd.int(1, 0xFFFFFF) };
  const c = A.encodeCode(cfg);
  ok(/^[0-9A-HJKMNP-TV-Z]{15}$/.test(c), `Code hat falsches Format: ${c}`);
  const d = A.decodeCode(c);
  if (d && JSON.stringify(d) === JSON.stringify(cfg)) roundtrip++;
  else ok(false, `Code ${c} liefert ${JSON.stringify(d)} statt ${JSON.stringify(cfg)}`);
  ok(JSON.stringify(A.decodeCode(c.toLowerCase().replace(/(.{5})/g, "$1-"))) === JSON.stringify(cfg), "Kleinschreibung/Bindestriche werden nicht toleriert");
  ok(JSON.stringify(A.decodeCode("https://x.de/MatheSnack/#s=" + c)) === JSON.stringify(cfg), "Code aus einem Link wird nicht erkannt");
  const pos = rnd.int(0, 14);
  const wrongCh = B32[(B32.indexOf(c[pos]) + rnd.int(1, 31)) % 32];
  const bad = c.slice(0, pos) + wrongCh + c.slice(pos + 1);
  typos++;
  const dBad = A.decodeCode(bad);
  if (!dBad || JSON.stringify(dBad) !== JSON.stringify(cfg)) { if (!dBad) typosCaught++; }
}
ok(roundtrip === 3000, `nur ${roundtrip} von 3000 Codes kamen unverändert zurück`);
ok(typosCaught / typos > 0.97, `nur ${(typosCaught / typos * 100).toFixed(1)} % der Tippfehler erkannt`);
ok(A.decodeCode("hallo") === null && A.decodeCode("") === null && A.decodeCode("000000000000000") === null, "ungültige Codes werden nicht abgelehnt");
info(`Spielcodes: 3000 hin und zurück, ${(typosCaught / typos * 100).toFixed(1)} % der Tippfehler erkannt`);

/* Generatoren: jede Aufgabe mit drei verschiedenen falschen Antworten */
const bad = /NaN|undefined|Infinity|null|\[object/;
let items = 0;
A.TOPICS.forEach((tp, t) => {
  for (const graph of tp.graph ? [false, true] : [false]) {
    for (let seed = 1; seed <= 40; seed++) {
      const list = A.makeItems(t, A.makeRng(seed * 7919), 30, { graph, mc: true });
      ok(list.length >= (tp.bank ? 10 : 15), `${tp.name}${graph ? " (Graph)" : ""}: nur ${list.length} verschiedene Aufgaben`);
      const answers = new Set();
      for (const it of list) {
        items++;
        const all = [it.q, it.a, ...it.wrong].join("|");
        ok(!bad.test(all), `${tp.name}: kaputter Text „${all}“`);
        ok(it.wrong.length === 3 && new Set(it.wrong).size === 3 && !it.wrong.includes(it.a), `${tp.name}: Fehlantworten unbrauchbar bei „${it.q} → ${it.a}“: ${it.wrong.join(", ")}`);
        ok(!answers.has(it.a), `${tp.name}: doppelte Antwort ${it.a}`);
        answers.add(it.a);
        if (graph) ok(it.fn && Number.isFinite(it.fn.type === "lin" ? it.fn.m + it.fn.b : it.fn.k + it.fn.d + it.fn.e), `${tp.name}: Graph ohne Funktion`);
        else ok(it.q.length > 0, `${tp.name}: leere Frage`);
        if (Number.isFinite(it.num) && it.expr && /^[\d−]/.test(it.a)) {
          const n = Number(it.a.replace(/ /g, "").replace("−", "-").replace(",", "."));
          if (Number.isFinite(n)) ok(Math.abs(n - it.num) < 1e-9, `${tp.name}: Zahlenwert ${it.num} passt nicht zu Antwort ${it.a}`);
        }
      }
    }
  }
});
info(`Generatoren: ${items} Aufgaben in ${A.TOPICS.length} Themen geprüft`);

/* Nachrechnen: Ausdrucks-Aufgaben aus den Generatoren 0, 1 und 4 */
let rechnungen = 0;
for (const t of [0, 1]) {
  for (let seed = 1; seed <= 30; seed++) for (const it of A.makeItems(t, A.makeRng(seed), 20, {})) {
    const expr = it.q.replace(/−/g, "-").replace(/·/g, "*").replace(/:/g, "/");
    const v = Function(`"use strict"; return (${expr});`)();
    ok(Math.abs(v - it.num) < 1e-9, `${A.TOPICS[t].name}: ${it.q} ergibt ${v}, nicht ${it.a}`);
    rechnungen++;
  }
}
info(`${rechnungen} Rechnungen nachgerechnet`);

/* Spiele: genug Material für jede Einstellung und jedes Thema */
A.TOPICS.forEach((tp, t) => {
  for (let a = 0; a < 2; a++) {
    const bs = A.bingoSetup({ g: 5, t, a, b: 0, seed: 77 + t });
    ok(bs.pool.length >= bs.size * bs.size, `Bingo ${tp.name}: nur ${bs.pool.length} Ergebnisse für eine ${bs.size}×${bs.size}-Karte`);
  }
  [0, 1, 2, 3].forEach(a => {
    const st = A.rallyeSetup({ g: 7, t, a, b: 0, seed: 1234 + t });
    const n = A.GAMES[7].a.values[a];
    ok(st.n === n && st.word.length === n, `Rallye ${tp.name}: ${st.n} Stationen statt ${n}`);
    st.stations.forEach((s2, k) => {
      ok(s2.letters[s2.opts.indexOf(s2.it.a)] === st.word[k], `Rallye ${tp.name}: richtige Antwort liefert falschen Buchstaben`);
      ok(new Set(s2.letters).size === 4, `Rallye ${tp.name}: Buchstaben einer Station nicht verschieden`);
    });
  });
});
for (const [lo, hi] of [[-5, 5], [0, 10]]) for (let i = 0; i < 300; i++) {
  const fleet = A.makeFleet(A.makeRng(i + 1), lo, hi);
  ok(fleet.length === 5, "Schiffe: Flotte unvollständig");
  const pts = fleet.flatMap(f => f.pts);
  ok(pts.every(([x, y]) => x >= lo && x <= hi && y >= lo && y <= hi), "Schiffe: Punkt außerhalb des Koordinatensystems");
  const keys = new Set(pts.map(p => p.join("|")));
  ok(keys.size === pts.length, "Schiffe: Schiffe überlappen");
  fleet.forEach((f, k) => fleet.forEach((g2, j) => {
    if (j <= k) return;
    ok(!f.pts.some(([x, y]) => g2.pts.some(([u, v]) => Math.abs(x - u) <= 1 && Math.abs(y - v) <= 1)), "Schiffe berühren sich");
  }));
}
info("Bingo, Rallye und Schiffe haben für jedes Thema genug Material");

console.log(`\n${pruefungen} Prüfungen, ${fehler} Fehler`);
process.exit(fehler ? 1 : 0);
