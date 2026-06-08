#!/usr/bin/env python3
"""
Turing Arena — polished 1080p demo video builder.

Pipeline (no external assets, copyright-clean):
  1. Pillow renders branded 1920x1080 scene cards (Mantle ink + teal palette).
  2. edge-tts (neural) narrates each scene -> mp3.
  3. ffmpeg builds a per-scene clip (still + gentle Ken-Burns zoom + fades),
     concatenates them, and mixes a soft self-generated ambient bed under the VO.

Usage:
  python build_video.py cards        # just render the PNG cards (fast QA)
  python build_video.py tts          # render cards + narration mp3s
  python build_video.py all          # full build -> media/video/turing-arena-demo.mp4
"""
import os, sys, subprocess, json, textwrap, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent
SCENES = ROOT / "scenes"
AUDIO = ROOT / "audio"
ASSETS = ROOT / "assets"
for d in (SCENES, AUDIO, ASSETS):
    d.mkdir(parents=True, exist_ok=True)

W, H = 1920, 1080
FPS = 30
VOICE = "en-US-AndrewNeural"   # warm, modern, confident
RATE = "+6%"

# ---- palette (cyberpunk dual-neon: cyan + magenta on blue-black) ----
BG       = (5, 6, 15)          # #05060f
BG2      = (8, 12, 28)
PANEL    = (11, 16, 36)
PANEL2   = (16, 23, 46)
LINE     = (27, 37, 71)
TEAL     = (61, 242, 255)      # primary neon cyan #3DF2FF (kept name)
TEAL_DK  = (24, 90, 110)
MAGENTA  = (255, 54, 198)      # hot magenta #FF36C6
TEXT     = (236, 243, 252)
MUTED    = (118, 134, 172)
GREEN    = (43, 255, 154)
RED      = (255, 69, 110)
GOLD     = (255, 197, 61)
BLUE     = (122, 160, 255)

# Display = Chakra Petch (techno, matches the web). Mono = Consolas (Windows).
FONT_DIR = ROOT / "fonts"
def font(name, size):
    return ImageFont.truetype("C:/Windows/Fonts/" + name, size)
def cfont(name, size):
    return ImageFont.truetype(str(FONT_DIR / name), size)
# families
def F_black(s):  return cfont("ChakraPetch-Bold.ttf", s)
def F_semi(s):   return cfont("ChakraPetch-SemiBold.ttf", s)
def F_reg(s):    return cfont("ChakraPetch-Medium.ttf", s)
def F_light(s):  return cfont("ChakraPetch-Regular.ttf", s)
def F_mono(s):   return font("consola.ttf", s)
def F_monob(s):  return font("consolab.ttf", s)

# ---------------------------------------------------------------- helpers
def base():
    """Blue-black canvas with a neon blueprint grid + cyan/magenta corner glows."""
    img = Image.new("RGB", (W, H), BG)
    # vertical gradient
    top = (9, 12, 30); bot = (4, 5, 12)
    grad = Image.new("RGB", (1, H))
    for y in range(H):
        t = y / H
        grad.putpixel((0, y), tuple(int(top[i] + (bot[i]-top[i])*t) for i in range(3)))
    img = grad.resize((W, H))
    # cyan glow top-left + magenta glow top-right
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-520, -680, 760, 420], fill=(61, 242, 255, 34))
    gd.ellipse([W - 760, -640, W + 520, 380], fill=(255, 54, 198, 26))
    glow = glow.filter(ImageFilter.GaussianBlur(170))
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
    # neon blueprint grid (cyan verticals, faint magenta horizontals)
    d = ImageDraw.Draw(img, "RGBA")
    for x in range(0, W, 64):
        d.line([(x, 0), (x, H)], fill=(61, 242, 255, 16))
    for y in range(0, H, 64):
        d.line([(0, y), (W, y)], fill=(255, 54, 198, 11))
    return img

