/* MatheSnack – Lehrkraft: Spiel einstellen, QR-Code präsentieren,
   Spielleitung am Beamer, Stationskarten drucken */
"use strict";

/* Schritt 1: Spiel wählen. mode "teach" (für die Klasse) oder "self" (selbst üben) */
function screenChooseGame(mode) {
  go(root => {
    const list = GAMES.map((g, i) => ({ g, i })).filter(({ g }) => mode === "teach" || !g.noSelf);
    root.append(
      h("p", { class: "lead" }, mode === "teach" ? t("choose.teach") : t("choose.self")),
      mode === "teach" && !isPro() ? h("button", { class: "pro-banner", type: "button", onclick: () => screenPaywall() },
        h("span", { "aria-hidden": "true" }, "🎓 "), t("choose.banner")) : null,
      h("div", { class: "gamegrid" }, list.map(({ g, i }) => {
        const locked = mode === "teach" && !g.free && !isPro();
        return h("button", { class: "gametile c-" + g.color, type: "button", onclick: () => screenConfig(i, mode) },
          h("span", { class: "gicon", "aria-hidden": "true" }, g.icon),
          h("span", { class: "gtext" },
            h("strong", null, g.name),
            h("span", null, g.desc),
            locked ? h("span", { class: "badge" }, trialsLeft(g.key) ? t("badge.trials", { n: trialsLeft(g.key) }) : t("badge.pro")) : null));
      })));
  }, { title: mode === "teach" ? t("home.teach") : t("home.self") });
}

/* Schritt 2: Thema und Einstellungen */
function screenConfig(gi, mode) {
  const g = GAMES[gi];
  const last = store.get("last." + g.key, {});
  const cfg = {
    g: gi,
    t: TOPICS[last.t] ? last.t : 0,
    a: last.a != null && last.a < g.a.values.length ? last.a : g.a.def,
    b: g.b && last.b != null && last.b < g.b.values.length ? last.b : (g.b ? g.b.def : 0),
    seed: newSeed()
  };
  /* Beim Selbst-Üben gibt es Schiffe versenken nur allein oder zu zweit */
  if (mode === "self" && g.key === "schiffe" && cfg.b === 0) cfg.b = 1;
  go(root => {
    const fields = [];
    if (!g.noTopic) {
      const sel = h("select", { id: "fTopic", class: "select" },
        h("optgroup", { label: t("cfg.generators") },
          TOPICS.map((tp, i) => tp.bank ? null : h("option", { value: i, selected: i === cfg.t }, `${tp.name} · ${tp.grade}${tp.graph && g.graph ? " · " + t("cfg.withGraphs") : ""}`))),
        h("optgroup", { label: t("cfg.prepared") },
          TOPICS.map((tp, i) => tp.bank ? h("option", { value: i, selected: i === cfg.t }, tp.name) : null)));
      sel.addEventListener("change", () => { cfg.t = Number(sel.value); });
      fields.push(h("label", { class: "field" }, h("span", null, t("cfg.topic")), sel));
    }
    const mkSel = (which, spec, allowed) => {
      const sel = h("select", { class: "select", id: "fSet" + which.toUpperCase() }, spec.values.map((v, i) =>
        allowed && !allowed(i) ? null : h("option", { value: i, selected: i === cfg[which] }, spec.fmt(v))));
      sel.addEventListener("change", () => { cfg[which] = Number(sel.value); updateButtons(); });
      fields.push(h("label", { class: "field" }, h("span", null, spec.label), sel));
    };
    mkSel("a", g.a);
    if (g.b) mkSel("b", g.b, mode === "self" && g.key === "schiffe" ? i => i !== 0 : null);

    const actions = h("div", { class: "actions" });
    const remember = () => store.set("last." + g.key, { t: cfg.t, a: cfg.a, b: cfg.b });
    function updateButtons() {
      actions.replaceChildren();
      if (mode === "self") {
        actions.append(h("button", { class: "btn primary xl", type: "button", onclick: () => { remember(); playGame({ ...cfg, seed: newSeed() }); } }, t("cfg.play")));
        return;
      }
      const leaderOnly = g.beamerOnly || (g.key === "schiffe" && cfg.b === 0);
      const locked = !g.free && !isPro();
      const lock = locked ? " 🔒" : "";
      if (leaderOnly) {
        actions.append(h("button", { class: "btn primary xl", type: "button", onclick: () => { remember(); requirePro(gi, () => playGame({ ...cfg, seed: newSeed() }, { beamer: true })); } }, t("cfg.beamer") + lock));
      } else if (g.key === "rallye") {
        actions.append(h("button", { class: "btn primary xl", type: "button", onclick: () => { remember(); requirePro(gi, () => screenStations({ ...cfg, b: 0, seed: newSeed() })); } }, t("cfg.stations") + lock));
      } else {
        actions.append(h("button", { class: "btn primary xl", type: "button", onclick: () => { remember(); requirePro(gi, () => screenPresent({ ...cfg, seed: newSeed() })); } }, t("cfg.present") + lock));
      }
      if (!leaderOnly) actions.append(h("button", { class: "btn", type: "button", onclick: () => { remember(); playGame({ ...cfg, b: g.key === "rallye" ? 1 : cfg.b }); } }, t("cfg.try")));
      if (locked) actions.append(h("p", { class: "muted small center wide-line" }, trialsLeft(g.key) ? t("cfg.trialsLeft", { n: trialsLeft(g.key), m: TRIALS }) : t("cfg.noTrials")));
    }
    updateButtons();
    root.append(h("div", { class: "cfg-head c-" + g.color },
      h("span", { class: "gicon", "aria-hidden": "true" }, g.icon),
      h("div", null, h("h2", null, g.name), h("p", null, g.desc))),
      h("div", { class: "card form" }, fields),
      mode === "teach" ? h("p", { class: "hint" }, "💡 " + t("tip." + g.key)) : null,
      actions);
  }, { title: g.name });
}

