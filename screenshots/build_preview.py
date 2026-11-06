#!/usr/bin/env python3
"""Builds the App Store preview video (886x1920, 30 fps) from a phone screen recording.

    python3 screenshots/build_preview.py ~/Downloads/ScreenRecording.mov

Each section plays a slice of the recording inside a phone frame under a caption,
with crossfades, an intro and an outro. SECTIONS holds the slices in recording
seconds, so a new recording means new times there. Needs ffmpeg and Pillow.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

from build import background, rounded_mask

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "iphone" / "sirat_preview_6.9.mov"
W, H = 886, 1920
OPTIMA = "/System/Library/Fonts/Optima.ttc"
ITALIC, BOLD_ITALIC = 2, 3
GOLD = (212, 172, 84)
FADE = 0.5
INTRO, OUTRO = 2.0, 3.0

SCREEN_X, SCREEN_Y, SCREEN_W = 170, 373, 546
SCREEN_H = round(SCREEN_W * 2868 / 1320 / 2) * 2
BEZEL = 18

# caption top line, caption bottom line, start, end, seconds to hold the last frame
SECTIONS = [
    ("NEVER", "MISS A PRAYER", 0.0, 3.4, 0),
    ("GET A DUA", "FOR ANY MOMENT", 4.8, 8.3, 1.0),
    ("READ", "THE QURAN ANYWHERE", 9.6, 16.2, 0),
    ("FIND", "THE QIBLA INSTANTLY", 16.6, 19.6, 0),
    ("FIND", "MOSQUES NEAR YOU", 22.4, 26.1, 1.0),
]


def font(size, face):
    return ImageFont.truetype(OPTIMA, size, index=face)


def green():
    return background(W, H, mid=(20, 46, 31), edge=(5, 19, 12), color=(190, 160, 80, 18), tile=110)


def text(base, words, y, size, face, fill, max_w=W - 100, spacing=0, shadow=True):
    """Draws centered text with its top at y and returns the bottom."""
    f = font(size, face)
    d = ImageDraw.Draw(base)
    width = lambda: d.textlength(words, font=f) + spacing * (len(words) - 1)
    while width() > max_w:
        size -= 2
        f = font(size, face)
    left, top, _, bottom = d.textbbox((0, 0), words, font=f)
    x, y0 = (W - width()) / 2 - left, y - top

    def draw(dr, x, y, color):
        if spacing:
            for ch in words:
                dr.text((x, y), ch, font=f, fill=color)
                x += dr.textlength(ch, font=f) + spacing
        else:
            dr.text((x, y), words, font=f, fill=color)

    if shadow:
        layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
        draw(ImageDraw.Draw(layer), x + 3, y0 + 5, (0, 0, 0, 170))
        base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(4)))
    draw(d, x, y0, fill)
    return y + (bottom - top)


def section_backdrop(top_line, bottom_line):
    base = green()
    y = text(base, top_line, 120, 108, BOLD_ITALIC, "white")
    text(base, bottom_line, y + 30, 86, BOLD_ITALIC, GOLD)
    text(base, "SIRAT", 1690, 60, ITALIC, GOLD + (200,), shadow=False)
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (SCREEN_X - BEZEL, SCREEN_Y - BEZEL + 24, SCREEN_X + SCREEN_W + BEZEL, SCREEN_Y + SCREEN_H + BEZEL + 24),
        100, fill=(0, 0, 0, 160))
    base.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(30)))
    return base


def section_layer(top_line, bottom_line):
    """The whole section (backdrop, caption, phone) as one layer, transparent only where the video plays.

    Drawing everything on top hides the recording's square corners behind the rounded screen.
    """
    base = section_backdrop(top_line, bottom_line)
    ow, oh = SCREEN_W + 2 * BEZEL, SCREEN_H + 2 * BEZEL
    body = Image.new("RGBA", (ow, oh), (14, 14, 14, 255))
    ImageDraw.Draw(body).rounded_rectangle((1, 1, ow - 2, oh - 2), 97, outline=(150, 122, 62, 255), width=3)
    base.paste(body, (SCREEN_X - BEZEL, SCREEN_Y - BEZEL), rounded_mask((ow, oh), 98))
    hole = Image.new("L", (W, H), 0)
    hole.paste(rounded_mask((SCREEN_W, SCREEN_H), 80), (SCREEN_X, SCREEN_Y))
    base.putalpha(ImageChops.invert(hole))
    return base


def recording_pill():
    """Black pill over the Dynamic Island, hiding the red screen-recording dot, at recording size."""
    s, (x0, y0, x1, y1) = 4, (380, 32, 920, 161)
    big = Image.new("RGBA", (1320 * s, 200 * s), (0, 0, 0, 0))
    ImageDraw.Draw(big).rounded_rectangle((x0 * s, y0 * s, x1 * s, y1 * s), (y1 - y0) * s // 2, fill="black")
    return big.resize((1320, 200), Image.LANCZOS)


def intro():
    base = green()
    y = text(base, "SIRAT", 850, 190, BOLD_ITALIC, "white")
    text(base, "THE PATH TO YOUR DEEN", y + 70, 44, ITALIC, GOLD, spacing=12, shadow=False)
    return base


def outro():
    base = green()
    y = text(base, "YOUR DEEN,", 810, 124, BOLD_ITALIC, "white")
    text(base, "EVERY DAY", y + 40, 124, BOLD_ITALIC, "white")
    d = ImageDraw.Draw(base)
    pill = Image.new("RGBA", (710, 108), GOLD + (255,))
    base.paste(pill, (88, 1497), rounded_mask(pill.size, 54))
    f = font(44, ITALIC)
    label = "DOWNLOAD ON THE APP STORE"
    left, top, right, bottom = d.textbbox((0, 0), label, font=f)
    d.text(((W - (right - left)) / 2 - left, 1497 + (108 - (bottom - top)) / 2 - top), label, font=f, fill=(38, 32, 16))
    return base


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def main(recording):
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        recording_pill().save(tmp / "pill.png")
        clips, durations = [], []

        for name, image, seconds in (("intro", intro(), INTRO), ("outro", outro(), OUTRO)):
            image.convert("RGB").save(tmp / f"{name}.png")
            ffmpeg("-loop", "1", "-framerate", "30", "-t", str(seconds), "-i", tmp / f"{name}.png",
                   "-vf", "format=yuv420p", "-c:v", "libx264", "-crf", "12", tmp / f"{name}.mp4")

        clips.append(tmp / "intro.mp4")
        durations.append(INTRO)
        for i, (top_line, bottom_line, start, end, hold) in enumerate(SECTIONS):
            section_layer(top_line, bottom_line).save(tmp / f"layer{i}.png")
            ffmpeg("-ss", str(start), "-t", str(end - start), "-i", recording,
                   "-loop", "1", "-i", tmp / f"layer{i}.png", "-i", tmp / "pill.png",
                   "-filter_complex",
                   f"[0:v][2:v]overlay=0:0,fps=30,scale={SCREEN_W}:{SCREEN_H}:flags=lanczos,setsar=1,"
                   f"tpad=stop_mode=clone:stop_duration={hold},pad={W}:{H}:{SCREEN_X}:{SCREEN_Y}[clip];"
                   f"[clip][1:v]overlay=0:0:shortest=1,format=yuv420p[v]",
                   "-map", "[v]", "-an", "-c:v", "libx264", "-crf", "12", tmp / f"s{i}.mp4")
            clips.append(tmp / f"s{i}.mp4")
            durations.append(end - start + hold)
        clips.append(tmp / "outro.mp4")
        durations.append(OUTRO)

        inputs, chain, offset, last = [], [], 0.0, "[n0]"
        for i, clip in enumerate(clips):
            inputs += ["-i", clip]
            # xfade refuses inputs whose timebases differ, and the stills and recording slices do
            chain.append(f"[{i}:v]settb=AVTB,fps=30,setpts=PTS-STARTPTS[n{i}]")
            if i:
                offset += durations[i - 1] - FADE
                label = f"[x{i}]"
                chain.append(f"{last}[n{i}]xfade=transition=fade:duration={FADE}:offset={offset:.3f}{label}")
                last = label
        total = sum(durations) - FADE * (len(clips) - 1)
        ffmpeg(*inputs, "-f", "lavfi", "-t", f"{total:.3f}", "-i", "anullsrc=r=44100:cl=stereo",
               "-filter_complex", ";".join(chain) + f";{last}format=yuv420p[v]",
               "-map", "[v]", "-map", f"{len(clips)}:a", "-c:v", "libx264", "-profile:v", "high",
               "-preset", "slow", "-crf", "16", "-maxrate", "12M", "-bufsize", "24M", "-r", "30",
               "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", OUT)
    print(f"built {OUT.name}: {total:.1f}s")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
