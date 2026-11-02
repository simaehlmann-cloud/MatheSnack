/* MatheSnack – die Spiele
   Jedes Spiel bekommt ctx:
     cfg      {g, t, a, b, seed} aus dem Spielcode
     root     Element, in das das Spiel zeichnet
     items    (n, opt) -> Aufgaben aus Thema und Samen
     finish   (ergebnis) -> Ergebnisbildschirm
     onLeave  (fn) -> Aufräumen beim Verlassen (Zeitgeber anhalten)
   Alle Texte kommen aus js/i18n.js (t("…")). */
"use strict";

/* free: Für die Klasse ohne Lehrkraft-Paket nutzbar (QR-Code, Beamer).
   Spielen per Code und „Selbst üben“ sind immer frei. */
function game(key, icon, color, spec) {
  return Object.assign({
    key, icon, color,
    get name() { return t("g." + key); },
    get desc() { return t("g." + key + ".desc"); }
  }, spec);
}
function setting(labelKey, values, fmt, def) {
  return { get label() { return t(labelKey); }, values, fmt, def };
}
const GAMES = [
  game("sprint", "⚡", "amber", { free: true, graph: true, play: playSprint,
    a: setting("set.time", [60, 90, 120, 180], v => t("unit.seconds", { n: v }), 1) }),
  game("fehler", "🔍", "rose", { free: true, graph: true, play: playFehler,
    a: setting("set.rounds", [3, 5, 8], v => t("unit.rounds", { n: v }), 1) }),
  game("memory", "🃏", "violet", { free: true, graph: true, play: playMemory,
    a: setting("set.pairs", [6, 8, 10], v => t("unit.pairs", { n: v }), 0) }),
  game("domino", "🁫", "teal", { graph: true, play: playDomino,
    a: setting("set.stones", [8, 10, 12, 15], v => t("unit.stones", { n: v }), 1) }),
  game("zuordnen", "🔗", "blue", { graph: true, play: playZuordnen,
    a: setting("set.rounds", [3, 5, 8], v => t("unit.rounds", { n: v }), 1) }),
  game("bingo", "🎯", "green", { graph: false, leader: true, play: playBingo,
    a: setting("set.card", [3, 4], v => v + " × " + v, 1) }),
  game("schiffe", "🚢", "blue", { noTopic: true, play: playSchiffe,
    a: setting("set.grid", [0, 1], v => t(["set.grid.all", "set.grid.q1"][v]), 0),
    b: setting("set.mode", [0, 1, 2], v => t(["set.mode.beamer", "set.mode.solo", "set.mode.partner"][v]), 0) }),
  game("rallye", "🏃", "orange", { graph: true, noSelf: true, play: playRallye,
    a: setting("set.stations", [5, 6, 8, 10], v => t("unit.stations", { n: v }), 1) }),
  game("move", "🤸", "green", { graph: false, beamerOnly: true, noSelf: true, play: playMove,
    a: setting("set.duration", [2, 3, 5], v => t("unit.minutes", { n: v }), 0),
    b: setting("set.motion", [0, 1, 2], v => t(["set.motion.tf", "set.motion.cmp", "set.motion.mix"][v]), 0) })
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

/* ---------- gemeinsame Bausteine ---------- */
function answerFace(text) { return h("span", { class: "face-text" }, text); }
function statementFace(it, answer) {
  if (it.fn) return h("div", { class: "stmt-graph" }, graphSVG(it.fn), h("div", { class: "stmt-eq" }, answer));
  return h("span", { class: "face-text" }, statementText(it, answer));
}
function hud(...pills) { return h("div", { class: "hud" }, pills); }
function pill(text, cls) { return h("span", { class: "pill " + (cls || "") }, text); }
function countdownThen(root, label, fn, onLeave) {
  let n = 3, timer = null;
  const big = h("div", { class: "countdown" }, "3");
  root.replaceChildren(h("div", { class: "center-stage" }, h("p", { class: "muted" }, label), big));
  const tick = () => {
    n--;
    if (n <= 0) { fn(); return; }
    big.textContent = String(n);
    big.classList.remove("pop"); void big.offsetWidth; big.classList.add("pop");
    sfx("tick");
    timer = setTimeout(tick, 650);
  };
  sfx("tick");
  timer = setTimeout(tick, 650);
  if (onLeave) onLeave(() => clearTimeout(timer));
}
function readyScreen(ctx, intro, onGo) {
  const g = GAMES[ctx.cfg.g];
  ctx.root.replaceChildren(h("div", { class: "center-stage" },
    h("div", { class: "big-icon", "aria-hidden": "true" }, g.icon),
    h("h2", null, g.name),
    g.noTopic ? null : h("p", { class: "topic-line" }, TOPICS[ctx.cfg.t].name),
    h("p", { class: "muted intro" }, intro),
    h("button", { class: "btn primary xl", type: "button", onclick: onGo }, t("go"))));
}
function promptTail(it) { return !it.fn && it.expr ? h("span", { class: "eq-tail" }, " = ?") : null; }

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
    prompt.replaceChildren(...[promptFace(it), promptTail(it)].filter(Boolean));
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
      sfx("ok");
      updateHud();
      setTimeout(next, 220);
    } else {
      wrongN++; streak = 0; vibrate(60); sfx("bad");
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
      sfx("gong");
      ctx.finish({ big: score, unit: t("res.sprint.unit", { n: score }),
        lines: [t("res.sprint.wrong", { n: wrongN }), t("res.sprint.streak", { n: best })], record: { key: "sprint", value: score } });
    }
  }
  ctx.onLeave(() => clearInterval(timer));
  readyScreen(ctx, t("g.sprint.intro", { n: dur }), () =>
    countdownThen(ctx.root, t("getReady"), () => {
      ctx.root.replaceChildren(stage);
      end = Date.now() + dur * 1000;
      updateHud(); next(); tick();
      timer = setInterval(tick, 200);
    }, ctx.onLeave));
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
    const btn = h("button", { class: "btn primary", type: "button" }, t("fehler.check"));
    const info = h("p", { class: "muted center" }, t("fehler.howto"));
    const scorePill = pill(`✓ ${points}`, "good");
    btn.addEventListener("click", () => {
      if (!checked) {
        checked = true;
        let roundOk = 0;
        cards.forEach((c, k) => {
          const m = marked.has(k);
          total++;
          if (m === c.isWrong) { points++; roundOk++; }
          c.card.classList.add(c.isWrong ? (m ? "found" : "missed") : (m ? "falsealarm" : "ok"));
          if (c.isWrong) c.card.append(h("span", { class: "stmt-fix" }, t("fehler.correct", { a: c.it.a })));
        });
        sfx(roundOk === 6 ? "ok" : "bad");
        scorePill.textContent = `✓ ${points}`;
        btn.textContent = round + 1 < rounds ? t("nextRound") : t("showResult");
        info.textContent = t("fehler.legend");
      } else {
        round++;
        if (round < rounds) playRound();
        else ctx.finish({ big: points + " / " + total, unit: t("res.fehler.unit"), lines: [t("unit.rounds", { n: rounds })], record: { key: "fehler", value: Math.round(points / total * 100), pct: true } });
      }
    });
    ctx.root.replaceChildren(h("div", { class: "game" },
      hud(pill(t("roundOf", { n: round + 1, m: rounds })), scorePill),
      info, h("div", { class: "stmts" }, cards.map(c => c.card)), h("div", { class: "center" }, btn)));
  }
  readyScreen(ctx, t("g.fehler.intro"), playRound);
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
  const movesEl = pill(t("memory.moves", { n: 0 })), foundEl = pill(t("memory.pairs", { n: 0, m: items.length }), "good");
  const grid = h("div", { class: "memory cols-" + (cards.length > 16 ? 5 : 4) });
  cards.forEach(c => {
    const face = c.side === "q" ? promptFace(c.it) : answerFace(c.it.a);
    const el = h("button", { class: "mcard side-" + c.side, type: "button", "aria-label": t("memory.hidden") },
      h("span", { class: "mback", "aria-hidden": "true" }, "?"), h("span", { class: "mface" }, face));
    el.addEventListener("click", () => flip(c, el));
    c.el = el;
    grid.append(el);
  });
  function flip(c, el) {
    if (lock || el.classList.contains("up") || el.classList.contains("done")) return;
    if (!t0) t0 = Date.now();
    el.classList.add("up");
    el.setAttribute("aria-label", c.side === "q" ? t("memory.task") : t("memory.result"));
    open.push(c);
    if (open.length < 2) return;
    moves++;
    movesEl.textContent = t("memory.moves", { n: moves });
    const [x, y] = open;
    open = [];
    if (x.k === y.k && x.side !== y.side) {
      found++;
      sfx("ok");
      foundEl.textContent = t("memory.pairs", { n: found, m: items.length });
      setTimeout(() => { x.el.classList.add("done"); y.el.classList.add("done"); }, 300);
      if (found === items.length) setTimeout(() => ctx.finish({ big: moves, unit: t("res.memory.unit", { n: moves }), lines: [t("res.memory.time", { n: items.length, t: fmtTime((Date.now() - t0) / 1000) }), t("res.memory.best", { n: items.length })] }), 900);
    } else {
      lock = true;
      setTimeout(() => {
        [x, y].forEach(c2 => { c2.el.classList.remove("up"); c2.el.setAttribute("aria-label", t("memory.hidden")); });
        lock = false;
      }, 1300);
    }
  }
  ctx.root.replaceChildren(h("div", { class: "game" }, hud(movesEl, foundEl),
    h("p", { class: "muted center small" }, t("memory.legend")), grid));
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
    h("div", { class: "half left" }, st.left ? answerFace(st.left.a) : h("span", { class: "flag" }, t("domino.start"))),
    h("div", { class: "half right" }, st.right ? promptFace(st.right) : h("span", { class: "flag" }, t("domino.goal") + " 🏁")));
  const r = deviceRng();
  let placed = 1, errors = 0;
  const t0 = Date.now();
  const chain = h("div", { class: "chain" });
  const pool = h("div", { class: "pool" });
  const errEl = pill(t("domino.errors", { n: 0 })), progEl = pill("");
  const info = h("p", { class: "muted center small" }, t("domino.howto"));
  function render() {
    chain.replaceChildren(...stones.slice(Math.max(0, placed - 2), placed).map((st, k, arr) => {
      const el = stoneEl(st, k < arr.length - 1);
      if (k === arr.length - 1) el.classList.add("current");
      return el;
    }));
    progEl.textContent = t("domino.progress", { n: placed - 1, m: N });
  }
  const order = r.shuffle(stones.slice(1));
  order.forEach(st => {
    const el = h("button", { class: "stone-btn", type: "button" }, stoneEl(st, true));
    el.addEventListener("click", () => {
      if (st.i === placed) {
        el.remove();
        placed++;
        sfx("ok");
        render();
        if (placed > N) ctx.finish({ big: errors, unit: t("res.domino.unit", { n: errors }), lines: [t("res.domino.time", { n: N, t: fmtTime((Date.now() - t0) / 1000) })] });
      } else {
        errors++; vibrate(60); sfx("bad");
        errEl.textContent = t("domino.errors", { n: errors });
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
    const errPill = pill(t("zuordnen.errors", { n: errors }));
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
        if (el.disabled) return;
        if (sel === null) { toast(t("zuordnen.pickLeft")); return; }
        if (sel === k) {
          const c = COLORS[done];
          lefts[k].classList.remove("sel");
          lefts[k].classList.add("matched", c); el.classList.add("matched", c);
          lefts[k].disabled = true; el.disabled = true;
          sel = null; done++;
          sfx("ok");
          if (done === 4) setTimeout(() => {
            round++;
            if (round < rounds) playRound();
            else ctx.finish({ big: errors, unit: t("res.zuordnen.unit", { n: errors }), lines: [t("res.zuordnen.time", { n: rounds * 4, t: fmtTime((Date.now() - t0) / 1000) })] });
          }, 700);
        } else {
          errors++; vibrate(60); sfx("bad");
          errPill.textContent = t("zuordnen.errors", { n: errors });
          el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
        }
      });
      right.append(el);
    });
    left.append(...lefts);
    ctx.root.replaceChildren(h("div", { class: "game" },
      hud(pill(t("roundOf", { n: round + 1, m: rounds })), errPill),
      h("p", { class: "muted center small" }, t("zuordnen.howto")),
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
    ctx.root.replaceChildren(h("div", { class: "center-stage" }, h("p", null, t("bingo.tooFew"))));
    return;
  }
  /* eigene Karte: Gerätezufall, gemerkt für diese Sitzung (versehentliches Neuladen).
     Gespeichert werden Positionen im Aufgabenpool, nicht Texte – so passt die
     Karte auch nach einem Sprachwechsel. */
  const key = "bingo." + encodeCode(ctx.cfg);
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(key) || "null"); } catch (e) { saved = null; }
  const validSaved = saved && Array.isArray(saved.card) && saved.card.length === cells && saved.card.every(i => Number.isInteger(i) && i >= 0 && i < pool.length);
  let card = validSaved ? saved.card : deviceRng().shuffle(pool.map((_, k) => k)).slice(0, cells);
  let marks = new Set(validSaved && Array.isArray(saved.marks) ? saved.marks.filter(i => Number.isInteger(i) && i >= 0 && i < cells) : []);
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
  const soloNext = h("button", { class: "btn", type: "button" }, t("bingo.next"));
  soloNext.addEventListener("click", () => {
    if (soloCount >= calls.length) { toast(t("bingo.allDrawn")); return; }
    soloCount++; showSolo();
  });
  soloBox.append(soloNr, soloPrompt, soloNext);
  function showSolo() {
    const it = calls[soloCount - 1];
    soloNr.textContent = t("bingo.callOf", { n: soloCount, m: calls.length });
    soloPrompt.replaceChildren(h("span", { class: "face-text" }, it.q + (it.expr ? " = ?" : "")));
  }
  const soloBtn = h("button", { class: "btn ghost small", type: "button" }, t("bingo.solo"));
  soloBtn.addEventListener("click", () => {
    solo = !solo;
    soloBox.hidden = !solo;
    soloBtn.textContent = solo ? t("bingo.withBeamer") : t("bingo.solo");
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
      sfx("gong");
      dialog(t("bingo.win.title"), t("bingo.win.text"), [{ label: t("great"), primary: true }]);
    } else if (bad.length) {
      sfx("bad");
      dialog(t("bingo.no.title"), t("bingo.no.bad", { n: bad.length, k }), [{ label: t("ok"), primary: true }]);
    } else {
      dialog(t("bingo.no.title"), t("bingo.no.line"), [{ label: t("continue"), primary: true }]);
    }
  }
  const bingoBtn = h("button", { class: "btn primary xl", type: "button" }, t("bingo.button"));
  bingoBtn.addEventListener("click", () => {
    if (solo) { check(soloCount); return; }
    const inp = h("input", { type: "number", inputmode: "numeric", min: 1, max: calls.length, class: "numinput", "aria-label": t("bingo.ask.aria") });
    dialog(t("bingo.ask.title"), h("div", null, h("p", null, t("bingo.ask.text")), inp), [
      { label: t("cancel") },
      { label: t("bingo.ask.check"), primary: true, action: () => {
        const k = Math.round(Number(inp.value));
        if (!(k >= 1 && k <= calls.length)) { toast(t("bingo.ask.range", { m: calls.length })); return false; }
        setTimeout(() => check(k), 50);
      } }
    ]);
    setTimeout(() => inp.focus(), 100);
  });
  const newCard = h("button", { class: "btn ghost small", type: "button" }, t("bingo.newCard"));
  newCard.addEventListener("click", () => {
    confirmDialog(t("bingo.newCard.confirm"), () => {
      card = deviceRng().shuffle(pool.map((_, k) => k)).slice(0, cells);
      marks = new Set();
      cellEls.forEach((el, ci) => { el.textContent = pool[card[ci]].a; });
      paint(); persist();
    });
  });
  ctx.root.replaceChildren(h("div", { class: "game" },
    h("p", { class: "muted center small" }, t("bingo.howto")),
    soloBox, grid, h("div", { class: "center" }, bingoBtn), h("div", { class: "row center" }, soloBtn, newCard)));
}

