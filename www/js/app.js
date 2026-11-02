/* MatheSnack – Oberfläche: Navigation, Startseite, Einstellungen,
   Code-Eingabe, Kamera-Scanner, Ergebnis, geöffnete Links */
"use strict";

/* ---------- Navigation ---------- */
let leaveFns = [];
let currentScreen = { name: "home", redraw: null };
function onLeave(fn) { leaveFns.push(fn); }
function runLeave() { const f = leaveFns; leaveFns = []; f.forEach(fn => { try { fn(); } catch (e) { /* weiter */ } }); }

/* opt.name/opt.redraw: Bildschirme, die bei Sprachwechsel neu gezeichnet werden */
function go(render, opt = {}) {
  runLeave();
  closeDialog();
  const view = $("#view");
  view.replaceChildren();
  /* Ausgeblendete Teile (null/false) nicht als Text „null“ einfügen */
  if (!view.safeAppend) {
    const native = view.append.bind(view);
    view.append = (...kids) => native(...kids.flat(Infinity).filter(k => k != null && k !== false));
    view.safeAppend = true;
  }
  view.className = "view" + (opt.wide ? " wide" : "");
  $("#barTitle").textContent = opt.title || "MatheSnack";
  $("#btnBack").textContent = "‹ " + t("nav.home");
  $("#btnBack").setAttribute("aria-label", t("nav.homeAria"));
  $("#btnBack").hidden = !!opt.home;
  document.body.classList.toggle("is-home", !!opt.home);
  currentScreen = { name: opt.name || "", redraw: opt.redraw || null };
  render(view);
  window.scrollTo(0, 0);
  const first = view.querySelector("h2, .lead, .center-stage");
  if (first && !opt.home) { first.setAttribute("tabindex", "-1"); first.focus({ preventScroll: true }); }
}
function goHome() { screenHome(); }

/* ---------- Dialoge ---------- */
let dialogEsc = null;
function closeDialog() {
  const dlg = $("#dlg");
  if (!dlg || dlg.hidden) return;
  dlg.hidden = true; dlg.replaceChildren();
  if (dialogEsc) document.removeEventListener("keydown", dialogEsc);
  dialogEsc = null;
}
function dialog(title, body, buttons) {
  closeDialog();
  const dlg = $("#dlg");
  const box = h("div", { class: "dlg-box", role: "dialog", "aria-modal": "true", "aria-label": title },
    h("h3", null, title),
    typeof body === "string" ? h("p", null, body) : body,
    h("div", { class: "row end" }, buttons.map(b => h("button", { class: "btn" + (b.primary ? " primary" : ""), type: "button", onclick: () => {
      if (b.action && b.action() === false) return;
      closeDialog();
    } }, b.label))));
  dialogEsc = e => { if (e.key === "Escape") closeDialog(); };
  dlg.replaceChildren(box);
  dlg.hidden = false;
  document.addEventListener("keydown", dialogEsc);
  const pb = box.querySelector(".btn.primary");
  if (pb && !box.querySelector("input")) pb.focus();
}
function confirmDialog(text, onYes) {
  dialog(t("confirm.title"), text, [{ label: t("cancel") }, { label: t("yes"), primary: true, action: onYes }]);
}

