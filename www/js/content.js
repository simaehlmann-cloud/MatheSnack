/* MatheSnack – Aufgaben
   Jedes Thema hat einen Generator gen(r, opt) -> Aufgabe:
     q      Aufgabentext (bei Graph-Aufgaben leer, dann zeigt fn den Graphen)
     a      richtige Antwort als Text
     wrong  drei typische Fehlantworten (für Auswahl und Fehlersuche)
     expr   true, wenn q ein Rechenausdruck ist ("12 · 4"), sonst eine Frage
     fn     optional: {type:"lin", m, b} oder {type:"quad", k, d, e}
     num    optional: Zahlenwert der Antwort (für Größer/Kleiner-Bewegung)
     mcOnly nur mit Antwortauswahl sinnvoll (Frage nennt die Auswahl nicht)
   Der Samen steckt in r – gleiche Samen liefern überall dieselben Aufgaben. */
"use strict";

/* eindeutige Fehlantworten: entfernt Dubletten und die richtige Antwort,
   füllt mit Ersatzwerten auf */
function wrongs(answer, list, filler) {
  const out = [];
  for (const w of list) if (w !== answer && !out.includes(w)) out.push(w);
  for (let k = 1; out.length < 3 && k < 40; k++) {
    const w = filler(k);
    if (w !== answer && !out.includes(w)) out.push(w);
  }
  return out.slice(0, 3);
}
function numWrongs(ans, cands, fmt = num) {
  return wrongs(fmt(ans), cands.filter(Number.isFinite).map(fmt), k => fmt(ans + (k % 2 ? k : -k)));
}

/* ---------- 0  Einmaleins & Teilen ---------- */
function genEinmaleins(r) {
  const type = r.int(0, 9);
  if (type <= 4) {
    const a = r.int(2, 12), b = r.int(3, 12);
    const p = a * b;
    return { q: `${a} ${NOTE.mul()} ${b}`, a: num(p), num: p, expr: true, wrong: numWrongs(p, [a * (b + 1), a * (b - 1), p + 10, p - 1]) };
  }
  if (type <= 7) {
    const a = r.int(2, 12), b = r.int(2, 10);
    const c = a * b;
    return { q: `${c} ${NOTE.div()} ${b}`, a: num(a), num: a, expr: true, wrong: numWrongs(a, [a + 1, a - 1, b === a ? a + 2 : b, a * 2]) };
  }
  const a = r.int(11, 19), b = r.int(2, 6);
  const p = a * b;
  return { q: `${a} ${NOTE.mul()} ${b}`, a: num(p), num: p, expr: true, wrong: numWrongs(p, [p + b, p - 10, (a - 10) * b + 10, p + 10]) };
}

/* ---------- 1  Ganze Zahlen ---------- */
function genGanze(r) {
  const op = r.pick(["+", "+", "-", "-", "*", "/"]);
  if (op === "+" || op === "-") {
    const a = r.intNot(-15, 15, [0]), b = r.intNot(-15, 15, [0]);
    const v = op === "+" ? a + b : a - b;
    const sym = op === "+" ? "+" : MINUS;
    return { q: `${num(a)} ${sym} ${numP(b)}`, a: num(v), num: v, expr: true,
      wrong: numWrongs(v, [-v, op === "+" ? a - b : a + b, Math.abs(a) + Math.abs(b), v + 2]) };
  }
  if (op === "*") {
    const a = r.intNot(-9, 9, [0, 1]), b = r.intNot(-9, 9, [0, 1]);
    const v = a * b;
    return { q: `${num(a)} ${NOTE.mul()} ${numP(b)}`, a: num(v), num: v, expr: true, wrong: numWrongs(v, [-v, a + b, v + a, v - 1]) };
  }
  const q = r.intNot(-9, 9, [0, 1]), b = r.intNot(-9, 9, [0, 1]);
  const a = q * b;
  return { q: `${num(a)} ${NOTE.div()} ${numP(b)}`, a: num(q), num: q, expr: true, wrong: numWrongs(q, [-q, q + 1, a + b, q - 2]) };
}

