# -*- coding: utf-8 -*-
"""Claude isaretini siyah zeminde PNG ikon olarak uretir."""
import math
from PIL import Image, ImageDraw

ACCENT = (217, 119, 87, 255)   # #d97757
BG     = (0, 0, 0, 255)
SS     = 4                      # supersampling

def make(size, pad_ratio=0.22):
    S = size * SS
    img = Image.new("RGBA", (S, S), BG)
    d = ImageDraw.Draw(img)
    c = S / 2.0
    # maskable ikonlar icin kenarlarda guvenli bosluk birak
    usable = S * (1 - 2 * pad_ratio) / 2.0
    n = 11
    inner = 0.0
    for i in range(n):
        ang = math.radians((360.0 / n) * i - 90)
        long_ray = (i % 2 == 0)
        outer = usable * (1.0 if long_ray else 0.78)
        w = usable * (0.135 if long_ray else 0.105)
        dx, dy = math.cos(ang), math.sin(ang)
        x0, y0 = c + dx * inner, c + dy * inner
        x1, y1 = c + dx * outer, c + dy * outer
        d.line([(x0, y0), (x1, y1)], fill=ACCENT, width=int(round(w)))
        r = w / 2.0
        for (x, y) in ((x0, y0), (x1, y1)):
            d.ellipse([x - r, y - r, x + r, y + r], fill=ACCENT)
    return img.resize((size, size), Image.LANCZOS)

for s in (192, 512):
    make(s).save("public/icon-%d.png" % s)
    print("public/icon-%d.png yazildi" % s)

# favicon
make(64, pad_ratio=0.14).save("public/favicon.png")
print("public/favicon.png yazildi")
