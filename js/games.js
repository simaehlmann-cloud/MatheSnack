/* MatheSnack – die Spiele
   Jedes Spiel bekommt ctx:
     cfg      {g, t, a, b, seed} aus dem Spielcode
     root     Element, in das das Spiel zeichnet
     items    (n, opt) -> Aufgaben aus Thema und Samen
     finish   (ergebnis) -> Ergebnisbildschirm
     onLeave  (fn) -> Aufräumen beim Verlassen (Zeitgeber anhalten) */
"use strict";

const GAMES = [
  { key: "sprint", name: "Kopfrechen-Sprint", icon: "⚡", color: "amber",
    desc: "So viele Aufgaben wie möglich, bevor die Zeit abläuft.",
    a: { label: "Zeit", values: [60, 90, 120, 180], fmt: v => v + " Sekunden", def: 1 },
    graph: true, student: true, play: playSprint },
  { key: "fehler", name: "Fehlersuche", icon: "🔍", color: "rose",
    desc: "Sechs Rechnungen – welche sind falsch?",
    a: { label: "Runden", values: [3, 5, 8], fmt: v => v + " Runden", def: 1 },
    graph: true, student: true, play: playFehler },
  { key: "memory", name: "Memory", icon: "🃏", color: "violet",
    desc: "Aufgabe und Ergebnis als Paar finden.",
    a: { label: "Paare", values: [6, 8, 10], fmt: v => v + " Paare", def: 0 },
    graph: true, student: true, play: playMemory },
  { key: "domino", name: "Domino", icon: "🁫", color: "teal",
    desc: "Lege die Kette: Ergebnis an Aufgabe, vom Start bis ins Ziel.",
    a: { label: "Steine", values: [8, 10, 12, 15], fmt: v => v + " Steine", def: 1 },
    graph: true, student: true, play: playDomino },
  { key: "zuordnen", name: "Zuordnen", icon: "🔗", color: "blue",
    desc: "Je vier Paare verbinden – auch Graph und Gleichung.",
    a: { label: "Runden", values: [3, 5, 8], fmt: v => v + " Runden", def: 1 },
    graph: true, student: true, play: playZuordnen },
  { key: "bingo", name: "Kopfrechen-Bingo", icon: "🎯", color: "green",
    desc: "Der Beamer zeigt Aufgaben, jede Karte ist anders. Wer hat zuerst eine Reihe?",
    a: { label: "Karte", values: [3, 4], fmt: v => v + " × " + v, def: 1 },
    graph: false, student: true, leader: true, play: playBingo },
  { key: "schiffe", name: "Schiffe versenken", icon: "🚢", color: "blue",
    desc: "Koordinaten ansagen, eintragen, treffen.",
    a: { label: "Koordinatensystem", values: [0, 1], fmt: v => ["−5 bis 5 (alle Quadranten)", "0 bis 10 (1. Quadrant)"][v], def: 0 },
    b: { label: "Spielform", values: [0, 1, 2], fmt: v => ["Klasse gegen Lehrkraft (Beamer)", "Allein gegen die App", "Partnerspiel mit zwei Geräten"][v], def: 0 },
    noTopic: true, student: true, play: playSchiffe },
  { key: "rallye", name: "Stationen-Rallye", icon: "🏃", color: "orange",
    desc: "QR-Karten im Raum verteilen. Jede Station liefert einen Buchstaben des Lösungsworts.",
    a: { label: "Stationen", values: [5, 6, 8, 10], fmt: v => v + " Stationen", def: 1 },
    graph: true, student: true, play: playRallye },
  { key: "move", name: "Move & Brain", icon: "🤸", color: "green",
    desc: "Bewegungspause am Beamer: Aufstehen bei wahr, Arm heben bei größer.",
    a: { label: "Dauer", values: [2, 3, 5], fmt: v => v + " Minuten", def: 0 },
    b: { label: "Bewegung", values: [0, 1, 2], fmt: v => ["Wahr oder falsch? (aufstehen/sitzen)", "Was ist mehr? (linker/rechter Arm)", "Mix mit Bewegungsimpulsen"][v], def: 0 },
    graph: false, beamerOnly: true, play: playMove }
];

function validConfig(cfg) {
  const g = GAMES[cfg.g];
  if (!g) return false;
  if (cfg.a >= g.a.values.length) return false;
  if (g.key === "rallye") { if (cfg.b > g.a.values[cfg.a]) return false; }
  else if (g.b ? cfg.b >= g.b.values.length : cfg.b !== 0) return false;
  if (!g.noTopic && !TOPICS[cfg.t]) return false;
  return true;
}
function gameSetting(cfg, which = "a") { const g = GAMES[cfg.g]; return g[which] ? g[which].values[cfg[which]] : 0; }
function cfgLabel(cfg) {
  const g = GAMES[cfg.g];
  const parts = [g.name];
  if (!g.noTopic) parts.push(TOPICS[cfg.t].name);
  parts.push(g.a.fmt(gameSetting(cfg, "a")));
  if (g.b && g.key !== "rallye") parts.push(g.b.fmt(gameSetting(cfg, "b")));
  return parts.join(" · ");
}

/* ---------- gemeinsame Bausteine ---------- */
function answerFace(text) { return h("span", { class: "face-text" }, text); }
function statementFace(it, answer) {
  if (it.fn) return h("div", { class: "stmt-graph" }, graphSVG(it.fn), h("div", { class: "stmt-eq" }, answer));
  return h("span", { class: "face-text" }, statementText(it, answer));
}
function hud(...pills) { return h("div", { class: "hud" }, pills); }
function pill(text, cls) { return h("span", { class: "pill " + (cls || "") }, text); }
function countdownThen(root, label, fn) {
  let n = 3;
  const big = h("div", { class: "countdown" }, "3");
  root.replaceChildren(h("div", { class: "center-stage" }, h("p", { class: "muted" }, label), big));
  const tick = () => {
    n--;
    if (n <= 0) { fn(); return; }
    big.textContent = String(n);
    big.classList.remove("pop"); void big.offsetWidth; big.classList.add("pop");
    setTimeout(tick, 650);
  };
  setTimeout(tick, 650);
}
function readyScreen(ctx, intro, onGo) {
  const g = GAMES[ctx.cfg.g];
  ctx.root.replaceChildren(h("div", { class: "center-stage" },
    h("div", { class: "big-icon", "aria-hidden": "true" }, g.icon),
    h("h2", null, g.name),
    g.noTopic ? null : h("p", { class: "topic-line" }, TOPICS[ctx.cfg.t].name),
    h("p", { class: "muted intro" }, intro),
    h("button", { class: "btn primary xl", type: "button", onclick: onGo }, "Los geht's")));
}

/* =====================================================================
   Kopfrechen-Sprint
   ===================================================================== */
