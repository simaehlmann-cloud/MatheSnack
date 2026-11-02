/* MatheSnack – statische Prüfung (läuft in beiden Workflows vor jedem Build)
   node validate.js
   Prüft Versionen, Dateilisten, Store-Einträge, Links, Übersetzungen,
   Spielcodes und alle Aufgaben-Generatoren in beiden Sprachen.
   Bricht mit Fehlercode ab, sobald etwas nicht passt. */
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const { execFileSync } = require("child_process");

const R = p => fs.readFileSync(path.join(__dirname, p), "utf8");
const exists = p => fs.existsSync(path.join(__dirname, p));
let fehler = 0, pruefungen = 0;
function ok(cond, msg) {
  pruefungen++;
  if (!cond) { fehler++; console.error("✗ " + msg); }
}
function info(msg) { console.log("✓ " + msg); }

/* ---------- Dateien und Syntax ---------- */
const index = R("www/index.html"), config = R("config.xml");
const core = R("www/js/core.js");
const scripts = [...index.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => s !== "cordova.js");
const ORDER = ["core", "i18n", "content", "qr", "jsqr", "games", "shop", "pdf", "teacher", "app"];
ok(JSON.stringify(scripts) === JSON.stringify(ORDER.map(f => `js/${f}.js`)), "index.html bindet die Skripte in falscher Reihenfolge ein: " + scripts.join(", "));
ok(index.indexOf('<script src="cordova.js"></script>') > index.indexOf("js/app.js"), "cordova.js muss nach den App-Skripten stehen");
for (const s of scripts) {
  ok(exists("www/" + s), `Skript fehlt: www/${s}`);
  try { execFileSync(process.execPath, ["--check", path.join(__dirname, "www", s)], { stdio: "pipe" }); }
  catch (e) { ok(false, `Syntaxfehler in www/${s}:\n${e.stderr}`); }
}
ok(!/(src|href)="https?:\/\//.test(index), "index.html lädt nichts von fremden Servern");
ok(/Content-Security-Policy/.test(index) && /mediastream:/.test(index), "CSP fehlt oder erlaubt den Kamera-Stream nicht");
for (const f of ["icon-192.png", "datenschutz.html", "datenschutz-en.html", "impressum.html", "impressum-en.html", "js/jsqr-LICENSE.txt"]) ok(exists("www/" + f), `www/${f} fehlt`);
ok(!exists("www/sw.js") && !exists("www/manifest.json"), "Webfassung-Reste (sw.js/manifest.json) gehören nicht in die App");
info(`${scripts.length} Skripte vorhanden, syntaktisch korrekt, richtige Reihenfolge`);

/* ---------- Pages (docs/) ---------- */
for (const f of ["index.html", "open/index.html", ".nojekyll", "icon-192.png", "js/jsqr-LICENSE.txt"]) ok(exists("docs/" + f), `docs/${f} fehlt`);
for (const f of ["datenschutz.html", "datenschutz-en.html", "impressum.html", "impressum-en.html"]) {
  ok(exists("docs/" + f) && R("docs/" + f) === R("www/" + f), `docs/${f} weicht von www/${f} ab – nach Änderungen kopieren: cp www/datenschutz*.html www/impressum*.html docs/`);
}
const openPage = R("docs/open/index.html");
ok(!/<script src=/.test(openPage) && !/makeItems|GAMES/.test(openPage), "Die Hinweisseite darf keine Spiele enthalten (Spielen nur in der App)");
ok(/mathesnack:\/\/open#s=/.test(openPage), "Hinweisseite bietet mathesnack://open#s=… nicht an");
info("Pages-Seiten vollständig, Rechtstexte in App und Pages gleich");

/* ---------- Versionen ---------- */
const version = (core.match(/const APP_VERSION = "([^"]+)"/) || [])[1];
const cfgVersion = (config.match(/<widget[^>]* version="([^"]+)"/) || [])[1];
const vCode = Number((config.match(/android-versionCode="(\d+)"/) || [])[1]);
const iosBuild = Number((config.match(/ios-CFBundleVersion="(\d+)"/) || [])[1]);
ok(version && version === cfgVersion, `APP_VERSION (${version}) = config.xml version (${cfgVersion})`);
const [ma, mi, pa] = (version || "0.0.0").split(".").map(Number);
ok(vCode === ma * 10000 + mi * 100 + pa, `android-versionCode ${vCode} passt zu ${version} (erwartet ${ma * 10000 + mi * 100 + pa})`);
ok(iosBuild >= vCode, `ios-CFBundleVersion ${iosBuild} ist mindestens versionCode ${vCode}`);
info(`Version ${version}, Android ${vCode}, iOS-Build ${iosBuild}`);

/* ---------- Store-Einträge, Links, Kauf ---------- */
const appId = (config.match(/<widget id="([^"]+)"/) || [])[1];
const shareBase = (core.match(/const SHARE_BASE = "([^"]+)"/) || [])[1] || "";
const scheme = (core.match(/const URL_SCHEME = "([^"]+)"/) || [])[1];
const linkHost = (config.match(/name="LINK_HOST" value="([^"]+)"/) || [])[1];
const shop = R("www/js/shop.js");
const productId = (shop.match(/const PRODUCT_ID = "([^"]+)"/) || [])[1];
ok(/^https:\/\/[^/]+\/MatheSnack\/open\/$/.test(shareBase), `SHARE_BASE muss auf …/MatheSnack/open/ zeigen: ${shareBase}`);
ok(shareBase.startsWith("https://" + linkHost + "/"), `LINK_HOST (${linkHost}) passt nicht zu SHARE_BASE`);
ok(new RegExp(`name="URL_SCHEME" value="${scheme}"`).test(config), `URL-Schema ${scheme} fehlt in config.xml`);
ok(productId === appId + ".lehrkraft", `PRODUCT_ID ${productId} sollte ${appId}.lehrkraft sein`);
for (const wf of [".github/workflows/android.yml", ".github/workflows/ios.yml"]) {
  const y = R(wf);
  ok(y.includes(`APP_ID: ${appId}`), `${wf}: APP_ID ist nicht ${appId}`);
  ok(y.includes("cp -r www/. build/www/"), `${wf} kopiert www/ nicht in die App`);
  ok(/mkdir -p platforms\n\s*cordova platform add/.test(y), `${wf}: vor „cordova platform add“ fehlt „mkdir -p platforms“ – sonst baut Cordova im Repo-Ordner statt in build/`);
}
ok(R(".github/workflows/ios.yml").includes(`LINK_HOST: ${linkHost}`), "ios.yml: LINK_HOST weicht ab");
ok(/workflow_dispatch/.test(R(".github/workflows/ios.yml")) && /github.event_name == 'workflow_dispatch'/.test(R(".github/workflows/ios.yml")), "Upload nach App Store Connect nur bei „Run workflow“");
for (const p of ["cordova-plugin-purchase", "cordova-plugin-x-socialsharing", "cordova-plugin-customurlscheme", "cordova-plugin-android-permissions", "mathesnack-links"]) ok(config.includes(`name="${p}"`), `config.xml: Plugin ${p} fehlt`);
ok(exists("cordova-plugins/mathesnack-links/plugin.xml") && exists("cordova-plugins/mathesnack-links/src/ios/MathesnackLinks.m"), "Plugin mathesnack-links unvollständig");
ok(!/drawmory/i.test(R("cordova-plugins/mathesnack-links/src/ios/MathesnackLinks.m")), "Plugin enthält noch Drawmory-Bezeichner");
for (const k of ["NSCameraUsageDescription", "NSPhotoLibraryAddUsageDescription", "ITSAppUsesNonExemptEncryption", "android.permission.CAMERA"]) ok(config.includes(k), `config.xml: ${k} fehlt`);
ok(/<string>CA92\.1<\/string>/.test(R("res/ios/PrivacyInfo.xcprivacy")), "PrivacyInfo.xcprivacy ohne Grund CA92.1");
const aasa = JSON.parse(R("universal-links/.well-known/apple-app-site-association"));
const det = aasa.applinks.details.find(d => d.appIDs.some(a => a.endsWith("." + appId)));
ok(det && det.components.some(c => c["/"] === new URL(shareBase).pathname + "*"), "Freigabedatei: Pfad /MatheSnack/open/* für " + appId + " fehlt");
ok(aasa.applinks.details.some(d => d.appIDs.some(a => a.endsWith(".de.drawmory.app"))), "Freigabedatei: Drawmory-Eintrag darf nicht verloren gehen");
info(`Store-Einträge, Links (${linkHost}), Schema ${scheme}://, Produkt ${productId} stimmig`);

/* ---------- Spiellogik in einer Sandbox laden ---------- */
const mem = {};
const sandbox = {
  window: {}, console, Math, JSON, Date, Number, String, Array, Object, Set, Map, isFinite, parseInt, TextEncoder,
  location: { protocol: "https:", origin: "https://example.org", pathname: "/", hash: "", search: "" },
  navigator: { language: "de-DE" },
  localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } },
  document: { documentElement: { lang: "de", setAttribute() {} }, createElement: () => ({ setAttribute() {}, append() {}, addEventListener() {}, classList: { add() {} }, style: {} }), createElementNS: () => ({ setAttribute() {}, append() {} }), createTextNode: () => ({}) }
};
vm.createContext(sandbox);
const code = ["core", "i18n", "content", "qr", "games", "shop"].map(f => R(`www/js/${f}.js`)).join("\n") +
  "\n;this.__api = { encodeCode, decodeCode, makeRng, makeItems, TOPICS, GAMES, validConfig, bingoSetup, rallyeSetup, makeFleet, statementText, setLang, t, I18N, BANK_DE, BANK_EN, WORDS, num, QR, shareUrl, getLang: () => LANG };";
