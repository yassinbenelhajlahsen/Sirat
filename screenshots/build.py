#!/usr/bin/env python3
"""Builds the App Store screenshots and showcase from raw simulator captures.

Raw iPhone 17 Pro Max captures (1320x2868) live in source/. Retake one, keep
its file name, and run:  python3 screenshots/build.py
Pop-out boxes are in capture pixels, so a retake that moves a card means
updating its box below. Needs Pillow and the SF Pro fonts in /Library/Fonts.
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "source"
OUT = ROOT / "iphone"
W, H = 1290, 2796  # 6.7" size, matching the Qibla and mosque images we keep
BLACK_FONT = "/Library/Fonts/SF-Pro-Display-Black.otf"
REGULAR_FONT = "/Library/Fonts/SF-Pro-Display-Regular.otf"
SS = 3  # Pillow draws shapes without anti-aliasing, so masks are drawn large and shrunk

GOLD_MID = (214, 160, 64)
GOLD_EDGE = (132, 92, 28)


def smooth_mask(size, draw):
    big = Image.new("L", (size[0] * SS, size[1] * SS), 0)
    draw(ImageDraw.Draw(big), SS)
    return big.resize(size, Image.LANCZOS)


def rounded_mask(size, radius):
    return smooth_mask(size, lambda d, s: d.rounded_rectangle(
        (0, 0, size[0] * s - 1, size[1] * s - 1), radius * s, fill=255))


def circle_mask(size):
    return smooth_mask(size, lambda d, s: d.ellipse((0, 0, size[0] * s - 1, size[1] * s - 1), fill=255))


def background(w=W, h=H, mid=GOLD_MID, edge=GOLD_EDGE, color=(255, 226, 150, 46), tile=300):
    falloff = Image.radial_gradient("L").resize((w, h), Image.BICUBIC)
    falloff = falloff.point(lambda v: min(255, int(v * 1.25)))
    bg = Image.composite(Image.new("RGB", (w, h), edge), Image.new("RGB", (w, h), mid), falloff)

    lines = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(lines)
    width = 6

    def star(cx, cy, r):
        for turn in (0, 45):
            pts = [(cx + r * math.cos(math.radians(a + turn)), cy + r * math.sin(math.radians(a + turn)))
                   for a in (45, 135, 225, 315)]
            d.polygon(pts, outline=color, width=width)

    step = tile * 2
    for gy in range(-1, h * 2 // step + 2):
        for gx in range(-1, w * 2 // step + 2):
            cx, cy = gx * step + (step // 2 if gy % 2 else 0), gy * step
            star(cx, cy, step * 0.36)
            star(cx, cy, step * 0.20)
            for a in range(0, 360, 45):
                x0 = cx + step * 0.36 * math.cos(math.radians(a))
                y0 = cy + step * 0.36 * math.sin(math.radians(a))
                x1 = cx + step * 0.58 * math.cos(math.radians(a))
                y1 = cy + step * 0.58 * math.sin(math.radians(a))
                d.line((x0, y0, x1, y1), fill=color, width=width)
    lines = lines.resize((w, h), Image.LANCZOS)
    bg = bg.convert("RGBA")
    bg.alpha_composite(lines)
    return bg


def phone(capture, screen_w):
    """Returns the framed phone and the screen's offset inside it."""
    scale = screen_w / capture.width
    screen = capture.resize((screen_w, round(capture.height * scale)), Image.LANCZOS)
    sw, sh = screen.size
    bezel, rim, button = round(sw * 0.024), round(sw * 0.016), round(sw * 0.006)
    r_screen = round(sw * 0.135)
    pad = bezel + rim
    ow, oh = sw + 2 * pad, sh + 2 * pad
    canvas = Image.new("RGBA", (ow + 2 * button, oh), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)

    titanium = (78, 68, 62, 255)
    for x, y0, y1 in ((0, 0.20, 0.25), (0, 0.29, 0.36), (0, 0.38, 0.45), (ow + button, 0.30, 0.41)):
        d.rounded_rectangle((x, oh * y0, x + button * 2, oh * y1), button, fill=titanium)

    body = Image.new("RGBA", (ow, oh), titanium)
    shade = Image.linear_gradient("L").resize((ow, oh)).point(lambda v: v // 3)
    body = Image.composite(Image.new("RGBA", (ow, oh), (34, 30, 28, 255)), body, shade)
    edge = Image.new("RGBA", (ow, oh), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle((1, 1, ow - 2, oh - 2), r_screen + pad, outline=(170, 155, 145, 200), width=3)
    body.alpha_composite(edge)
    canvas.paste(body, (button, 0), rounded_mask((ow, oh), r_screen + pad))

    black = Image.new("RGBA", (sw + 2 * bezel, sh + 2 * bezel), (6, 6, 6, 255))
    canvas.paste(black, (button + rim, rim), rounded_mask(black.size, r_screen + bezel))
    canvas.paste(screen, (button + pad, pad), rounded_mask(screen.size, r_screen))
    return canvas, (button + pad, pad), scale


def drop_shadow(img, blur, alpha, offset=(0, 30)):
    shadow = Image.new("RGBA", (img.width + blur * 4, img.height + blur * 4), (0, 0, 0, 0))
    a = img.getchannel("A").point(lambda v: v * alpha // 255)
    shadow.paste(Image.new("RGBA", img.size, (20, 12, 0, 255)), (blur * 2 + offset[0], blur * 2 + offset[1]), a)
    return shadow.filter(ImageFilter.GaussianBlur(blur)), blur * 2


def place(base, img, x, y, blur=40, alpha=140):
    shadow, pad = drop_shadow(img, blur, alpha)
    base.alpha_composite(shadow, (int(x - pad), int(y - pad)))
    base.alpha_composite(img, (int(x), int(y)))


def headline(base, big, small, small_size=128, top=110):
    d = ImageDraw.Draw(base)
    y = top
    for i, text in enumerate([big] + small):
        size = 300 if i == 0 else small_size
        font = ImageFont.truetype(BLACK_FONT, size)
        while d.textlength(text, font=font) > W - 120:
            size -= 4
            font = ImageFont.truetype(BLACK_FONT, size)
        left, top_px, right, bottom = d.textbbox((0, 0), text, font=font)
        x = (W - (right - left)) / 2 - left
        layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).text((x, y - top_px + 6), text, font=font, fill=(60, 35, 0, 110))
        base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(10)))
        ImageDraw.Draw(base).text((x, y - top_px), text, font=font, fill="white")
        y += (bottom - top_px) + (60 if i == 0 else 22)


