/* MatheSnack – Oberfläche: Navigation, Startseite, Code-Eingabe, Scanner,
   Ergebnis, Service Worker */
"use strict";

/* ---------- Navigation ---------- */
let leaveFns = [];
function onLeave(fn) { leaveFns.push(fn); }
function runLeave() { const f = leaveFns; leaveFns = []; f.forEach(fn => { try { fn(); } catch (e) { /* weiter */ } }); }

function go(render, opt = {}) {
  runLeave();
  const view = $("#view");
  view.replaceChildren();
  view.className = "view" + (opt.wide ? " wide" : "");
  $("#barTitle").textContent = opt.title || "MatheSnack";
  $("#btnBack").hidden = !!opt.home;
  document.body.classList.toggle("is-home", !!opt.home);
  render(view);
  window.scrollTo(0, 0);
  const firstHeading = view.querySelector("h2, .lead, .center-stage");
  if (firstHeading && !opt.home) { firstHeading.setAttribute("tabindex", "-1"); firstHeading.focus({ preventScroll: true }); }
}
function goHome() { screenHome(); }

/* ---------- Dialoge ---------- */
function dialog(title, body, buttons) {
  const dlg = $("#dlg");
  const box = h("div", { class: "dlg-box", role: "dialog", "aria-modal": "true", "aria-label": title },
    h("h3", null, title),
    typeof body === "string" ? h("p", null, body) : body,
    h("div", { class: "row end" }, buttons.map(b => h("button", { class: "btn" + (b.primary ? " primary" : ""), type: "button", onclick: () => {
      if (b.action && b.action() === false) return;
      close();
    } }, b.label))));
  function close() { dlg.hidden = true; dlg.replaceChildren(); document.removeEventListener("keydown", esc); }
  function esc(e) { if (e.key === "Escape") close(); }
  dlg.replaceChildren(box);
  dlg.hidden = false;
  document.addEventListener("keydown", esc);
  const pb = box.querySelector(".btn.primary");
  if (pb && !box.querySelector("input")) pb.focus();
}
function confirmDialog(text, onYes) {
  dialog("Sicher?", text, [{ label: "Abbrechen" }, { label: "Ja", primary: true, action: onYes }]);
}

/* ---------- Startseite ---------- */
function screenHome() {
  go(root => {
    root.append(
      h("section", { class: "hero" },
        h("img", { src: "icon-192.png", alt: "", class: "hero-logo", width: 72, height: 72 }),
        h("h2", null, "MatheSnack"),
        h("p", null, "Kurze Mathe-Spiele zum Stundenbeginn – per QR-Code, ohne Anmeldung, ohne Server.")),
      h("div", { class: "hometiles" },
        h("button", { class: "hometile scan", type: "button", onclick: openScanner },
          h("span", { class: "ht-icon", "aria-hidden": "true" }, "📷"), h("strong", null, "QR-Code scannen"), h("span", null, "Code von der Tafel oder Station")),
        h("button", { class: "hometile code", type: "button", onclick: screenEnterCode },
          h("span", { class: "ht-icon", "aria-hidden": "true" }, "⌨️"), h("strong", null, "Code eingeben"), h("span", null, "15 Zeichen von Tafel oder Beamer")),
        h("button", { class: "hometile teach", type: "button", onclick: () => screenChooseGame("teach") },
          h("span", { class: "ht-icon", "aria-hidden": "true" }, "🏫"), h("strong", null, "Spiel für die Klasse"), h("span", null, "Lehrkraft: Thema wählen, QR-Code zeigen")),
        h("button", { class: "hometile self", type: "button", onclick: () => screenChooseGame("self") },
          h("span", { class: "ht-icon", "aria-hidden": "true" }, "🎮"), h("strong", null, "Selbst üben"), h("span", null, "Alle Spiele ohne Code"))),
      h("footer", { class: "foot" },
        h("p", null, "Keine Konten, keine Werbung, kein Tracking. Alles bleibt auf diesem Gerät."),
        h("p", null, h("a", { href: "datenschutz.html" }, "Datenschutz"), " · ", h("a", { href: "impressum.html" }, "Impressum"), " · ", h("span", null, "Version " + APP_VERSION)),
        h("p", null, h("button", { class: "linkbtn muted-link", type: "button", onclick: clearLocalData }, "Gespeicherte Daten löschen"))));
  }, { title: "MatheSnack", home: true });
}

/* Einstellungen, Bestleistungen und Rallye-Buchstaben auf diesem Gerät löschen */
function clearLocalData() {
  confirmDialog("Alle auf diesem Gerät gespeicherten MatheSnack-Daten löschen (Einstellungen, Bestleistungen, Rallye-Buchstaben)?", () => {
    try {
      Object.keys(localStorage).filter(k => k.startsWith("mathesnack.")).forEach(k => localStorage.removeItem(k));
      Object.keys(sessionStorage).filter(k => k.startsWith("bingo.")).forEach(k => sessionStorage.removeItem(k));
    } catch (e) { /* egal */ }
    toast("Gespeicherte Daten gelöscht.");
  });
}

