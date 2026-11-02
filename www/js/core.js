/* MatheSnack – Kern: Konstanten, Zufall, Spielcode, Zahlformat, DOM-Helfer
   Alle Spiele entstehen auf dem Gerät aus einem kurzen Code (Spiel, Thema,
   Einstellungen, Zufallssamen). Kein Server, keine Konten, keine Analyse. */
"use strict";

const APP_VERSION = "0.2.0";

/* Ziel der QR-Codes. Ist MatheSnack installiert, öffnet die Kamera den Link
   direkt in der App (iOS: Universal Link, Plugin mathesnack-links).
   Sonst zeigt die Seite docs/open/ einen Hinweis auf die kostenlose App –
   gespielt wird dort nicht. LINK_HOST in config.xml muss zur Domain passen. */
const SHARE_BASE = "https://simaehlmann-cloud.github.io/MatheSnack/open/";
const URL_SCHEME = "mathesnack";

function inApp() { return !!window.cordova; }
function onAndroid() { return !!(window.cordova && window.cordova.platformId === "android"); }

/* ---------- Zufall mit Samen (mulberry32) ----------
   Gleicher Samen = gleiche Aufgaben auf jedem Gerät. */
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    chance: p => next() < p,
    shuffle: arr => {
      const b = arr.slice();
      for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
      return b;
    },
    /* ganze Zahl aus [a, b] ohne die Werte in except */
    intNot: (a, b, except) => {
      for (let k = 0; k < 50; k++) { const v = a + Math.floor(next() * (b - a + 1)); if (!except.includes(v)) return v; }
      return b;
    }
  };
  return r;
}
/* Gerätezufall, z. B. für die eigene Bingo-Karte oder die eigene Flotte */
function deviceRng() { return makeRng(Math.floor(Math.random() * 4294967295) + 1); }
function newSeed() { return Math.floor(Math.random() * 0xFFFFFF) + 1; }

/* ---------- Spielcode ----------
   9 Byte: Samen (3 Byte), Version, Spiel, Thema, Einstellung A,
   Einstellung B, Prüfsumme. Die fünf Byte nach dem Samen werden mit dem
   Samen gemischt, damit Codes nicht alle gleich beginnen und sich die
   Einstellungen nicht ablesen lassen. Als Crockford-Base32 sind das 15 Zeichen ohne verwechselbare
   Buchstaben (kein I, L, O, U) – auch zum Abtippen von der Tafel geeignet. */