/* ---------- 2  Brüche & Dezimalzahlen ---------- */
function genBrueche(r) {
  const type = r.int(0, 5);
  if (type === 0) {                    // gleichnamig addieren
    const d = r.pick([3, 4, 5, 6, 8, 10]);
    const n1 = r.int(1, d - 1), n2 = r.int(1, d - 1);
    const v = n1 / d + n2 / d;
    return { q: `${n1}/${d} + ${n2}/${d}`, a: fracStr(n1 + n2, d), num: v, expr: true,
      wrong: wrongs(fracStr(n1 + n2, d), [fracStr(n1 + n2, 2 * d), fracStr(n1 * n2, d), fracStr(n1 + n2 + 1, d)], k => fracStr(n1 + n2 + k + 1, d)) };
  }
  if (type === 1) {                    // ungleichnamig
    const [d1, d2] = r.pick([[2, 4], [2, 3], [3, 6], [4, 8], [2, 6], [3, 4], [2, 5], [4, 6]]);
    const n1 = r.int(1, d1 - 1), n2 = r.int(1, d2 - 1);
    const N = n1 * d2 + n2 * d1, D = d1 * d2;
    const ans = fracStr(N, D);
    return { q: `${n1}/${d1} + ${n2}/${d2}`, a: ans, num: N / D, expr: true,
      wrong: wrongs(ans, [fracStr(n1 + n2, d1 + d2), fracStr(n1 + n2, D), fracStr(N + D, D)], k => fracStr(N + k * D / 2 + 1, D)) };
  }
  if (type === 2) {                    // Bruchteil einer Zahl
    const d = r.pick([2, 3, 4, 5, 10]);
    const n = r.int(1, d - 1);
    const G = d * r.int(2, 12);
    const v = G / d * n;
    return { q: t("c.fracOf", { f: `${n}/${d}`, g: num(G) }), a: num(v), num: v, expr: true, wrong: numWrongs(v, [G / d, G / n, v + G / d, G - v]) };
  }
  if (type === 3) {                    // Dezimalzahlen addieren
    const a = r.int(11, 89) / 10, b = r.int(11, 49) / 10;
    const v = Math.round((a + b) * 10) / 10;
    return { q: `${num(a)} + ${num(b)}`, a: num(v), num: v, expr: true,
      wrong: wrongs(num(v), [num(Math.round((v - 1) * 10) / 10), num(Math.round((v + 1) * 10) / 10), num(Math.round((Math.floor(a) + Math.floor(b) + ((a * 10 % 10) + (b * 10 % 10)) / 100) * 100) / 100)], k => num(Math.round((v + k / 10) * 10) / 10)) };
  }
  if (type === 4) {                    // mal/durch 10, 100
    const a = r.int(12, 999) / 100;
    const [f, op, k] = r.pick([[10, "*", 10], [100, "*", 100], [0.1, "/", 10], [0.01, "/", 100]]);
    const sym = (op === "*" ? NOTE.mul() : NOTE.div()) + " " + k;
    const v = Math.round(a * f * 10000) / 10000;
    return { q: `${num(a)} ${sym}`, a: num(v), num: v, expr: true,
      wrong: wrongs(num(v), [num(Math.round(a / f * 10000) / 10000), num(Math.round(v * 10 * 10000) / 10000), num(Math.round(v / 10 * 10000) / 10000)], k => num(v + k)) };
  }
  const [dz, fr, w] = r.pick([[0.5, "1/2", ["1/5", "5/100", "2/5"]], [0.25, "1/4", ["2/5", "1/25", "25/10"]], [0.75, "3/4", ["7/5", "3/5", "1/75"]],
    [0.2, "1/5", ["1/2", "2/100", "2/5"]], [0.1, "1/10", ["1/100", "1/1", "10/1"]], [0.4, "2/5", ["4/5", "1/4", "4/100"]], [0.125, "1/8", ["1/125", "1/4", "12/5"]],
    [0.6, "3/5", ["6/100", "1/6", "2/3"]], [1.5, "3/2", ["1/5", "15/100", "5/3"]]]);
  return { q: t("c.asFraction", { n: num(dz) }), a: fr, num: dz, expr: false, wrong: w };
}

/* ---------- 3  Prozent ---------- */
function genProzent(r) {
  const type = r.int(0, 2);
  const p = r.pick([5, 10, 20, 25, 50, 75, 30, 40, 15, 2]);
  const unit = 100 / gcd(p, 100);
  const G = unit * r.int(1, Math.max(1, Math.floor(400 / unit)));
  const W = p * G / 100;
  if (type === 0) {
    return { q: t("c.pctOf", { p: NOTE.pct(p), g: num(G) }), a: num(W), num: W, expr: false, wrong: numWrongs(W, [G / p, W * 10, G - W, W + p]) };
  }
  if (type === 1) {
    return { q: t("c.pctWhat", { w: num(W), g: num(G) }), a: NOTE.pct(p), num: p, expr: false,
      wrong: wrongs(NOTE.pct(p), [NOTE.pct(100 - p), NOTE.pct(p * 2), NOTE.pct(p + 5)], k => NOTE.pct(p + 10 * k)) };
  }
  return { q: t("c.pctWhole", { p: NOTE.pct(p), w: num(W) }), a: num(G), num: G, expr: false, wrong: numWrongs(G, [W * p, G / 2, G + W, W * 100]) };
}

/* ---------- 4  Potenzen & Wurzeln ---------- */
function genPotenzen(r) {
  const type = r.int(0, 5);
  if (type <= 1) {
    const n = r.int(2, 20), v = n * n;
    return { q: `${n}²`, a: num(v), num: v, expr: true, wrong: numWrongs(v, [2 * n, v + n, v - 1, (n + 1) * (n + 1)]) };
  }
  if (type === 2) {
    const n = r.int(2, 15), v = n * n;
    return { q: `√${v}`, a: num(n), num: n, expr: true, wrong: numWrongs(n, [v / 2, n + 1, n - 1, 2 * n]) };
  }
  if (type === 3) {
    const n = r.int(2, 5), v = n * n * n;
    return { q: `${n}³`, a: num(v), num: v, expr: true, wrong: numWrongs(v, [3 * n, n * n, v + n, v - n]) };
  }
  if (type === 4) {
    const k = r.int(2, 10), v = Math.pow(2, k);
    return { q: `2${sup(k)}`, a: num(v), num: v, expr: true, wrong: numWrongs(v, [2 * k, v * 2, v / 2, k * k]) };
  }
  const n = r.int(2, 9);
  if (r.chance(0.5)) return { q: `(${MINUS}${n})²`, a: num(n * n), num: n * n, expr: true, wrong: numWrongs(n * n, [-n * n, -2 * n, 2 * n]) };
  return { q: `${MINUS}${n}²`, a: num(-n * n), num: -n * n, expr: true, wrong: numWrongs(-n * n, [n * n, -2 * n, 2 * n]) };
}