/* ---------- Sprache, Darstellung, Schrift ---------- */
function langSwitch() {
  return h("div", { class: "lang", role: "group", "aria-label": t("set.language") },
    [["de", "🇩🇪", "Deutsch"], ["en", "🇬🇧", "English"]].map(([code, flag, label]) =>
      h("button", { type: "button", class: "langbtn", "data-lang": code, "aria-label": label, "aria-pressed": String(LANG === code), onclick: () => changeLang(code) }, flag)));
}
function changeLang(code) {
  if (code === LANG) return;
  setLang(code);
  store.set("lang", code);
  if (currentScreen.redraw) currentScreen.redraw();
}
function applyTheme() {
  const m = store.get("theme", "auto");
  document.documentElement.setAttribute("data-theme", ["auto", "light", "dark"].includes(m) ? m : "auto");
  applyStatusBar();
}
function isDark() {
  const m = document.documentElement.getAttribute("data-theme");
  return m === "dark" || (m !== "light" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
}
function applyStatusBar() {
  try {
    if (window.StatusBar) { if (isDark()) StatusBar.styleLightContent(); else StatusBar.styleDefault(); }
  } catch (e) { /* ohne Statusleiste weiter */ }
}
function applyBeam() {
  const v = store.get("beam", 1);
  document.documentElement.style.setProperty("--beam", String([1, 1.25, 1.5].includes(v) ? v : 1));
}

/* ---------- Startseite ---------- */
function screenHome() {
  const student = store.get("studentMode", false) === true;
  go(root => {
    root.append(
      h("div", { class: "homebar" },
        langSwitch(),
        h("button", { type: "button", class: "iconbtn gear", "aria-label": t("settings.title"), onclick: screenSettings },
          h("span", { "aria-hidden": "true" }, "⚙️"))),
      h("section", { class: "hero" },
        h("img", { src: "icon-192.png", alt: "", class: "hero-logo", width: 72, height: 72 }),
        h("h2", null, "MatheSnack"),
        h("p", null, t("home.tagline"))),
      h("div", { class: "hometiles" + (student ? " three" : "") },
        h("button", { class: "hometile scan", type: "button", onclick: openScanner },
          h("span", { class: "ht-icon", "aria-hidden": "true" }, "📷"), h("strong", null, t("home.scan")), h("span", null, t("home.scan.sub"))),
        h("button", { class: "hometile code", type: "button", onclick: () => screenEnterCode() },
          h("span", { class: "ht-icon", "aria-hidden": "true" }, "⌨️"), h("strong", null, t("home.code")), h("span", null, t("home.code.sub"))),
        student ? null : h("button", { class: "hometile teach", type: "button", onclick: () => screenChooseGame("teach") },
          h("span", { class: "ht-icon", "aria-hidden": "true" }, "🏫"), h("strong", null, t("home.teach")), h("span", null, t("home.teach.sub"))),
        h("button", { class: "hometile self", type: "button", onclick: () => screenChooseGame("self") },
          h("span", { class: "ht-icon", "aria-hidden": "true" }, "🎮"), h("strong", null, t("home.self")), h("span", null, t("home.self.sub")))),
      student ? h("p", { class: "muted small center" }, "🔒 " + t("home.studentMode")) : null,
      h("footer", { class: "foot" },
        h("p", null, t("home.privacy")),
        h("p", null, h("a", { href: legalUrl("datenschutz") }, t("legal.privacy")), " · ", h("a", { href: legalUrl("impressum") }, t("legal.imprint")))));
  }, { title: "MatheSnack", home: true, name: "home", redraw: screenHome });
}
function legalUrl(base) { return base + (LANG === "en" ? "-en" : "") + ".html"; }

/* ---------- Einstellungen ---------- */
function segmented(name, options, value, onPick) {
  return h("div", { class: "seg", role: "radiogroup", "aria-label": name },
    options.map(([v, label]) => h("button", { type: "button", role: "radio", "aria-checked": String(v === value), class: v === value ? "on" : "", onclick: () => onPick(v) }, label)));
}
function toggle(label, key, def, after) {
  const on = store.get(key, def) === true;
  const sw = h("button", { type: "button", role: "switch", class: "switch", "aria-checked": String(on), "aria-label": label, onclick: () => {
    const v = !(store.get(key, def) === true);
    store.set(key, v);
    sw.setAttribute("aria-checked", String(v));
    if (after) after(v);
  } }, h("span", { class: "knob" }));
  return h("div", { class: "setrow" }, h("span", null, label), sw);
}
function screenSettings() {
  go(root => {
    const student = store.get("studentMode", false) === true;
    const theme = store.get("theme", "auto");
    const darkOn = isDark();
    const sections = [];

    sections.push(h("section", { class: "card setcard" },
      h("h3", null, t("set.language")),
      langSwitch()));

    sections.push(h("section", { class: "card setcard" },
      h("h3", null, t("set.look")),
      h("div", { class: "setrow" }, h("span", null, t("set.dark")),
        h("button", { type: "button", role: "switch", id: "darkSwitch", class: "switch", "aria-checked": String(darkOn), "aria-label": t("set.dark"), onclick: () => {
          store.set("theme", isDark() ? "light" : "dark");
          applyTheme(); screenSettings();
        } }, h("span", { class: "knob" }))),
      h("div", { class: "setrow col" }, h("span", null, t("set.theme")),
        segmented(t("set.theme"), [["auto", t("set.theme.auto")], ["light", t("set.theme.light")], ["dark", t("set.theme.dark")]], theme, v => { store.set("theme", v); applyTheme(); screenSettings(); })),
      h("div", { class: "setrow col" }, h("span", null, t("set.beam")),
        segmented(t("set.beam"), [[1, t("set.beam.n")], [1.25, t("set.beam.l")], [1.5, t("set.beam.xl")]], store.get("beam", 1), v => { store.set("beam", v); applyBeam(); screenSettings(); })),
      h("p", { class: "muted small" }, t("set.beam.hint"))));

    sections.push(h("section", { class: "card setcard" },
      h("h3", null, t("set.feedback")),
      toggle(t("set.sound"), "sound", true, v => { if (v) sfx("ok"); }),
      toggle(t("set.vibrate"), "vibrate", true, v => { if (v) vibrate(40); })));

    if (!student) {
      const left = GAMES.filter(g => !g.free).map(g => trialsLeft(g.key)).reduce((a, b) => a + b, 0);
      sections.push(h("section", { class: "card setcard" },
        h("h3", null, t("pro.title")),
        h("p", null, isPro() ? "✅ " + t("pro.active") : t("set.pro.free", { n: left })),
        h("div", { class: "row" },
          isPro() ? null : h("button", { class: "btn primary", type: "button", onclick: () => screenPaywall() }, t("set.pro.show")),
          isPro() ? null : h("button", { class: "btn ghost", type: "button", onclick: restorePro }, t("pro.restore")))));
    }

    sections.push(h("section", { class: "card setcard" },
      h("h3", null, t("set.student")),
      h("p", { class: "muted small" }, t("set.student.hint")),
      h("button", { class: "btn" + (student ? " primary" : ""), type: "button", onclick: student ? leaveStudentMode : enterStudentMode },
        student ? t("set.student.off") : t("set.student.on"))));

    sections.push(h("section", { class: "card setcard" },
      h("h3", null, t("set.data")),
      h("p", { class: "muted small" }, t("set.data.hint")),
      h("button", { class: "btn ghost", type: "button", onclick: clearLocalData }, t("set.data.clear"))));

    sections.push(h("section", { class: "card setcard" },
      h("h3", null, t("set.about")),
      h("p", { class: "small" }, t("set.about.text")),
      h("p", { class: "small" },
        h("a", { href: legalUrl("datenschutz") }, t("legal.privacy")), " · ",
        h("a", { href: legalUrl("impressum") }, t("legal.imprint")), " · ",
        h("a", { href: "js/jsqr-LICENSE.txt" }, t("legal.licenses"))),
      h("p", { class: "muted small" }, t("set.version", { v: APP_VERSION }))));

    root.append(...sections);
  }, { title: t("settings.title"), name: "settings", redraw: screenSettings });
}

/* Schülergerät-Modus: blendet Lehrerbereich und Kauf aus. Zurück nur mit PIN,
   die die Lehrkraft beim Einschalten festlegt. */
function enterStudentMode() {
  const inp = h("input", { type: "password", inputmode: "numeric", maxlength: 6, class: "numinput", "aria-label": t("set.student.pin"), autocomplete: "off" });
  dialog(t("set.student.on"), h("div", null, h("p", null, t("set.student.setPin")), inp), [
    { label: t("cancel") },
    { label: t("set.student.activate"), primary: true, action: () => {
      const pin = inp.value.trim();
      if (!/^\d{4,6}$/.test(pin)) { toast(t("set.student.pinRule")); return false; }
      store.set("studentPin", pin);
      store.set("studentMode", true);
      setTimeout(screenSettings, 0);
    } }
  ]);
  setTimeout(() => inp.focus(), 100);
}
function leaveStudentMode() {
  const inp = h("input", { type: "password", inputmode: "numeric", maxlength: 6, class: "numinput", "aria-label": t("set.student.pin"), autocomplete: "off" });
  dialog(t("set.student.off"), h("div", null, h("p", null, t("set.student.askPin")), inp), [
    { label: t("cancel") },
    { label: t("ok"), primary: true, action: () => {
      if (inp.value.trim() !== String(store.get("studentPin", ""))) { toast(t("set.student.wrongPin")); vibrate(80); return false; }
      store.set("studentMode", false);
      setTimeout(screenSettings, 0);
    } }
  ]);
  setTimeout(() => inp.focus(), 100);
}

/* Einstellungen, Bestleistungen und Rallye-Buchstaben löschen. Kauf,
   Probestarts und Schülergerät-Modus bleiben – sonst ließen sich Probestarts
   beliebig zurücksetzen bzw. der Modus ohne PIN verlassen. */
function clearLocalData() {
  confirmDialog(t("set.data.confirm"), () => {
    const keep = k => /^mathesnack\.(pro|trial\.|studentMode|studentPin|lang|theme)/.test(k);
    try {
      Object.keys(localStorage).filter(k => k.startsWith("mathesnack.") && !keep(k)).forEach(k => localStorage.removeItem(k));
      Object.keys(sessionStorage).filter(k => k.startsWith("bingo.")).forEach(k => sessionStorage.removeItem(k));
    } catch (e) { /* egal */ }
    applyBeam();
    toast(t("set.data.done"));
    if (currentScreen.redraw) currentScreen.redraw();
  });
}

/* ---------- Code eingeben ---------- */
function screenEnterCode(prefill) {
  go(root => {
    const inp = h("input", { class: "codeinput", id: "codeInput", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", maxlength: 60, placeholder: "XXXXX-XXXXX-XXXXX", "aria-label": t("code.aria"), value: typeof prefill === "string" ? prefill : "" });
    const msg = h("p", { class: "msg", role: "status" });
    inp.addEventListener("input", () => {
      const raw = normalizeCode(inp.value);
      if (raw.length <= 15 && !/[#=\/]/.test(inp.value)) {
        const atEnd = inp.selectionStart === inp.value.length;
        inp.value = codeGroups(raw);
        if (atEnd) inp.selectionStart = inp.selectionEnd = inp.value.length;
      }
      msg.textContent = "";
    });
    const submit = () => {
      const cfg = decodeCode(inp.value);
      if (cfg) { playGame(cfg); return; }
      const n = normalizeCode(inp.value).length;
      msg.textContent = n !== 15 ? t("code.length", { n }) : t("code.wrong");
      inp.classList.remove("shake"); void inp.offsetWidth; inp.classList.add("shake");
      vibrate(60);
    };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
    root.append(h("div", { class: "center-stage" },
      h("p", { class: "lead" }, t("code.lead")),
      inp, msg,
      h("button", { class: "btn primary xl", type: "button", onclick: submit }, t("code.start"))));
    setTimeout(() => inp.focus(), 50);
  }, { title: t("home.code") });
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
      bestLine = prev == null ? null : better ? "🏅 " + t("res.newBest") : t("res.best", { v: res.record.pct ? NOTE.pct(prev) : prev });
    }
    root.append(h("div", { class: "center-stage result" },
      h("div", { class: "big-icon", "aria-hidden": "true" }, g.icon),
      h("div", { class: "result-big" }, String(res.big)),
      h("div", { class: "result-unit" }, res.unit),
      (res.lines || []).map(l => h("p", { class: "muted" }, l)),
      bestLine ? h("p", { class: "best" }, bestLine) : null,
      h("div", { class: "row center" },
        h("button", { class: "btn primary", type: "button", onclick: () => playGame(cfg) }, t("res.again")),
        h("button", { class: "btn", type: "button", onclick: () => playGame({ ...cfg, seed: newSeed() }) }, t("res.newTasks"))),
      h("button", { class: "btn ghost", type: "button", onclick: goHome }, t("res.home"))));
  }, { title: g.name });
}

/* ---------- QR-Scanner ----------
   Kamerabild im WebView, Erkennung mit jsQR auf dem Gerät. Kein Bild
   verlässt das Gerät. Fallback: Foto aufnehmen oder Code eintippen. */
function handleScanned(text) {
  const cfg = decodeCode(text);
  if (cfg) { vibrate(40); sfx("ok"); playGame(cfg); return true; }
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
    const status = h("p", { class: "msg", role: "status" }, t("scan.starting"));
    const frame = h("div", { class: "scanframe" }, video, h("div", { class: "scanbox", "aria-hidden": "true" }));
    const fileIn = h("input", { type: "file", accept: "image/*", capture: "environment", class: "visually-hidden", id: "scanFile" });
    const photoBtn = h("label", { class: "btn", for: "scanFile" }, "📸 " + t("scan.photo"));
    let stream = null, raf = 0, stopped = false, lastBad = 0;
    const cv = document.createElement("canvas");
    const cx = cv.getContext("2d", { willReadFrequently: true });
    function stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach(tr => tr.stop());
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
          if (Date.now() - lastBad > 2500) { lastBad = Date.now(); status.textContent = t("scan.notOurs"); }
        }
      }
      raf = requestAnimationFrame(scanFrame);
    }
    async function start() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        status.textContent = t("scan.noLive"); frame.hidden = true; return;
      }
      if (!(await androidCameraPermission())) {
        status.textContent = t("scan.denied"); frame.hidden = true; return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
        if (stopped) { stop(); return; }
        video.srcObject = stream;
        await video.play().catch(() => {});
        status.textContent = t("scan.hold");
        raf = requestAnimationFrame(scanFrame);
      } catch (e) {
        status.textContent = t("scan.failed"); frame.hidden = true;
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
        status.textContent = found ? t("scan.notOurs") : t("scan.noneInPhoto");
      };
      img.onerror = () => { status.textContent = t("scan.photoFailed"); };
      img.src = url;
    });
    root.append(h("div", { class: "scanner" }, frame, status,
      h("div", { class: "row center" }, photoBtn, fileIn, h("button", { class: "btn ghost", type: "button", onclick: () => screenEnterCode() }, "⌨️ " + t("home.code"))),
      h("p", { class: "muted small center" }, t("scan.tip"))));
    start();
  }, { title: t("home.scan") });
}

