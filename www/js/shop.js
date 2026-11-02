/* MatheSnack – Lehrkraft-Paket (In-App-Kauf) und Probestarts
   Frei für alle: jedes Spiel per Code spielen, „Selbst üben“, und für die
   Klasse Sprint, Fehlersuche und Memory. Das Paket schaltet die übrigen
   Spiele für die Klasse frei (QR-Code, Beamer, Stationskarten).
   Ohne Paket gibt es je Spiel TRIALS Probestarts, gezählt auf dem Gerät.

   Plugin: cordova-plugin-purchase (CdvPurchase, v13) wie bei Drawmory –
   iOS über StoreKit, Android über Google Play Billing. Ohne Server gilt ein
   Kauf als bestätigt, sobald der Store ihn meldet. Außerhalb der App (nur
   beim Entwickeln im Browser) gibt es keinen Kauf. */
"use strict";

const PRODUCT_ID = "de.mathesnack.app.lehrkraft";
const TRIALS = 3;
const shop = { ready: false, price: "", busy: false, error: "", onChange: null };

function shopPlatform(C) { return onAndroid() ? C.Platform.GOOGLE_PLAY : C.Platform.APPLE_APPSTORE; }
function isPro() { return store.get("pro", false) === true; }
function isFreeGame(g) { return !!GAMES[g].free; }
function trialsLeft(key) { return Math.max(0, TRIALS - (Number(store.get("trial." + key, 0)) || 0)); }
function useTrial(key) { store.set("trial." + key, TRIALS - trialsLeft(key) + 1); }
function shopChanged() {
  if (shop.onChange) { try { shop.onChange(); } catch (e) { /* weiter */ } return; }
  /* Kein Kaufbildschirm offen (z. B. „Käufe wiederherstellen“ in den Einstellungen) */
  if (shop.error) { toast(shop.error); shop.error = ""; }
  if (typeof currentScreen !== "undefined" && currentScreen.name === "settings" && !shop.busy) screenSettings();
}

function setPro() {
  if (isPro()) return;
  store.set("pro", true);
  shop.busy = false;
  toast(t("pro.unlocked"));
  shopChanged();
}

function initShop() {
  const C = window.CdvPurchase;
  if (!C || !C.store) return;
  const st = C.store, plat = shopPlatform(C);
  st.register([{ id: PRODUCT_ID, type: C.ProductType.NON_CONSUMABLE, platform: plat }]);
  st.when()
    .productUpdated(p => {
      if (!p || p.id !== PRODUCT_ID) return;
      shop.price = (p.pricing && p.pricing.price) || shop.price;
      if (p.owned) setPro();
      shopChanged();
    })
    .approved(tr => tr.verify())
    .verified(rc => rc.finish())
    .finished(tr => {
      if (tr && tr.products && tr.products.some(x => x.id === PRODUCT_ID)) setPro();
      shop.busy = false; shopChanged();
    });
  if (st.error) st.error(err => { shop.busy = false; shop.error = (err && err.message) || t("pro.failed"); shopChanged(); });
  Promise.resolve(st.initialize([plat])).then(() => {
    shop.ready = true;
    if (st.owned && st.owned(PRODUCT_ID)) setPro();
    shopChanged();
  }).catch(() => { shop.error = t("pro.unavailable"); shopChanged(); });
}

function buyPro() {
  const C = window.CdvPurchase;
  const p = C && C.store && C.store.get(PRODUCT_ID, shopPlatform(C));
  const offer = p && p.getOffer && p.getOffer();
  if (!offer) { shop.error = t("pro.unavailable"); shopChanged(); return; }
  shop.busy = true; shop.error = ""; shopChanged();
  Promise.resolve(offer.order()).then(err => {
    if (!err) return;     /* Erfolg meldet .finished() */
    shop.busy = false;
    const cancelled = C.ErrorCode && err.code === C.ErrorCode.PAYMENT_CANCELLED;
    if (!cancelled) shop.error = err.message || t("pro.failed");
    shopChanged();
  }).catch(() => { shop.busy = false; shop.error = t("pro.failed"); shopChanged(); });
}

