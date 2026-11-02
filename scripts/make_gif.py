"""Build the animated mascot GIF from the static pixel art.

Run from the project root:  python scripts/make_gif.py
Input:  public/img/mascot.png (331x265, palette PNG, bull cut off at the bottom)
Output: public/img/mascot.gif (looping, single transparent index, no dithering)

Animation: a subtle 1 art pixel head bob (the content dips down so the bottom
stays flush with the image edge and the horn tips never get cropped) and a
sunglasses glint that slides diagonally across the right lens over 3 frames.
The source art is slightly rotated, so it has no exact grid; ART_PX is the
measured art pixel pitch.
"""
from pathlib import Path
import struct

from PIL import GifImagePlugin, Image

ROOT = Path(__file__).resolve().parent.parent
MASCOT = ROOT / "public" / "img" / "mascot.png"
OUT = ROOT / "public" / "img" / "mascot.gif"

ART_PX = 11
ALPHA_CUTOFF = 128
WHITE = (255, 255, 255)
FRAME_MS = 110
# NETSCAPE2.0 application extension, loop count 0 = forever.
LOOP_FOREVER = b"!\xff\x0bNETSCAPE2.0\x03\x01\x00\x00\x00"

# Right lens bounds in source pixels (blue/orange lens area).
LENS_BOX = (166, 116, 236, 163)

# Per frame: (bob offset in art pixels, glint step or None).
# Rest, dip, rest with the glint sliding across the lens, dip.
TIMELINE = (
    (0, None), (0, None), (0, None),
    (1, None), (1, None), (1, None),
    (0, None), (0, 0), (0, 1), (0, 2),
    (1, None), (1, None), (1, None),
    (0, None),
)

# Glint cells (top left corner of each ART_PX square, source pixels), per step.
# Slides from lower left to upper right: a spark, a two pixel streak, a spark.
GLINT_STEPS = (
    ((176, 139),),
    ((190, 135), (201, 128)),
    ((216, 125),),
)


def load_source():
    src = Image.open(MASCOT)
    palette = src.convert("RGB").getcolors(4096)
    rgba = src.convert("RGBA")
    return rgba, palette


def is_lens(color):
    r, g, b, a = color
    if a < ALPHA_CUTOFF:
        return False
    blue = b > r + 40
    orange = r > 200 and b < 150
    return blue or orange


def lens_mask(rgba):
    """Set of source pixels that belong to the right lens glass."""
    px = rgba.load()
    x0, y0, x1, y1 = LENS_BOX
    return {
        (x, y)
        for x in range(x0, x1)
        for y in range(y0, y1)
        if is_lens(px[x, y])
    }


def bobbed(rgba, offset_px):
    """Shift the content down by offset_px; the bottom rows fall off the edge."""
    if offset_px == 0:
        return rgba.copy()
    frame = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    frame.paste(rgba.crop((0, 0, rgba.width, rgba.height - offset_px)), (0, offset_px))
    return frame


def draw_glint(frame, mask, step, offset_px):
    px = frame.load()
    half = ART_PX // 2
    for left, top in GLINT_STEPS[step]:
        # Whole square cells keep the sparkle crisp; skip a cell off the glass.
        cx, cy = left + half, top + half
        if not any((cx + dx, cy + dy) in mask for dx in (-2, 0, 2) for dy in (-2, 0, 2)):
            continue
        for x in range(left, left + ART_PX):
            for y in range(top, top + ART_PX):
                px[x, y + offset_px] = WHITE + (255,)


def build_palette(colors):
    """Source colours plus white, with the last slot reserved for transparency."""
    rgb = sorted({c for _, c in colors} | {WHITE})
    if len(rgb) > 255:
        raise ValueError("too many colours for a GIF palette")
    flat = [v for c in rgb for v in c]
    clear_index = len(rgb)
    flat += [0, 0, 0] * (256 - len(rgb))
    return flat, {c: i for i, c in enumerate(rgb)}, clear_index


def to_indexed(frame, lookup, flat, clear_index):
    out = Image.new("P", frame.size, clear_index)
    out.putpalette(flat)
    src, dst = frame.load(), out.load()
    for y in range(frame.height):
        for x in range(frame.width):
            r, g, b, a = src[x, y]
            if a >= ALPHA_CUTOFF:
                dst[x, y] = lookup[(r, g, b)]
    return out


def build_frames():
    rgba, colors = load_source()
    mask = lens_mask(rgba)
    flat, lookup, clear_index = build_palette(colors)
    frames = []
    for bob, glint in TIMELINE:
        offset = bob * ART_PX
        frame = bobbed(rgba, offset)
        if glint is not None:
            draw_glint(frame, mask, glint, offset)
        frames.append(to_indexed(frame, lookup, flat, clear_index))
    return frames, clear_index


def frame_plan(frames, clear_index):
    """Pair each frame with its disposal, replacing repeats with blank holds.

    A run of identical frames is written once (disposal 1, keep it on screen)
    followed by fully transparent holds that compress to almost nothing. The
    last frame of every run uses disposal 2 so the canvas is cleared before
    the next pose, which keeps the transparency crisp with no ghosting.
    """
    blank = Image.new("P", frames[0].size, clear_index)
    blank.putpalette(frames[0].getpalette())
    plan = []
    for i, frame in enumerate(frames):
        repeat = i > 0 and frame.tobytes() == frames[i - 1].tobytes()
        last_of_run = i == len(frames) - 1 or frame.tobytes() != frames[i + 1].tobytes()
        plan.append((blank if repeat else frame, 2 if last_of_run else 1))
    return plan


def write_gif(frames, clear_index, path):
    """Write a looping GIF with a steady FRAME_MS per frame.

    Pillow's save() merges identical consecutive frames into one longer frame,
    so the stream is written here instead to keep the 14 frame timeline.
    """
    width, height = frames[0].size
    palette = bytes(frames[0].getpalette()[: 256 * 3])
    with open(path, "wb") as fp:
        fp.write(b"GIF89a" + struct.pack("<HHBBB", width, height, 0xF7, clear_index, 0))
        fp.write(palette)
        fp.write(LOOP_FOREVER)
        for frame, disposal in frame_plan(frames, clear_index):
            params = {"duration": FRAME_MS, "disposal": disposal, "transparency": clear_index}
            frame = frame.copy()
            frame.encoderinfo = dict(params)
            GifImagePlugin._write_frame_data(fp, frame, (0, 0), params)
        fp.write(b";")


def main():
    frames, clear_index = build_frames()
    write_gif(frames, clear_index, OUT)
    print(f"{OUT.relative_to(ROOT)}  {len(frames)} frames  {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
