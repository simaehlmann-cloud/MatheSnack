/* MatheSnack – Ablauftest im echten Browser (läuft in beiden Workflows)
   Vorher im Repo-Ordner: python3 -m http.server 8765
   Dann:                  node smoketest.js
   Spielt jedes Spiel an (Deutsch und Englisch), liest QR-Codes und das
   Stationskarten-PDF zurück, prüft Probestarts, Kauf (mit nachgebautem
   Store), Schülergerät-Modus, Dunkelmodus und die Hinweisseite. */
"use strict";
const { chromium } = require("playwright");
const jsQR = require("jsqr");

const ROOT = process.env.BASE || "http://localhost:8765";
const APP = ROOT + "/www/index.html";
let fehler = 0;
const ok = (c, m) => { if (c) console.log("✓ " + m); else { fehler++; console.error("✗ " + m); } };

/* Nachgebauter Store (cordova-plugin-purchase, CdvPurchase v13) */
const FAKE_STORE = `
window.cordova = { platformId: "ios" };
(function () {
  const state = { owned: sessionStorage.getItem("fakeOwned") === "1", cb: {} };
  const product = { id: "de.mathesnack.app.lehrkraft", pricing: { price: "4,99 €" },
    get owned() { return state.owned; },
    getOffer: () => ({ order: () => { window.__orders = (window.__orders || 0) + 1;
      if (window.__cancel) return Promise.resolve({ code: 6777006, message: "cancelled" });
      setTimeout(() => { state.owned = true; const tr = { products: [{ id: product.id }], verify() { state.cb.verified && state.cb.verified({ finish() { state.cb.finished && state.cb.finished(tr); } }); } }; state.cb.approved && state.cb.approved(tr); }, 50);
      return Promise.resolve(undefined); } }) };
  const chain = { productUpdated(f) { state.cb.productUpdated = f; return chain; }, approved(f) { state.cb.approved = f; return chain; },
    verified(f) { state.cb.verified = f; return chain; }, finished(f) { state.cb.finished = f; return chain; } };
  window.CdvPurchase = {
    Platform: { APPLE_APPSTORE: "ios-appstore", GOOGLE_PLAY: "android-playstore" },
    ProductType: { NON_CONSUMABLE: "non consumable" }, ErrorCode: { PAYMENT_CANCELLED: 6777006 },
    store: { register() {}, when: () => chain, error() {},
      initialize() { setTimeout(() => state.cb.productUpdated && state.cb.productUpdated(product), 20); return Promise.resolve(); },
      get: () => product, owned: () => state.owned,
      restorePurchases() { if (sessionStorage.getItem("fakeOwned") === "1") state.owned = true; return Promise.resolve(); } }
  };
  window.__fireDeviceReady = () => document.dispatchEvent(new Event("deviceready"));
})();`;