def draw_tracking(d, xy, text, fnt, fill, track=0):
    """Draw text with letter-spacing."""
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=fnt, fill=fill)
        w = d.textlength(ch, font=fnt)
        x += w + track
    return x

def rounded(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)

def brandmark(d, x=120, y=92):
    # teal tick + wordmark
    d.rounded_rectangle([x, y, x+10, y+34], radius=3, fill=TEAL)
    draw_tracking(d, (x+28, y+2), "TURING ARENA", F_semi(28), TEXT, track=6)

def chip(d, x, y, text, fg=TEAL, bg=(124,246,200,28), fnt=None):
    fnt = fnt or F_semi(24)
    w = d.textlength(text, font=fnt)
    rounded(d, [x, y, x+w+36, y+44], 22, fill=bg)
    d.text((x+18, y+8), text, font=fnt, fill=fg)
    return x + w + 36

def wrap(d, text, fnt, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=fnt) <= max_w:
            cur = t
        else:
            lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def save(img, name):
    p = SCENES / name
    img.save(p, "PNG")
    print("  card:", p.name)
    return p

# ---------------------------------------------------------------- scenes
def scene_title():
    img = base(); d = ImageDraw.Draw(img, "RGBA")
    brandmark(d)
    chip(d, 120, 150, "MANTLE TURING TEST HACKATHON 2026")
    # giant wordmark
    big = F_black(150)
    d.text((116, 360), "TURING", font=big, fill=TEXT)
    d.text((116, 510), "ARENA", font=big, fill=TEAL)
    d.rectangle([124, 690, 520, 698], fill=TEAL)
    sub = F_light(46)
    d.text((124, 730), "The on-chain Turing Test for trading intelligence.", font=sub, fill=TEXT)
    d.text((124, 792), "AI agents and humans. Commit-reveal. ERC-8004. On Mantle.", font=F_light(36), fill=MUTED)
    return save(img, "s1_title.png")

def scene_problem():
    img = base(); d = ImageDraw.Draw(img, "RGBA")
    brandmark(d)
    chip(d, 120, 150, "THE PROBLEM", fg=RED, bg=(255,107,107,26))
    head = F_black(78)
    for i, ln in enumerate(['Every "my AI makes 200% APY"', 'is unverifiable.']):
        d.text((120, 250 + i*92), ln, font=head, fill=TEXT)
    items = [
        ("Cherry-picked screenshots", "a winning trade is easy to show; the losing ones vanish."),
        ("Backfilled backtests", "tuned on the very data they claim to predict."),
        ("Survivorship bias", "the blown-up accounts never post."),
    ]
    y = 500
    for t, s in items:
        d.ellipse([124, y+14, 140, y+30], outline=RED, width=3)
        d.text((168, y), t, font=F_semi(40), fill=TEXT)
        d.text((168, y+54), s, font=F_reg(30), fill=MUTED)
        y += 150
    return save(img, "s2_problem.png")

def step_card(d, x, y, w, h, n, title, body, accent=TEAL):
    rounded(d, [x, y, x+w, y+h], 22, fill=PANEL, outline=LINE, width=2)
    # number badge (top-left), number centered in it
    d.ellipse([x+30, y+30, x+78, y+78], outline=accent, width=3)
    num = str(n); nb = d.textbbox((0, 0), num, font=F_monob(30))
    d.text((x+54-(nb[2]-nb[0])/2, y+39), num, font=F_monob(30), fill=accent)
    # title spans full card width BELOW the badge (so it never collides with the number)
    tfont = F_semi(31)
    tlines = wrap(d, title, tfont, w-64)
    ty = y + 100
    for i, ln in enumerate(tlines):
        d.text((x+32, ty + i*40), ln, font=tfont, fill=TEXT)
    # body starts below the wrapped title — dynamic, so no overlap regardless of title length
    yy = ty + len(tlines)*40 + 16
    for ln in wrap(d, body, F_reg(25), w-60):
        d.text((x+32, yy), ln, font=F_reg(25), fill=MUTED); yy += 33

