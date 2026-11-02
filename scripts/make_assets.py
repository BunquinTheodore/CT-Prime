"""Generate CT Prime static assets with Pillow.

Run from the project root:  python scripts/make_assets.py
Outputs: public/favicon.svg, public/favicon-32.png, public/apple-touch-icon.png,
public/og.jpg, public/cursor/{cursor,pointer}-{32.svg,64.png}.
The animated mascot GIF is built separately by scripts/make_gif.py.
Pass --mascot to also re-optimize public/img/mascot.png (32 colour palette).
"""
from pathlib import Path
import sys

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
BANNER = ROOT / "brand-src" / "718995550_1001753109067644_4642192667722521449_n.jpg"  # logo only, no Discord URL
MARK_PNG = PUBLIC / "img" / "ct-mark.png"
MASCOT = PUBLIC / "img" / "mascot.png"

PRIME = (0x56, 0x83, 0xDA)
HORN = (0xEE, 0xE6, 0xD6)
BLACK = (0x09, 0x0B, 0x10)
SUPERSAMPLE = 8

# CT monogram paths, copied from public/img/ct-mark.svg (viewBox 0 0 79 50)
MARK_PATHS = (
    "M22 0H47L37 11H19.5C14 11.4 11 16.5 11 25S14.5 38.5 22 38.5H52.5L42 50H21.5C8 50 0 40 0 25S8.5 0 22 0Z",
    "M53 0H79L69 11H64V28.5L54 38.5V11H43Z",
    "M64 35.5V50H49.5Z",
)
MARK_W, MARK_H = 79, 50


# Favicons ------------------------------------------------------------------

def favicon_svg():
    size = 100
    pad_x = 17  # mark spans 66 of 100 units
    scale = (size - 2 * pad_x) / MARK_W
    ty = (size - MARK_H * scale) / 2
    paths = "".join(f'<path d="{d}"/>' for d in MARK_PATHS)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">'
        f'<rect width="{size}" height="{size}" rx="22" fill="#5683DA"/>'
        f'<g fill="#fff" transform="translate({pad_x} {ty:.2f}) scale({scale:.4f})">{paths}</g>'
        "</svg>\n"
    )
    (PUBLIC / "favicon.svg").write_text(svg, encoding="utf-8")


def mark_alpha(width):
    """Return the mark alpha mask resized to `width` (high quality)."""
    alpha = Image.open(MARK_PNG).convert("RGBA").getchannel("A")
    alpha = alpha.crop(alpha.getbbox())
    height = round(width * alpha.height / alpha.width)
    return alpha.resize((width, height), Image.LANCZOS)


