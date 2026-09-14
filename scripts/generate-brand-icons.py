#!/usr/bin/env python3
"""Casa-plic: semn cald pentru launcher, splash și antet. Fără cub neon pe negru."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

SAGE = (232, 243, 236, 255)
CREAM = (255, 250, 243, 255)
FOREST = (27, 79, 66, 255)
FOREST_DEEP = (18, 58, 48, 255)
MINT = (196, 228, 212, 255)
PAPER = (244, 239, 228, 255)

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "client/public"
PLAY = ROOT / "docs/play-store-assets"
ANDROID = ROOT / "android/app/src/main/res"


def lerp(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def draw_house_envelope(size: int, *, pad: float, background: tuple | None) -> Image.Image:
    img = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    inner = size * (1 - 2 * pad)
    ox = size * pad
    oy = size * pad * 1.04

    def p(x: float, y: float) -> tuple[float, float]:
        return ox + x * inner, oy + y * inner

    stroke = max(2, int(inner * 0.028))
    radius = max(8, int(inner * 0.075))

    body = [p(0.12, 0.38), p(0.88, 0.92)]
    draw.rounded_rectangle(body, radius=radius, fill=CREAM, outline=FOREST, width=stroke)

    pocket = [p(0.16, 0.40), p(0.50, 0.74), p(0.84, 0.40)]
    draw.polygon(pocket, fill=MINT)
    draw.line([pocket[0], pocket[1], pocket[2]], fill=FOREST, width=max(2, stroke - 1), joint="curve")

    roof = [p(0.08, 0.42), p(0.50, 0.06), p(0.92, 0.42)]
    draw.polygon(roof, fill=FOREST)
    inner_roof = [p(0.22, 0.40), p(0.50, 0.16), p(0.78, 0.40)]
    draw.polygon(inner_roof, fill=CREAM)

    # muchia acoperișului, ca un plic închis — casă și registru în același semn
    draw.line([p(0.08, 0.42), p(0.50, 0.06), p(0.92, 0.42)], fill=FOREST_DEEP, width=stroke, joint="curve")
    return img


def downscale(src: Image.Image, size: int) -> Image.Image:
    return src.resize((size, size), Image.Resampling.LANCZOS)


def circle_mask(src: Image.Image) -> Image.Image:
    size = src.size[0]
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((1, 1, size - 2, size - 2), fill=255)
    out = src.copy()
    out.putalpha(mask)
    return out


def save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)


def splash(width: int, height: int, mark: Image.Image) -> Image.Image:
    img = Image.new("RGBA", (width, height), PAPER)
    side = int(min(width, height) * 0.28)
    icon = mark.resize((side, side), Image.Resampling.LANCZOS)
    img.paste(icon, ((width - side) // 2, int(height * 0.38) - side // 2), icon)
    return img


def main() -> None:
    master = draw_house_envelope(2048, pad=0.18, background=SAGE)
    foreground = draw_house_envelope(2048, pad=0.22, background=None)
    maskable = draw_house_envelope(2048, pad=0.26, background=SAGE)

    save(downscale(master, 192), WEB / "icons/icon-192.png")
    save(downscale(master, 512), WEB / "icons/icon-512.png")
    save(downscale(maskable, 192), WEB / "icons/icon-192-maskable.png")
    save(downscale(maskable, 512), WEB / "icons/icon-512-maskable.png")
    save(downscale(master, 180), WEB / "icons/apple-touch-icon.png")
    save(downscale(master, 32), WEB / "icons/favicon-32.png")
    save(downscale(master, 48), WEB / "icons/favicon-48.png")
    save(downscale(master, 512), PLAY / "icon-512.png")
    save(downscale(master, 1024), WEB / "icons/icon-1024.png")

    densities = {
        "mdpi": 108,
        "hdpi": 162,
        "xhdpi": 216,
        "xxhdpi": 324,
        "xxxhdpi": 432,
    }
    for name, size in densities.items():
        folder = ANDROID / f"mipmap-{name}"
        full = downscale(master, size)
        save(full, folder / "ic_launcher.png")
        save(circle_mask(full), folder / "ic_launcher_round.png")
        save(downscale(foreground, size), folder / "ic_launcher_foreground.png")

    splashes = {
        "drawable/splash.png": (480, 800),
        "drawable-port-mdpi/splash.png": (320, 480),
        "drawable-port-hdpi/splash.png": (480, 800),
        "drawable-port-xhdpi/splash.png": (720, 1280),
        "drawable-port-xxhdpi/splash.png": (960, 1600),
        "drawable-port-xxxhdpi/splash.png": (1280, 1920),
        "drawable-land-mdpi/splash.png": (480, 320),
        "drawable-land-hdpi/splash.png": (800, 480),
        "drawable-land-xhdpi/splash.png": (1280, 720),
        "drawable-land-xxhdpi/splash.png": (1600, 960),
        "drawable-land-xxxhdpi/splash.png": (1920, 1280),
    }
    for rel, (w, h) in splashes.items():
        save(splash(w, h, master), ANDROID / rel)


if __name__ == "__main__":
    main()