function readQr(page, sel) {
  return page.evaluate(s => [...document.querySelectorAll(s)].map(c => {
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height);
    return { w: c.width, h: c.height, data: Array.from(d.data) };
  }), sel).then(list => list.map(q => { const r = jsQR(Uint8ClampedArray.from(q.data), q.w, q.h); return r && r.data; }));
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const watch = page => {
    page.on("pageerror", e => errors.push(String(e)));
    page.on("console", m => { if (m.type() === "error" && !/cordova\.js|404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  };
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, locale: "de-DE", acceptDownloads: true });
  const page = await ctx.newPage();
  watch(page);
  const open = async cfg => {
    const code = await page.evaluate(c => encodeCode(c), cfg);
    await page.goto(APP + "#s=" + code);
    await page.waitForTimeout(250);
    return code;
  };
  const fresh = async () => { await page.goto(APP); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await page.goto(APP); };

  /* ---------- Startseite, Sprache, Dunkelmodus ---------- */
  await fresh();
  ok(await page.isVisible("text=QR-Code scannen") && await page.locator(".hometile").count() === 4, "Startseite (Deutsch) mit vier Kacheln");
  ok(!(await page.textContent("#view")).includes("null"), "Kein „null“ auf der Startseite");
  await page.click('.langbtn[data-lang="en"]');
  ok(await page.isVisible("text=Scan QR code") && await page.getAttribute("html", "lang") === "en", "Flagge 🇬🇧 stellt auf Englisch um");
  await page.reload();
  ok(await page.isVisible("text=Scan QR code"), "Sprache bleibt nach Neustart erhalten");
  await page.click(".gear");
  ok(await page.isVisible("text=Dark mode"), "Einstellungen auf Englisch");
  await page.click("#darkSwitch");
  ok(await page.getAttribute("html", "data-theme") === "dark", "Dunkelmodus-Schalter setzt dunkles Design");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(bg === "rgb(20, 24, 43)", "Hintergrund ist dunkel: " + bg);
  await page.reload();
  ok(await page.getAttribute("html", "data-theme") === "dark", "Dunkelmodus bleibt nach Neustart erhalten");
  await page.click(".gear");
  await page.click("#darkSwitch");
  ok(await page.getAttribute("html", "data-theme") === "light", "Dunkelmodus lässt sich wieder ausschalten");
  await page.click('.langbtn[data-lang="de"]');
  ok(await page.isVisible("text=Dunkelmodus"), "Flagge 🇩🇪 in den Einstellungen stellt zurück auf Deutsch");

  /* ---------- Lehrkraft: freies Spiel, QR-Code ---------- */
  await page.click("#btnBack");
  await page.click(".hometile.teach");
  await page.click('.gametile:has-text("Fehlersuche")');
  await page.selectOption("#fTopic", "5");
  await page.click("text=QR-Code präsentieren");
  ok(!(await page.isVisible(".dlg-box")), "Freies Spiel (Fehlersuche) startet ohne Paket und ohne Probestart");
  await page.waitForSelector(".present .qrcanvas");
  const shown = (await page.textContent(".present-code")).replace(/-/g, "");
  const [qrText] = await readQr(page, ".present .qrcanvas");
  ok(qrText === "https://simaehlmann-cloud.github.io/MatheSnack/open/#s=" + shown, "QR-Code führt auf die Hinweisseite …/MatheSnack/open/#s=CODE");

  /* Hinweisseite (GitHub Pages) */
  const landing = await ctx.newPage(); watch(landing);
  await landing.goto(ROOT + "/docs/open/#s=" + shown);
  ok(await landing.getAttribute("#open", "href") === "mathesnack://open#s=" + shown, "Hinweisseite bietet „In MatheSnack öffnen“ an");
  ok((await landing.textContent("#code")).replace(/-/g, "") === shown, "Hinweisseite zeigt den Code zum Abtippen");
  ok(!(await landing.textContent("body")).includes("Los geht"), "Auf der Hinweisseite wird nicht gespielt");
  await Promise.all([landing.waitForNavigation(), landing.goto(ROOT + "/docs/open/#s=KAPUTT")]);
  await landing.waitForTimeout(200);
  ok(await landing.isHidden("#open"), "Hinweisseite erkennt kaputte Links");
  await landing.goto(ROOT + "/docs/");
  ok(await landing.isVisible("text=MatheSnack"), "Pages-Startseite erreichbar");
  await landing.close();

  /* Links, wie sie die App öffnet (Universal Link, mathesnack://) */
  await page.goto(APP);
  await page.evaluate(u => window.handleOpenURL(u), qrText);
  await page.waitForTimeout(100);
  ok(await page.isVisible("text=Los geht's") && (await page.textContent("#barTitle")) === "Fehlersuche", "Universal Link öffnet das Spiel in der App");
  await page.goto(APP);
  await page.evaluate(c => window.handleOpenURL("mathesnack://open#s=" + c), shown);
  await page.waitForTimeout(100);
  ok(await page.isVisible("text=Los geht's"), "mathesnack://-Link öffnet das Spiel");

  /* Code von Hand */
  await page.goto(APP);
  await page.click("text=Code eingeben");
  await page.fill("#codeInput", shown.toLowerCase().replace(/(.{5})/g, "$1 "));
  await page.keyboard.press("Enter");
  ok(await page.isVisible("text=Los geht's"), "Eingetippter Code startet das Spiel");
  await page.goto(APP);
  await page.click("text=Code eingeben");
  await page.fill("#codeInput", "ABCDE-FGHJK-MNPQR");
  await page.keyboard.press("Enter");
  ok(/stimmt nicht/.test(await page.textContent(".msg")), "Falscher Code wird abgelehnt");

  /* ---------- Probestarts und Paket ---------- */
  await fresh();
  const presentBingo = async () => {
    await page.goto(APP);
    await page.click(".hometile.teach");
    await page.click('.gametile:has-text("Kopfrechen-Bingo")');
    await page.click("text=QR-Code präsentieren");
  };
  for (let n = 3; n >= 1; n--) {
    await presentBingo();
    ok(await page.isVisible(".dlg-box") && (await page.textContent(".dlg-box")).includes(n === 1 ? "einen von 3" : `${n} von 3`), `Bingo: Dialog nennt ${n} von 3 Probestarts`);
    await page.click("text=Probestart nutzen");
    await page.waitForSelector(".present .qrcanvas");
  }
  await page.click("text=Spielleitung öffnen");
  ok(await page.isVisible(".lead-prompt"), "Bingo-Spielleitung öffnet");
  await presentBingo();
  ok(await page.isVisible("text=Deine Probestarts sind aufgebraucht") && await page.isVisible("text=Kaufen geht nur in der App"), "Nach 3 Probestarts: Paket-Bildschirm (im Browser kein Kauf)");
  await page.goto(APP);
  await page.click(".hometile.teach");
  await page.click('.gametile:has-text("Domino")');
  await page.click("text=QR-Code präsentieren");
  ok(await page.isVisible("text=3 von 3"), "Probestarts zählen je Spiel getrennt");
  await page.click("text=Abbrechen");
  ok(await page.evaluate(() => trialsLeft("domino")) === 3, "Abbrechen verbraucht keinen Probestart");
  await page.click("text=Selbst ausprobieren");
  ok(await page.isVisible(".stone-btn"), "„Selbst ausprobieren“ bleibt ohne Paket frei");

  /* Kauf mit nachgebautem Store */
  await page.addInitScript(FAKE_STORE);
  await page.goto(APP);
  await page.evaluate(() => window.__fireDeviceReady());
  await page.evaluate(() => screenPaywall("bingo"));
  await page.waitForFunction(() => /4,99 €/.test(document.querySelector(".pro-head") ? document.body.textContent : ""), null, { timeout: 3000 });
  ok(await page.isVisible("text=Für 4,99 € freischalten"), "Kaufknopf zeigt den Preis aus dem Store");
  await page.click("text=Für 4,99 € freischalten");
  await page.waitForSelector(".pro-status:not([hidden])", { timeout: 3000 });
  ok(await page.evaluate(() => isPro()), "Kauf schaltet das Lehrkraft-Paket frei");
  await presentBingo();
  ok(!(await page.isVisible(".dlg-box")) && await page.isVisible(".present .qrcanvas"), "Mit Paket: Bingo ohne Probestart-Dialog");
  await page.evaluate(() => { localStorage.removeItem("mathesnack.pro"); sessionStorage.setItem("fakeOwned", "1"); });
  await page.goto(APP); await page.evaluate(() => window.__fireDeviceReady());
  await page.waitForTimeout(150);
  ok(await page.evaluate(() => isPro()), "Beim Start erkennt die App einen bestehenden Kauf");
  await page.evaluate(() => localStorage.removeItem("mathesnack.pro"));
  await page.goto(APP);
  await page.click(".gear");
  await page.click("text=Käufe wiederherstellen");
  await page.waitForTimeout(150);
  ok(await page.evaluate(() => isPro()) && await page.isVisible("text=Lehrkraft-Paket ist freigeschaltet"), "„Käufe wiederherstellen“ in den Einstellungen");

  /* ---------- Schülergerät-Modus ---------- */
  const p2 = await ctx.newPage(); watch(p2);
  await p2.goto(APP);
  await p2.click(".gear");
  await p2.click("text=Schülergerät-Modus einschalten");
  await p2.fill(".dlg-box input", "12");
  await p2.click(".dlg-box .btn.primary");
  ok(await p2.isVisible(".dlg-box"), "Zu kurze PIN wird abgelehnt");
  await p2.fill(".dlg-box input", "4711");
  await p2.click(".dlg-box .btn.primary");
  await p2.waitForTimeout(200);
  ok(!(await p2.isVisible("text=Käufe wiederherstellen")) && !(await p2.isVisible("text=Lehrkraft-Paket ansehen")) && await p2.isVisible("text=Schülergerät-Modus ausschalten"), "Schülergerät-Modus blendet Kauf aus");
  await p2.click("#btnBack");
  ok(await p2.locator(".hometile").count() === 3 && !(await p2.isVisible(".hometile.teach")), "Schülergerät-Modus blendet „Spiel für die Klasse“ aus");
  await p2.click(".gear");
  await p2.click("text=Schülergerät-Modus ausschalten");
  await p2.fill(".dlg-box input", "0000");
  await p2.click(".dlg-box .btn.primary");
  ok(await p2.evaluate(() => store.get("studentMode", false)) === true, "Falsche PIN schaltet nicht aus");
  await p2.fill(".dlg-box input", "4711");
  await p2.click(".dlg-box .btn.primary");
  ok(await p2.evaluate(() => store.get("studentMode", false)) === false, "Richtige PIN schaltet aus");
  await p2.close();

  /* ---------- Spiele auf Deutsch und Englisch ---------- */
  for (const lang of ["de", "en"]) {
    await page.goto(APP);
    await page.evaluate(l => { store.set("lang", l); }, lang);
    await page.reload();
    const L = lang === "de" ? { go: "Los geht's", check: "Prüfen", feuer: "Feuer!", solo: "Ohne Beamer spielen", next: "Nächste Aufgabe" } : { go: "Let's go", check: "Check", feuer: "Fire!", solo: "Play without projector", next: "Next question" };

    await open({ g: 0, t: 0, a: 0, b: 0, seed: 4242 });
    await page.click(`text=${L.go}`);
    await page.waitForSelector(".opt", { timeout: 5000 });
    let right = 0;
    for (let i = 0; i < 5; i++) {
      const q = (await page.textContent(".prompt")).replace(" = ?", "").trim();
      const val = String(Function(`return (${q.replace(/[·×]/g, "*").replace(/[:÷]/g, "/")})`)());
      const btn = page.locator(".opt", { hasText: new RegExp("^" + val + "$") });
      if (await btn.count()) { await btn.first().click(); right++; await page.waitForTimeout(350); }
    }
    ok(right === 5 && /✓ 5/.test(await page.textContent(".hud")), `[${lang}] Sprint zählt richtige Antworten (${lang === "en" ? "× ÷" : "· :"})`);

    await open({ g: 1, t: 2, a: 0, b: 0, seed: 7 });
    await page.click(`text=${L.go}`);
    await page.click(".stmt >> nth=0");
    await page.click(`text=${L.check}`);
    ok(await page.locator(".stmt.found, .stmt.missed").count() >= 1, `[${lang}] Fehlersuche markiert falsche Rechnungen`);

    await open({ g: 2, t: 8, a: 0, b: 0, seed: 7 });
    await page.click(".mcard >> nth=0"); await page.click(".mcard >> nth=1");
    ok(await page.locator(".mcard.up, .mcard.done").count() === 2 && await page.locator(".mcard svg.graph").count() >= 6, `[${lang}] Memory mit Graphen`);

    await open({ g: 3, t: 3, a: 0, b: 0, seed: 7 });
    for (let step = 0; step < 9 && !(await page.isVisible(".result-big")); step++) {
      const n = await page.locator(".stone-btn").count();
      for (let i = 0; i < n; i++) {
        const before = await page.locator(".stone-btn").count();
        await page.locator(".stone-btn").nth(i).click();
        if (await page.locator(".stone-btn").count() < before || await page.isVisible(".result-big")) break;
      }
    }
    ok(await page.isVisible(".result-big"), `[${lang}] Domino lässt sich bis ins Ziel legen`);

    await open({ g: 4, t: 7, a: 0, b: 0, seed: 7 });
    ok(await page.locator(".pairs svg.graph").count() === 4, `[${lang}] Zuordnen zeigt vier Graphen`);

    const bingo = { g: 5, t: 1, a: 1, b: 0, seed: 99 };
    await open(bingo);
    ok(await page.locator(".bcell").count() === 16, `[${lang}] Bingo-Karte 4 × 4`);
    await page.click(`text=${L.solo}`);
    const firstCall = (await page.textContent(".solo-call .prompt")).trim();
    await page.goto(APP);
    await page.evaluate(c => screenLeader(c), bingo);
    await page.click(`text=${L.next}`);
    ok((await page.textContent(".lead-prompt")).trim() === firstCall, `[${lang}] Beamer und Schülergerät ziehen dieselbe erste Aufgabe`);

    await open({ g: 6, t: 0, a: 0, b: 1, seed: 7 });
    await page.click('[aria-label="' + (lang === "de" ? "x erhöhen" : "Increase x") + '"]');
    await page.click(`text=${L.feuer}`);
    ok(new RegExp(lang === "de" ? "\\(1 \\| 0\\)" : "\\(1, 0\\)").test(await page.textContent(".shotmsg")), `[${lang}] Schiffe: Koordinaten in ${lang === "de" ? "(x | y)" : "(x, y)"}`);
    await open({ g: 6, t: 0, a: 1, b: 2, seed: 7 });
    ok(await page.locator(".b-ship").count() === 5, `[${lang}] Partnerspiel zeigt die eigene Flotte`);

    await open({ g: 7, t: 0, a: 0, b: 2, seed: lang === "de" ? 7 : 8 });
    await page.click(".opt >> nth=0");
    ok(await page.locator(".slot.filled").count() === 1, `[${lang}] Rallye sammelt den Buchstaben`);

    await page.setViewportSize({ width: 1280, height: 800 });
    await open({ g: 8, t: 1, a: 0, b: 1, seed: 7 });
    await page.click(`text=${L.go}`);
    await page.waitForSelector(".cmp", { timeout: 5000 });
    ok(true, `[${lang}] Move & Brain startet`);
    await page.setViewportSize({ width: 400, height: 860 });
  }

  /* ---------- Stationskarten als PDF ---------- */
  await page.goto(APP);
  await page.evaluate(() => { store.set("lang", "de"); store.set("pro", true); });
  await page.goto(APP);
  await page.evaluate(() => screenStations({ g: 7, t: 3, a: 1, b: 0, seed: 555 }));
  const decoded = await readQr(page, ".scard .qrcanvas");
  ok(decoded.length === 6 && decoded.every(Boolean), "Alle 6 Stationskarten am Bildschirm lesbar");
  const stations = await page.evaluate(list => list.map(u => decodeCode(u).b), decoded);
  ok(JSON.stringify(stations) === "[1,2,3,4,5,6]", "Stationskarten tragen die Nummern 1–6");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("text=Als PDF teilen / drucken")]);
  const fs = require("fs");
  const file = await dl.path();
  const pdf = fs.readFileSync(file);
  ok(dl.suggestedFilename() === "MatheSnack-Rallye.pdf" && pdf.slice(0, 5).toString() === "%PDF-" && /%%EOF\s*$/.test(pdf.slice(-10).toString()), "PDF erzeugt: " + dl.suggestedFilename() + ", " + pdf.length + " Byte");
  const pagesCount = (pdf.toString("latin1").match(/\/Type \/Page\b/g) || []).length;
  ok(pagesCount === 3, `PDF hat 3 Seiten (Lösung + 2 × 4 Karten), gefunden: ${pagesCount}`);
  if (process.env.PDF_OUT) fs.copyFileSync(file, process.env.PDF_OUT);

  /* Scanner-Seite öffnet ohne Fehler (Kamera gibt es im Test nicht) */
  await page.goto(APP);
  await page.click(".hometile.scan");
  await page.waitForTimeout(300);
  ok(await page.isVisible(".scanner"), "Scanner-Seite öffnet");

  ok(errors.length === 0, "Keine Fehler in der Konsole" + (errors.length ? ":\n  " + errors.join("\n  ") : ""));
  await browser.close();
  console.log(fehler ? `\n${fehler} Fehler` : "\nAlles in Ordnung");
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