function playSprint(ctx) {
  const dur = gameSetting(ctx.cfg);
  const items = ctx.items(80, { graph: true, mc: true });
  const r = makeRng(ctx.cfg.seed ^ 0x5151);
  let order = r.shuffle(items), i = 0, score = 0, wrongN = 0, streak = 0, best = 0, end = 0, busy = false, timer = null;

  const timeEl = pill(""), scoreEl = pill("", "good"), streakEl = pill("");
  const bar = h("div", { class: "timebar" }, h("div"));
  const prompt = h("div", { class: "prompt" });
  const opts = h("div", { class: "options" });
  const stage = h("div", { class: "game" }, hud(timeEl, scoreEl, streakEl), bar, prompt, opts);

  function updateHud() {
    scoreEl.textContent = "✓ " + score;
    streakEl.textContent = "🔥 " + streak;
  }
  function next() {
    if (i >= order.length) { order = r.shuffle(items); i = 0; }
    const it = order[i++];
    prompt.replaceChildren(...[promptFace(it), !it.fn && it.expr ? h("span", { class: "eq-tail" }, " = ?") : null].filter(Boolean));
    prompt.classList.toggle("is-graph", !!it.fn);
    const choices = r.shuffle([it.a, ...it.wrong]);
    opts.replaceChildren(...choices.map(c => h("button", { class: "opt", type: "button", onclick: e => pick(e.currentTarget, c, it) }, c)));
    busy = false;
  }
  function pick(btn, c, it) {
    if (busy || !end) return;
    busy = true;
    if (c === it.a) {
      score++; streak++; best = Math.max(best, streak);
      btn.classList.add("right");
      updateHud();
      setTimeout(next, 220);
    } else {
      wrongN++; streak = 0; vibrate(60);
      btn.classList.add("wrong");
      [...opts.children].forEach(b => { if (b.textContent === it.a) b.classList.add("right"); });
      updateHud();
      setTimeout(next, 1100);
    }
  }
  function tick() {
    const left = (end - Date.now()) / 1000;
    timeEl.textContent = "⏱ " + fmtTime(left);
    bar.firstChild.style.width = Math.max(0, left / dur * 100) + "%";
    bar.classList.toggle("late", left < 10);
    if (left <= 0) {
      clearInterval(timer); end = 0;
      ctx.finish({ big: score, unit: score === 1 ? "Aufgabe richtig" : "Aufgaben richtig",
        lines: [`${wrongN} falsch`, `beste Serie: ${best}`], record: { key: "sprint", value: score } });
    }
  }
  ctx.onLeave(() => clearInterval(timer));
  readyScreen(ctx, `${dur} Sekunden. Tippe die richtige Antwort an. Fehler kosten etwas Zeit.`, () =>
    countdownThen(ctx.root, "Gleich geht's los …", () => {
      ctx.root.replaceChildren(stage);
      end = Date.now() + dur * 1000;
      updateHud(); next(); tick();
      timer = setInterval(tick, 200);
    }));
}

/* =====================================================================
   Fehlersuche
   ===================================================================== */
function playFehler(ctx) {
  const rounds = gameSetting(ctx.cfg);
  const pool = ctx.items(6 * rounds, { graph: true });
  const r = makeRng(ctx.cfg.seed ^ 0xFE01);
  let round = 0, points = 0, total = 0;

  function playRound() {
    const start = (round * 6) % Math.max(1, pool.length);
    const set = [];
    for (let k = 0; k < 6; k++) set.push(pool[(start + k) % pool.length]);
    const nWrong = r.int(1, 3);
    const wrongIdx = new Set(r.shuffle([0, 1, 2, 3, 4, 5]).slice(0, nWrong));
    const marked = new Set();
    let checked = false;
    const cards = set.map((it, k) => {
      const isWrong = wrongIdx.has(k);
      const shown = isWrong ? r.pick(it.wrong) : it.a;
      const card = h("button", { class: "stmt", type: "button", "aria-pressed": "false" },
        h("span", { class: "stmt-mark", "aria-hidden": "true" }), statementFace(it, shown));
      card.addEventListener("click", () => {
        if (checked) return;
        if (marked.has(k)) marked.delete(k); else marked.add(k);
        card.classList.toggle("marked", marked.has(k));
        card.setAttribute("aria-pressed", String(marked.has(k)));
      });
      return { card, it, isWrong };
    });
    const btn = h("button", { class: "btn primary", type: "button" }, "Prüfen");
    const info = h("p", { class: "muted center" }, "Tippe alle falschen Rechnungen an. Es sind mindestens eine und höchstens drei.");
    btn.addEventListener("click", () => {
      if (!checked) {
        checked = true;
        cards.forEach((c, k) => {
          const m = marked.has(k);
          total++;
          if (m === c.isWrong) points++;
          c.card.classList.add(c.isWrong ? (m ? "found" : "missed") : (m ? "falsealarm" : "ok"));
          if (c.isWrong) c.card.append(h("span", { class: "stmt-fix" }, "richtig: " + c.it.a));
        });
        scorePill.textContent = `✓ ${points}`;
        btn.textContent = round + 1 < rounds ? "Nächste Runde" : "Ergebnis";
        info.textContent = "Grün: richtig erkannt · Orange: übersehen · Grau durchgestrichen: war doch richtig";
      } else {
        round++;
        if (round < rounds) playRound();
        else ctx.finish({ big: points + " / " + total, unit: "richtig eingeschätzt", lines: [`${rounds} Runden`], record: { key: "fehler", value: Math.round(points / total * 100) } });
      }
    });
    const scorePill = pill(`✓ ${points}`, "good");
    ctx.root.replaceChildren(h("div", { class: "game" },
      hud(pill(`Runde ${round + 1} / ${rounds}`), scorePill),
      info, h("div", { class: "stmts" }, cards.map(c => c.card)), h("div", { class: "center" }, btn)));
  }
  readyScreen(ctx, "Prüfe sechs Rechnungen. Markiere die falschen – dann zeigt die App die richtigen Ergebnisse.", playRound);
}

/* =====================================================================
   Memory
   ===================================================================== */
function playMemory(ctx) {
  const n = gameSetting(ctx.cfg);
  const items = ctx.items(n, { graph: true });
  const r = deviceRng();
  const cards = r.shuffle(items.flatMap((it, k) => [{ k, side: "q", it }, { k, side: "a", it }]));
  let open = [], moves = 0, found = 0, lock = false, t0 = 0;
  const movesEl = pill("Züge: 0"), foundEl = pill(`Paare: 0 / ${items.length}`, "good");
  const grid = h("div", { class: "memory cols-" + (cards.length > 16 ? 5 : 4) });
  cards.forEach(c => {
    const face = c.side === "q" ? promptFace(c.it) : answerFace(c.it.a);
    const el = h("button", { class: "mcard side-" + c.side, type: "button", "aria-label": "verdeckte Karte" },
      h("span", { class: "mback", "aria-hidden": "true" }, "?"), h("span", { class: "mface" }, face));
    el.addEventListener("click", () => flip(c, el));
    c.el = el;
    grid.append(el);
  });
  function flip(c, el) {
    if (lock || el.classList.contains("up") || el.classList.contains("done")) return;
    if (!t0) t0 = Date.now();
    el.classList.add("up");
    el.setAttribute("aria-label", c.side === "q" ? "Aufgabe" : "Ergebnis");
    open.push(c);
    if (open.length < 2) return;
    moves++;
    movesEl.textContent = "Züge: " + moves;
    const [x, y] = open;
    open = [];
    if (x.k === y.k && x.side !== y.side) {
      found++;
      foundEl.textContent = `Paare: ${found} / ${items.length}`;
      setTimeout(() => { x.el.classList.add("done"); y.el.classList.add("done"); }, 300);
      if (found === items.length) setTimeout(() => ctx.finish({ big: moves, unit: "Züge", lines: [`${items.length} Paare in ${fmtTime((Date.now() - t0) / 1000)} min`, `bestmöglich: ${items.length} Züge`] }), 900);
    } else {
      lock = true;
      setTimeout(() => {
        [x, y].forEach(c2 => { c2.el.classList.remove("up"); c2.el.setAttribute("aria-label", "verdeckte Karte"); });
        lock = false;
      }, 1300);
    }
  }
  ctx.root.replaceChildren(h("div", { class: "game" }, hud(movesEl, foundEl),
    h("p", { class: "muted center small" }, "Blau: Aufgabe · Orange: Ergebnis"), grid));
}

