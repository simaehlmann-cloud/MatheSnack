/* MatheSnack – Ablauftest im echten Browser (läuft in beiden Workflows)
   Vorher: python3 -m http.server 8765   (im Repo-Ordner)
   Dann:   node smoketest.js
   Spielt jedes Spiel an, liest den präsentierten QR-Code mit einem
   unabhängigen Decoder (jsQR) zurück und prüft, dass keine Fehler auftreten. */
"use strict";
const { chromium } = require("playwright");
const jsQR = require("jsqr");

const BASE = process.env.BASE || "http://localhost:8765/index.html";
let fehler = 0;
const ok = (c, m) => { if (c) console.log("✓ " + m); else { fehler++; console.error("✗ " + m); } };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 860 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/cordova\.js|404/.test(m.text())) errors.push(m.text()); });
  page.on("requestfailed", r => { if (!/cordova\.js/.test(r.url())) errors.push("Anfrage fehlgeschlagen: " + r.url()); });

  const open = async cfg => {
    const code = await page.evaluate(c => encodeCode(c), cfg);
    await page.goto(BASE + "#s=" + code);
    await page.waitForTimeout(250);
    return code;
  };

  /* Startseite */
  await page.goto(BASE);
  ok(await page.isVisible("text=QR-Code scannen"), "Startseite zeigt die vier Kacheln");

  /* Lehrkraft: Spiel einstellen, QR präsentieren, QR zurücklesen */
  await page.click("text=Spiel für die Klasse");
  await page.click("text=Fehlersuche");
  await page.selectOption("#fTopic", "5");
  await page.click("text=QR-Code präsentieren");
  await page.waitForSelector(".present .qrcanvas");
  const shown = (await page.textContent(".present-code")).replace(/-/g, "");
  const qr = await page.evaluate(() => {
    const c = document.querySelector(".present .qrcanvas");
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height);
    return { w: c.width, h: c.height, data: Array.from(d.data) };
  });
  const res = jsQR(Uint8ClampedArray.from(qr.data), qr.w, qr.h);
  ok(res && /#s=[0-9A-Z]{15}$/.test(res.data), "QR-Code lässt sich mit jsQR lesen: " + (res && res.data));
  ok(res && res.data.endsWith("#s=" + shown), "QR-Code und angezeigter Code stimmen überein");
  const cfg = await page.evaluate(c => decodeCode(c), shown);
  ok(cfg && cfg.g === 1 && cfg.t === 5, "Code enthält Spiel Fehlersuche und Thema Terme");

  /* Schülerseite: Link öffnen wie nach dem Scannen */
  await page.goto(res.data.replace(/^https?:\/\/[^#]+/, BASE));
  await page.waitForTimeout(250);
  ok(await page.isVisible("text=Los geht's"), "Link aus dem QR-Code startet das Spiel");

  /* Code von Hand eingeben, auch klein und mit Leerzeichen */
  await page.goto(BASE);
  await page.click("text=Code eingeben");
  await page.fill("#codeInput", shown.toLowerCase().replace(/(.{5})/g, "$1 "));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  ok(await page.isVisible("text=Fehlersuche >> nth=0"), "Eingetippter Code startet das Spiel");
  await page.goto(BASE);
  await page.click("text=Code eingeben");
  await page.fill("#codeInput", "ABCDE-FGHJK-MNPQR");
  await page.keyboard.press("Enter");
  ok(/stimmt nicht/.test(await page.textContent(".msg")), "Falscher Code wird abgelehnt");

  /* Sprint: richtige Antwort per Spiellogik finden und antippen */
  await open({ g: 0, t: 0, a: 0, b: 0, seed: 4242 });
  await page.click("text=Los geht's");
  await page.waitForSelector(".opt", { timeout: 5000 });
  let right = 0;
  for (let i = 0; i < 5; i++) {
    const q = (await page.textContent(".prompt")).replace(" = ?", "").trim();
    const val = String(Function(`return (${q.replace(/·/g, "*").replace(/:/g, "/")})`)());
    const btn = page.locator(".opt", { hasText: new RegExp("^" + val + "$") });
    if (await btn.count()) { await btn.first().click(); right++; await page.waitForTimeout(350); }
  }
  ok(right === 5 && /✓ 5/.test(await page.textContent(".hud")), "Sprint zählt richtige Antworten");

  /* Fehlersuche: prüfen zeigt Lösungen */
  await open({ g: 1, t: 1, a: 0, b: 0, seed: 7 });
  await page.click("text=Los geht's");
  await page.click(".stmt >> nth=0");
  await page.click("text=Prüfen");
  ok(await page.locator(".stmt.found, .stmt.missed").count() >= 1, "Fehlersuche markiert falsche Rechnungen");

  /* Memory: zwei Karten aufdecken */
  await open({ g: 2, t: 8, a: 0, b: 0, seed: 7 });
  await page.click(".mcard >> nth=0"); await page.click(".mcard >> nth=1");
  ok(await page.locator(".mcard.up, .mcard.done").count() === 2 && await page.locator(".mcard svg.graph").count() >= 6, "Memory deckt auf und zeigt Graphen");

  /* Domino: Kette vollständig legen */
  await open({ g: 3, t: 0, a: 0, b: 0, seed: 7 });
  for (let step = 0; step < 8; step++) {
    const n = await page.locator(".stone-btn").count();
    for (let i = 0; i < n; i++) {
      const before = await page.locator(".stone-btn").count();
      await page.locator(".stone-btn").nth(i).click();
      if (await page.locator(".stone-btn").count() < before || await page.isVisible(".result-big")) break;
    }
    if (await page.isVisible(".result-big")) break;
  }
  ok(await page.isVisible(".result-big"), "Domino lässt sich bis ins Ziel legen");

  /* Zuordnen mit Graphen */
  await open({ g: 4, t: 7, a: 0, b: 0, seed: 7 });
  ok(await page.locator(".pairs svg.graph").count() === 4, "Zuordnen zeigt vier Graphen");

  /* Bingo: Karte, Prüfung, Spielleitung mit gleicher Aufgabenfolge */
  const bingo = { g: 5, t: 0, a: 1, b: 0, seed: 99 };
  await open(bingo);
  ok(await page.locator(".bcell").count() === 16, "Bingo-Karte hat 4 × 4 Felder");
  await page.click("text=Ohne Beamer spielen");
  const firstCall = (await page.textContent(".solo-call .prompt")).trim();
  await page.goto(BASE);
  await page.evaluate(c => screenLeader(c), bingo);
  await page.click("text=Nächste Aufgabe");
  ok((await page.textContent(".lead-prompt")).trim() === firstCall, "Beamer und Schülergerät ziehen dieselbe erste Aufgabe");

  /* Schiffe: allein, Partner, Beamer */
  await open({ g: 6, t: 0, a: 0, b: 1, seed: 7 });
  await page.click("text=Feuer!");
  ok(/Schüsse: 1/.test(await page.textContent(".hud")), "Schiffe versenken (allein) nimmt Schüsse an");
  await open({ g: 6, t: 0, a: 1, b: 2, seed: 7 });
  ok(await page.locator(".b-ship").count() === 5, "Partnerspiel zeigt die eigene Flotte");
  await open({ g: 6, t: 0, a: 0, b: 0, seed: 7 });
  ok(await page.isVisible("text=Flotte aufdecken"), "Beamer-Modus startet");

  /* Rallye: Station beantworten, Buchstabe landet im Lösungswort */
  await open({ g: 7, t: 0, a: 0, b: 2, seed: 7 });
  await page.click(".opt >> nth=0");
  ok(await page.locator(".slot.filled").count() === 1, "Rallye sammelt den Buchstaben von Station 2");

  /* Stationskarten: QR-Codes lesbar */
  await page.goto(BASE);
  await page.evaluate(() => screenStations({ g: 7, t: 3, a: 0, b: 0, seed: 555 }));
  const cards = await page.evaluate(() => [...document.querySelectorAll(".scard .qrcanvas")].map(c => {
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height);
    return { w: c.width, h: c.height, data: Array.from(d.data) };
  }));
  const decoded = cards.map(c => jsQR(Uint8ClampedArray.from(c.data), c.w, c.h)).map(r => r && r.data);
  ok(decoded.length === 5 && decoded.every(Boolean), "Alle 5 Stationskarten lesbar");
  const stations = await page.evaluate(list => list.map(u => decodeCode(u).b), decoded);
  ok(JSON.stringify(stations) === "[1,2,3,4,5]", "Stationskarten tragen die Nummern 1–5");

  /* Bewegungspause */
  await page.setViewportSize({ width: 1280, height: 800 });
  await open({ g: 8, t: 1, a: 0, b: 1, seed: 7 });
  await page.click("text=Los geht's");
  await page.waitForSelector(".cmp", { timeout: 5000 });
  ok(true, "Move & Brain startet am Beamer");

  ok(errors.length === 0, "Keine Fehler in der Konsole" + (errors.length ? ":\n  " + errors.join("\n  ") : ""));
  await browser.close();
  console.log(fehler ? `\n${fehler} Fehler` : "\nAlles in Ordnung");
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