/* ---------- Code eingeben ---------- */
function screenEnterCode(prefill) {
  go(root => {
    const inp = h("input", { class: "codeinput", id: "codeInput", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", maxlength: 40, placeholder: "XXXXX-XXXXX-XXXXX", "aria-label": "Spielcode", value: typeof prefill === "string" ? prefill : "" });
    const msg = h("p", { class: "msg", role: "status" });
    inp.addEventListener("input", () => {
      const raw = normalizeCode(inp.value);
      if (raw.length <= 15 && !/[#=\/]/.test(inp.value)) {
        const pos = inp.selectionStart === inp.value.length;
        inp.value = codeGroups(raw);
        if (pos) inp.selectionStart = inp.selectionEnd = inp.value.length;
      }
      msg.textContent = "";
    });
    const submit = () => {
      const cfg = decodeCode(inp.value);
      if (cfg) { playGame(cfg); return; }
      const n = normalizeCode(inp.value).length;
      msg.textContent = n !== 15 ? `Der Code hat 15 Zeichen – du hast ${n}.` : "Dieser Code stimmt nicht. Prüfe die Zeichen noch einmal.";
      inp.classList.remove("shake"); void inp.offsetWidth; inp.classList.add("shake");
    };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
    root.append(h("div", { class: "center-stage" },
      h("p", { class: "lead" }, "Gib den Code ein, den deine Lehrkraft zeigt. Bindestriche und Groß-/Kleinschreibung sind egal."),
      inp, msg,
      h("button", { class: "btn primary xl", type: "button", onclick: submit }, "Spiel starten")));
    setTimeout(() => inp.focus(), 50);
  }, { title: "Code eingeben" });
}

/* ---------- Spiel starten ---------- */
function playGame(cfg, opt = {}) {
  const g = GAMES[cfg.g];
  go(root => {
    const ctx = {
      cfg, root,
      items: (n, o) => makeItems(cfg.t, makeRng(cfg.seed), n, o),
      finish: res => screenResult(cfg, res),
      onLeave
    };
    g.play(ctx);
  }, { title: g.name, wide: !!opt.beamer || g.beamerOnly || (g.key === "schiffe" && cfg.b === 0) });
}

function screenResult(cfg, res) {
  const g = GAMES[cfg.g];
  go(root => {
    let bestLine = null;
    if (res.record) {
      const key = `best.${res.record.key}.${cfg.t}.${cfg.a}`;
      const prev = store.get(key, null);
      const better = prev == null || (res.record.lower ? res.record.value < prev : res.record.value > prev);
      if (better) store.set(key, res.record.value);
      bestLine = prev == null ? null : better ? "🏅 Neue Bestleistung auf diesem Gerät!" : `Deine Bestleistung: ${prev}${res.record.key === "fehler" ? " %" : ""}`;
    }
    root.append(h("div", { class: "center-stage result" },
      h("div", { class: "big-icon", "aria-hidden": "true" }, g.icon),
      h("div", { class: "result-big" }, String(res.big)),
      h("div", { class: "result-unit" }, res.unit),
      (res.lines || []).map(l => h("p", { class: "muted" }, l)),
      bestLine ? h("p", { class: "best" }, bestLine) : null,
      h("div", { class: "row center" },
        h("button", { class: "btn primary", type: "button", onclick: () => playGame(cfg) }, "Nochmal"),
        h("button", { class: "btn", type: "button", onclick: () => playGame({ ...cfg, seed: newSeed() }) }, "Neue Aufgaben")),
      h("button", { class: "btn ghost", type: "button", onclick: goHome }, "Zur Startseite")));
  }, { title: g.name });
}

/* ---------- QR-Scanner (Kamera im Browser bzw. in der App-Hülle) ----------
   Erkennung mit jsQR auf dem Gerät. Kein Bild verlässt das Gerät. */
function handleScanned(text) {
  const cfg = decodeCode(text);
  if (cfg) { vibrate(40); playGame(cfg); return true; }
  return false;
}
async function androidCameraPermission() {
  const p = window.cordova && window.cordova.plugins && window.cordova.plugins.permissions;
  if (!onAndroid() || !p) return true;
  return new Promise(resolve => {
    p.checkPermission(p.CAMERA, st => {
      if (st.hasPermission) { resolve(true); return; }
      p.requestPermission(p.CAMERA, r2 => resolve(!!r2.hasPermission), () => resolve(false));
    }, () => resolve(false));
  });
}
function openScanner() {
  go(root => {
    const video = h("video", { playsinline: true, muted: true, autoplay: true, class: "scanvideo" });
    const status = h("p", { class: "msg", role: "status" }, "Kamera wird gestartet …");
    const frame = h("div", { class: "scanframe" }, video, h("div", { class: "scanbox", "aria-hidden": "true" }));
    const fileIn = h("input", { type: "file", accept: "image/*", capture: "environment", class: "visually-hidden", id: "scanFile" });
    const photoBtn = h("label", { class: "btn", for: "scanFile" }, "📸 Foto aufnehmen");
    let stream = null, raf = 0, stopped = false, lastBad = 0;
    const cv = document.createElement("canvas");
    const cx = cv.getContext("2d", { willReadFrequently: true });
    function stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    onLeave(stop);
    function scanFrame() {
      if (stopped) return;
      if (video.readyState >= 2 && video.videoWidth) {
        const sc = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
        cv.width = Math.round(video.videoWidth * sc); cv.height = Math.round(video.videoHeight * sc);
        cx.drawImage(video, 0, 0, cv.width, cv.height);
        const img = cx.getImageData(0, 0, cv.width, cv.height);
        const res = window.jsQR ? jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" }) : null;
        if (res && res.data) {
          if (handleScanned(res.data)) { stop(); return; }
          if (Date.now() - lastBad > 2500) { lastBad = Date.now(); status.textContent = "Das ist kein MatheSnack-Code."; }
        }
      }
      raf = requestAnimationFrame(scanFrame);
    }
    async function start() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        status.textContent = "Live-Kamera ist hier nicht verfügbar. Nimm ein Foto vom QR-Code auf oder gib den Code ein.";
        frame.hidden = true; return;
      }
      if (!(await androidCameraPermission())) {
        status.textContent = "Ohne Kamera-Erlaubnis geht das Scannen nicht. Du kannst den Code auch eingeben.";
        frame.hidden = true; return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
        if (stopped) { stop(); return; }
        video.srcObject = stream;
        await video.play().catch(() => {});
        status.textContent = "Halte den QR-Code in den Rahmen.";
        raf = requestAnimationFrame(scanFrame);
      } catch (e) {
        status.textContent = "Die Kamera ließ sich nicht starten. Nimm ein Foto auf oder gib den Code ein.";
        frame.hidden = true;
      }
    }
    fileIn.addEventListener("change", () => {
      const f = fileIn.files && fileIn.files[0];
      if (!f) return;
      const img = new Image();
      const url = URL.createObjectURL(f);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let found = null;
        for (const max of [1000, 1600, 700]) {
          const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          cv.width = Math.round(img.naturalWidth * sc); cv.height = Math.round(img.naturalHeight * sc);
          cx.drawImage(img, 0, 0, cv.width, cv.height);
          const d = cx.getImageData(0, 0, cv.width, cv.height);
          const res = jsQR(d.data, d.width, d.height);
          if (res && res.data) { found = res.data; break; }
        }
        fileIn.value = "";
        if (found && handleScanned(found)) { stop(); return; }
        status.textContent = found ? "Das ist kein MatheSnack-Code." : "Auf dem Foto wurde kein QR-Code gefunden. Noch einmal näher heran?";
      };
      img.onerror = () => { status.textContent = "Das Foto ließ sich nicht lesen."; };
      img.src = url;
    });
    root.append(h("div", { class: "scanner" }, frame, status,
      h("div", { class: "row center" }, photoBtn, fileIn, h("button", { class: "btn ghost", type: "button", onclick: () => screenEnterCode() }, "⌨️ Code eingeben")),
      h("p", { class: "muted small center" }, "Tipp: Die normale Kamera-App deines Handys erkennt den QR-Code auch – der Link öffnet das Spiel direkt.")));
    start();
  }, { title: "QR-Code scannen" });
}

