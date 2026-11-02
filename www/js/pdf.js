/* MatheSnack – Stationskarten als PDF (ohne Bibliothek)
   Jede Seite wird auf eine Leinwand gezeichnet (A4, 150 dpi) und als JPEG in
   ein schlichtes PDF eingebettet. In der App wird das PDF über das
   Teilen-Menü weitergegeben (Drucken, In Dateien sichern, AirDrop …),
   im Browser heruntergeladen. window.print() wirkt in den App-Hüllen nicht. */
"use strict";

const A4 = { w: 1240, h: 1754, ptW: 595.28, ptH: 841.89 };

/* ---------- PDF aus JPEG-Seiten ---------- */
function makePdf(pages) {
  const enc = new TextEncoder();
  const chunks = [];
  let length = 0;
  const offsets = [];
  const push = data => { const b = typeof data === "string" ? enc.encode(data) : data; chunks.push(b); length += b.length; };
  const obj = (n, body, stream) => {
    offsets[n] = length;
    push(`${n} 0 obj\n${body}\n`);
    if (stream) { push("stream\n"); push(stream); push("\nendstream\n"); }
    push("endobj\n");
  };
  push("%PDF-1.4\n%âãÏÓ\n");
  const n = pages.length;
  /* 1 Katalog, 2 Seitenbaum, je Seite: Seite, Inhalt, Bild */
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
  pages.forEach((p, i) => {
    const pageNo = 3 + i * 3, contentNo = pageNo + 1, imgNo = pageNo + 2;
    obj(pageNo, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.ptW} ${A4.ptH}] /Resources << /XObject << /Im${i} ${imgNo} 0 R >> >> /Contents ${contentNo} 0 R >>`);
    const content = enc.encode(`q ${A4.ptW} 0 0 ${A4.ptH} 0 0 cm /Im${i} Do Q`);
    obj(contentNo, `<< /Length ${content.length} >>`, content);
    obj(imgNo, `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>`, p.jpeg);
  });
  const total = 3 + n * 3;
  const xref = length;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let k = 1; k < total; k++) x += String(offsets[k]).padStart(10, "0") + " 00000 n \n";
  push(x);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let o = 0;
  chunks.forEach(c => { out.set(c, o); o += c.length; });
  return out;
}
function canvasJpeg(cv) {
  const b64 = cv.toDataURL("image/jpeg", 0.92).split(",")[1];
  const bin = atob(b64), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return { jpeg: arr, w: cv.width, h: cv.height };
}
function bytesToBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/* ---------- Seiten zeichnen ---------- */
const PDF_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
function newPage() {
  const cv = document.createElement("canvas");
  cv.width = A4.w; cv.height = A4.h;
  const c = cv.getContext("2d");
  c.fillStyle = "#fff"; c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = "#111"; c.textBaseline = "alphabetic";
  return { cv, c };
}
function wrapText(c, text, x, y, maxW, lineH) {
  const words = String(text).split(/\s+/);
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (c.measureText(test).width > maxW && line) { c.fillText(line, x, y); y += lineH; line = w; }
    else line = test;
  }
  if (line) { c.fillText(line, x, y); y += lineH; }
  return y;
}
function drawQrAt(c, text, x, y, size) {
  const qr = QR.encode(text);
  const n = qr.size + 8, m = size / n;
  c.fillStyle = "#fff"; c.fillRect(x, y, size, size);
  c.fillStyle = "#000";
  for (let yy = 0; yy < qr.size; yy++) for (let xx = 0; xx < qr.size; xx++)
    if (qr.get(xx, yy)) c.fillRect(Math.floor(x + (xx + 4) * m), Math.floor(y + (yy + 4) * m), Math.ceil(m), Math.ceil(m));
}
function solutionPage(cfg, st) {
  const { cv, c } = newPage();
  const L = 110, W = A4.w - 2 * L;
  c.font = `800 54px ${PDF_FONT}`;
  c.fillText(t("g.rallye") + " – " + t("stations.forTeacher"), L, 170);
  c.font = `500 34px ${PDF_FONT}`; c.fillStyle = "#444";
  c.fillText(TOPICS[cfg.t].name, L, 230);
  c.fillStyle = "#111"; c.font = `700 40px ${PDF_FONT}`;
  c.fillText(t("stations.word"), L, 330);
  c.font = `900 96px ${PDF_FONT}`; c.fillStyle = "#E2581C";
  c.fillText(st.word.split("").join(" "), L, 450);
  c.fillStyle = "#111"; c.font = `500 32px ${PDF_FONT}`;
  let y = 560;
  st.stations.forEach((s2, k) => {
    const line = `${k + 1}.  ${s2.it.fn ? t("stations.graph", { a: s2.it.a }) : statementText(s2.it, s2.it.a)}   ${t("stations.letter", { l: st.word[k] })}`;
    y = wrapText(c, line, L, y, W, 44) + 14;
  });
  c.font = `500 26px ${PDF_FONT}`; c.fillStyle = "#666";
  wrapText(c, t("stations.pdfHint"), L, A4.h - 150, W, 36);
  return canvasJpeg(cv);
}
function cardsPages(cfg, st) {
  const pages = [];
  const cw = A4.w / 2, ch = A4.h / 2;
  for (let start = 0; start < st.n; start += 4) {
    const { cv, c } = newPage();
    for (let j = 0; j < 4 && start + j < st.n; j++) {
      const k = start + j + 1;
      const x0 = (j % 2) * cw, y0 = Math.floor(j / 2) * ch;
      c.save();
      c.setLineDash([14, 10]); c.strokeStyle = "#999"; c.lineWidth = 2;
      c.strokeRect(x0 + 20, y0 + 20, cw - 40, ch - 40);
      c.restore();
      c.fillStyle = "#111"; c.font = `900 64px ${PDF_FONT}`;
      c.fillText(t("rallye.station", { n: k }), x0 + 60, y0 + 120);
      c.font = `500 24px ${PDF_FONT}`; c.fillStyle = "#555";
      c.fillText("MatheSnack · " + t("g.rallye"), x0 + 60, y0 + 160);
      const q = 470;
      drawQrAt(c, shareUrl({ ...cfg, b: k }), x0 + (cw - q) / 2, y0 + 190, q);
      c.fillStyle = "#111"; c.font = `700 30px ${PDF_FONT}`;
      c.textAlign = "center";
      c.fillText(TOPICS[cfg.t].name, x0 + cw / 2, y0 + 710);
      c.font = `500 26px ui-monospace, Menlo, Consolas, monospace`; c.fillStyle = "#444";
      c.fillText(t("stations.code", { c: codeGroups(encodeCode({ ...cfg, b: k })) }), x0 + cw / 2, y0 + 760);
      c.textAlign = "left";
    }
    pages.push(canvasJpeg(cv));
  }
  return pages;
}
function stationsPdf(cfg, st) {
  return makePdf([solutionPage(cfg, st), ...cardsPages(cfg, st)]);
}

/* ---------- Weitergeben ---------- */
function shareFile(bytes, fileName, mime) {
  const b64 = bytesToBase64(bytes);
  const sp = window.plugins && window.plugins.socialsharing;
  if (inApp() && sp) {
    if (sp.setIPadPopupCoordinates) sp.setIPadPopupCoordinates(Math.round(innerWidth / 2) + "," + Math.round(innerHeight / 2) + ",1,1");
    sp.shareWithOptions({ files: [`df:${fileName};data:${mime};base64,${b64}`] }, () => {}, () => toast(t("stations.shareFailed")));
    return;
  }
  const a = document.createElement("a");
  a.href = `data:${mime};base64,${b64}`;
  a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
}