/* Spielleitung am Beamer: zieht die Aufgaben in fester Reihenfolge (Samen) */
function bingoLeader(root, cfg, onLeave) {
  const { calls } = bingoSetup(cfg);
  let k = 0, autoTimer = null, showAll = false;
  const nr = h("div", { class: "lead-nr" });
  const big = h("div", { class: "lead-prompt" });
  const list = h("ol", { class: "lead-list", hidden: true });
  const prev = h("button", { class: "btn", type: "button" }, t("back"));
  const next = h("button", { class: "btn primary xl", type: "button" }, t("bingo.next"));
  const autoSel = h("select", { class: "select", "aria-label": t("bingo.auto.aria") },
    [0, 15, 20, 30, 45].map(v => h("option", { value: v }, v ? t("bingo.auto.every", { n: v }) : t("bingo.auto.manual"))));
  const solBtn = h("button", { class: "btn ghost", type: "button" }, t("bingo.solutions.show"));
  function render() {
    if (k === 0) { nr.textContent = t("g.bingo"); big.textContent = t("bingo.lead.ready"); }
    else { const it = calls[k - 1]; nr.textContent = t("bingo.callOf", { n: k, m: calls.length }); big.textContent = it.q + (it.expr ? " = ?" : ""); }
    prev.disabled = k <= 1; next.disabled = k >= calls.length;
    list.replaceChildren(...calls.slice(0, k).map(it => h("li", null, statementText(it, it.a))));
  }
  const step = () => { if (k < calls.length) { k++; sfx("tick"); render(); } };
  prev.addEventListener("click", () => { if (k > 1) { k--; render(); } });
  next.addEventListener("click", step);
  autoSel.addEventListener("change", () => {
    clearInterval(autoTimer);
    const auto = Number(autoSel.value);
    if (auto) autoTimer = setInterval(() => { if (k < calls.length) step(); else clearInterval(autoTimer); }, auto * 1000);
  });
  solBtn.addEventListener("click", () => { showAll = !showAll; list.hidden = !showAll; solBtn.textContent = showAll ? t("bingo.solutions.hide") : t("bingo.solutions.show"); });
  onLeave(() => clearInterval(autoTimer));
  keepAwake(true); onLeave(() => keepAwake(false));
  render();
  root.replaceChildren(h("div", { class: "leader" }, nr, big,
    h("div", { class: "row center" }, prev, next), h("div", { class: "row center" }, autoSel, solBtn),
    h("p", { class: "muted center small" }, t("bingo.lead.hint")), list));
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
      for (let tr = 0; tr < 200 && !placedShip; tr++) {
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
function P(x, y) { return NOTE.pt(num(x), num(y)); }
function fleetLeft(ships) { return ships.filter(z => z.hits.size < z.pts.length).length; }
function coordBoard(lo, hi, opts) {
  const U = 30, pad = 26, n = hi - lo;
  const W = n * U + 2 * pad;
  const X = x => pad + (x - lo) * U, Y = y => pad + (hi - y) * U;
  const svg = s("svg", { viewBox: `0 0 ${W} ${W}`, class: "board", role: "img", "aria-label": t("a11y.board") });
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
function coordPicker(lo, hi, label, onFire, fireLabel) {
  let x = lo < 0 ? 0 : lo, y = lo < 0 ? 0 : lo;
  const xv = h("output", { class: "cval" }), yv = h("output", { class: "cval" });
  const step = (axis, d) => h("button", { class: "btn step", type: "button", "aria-label": t(d > 0 ? "a11y.inc" : "a11y.dec", { axis }), onclick: () => {
    if (axis === "x") x = Math.max(lo, Math.min(hi, x + d)); else y = Math.max(lo, Math.min(hi, y + d));
    paint();
  } }, d > 0 ? "+" : MINUS);
  const view = h("div", { class: "cview" });
  function paint() { xv.textContent = num(x); yv.textContent = num(y); view.textContent = P(x, y); }
  paint();
  const fire = h("button", { class: "btn primary", type: "button", onclick: () => onFire(x, y) }, fireLabel || t("ships.fire"));
  return {
    el: h("div", { class: "picker" }, label ? h("div", { class: "picker-label" }, label) : null,
      h("div", { class: "prow" }, h("span", { class: "axl" }, "x"), step("x", -1), xv, step("x", 1)),
      h("div", { class: "prow" }, h("span", { class: "axl" }, "y"), step("y", -1), yv, step("y", 1)),
      view, fire),
    set(nx, ny) { x = nx; y = ny; paint(); }
  };
}
function shotText(res) {
  if (!res.hit) return { t: t("ships.miss"), c: "miss" };
  if (res.allSunk) return { t: t("ships.allSunk"), c: "sunk" };
  if (res.sunk) return { t: t("ships.sunk", { n: res.len }), c: "sunk" };
  return { t: t("ships.hit"), c: "hit" };
}
function fleetHint() { return t("ships.fleet", { list: FLEET.join(", "), n: FLEET.length }); }
function playSchiffe(ctx) {
  const mode = gameSetting(ctx.cfg, "b");
  if (mode === 0) { schiffeLeader(ctx.root, ctx.cfg, ctx.onLeave); return; }
  if (mode === 2) { schiffePartner(ctx); return; }
  /* allein gegen die App: eigene Flotte je Gerät, damit niemand abschreibt */
  const [lo, hi] = boardRange(ctx.cfg);
  const ships = makeFleet(deviceRng(), lo, hi);
  const shots = [];
  const board = coordBoard(lo, hi);
  const msg = h("div", { class: "shotmsg", role: "status" }, t("ships.solo.start"));
  const cnt = pill(t("ships.shots", { n: 0 })), left = pill(t("ships.left", { n: ships.length }), "good");
  const picker = coordPicker(lo, hi, null, (x, y) => {
    board.select(x, y);
    if (shots.some(p => p.x === x && p.y === y)) { msg.textContent = t("ships.already", { p: P(x, y) }); msg.className = "shotmsg"; return; }
    const res = fleetShot(ships, x, y);
    shots.push({ x, y, hit: res.hit });
    const st = shotText(res);
    sfx(res.hit ? "ok" : "tick");
    msg.textContent = `${P(x, y)}: ${st.t}`; msg.className = "shotmsg " + st.c;
    cnt.textContent = t("ships.shots", { n: shots.length });
    left.textContent = t("ships.left", { n: fleetLeft(ships) });
    board.draw(ships, shots, false);
    if (res.allSunk) setTimeout(() => ctx.finish({ big: shots.length, unit: t("res.ships.unit", { n: shots.length }), lines: [t("res.ships.fleet", { list: FLEET.join(", ") })], record: { key: "schiffe", value: shots.length, lower: true } }), 1200);
  });
  board.draw(ships, shots, false);
  ctx.root.replaceChildren(h("div", { class: "game" }, hud(cnt, left),
    h("p", { class: "muted center small" }, fleetHint()),
    h("div", { class: "boardwrap" }, board.svg, h("div", { class: "side" }, msg, picker.el))));
}
function schiffePartner(ctx) {
  const [lo, hi] = boardRange(ctx.cfg);
  let ships = makeFleet(deviceRng(), lo, hi);
  const incoming = [], mine = [];
  const ownBoard = coordBoard(lo, hi), oppBoard = coordBoard(lo, hi);
  const ownMsg = h("div", { class: "shotmsg", role: "status" }, t("ships.p.ownStart"));
  const reroll = h("button", { class: "btn ghost small", type: "button" }, t("ships.p.reroll"));
  reroll.addEventListener("click", () => { ships = makeFleet(deviceRng(), lo, hi); ownBoard.draw(ships, incoming, true); });
  const ownPicker = coordPicker(lo, hi, t("ships.p.calls"), (x, y) => {
    ownBoard.select(x, y);
    if (incoming.some(p => p.x === x && p.y === y)) { ownMsg.textContent = t("ships.p.calledBefore", { p: P(x, y) }); ownMsg.className = "shotmsg"; return; }
    const res = fleetShot(ships, x, y);
    incoming.push({ x, y, hit: res.hit });
    reroll.hidden = true;
    const st = shotText(res);
    ownMsg.textContent = t("ships.p.say", { s: st.t }); ownMsg.className = "shotmsg big " + st.c;
    ownBoard.draw(ships, incoming, true);
    if (res.allSunk) dialog(t("ships.p.lost.title"), t("ships.p.lost.text"), [{ label: t("ok"), primary: true }]);
  }, t("ships.p.enter"));
  /* eigene Schüsse: Partner sagt Treffer oder Wasser, hier nur notieren */
  let sx = lo < 0 ? 0 : lo, sy = sx;
  const total = FLEET.reduce((a, b) => a + b, 0);
  const oppMsg = h("div", { class: "shotmsg", role: "status" }, t("ships.p.oppStart"));
  const oppPicker = coordPicker(lo, hi, t("ships.p.iCall"), (x, y) => { sx = x; sy = y; oppBoard.select(x, y); oppMsg.textContent = t("ships.p.callNow", { p: P(x, y) }); }, t("ships.p.choose"));
  const note = hit => {
    const i = mine.findIndex(p => p.x === sx && p.y === sy);
    if (i >= 0) mine.splice(i, 1);
    mine.push({ x: sx, y: sy, hit });
    oppBoard.draw([], mine, false);
    oppMsg.textContent = t("ships.p.noted", { p: P(sx, sy), s: hit ? t("ships.hitShort") : t("ships.miss"), n: mine.filter(p => p.hit).length, m: total });
  };
  const noteRow = h("div", { class: "row center" },
    h("button", { class: "btn hitbtn", type: "button", onclick: () => note(true) }, "✕ " + t("ships.hitShort")),
    h("button", { class: "btn missbtn", type: "button", onclick: () => note(false) }, "○ " + t("ships.miss")));
  ownBoard.draw(ships, incoming, true);
  oppBoard.draw([], mine, false);
  const tabOwn = h("button", { class: "tab on", type: "button" }, t("ships.p.tabOwn"));
  const tabOpp = h("button", { class: "tab", type: "button" }, t("ships.p.tabOpp"));
  const paneOwn = h("div", { class: "boardwrap" }, ownBoard.svg, h("div", { class: "side" }, ownMsg, ownPicker.el, reroll));
  const paneOpp = h("div", { class: "boardwrap", hidden: true }, oppBoard.svg, h("div", { class: "side" }, oppMsg, oppPicker.el, noteRow));
  tabOwn.addEventListener("click", () => { tabOwn.classList.add("on"); tabOpp.classList.remove("on"); paneOwn.hidden = false; paneOpp.hidden = true; });
  tabOpp.addEventListener("click", () => { tabOpp.classList.add("on"); tabOwn.classList.remove("on"); paneOpp.hidden = false; paneOwn.hidden = true; });
  ctx.root.replaceChildren(h("div", { class: "game" },
    h("p", { class: "muted center small" }, t("ships.p.howto")),
    h("div", { class: "tabs" }, tabOwn, tabOpp), paneOwn, paneOpp));
}
/* Klasse gegen Lehrkraft am Beamer */
function schiffeLeader(root, cfg, onLeave) {
  const [lo, hi] = boardRange(cfg);
  let ships = makeFleet(deviceRng(), lo, hi);
  const shots = [];
  let reveal = false;
  const board = coordBoard(lo, hi, { onPick: (x, y) => { picker.set(x, y); board.select(x, y); } });
  const msg = h("div", { class: "shotmsg big", role: "status" }, t("ships.lead.start"));
  const cnt = pill(t("ships.shots", { n: 0 })), left = pill(t("ships.left", { n: FLEET.length }), "good");
  const picker = coordPicker(lo, hi, null, (x, y) => {
    board.select(x, y);
    if (shots.some(p => p.x === x && p.y === y)) { msg.textContent = t("ships.lead.already", { p: P(x, y) }); msg.className = "shotmsg big"; return; }
    const res = fleetShot(ships, x, y);
    shots.push({ x, y, hit: res.hit });
    const st = shotText(res);
    sfx(res.allSunk ? "gong" : res.hit ? "ok" : "tick");
    msg.textContent = `${P(x, y)}: ${st.t}`; msg.className = "shotmsg big " + st.c;
    cnt.textContent = t("ships.shots", { n: shots.length });
    left.textContent = t("ships.left", { n: fleetLeft(ships) });
    board.draw(ships, shots, reveal);
  });
  const revealBtn = h("button", { class: "btn ghost small", type: "button" }, t("ships.lead.reveal"));
  revealBtn.addEventListener("click", () => { reveal = !reveal; revealBtn.textContent = reveal ? t("ships.lead.hide") : t("ships.lead.reveal"); board.draw(ships, shots, reveal); });
  const again = h("button", { class: "btn ghost small", type: "button" }, t("ships.lead.again"));
  again.addEventListener("click", () => confirmDialog(t("ships.lead.again.confirm"), () => {
    ships = makeFleet(deviceRng(), lo, hi); shots.length = 0; reveal = false;
    revealBtn.textContent = t("ships.lead.reveal"); cnt.textContent = t("ships.shots", { n: 0 }); left.textContent = t("ships.left", { n: FLEET.length });
    msg.textContent = t("ships.lead.hidden"); msg.className = "shotmsg big";
    board.draw(ships, shots, false);
  }));
  board.draw(ships, shots, false);
  keepAwake(true); onLeave(() => keepAwake(false));
  root.replaceChildren(h("div", { class: "game leader-wide" }, hud(cnt, left),
    h("div", { class: "boardwrap" }, board.svg, h("div", { class: "side" }, msg, picker.el, h("div", { class: "row center" }, revealBtn, again))),
    h("p", { class: "muted center small" }, fleetHint() + " " + t("ships.noTouch"))));
}

/* =====================================================================
   Stationen-Rallye mit Lösungswort
   Die Wörter sind auf Deutsch und Englisch gleich, damit Lehrkraft und
   Klasse dasselbe Lösungswort sehen, egal welche Sprache ein Gerät nutzt.
   ===================================================================== */
const WORDS = {
  5: ["DELTA", "SIGMA", "GAMMA", "OMEGA", "MINUS", "THETA"],
  6: ["RADIUS", "LAMBDA", "MATRIX"],
  8: ["QUADRANT", "INTEGRAL", "VARIABLE", "DIVIDEND", "ADDITION"],
  10: ["HYPOTENUSE", "SUBTRAHEND"]
};
function rallyeSetup(cfg) {
  const n = gameSetting(cfg);
  const r = makeRng(cfg.seed ^ 0xA11E);
  const word = r.pick(WORDS[n]);
  const items = makeItems(cfg.t, makeRng(cfg.seed), n, { graph: true, mc: true });
  const stations = items.map((it, k) => {
    const opts = r.shuffle([it.a, ...it.wrong]);
    const pool = "ABDEFGHKLMNPRSTUZ".split("").filter(c => c !== word[k]);
    const rs = r.shuffle(pool);
    let p = 0;
    return { it, opts, letters: opts.map(o => o === it.a ? word[k] : rs[p++]) };
  });
  return { n: stations.length, word: word.slice(0, stations.length), stations };
}
function playRallye(ctx) {
  const st = rallyeSetup(ctx.cfg);
  const key = `rallye.${ctx.cfg.seed}.${ctx.cfg.t}.${ctx.cfg.a}`;
  const got = store.get(key, []);
  const station = ctx.cfg.b;
  const filled = () => got.filter(Boolean).length;
  const slots = () => h("div", { class: "slots" }, st.word.split("").map((_, k) =>
    h("span", { class: "slot" + (got[k] ? " filled" : "") + (k + 1 === station ? " here" : ""), title: t("rallye.station", { n: k + 1 }) }, got[k] || (k + 1))));
  function overview(extra) {
    const all = filled() === st.n;
    const box = h("div", { class: "center-stage" },
      h("div", { class: "big-icon", "aria-hidden": "true" }, "🏃"),
      h("h2", null, t("g.rallye")),
      h("p", { class: "topic-line" }, TOPICS[ctx.cfg.t].name),
      extra || null,
      slots(),
      h("p", { class: "muted" }, all ? t("rallye.allDone") : t("rallye.progress", { n: filled(), m: st.n })));
    if (all) {
      const check = h("button", { class: "btn primary", type: "button" }, t("rallye.check"));
      check.addEventListener("click", () => {
        const sl = box.querySelectorAll(".slot");
        let right = 0;
        st.word.split("").forEach((c, k) => { const ok = got[k] === c; if (ok) right++; sl[k].classList.add(ok ? "ok" : "no"); });
        sfx(right === st.n ? "gong" : "bad");
        check.replaceWith(h("p", { class: "result-line" }, right === st.n ? t("rallye.right", { w: st.word }) : t("rallye.partly", { n: right, m: st.n })));
      });
      box.append(check);
    }
    box.append(h("button", { class: "btn primary", type: "button", onclick: () => openScanner() }, t("rallye.scanNext")));
    const reset = h("button", { class: "btn ghost small", type: "button" }, t("rallye.reset"));
    reset.addEventListener("click", () => confirmDialog(t("rallye.reset.confirm"), () => { got.length = 0; store.set(key, []); overview(); }));
    box.append(reset);
    ctx.root.replaceChildren(box);
  }
  if (!station || station > st.n) { overview(); return; }
  const k = station - 1, s2 = st.stations[k];
  if (got[k]) { overview(h("p", { class: "notice" }, t("rallye.done", { n: station, l: got[k] }))); return; }
  const opts = h("div", { class: "options" }, s2.opts.map((o, j) => h("button", { class: "opt", type: "button", onclick: () => {
    got[k] = s2.letters[j];
    store.set(key, got);
    sfx("ok");
    overview(h("p", { class: "notice ok" }, t("rallye.yourLetter", { n: station }) + " ", h("strong", { class: "letter" }, s2.letters[j])));
  } }, o)));
  ctx.root.replaceChildren(h("div", { class: "game" }, hud(pill(t("rallye.stationOf", { n: station, m: st.n }))), slots(),
    h("div", { class: "prompt" + (s2.it.fn ? " is-graph" : "") }, ...[promptFace(s2.it), promptTail(s2.it)].filter(Boolean)),
    h("p", { class: "muted center small" }, t("rallye.howto")), opts));
}

/* =====================================================================
   Move & Brain – Bewegungspause am Beamer
   ===================================================================== */
function playMove(ctx) {
  const minutes = gameSetting(ctx.cfg);
  let mode = gameSetting(ctx.cfg, "b");
  const pool = ctx.items(60, { needNum: mode === 1 });
  if (mode === 1 && pool.length < 6) mode = 0;
  const textPool = mode === 1 ? pool : ctx.items(60, {});
  const moves = t("move.list");
  const r = makeRng(ctx.cfg.seed ^ 0x40E);
  let step = 0, phase = "ask", phaseEnd = 0, phaseLen = 0, end = 0, paused = 0, timer = null, cur = null;
  const total = minutes * 60;
  const timeEl = pill(""), nrEl = pill("");
  const rule = h("div", { class: "move-rule" });
  const big = h("div", { class: "move-big" });
  const reveal = h("div", { class: "move-reveal" });
  const bar = h("div", { class: "timebar" }, h("div"));
  const pauseBtn = h("button", { class: "btn", type: "button" }, t("pause"));
  const skipBtn = h("button", { class: "btn", type: "button" }, t("move.skip"));
  const stopBtn = h("button", { class: "btn ghost", type: "button" }, t("move.stop"));

  function makeStep() {
    step++;
    const kind = mode === 2 ? (step % 2 ? "tf" : "move") : mode === 1 ? "cmp" : "tf";
    if (kind === "move") return { kind, rule: "⚡ " + t("move.motion"), text: moves[(step / 2 - 1) % moves.length], len: 14, show: 0 };
    if (kind === "cmp") {
      let a, b;
      for (let tr = 0; tr < 30; tr++) { a = r.pick(pool); b = r.pick(pool); if (a !== b && a.num !== b.num) break; }
      return { kind, rule: t("move.rule.cmp"), a, b, len: 12, show: 5 };
    }
    const it = r.pick(textPool);
    const truth = r.chance(0.5);
    return { kind, rule: t("move.rule.tf"), it, truth, text: statementText(it, truth ? it.a : r.pick(it.wrong)), len: 10, show: 5 };
  }
  function showAsk() {
    cur = makeStep();
    phase = "ask"; phaseLen = cur.len; phaseEnd = Date.now() + cur.len * 1000;
    nrEl.textContent = cur.kind === "move" ? t("move.motion") : t("move.impulse", { n: Math.ceil(step / (mode === 2 ? 2 : 1)) });
    rule.textContent = cur.rule;
    reveal.replaceChildren(); reveal.className = "move-reveal";
    if (cur.kind === "cmp") big.replaceChildren(h("div", { class: "cmp" }, h("div", { class: "cmp-side" }, h("small", null, t("move.left")), cur.a.q), h("div", { class: "cmp-vs" }, t("move.or")), h("div", { class: "cmp-side" }, h("small", null, t("move.right")), cur.b.q)));
    else big.replaceChildren(h("span", null, cur.text));
  }
  function showReveal() {
    phase = "show"; phaseLen = cur.show; phaseEnd = Date.now() + cur.show * 1000;
    sfx("tick");
    if (cur.kind === "tf") {
      reveal.className = "move-reveal " + (cur.truth ? "yes" : "no");
      reveal.replaceChildren(...[cur.truth ? t("move.true") : t("move.false"), cur.truth ? null : h("small", null, t("move.correct", { s: statementText(cur.it, cur.it.a) }))].filter(Boolean));
    } else if (cur.kind === "cmp") {
      const leftMore = cur.a.num > cur.b.num;
      reveal.className = "move-reveal yes";
      reveal.replaceChildren(leftMore ? t("move.leftMore") : t("move.rightMore"), h("small", null, `${cur.a.q} → ${cur.a.a}   ·   ${cur.b.q} → ${cur.b.a}`));
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
    sfx("gong");
    ctx.finish({ big: "👏", unit: t("move.done"), lines: [t("move.done.text")] });
  }
  pauseBtn.addEventListener("click", () => {
    if (!paused) { paused = Date.now(); pauseBtn.textContent = t("resume"); }
    else { const d = Date.now() - paused; end += d; phaseEnd += d; paused = 0; pauseBtn.textContent = t("pause"); }
  });
  skipBtn.addEventListener("click", () => { if (paused) return; if (phase === "ask" && cur.show) showReveal(); else showAsk(); });
  stopBtn.addEventListener("click", stop);
  ctx.onLeave(() => { clearInterval(timer); keepAwake(false); });
  readyScreen(ctx, t("g.move.intro", { n: minutes }), () =>
    countdownThen(ctx.root, t("move.ready"), () => {
      keepAwake(true);
      end = Date.now() + total * 1000;
      showAsk();
      ctx.root.replaceChildren(h("div", { class: "game leader-wide" }, hud(timeEl, nrEl), rule, bar, big, reveal, h("div", { class: "row center" }, pauseBtn, skipBtn, stopBtn)));
      tick();
      timer = setInterval(tick, 200);
    }, ctx.onLeave));
}
