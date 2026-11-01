/* MatheSnack – Lehrkraft: Spiel einstellen, QR-Code präsentieren,
   Spielleitung am Beamer, Stationskarten drucken */
"use strict";

/* Schritt 1: Spiel wählen. mode "teach" (für die Klasse) oder "self" (selbst üben) */
function screenChooseGame(mode) {
  go(root => {
    const list = GAMES.map((g, i) => ({ g, i })).filter(({ g }) => mode === "teach" || !g.beamerOnly);
    root.append(
      h("p", { class: "lead" }, mode === "teach"
        ? "Wähle ein Spiel. Danach Thema und Einstellungen – die App erzeugt einen QR-Code für die Klasse."
        : "Wähle ein Spiel zum Üben."),
      h("div", { class: "gamegrid" }, list.map(({ g, i }) =>
        h("button", { class: "gametile c-" + g.color, type: "button", onclick: () => screenConfig(i, mode) },
          h("span", { class: "gicon", "aria-hidden": "true" }, g.icon),
          h("span", { class: "gtext" }, h("strong", null, g.name), h("span", null, g.desc))))));
  }, { title: mode === "teach" ? "Spiel für die Klasse" : "Selbst üben" });
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
  go(root => {
    const fields = [];
    if (!g.noTopic) {
      const sel = h("select", { id: "fTopic", class: "select" },
        h("optgroup", { label: "Aufgaben-Generatoren (immer neue Aufgaben)" },
          TOPICS.map((tp, i) => tp.bank ? null : h("option", { value: i, selected: i === cfg.t }, `${tp.name} · ${tp.grade}${tp.graph && g.graph ? " · mit Graphen" : ""}`))),
        h("optgroup", { label: "Vorbereitete Aufgaben" },
          TOPICS.map((tp, i) => tp.bank ? h("option", { value: i, selected: i === cfg.t }, tp.name) : null)));
      sel.addEventListener("change", () => { cfg.t = Number(sel.value); });
      fields.push(h("label", { class: "field" }, h("span", null, "Thema"), sel));
    }
    const mkSel = (which, spec) => {
      const sel = h("select", { class: "select" }, spec.values.map((v, i) => h("option", { value: i, selected: i === cfg[which] }, spec.fmt(v))));
      sel.addEventListener("change", () => { cfg[which] = Number(sel.value); updateButtons(); });
      fields.push(h("label", { class: "field" }, h("span", null, spec.label), sel));
    };
    mkSel("a", g.a);
    if (g.b && g.key !== "rallye") mkSel("b", g.b);

    const actions = h("div", { class: "actions" });
    const remember = () => store.set("last." + g.key, { t: cfg.t, a: cfg.a, b: cfg.b });
    function updateButtons() {
      actions.replaceChildren();
      const leaderOnly = g.beamerOnly || (g.key === "schiffe" && cfg.b === 0);
      if (mode === "self") {
        actions.append(h("button", { class: "btn primary xl", type: "button", onclick: () => { remember(); playGame({ ...cfg, b: g.key === "rallye" ? 1 : cfg.b, seed: newSeed() }); } }, "Spielen"));
        return;
      }
      if (leaderOnly) {
        actions.append(h("button", { class: "btn primary xl", type: "button", onclick: () => { remember(); playGame({ ...cfg, seed: newSeed() }, { beamer: true }); } }, "Am Beamer starten"));
      } else if (g.key === "rallye") {
        actions.append(h("button", { class: "btn primary xl", type: "button", onclick: () => { remember(); screenStations({ ...cfg, b: 0 }); } }, "Stationskarten erstellen"));
      } else {
        actions.append(h("button", { class: "btn primary xl", type: "button", onclick: () => { remember(); screenPresent({ ...cfg, seed: newSeed() }); } }, "QR-Code präsentieren"));
      }
      if (!leaderOnly) actions.append(h("button", { class: "btn", type: "button", onclick: () => { remember(); playGame({ ...cfg, b: g.key === "rallye" ? 1 : cfg.b }); } }, "Selbst ausprobieren"));
    }
    updateButtons();
    root.append(h("div", { class: "cfg-head c-" + g.color },
      h("span", { class: "gicon", "aria-hidden": "true" }, g.icon),
      h("div", null, h("h2", null, g.name), h("p", null, g.desc))),
      h("div", { class: "card form" }, fields),
      hintFor(g), actions);
  }, { title: g.name });
}
function hintFor(g) {
  const tips = {
    sprint: "Tipp: Danach kurz fragen, welche Aufgaben schwer waren – ein schneller Einstieg in die Wiederholung.",
    fehler: "Alle Geräte bekommen dieselben Rechnungen. Gut für ein anschließendes Gespräch über typische Fehler.",
    memory: "Bei Funktionen werden Graph und Gleichung zum Paar.",
    domino: "Jedes Gerät mischt die Steine selbst, die Aufgaben sind für alle gleich.",
    zuordnen: "Bei Funktionen: Graph zur Gleichung. Sonst Aufgabe zum Ergebnis.",
    bingo: "QR-Code zeigen, dann „Spielleitung“ öffnen: Der Beamer zieht die Aufgaben, jede Schülerkarte ist anders gemischt.",
    schiffe: "Klasse gegen Lehrkraft braucht keine Schülergeräte. Partnerspiel: zwei Geräte, Koordinaten werden zugerufen.",
    rallye: "Stationskarten ausdrucken und im Raum verteilen. Schülerinnen und Schüler laufen, scannen und sammeln Buchstaben.",
    move: "Läuft nur am Beamer. Für „Was ist mehr?“ eignen sich Zahlenthemen am besten."
  };
  return tips[g.key] ? h("p", { class: "hint" }, "💡 " + tips[g.key]) : null;
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
        h("li", null, "Kamera öffnen und QR-Code scannen"),
        h("li", null, "Link antippen – das Spiel startet sofort"),
        h("li", null, "Ohne Kamera: MatheSnack öffnen, „Code eingeben“")),
      h("div", { class: "present-code", "aria-label": "Spielcode" }, codeGroups(code)));
    const btns = h("div", { class: "row present-btns" });
    if (g.key === "bingo") btns.append(h("button", { class: "btn primary", type: "button", onclick: () => screenLeader(cfg) }, "🎯 Spielleitung öffnen"));
    btns.append(
      h("button", { class: "btn", type: "button", onclick: () => screenPresent({ ...cfg, seed: newSeed() }) }, "Neue Aufgaben"),
      h("button", { class: "btn", type: "button", onclick: () => playGame(cfg) }, "Selbst ausprobieren"),
      h("button", { class: "btn ghost", type: "button", onclick: () => copyText(url, "Link kopiert") }, "Link kopieren"),
      document.fullscreenEnabled ? h("button", { class: "btn ghost", type: "button", onclick: toggleFullscreen }, "Vollbild") : null);
    root.append(h("div", { class: "present" }, h("div", { class: "present-qr" }, cv), info), btns);
    keepAwake(true); onLeave(() => keepAwake(false));
  }, { title: "QR-Code für die Klasse", wide: true });
}