/* =====================================================================
   Domino
   ===================================================================== */
function playDomino(ctx) {
  const n = gameSetting(ctx.cfg);
  const items = ctx.items(n, { graph: true });
  const N = items.length;
  /* Stein 0: START | Aufgabe 1; Stein i: Ergebnis i | Aufgabe i+1; Stein N: Ergebnis N | ZIEL */
  const stones = [];
  for (let i = 0; i <= N; i++) stones.push({ i, left: i === 0 ? null : items[i - 1], right: i === N ? null : items[i] });
  const stoneEl = (st, small) => h("div", { class: "stone" + (small ? " small" : "") },
    h("div", { class: "half left" }, st.left ? answerFace(st.left.a) : h("span", { class: "flag" }, "START")),
    h("div", { class: "half right" }, st.right ? promptFace(st.right) : h("span", { class: "flag" }, "ZIEL 🏁")));
  const r = deviceRng();
  let placed = 1, errors = 0;
  const t0 = Date.now();
  const chain = h("div", { class: "chain" });
  const pool = h("div", { class: "pool" });
  const errEl = pill("Fehlversuche: 0"), progEl = pill("");
  const info = h("p", { class: "muted center small" }, "Welcher Stein beginnt mit dem Ergebnis der offenen Aufgabe?");
  function render() {
    chain.replaceChildren(...stones.slice(Math.max(0, placed - 2), placed).map((st, k, arr) => {
      const el = stoneEl(st, k < arr.length - 1);
      if (k === arr.length - 1) el.classList.add("current");
      return el;
    }));
    progEl.textContent = `Steine: ${placed - 1} / ${N}`;
  }
  const order = r.shuffle(stones.slice(1));
  order.forEach(st => {
    const el = h("button", { class: "stone-btn", type: "button" }, stoneEl(st, true));
    el.addEventListener("click", () => {
      if (st.i === placed) {
        el.remove();
        placed++;
        render();
        if (placed > N) ctx.finish({ big: errors, unit: errors === 1 ? "Fehlversuch" : "Fehlversuche", lines: [`${N} Steine in ${fmtTime((Date.now() - t0) / 1000)} min`] });
      } else {
        errors++; vibrate(60);
        errEl.textContent = "Fehlversuche: " + errors;
        el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
      }
    });
    pool.append(el);
  });
  render();
  ctx.root.replaceChildren(h("div", { class: "game" }, hud(progEl, errEl), chain, info, pool));
}

/* =====================================================================
   Zuordnen
   ===================================================================== */
function playZuordnen(ctx) {
  const rounds = gameSetting(ctx.cfg);
  const items = ctx.items(4 * rounds, { graph: true });
  const r = deviceRng();
  let round = 0, errors = 0;
  const t0 = Date.now();
  const COLORS = ["c1", "c2", "c3", "c4"];
  function playRound() {
    const set = [];
    for (let k = 0; k < 4; k++) set.push(items[(round * 4 + k) % items.length]);
    let sel = null, done = 0;
    const left = h("div", { class: "col" }), right = h("div", { class: "col" });
    const lefts = set.map((it, k) => {
      const el = h("button", { class: "pairbtn", type: "button" }, promptFace(it));
      el.addEventListener("click", () => {
        if (el.disabled) return;
        lefts.forEach(x => x.classList.remove("sel"));
        el.classList.add("sel"); sel = k;
      });
      return el;
    });
    r.shuffle(set.map((it, k) => k)).forEach(k => {
      const el = h("button", { class: "pairbtn ans", type: "button" }, answerFace(set[k].a));
      el.addEventListener("click", () => {
        if (el.disabled || sel === null) { if (sel === null) toast("Wähle zuerst links eine Aufgabe."); return; }
        if (sel === k) {
          const c = COLORS[done];
          lefts[k].classList.remove("sel");
          lefts[k].classList.add("matched", c); el.classList.add("matched", c);
          lefts[k].disabled = true; el.disabled = true;
          sel = null; done++;
          if (done === 4) setTimeout(() => {
            round++;
            if (round < rounds) playRound();
            else ctx.finish({ big: errors, unit: errors === 1 ? "Fehler" : "Fehler", lines: [`${rounds * 4} Paare in ${fmtTime((Date.now() - t0) / 1000)} min`] });
          }, 700);
        } else {
          errors++; vibrate(60);
          el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
        }
      });
      right.append(el);
    });
    left.append(...lefts);
    ctx.root.replaceChildren(h("div", { class: "game" },
      hud(pill(`Runde ${round + 1} / ${rounds}`), pill(`Fehler: ${errors}`)),
      h("p", { class: "muted center small" }, "Tippe links eine Aufgabe, dann rechts das passende Ergebnis."),
      h("div", { class: "pairs" }, left, right)));
  }
  playRound();
}

/* =====================================================================
   Bingo – Schülerkarte und Spielleitung
   ===================================================================== */
