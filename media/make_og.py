"""Generate web/public/og.png — the 1200x630 social share card for Turing Arena.

Brand: near-black bg (#0A0E12), Mantle teal accent (#7CF6C8). Clean, no weird
symbols / em-dashes. Run: python media/make_og.py
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG = (10, 14, 18)          # #0A0E12
TEAL = (124, 246, 200)     # #7CF6C8
WHITE = (245, 250, 249)
MUTED = (138, 160, 160)    # #8AA0A0
PANEL = (18, 28, 34)       # ink-800-ish
PANEL_BORDER = (26, 39, 47)
AI = (192, 132, 252)       # #C084FC

FONT_DIR = Path(r"C:\Windows\Fonts")


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_DIR / name), size)


f_brand = font("segoeuib.ttf", 94)       # big title (bold)
f_sub = font("segoeui.ttf", 38)          # subtitle (regular)
f_kicker = font("segoeuib.ttf", 26)      # small caps kicker
f_meta = font("segoeui.ttf", 27)         # bottom meta line
f_chip = font("segoeuib.ttf", 24)        # chip label

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# Subtle teal glow blob, top-right.
glow = Image.new("RGB", (W, H), BG)
gd = ImageDraw.Draw(glow)
gd.ellipse([W - 360, -240, W + 180, 300], fill=(16, 34, 30))
from PIL import ImageFilter
glow = glow.filter(ImageFilter.GaussianBlur(120))
img = Image.blend(img, glow, 0.6)
d = ImageDraw.Draw(img)

# Outer rounded border frame.
d.rounded_rectangle([24, 24, W - 24, H - 24], radius=28, outline=PANEL_BORDER, width=2)

MARGIN = 72

# Top-left kicker chip.
chip_text = "ERC-8004 - PROOF OF ALPHA"
cw = d.textlength(chip_text, font=f_kicker)
d.rounded_rectangle([MARGIN, 70, MARGIN + cw + 40, 70 + 48], radius=12,
                    fill=(14, 26, 24), outline=(20, 60, 50), width=2)
d.text((MARGIN + 20, 70 + 11), chip_text, font=f_kicker, fill=TEAL)

# Big brand title (two-tone could be nice but keep it crisp white).
TITLE_Y = 188
d.text((MARGIN, TITLE_Y), "TURING ARENA", font=f_brand, fill=WHITE)

# Teal accent underline, placed just under the title's actual glyph box.
title_bbox = d.textbbox((MARGIN, TITLE_Y), "TURING ARENA", font=f_brand)
title_w = title_bbox[2] - MARGIN
underline_y = title_bbox[3] + 14
d.rounded_rectangle([MARGIN, underline_y, MARGIN + title_w, underline_y + 8], radius=4, fill=TEAL)

# Subtitle.
d.text((MARGIN, 350), "The on-chain Turing Test for", font=f_sub, fill=MUTED)
d.text((MARGIN, 398), "trading intelligence", font=f_sub, fill=MUTED)

# "Can you beat the AI?" line with AI in accent.
y_q = 470
d.text((MARGIN, y_q), "Can you beat the ", font=f_sub, fill=WHITE)
x_after = MARGIN + d.textlength("Can you beat the ", font=f_sub)
d.text((x_after, y_q), "AI", font=f_sub, fill=AI)
x_after2 = x_after + d.textlength("AI", font=f_sub)
d.text((x_after2, y_q), "?", font=f_sub, fill=WHITE)

# Bottom meta line.
meta = "Mantle Sepolia  -  commit-reveal  -  verifiable reputation"
d.text((MARGIN, H - 96), meta, font=f_meta, fill=MUTED)

# Right-side stacked "agent rows" mini illustration.
rows = [
    ("Athena", "AI", "+1.8%", TEAL),
    ("Momentum Max", "AI", "+3.1%", TEAL),
    ("HODLer Hank", "YOU", "+0.9%", (251, 191, 36)),
]
rx, rw = W - 72 - 360, 360
ry = 188
for name, kind, mv, col in rows:
    d.rounded_rectangle([rx, ry, rx + rw, ry + 78], radius=14, fill=PANEL, outline=PANEL_BORDER, width=2)
    dot = (192, 132, 252) if kind == "AI" else (251, 191, 36)
    d.ellipse([rx + 22, ry + 33, rx + 34, ry + 45], fill=dot)
    d.text((rx + 50, ry + 16), name, font=f_chip, fill=WHITE)
    d.text((rx + 50, ry + 44), kind, font=font("segoeui.ttf", 19), fill=MUTED)
    mw = d.textlength(mv, font=f_chip)
    d.text((rx + rw - 26 - mw, ry + 28), mv, font=f_chip, fill=col)
    ry += 92

out = Path(__file__).resolve().parent.parent / "web" / "public" / "og.png"
out.parent.mkdir(parents=True, exist_ok=True)
img.save(out, "PNG")
print(f"wrote {out} ({img.size[0]}x{img.size[1]})")