def scene_protocol():
    img = base(); d = ImageDraw.Draw(img, "RGBA")
    brandmark(d)
    chip(d, 120, 150, "THE PROTOCOL · PROOF-OF-ALPHA")
    d.text((120, 234), "Skill, made unfakeable.", font=F_black(76), fill=TEXT)
    cards = [
        (1, "Mint an ERC-8004 identity", "AI or human, one on-chain agent NFT with a portable track record.", TEAL),
        (2, "Commit a sealed prediction", "keccak(direction, size, rationale, salt). Nobody can peek, copy, or change it.", BLUE),
        (3, "Settle vs a Merchant Moe oracle", "the realized move is read from a transparent DEX oracle and scored on-chain.", GOLD),
        (4, "Reputation, attested on-chain", "a neutral contract writes the result to the ERC-8004 Reputation Registry.", GREEN),
    ]
    gap = 30; cw = (W - 240 - gap*3)//4; ch = 430; x0 = 120; y0 = 380
    for i, (n, t, b, a) in enumerate(cards):
        step_card(d, x0 + i*(cw+gap), y0, cw, ch, n, t, b, a)
    d.text((120, 860), "No capital at risk. Alpha is just directional accuracy and conviction. Pure skill.",
           font=F_reg(33), fill=MUTED)
    return save(img, "s3_protocol.png")

def _term_line(d, x, y, segs, fnt):
    for txt, col in segs:
        d.text((x, y), txt, font=fnt, fill=col)
        x += d.textlength(txt, font=fnt)

def scene_demo():
    img = base(); d = ImageDraw.Draw(img, "RGBA")
    brandmark(d)
    chip(d, 120, 150, "LIVE KEYLESS DEMO    ( pnpm demo )", fg=TEAL)
    d.text((120, 226), "Five agents. Three rounds. One scoreboard.", font=F_black(64), fill=TEXT)
    # terminal window
    tx, ty, tw, th = 120, 330, 1680, 660
    rounded(d, [tx, ty, tx+tw, ty+th], 18, fill=(6, 9, 12), outline=LINE, width=2)
    for i, c in enumerate([RED, GOLD, GREEN]):
        d.ellipse([tx+28+i*34, ty+24, tx+48+i*34, ty+44], fill=c)
    d.text((tx+150, ty+22), "turing-arena  proof-of-alpha benchmark", font=F_mono(24), fill=MUTED)
    m = F_mono(26); mb = F_monob(26)
    x = tx+40; y = ty+78; lh = 40
    rows = [
        [("ROUND 3/3  ", TEAL), ("mETH/USD   entry $3050", MUTED)],
        [("  signals  ", MUTED), ("allora +0.78  nansen +0.66  on-chain +0.58  surf +0.45", TEXT)],
        [("  commit   ", BLUE), ("keccak(prediction) sealed, nobody can see it", MUTED)],
        [("  reveal   ", TEAL), ("Athena up +3.72% c73   Momentum up +6.00% c100   Cora down -4.09%", TEXT)],
        [("  settle   ", GOLD), ("realized ", MUTED), ("+4.00%", GREEN), ("  (Merchant Moe oracle)", MUTED)],
        [("    Momentum Max  +400", GREEN), ("   wrote ERC-8004 reputation", MUTED)],
        [("    Contrarian Cora -312", RED), ("   wrote ERC-8004 reputation", MUTED)],
    ]
    for segs in rows:
        _term_line(d, x, y, segs, m); y += lh
    y += 14
    d.line([(tx+40, y), (tx+tw-40, y)], fill=LINE, width=2); y += 22
    _term_line(d, x, y, [("FINAL LEADERBOARD  ", GOLD), ("cumulative verified alpha", MUTED)], mb); y += lh+6
    board = [
        ("1", "[AI] Momentum Max", "+438", "67%", GOLD),
        ("2", "[AI] Allora Scout", "+365", "67%", TEXT),
        ("3", "[AI] Athena", "+307", "67%", TEXT),
        ("4", "[HUMAN] HODLer Hank", "+225", "67%", BLUE),
        ("5", "[AI] Contrarian Cora", "-330", "33%", MUTED),
    ]
    for rank, name, pts, acc, col in board:
        _term_line(d, x, y, [(f"  {rank}  ", col), (f"{name:<26}", col),
                             (f"{pts:>6} pts", GREEN if not pts.startswith('-') else RED),
                             (f"   {acc} acc", MUTED)], m); y += lh
    return save(img, "s4_demo.png")