/* ---------- Geöffnete Links ----------
   Universal Links (https://…/MatheSnack/open/#s=…) und mathesnack://open#s=…
   kommen über handleOpenURL an (Cordova bzw. Plugin mathesnack-links).
   Derselbe Link kann zweimal eintreffen – das zweite Mal wird verworfen. */
let lastOpenedLink = { url: "", at: 0 };
window.handleOpenURL = function (url) {
  const u = String(url || "");
  const now = Date.now();
  if (u === lastOpenedLink.url && now - lastOpenedLink.at < 5000) return;
  lastOpenedLink = { url: u, at: now };
  setTimeout(() => openLink(u), 0);
};
function openLink(u) {
  if (!/[#&?]s=/.test(u)) return false;
  const cfg = decodeCode(u);
  if (cfg) { playGame(cfg); return true; }
  const m = u.match(/[#&?]s=([0-9A-Za-z\-]+)/);
  screenEnterCode(m ? m[1] : "");
  toast(t("code.invalidLink"));
  return true;
}

/* ---------- Start ---------- */
applyTheme();
applyBeam();
if (window.matchMedia) {
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { applyStatusBar(); if (currentScreen.name === "settings") screenSettings(); }); } catch (e) { /* alt */ }
}
$("#btnBack").addEventListener("click", goHome);
document.addEventListener("backbutton", e => {
  e.preventDefault();
  if (!$("#dlg").hidden) { closeDialog(); return; }
  if (document.body.classList.contains("is-home")) { if (navigator.app && navigator.app.exitApp) navigator.app.exitApp(); }
  else goHome();
}, false);
document.addEventListener("deviceready", () => {
  initShop();
  applyStatusBar();
  /* Kaltstart über einen Link: Plugin bzw. Cordova rufen handleOpenURL auf */
}, false);
/* Nur beim Entwickeln im Browser: Link im Adressfeld (…/index.html#s=…) */
window.addEventListener("hashchange", () => { if (location.hash) openLink(location.hash); });
if (!(location.hash && openLink(location.hash))) screenHome();