/* ---------- 5  Terme vereinfachen ---------- */
function genTerme(r) {
  const type = r.int(0, 3);
  if (type <= 1) {
    const a = r.intNot(-6, 9, [0]), c = r.intNot(-6, 9, [0, -a]), b = r.intNot(-9, 9, [0]), d = r.intNot(-9, 9, [0, -b]);
    const q = sumStr([{ c: a, v: "x" }, { c: b }, { c: c, v: "x" }, { c: d }]);
    const ans = lin(a + c, b + d);
    return { q, a: ans, expr: true,
      wrong: wrongs(ans, [lin(a - c, b + d), lin(a + c, b - d), lin(-(a + c), b + d), lin(a + c + 1, b + d)], k => lin(a + c, b + d + k)) };
  }
  if (type === 2) {
    const a = r.intNot(-5, 6, [0, 1]), b = r.int(1, 5), c = r.intNot(-9, 9, [0]);
    const q = `${a === -1 ? MINUS : num(a)}(${lin(b, c)})`;
    const ans = lin(a * b, a * c);
    return { q, a: ans, expr: true, wrong: wrongs(ans, [lin(a * b, c), lin(a * b, -a * c), lin(a + b, a * c), lin(a * b, a + c)], k => lin(a * b, a * c + k)) };
  }
  const a = r.int(2, 9), b = r.int(2, 9);
  const ans = `${a * b}x`;
  if (r.chance(0.5)) return { q: `${a}x ${NOTE.mul()} ${b}`, a: ans, expr: true, wrong: wrongs(ans, [`${a * b}x²`, `${a + b}x`, `${a}x + ${b}`], k => `${a * b + k}x`) };
  const ans2 = `${a * b}x²`;
  return { q: `${a}x ${NOTE.mul()} ${b}x`, a: ans2, expr: true, wrong: wrongs(ans2, [`${a * b}x`, `${a + b}x²`, `${a * b}x³`], k => `${a * b + k}x²`) };
}

/* ---------- 6  Lineare Gleichungen ---------- */
function genGleichungen(r) {
  const x = r.intNot(-9, 9, [0]);
  const type = r.int(0, 2);
  let q, alt;
  if (type === 0) {
    const a = r.intNot(-9, 9, [0, 1, -1]), b = r.intNot(-12, 12, [0]);
    q = `${lin(a, b)} = ${num(a * x + b)}`;
    alt = [-x, x + 1, Number.isInteger((a * x + 2 * b) / a) ? (a * x + 2 * b) / a : x - 1];
  } else if (type === 1) {
    const a = r.int(2, 6), b = r.intNot(-6, 6, [0]);
    q = `${a}(${lin(1, b)}) = ${num(a * (x + b))}`;
    alt = [x + 2 * b, -x, x + 1];
  } else {
    const a = r.intNot(-6, 9, [0]), c = r.intNot(-6, 9, [0, a]), b = r.intNot(-12, 12, [0]);
    const d = (a - c) * x + b;
    q = `${lin(a, b)} = ${lin(c, d)}`;
    alt = [-x, x + 1, x - 2];
  }
  const ans = `x = ${num(x)}`;
  return { q, a: ans, num: x, expr: false, wrong: wrongs(ans, alt.map(v => `x = ${num(v)}`), k => `x = ${num(x + k + 1)}`) };
}

/* ---------- 7  Lineare Funktionen ---------- */
const SLOPES = [-3, -2, -1, -0.5, 0.5, 1, 2, 3];
function linEq(m, b) { return "y = " + lin(m, b); }
function genLinear(r, opt) {
  const m = r.pick(SLOPES), b = r.int(-4, 4);
  if (opt && opt.graph) {
    const ans = linEq(m, b);
    const cands = [linEq(-m, b), linEq(m, -b), b !== 0 && Number.isInteger(m) ? linEq(b, m) : linEq(m * 2, b), linEq(m, b + 1)];
    return { q: "", a: ans, fn: { type: "lin", m, b }, expr: false, wrong: wrongs(ans, cands, k => linEq(m, b + k + 1)) };
  }
  const eq = linEq(m, b);
  const type = r.int(0, 3);
  if (type === 0) return { q: t("c.slope", { eq }), a: num(m), num: m, expr: false, wrong: numWrongs(m, [b === m ? -m : b, -m, m * 2]) };
  if (type === 1) return { q: t("c.intercept", { eq }), a: num(b), num: b, expr: false, wrong: numWrongs(b, [m === b ? b + 1 : m, -b, b + 2]) };
  if (type === 2) {
    const x = r.intNot(-4, 4, [0]);
    const v = m * x + b;
    return { q: t("c.fOf", { x: num(x), f: lin(m, b) }), a: num(v), num: v, expr: false, wrong: numWrongs(v, [m + x + b, -v, m * x - b]) };
  }
  const x0 = -b / m;
  return { q: t("c.zero", { eq }), a: `x = ${num(x0)}`, num: x0, expr: false,
    wrong: wrongs(`x = ${num(x0)}`, [`x = ${num(-x0)}`, `x = ${num(b)}`, `x = ${num(b / m)}`], k => `x = ${num(x0 + k)}`) };
}