function bingoSetup(cfg) {
  let size = gameSetting(cfg);
  const pool = makeItems(cfg.t, makeRng(cfg.seed), size * size * 2, {});
  if (pool.length < size * size && size === 4) size = 3;
  const calls = makeRng(cfg.seed ^ 0xB1B1).shuffle(pool);
  return { size, pool, calls };
}
function playBingo(ctx) {
  const { size, pool, calls } = bingoSetup(ctx.cfg);
  const cells = size * size;
  if (pool.length < cells) {
    ctx.root.replaceChildren(h("div", { class: "center-stage" }, h("p", null, "Dieses Thema hat zu wenige verschiedene Ergebnisse für eine Bingo-Karte. Bitte ein anderes Thema wählen.")));
    return;
  }
  /* eigene Karte: Gerätezufall, gemerkt für diese Sitzung (versehentliches Neuladen) */
  const key = "bingo." + encodeCode(ctx.cfg);
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(key) || "null"); } catch (e) { saved = null; }
  let card = saved && Array.isArray(saved.card) && saved.card.length === cells ? saved.card : deviceRng().shuffle(pool.map((_, k) => k)).slice(0, cells);
  let marks = new Set(saved && Array.isArray(saved.marks) ? saved.marks : []);
  let solo = false, soloCount = 0;
  const persist = () => { try { sessionStorage.setItem(key, JSON.stringify({ card, marks: [...marks] })); } catch (e) { /* egal */ } };
  persist();

  const grid = h("div", { class: "bingo size-" + size });
  const cellEls = card.map((pi, ci) => {
    const el = h("button", { class: "bcell", type: "button", "aria-pressed": "false" }, pool[pi].a);
    el.addEventListener("click", () => {
      if (marks.has(ci)) marks.delete(ci); else marks.add(ci);
      paint(); persist();
    });
    return el;
  });
  grid.append(...cellEls);
  function paint(win, bad) {
    cellEls.forEach((el, ci) => {
      el.classList.toggle("on", marks.has(ci));
      el.setAttribute("aria-pressed", String(marks.has(ci)));
      el.classList.toggle("win", !!(win && win.includes(ci)));
      el.classList.toggle("bad", !!(bad && bad.includes(ci)));
    });
  }
  paint();

  const soloBox = h("div", { class: "solo-call", hidden: true });
  const soloPrompt = h("div", { class: "prompt small" });
  const soloNr = pill("");
  const soloNext = h("button", { class: "btn", type: "button" }, "Nächste Aufgabe ›");
  soloNext.addEventListener("click", () => {
    if (soloCount >= calls.length) { toast("Alle Aufgaben gezogen."); return; }
    soloCount++; showSolo();
  });
  soloBox.append(soloNr, soloPrompt, soloNext);
  function showSolo() {
    const it = calls[soloCount - 1];
    soloNr.textContent = `Aufgabe ${soloCount} von ${calls.length}`;
    soloPrompt.replaceChildren(h("span", { class: "face-text" }, it.q + (it.expr ? " = ?" : "")));
  }
  const soloBtn = h("button", { class: "btn ghost small", type: "button" }, "Ohne Beamer spielen");
  soloBtn.addEventListener("click", () => {
    solo = !solo;
    soloBox.hidden = !solo;
    soloBtn.textContent = solo ? "Mit Beamer spielen" : "Ohne Beamer spielen";
    if (solo && soloCount === 0) { soloCount = 1; showSolo(); }
  });

  function check(k) {
    const called = new Set(calls.slice(0, k).map(it => it.a));
    const ok = ci => marks.has(ci) && called.has(pool[card[ci]].a);
    const lines = [];
    for (let i = 0; i < size; i++) {
      lines.push([...Array(size)].map((_, j) => i * size + j));
      lines.push([...Array(size)].map((_, j) => j * size + i));
    }
    lines.push([...Array(size)].map((_, j) => j * size + j));
    lines.push([...Array(size)].map((_, j) => j * size + size - 1 - j));
    const win = lines.find(l => l.every(ok));
    const bad = [...marks].filter(ci => !called.has(pool[card[ci]].a));
    paint(win, bad);
    if (win) {
      dialog("🎉 BINGO!", "Deine Reihe stimmt. Zeig dein Gerät der Lehrkraft.", [{ label: "Super", primary: true }]);
    } else if (bad.length) {
      dialog("Noch kein Bingo", `${bad.length === 1 ? "Ein markiertes Feld passt" : bad.length + " markierte Felder passen"} zu keiner der ersten ${k} Aufgaben (rot). Prüfe sie noch einmal.`, [{ label: "OK", primary: true }]);
    } else {
      dialog("Noch kein Bingo", "Deine Markierungen stimmen, aber eine vollständige Reihe fehlt noch.", [{ label: "Weiter", primary: true }]);
    }
  }
  const bingoBtn = h("button", { class: "btn primary xl", type: "button" }, "BINGO!");
  bingoBtn.addEventListener("click", () => {
    if (solo) { check(soloCount); return; }
    const inp = h("input", { type: "number", inputmode: "numeric", min: 1, max: calls.length, class: "numinput", "aria-label": "Nummer der aktuellen Aufgabe" });
    dialog("Bingo prüfen", h("div", null, h("p", null, "Welche Nummer hat die Aufgabe, die gerade am Beamer steht?"), inp), [
      { label: "Abbrechen" },
      { label: "Prüfen", primary: true, action: () => {
        const k = Math.round(Number(inp.value));
        if (!(k >= 1 && k <= calls.length)) { toast(`Bitte eine Zahl von 1 bis ${calls.length} eingeben.`); return false; }
        setTimeout(() => check(k), 50);
      } }
    ]);
    setTimeout(() => inp.focus(), 100);
  });
  const newCard = h("button", { class: "btn ghost small", type: "button" }, "Neue Karte");
  newCard.addEventListener("click", () => {
    confirmDialog("Neue Karte ziehen? Deine Markierungen gehen verloren.", () => {
      card = deviceRng().shuffle(pool.map((_, k) => k)).slice(0, cells);
      marks = new Set();
      cellEls.forEach((el, ci) => { el.textContent = pool[card[ci]].a; });
      paint(); persist();
    });
  });
  ctx.root.replaceChildren(h("div", { class: "game" },
    h("p", { class: "muted center small" }, "Rechne die Aufgabe am Beamer. Steht das Ergebnis auf deiner Karte, tippe es an."),
    soloBox, grid, h("div", { class: "center" }, bingoBtn), h("div", { class: "row center" }, soloBtn, newCard)));
}

/* Spielleitung am Beamer: zieht die Aufgaben in fester Reihenfolge (Samen) */
function bingoLeader(root, cfg, onLeave) {
  const { calls } = bingoSetup(cfg);
  let k = 0, auto = 0, autoTimer = null, showAll = false;
  const nr = h("div", { class: "lead-nr" });
  const big = h("div", { class: "lead-prompt" });
  const list = h("ol", { class: "lead-list", hidden: true });
  const prev = h("button", { class: "btn", type: "button" }, "‹ Zurück");
  const next = h("button", { class: "btn primary xl", type: "button" }, "Nächste Aufgabe ›");
  const autoSel = h("select", { class: "select", "aria-label": "Automatisch weiter" },
    [0, 15, 20, 30, 45].map(v => h("option", { value: v }, v ? `automatisch alle ${v} s` : "von Hand weiter")));
  const solBtn = h("button", { class: "btn ghost", type: "button" }, "Lösungen zeigen");
  function render() {
    if (k === 0) { nr.textContent = "Bingo"; big.textContent = "Alle bereit? Los geht's mit der ersten Aufgabe."; }
    else { const it = calls[k - 1]; nr.textContent = `Aufgabe ${k} von ${calls.length}`; big.textContent = it.q + (it.expr ? " = ?" : ""); }
    prev.disabled = k <= 1; next.disabled = k >= calls.length;
    list.replaceChildren(...calls.slice(0, k).map(it => h("li", null, statementText(it, it.a))));
  }
  prev.addEventListener("click", () => { if (k > 1) { k--; render(); } });
  next.addEventListener("click", () => { if (k < calls.length) { k++; render(); } });
  autoSel.addEventListener("change", () => {
    clearInterval(autoTimer); auto = Number(autoSel.value);
    if (auto) autoTimer = setInterval(() => { if (k < calls.length) { k++; render(); } else clearInterval(autoTimer); }, auto * 1000);
  });
  solBtn.addEventListener("click", () => { showAll = !showAll; list.hidden = !showAll; solBtn.textContent = showAll ? "Lösungen ausblenden" : "Lösungen zeigen"; });
  onLeave(() => clearInterval(autoTimer));
  keepAwake(true); onLeave(() => keepAwake(false));
  render();
  root.replaceChildren(h("div", { class: "leader" }, nr, big,
    h("div", { class: "row center" }, prev, next), h("div", { class: "row center" }, autoSel, solBtn),
    h("p", { class: "muted center small" }, "Ruft jemand „Bingo“, nennt die Person die aktuelle Aufgabennummer – die App auf ihrem Gerät prüft die Reihe."), list));
}

