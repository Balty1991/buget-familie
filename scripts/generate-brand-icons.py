#!/usr/bin/env python3
"""Rasterizează plicul 3D ales (varianta 1) pentru launcher, splash și antet."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

IVORY = (251, 244, 233, 255)
PAPER = (244, 239, 228, 255)

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "client/public"
PLAY = ROOT / "docs/play-store-assets"
ANDROID = ROOT / "android/app/src/main/res"
SOURCE = ROOT / "client/public/icons/icon-master.jpg"


def load_master(size: int = 2048) -> Image.Image:
    src = Image.open(SOURCE).convert("RGB")
    return src.resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")


def pad_on_ivory(src: Image.Image, pad: float) -> Image.Image:
    size = src.size[0]
    canvas = Image.new("RGBA", (size, size), IVORY)
    inner = int(size * (1 - 2 * pad))
    icon = src.resize((inner, inner), Image.Resampling.LANCZOS)
    xy = (size - inner) // 2
    canvas.paste(icon, (xy, xy), icon)
    return canvas


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
    side = int(min(width, height) * 0.36)
    icon = mark.resize((side, side), Image.Resampling.LANCZOS)
    img.paste(icon, ((width - side) // 2, int(height * 0.38) - side // 2), icon)
    return img


def main() -> None:
    master = load_master(2048)
    # Adaptive: mai mult aer, ca masca rotundă să nu taie plicul.
    foreground = pad_on_ivory(master, 0.08)

    save(downscale(master, 192), WEB / "icons/icon-192.png")
    save(downscale(master, 512), WEB / "icons/icon-512.png")
    save(downscale(foreground, 192), WEB / "icons/icon-192-maskable.png")
    save(downscale(foreground, 512), WEB / "icons/icon-512-maskable.png")
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