def render_icon(size, mark_ratio, radius_ratio):
    """Prime square (rounded when radius_ratio > 0) with a centred white mark."""
    big = size * SUPERSAMPLE
    bg_mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(bg_mask).rounded_rectangle(
        (0, 0, big - 1, big - 1), radius=round(big * radius_ratio), fill=255
    )
    bg_mask = bg_mask.resize((size, size), Image.LANCZOS)

    icon = Image.new("RGBA", (size, size), PRIME + (0,))
    icon.putalpha(bg_mask)
    alpha = mark_alpha(round(size * mark_ratio))
    white = Image.new("RGBA", alpha.size, (255, 255, 255, 255))
    pos = ((size - alpha.width) // 2, (size - alpha.height) // 2)
    icon.paste(white, pos, alpha)
    return icon


def favicons():
    favicon_svg()
    render_icon(32, 0.72, 0.22).save(PUBLIC / "favicon-32.png", optimize=True)
    # iOS applies its own corner mask, so the touch icon is a full bleed square.
    touch = render_icon(180, 0.6, 0).convert("RGB")
    touch.save(PUBLIC / "apple-touch-icon.png", optimize=True)


# Open Graph image ------------------------------------------------------------

def og_image():
    target_w, target_h = 1200, 630
    banner = Image.open(BANNER).convert("RGB")
    scale = target_w / banner.width
    resized = banner.resize((target_w, round(banner.height * scale)), Image.LANCZOS)
    top = (resized.height - target_h) // 2
    og = resized.crop((0, top, target_w, top + target_h))

    mascot = Image.open(MASCOT).convert("RGBA")
    mw = 260
    mh = round(mascot.height * mw / mascot.width)
    mascot = mascot.resize((mw, mh), Image.NEAREST)
    # Peek up from the bottom right edge, bottom cut off like on the site.
    sink = 18
    og.paste(mascot, (target_w - mw - 44, target_h - mh + sink), mascot)
    og.save(PUBLIC / "og.jpg", "JPEG", quality=86, progressive=True, optimize=True)


# Pixel cursors -----------------------------------------------------------------
# K outline, B Prime fill, H Horn highlight, "." transparent. 16x16 grid.

ARROW = (
    "K...............",
    "KK..............",
    "KHK.............",
    "KHBK............",
    "KHBBK...........",
    "KHBBBK..........",
    "KHBBBBK.........",
    "KHBBBBBK........",
    "KHBBBBBBK.......",
    "KHBBBBKKKK......",
    "KHBKBBK.........",
    "KHK.KBBK........",
    "KK..KBBK........",
    "K....KBBK.......",
    ".....KBBK.......",
    "......KK........",
)

POINTER = (
    ".....KK.........",
    "....KHBK........",
    "....KHBK........",
    "....KHBK........",
    "....KHBKKK......",
    "....KHBKBBKKK...",
    "....KHBKBBKBBKK.",
    ".KK.KHBKBBKBBKBK",
    "KHBKKHBBBBBBBBBK",
    "KHBBKHBBBBBBBBBK",
    ".KHBBBBBBBBBBBBK",
    "..KHBBBBBBBBBBK.",
    "..KHBBBBBBBBBBK.",
    "...KHBBBBBBBBK..",
    "...KHBBBBBBBBK..",
    "...KKKKKKKKKKK..",
)

CURSOR_COLORS = {"K": BLACK, "B": PRIME, "H": HORN}
HEX = {"K": "#090B10", "B": "#5683DA", "H": "#EEE6D6"}


def check_grid(grid):
    if len(grid) != 16 or any(len(row) != 16 for row in grid):
        raise ValueError("cursor grids must be 16x16")


def grid_runs(grid, key):
    """Yield (x, y, length) horizontal runs of `key` cells."""
    for y, row in enumerate(grid):
        x = 0
        while x < len(row):
            if row[x] != key:
                x += 1
                continue
            start = x
            while x < len(row) and row[x] == key:
                x += 1
            yield start, y, x - start


def cursor_svg(grid):
    parts = []
    for key, color in HEX.items():
        d = "".join(f"M{x} {y}h{n}v1h-{n}z" for x, y, n in grid_runs(grid, key))
        if d:
            parts.append(f'<path fill="{color}" d="{d}"/>')
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" '
        'viewBox="0 0 16 16" shape-rendering="crispEdges">' + "".join(parts) + "</svg>\n"
    )


def cursor_png(grid, size):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(grid):
        for x, cell in enumerate(row):
            if cell in CURSOR_COLORS:
                img.putpixel((x, y), CURSOR_COLORS[cell] + (255,))
    return img.resize((size, size), Image.NEAREST)


def cursors():
    out = PUBLIC / "cursor"
    out.mkdir(parents=True, exist_ok=True)
    for name, grid in (("cursor", ARROW), ("pointer", POINTER)):
        check_grid(grid)
        (out / f"{name}-32.svg").write_text(cursor_svg(grid), encoding="utf-8")
        cursor_png(grid, 64).save(out / f"{name}-64.png", optimize=True)


# Mascot optimization ---------------------------------------------------------------

def optimize_mascot(dest=MASCOT):
    """Quantize to 31 opaque colours + 1 transparent slot (alpha is 0/255), no dither."""
    src = Image.open(MASCOT).convert("RGBA")
    alpha = src.getchannel("A")
    rgb = Image.new("RGB", src.size, (0, 0, 0))
    rgb.paste(src.convert("RGB"), mask=alpha)
    out = rgb.quantize(
        colors=31, method=Image.Quantize.MAXCOVERAGE, kmeans=4, dither=Image.Dither.NONE
    )
    clear_index = 31
    palette = out.getpalette()[: 31 * 3] + [0, 0, 0]
    out.putpalette(palette)
    clear = alpha.point(lambda a: 255 if a < 128 else 0)
    out.paste(clear_index, mask=clear)
    out.save(dest, optimize=True, transparency=clear_index)
    return dest


def main():
    favicons()
    og_image()
    cursors()
    if "--mascot" in sys.argv:
        optimize_mascot()
    for path in sorted(PUBLIC.glob("*.*")) + sorted((PUBLIC / "cursor").glob("*")):
        print(f"{path.relative_to(ROOT)}  {path.stat().st_size} bytes")


if __name__ == "__main__":
    main()