/* ---------- Start ---------- */
function openFromHash() {
  const m = location.hash.match(/[#&]s=([0-9A-Za-z\-]+)/);
  if (!m) return false;
  const cfg = decodeCode(m[1]);
  try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* egal */ }
  if (!cfg) { screenEnterCode(m[1]); toast("Dieser Code ist ungültig oder unvollständig."); return true; }
  playGame(cfg);
  return true;
}
function registerSW() {
  if (!("serviceWorker" in navigator) || inApp() || !/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register("./sw.js").then(reg => {
    reg.addEventListener("updatefound", () => {
      const fresh = reg.installing;
      if (!fresh) return;
      fresh.addEventListener("statechange", () => {
        if (fresh.state === "installed" && navigator.serviceWorker.controller) {
          const t = $("#toast");
          t.replaceChildren("Neue Version verfügbar. ", h("button", { class: "linkbtn", type: "button", onclick: () => fresh.postMessage({ type: "SKIP_WAITING" }) }, "Aktualisieren"));
          t.hidden = false;
        }
      });
    });
  }).catch(() => { /* offline-Fähigkeit ist ein Bonus */ });
  /* Neu laden nur nach einem bestätigten Update. Beim allerersten Besuch
     übernimmt der Worker ebenfalls (clients.claim) – ein Neuladen würde dann
     das gerade gestartete Spiel abbrechen. */
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
}

$("#btnBack").addEventListener("click", goHome);
window.addEventListener("hashchange", openFromHash);
document.addEventListener("backbutton", e => { e.preventDefault(); if (!$("#dlg").hidden) { $("#dlg").hidden = true; return; } if (document.body.classList.contains("is-home")) { if (navigator.app && navigator.app.exitApp) navigator.app.exitApp(); } else goHome(); }, false);
if (!openFromHash()) screenHome();
window.addEventListener("load", () => setTimeout(registerSW, 800));