def pop_out(base, capture, box, phone_xy, screen_xy, scale, out_w, circle=False):
    """Crops box from the capture, enlarges it to out_w and floats it over its spot on the phone."""
    crop = capture.crop(box)
    out_h = round(crop.height * out_w / crop.width)
    card = crop.resize((out_w, out_h), Image.LANCZOS).convert("RGBA")
    mask = circle_mask(card.size) if circle else rounded_mask(card.size, round(out_w * 0.05))
    border = Image.new("RGBA", card.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(border)
    if circle:
        bd.ellipse((1, 1, out_w - 2, out_h - 2), outline=(255, 255, 255, 40), width=3)
    else:
        bd.rounded_rectangle((1, 1, out_w - 2, out_h - 2), round(out_w * 0.05), outline=(255, 255, 255, 40), width=3)
    card.alpha_composite(border)
    card.putalpha(mask)
    cx = phone_xy[0] + screen_xy[0] + (box[0] + box[2]) / 2 * scale
    cy = phone_xy[1] + screen_xy[1] + (box[1] + box[3]) / 2 * scale
    place(base, card, cx - out_w / 2, cy - out_h / 2, blur=34, alpha=170)


def feature(name, capture_name, big, small, box, out_w, circle=False):
    base = background()
    headline(base, big, small)
    capture = Image.open(SRC / capture_name).convert("RGB")
    framed, screen_xy, scale = phone(capture, 980)
    xy = ((W - framed.width) // 2, 700)
    place(base, framed, *xy)
    pop_out(base, capture, box, xy, screen_xy, scale, out_w, circle)
    base.convert("RGB").save(OUT / name, quality=92)


def themes():
    base = background()
    headline(base, "CHOOSE", ["YOUR THEME"], small_size=170, top=150)
    phones = {k: phone(Image.open(SRC / f"home-{k}.png").convert("RGB"), w)
              for k, w in (("green", 700), ("light", 700), ("dark", 800))}
    for key, cx, y in (("green", 140, 1000), ("light", W - 140, 1000), ("dark", W // 2, 900)):
        framed = phones[key][0]
        place(base, framed, cx - framed.width // 2, y, blur=50, alpha=170)
    base.convert("RGB").save(OUT / "06-choose-your-theme.jpg", quality=92)


def showcase():
    panel_w, panel_h, gap, margin = 369, 800, 40, 60
    sheet = Image.new("RGB", (1307, 1020), "white")
    for i, name in enumerate(("01-never-miss-a-prayer.jpg", "02-read-the-quran-anywhere.jpg",
                              "03-find-the-qibla-instantly.jpg")):
        img = Image.open(OUT / name).convert("RGB").resize((panel_w, round(panel_w * H / W)), Image.LANCZOS)
        sheet.paste(img.crop((0, 0, panel_w, panel_h)), (margin + i * (panel_w + gap), margin))
    d = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(REGULAR_FONT, 46)
    text = "github.com/yassinbenelhajlahsen"
    d.text(((sheet.width - d.textlength(text, font=font)) / 2, 885), text, font=font, fill="black")
    sheet.save(ROOT / "showcase.png")


def medium_set():
    """App Store Connect always requires the medium Dynamic Island slot, which rejects 1290x2796."""
    out = ROOT / "iphone-medium"
    out.mkdir(exist_ok=True)
    for path in sorted(OUT.glob("*.jpg")):
        ImageOps.fit(Image.open(path), (1206, 2622), Image.LANCZOS).save(out / path.name, quality=92)


if __name__ == "__main__":
    feature("01-never-miss-a-prayer.jpg", "home-green.png", "NEVER", ["MISS A PRAYER"],
            box=(177, 659, 1145, 1627), out_w=900, circle=True)
    feature("02-read-the-quran-anywhere.jpg", "quran.png", "READ", ["THE QURAN", "ANYWHERE"],
            box=(0, 1004, 1320, 1521), out_w=1180)
    feature("04-get-a-dua-for-any-moment.jpg", "dua.png", "GET", ["A DUA FOR ANY", "MOMENT"],
            box=(60, 1030, 1260, 2407), out_w=1150)
    themes()
    showcase()
    medium_set()
    print("built 01, 02, 04, 06, showcase.png and the 1206x2622 set in iphone-medium/")