/* ---------- 8  Quadratische Funktionen ---------- */
function quadEq(k, d, e) {
  let inner = d === 0 ? "x²" : `(${lin(1, -d)})²`;
  let head = k === 1 ? inner : k === -1 ? MINUS + inner : num(k) + inner;
  if (k !== 1 && k !== -1 && d === 0) head = num(k) + "x²";
  return "y = " + head + (e === 0 ? "" : (e < 0 ? " " + MINUS + " " : " + ") + num(Math.abs(e)));
}
function genQuadratisch(r, opt) {
  const k = r.pick([1, 1, 1, -1, -1, 2, 0.5, -2]), d = r.int(-3, 3), e = r.int(-3, 3);
  if (opt && opt.graph) {
    const ans = quadEq(k, d, e);
    const cands = [quadEq(k, -d, e), quadEq(k, d, -e), quadEq(-k, d, e), quadEq(k, e, d)];
    return { q: "", a: ans, fn: { type: "quad", k, d, e }, expr: false, wrong: wrongs(ans, cands, n => quadEq(k, d, e + n + 1)) };
  }
  const eq = quadEq(k, d, e);
  const type = r.int(0, 2);
  if (type === 0) {
    const V = (x, y) => NOTE.vertex(num(x), num(y));
    const ans = V(d, e);
    return { q: t("c.vertex", { eq }), a: ans, expr: false, wrong: wrongs(ans, [V(-d, e), V(e, d), V(d, -e)], n => V(d + n, e)) };
  }
  if (type === 1) {
    const x = r.int(-2, 3);
    const v = k * (x - d) * (x - d) + e;
    return { q: t("c.fOf", { x: num(x), f: eq.slice(4) }), a: num(v), num: v, expr: false, wrong: numWrongs(v, [k * (x + d) * (x + d) + e, v - 2 * e, -v]) };
  }
  const n = r.int(1, 9);
  const ans = `x = ±${n}`;
  return { q: t("c.zeros", { eq: `y = x² ${MINUS} ${n * n}` }), a: ans, expr: false,
    wrong: wrongs(ans, [`x = ${n}`, `x = ±${n * n}`, `x = ${MINUS}${n}`], m => `x = ±${n + m}`) };
}

/* ---------- 9–12  Aufgabenbank Klasse 7–10 (vorbereitete Aufgaben) ----------
   [Frage, Antwort, Auswahl, Erklärung] – je Sprache eine Liste, Zeile für
   Zeile dieselbe Aufgabe (validate.js prüft das). Der Samen wählt die Zeile,
   die Sprache des Geräts nur die Schreibweise. Fragen, die erst mit der
   Auswahl verständlich sind, tragen am Ende "*" und kommen nur in
   Auswahlspielen vor. */
