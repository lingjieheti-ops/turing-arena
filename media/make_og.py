"""Generate web/public/og.png — the 1200x630 cyberpunk social card for Turing Arena.

Dual-neon electric cyan (#3DF2FF) + hot magenta (#FF36C6) on a blue-black base,
Chakra Petch (matches the web UI). No em-dashes / weird symbols.
Run: python media/make_og.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630
BG = (5, 6, 15)            # #05060f
CYAN = (61, 242, 255)      # #3DF2FF
MAGENTA = (255, 54, 198)   # #FF36C6
WHITE = (236, 243, 252)
MUTED = (120, 138, 176)
PANEL = (11, 16, 36)
PANEL_BORDER = (27, 37, 71)
AI = (200, 135, 255)
AMBER = (255, 197, 61)

FONT_DIR = Path(__file__).resolve().parent / "video" / "fonts"


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_DIR / name), size)


f_brand = font("ChakraPetch-Bold.ttf", 88)
f_sub = font("ChakraPetch-Medium.ttf", 36)
f_kicker = font("ChakraPetch-SemiBold.ttf", 23)
f_meta = font("ChakraPetch-Regular.ttf", 25)
f_chip = font("ChakraPetch-SemiBold.ttf", 24)
f_small = font("ChakraPetch-Regular.ttf", 19)

img = Image.new("RGB", (W, H), BG)


def glow_blob(cx: int, cy: int, r: int, color: tuple[int, int, int]) -> Image.Image:
    layer = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(layer).ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    return layer.filter(ImageFilter.GaussianBlur(150))


img = Image.blend(img, glow_blob(120, 30, 360, (8, 42, 54), ), 0.7)
img = Image.blend(img, glow_blob(W - 120, 20, 340, (54, 12, 44)), 0.55)

# Faint neon blueprint grid.
grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(grid)
for x in range(0, W, 48):
    gd.line([(x, 0), (x, H)], fill=(61, 242, 255, 13), width=1)
for y in range(0, H, 48):
    gd.line([(0, y), (W, y)], fill=(255, 54, 198, 9), width=1)
img = Image.alpha_composite(img.convert("RGBA"), grid).convert("RGB")
d = ImageDraw.Draw(img)

# Outer frame + neon corner brackets.
d.rectangle([22, 22, W - 22, H - 22], outline=PANEL_BORDER, width=2)


def bracket(x: int, y: int, dx: int, dy: int, n: int = 28, w: int = 3) -> None:
    d.line([(x, y), (x + dx * n, y)], fill=CYAN, width=w)
    d.line([(x, y), (x, y + dy * n)], fill=CYAN, width=w)


bracket(22, 22, 1, 1)
bracket(W - 22, 22, -1, 1)
bracket(22, H - 22, 1, -1)
bracket(W - 22, H - 22, -1, -1)

MARGIN = 70

# Kicker chip (magenta).
chip = "ERC-8004   /   PROOF-OF-ALPHA"
cw = d.textlength(chip, font=f_kicker)
d.rectangle([MARGIN, 66, MARGIN + cw + 40, 66 + 46], outline=MAGENTA, width=2)
d.text((MARGIN + 20, 66 + 11), chip, font=f_kicker, fill=MAGENTA)

# Title "TURING ARENA": cyan neon glow pass, then sharp (TURING white, ARENA cyan).
TITLE_Y = 178
t1w = d.textlength("TURING ", font=f_brand)
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gl = ImageDraw.Draw(glow)
gl.text((MARGIN, TITLE_Y), "TURING ", font=f_brand, fill=(61, 242, 255, 70))
gl.text((MARGIN + t1w, TITLE_Y), "ARENA", font=f_brand, fill=(61, 242, 255, 210))
glow = glow.filter(ImageFilter.GaussianBlur(13))
img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
d = ImageDraw.Draw(img)
d.text((MARGIN, TITLE_Y), "TURING ", font=f_brand, fill=WHITE)
d.text((MARGIN + t1w, TITLE_Y), "ARENA", font=f_brand, fill=CYAN)

# Magenta underline accent.
tb = d.textbbox((MARGIN, TITLE_Y), "TURING ARENA", font=f_brand)
uy = tb[3] + 12
d.rectangle([MARGIN, uy, tb[2], uy + 6], fill=MAGENTA)

# Subtitle.
d.text((MARGIN, 360), "The on-chain Turing Test for", font=f_sub, fill=MUTED)
d.text((MARGIN, 404), "trading intelligence.", font=f_sub, fill=MUTED)

# "Can you beat the AI?"
yq = 476
d.text((MARGIN, yq), "Can you beat the ", font=f_sub, fill=WHITE)
xa = MARGIN + d.textlength("Can you beat the ", font=f_sub)
d.text((xa, yq), "AI", font=f_sub, fill=AI)
d.text((xa + d.textlength("AI", font=f_sub), yq), "?", font=f_sub, fill=WHITE)

# Bottom meta.
meta = "MANTLE SEPOLIA    /    COMMIT-REVEAL    /    VERIFIABLE REPUTATION"
d.text((MARGIN, H - 84), meta, font=f_meta, fill=MUTED)

# Right-side agent rows.
rows = [
    ("Michael Saylor", "AI", "+6.0%", CYAN),
    ("Peter Schiff", "AI", "-4.1%", MAGENTA),
    ("Your agent", "YOU", "+1.5%", AMBER),
]
rx, rw, ry = W - 70 - 360, 360, 178
for name, kind, mv, col in rows:
    d.rectangle([rx, ry, rx + rw, ry + 78], fill=PANEL, outline=PANEL_BORDER, width=2)
    edge = CYAN if kind == "AI" else AMBER
    d.rectangle([rx, ry, rx + 3, ry + 78], fill=edge)
    d.ellipse([rx + 24, ry + 33, rx + 36, ry + 45], fill=AI if kind == "AI" else AMBER)
    d.text((rx + 52, ry + 15), name, font=f_chip, fill=WHITE)
    d.text((rx + 52, ry + 46), kind, font=f_small, fill=MUTED)
    mw = d.textlength(mv, font=f_chip)
    d.text((rx + rw - 26 - mw, ry + 28), mv, font=f_chip, fill=col)
    ry += 92

out = Path(__file__).resolve().parent.parent / "web" / "public" / "og.png"
out.parent.mkdir(parents=True, exist_ok=True)
img.save(out, "PNG")
print(f"wrote {out} ({img.size[0]}x{img.size[1]})")