vm.runInContext(code, sandbox);
const A = sandbox.__api;

/* Übersetzungen: jeder benutzte Schlüssel in beiden Sprachen, gleiche Form */
const src = ["app", "games", "teacher", "shop", "pdf", "content"].map(f => R(`www/js/${f}.js`)).join("\n");
const used = new Set();
for (const m of src.matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"/g)) if (!m[1].endsWith(".")) used.add(m[1]);
for (const m of src.matchAll(/t\(\[([^\]]+)\]/g)) m[1].match(/"([^"]+)"/g).forEach(x => used.add(x.slice(1, -1)));
for (const m of src.matchAll(/t\(d > 0 \? "([^"]+)" : "([^"]+)"/g)) { used.add(m[1]); used.add(m[2]); }
for (const m of src.matchAll(/setting\("([^"]+)"/g)) used.add(m[1]);
A.GAMES.forEach(g => { used.add("g." + g.key); used.add("g." + g.key + ".desc"); used.add("tip." + g.key); if (!g.free) used.add("pro.what." + g.key); });
A.TOPICS.forEach(tp => { used.add("topic." + tp.k); used.add("grade." + tp.k); });
const de = A.I18N.de, en = A.I18N.en;
for (const k of used) ok(k in de && k in en, `Übersetzung fehlt: ${k} (${!(k in de) ? "de" : ""}${!(k in en) ? " en" : ""})`);
for (const k of Object.keys(de)) {
  ok(k in en, `Englisch fehlt: ${k}`);
  if (!(k in en)) continue;
  const tyD = Array.isArray(de[k]) ? "array" : typeof de[k], tyE = Array.isArray(en[k]) ? "array" : typeof en[k];
  ok(tyD === tyE, `${k}: Form unterschiedlich (${tyD}/${tyE})`);
  if (tyD === "array") ok(de[k].length === en[k].length, `${k}: Listen unterschiedlich lang`);
  const ph = v => JSON.stringify((JSON.stringify(v).match(/\{\w+\}/g) || []).sort().filter((x, i, a) => a.indexOf(x) === i));
  ok(ph(de[k]) === ph(en[k]), `${k}: Platzhalter unterschiedlich ${ph(de[k])} / ${ph(en[k])}`);
}
for (const k of Object.keys(en)) ok(k in de, `Deutsch fehlt: ${k}`);
const unusedKeys = Object.keys(de).filter(k => !used.has(k));
ok(unusedKeys.length === 0, "Unbenutzte Übersetzungen: " + unusedKeys.join(", "));
info(`Übersetzungen: ${used.size} Schlüssel, Deutsch und Englisch vollständig`);

/* Aufgabenbank: Englisch Zeile für Zeile passend zu Deutsch */
for (const g of [7, 8, 9, 10]) {
  const D = A.BANK_DE[g], E = A.BANK_EN[g];
  ok(D.length === E.length, `Bank ${g}: ${D.length} deutsche, ${E.length} englische Zeilen`);
  D.forEach((row, i) => {
    const e = E[i];
    ok(e && e[2].length === row[2].length && e[2].indexOf(e[1]) === row[2].indexOf(row[1]), `Bank ${g}, Zeile ${i + 1}: Auswahl passt nicht zur deutschen Zeile`);
    ok(e && row[0].endsWith("*") === e[0].endsWith("*"), `Bank ${g}, Zeile ${i + 1}: Markierung * unterschiedlich`);
    ok(e && !/[äöüß]/i.test(e.join(" ")), `Bank ${g}, Zeile ${i + 1}: Umlaut im Englischen`);
    ok(e && !/\d,\d/.test(e[0] + e[1] + e[2].join(" ")), `Bank ${g}, Zeile ${i + 1}: Dezimalkomma im Englischen`);
    ok(!/\d\.\d/.test(row[0] + row[1] + row[2].join(" ")), `Bank ${g}, Zeile ${i + 1}: Dezimalpunkt im Deutschen`);
    D.forEach((row2, j) => { if (j > i) ok((row[1] === row2[1]) === (E[i][1] === E[j][1]), `Bank ${g}: Zeilen ${i + 1}/${j + 1} – gleiche Antworten nur in einer Sprache`); });
  });
}
info("Aufgabenbank Klasse 7–10: Englisch passt Zeile für Zeile");

/* Spielcodes: Hin und zurück, Tippfehler werden erkannt */
const rnd = A.makeRng(20261102);
let roundtrip = 0, typosCaught = 0, typos = 0;
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const randomCfg = () => {
  const g = rnd.int(0, A.GAMES.length - 1), G = A.GAMES[g];
  const a = rnd.int(0, G.a.values.length - 1);
  const b = G.key === "rallye" ? rnd.int(0, G.a.values[a]) : G.b ? rnd.int(0, G.b.values.length - 1) : 0;
  return { g, t: G.noTopic ? 0 : rnd.int(0, A.TOPICS.length - 1), a, b, seed: rnd.int(1, 0xFFFFFF) };
};
for (let i = 0; i < 3000; i++) {
  const cfg = randomCfg();
  const c = A.encodeCode(cfg);
  ok(/^[0-9A-HJKMNP-TV-Z]{15}$/.test(c), `Code hat falsches Format: ${c}`);
  const d = A.decodeCode(c);
  if (d && JSON.stringify(d) === JSON.stringify(cfg)) roundtrip++;
  else ok(false, `Code ${c} liefert ${JSON.stringify(d)} statt ${JSON.stringify(cfg)}`);
  ok(JSON.stringify(A.decodeCode(c.toLowerCase().replace(/(.{5})/g, "$1-"))) === JSON.stringify(cfg), "Kleinschreibung/Bindestriche werden nicht toleriert");
  ok(JSON.stringify(A.decodeCode(A.shareUrl(cfg))) === JSON.stringify(cfg), "Code aus dem QR-Link wird nicht erkannt");
  ok(JSON.stringify(A.decodeCode("mathesnack://open#s=" + c)) === JSON.stringify(cfg), "Code aus mathesnack://-Link wird nicht erkannt");
  const pos = rnd.int(0, 14);
  const bad = c.slice(0, pos) + B32[(B32.indexOf(c[pos]) + rnd.int(1, 31)) % 32] + c.slice(pos + 1);
  typos++;
  if (!A.decodeCode(bad)) typosCaught++;
}
ok(roundtrip === 3000, `nur ${roundtrip} von 3000 Codes kamen unverändert zurück`);
ok(typosCaught / typos > 0.97, `nur ${(typosCaught / typos * 100).toFixed(1)} % der Tippfehler erkannt`);
ok(A.decodeCode("hallo") === null && A.decodeCode("") === null && A.decodeCode("000000000000000") === null, "ungültige Codes werden nicht abgelehnt");
const longest = A.QR.encode(A.shareUrl({ g: 7, t: 12, a: 3, b: 10, seed: 0xFFFFFF }));
ok(longest.version <= 5, `QR-Code zu groß (Version ${longest.version}) – schlecht lesbar am Beamer`);
info(`Spielcodes: 3000 hin und zurück, ${(typosCaught / typos * 100).toFixed(1)} % der Tippfehler erkannt, QR-Version ${longest.version}`);

/* Generatoren in beiden Sprachen */
const bad = /NaN|undefined|Infinity|null|\[object|\{\w+\}/;
let items = 0;
for (const lang of ["de", "en"]) {
  A.setLang(lang);
  A.TOPICS.forEach((tp, ti) => {
    for (const graph of tp.graph ? [false, true] : [false]) {
      for (let seed = 1; seed <= 30; seed++) {
        const list = A.makeItems(ti, A.makeRng(seed * 7919), 30, { graph, mc: true });
        ok(list.length >= (tp.bank ? 10 : 15), `${lang} ${tp.name}${graph ? " (Graph)" : ""}: nur ${list.length} verschiedene Aufgaben`);
        const answers = new Set();
        for (const it of list) {
          items++;
          const all = [it.q, it.a, ...it.wrong].join("|");
          ok(!bad.test(all), `${lang} ${tp.name}: kaputter Text „${all}“`);
          ok(it.wrong.length === 3 && new Set(it.wrong).size === 3 && !it.wrong.includes(it.a), `${lang} ${tp.name}: Fehlantworten unbrauchbar bei „${it.q} → ${it.a}“: ${it.wrong.join(", ")}`);
          ok(!answers.has(it.a), `${lang} ${tp.name}: doppelte Antwort ${it.a}`);
          answers.add(it.a);
          if (lang === "en") ok(!/\d,\d|·|(?<!\()\d :|\bvon\b|\bals\b|[äöüß]/.test(all), `en ${tp.name}: deutsche Schreibweise in „${all}“`);
          if (lang === "de") ok(!/\d\.\d|×|÷|\bof\b/.test(all), `de ${tp.name}: englische Schreibweise in „${all}“`);
          if (Number.isFinite(it.num) && it.expr && /^[\d−]/.test(it.a)) {
            const n = Number(it.a.replace(/ /g, "").replace("−", "-").replace(",", "."));
            if (Number.isFinite(n)) ok(Math.abs(n - it.num) < 1e-9, `${lang} ${tp.name}: Zahlenwert ${it.num} passt nicht zu Antwort ${it.a}`);
          }
        }
      }
    }
  });
}
info(`Generatoren: ${items} Aufgaben in ${A.TOPICS.length} Themen, Deutsch und Englisch geprüft`);

/* Gleiche Aufgaben in beiden Sprachen (nur Schreibweise anders) */
const norm = s => s.replace(/,(?=\d)/g, ".").replace(/·/g, "×").replace(/ : /g, " ÷ ").replace(/ %/g, "%").replace(/\((\S+) \| (\S+)\)/g, "($1, $2)").replace(/S\(/g, "(");
let same = 0;
for (const ti of [0, 1, 2, 4, 5, 6, 7, 8]) for (let seed = 1; seed <= 20; seed++) {
  A.setLang("de"); const d = A.makeItems(ti, A.makeRng(seed), 12, { graph: A.TOPICS[ti].graph, mc: true });
  A.setLang("en"); const e = A.makeItems(ti, A.makeRng(seed), 12, { graph: A.TOPICS[ti].graph, mc: true });
  ok(d.length === e.length, `${A.TOPICS[ti].k}: unterschiedlich viele Aufgaben je Sprache`);
  d.forEach((it, i) => { if (e[i] && norm(it.a) === e[i].a) same++; else ok(false, `${A.TOPICS[ti].k}: „${it.a}“ (de) ≠ „${e[i] && e[i].a}“ (en)`); });
}
A.setLang("de");
info(`${same} Aufgaben in beiden Sprachen inhaltlich gleich`);

/* Nachrechnen: Ausdrucks-Aufgaben aus den Generatoren 0 und 1 */
let rechnungen = 0;
for (const lang of ["de", "en"]) {
  A.setLang(lang);
  for (const ti of [0, 1]) for (let seed = 1; seed <= 30; seed++) for (const it of A.makeItems(ti, A.makeRng(seed), 20, {})) {
    const expr = it.q.replace(/−/g, "-").replace(/[·×]/g, "*").replace(/[:÷]/g, "/");
    const v = Function(`"use strict"; return (${expr});`)();
    ok(Math.abs(v - it.num) < 1e-9, `${lang} ${A.TOPICS[ti].name}: ${it.q} ergibt ${v}, nicht ${it.a}`);
    rechnungen++;
  }
}
A.setLang("de");
info(`${rechnungen} Rechnungen nachgerechnet`);

/* Spiele: genug Material für jede Einstellung und jedes Thema */
A.TOPICS.forEach((tp, ti) => {
  for (let a = 0; a < 2; a++) {
    const bs = A.bingoSetup({ g: 5, t: ti, a, b: 0, seed: 77 + ti });
    ok(bs.pool.length >= bs.size * bs.size, `Bingo ${tp.name}: nur ${bs.pool.length} Ergebnisse für eine ${bs.size}×${bs.size}-Karte`);
  }
  [0, 1, 2, 3].forEach(a => {
    const st = A.rallyeSetup({ g: 7, t: ti, a, b: 0, seed: 1234 + ti });
    const n = A.GAMES[7].a.values[a];
    ok(st.n === n && st.word.length === n, `Rallye ${tp.name}: ${st.n} Stationen statt ${n}`);
    st.stations.forEach((s2, k) => {
      ok(s2.letters[s2.opts.indexOf(s2.it.a)] === st.word[k], `Rallye ${tp.name}: richtige Antwort liefert falschen Buchstaben`);
      ok(new Set(s2.letters).size === 4, `Rallye ${tp.name}: Buchstaben einer Station nicht verschieden`);
    });
    A.setLang("en"); const st2 = A.rallyeSetup({ g: 7, t: ti, a, b: 0, seed: 1234 + ti }); A.setLang("de");
    ok(st2.word === st.word && st2.stations.every((s3, k) => s3.letters.join() === st.stations[k].letters.join()), `Rallye ${tp.name}: Lösungswort/Buchstaben hängen von der Sprache ab`);
  });
});
Object.entries(A.WORDS).forEach(([n, list]) => list.forEach(w => ok(w.length === Number(n) && /^[A-Z]+$/.test(w), `Lösungswort ${w} passt nicht zur Länge ${n}`)));
for (const [lo, hi] of [[-5, 5], [0, 10]]) for (let i = 0; i < 200; i++) {
  const fleet = A.makeFleet(A.makeRng(i + 1), lo, hi);
  ok(fleet.length === 5, "Schiffe: Flotte unvollständig");
  const pts = fleet.flatMap(f => f.pts);
  ok(pts.every(([x, y]) => x >= lo && x <= hi && y >= lo && y <= hi), "Schiffe: Punkt außerhalb des Koordinatensystems");
  ok(new Set(pts.map(p => p.join("|"))).size === pts.length, "Schiffe: Schiffe überlappen");
  fleet.forEach((f, k) => fleet.forEach((g2, j) => {
    if (j <= k) return;
    ok(!f.pts.some(([x, y]) => g2.pts.some(([u, v]) => Math.abs(x - u) <= 1 && Math.abs(y - v) <= 1)), "Schiffe berühren sich");
  }));
}
info("Bingo, Rallye und Schiffe haben für jedes Thema genug Material, Rallye sprachunabhängig");

/* Bezahlgrenze */
const free = A.GAMES.filter(g => g.free).map(g => g.key).sort().join(",");
ok(free === "fehler,memory,sprint", `Freie Klassenspiele sollten Sprint, Fehlersuche, Memory sein: ${free}`);
ok(/TRIALS = 3\b/.test(shop), "3 Probestarts je Spiel");
ok(/requirePro\(gi,/.test(R("www/js/teacher.js")), "Lehrerbereich prüft das Paket nicht");
ok(!/requirePro/.test(R("www/js/games.js")) && !/requirePro/.test(src.split("function playGame")[1].split("function screenResult")[0]), "Spielen per Code darf nie gesperrt sein");
info("Bezahlgrenze: Spielen immer frei, Klasse frei für Sprint/Fehlersuche/Memory");

console.log(`\n${pruefungen} Prüfungen, ${fehler} Fehler`);
process.exit(fehler ? 1 : 0);