def scene_onchain():
    img = base(); d = ImageDraw.Draw(img, "RGBA")
    brandmark(d)
    chip(d, 120, 150, "PROVEN ON-CHAIN, MANTLE SEPOLIA 5003", fg=TEAL)
    d.text((120, 226), "Not a mockup. A real round, settled on Mantle.", font=F_black(62), fill=TEXT)
    steps = [
        ("openRound", "mETH/USD priced off the Merchant Moe oracle", TEAL),
        ("commit", "sealed keccak(prediction), on the record", BLUE),
        ("reveal", "up  +3.00%  at conviction 80", BLUE),
        ("settle", "oracle reads +5.00%, scores +400, writes ERC-8004 reputation", GOLD),
        ("executeChampionTrade", "copy-trade the verified champion via a Merchant Moe-compatible LB router", GREEN),
    ]
    x = 150; y = 360; r = 16
    for i, (t, s, c) in enumerate(steps):
        d.ellipse([x-r, y-r, x+r, y+r], outline=c, width=4)
        d.ellipse([x-5, y-5, x+5, y+5], fill=c)
        if i < len(steps)-1:
            d.line([(x, y+r+4), (x, y+118-r)], fill=LINE, width=3)
        d.text((x+50, y-34), t, font=F_monob(34), fill=c)
        d.text((x+50, y+8), s, font=F_reg(28), fill=MUTED)
        y += 118
    # result panel
    px, py, pw, ph = 1140, 360, 660, 560
    rounded(d, [px, py, px+pw, py+ph], 20, fill=PANEL, outline=LINE, width=2)
    d.text((px+40, py+34), "READ BACK FROM CHAIN", font=F_semi(26), fill=TEAL)
    stats = [
        ("realizedBps(round)", "+500"),
        ("agent #1 score", "+400"),
        ("hit-rate", "50.00%  (1/2)"),
        ("vault mETH", "5 to 6"),
        ("vault USDY", "10000 to 9999"),
    ]
    yy = py+100
    for k, v in stats:
        d.text((px+40, yy), k, font=F_reg(30), fill=MUTED)
        d.text((px+pw-40 - d.textlength(v, font=F_monob(32)), yy-2), v, font=F_monob(32), fill=GREEN)
        yy += 64
    d.line([(px+40, yy+6), (px+pw-40, yy+6)], fill=LINE, width=2)
    d.text((px+40, yy+26), "champion swap tx", font=F_reg(26), fill=MUTED)
    d.text((px+40, yy+62), "0x74d0524c…a391e", font=F_mono(30), fill=TEAL)
    return save(img, "s5_onchain.png")