/* =====================================================================
   Schiffe versenken im Koordinatensystem
   ===================================================================== */
const FLEET = [4, 3, 3, 2, 2];
function boardRange(cfg) { return cfg.a === 1 ? [0, 10] : [-5, 5]; }
function makeFleet(r, lo, hi) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const taken = new Set(), ships = [];
    let ok = true;
    for (const len of FLEET) {
      let placedShip = null;
      for (let t = 0; t < 200 && !placedShip; t++) {
        const horiz = r.chance(0.5);
        const x0 = r.int(lo, horiz ? hi - len + 1 : hi), y0 = r.int(lo, horiz ? hi : hi - len + 1);
        const pts = [...Array(len)].map((_, i) => horiz ? [x0 + i, y0] : [x0, y0 + i]);
        const blocked = pts.some(([x, y]) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (taken.has((x + dx) + "|" + (y + dy))) return true; return false; });
        if (!blocked) placedShip = pts;
      }
      if (!placedShip) { ok = false; break; }
      placedShip.forEach(([x, y]) => taken.add(x + "|" + y));
      ships.push({ pts: placedShip, hits: new Set() });
    }
    if (ok) return ships;
  }
  return [];
}
function fleetShot(ships, x, y) {
  for (const sh of ships) {
    const k = sh.pts.findIndex(([px, py]) => px === x && py === y);
    if (k >= 0) {
      sh.hits.add(k);
      return { hit: true, sunk: sh.hits.size === sh.pts.length, len: sh.pts.length, allSunk: ships.every(z => z.hits.size === z.pts.length) };
    }
  }
  return { hit: false };
}
function coordBoard(lo, hi, opts) {
  const U = 30, pad = 26, n = hi - lo;
  const W = n * U + 2 * pad;
  const X = x => pad + (x - lo) * U, Y = y => pad + (hi - y) * U;
  const svg = s("svg", { viewBox: `0 0 ${W} ${W}`, class: "board", role: "img", "aria-label": "Koordinatensystem" });
  const g = s("g", { class: "b-grid" });
  for (let i = lo; i <= hi; i++) g.append(s("line", { x1: X(i), y1: Y(lo), x2: X(i), y2: Y(hi) }), s("line", { x1: X(lo), y1: Y(i), x2: X(hi), y2: Y(i) }));
  svg.append(g);
  const ax = s("g", { class: "b-axis" });
  const x0 = lo <= 0 && hi >= 0 ? 0 : lo;
  ax.append(s("line", { x1: X(lo) - 8, y1: Y(x0), x2: X(hi) + 12, y2: Y(x0) }), s("line", { x1: X(x0), y1: Y(lo) + 8, x2: X(x0), y2: Y(hi) - 12 }));
  svg.append(ax);
  const lab = s("g", { class: "b-lab" });
  for (let i = lo; i <= hi; i++) {
    if (i === 0 && lo < 0) continue;
    lab.append(s("text", { x: X(i), y: Y(x0) + 15, "text-anchor": "middle" }, num(i)));
    if (i !== 0) lab.append(s("text", { x: X(x0) - 6, y: Y(i) + 4, "text-anchor": "end" }, num(i)));
  }
  lab.append(s("text", { x: X(hi) + 14, y: Y(x0) - 6, "text-anchor": "end", class: "b-var" }, "x"));
  lab.append(s("text", { x: X(x0) + 6, y: Y(hi) - 12, class: "b-var" }, "y"));
  svg.append(lab);
  const layer = s("g");
  svg.append(layer);
  const marker = s("circle", { class: "b-sel", r: 9, cx: -50, cy: -50 });
  svg.append(marker);
  if (opts && opts.onPick) {
    svg.classList.add("pickable");
    svg.addEventListener("click", e => {
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      const x = Math.round((p.x - pad) / U) + lo, y = hi - Math.round((p.y - pad) / U);
      if (x >= lo && x <= hi && y >= lo && y <= hi) opts.onPick(x, y);
    });
  }
  return {
    svg,
    select(x, y) { marker.setAttribute("cx", X(x)); marker.setAttribute("cy", Y(y)); },
    draw(ships, shots, showShips) {
      layer.replaceChildren();
      ships.forEach(sh => {
        const sunk = sh.hits.size === sh.pts.length;
        if (!showShips && !sunk) return;
        const a = sh.pts[0], b = sh.pts[sh.pts.length - 1];
        layer.append(s("line", { class: "b-ship" + (sunk ? " sunk" : ""), x1: X(a[0]), y1: Y(a[1]), x2: X(b[0]), y2: Y(b[1]) }));
      });
      shots.forEach(({ x, y, hit }) => {
        if (hit) layer.append(s("path", { class: "b-hit", d: `M${X(x) - 8} ${Y(y) - 8}l16 16M${X(x) + 8} ${Y(y) - 8}l-16 16` }));
        else layer.append(s("circle", { class: "b-miss", cx: X(x), cy: Y(y), r: 6 }));
      });
    }
  };
}
function coordPicker(lo, hi, label, onFire, fireLabel = "Feuer!") {
  let x = lo < 0 ? 0 : lo, y = lo < 0 ? 0 : lo;
  const xv = h("output", { class: "cval" }), yv = h("output", { class: "cval" });
  const step = (axis, d) => h("button", { class: "btn step", type: "button", "aria-label": `${axis} ${d > 0 ? "erhöhen" : "verringern"}`, onclick: () => {
    if (axis === "x") x = Math.max(lo, Math.min(hi, x + d)); else y = Math.max(lo, Math.min(hi, y + d));
    paint();
  } }, d > 0 ? "+" : MINUS);
  const view = h("div", { class: "cview" });
  function paint() { xv.textContent = num(x); yv.textContent = num(y); view.textContent = `(${num(x)} | ${num(y)})`; }
  paint();
  const fire = h("button", { class: "btn primary", type: "button", onclick: () => onFire(x, y) }, fireLabel);
  return {
    el: h("div", { class: "picker" }, label ? h("div", { class: "picker-label" }, label) : null,
      h("div", { class: "prow" }, h("span", { class: "axl" }, "x"), step("x", -1), xv, step("x", 1)),
      h("div", { class: "prow" }, h("span", { class: "axl" }, "y"), step("y", -1), yv, step("y", 1)),
      view, fire),
    set(nx, ny) { x = nx; y = ny; paint(); }
  };
}
function shotText(res) {
  if (!res.hit) return { t: "Wasser", c: "miss" };
  if (res.allSunk) return { t: "Versenkt – die ganze Flotte!", c: "sunk" };
  if (res.sunk) return { t: `Versenkt! (Schiff mit ${res.len} Punkten)`, c: "sunk" };
  return { t: "Treffer!", c: "hit" };
}
function playSchiffe(ctx) {
  const mode = gameSetting(ctx.cfg, "b");
  if (mode === 0) { schiffeLeader(ctx.root, ctx.cfg, ctx.onLeave, ctx.finish); return; }
  if (mode === 2) { schiffePartner(ctx); return; }
  /* allein gegen die App: eigene Flotte je Gerät, damit niemand abschreibt */
  const [lo, hi] = boardRange(ctx.cfg);
  const ships = makeFleet(deviceRng(), lo, hi);
  const shots = [];
  const board = coordBoard(lo, hi);
  const msg = h("div", { class: "shotmsg", role: "status" }, "Stelle eine Koordinate ein und feuere.");
  const cnt = pill("Schüsse: 0"), left = pill(`Schiffe: ${ships.length}`, "good");
  const picker = coordPicker(lo, hi, null, (x, y) => {
    board.select(x, y);
    if (shots.some(p => p.x === x && p.y === y)) { msg.textContent = `Auf (${num(x)} | ${num(y)}) hast du schon geschossen.`; msg.className = "shotmsg"; return; }
    const res = fleetShot(ships, x, y);
    shots.push({ x, y, hit: res.hit });
    const st = shotText(res);
    msg.textContent = `(${num(x)} | ${num(y)}): ${st.t}`; msg.className = "shotmsg " + st.c;
    cnt.textContent = "Schüsse: " + shots.length;
    left.textContent = "Schiffe: " + ships.filter(z => z.hits.size < z.pts.length).length;
    board.draw(ships, shots, false);
    if (res.allSunk) setTimeout(() => ctx.finish({ big: shots.length, unit: "Schüsse", lines: [`Flotte: ${FLEET.join(", ")} Punkte lang`], record: { key: "schiffe", value: shots.length, lower: true } }), 1200);
  });
  board.draw(ships, shots, false);
  ctx.root.replaceChildren(h("div", { class: "game" }, hud(cnt, left),
    h("p", { class: "muted center small" }, `Versteckt: ${FLEET.length} Schiffe auf Gitterpunkten (${FLEET.join(", ")} Punkte lang), waagerecht oder senkrecht.`),
    h("div", { class: "boardwrap" }, board.svg, h("div", { class: "side" }, msg, picker.el))));
}
function schiffePartner(ctx) {
  const [lo, hi] = boardRange(ctx.cfg);
  let ships = makeFleet(deviceRng(), lo, hi);
  const incoming = [], mine = [];
  const ownBoard = coordBoard(lo, hi), oppBoard = coordBoard(lo, hi);
  const ownMsg = h("div", { class: "shotmsg", role: "status" }, "Dein Partner ruft eine Koordinate. Stelle sie ein und sag die Antwort.");
  const reroll = h("button", { class: "btn ghost small", type: "button" }, "Flotte neu verteilen");
  reroll.addEventListener("click", () => { ships = makeFleet(deviceRng(), lo, hi); ownBoard.draw(ships, incoming, true); });
  const ownPicker = coordPicker(lo, hi, "Partner ruft:", (x, y) => {
    ownBoard.select(x, y);
    if (incoming.some(p => p.x === x && p.y === y)) { ownMsg.textContent = `(${num(x)} | ${num(y)}) wurde schon gerufen.`; ownMsg.className = "shotmsg"; return; }
    const res = fleetShot(ships, x, y);
    incoming.push({ x, y, hit: res.hit });
    reroll.hidden = true;
    const st = shotText(res);
    ownMsg.textContent = `Sag: „${st.t}“`; ownMsg.className = "shotmsg big " + st.c;
    ownBoard.draw(ships, incoming, true);
    if (res.allSunk) dialog("Flotte versenkt", "Alle deine Schiffe sind getroffen – dein Partner gewinnt diese Runde.", [{ label: "OK", primary: true }]);
  }, "Eintragen");
  /* eigene Schüsse: Partner sagt Treffer oder Wasser, hier nur notieren */
  let sx = lo < 0 ? 0 : lo, sy = sx;
  const oppMsg = h("div", { class: "shotmsg", role: "status" }, "Ruf deinem Partner eine Koordinate zu und trage seine Antwort ein.");
  const oppPicker = coordPicker(lo, hi, "Ich rufe:", (x, y) => { sx = x; sy = y; oppBoard.select(x, y); oppMsg.textContent = `Ruf: „(${num(x)} | ${num(y)})“ – was antwortet dein Partner?`; }, "Auswählen");
  const note = hit => {
    const i = mine.findIndex(p => p.x === sx && p.y === sy);
    if (i >= 0) mine.splice(i, 1);
    mine.push({ x: sx, y: sy, hit });
    oppBoard.draw([], mine, false);
    oppMsg.textContent = `(${num(sx)} | ${num(sy)}): ${hit ? "Treffer" : "Wasser"} notiert. Treffer: ${mine.filter(p => p.hit).length} von ${FLEET.reduce((a, b) => a + b, 0)}`;
  };
  const noteRow = h("div", { class: "row center" },
    h("button", { class: "btn hitbtn", type: "button", onclick: () => note(true) }, "✕ Treffer"),
    h("button", { class: "btn missbtn", type: "button", onclick: () => note(false) }, "○ Wasser"));
  ownBoard.draw(ships, incoming, true);
  oppBoard.draw([], mine, false);
  const tabOwn = h("button", { class: "tab on", type: "button" }, "Meine Flotte");
  const tabOpp = h("button", { class: "tab", type: "button" }, "Meine Schüsse");
  const paneOwn = h("div", { class: "boardwrap" }, ownBoard.svg, h("div", { class: "side" }, ownMsg, ownPicker.el, reroll));
  const paneOpp = h("div", { class: "boardwrap", hidden: true }, oppBoard.svg, h("div", { class: "side" }, oppMsg, oppPicker.el, noteRow));
  tabOwn.addEventListener("click", () => { tabOwn.classList.add("on"); tabOpp.classList.remove("on"); paneOwn.hidden = false; paneOpp.hidden = true; });
  tabOpp.addEventListener("click", () => { tabOpp.classList.add("on"); tabOwn.classList.remove("on"); paneOpp.hidden = false; paneOwn.hidden = true; });
  ctx.root.replaceChildren(h("div", { class: "game" },
    h("p", { class: "muted center small" }, "Abwechselnd rufen: Koordinate ansagen, der Partner trägt sie ein und antwortet „Treffer“, „Wasser“ oder „Versenkt“."),
    h("div", { class: "tabs" }, tabOwn, tabOpp), paneOwn, paneOpp));
}
/* Klasse gegen Lehrkraft am Beamer */
function schiffeLeader(root, cfg, onLeave) {
  const [lo, hi] = boardRange(cfg);
  let ships = makeFleet(deviceRng(), lo, hi);
  const shots = [];
  let reveal = false;
  const board = coordBoard(lo, hi, { onPick: (x, y) => { picker.set(x, y); board.select(x, y); } });
  const msg = h("div", { class: "shotmsg big", role: "status" }, "Die Klasse ruft Koordinaten. Einstellen oder auf den Punkt tippen, dann feuern.");
  const cnt = pill("Schüsse: 0"), left = pill(`Schiffe: ${FLEET.length}`, "good");
  const picker = coordPicker(lo, hi, null, (x, y) => {
    board.select(x, y);
    if (shots.some(p => p.x === x && p.y === y)) { msg.textContent = `(${num(x)} | ${num(y)}) wurde schon beschossen.`; msg.className = "shotmsg big"; return; }
    const res = fleetShot(ships, x, y);
    shots.push({ x, y, hit: res.hit });
    const st = shotText(res);
    msg.textContent = `(${num(x)} | ${num(y)}): ${st.t}`; msg.className = "shotmsg big " + st.c;
    cnt.textContent = "Schüsse: " + shots.length;
    left.textContent = "Schiffe: " + ships.filter(z => z.hits.size < z.pts.length).length;
    board.draw(ships, shots, reveal);
  });
  const revealBtn = h("button", { class: "btn ghost small", type: "button" }, "Flotte aufdecken");
  revealBtn.addEventListener("click", () => { reveal = !reveal; revealBtn.textContent = reveal ? "Flotte verbergen" : "Flotte aufdecken"; board.draw(ships, shots, reveal); });
  const again = h("button", { class: "btn ghost small", type: "button" }, "Neue Runde");
  again.addEventListener("click", () => confirmDialog("Neue Flotte verstecken und von vorn beginnen?", () => {
    ships = makeFleet(deviceRng(), lo, hi); shots.length = 0; reveal = false;
    revealBtn.textContent = "Flotte aufdecken"; cnt.textContent = "Schüsse: 0"; left.textContent = `Schiffe: ${FLEET.length}`;
    msg.textContent = "Neue Flotte versteckt."; msg.className = "shotmsg big";
    board.draw(ships, shots, false);
  }));
  board.draw(ships, shots, false);
  keepAwake(true); onLeave(() => keepAwake(false));
  root.replaceChildren(h("div", { class: "game leader-wide" }, hud(cnt, left),
    h("div", { class: "boardwrap" }, board.svg, h("div", { class: "side" }, msg, picker.el, h("div", { class: "row center" }, revealBtn, again))),
    h("p", { class: "muted center small" }, `Versteckt: ${FLEET.length} Schiffe auf Gitterpunkten (${FLEET.join(", ")} Punkte lang), waagerecht oder senkrecht, ohne sich zu berühren.`)));
}

