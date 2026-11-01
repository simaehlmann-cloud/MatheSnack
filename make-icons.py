#!/usr/bin/env python3
"""Erzeugt alle App-Icons und den Startbildschirm für MatheSnack.

    python3 make-icons.py

Motiv: angebissener Keks in Orange auf Rechenkästchen-Papier, statt
Schokostückchen Rechenzeichen in Tinte. iOS-Icons ohne Alphakanal
(App Store Connect lehnt Transparenz ab). Android: klassische Icons je Dichte
und adaptive Icons (Vordergrund transparent, Hintergrundfarbe aus
res/android/colors.xml). Beide Workflows rufen dieses Skript vor dem Build auf.
Aufbau wie bei Drawmory."""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
PAPER = (251, 247, 239)
GRID = (236, 226, 208)
COOKIE = (255, 122, 48)
COOKIE_DARK = (226, 88, 28)
INK = (30, 36, 71)


def art(size, pad=0.0, transparent=False):
    S = 4
    W = size * S
    im = Image.new("RGBA" if transparent else "RGB", (W, W), (0, 0, 0, 0) if transparent else PAPER)
    d = ImageDraw.Draw(im)
    inner = W * (1 - 2 * pad)
    off = W * pad

    def P(x, y):                       # Koordinaten im Raum 0..96
        return (off + x / 96 * inner, off + y / 96 * inner)

    def R(v):
        return v / 96 * inner

    if size >= 64 and not transparent:
        cell = inner / 12
        gw = max(1, int(W / 300))
        start = off % cell
        for i in range(-1, int(W / cell) + 2):
            v = start + i * cell
            d.line([(v, 0), (v, W)], fill=GRID, width=gw)
            d.line([(0, v), (W, v)], fill=GRID, width=gw)

    # Keks mit Biss: Kreis, darüber zwei Kreise in Papierfarbe (bzw. transparent)
    cx, cy, r = 48, 50, 36
    keks = Image.new("L", (W, W), 0)
    k = ImageDraw.Draw(keks)
    k.ellipse([*P(cx - r, cy - r), *P(cx + r, cy + r)], fill=255)
    for bx, by, br in ((80, 20, 12), (86, 36, 9)):
        k.ellipse([*P(bx - br, by - br), *P(bx + br, by + br)], fill=0)
    rim = Image.new("RGBA", (W, W), COOKIE_DARK + (255,))
    im.paste(rim, (0, 0), keks)
    inner_mask = keks.resize((W, W))
    shrink = Image.new("L", (W, W), 0)
    ImageDraw.Draw(shrink).ellipse([*P(cx - r + 3, cy - r + 3), *P(cx + r - 3, cy + r - 3)], fill=255)
    from PIL import ImageChops
    body = ImageChops.multiply(inner_mask, shrink)
    im.paste(Image.new("RGBA", (W, W), COOKIE + (255,)), (0, 0), body)

    lw = int(R(5.2))

    def line(a, b):
        d.line([P(*a), P(*b)], fill=INK, width=lw)
        for x, y in (a, b):
            rr = lw / 2
            px, py = P(x, y)
            d.ellipse([px - rr, py - rr, px + rr, py + rr], fill=INK)

    # Plus
    line((28, 42), (42, 42)); line((35, 35), (35, 49))
    # Mal
    line((51, 56), (61, 66)); line((61, 56), (51, 66))
    # Minus
    line((25, 64), (37, 64))
    # Geteilt
    line((48, 34), (60, 34))
    for y in (27.5, 40.5):
        rr = R(3.0)
        px, py = P(54, y)
        d.ellipse([px - rr, py - rr, px + rr, py + rr], fill=INK)
    return im.resize((size, size), Image.LANCZOS)


def save(im, *parts):
    path = os.path.join(HERE, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if parts[0] == "res" and parts[1] == "ios":
        im = im.convert("RGB")
    im.save(path, optimize=True)


save(art(1024, 0.04).convert("RGB"), "icon-1024.png")
save(art(512, 0.04), "icon.png")
save(art(192, 0.04), "icon-192.png")
save(art(180, 0.04), "icon-180.png")
save(art(512, 0.16), "icon-maskable-512.png")
for s in (20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024):
    save(art(s, 0.04), "res", "ios", f"icon-{s}.png")

splash = Image.new("RGB", (2732, 2732), PAPER)
motif = art(700, 0.0).convert("RGB")
splash.paste(motif, ((2732 - 700) // 2, (2732 - 700) // 2))
save(splash, "res", "ios", "Default@2x~universal~anyany.png")

DICHTEN = {"ldpi": 0.75, "mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for name, f in DICHTEN.items():
    save(art(round(48 * f), 0.04), "res", "android", f"icon_{name}.png")
    save(art(round(108 * f), 0.2, transparent=True), "res", "android", f"icon_fg_{name}.png")
with open(os.path.join(HERE, "res", "android", "colors.xml"), "w", encoding="utf-8") as fh:
    fh.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
             '    <color name="mathesnack_icon_background">#FBF7EF</color>\n</resources>\n')
print("Icons erzeugt")