function restorePro() {
  const C = window.CdvPurchase;
  if (!C || !C.store) { shop.error = t("pro.appOnly"); shopChanged(); return; }
  shop.busy = true; shop.error = ""; shopChanged();
  Promise.resolve(C.store.restorePurchases()).then(() => {
    shop.busy = false;
    if (C.store.owned(PRODUCT_ID)) setPro(); else shop.error = t("pro.restoreNone");
    shopChanged();
  }).catch(() => { shop.busy = false; shop.error = t("pro.failed"); shopChanged(); });
}

/* Vor jedem Start eines Bezahlspiels für die Klasse.
   Paket vorhanden oder freies Spiel: sofort weiter. Sonst Probestart anbieten
   oder – wenn aufgebraucht – das Paket zeigen. */
function requirePro(gi, go) {
  const g = GAMES[gi];
  if (isPro() || isFreeGame(gi)) { go(); return; }
  const left = trialsLeft(g.key);
  if (left <= 0) { screenPaywall(g.key); return; }
  dialog(t("pro.trial.title"), t("pro.trial.text", { game: g.name, n: left, m: TRIALS }), [
    { label: t("cancel") },
    { label: t("pro.trial.more"), action: () => { setTimeout(() => screenPaywall(g.key), 0); } },
    { label: t("pro.trial.use"), primary: true, action: () => { useTrial(g.key); setTimeout(go, 0); } }
  ]);
}

/* Bildschirm „Lehrkraft-Paket“ */
function screenPaywall(reasonKey) {
  go(root => {
    const paid = GAMES.filter(g => !g.free);
    const reason = h("p", { class: "notice warn" });
    const buy = h("button", { class: "btn primary xl", type: "button", onclick: buyPro });
    const restore = h("button", { class: "btn ghost", type: "button", onclick: restorePro }, t("pro.restore"));
    const msg = h("p", { class: "msg", role: "status" });
    const status = h("p", { class: "pro-status" });
    function paint() {
      const pro = isPro();
      reason.hidden = pro || !reasonKey;
      if (reasonKey) {
        const g = GAMES.find(x => x.key === reasonKey);
        reason.textContent = t("pro.reason", { game: g ? g.name : "" });
      }
      status.hidden = !pro;
      status.textContent = t("pro.active");
      buy.hidden = pro; restore.hidden = pro;
      if (!inApp()) {
        buy.textContent = t("pro.buyFor", { price: t("pro.price") });
        buy.disabled = true;
        msg.textContent = t("pro.appOnly");
        return;
      }
      buy.textContent = shop.price ? t("pro.buyFor", { price: shop.price }) : t("pro.loading");
      buy.disabled = !shop.ready || shop.busy;
      restore.disabled = !shop.ready || shop.busy;
      msg.textContent = shop.error || "";
    }
    shop.onChange = paint;
    onLeave(() => { if (shop.onChange === paint) shop.onChange = null; });
    root.append(
      h("div", { class: "pro-head" },
        h("div", { class: "big-icon", "aria-hidden": "true" }, "🎓"),
        h("h2", null, t("pro.title")),
        h("p", { class: "muted" }, t("pro.subtitle"))),
      reason, status,
      h("div", { class: "card" },
        h("h3", null, t("pro.includes")),
        h("ul", { class: "pro-list" },
          paid.map(g => h("li", null, h("span", { "aria-hidden": "true" }, g.icon + " "), h("strong", null, g.name), " – ", t("pro.what." + g.key))))),
      h("ul", { class: "pro-facts" },
        h("li", null, "✓ " + t("pro.fact.once")),
        h("li", null, "✓ " + t("pro.fact.students")),
        h("li", null, "✓ " + t("pro.fact.free")),
        h("li", null, "✓ " + t("pro.fact.family"))),
      h("div", { class: "actions" }, buy, restore),
      msg,
      h("p", { class: "muted small center" }, onAndroid() ? t("pro.fine.google") : t("pro.fine.apple")));
    paint();
  }, { title: t("pro.title") });
}