/* QR-Code für die Klasse – groß, mit Code zum Abtippen */
function screenPresent(cfg) {
  go(root => {
    const g = GAMES[cfg.g];
    const url = shareUrl(cfg);
    const code = encodeCode(cfg);
    const cv = qrCanvas(url, 900);
    const info = h("div", { class: "present-info" },
      h("div", { class: "present-game" }, h("span", { "aria-hidden": "true" }, g.icon + " "), g.name),
      g.noTopic ? null : h("div", { class: "present-topic" }, TOPICS[cfg.t].name),
      h("div", { class: "present-set" }, [g.a.fmt(gameSetting(cfg)), g.b && g.key !== "rallye" ? g.b.fmt(gameSetting(cfg, "b")) : null].filter(Boolean).join(" · ")),
      h("ol", { class: "present-steps" },
        h("li", null, t("present.step1")),
        h("li", null, t("present.step2")),
        h("li", null, t("present.step3"))),
      h("div", { class: "present-code", "aria-label": t("a11y.code") }, codeGroups(code)));
    const btns = h("div", { class: "row present-btns" });
    if (g.key === "bingo") btns.append(h("button", { class: "btn primary", type: "button", onclick: () => screenLeader(cfg) }, "🎯 " + t("present.leader")));
    btns.append(
      h("button", { class: "btn", type: "button", onclick: () => screenPresent({ ...cfg, seed: newSeed() }) }, t("present.newTasks")),
      h("button", { class: "btn", type: "button", onclick: () => playGame(cfg) }, t("cfg.try")),
      h("button", { class: "btn ghost", type: "button", onclick: () => copyText(url, t("present.copied")) }, t("present.copy")));
    root.append(h("div", { class: "present" }, h("div", { class: "present-qr" }, cv), info), btns);
    keepAwake(true); onLeave(() => keepAwake(false));
  }, { title: t("present.title"), wide: true });
}

/* Spielleitung am Beamer (Bingo) */
function screenLeader(cfg) {
  go(root => bingoLeader(root, cfg, onLeave), { title: t("bingo.lead.title"), wide: true });
}

/* Stationen-Rallye: Karten ansehen und drucken */
function screenStations(cfg) {
  const st = rallyeSetup(cfg);
  go(root => {
    const cards = [];
    for (let k = 1; k <= st.n; k++) {
      const c = { ...cfg, b: k };
      cards.push(h("div", { class: "scard" },
        h("div", { class: "scard-head" }, h("span", { class: "scard-nr" }, t("rallye.station", { n: k })), h("span", null, "MatheSnack · " + t("g.rallye"))),
        qrCanvas(shareUrl(c), 520),
        h("div", { class: "scard-topic" }, TOPICS[cfg.t].name),
        h("div", { class: "scard-code" }, t("stations.code", { c: codeGroups(encodeCode(c)) }))));
    }
    const solution = h("div", { class: "card solution" },
      h("h3", null, t("stations.forTeacher")),
      h("p", null, t("stations.word") + " ", h("strong", { class: "word" }, st.word)),
      h("ol", null, st.stations.map((s2, k) => h("li", null, (s2.it.fn ? t("stations.graph", { a: s2.it.a }) : statementText(s2.it, s2.it.a)) + "  " + t("stations.letter", { l: st.word[k] })))));
    const printBtn = h("button", { class: "btn primary", type: "button", onclick: () => {
      printBtn.disabled = true;
      setTimeout(() => {
        try { shareFile(stationsPdf(cfg, st), t("stations.fileName") + ".pdf", "application/pdf"); }
        catch (e) { toast(t("stations.shareFailed")); }
        printBtn.disabled = false;
      }, 30);
    } }, "📄 " + t("stations.pdf"));
    root.append(
      h("p", { class: "lead" }, t("stations.lead", { n: st.n })),
      h("div", { class: "row" }, printBtn,
        h("button", { class: "btn", type: "button", onclick: () => screenStations({ ...cfg, seed: newSeed() }) }, t("present.newTasks")),
        h("button", { class: "btn ghost", type: "button", onclick: () => playGame({ ...cfg, b: 1 }) }, t("stations.try"))),
      h("p", { class: "muted small" }, t("stations.printHint")),
      solution, h("div", { class: "scards" }, cards));
  }, { title: t("g.rallye"), wide: true });
}
async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch (e) {
    const ta = h("textarea", { style: { position: "fixed", opacity: "0" } }, text);
    document.body.append(ta); ta.select();
    try { document.execCommand("copy"); toast(okMsg); } catch (e2) { toast(t("copyFailed")); }
    ta.remove();
  }
}