const BANK_DE = {
  7: [
    ["−12 + 15", "3", ["−3", "3", "27", "−27"], "Rechne von −12 aus 15 Schritte nach rechts."],
    ["12/18 vollständig gekürzt", "2/3", ["6/9", "4/6", "2/3", "3/4"], "Teile Zähler und Nenner durch 6."],
    ["−4 · 6", "−24", ["24", "−10", "−24", "−2"], "Negativ mal positiv ergibt negativ."],
    ["25 % von 80", "20", ["15", "20", "25", "30"], "25 % ist ein Viertel; 80 : 4 = 20."],
    ["Größere Zahl: −5 oder −2?", "−2", ["−5", "−2", "−8", "−9"], "Auf der Zahlengeraden liegt −2 weiter rechts."],
    ["3/4 + 1/4", "1", ["1/2", "1", "2/8", "3/8"], "Gleiche Nenner: 4/4 = 1."],
    ["2,5 + 1,7", "4,2", ["3,2", "4,2", "4,12", "3,12"], "Addiere die Dezimalzahlen stellenweise."],
    ["7 − 12", "−5", ["5", "−5", "19", "−19"], "Von 7 fünf Schritte über 0 nach links."],
    ["Kleinste Zahl von −1, 4, −3, 0", "−3", ["−1", "4", "−3", "0"], "Die kleinste Zahl liegt am weitesten links."],
    ["3/5 von 20", "12", ["8", "10", "12", "15"], "20 : 5 · 3 = 12."],
    ["0,75 als Bruch", "3/4", ["1/4", "2/3", "3/4", "7/5"], "0,75 = 75/100 = 3/4."],
    ["(−3)²", "9", ["−9", "6", "9", "−6"], "Das Quadrat einer negativen Zahl ist positiv."],
    ["1,2 · 10", "12", ["1,2", "120", "12", "0,12"], "Beim Multiplizieren mit 10 rückt das Komma eine Stelle."],
    ["Welcher Bruch ist gleich 1/2?*", "3/6", ["2/5", "3/6", "4/10", "5/8"], "Zähler und Nenner mit derselben Zahl multiplizieren."],
    ["−8 − 5", "−13", ["−3", "13", "−13", "3"], "Von −8 noch 5 Schritte nach links."]
  ],
  8: [
    ["3x + 5 − x + 2", "2x + 7", ["4x + 7", "2x + 7", "2x + 3", "4x + 3"], "Gleichartige Terme zusammenfassen."],
    ["4x + 3x", "7x", ["7x²", "12x", "7x", "43x"], "Die Koeffizienten addieren."],
    ["2x = 16", "x = 8", ["x = 4", "x = 8", "x = 16", "x = 32"], "Beide Seiten durch 2 teilen."],
    ["Steigung von y = 3x + 2", "3", ["2", "3", "−3", "5"], "In y = mx + b ist m die Steigung."],
    ["5a für a = 4", "20", ["9", "20", "54", "1"], "Setze a = 4 ein: 5 · 4."],
    ["x + 7 = 12", "x = 5", ["x = 19", "x = −5", "x = 5", "x = 7"], "Auf beiden Seiten 7 subtrahieren."],
    ["3(2x + 4)", "6x + 12", ["5x + 7", "6x + 4", "6x + 12", "6x + 8"], "Distributivgesetz."],
    ["y-Achsenabschnitt von y = −2x + 5", "5", ["−2", "2", "5", "−5"], "Der y-Achsenabschnitt ist b."],
    ["2³", "8", ["6", "8", "9", "16"], "2 · 2 · 2 = 8."],
    ["3x − 6 = 9", "x = 5", ["x = 1", "x = 3", "x = 5", "x = 15"], "Addiere 6, teile dann durch 3."],
    ["Welche Funktion ist linear?*", "y = 2x − 1", ["y = x²", "y = 2x − 1", "y = 1/x", "y = x³"], "Lineare Funktion: y = mx + b."],
    ["(x + 2)(x + 3)", "x² + 5x + 6", ["x² + 6", "x² + 5x + 6", "2x + 5", "x² + 6x + 5"], "Jeden Term einzeln multiplizieren."],
    ["4x = 2x + 10", "x = 5", ["x = 2", "x = 5", "x = 10", "x = −5"], "Subtrahiere 2x, teile dann durch 2."],
    ["Steigung zwischen (0 | 1) und (2 | 5)", "2", ["1", "2", "3", "4"], "Δy/Δx = 4/2 = 2."],
    ["5y − 2y + y", "4y", ["4", "4y", "8y", "3y"], "5 − 2 + 1 = 4."]
  ],
  9: [
    ["3x + 4 = 19", "x = 5", ["x = 3", "x = 5", "x = 7", "x = 15"], "Subtrahiere 4 und teile durch 3."],
    ["x² + 5x faktorisiert", "x(x + 5)", ["x + 5", "x(x + 5)", "x²(5x)", "5(x + 1)"], "Gemeinsamen Faktor x ausklammern."],
    ["(x + 3)²", "x² + 6x + 9", ["x² + 9", "x² + 6x + 9", "x² + 3x + 9", "2x + 6"], "Binomische Formel."],
    ["x² = 49", "x = ±7", ["x = 7", "x = −7", "x = ±7", "x = 49"], "7² und (−7)² sind 49."],
    ["2x − 5 = 11", "x = 8", ["x = 3", "x = 6", "x = 8", "x = −8"], "Addiere 5 und teile durch 2."],
    ["(x − 2)(x + 2)", "x² − 4", ["x² + 4", "x² − 4", "x² − 2x + 4", "x² + 2x − 4"], "Differenz von Quadraten."],
    ["x² − 9 = 0", "x = ±3", ["x = 3", "x = −3", "x = ±3", "x = 9"], "x² = 9."],
    ["Steigung von y = −4x + 7", "−4", ["7", "4", "−4", "−7"], "Koeffizient vor x."],
    ["5(x − 1) = 20", "x = 5", ["x = 3", "x = 4", "x = 5", "x = 6"], "Teile durch 5, addiere dann 1."],
    ["Nullstellen von y = x² − 16", "x = ±4", ["x = 0 und 16", "x = ±4", "x = 4", "x = ±16"], "x² − 16 = (x − 4)(x + 4)."],
    ["2x + 3 = x − 4", "x = −7", ["x = 7", "x = −1", "x = −7", "x = 1"], "Subtrahiere x und 3."],
    ["(2x)²", "4x²", ["2x²", "4x", "4x²", "2x"], "2 und x werden quadriert."],
    ["Welche Gleichung ist quadratisch?*", "x² + 2x − 3 = 0", ["2x + 3 = 0", "x² + 2x − 3 = 0", "1/x = 2", "3x = 9"], "Höchste Potenz ist 2."],
    ["x² = 0", "x = 0", ["x = 1", "x = 0", "x = ±1", "keine Lösung"], "Nur 0² = 0."],
    ["4x + 8 = 0", "x = −2", ["x = 2", "x = −2", "x = −4", "x = 4"], "Subtrahiere 8, teile durch 4."]
  ],
  10: [
    ["Nullstellen von y = x² − 9", "x = ±3", ["x = ±9", "x = ±3", "x = 0 und 9", "x = 3"], "x² − 9 = (x − 3)(x + 3)."],
    ["Scheitelpunkt von y = (x − 2)² + 1", "S(2 | 1)", ["S(−2 | 1)", "S(2 | 1)", "S(2 | −1)", "S(1 | 2)"], "Scheitelpunktform y = (x − d)² + e."],
    ["2(x + 3) = 18", "x = 6", ["x = 3", "x = 6", "x = 9", "x = 12"], "Teile durch 2, subtrahiere 3."],
    ["Steigung von y = 0,5x − 4", "0,5", ["−4", "4", "0,5", "−0,5"], "Koeffizient vor x."],
    ["x² − 5x + 6 = 0", "x = 2 und x = 3", ["x = −2 und x = −3", "x = 2 und x = 3", "x = 1 und x = 6", "x = −1 und x = −6"], "(x − 2)(x − 3) = 0."],
    ["f(3) für f(x) = 2x² − 1", "17", ["5", "11", "17", "18"], "2 · 9 − 1 = 17."],
    ["Steigung einer waagerechten Geraden", "0", ["1", "−1", "0", "nicht definiert"], "Der y-Wert bleibt konstant."],
    ["3x − 2 = 2x + 6", "x = 8", ["x = 4", "x = 6", "x = 8", "x = −8"], "Subtrahiere 2x, addiere 2."],
    ["Welche Form ist die Scheitelpunktform?*", "y = a(x − d)² + e", ["y = mx + b", "y = a(x − d)² + e", "y = ax² + bx + c", "y = 1/x"], "Zeigt den Scheitelpunkt direkt."],
    ["x² = 25", "x = ±5", ["x = 5", "x = −5", "x = ±5", "x = 25"], "Die Quadratwurzel liefert zwei Lösungen."],
    ["Schnittpunkt von y = 2x + 1 und y = x + 4", "(3 | 7)", ["(1 | 3)", "(3 | 7)", "(−3 | −5)", "(4 | 9)"], "Gleichsetzen: x = 3, y = 7."],
    ["Welche Funktion hat keine reellen Nullstellen?*", "y = x² + 1", ["y = x² − 1", "y = x² + 1", "y = x² − 4", "y = x²"], "x² + 1 ist immer positiv."],
    ["(x − 4)² = 0", "x = 4", ["x = −4", "x = 0", "x = 4", "x = ±4"], "Das Quadrat ist 0, wenn der Term 0 ist."],
    ["f(−2) für f(x) = 3x + 1", "−5", ["7", "−5", "−6", "5"], "3 · (−2) + 1 = −5."],
    ["Parallele zu y = 3x + 2*", "y = 3x − 7", ["y = −3x + 2", "y = 2x + 3", "y = 3x − 7", "y = −7x + 3"], "Parallele Geraden haben die gleiche Steigung."]
  ]
};
const BANK_EN = {
  7: [
    ["−12 + 15", "3", ["−3", "3", "27", "−27"], "Start at −12 and count 15 steps to the right."],
    ["12/18 in lowest terms", "2/3", ["6/9", "4/6", "2/3", "3/4"], "Divide numerator and denominator by 6."],
    ["−4 × 6", "−24", ["24", "−10", "−24", "−2"], "Negative times positive is negative."],
    ["25% of 80", "20", ["15", "20", "25", "30"], "25% is a quarter; 80 ÷ 4 = 20."],
    ["Larger number: −5 or −2?", "−2", ["−5", "−2", "−8", "−9"], "On the number line −2 is further to the right."],
    ["3/4 + 1/4", "1", ["1/2", "1", "2/8", "3/8"], "Same denominator: 4/4 = 1."],
    ["2.5 + 1.7", "4.2", ["3.2", "4.2", "4.12", "3.12"], "Add the decimals place by place."],
    ["7 − 12", "−5", ["5", "−5", "19", "−19"], "From 7, five steps past 0 to the left."],
    ["Smallest of −1, 4, −3, 0", "−3", ["−1", "4", "−3", "0"], "The smallest number is furthest to the left."],
    ["3/5 of 20", "12", ["8", "10", "12", "15"], "20 ÷ 5 × 3 = 12."],
    ["0.75 as a fraction", "3/4", ["1/4", "2/3", "3/4", "7/5"], "0.75 = 75/100 = 3/4."],
    ["(−3)²", "9", ["−9", "6", "9", "−6"], "The square of a negative number is positive."],
    ["1.2 × 10", "12", ["1.2", "120", "12", "0.12"], "Multiplying by 10 moves the decimal point one place."],
    ["Which fraction equals 1/2?*", "3/6", ["2/5", "3/6", "4/10", "5/8"], "Multiply numerator and denominator by the same number."],
    ["−8 − 5", "−13", ["−3", "13", "−13", "3"], "From −8, five more steps to the left."]
  ],
  8: [
    ["3x + 5 − x + 2", "2x + 7", ["4x + 7", "2x + 7", "2x + 3", "4x + 3"], "Collect like terms."],
    ["4x + 3x", "7x", ["7x²", "12x", "7x", "43x"], "Add the coefficients."],
    ["2x = 16", "x = 8", ["x = 4", "x = 8", "x = 16", "x = 32"], "Divide both sides by 2."],
    ["Slope of y = 3x + 2", "3", ["2", "3", "−3", "5"], "In y = mx + b, m is the slope."],
    ["5a for a = 4", "20", ["9", "20", "54", "1"], "Substitute a = 4: 5 × 4."],
    ["x + 7 = 12", "x = 5", ["x = 19", "x = −5", "x = 5", "x = 7"], "Subtract 7 from both sides."],
    ["3(2x + 4)", "6x + 12", ["5x + 7", "6x + 4", "6x + 12", "6x + 8"], "Distributive law."],
    ["y-intercept of y = −2x + 5", "5", ["−2", "2", "5", "−5"], "The y-intercept is b."],
    ["2³", "8", ["6", "8", "9", "16"], "2 × 2 × 2 = 8."],
    ["3x − 6 = 9", "x = 5", ["x = 1", "x = 3", "x = 5", "x = 15"], "Add 6, then divide by 3."],
    ["Which function is linear?*", "y = 2x − 1", ["y = x²", "y = 2x − 1", "y = 1/x", "y = x³"], "Linear function: y = mx + b."],
    ["(x + 2)(x + 3)", "x² + 5x + 6", ["x² + 6", "x² + 5x + 6", "2x + 5", "x² + 6x + 5"], "Multiply each term."],
    ["4x = 2x + 10", "x = 5", ["x = 2", "x = 5", "x = 10", "x = −5"], "Subtract 2x, then divide by 2."],
    ["Slope between (0, 1) and (2, 5)", "2", ["1", "2", "3", "4"], "Δy/Δx = 4/2 = 2."],
    ["5y − 2y + y", "4y", ["4", "4y", "8y", "3y"], "5 − 2 + 1 = 4."]
  ],
  9: [
    ["3x + 4 = 19", "x = 5", ["x = 3", "x = 5", "x = 7", "x = 15"], "Subtract 4 and divide by 3."],
    ["x² + 5x factorised", "x(x + 5)", ["x + 5", "x(x + 5)", "x²(5x)", "5(x + 1)"], "Take out the common factor x."],
    ["(x + 3)²", "x² + 6x + 9", ["x² + 9", "x² + 6x + 9", "x² + 3x + 9", "2x + 6"], "Binomial square."],
    ["x² = 49", "x = ±7", ["x = 7", "x = −7", "x = ±7", "x = 49"], "7² and (−7)² are both 49."],
    ["2x − 5 = 11", "x = 8", ["x = 3", "x = 6", "x = 8", "x = −8"], "Add 5 and divide by 2."],
    ["(x − 2)(x + 2)", "x² − 4", ["x² + 4", "x² − 4", "x² − 2x + 4", "x² + 2x − 4"], "Difference of two squares."],
    ["x² − 9 = 0", "x = ±3", ["x = 3", "x = −3", "x = ±3", "x = 9"], "x² = 9."],
    ["Slope of y = −4x + 7", "−4", ["7", "4", "−4", "−7"], "The coefficient of x."],
    ["5(x − 1) = 20", "x = 5", ["x = 3", "x = 4", "x = 5", "x = 6"], "Divide by 5, then add 1."],
    ["Roots of y = x² − 16", "x = ±4", ["x = 0 and 16", "x = ±4", "x = 4", "x = ±16"], "x² − 16 = (x − 4)(x + 4)."],
    ["2x + 3 = x − 4", "x = −7", ["x = 7", "x = −1", "x = −7", "x = 1"], "Subtract x and 3."],
    ["(2x)²", "4x²", ["2x²", "4x", "4x²", "2x"], "Both 2 and x are squared."],
    ["Which equation is quadratic?*", "x² + 2x − 3 = 0", ["2x + 3 = 0", "x² + 2x − 3 = 0", "1/x = 2", "3x = 9"], "The highest power is 2."],
    ["x² = 0", "x = 0", ["x = 1", "x = 0", "x = ±1", "no solution"], "Only 0² = 0."],
    ["4x + 8 = 0", "x = −2", ["x = 2", "x = −2", "x = −4", "x = 4"], "Subtract 8, divide by 4."]
  ],
  10: [
    ["Roots of y = x² − 9", "x = ±3", ["x = ±9", "x = ±3", "x = 0 and 9", "x = 3"], "x² − 9 = (x − 3)(x + 3)."],
    ["Vertex of y = (x − 2)² + 1", "(2, 1)", ["(−2, 1)", "(2, 1)", "(2, −1)", "(1, 2)"], "Vertex form y = (x − d)² + e."],
    ["2(x + 3) = 18", "x = 6", ["x = 3", "x = 6", "x = 9", "x = 12"], "Divide by 2, subtract 3."],
    ["Slope of y = 0.5x − 4", "0.5", ["−4", "4", "0.5", "−0.5"], "The coefficient of x."],
    ["x² − 5x + 6 = 0", "x = 2 and x = 3", ["x = −2 and x = −3", "x = 2 and x = 3", "x = 1 and x = 6", "x = −1 and x = −6"], "(x − 2)(x − 3) = 0."],
    ["f(3) for f(x) = 2x² − 1", "17", ["5", "11", "17", "18"], "2 × 9 − 1 = 17."],
    ["Slope of a horizontal line", "0", ["1", "−1", "0", "not defined"], "The y-value stays the same."],
    ["3x − 2 = 2x + 6", "x = 8", ["x = 4", "x = 6", "x = 8", "x = −8"], "Subtract 2x, add 2."],
    ["Which form is vertex form?*", "y = a(x − d)² + e", ["y = mx + b", "y = a(x − d)² + e", "y = ax² + bx + c", "y = 1/x"], "It shows the vertex directly."],
    ["x² = 25", "x = ±5", ["x = 5", "x = −5", "x = ±5", "x = 25"], "The square root gives two solutions."],
    ["Intersection of y = 2x + 1 and y = x + 4", "(3, 7)", ["(1, 3)", "(3, 7)", "(−3, −5)", "(4, 9)"], "Set equal: x = 3, y = 7."],
    ["Which function has no real roots?*", "y = x² + 1", ["y = x² − 1", "y = x² + 1", "y = x² − 4", "y = x²"], "x² + 1 is always positive."],
    ["(x − 4)² = 0", "x = 4", ["x = −4", "x = 0", "x = 4", "x = ±4"], "The square is 0 when the bracket is 0."],
    ["f(−2) for f(x) = 3x + 1", "−5", ["7", "−5", "−6", "5"], "3 × (−2) + 1 = −5."],
    ["Parallel to y = 3x + 2*", "y = 3x − 7", ["y = −3x + 2", "y = 2x + 3", "y = 3x − 7", "y = −7x + 3"], "Parallel lines have the same slope."]
  ]
};
/* Form (Ausdruck/Frage, nur Auswahl, Zahlenwert) kommt aus der deutschen
   Zeile, damit sich die Aufgabe in beiden Sprachen gleich verhält. */