/* Spielleitung am Beamer (Bingo) */
function screenLeader(cfg) {
  go(root => bingoLeader(root, cfg, onLeave), { title: "Bingo – Spielleitung", wide: true });
}

/* Stationen-Rallye: Karten ansehen und drucken */
function screenStations(cfg) {
  const st = rallyeSetup(cfg);
  go(root => {
    const cards = [];
    for (let k = 1; k <= st.n; k++) {
      const c = { ...cfg, b: k };
      cards.push(h("div", { class: "scard" },
        h("div", { class: "scard-head" }, h("span", { class: "scard-nr" }, "Station " + k), h("span", null, "MatheSnack · Rallye")),
        qrCanvas(shareUrl(c), 520),
        h("div", { class: "scard-topic" }, TOPICS[cfg.t].name),
        h("div", { class: "scard-code" }, "Code: " + codeGroups(encodeCode(c)))));
    }
    const solution = h("div", { class: "card solution" },
      h("h3", null, "Für die Lehrkraft"),
      h("p", null, "Lösungswort: ", h("strong", { class: "word" }, st.word)),
      h("ol", null, st.stations.map((s2, k) => h("li", null, (s2.it.fn ? "Graph → " + s2.it.a : statementText(s2.it, s2.it.a)) + `  (Buchstabe ${st.word[k]})`))));
    const printBtn = h("button", { class: "btn primary", type: "button", onclick: () => printStations(cards, solution) }, "🖨 Drucken");
    root.append(
      h("p", { class: "lead" }, `${st.n} Stationskarten. Ausdrucken, im Raum verteilen – jede Karte ist ein eigener QR-Code. Die Reihenfolge ist egal.`),
      h("div", { class: "row" }, inApp() ? h("p", { class: "muted small" }, "Drucken geht in der Webfassung im Browser. Hier kannst du die Karten ansehen oder Bildschirmfotos machen.") : printBtn,
        h("button", { class: "btn", type: "button", onclick: () => screenStations({ ...cfg, seed: newSeed() }) }, "Neue Aufgaben"),
        h("button", { class: "btn ghost", type: "button", onclick: () => playGame({ ...cfg, b: 1 }) }, "Station 1 ausprobieren")),
      solution, h("div", { class: "scards" }, cards));
  }, { title: "Stationen-Rallye", wide: true });
}
function printStations(cards, solution) {
  const area = $("#printArea");
  area.replaceChildren(
    h("div", { class: "ppage" }, solution.cloneNode(true)),
    ...cards.map(c => {
      const copy = c.cloneNode(true);
      /* Leinwände werden beim Klonen leer – als Bild übernehmen */
      const src = c.querySelector("canvas"), dst = copy.querySelector("canvas");
      dst.replaceWith(h("img", { src: src.toDataURL("image/png"), alt: "QR-Code", class: "qrcanvas" }));
      return copy;
    }));
  document.body.classList.add("printing");
  const done = () => { document.body.classList.remove("printing"); area.replaceChildren(); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  setTimeout(() => { window.print(); setTimeout(done, 500); }, 100);
}

function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  } catch (e) { /* egal */ }
}
async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch (e) {
    const ta = h("textarea", { style: { position: "fixed", opacity: "0" } }, text);
    document.body.append(ta); ta.select();
    try { document.execCommand("copy"); toast(okMsg); } catch (e2) { toast("Kopieren nicht möglich."); }
    ta.remove();
  }
}