def scene_ui(shot=None):
    """Faithful 1080p recreation of the live arena (turing-arena-web.vercel.app)."""
    img = base(); d = ImageDraw.Draw(img, "RGBA")
    # browser chrome filling most of the frame
    fx, fy, fw, fh = 70, 70, 1780, 940
    rounded(d, [fx, fy, fx+fw, fy+fh], 18, fill=(10, 14, 18), outline=LINE, width=2)
    for i, c in enumerate([RED, GOLD, GREEN]):
        d.ellipse([fx+28+i*32, fy+24, fx+48+i*32, fy+44], fill=c)
    rounded(d, [fx+150, fy+16, fx+fw-40, fy+52], 17, fill=(6, 9, 12))
    d.text((fx+172, fy+23), "🔒 turing-arena-web.vercel.app".replace("🔒 ", ""), font=F_mono(24), fill=MUTED)
    # site nav bar
    nx, ny, nw = fx+18, fy+78, fw-36
    rounded(d, [nx, ny, nx+nw, ny+62], 12, fill=(9, 13, 17))
    d.rounded_rectangle([nx+28, ny+18, nx+44, ny+44], radius=4, outline=TEAL, width=3)
    d.text((nx+60, ny+16), "TuringArena", font=F_semi(28), fill=TEXT)
    chip(d, nx+250, ny+12, "on Mantle", fnt=F_reg(20))
    for i, t in enumerate(["Arena", "Leaderboard", "How it works", "GitHub"]):
        d.text((nx+560 + i*150, ny+18), t, font=F_reg(24), fill=MUTED)
    rounded(d, [nx+nw-200, ny+10, nx+nw-20, ny+52], 21, fill=TEAL)
    d.text((nx+nw-176, ny+18), "Connect Wallet", font=F_semi(22), fill=(8, 12, 16))
    # hero left
    hx = fx+60; hy = ny+120
    d.text((hx, hy), "THE ON-CHAIN TURING TEST FOR TRADING INTELLIGENCE", font=F_semi(22), fill=TEAL)
    d.text((hx, hy+44), "Can you beat", font=F_black(82), fill=TEXT)
    d.text((hx, hy+136), "the ", font=F_black(82), fill=TEXT)
    d.text((hx+150, hy+136), "AI?", font=F_black(82), fill=(176, 130, 255))
    for i, ln in enumerate(["Permissionless benchmark on Mantle. AI agents and humans",
                            "publish predictions they can't take back, settle vs a",
                            "transparent oracle, and earn verifiable ERC-8004 reputation."]):
        d.text((hx, hy+264 + i*38), ln, font=F_reg(28), fill=MUTED)
    rounded(d, [hx, hy+400, hx+250, hy+456], 12, fill=TEAL)
    d.text((hx+40, hy+412), "Enter the Arena →", font=F_semi(24), fill=(8,12,16))
    rounded(d, [hx+270, hy+400, hx+470, hy+456], 12, fill=PANEL, outline=LINE, width=2)
    d.text((hx+310, hy+412), "How it works", font=F_semi(24), fill=TEXT)
    chip(d, hx, hy+490, "● Live on Mantle Sepolia", fg=GREEN, bg=(46,230,166,24), fnt=F_reg(22))
    # live-round panel right
    px, py, pw, ph = fx+940, ny+120, 740, 330
    rounded(d, [px, py, px+pw, py+ph], 16, fill=(13, 19, 26), outline=LINE, width=2)
    d.text((px+28, py+22), "mETH/USD · live round", font=F_reg(24), fill=MUTED)
    chip(d, px+pw-200, py+16, "● commit open", fg=TEAL, bg=(124,246,200,22), fnt=F_reg(20))
    agents = [("Athena", "▲ +1.8%", "82", BLUE), ("Momentum Max", "▲ +3.1%", "64", BLUE),
              ("HODLer Hank", "▲ +0.9%", "40", GOLD), ("Contrarian Cora", "▼ -1.2%", "55", BLUE)]
    yy = py+70
    for name, mv, conf, col in agents:
        d.ellipse([px+28, yy+6, px+52, yy+30], fill=PANEL2, outline=col, width=2)
        d.text((px+68, yy+2), name, font=F_semi(26), fill=TEXT)
        mvc = GREEN if mv.startswith("▲") else RED
        d.text((px+pw-260, yy+2), mv, font=F_mono(26), fill=mvc)
        d.text((px+pw-110, yy+4), f"conf {conf}", font=F_mono(22), fill=MUTED)
        yy += 56
    # winner strip (real on-chain round)
    wy = py+ph+30
    rounded(d, [px, wy, px+pw, wy+70], 12, fill=(28, 26, 12), outline=GOLD, width=2)
    d.text((px+28, wy+18), "Winner: agent #1", font=F_semi(28), fill=GOLD)
    d.text((px+330, wy+18), "+400 alpha", font=F_monob(28), fill=GREEN)
    d.text((px+540, wy+22), "settled on-chain", font=F_reg(22), fill=MUTED)
    save(img, "s6_ui.png")
    return SCENES / "s6_ui.png"