function bankItem(de, row) {
  const mcOnly = de[0].endsWith("*");
  const q = row[0].endsWith("*") ? row[0].slice(0, -1) : row[0];
  const qde = mcOnly ? de[0].slice(0, -1) : de[0];
  const expr = !/[=?:]/.test(qde) && !/[A-Za-zäöüß]{3,}/.test(qde);
  const n = Number(de[1].replace("−", "-").replace(",", "."));
  return { q, a: row[1], wrong: row[2].filter(o => o !== row[1]).slice(0, 3), hint: row[3], expr, mcOnly, num: Number.isFinite(n) ? n : undefined };
}
function bankFor(grade) { return (LANG === "en" ? BANK_EN : BANK_DE)[grade]; }
/* Zeile per Samen wählen, Text in der Sprache des Geräts */
function genBank(grade) {
  return r => { const i = r.int(0, BANK_DE[grade].length - 1); return bankItem(BANK_DE[grade][i], bankFor(grade)[i]); };
}

/* ---------- Themenliste ----------
   Die Nummer (Index) steht im Spielcode und darf sich nie ändern.
   Neue Themen nur hinten anfügen. */
function topic(k, gen, extra) {
  return Object.assign({ k, gen, get name() { return t("topic." + k); }, get grade() { return t("grade." + k); } }, extra || {});
}
const TOPICS = [
  topic("times", genEinmaleins),
  topic("integers", genGanze),
  topic("fractions", genBrueche),
  topic("percent", genProzent),
  topic("powers", genPotenzen),
  topic("terms", genTerme),
  topic("equations", genGleichungen),
  topic("linear", genLinear, { graph: true }),
  topic("quadratic", genQuadratisch, { graph: true }),
  topic("bank7", genBank(7), { bank: 7 }),
  topic("bank8", genBank(8), { bank: 8 }),
  topic("bank9", genBank(9), { bank: 9 }),
  topic("bank10", genBank(10), { bank: 10 })
];