const CODE_VERSION = 1;
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function checksum(bytes) {
  let c = 0x5A;
  bytes.forEach((b, i) => { c = (c * 31 + b * (i + 7)) & 255; });
  return c;
}
function whiten(seedBytes) {
  const [s0, s1, s2] = seedBytes;
  return [s2 ^ 0x3C, s0 ^ 0xA7, s1 ^ 0x51, (s0 ^ s2) ^ 0x9E, (s1 ^ s2) ^ 0x6B];
}
function encodeCode(cfg) {
  const s = cfg.seed & 0xFFFFFF;
  const seedBytes = [(s >>> 16) & 255, (s >>> 8) & 255, s & 255];
  const raw = [CODE_VERSION, cfg.g & 255, cfg.t & 255, cfg.a & 255, cfg.b & 255];
  const m = whiten(seedBytes);
  const bytes = [...seedBytes, ...raw.map((b, i) => b ^ m[i])];
  bytes.push(checksum([...seedBytes, ...raw]));
  let bits = "";
  bytes.forEach(b => { bits += b.toString(2).padStart(8, "0"); });
  while (bits.length % 5) bits += "0";
  let out = "";
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}
function normalizeCode(text) {
  let t = String(text || "").trim();
  const m = t.match(/[#&?]s=([0-9A-Za-z\-]+)/);
  if (m) t = m[1];
  return t.toUpperCase().replace(/[\s\-–—_.]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
}
/* Liefert {g, t, a, b, seed} oder null. Prüft Version, Prüfsumme und
   ob Spiel und Thema in dieser App-Version existieren. */
function decodeCode(text) {
  const c = normalizeCode(text);
  if (c.length !== 15) return null;
  let bits = "";
  for (const ch of c) {
    const v = B32.indexOf(ch);
    if (v < 0) return null;
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= 72; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  if (parseInt(bits.slice(72), 2) !== 0) return null;
  const seedBytes = bytes.slice(0, 3);
  const m = whiten(seedBytes);
  const raw = bytes.slice(3, 8).map((b, i) => b ^ m[i]);
  if (raw[0] !== CODE_VERSION) return null;
  if (checksum([...seedBytes, ...raw]) !== bytes[8]) return null;
  const cfg = { g: raw[1], t: raw[2], a: raw[3], b: raw[4], seed: (seedBytes[0] << 16) | (seedBytes[1] << 8) | seedBytes[2] };
  if (!validConfig(cfg)) return null;
  return cfg;
}
function codeGroups(code) { return code.replace(/(.{5})(?=.)/g, "$1-"); }
function shareUrl(cfg) { return SHARE_BASE + "#s=" + encodeCode(cfg); }

/* ---------- Zahlen und Terme schön schreiben ----------
   Dezimaltrennzeichen und Rechenzeichen hängen von der Sprache ab
   (js/i18n.js: 2,5 · 3 bzw. 2.5 × 3). Die Aufgaben selbst sind in beiden
   Sprachen dieselben – nur die Schreibweise unterscheidet sich. */
const MINUS = "−";
function num(n) {
  if (!Number.isFinite(n)) return "?";
  const r = Math.round(n * 1e6) / 1e6;
  const neg = r < 0;
  let s = Math.abs(r).toString();
  if (s.includes("e")) s = Math.abs(r).toFixed(0);
  const [int, dec] = s.split(".");
  const grouped = int.length > 4 ? int.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F") : int;
  return (neg ? MINUS : "") + grouped + (dec ? NOTE.dec() + dec : "");
}
/* Zahl in Klammern, wenn negativ: 3 · (−4) */
function numP(n) { return n < 0 ? "(" + num(n) + ")" : num(n); }
const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
function sup(n) { return String(n).split("").map(c => SUP[c] || c).join(""); }
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; }
function frac(n, d) { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return [n / g, d / g]; }
function fracStr(n, d) {
  [n, d] = frac(n, d);
  if (d === 1) return num(n);
  return (n < 0 ? MINUS : "") + Math.abs(n) + "/" + d;
}
/* Koeffizient vor einer Variablen: 1x -> x, -1x -> −x, 0,5x */
function coef(c, v) {
  if (c === 1) return v;
  if (c === -1) return MINUS + v;
  return num(c) + v;
}
/* Summe aus Gliedern [{c, v}] mit sauberen Vorzeichen: 3x + 5 − x + 2 */
function sumStr(parts) {
  let out = "";
  parts.forEach((p, i) => {
    if (p.c === 0 && parts.length > 1) return;
    const body = p.v ? coef(Math.abs(p.c), p.v) : num(Math.abs(p.c));
    if (out === "") out = (p.c < 0 ? MINUS : "") + body;
    else out += (p.c < 0 ? " " + MINUS + " " : " + ") + body;
  });
  return out || "0";
}
function lin(m, b, v = "x") { return sumStr([{ c: m, v }, { c: b }]); }

/* ---------- DOM ---------- */
function $(sel, root = document) { return root.querySelector(sel); }
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  kids.flat(Infinity).forEach(k => {
    if (k == null || k === false) return;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  });
  return el;
}
const SVGNS = "http://www.w3.org/2000/svg";
function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  kids.flat().forEach(k => { if (k != null) el.append(k instanceof Node ? k : document.createTextNode(String(k))); });
  return el;
}

/* ---------- Lokaler Speicher (nur auf diesem Gerät) ---------- */
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem("mathesnack." + key); return v == null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("mathesnack." + key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
};

/* ---------- Kleine Helfer ---------- */
let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
}
function vibrate(ms) {
  if (!store.get("vibrate", true)) return;
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* egal */ }
}

/* Kurze Töne über Web Audio, ohne Audiodateien. Abschaltbar in den
   Einstellungen. "ok" und "bad" bei Antworten, "gong" bei Zeitablauf am Beamer. */
let audioCtx = null;
function sfx(kind) {
  if (!store.get("sound", true)) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime;
    const notes = { ok: [[880, 0, .09], [1320, .07, .12]], bad: [[220, 0, .18]], gong: [[523, 0, 1.1], [659, 0, 1.1], [784, 0, 1.1]], tick: [[1000, 0, .04]] }[kind] || [];
    notes.forEach(([f, t0, d]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = kind === "bad" ? "triangle" : "sine";
      o.frequency.value = f;
      const vol = kind === "gong" ? .18 : .08;
      g.gain.setValueAtTime(0.0001, now + t0);
      g.gain.exponentialRampToValueAtTime(vol, now + t0 + .01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + d);
      o.connect(g).connect(audioCtx.destination);
      o.start(now + t0); o.stop(now + t0 + d + .05);
    });
  } catch (e) { /* ohne Ton weiter */ }
}

/* Bildschirm wach halten (Beamer, Bewegungspause). Fehlt die Funktion, egal. */
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && "wakeLock" in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}
