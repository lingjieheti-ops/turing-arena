#!/usr/bin/env python3
"""Polished Turing Arena logo (Proof-of-α diamond) — 512x512 PNG."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

S = 512
TEAL = (124, 246, 200)
img = Image.new("RGB", (S, S), (7, 11, 15))

# soft teal radial glow, upper area
g = Image.new("RGBA", (S, S), (0, 0, 0, 0)); gd = ImageDraw.Draw(g)
gd.ellipse([int(S*0.08), int(-S*0.05), int(S*0.96), int(S*0.78)], fill=(124, 246, 200, 48))
g = g.filter(ImageFilter.GaussianBlur(115))
img = Image.alpha_composite(img.convert("RGBA"), g).convert("RGB")

cx, cy = S // 2, S // 2
def dpts(c, r):
    return [(c[0], c[1]-r), (c[0]+r, c[1]), (c[0], c[1]+r), (c[0]-r, c[1])]
def closed(pts):
    return pts + [pts[0]]

# inner diamond filled with a subtle vertical gradient (depth, not flat)
R = 206
grad = Image.new("RGB", (1, 2*R)); top = (19, 48, 41); bot = (9, 16, 21)
for i in range(2*R):
    t = i/(2*R)
    grad.putpixel((0, i), tuple(int(top[k] + (bot[k]-top[k])*t) for k in range(3)))
grad = grad.resize((2*R, 2*R))
mask = Image.new("L", (S, S), 0); ImageDraw.Draw(mask).polygon(dpts((cx, cy), R), fill=255)
gfull = Image.new("RGB", (S, S), (9, 16, 21)); gfull.paste(grad, (cx-R, cy-R))
img = Image.composite(gfull, img, mask)

# glowing outer ring (blurred halo under a crisp ring)
ring = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(ring).line(closed(dpts((cx, cy), R)), fill=(124, 246, 200, 165), width=18, joint="curve")
ring = ring.filter(ImageFilter.GaussianBlur(11))
img = Image.alpha_composite(img.convert("RGBA"), ring).convert("RGB")
d = ImageDraw.Draw(img, "RGBA")
d.line(closed(dpts((cx, cy), R)), fill=TEAL, width=11, joint="curve")
d.line(closed(dpts((cx, cy), int(R*0.80))), fill=(47, 120, 99), width=4, joint="curve")

# alpha glyph with a soft glow
af = ImageFont.truetype("C:/Windows/Fonts/seguisb.ttf", 250)
t = "α"; bb = d.textbbox((0, 0), t, font=af)
w, h = bb[2]-bb[0], bb[3]-bb[1]
ax, ay = cx - w/2 - bb[0], cy - h/2 - bb[1] - 10
gl = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(gl).text((ax, ay), t, font=af, fill=(124, 246, 200, 185))
gl = gl.filter(ImageFilter.GaussianBlur(15))
img = Image.alpha_composite(img.convert("RGBA"), gl).convert("RGB")
d = ImageDraw.Draw(img, "RGBA")
d.text((ax, ay), t, font=af, fill=(214, 255, 240))

img.save("assets/logo.png", "PNG")
im2 = img.copy(); im2.thumbnail((360, 360)); im2.save("assets/_qa_logo.png")
print("logo saved", img.size)