/* n verschiedene Aufgaben (verschiedene Fragen UND verschiedene Antworten).
   opt.graph: Funktions-Themen liefern Graph-Aufgaben.
   opt.mc:    auch Aufgaben, die nur mit Auswahl funktionieren.
   Gibt weniger als n zurück, wenn das Thema nicht genug hergibt. */
function makeItems(topicId, r, n, opt = {}) {
  const topic = TOPICS[topicId];
  const out = [], qs = new Set(), as = new Set();
  const wantGraph = !!(opt.graph && topic.graph);
  for (let tries = 0; out.length < n && tries < n * 60; tries++) {
    const it = topic.gen(r, { graph: wantGraph });
    if (it.mcOnly && !opt.mc) continue;
    const qk = it.fn ? JSON.stringify(it.fn) : it.q;
    if (qs.has(qk) || as.has(it.a)) continue;
    if (opt.needNum && !Number.isFinite(it.num)) continue;
    qs.add(qk); as.add(it.a);
    out.push(it);
  }
  return out;
}
/* Wie viele verschiedene Aufgaben kann ein Thema höchstens liefern? (Bank: 15) */
function topicCapacity(topicId) { return TOPICS[topicId].bank ? 15 : 200; }

/* Aussage einer Aufgabe mit beliebiger Antwort: "12 · 4 = 48" oder "Frage → Antwort" */
function statementText(it, answer) {
  if (it.fn) return answer;
  return it.expr ? `${it.q} = ${answer}` : `${it.q}  →  ${answer}`;
}