def scene_close():
    img = base(); d = ImageDraw.Draw(img, "RGBA")
    brandmark(d)
    d.text((120, 300), "The leaderboard", font=F_black(110), fill=TEXT)
    d.text((120, 430), "is the Turing Test.", font=F_black(110), fill=TEAL)
    d.rectangle([128, 600, 560, 608], fill=TEAL)
    d.text((128, 648), "Can you beat the AI?", font=F_light(52), fill=TEXT)
    rows = [
        ("Live arena", "turing-arena-web.vercel.app"),
        ("Code", "github.com/lingjieheti-ops/turing-arena"),
        ("Network", "Mantle Sepolia,  ERC-8004,  Merchant Moe"),
    ]
    y = 760
    for k, v in rows:
        d.text((128, y), k, font=F_semi(30), fill=MUTED)
        d.text((360, y), v, font=F_mono(30), fill=TEAL)
        y += 56
    chip(d, 128, y+10, "#MantleAIHackathon", fg=TEAL)
    return save(img, "s7_close.png")

# scene list: (id, render_fn, narration)
def narration_for():
    return {
        "s1_title":   "This is Turing Arena — the on-chain Turing Test for trading intelligence, built on Mantle.",
        "s2_problem": "Every 'my A-I makes two hundred percent a year' claim in crypto is unverifiable. Cherry-picked screenshots. Backfilled backtests. The blown-up accounts never post.",
        "s3_protocol":"Turing Arena fixes it. An agent — A-I or human — mints an ERC-8004 identity, then commits a sealed prediction nobody can see or change. After the horizon, the realized move is read from a live oracle and scored on-chain, and the result is attested to its ERC-8004 reputation. No capital at risk — just skill.",
        "s4_demo":    "Here's the keyless demo. Five agents publish commit-revealed calls across three rounds, including a trap round where social hype marks the top. Scored by the exact on-chain formula, the multi-signal A-I compounds an edge and beats the best human, on the record.",
        "s5_onchain": "And it's real. On Mantle Sepolia, an agent committed, revealed, and settled against the Merchant Moe oracle at plus five percent — scored, and written to ERC-8004 reputation. Then the Champion Vault copy-traded the verified winner through a Merchant Moe-compatible LB router.",
        "s6_ui":      "A polished arena lets anyone spawn an agent, commit a prediction, and climb a leaderboard you can finally trust.",
        "s7_close":   "Turing Arena. The leaderboard is the Turing Test. Can you beat the A-I?",
    }

ORDER = ["s1_title","s2_problem","s3_protocol","s4_demo","s5_onchain","s6_ui","s7_close"]

def render_all_cards(ui_shot=None):
    scene_title(); scene_problem(); scene_protocol(); scene_demo()
    scene_onchain(); scene_ui(ui_shot); scene_close()

def tts():
    nar = narration_for()
    for sid, text in nar.items():
        out = AUDIO / f"{sid}.mp3"
        cmd = [sys.executable, "-m", "edge_tts", "--voice", VOICE, "--rate", RATE,
               "--text", text, "--write-media", str(out)]
        print("  tts:", sid)
        subprocess.run(cmd, check=True)

def ffprobe_dur(p):
    out = subprocess.run(["ffprobe","-v","quiet","-show_entries","format=duration",
                          "-of","json", str(p)], capture_output=True, text=True).stdout
    return float(json.loads(out)["format"]["duration"])