/* =====================================================================
   Stationen-Rallye mit Lösungswort
   ===================================================================== */
const WORDS = {
  5: ["PUNKT", "SUMME", "TERME", "ACHSE", "KREIS", "LINIE", "BASIS"],
  6: ["GERADE", "FAKTOR", "WURZEL", "PRISMA", "VEKTOR", "RADIUS"],
  8: ["QUADRATE", "DIVISION", "PARABELN", "VARIABLE", "DREIECKE"],
  10: ["KOORDINATE", "DIAGONALEN", "HYPOTENUSE", "PARALLELEN"]
};
function rallyeSetup(cfg) {
  const n = gameSetting(cfg);
  const r = makeRng(cfg.seed ^ 0xA11E);
  const word = r.pick(WORDS[n]);
  const items = makeItems(cfg.t, makeRng(cfg.seed), n, { graph: true, mc: true });
  const stations = items.map((it, k) => {
    const opts = r.shuffle([it.a, ...it.wrong]);
    const letters = opts.map(o => o === it.a ? word[k] : null);
    const pool = "ABDEFGHKLMNPRSTUZ".split("").filter(c => c !== word[k]);
    const rs = r.shuffle(pool);
    let p = 0;
    return { it, opts, letters: letters.map(l => l || rs[p++]) };
  });
  return { n: stations.length, word: word.slice(0, stations.length), stations };
}
function playRallye(ctx) {
  const st = rallyeSetup(ctx.cfg);
  const key = `rallye.${ctx.cfg.seed}.${ctx.cfg.t}.${ctx.cfg.a}`;
  const got = store.get(key, []);
  const station = ctx.cfg.b;
  const slots = () => h("div", { class: "slots" }, st.word.split("").map((_, k) =>
    h("span", { class: "slot" + (got[k] ? " filled" : "") + (k + 1 === station ? " here" : ""), title: "Station " + (k + 1) }, got[k] || (k + 1))));
  function overview(extra) {
    const all = got.filter(Boolean).length === st.n;
    const box = h("div", { class: "center-stage" },
      h("div", { class: "big-icon", "aria-hidden": "true" }, "🏃"),
      h("h2", null, "Stationen-Rallye"),
      h("p", { class: "topic-line" }, TOPICS[ctx.cfg.t].name),
      extra || null,
      slots(),
      h("p", { class: "muted" }, all ? "Alle Stationen geschafft! Ergibt dein Lösungswort Sinn?" : `${got.filter(Boolean).length} von ${st.n} Stationen. Scanne die nächste Stationskarte im Raum.`));
    if (all) {
      const check = h("button", { class: "btn primary", type: "button" }, "Lösungswort prüfen");
      check.addEventListener("click", () => {
        const sl = box.querySelectorAll(".slot");
        let right = 0;
        st.word.split("").forEach((c, k) => { const ok = got[k] === c; if (ok) right++; sl[k].classList.add(ok ? "ok" : "no"); });
        check.replaceWith(h("p", { class: "result-line" }, right === st.n ? `🎉 Richtig: ${st.word}` : `${right} von ${st.n} Buchstaben stimmen. Rot: dort war die Antwort falsch.`));
      });
      box.append(check);
    }
    box.append(h("button", { class: "btn primary", type: "button", onclick: () => openScanner() }, "📷 Nächste Station scannen"));
    const reset = h("button", { class: "btn ghost small", type: "button" }, "Rallye neu beginnen");
    reset.addEventListener("click", () => confirmDialog("Alle gesammelten Buchstaben dieser Rallye löschen?", () => { got.length = 0; store.set(key, []); overview(); }));
    box.append(reset);
    ctx.root.replaceChildren(box);
  }
  if (!station || station > st.n) { overview(); return; }
  const k = station - 1, s2 = st.stations[k];
  if (got[k]) { overview(h("p", { class: "notice" }, `Station ${station} hast du schon erledigt (Buchstabe ${got[k]}).`)); return; }
  const opts = h("div", { class: "options" }, s2.opts.map((o, j) => h("button", { class: "opt", type: "button", onclick: () => {
    got[k] = s2.letters[j];
    store.set(key, got);
    overview(h("p", { class: "notice ok" }, `Dein Buchstabe für Station ${station}: `, h("strong", { class: "letter" }, s2.letters[j])));
  } }, o)));
  ctx.root.replaceChildren(h("div", { class: "game" }, hud(pill(`Station ${station} von ${st.n}`)), slots(),
    h("div", { class: "prompt" + (s2.it.fn ? " is-graph" : "") }, promptFace(s2.it), s2.it.expr ? h("span", { class: "eq-tail" }, " = ?") : null),
    h("p", { class: "muted center small" }, "Wähle deine Antwort. Ob sie stimmt, verrät erst das Lösungswort."), opts));
}