/* ---------- Funktionsgraph als SVG (Koordinatensystem −5 … 5) ---------- */
function fnValue(fn, x) {
  return fn.type === "lin" ? fn.m * x + fn.b : fn.k * (x - fn.d) * (x - fn.d) + fn.e;
}
function graphSVG(fn, opts = {}) {
  const R = 5.5, U = 20, W = 2 * R * U;
  const X = x => (x + R) * U, Y = y => (R - y) * U;
  const clip = "c" + Math.random().toString(36).slice(2, 8);
  const svg = s("svg", { viewBox: `0 0 ${W} ${W}`, class: "graph", role: "img", "aria-label": t("a11y.graph") });
  svg.append(s("defs", null, s("clipPath", { id: clip }, s("rect", { x: 0, y: 0, width: W, height: W }))));
  const grid = s("g", { class: "g-grid" });
  for (let i = -5; i <= 5; i++) {
    grid.append(s("line", { x1: X(i), y1: 0, x2: X(i), y2: W }), s("line", { x1: 0, y1: Y(i), x2: W, y2: Y(i) }));
  }
  svg.append(grid);
  svg.append(s("g", { class: "g-axis" },
    s("line", { x1: 0, y1: Y(0), x2: W, y2: Y(0) }), s("line", { x1: X(0), y1: 0, x2: X(0), y2: W }),
    s("path", { d: `M${W - 1} ${Y(0)} l-7 -4 v8z` }), s("path", { d: `M${X(0)} 1 l-4 7 h8z` })));
  const lab = s("g", { class: "g-lab" });
  [-4, -2, 2, 4].forEach(v => {
    lab.append(s("text", { x: X(v), y: Y(0) + 13, "text-anchor": "middle" }, num(v)));
    lab.append(s("text", { x: X(0) - 5, y: Y(v) + 4, "text-anchor": "end" }, num(v)));
  });
  lab.append(s("text", { x: W - 6, y: Y(0) - 6, "text-anchor": "end", class: "g-var" }, "x"));
  lab.append(s("text", { x: X(0) + 7, y: 12, class: "g-var" }, "y"));
  svg.append(lab);
  let d = "";
  for (let i = 0; i <= 160; i++) {
    const x = -R + (2 * R) * i / 160;
    const y = Math.max(-40, Math.min(40, fnValue(fn, x)));
    d += (i ? "L" : "M") + X(x).toFixed(1) + " " + Y(y).toFixed(1);
  }
  svg.append(s("path", { d, class: "g-curve", "clip-path": `url(#${clip})` }));
  return svg;
}
/* Gesicht einer Aufgabe: Graph oder Text */
function promptFace(it) {
  return it.fn ? graphSVG(it.fn) : h("span", { class: "face-text" }, it.q);
}