def build_clip(sid, idx):
    png = SCENES / f"{sid}.png"
    vo = AUDIO / f"{sid}.mp3"
    dur = ffprobe_dur(vo) + 1.0
    out = ASSETS / f"clip_{idx:02d}.mp4"
    # STATIC frame (no ken-burns) — gentle fade in/out only, no swaying
    vf = (f"scale={W}:{H},format=yuv420p,"
          f"fade=t=in:st=0:d=0.4,fade=t=out:st={dur-0.4:.2f}:d=0.4")
    af = f"afade=t=in:st=0:d=0.25,afade=t=out:st={dur-0.4:.2f}:d=0.4,apad=whole_dur={dur}"
    cmd = ["ffmpeg","-y","-loop","1","-i",str(png),"-i",str(vo),
           "-filter_complex",f"[0:v]{vf}[v];[1:a]{af}[a]",
           "-map","[v]","-map","[a]","-t",f"{dur:.2f}","-r",str(FPS),
           "-c:v","libx264","-preset","medium","-crf","18","-pix_fmt","yuv420p",
           "-c:a","aac","-b:a","192k", str(out)]
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"  clip {idx}: {sid}  {dur:.1f}s")
    return out, dur

def build():
    clips, total = [], 0.0
    for i, sid in enumerate(ORDER):
        c, dur = build_clip(sid, i)
        clips.append(c); total += dur
    # concat — bare filenames + cwd=ASSETS so ffmpeg never reads a non-ASCII path
    # from the list file (the concat demuxer chokes on CJK paths on Windows).
    lst = ASSETS / "concat.txt"
    lst.write_text("".join(f"file '{c.name}'\n" for c in clips), encoding="utf-8")
    joined = ASSETS / "joined.mp4"
    subprocess.run(["ffmpeg","-y","-f","concat","-safe","0","-i","concat.txt",
                    "-c","copy","joined.mp4"], check=True, capture_output=True, cwd=str(ASSETS))
    # ambient bed: three soft detuned pads, heavy lowpass, slow tremolo, low volume
    dur = ffprobe_dur(joined)
    subprocess.run(["ffmpeg","-y",
                    "-f","lavfi","-i","sine=frequency=110:sample_rate=44100",
                    "-f","lavfi","-i","sine=frequency=164.81:sample_rate=44100",
                    "-f","lavfi","-i","sine=frequency=220:sample_rate=44100",
                    "-filter_complex",
                    "[0]lowpass=f=520,tremolo=f=0.13:d=0.6,volume=0.05[a1];"
                    "[1]lowpass=f=600,volume=0.03[a2];"
                    "[2]lowpass=f=700,volume=0.018[a3];"
                    "[a1][a2][a3]amix=inputs=3:duration=longest,aecho=0.8:0.7:70:0.25,volume=2.2[bed]",
                    "-map","[bed]","-t",f"{dur:.2f}","-c:a","aac","-b:a","160k","bed.m4a"],
                   check=True, capture_output=True, cwd=str(ASSETS))
    # mux: VO at full level + subtle bed (normalize=0 keeps the voice from being attenuated)
    final = ROOT / "turing-arena-demo.mp4"
    subprocess.run(["ffmpeg","-y","-i","joined.mp4","-i","bed.m4a",
                    "-filter_complex","[0:a]volume=1.0[vo];[1:a]volume=1.0[bd];"
                    "[vo][bd]amix=inputs=2:duration=first:normalize=0[a]",
                    "-map","0:v","-map","[a]","-c:v","copy","-c:a","aac","-b:a","192k",
                    str(final)], check=True, capture_output=True, cwd=str(ASSETS))
    print(f"\n[done] {final}  ({dur:.1f}s)")
    return final

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    ui = sys.argv[2] if len(sys.argv) > 2 else None
    render_all_cards(ui)
    if mode in ("tts","all"): tts()
    if mode == "all": build()
