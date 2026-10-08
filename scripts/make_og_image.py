"""Render the social-share preview (frontend/public/og-image.png, 1200x630) from the Dashtor "D" logo geometry.

Run (needs Pillow):  python scripts/make_og_image.py
The geometry mirrors frontend/src/lib/logo.ts (24x24 viewBox); change both together.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H, SS = 1200, 630, 3  # SS = supersampling for smooth edges
OUT = Path(__file__).resolve().parents[1] / "frontend" / "public" / "og-image.png"
BG, FG, MUTED = (11, 23, 32), (240, 248, 245), (140, 163, 170)
TEAL, MINT = (15, 118, 110), (52, 211, 153)


def logo_mask(size: int) -> Image.Image:
    """The D with its counter and the diagonal cut, as an L mask `size` px square."""
    k = size * SS / 24
    m = Image.new("L", (size * SS, size * SS), 0)
    d = ImageDraw.Draw(m)

    def rect(x0, y0, x1, y1, v):
        d.rectangle([x0 * k, y0 * k, x1 * k, y1 * k], fill=v)

    def disc(cx, cy, r, v):
        d.ellipse([(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k], fill=v)

    rect(4.5, 3, 11.7, 21, 255); disc(11.7, 12, 9, 255); rect(4.5, 3, 11.7, 21, 255)  # outer D
    rect(0, 0, 4.5, 24, 0)                                                          # trim the disc's left half
    rect(8.7, 7.3, 11.7, 16.7, 0); disc(11.7, 12, 4.7, 0)                           # counter
    rect(0, 0, 8.7, 24, 0); rect(4.5, 3, 8.7, 21, 255)                              # restore the stem
    rect(8.7, 7.3, 11.7, 16.7, 0)
    d.line([3.9 * k, 15 * k, 13.2 * k, 2.2 * k], fill=0, width=int(1.7 * k))        # the cut
    for x, y in ((3.9, 15), (13.2, 2.2)):
        disc(x, y, 0.85, 0)
    return m.resize((size, size), Image.LANCZOS)


def gradient(size: int) -> Image.Image:
    g = Image.new("RGB", (size, size))
    px = g.load()
    for y in range(size):
        for x in range(size):
            t = (x + (size - y)) / (2 * size)  # bottom-left -> top-right
            px[x, y] = tuple(int(TEAL[i] + (MINT[i] - TEAL[i]) * t) for i in range(3))
    return g


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    for p in (f"C:/Windows/Fonts/{name}", f"/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main() -> None:
    img = Image.new("RGB", (W, H), BG)
    glow = Image.new("RGB", (W, H), BG)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-200, 40, 620, 860], fill=(14, 60, 58))
    img = Image.blend(img, glow.filter(__import__("PIL.ImageFilter", fromlist=["x"]).GaussianBlur(120)), 0.9)
    size = 360
    img.paste(gradient(size), (110, (H - size) // 2), logo_mask(size))
    d = ImageDraw.Draw(img)
    d.text((540, 205), "Dashtor", font=font("segoeuib.ttf", 120), fill=FG)
    d.text((546, 350), "Ask your data anything.", font=font("segoeui.ttf", 44), fill=MUTED)
    d.text((546, 410), "AI-native analytics: connect, ask, chart, share.", font=font("segoeui.ttf", 30), fill=MUTED)
    d.text((546, 520), "dashtor.laveyent.com", font=font("segoeuib.ttf", 30), fill=MINT)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, optimize=True)
    print("wrote", OUT, OUT.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