/* =====================================================================
   Move & Brain – Bewegungspause am Beamer
   ===================================================================== */
const MOVES = [
  "10 Kniebeugen – oder 10-mal auf die Zehenspitzen",
  "Schultern 8-mal langsam nach hinten kreisen",
  "20 Sekunden auf der Stelle gehen",
  "Arme nach oben strecken, dann locker ausschütteln",
  "10-mal abwechselnd das rechte und linke Knie anheben",
  "Auf einem Bein stehen – 15 Sekunden, dann wechseln",
  "Drei tiefe Atemzüge: 4 ein, 4 halten, 6 aus",
  "Seitliche Schritte: zwei nach rechts, zwei nach links",
  "Mit dem rechten Ellbogen das linke Knie berühren – 8-mal je Seite",
  "Finger-Gymnastik: Daumen nacheinander an alle Fingerspitzen tippen"
];
function playMove(ctx) {
  const minutes = gameSetting(ctx.cfg);
  let mode = gameSetting(ctx.cfg, "b");
  const pool = ctx.items(60, { needNum: mode === 1 });
  if (mode === 1 && pool.length < 6) mode = 0;
  const textPool = mode === 1 ? pool : ctx.items(60, {});
  const r = makeRng(ctx.cfg.seed ^ 0x40E);
  let step = 0, phase = "ask", phaseEnd = 0, phaseLen = 0, end = 0, paused = 0, timer = null, cur = null;
  const total = minutes * 60;
  const timeEl = pill(""), nrEl = pill("");
  const rule = h("div", { class: "move-rule" });
  const big = h("div", { class: "move-big" });
  const reveal = h("div", { class: "move-reveal" });
  const bar = h("div", { class: "timebar" }, h("div"));
  const pauseBtn = h("button", { class: "btn", type: "button" }, "Pause");
  const skipBtn = h("button", { class: "btn", type: "button" }, "Weiter ›");
  const stopBtn = h("button", { class: "btn ghost", type: "button" }, "Beenden");

  function makeStep() {
    step++;
    const kind = mode === 2 ? (step % 2 ? "tf" : "move") : mode === 1 ? "cmp" : "tf";
    if (kind === "move") return { kind, rule: "⚡ Bewegung", text: MOVES[(step / 2 - 1) % MOVES.length], len: 14, show: 0 };
    if (kind === "cmp") {
      let a, b;
      for (let t = 0; t < 30; t++) { a = r.pick(pool); b = r.pick(pool); if (a !== b && a.num !== b.num) break; }
      return { kind, rule: "Linker Arm hoch: links ist mehr · Rechter Arm hoch: rechts ist mehr", a, b, len: 12, show: 5 };
    }
    const it = r.pick(textPool);
    const truth = r.chance(0.5);
    return { kind, rule: "Wahr ➜ aufstehen 🙋 · Falsch ➜ sitzen bleiben 🪑", it, truth, text: statementText(it, truth ? it.a : r.pick(it.wrong)), len: 10, show: 5 };
  }
  function showAsk() {
    cur = makeStep();
    phase = "ask"; phaseLen = cur.len; phaseEnd = Date.now() + cur.len * 1000;
    nrEl.textContent = cur.kind === "move" ? "Bewegung" : "Impuls " + Math.ceil(step / (mode === 2 ? 2 : 1));
    rule.textContent = cur.rule;
    reveal.replaceChildren(); reveal.className = "move-reveal";
    if (cur.kind === "cmp") big.replaceChildren(h("div", { class: "cmp" }, h("div", { class: "cmp-side" }, h("small", null, "links"), cur.a.q), h("div", { class: "cmp-vs" }, "oder"), h("div", { class: "cmp-side" }, h("small", null, "rechts"), cur.b.q)));
    else big.replaceChildren(h("span", null, cur.text));
  }
  function showReveal() {
    phase = "show"; phaseLen = cur.show; phaseEnd = Date.now() + cur.show * 1000;
    if (cur.kind === "tf") {
      reveal.className = "move-reveal " + (cur.truth ? "yes" : "no");
      reveal.replaceChildren(...[cur.truth ? "WAHR ✓" : "FALSCH ✗", cur.truth ? null : h("small", null, "richtig: " + statementText(cur.it, cur.it.a))].filter(Boolean));
    } else if (cur.kind === "cmp") {
      const left = cur.a.num > cur.b.num;
      reveal.className = "move-reveal yes";
      reveal.replaceChildren(`${left ? "Links" : "Rechts"} ist mehr`, h("small", null, `${cur.a.q} → ${cur.a.a}   ·   ${cur.b.q} → ${cur.b.a}`));
    }
  }
  function tick() {
    if (paused) return;
    const now = Date.now();
    const left = (end - now) / 1000;
    timeEl.textContent = "⏱ " + fmtTime(left);
    bar.firstChild.style.width = Math.max(0, (phaseEnd - now) / (phaseLen * 1000) * 100) + "%";
    if (left <= 0) { stop(); return; }
    if (now >= phaseEnd) {
      if (phase === "ask" && cur.show) showReveal(); else showAsk();
    }
  }
  function stop() {
    clearInterval(timer); timer = null;
    keepAwake(false);
    ctx.finish({ big: "👏", unit: "Geschafft!", lines: ["Kurz durchatmen – und jetzt konzentriert weiterarbeiten."] });
  }
  pauseBtn.addEventListener("click", () => {
    if (!paused) { paused = Date.now(); pauseBtn.textContent = "Fortsetzen"; }
    else { const d = Date.now() - paused; end += d; phaseEnd += d; paused = 0; pauseBtn.textContent = "Pause"; }
  });
  skipBtn.addEventListener("click", () => { if (paused) return; if (phase === "ask" && cur.show) showReveal(); else showAsk(); });
  stopBtn.addEventListener("click", stop);
  ctx.onLeave(() => { clearInterval(timer); keepAwake(false); });
  readyScreen(ctx, `${minutes} Minuten Bewegung mit Mathe. Am besten am Beamer zeigen – alle stehen auf und machen mit.`, () =>
    countdownThen(ctx.root, "Alle bereit?", () => {
      keepAwake(true);
      end = Date.now() + total * 1000;
      showAsk();
      ctx.root.replaceChildren(h("div", { class: "game leader-wide" }, hud(timeEl, nrEl), rule, bar, big, reveal, h("div", { class: "row center" }, pauseBtn, skipBtn, stopBtn)));
      tick();
      timer = setInterval(tick, 200);
    }));
}
