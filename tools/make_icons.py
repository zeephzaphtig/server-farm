"""Draw the app icon, Android adaptive icon layers and splash screen: a CPU with an amber dot-matrix $ on its lid."""
import math, random
from PIL import Image, ImageDraw, ImageFilter

DOLLAR = ['00100', '01111', '10100', '01110', '00101', '11110', '00100']

def radial(size, c0, c1, center=(0.5, 0.5), radius=0.75):
    im = Image.new('RGB', (size, size))
    px = im.load()
    cx, cy = center[0] * size, center[1] * size
    for y in range(size):
        for x in range(size):
            t = min(1, math.hypot(x - cx, y - cy) / (radius * size))
            px[x, y] = tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(3))
    return im

def chip(S, traces=True):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = cy = S / 2
    s = S * 0.46
    if traces:
        rnd = random.Random(3)
        tl = Image.new('RGBA', (S, S), (0, 0, 0, 0)); td = ImageDraw.Draw(tl)
        for side in range(4):
            for k in range(-2, 3):
                off = k * s * 0.17
                dx, dy = [(0, -1), (1, 0), (0, 1), (-1, 0)][side]
                px, py = -dy, dx
                x0, y0 = cx + dx * s * 0.58 + px * off, cy + dy * s * 0.58 + py * off
                l1 = s * (0.15 + rnd.random() * 0.2)
                x1, y1 = x0 + dx * l1, y0 + dy * l1
                b = k * s * 0.12
                x2, y2 = x1 + dx * abs(b) + px * b, y1 + dy * abs(b) + py * b
                x3, y3 = x2 + dx * S, y2 + dy * S
                td.line([(x0, y0), (x1, y1), (x2, y2), (x3, y3)], fill=(80, 230, 160, 120), width=int(S * 0.008))
                td.ellipse([x1 - S * 0.007, y1 - S * 0.007, x1 + S * 0.007, y1 + S * 0.007], fill=(120, 255, 190, 200))
        im.alpha_composite(tl)
    # glow
    gl = Image.new('RGBA', (S, S), (0, 0, 0, 0)); gd = ImageDraw.Draw(gl)
    gd.rounded_rectangle([cx - s * 0.62, cy - s * 0.62, cx + s * 0.62, cy + s * 0.62], radius=s * 0.1, fill=(61, 255, 138, 110))
    im.alpha_composite(gl.filter(ImageFilter.GaussianBlur(S * 0.05)))
    d = ImageDraw.Draw(im)
    # pins
    pins, pl, pw = 9, s * 0.08, s * 0.045
    for i in range(pins):
        p = -s * 0.38 + i / (pins - 1) * s * 0.76
        for (x0, y0, x1, y1) in [(cx + p - pw / 2, cy - s / 2 - pl, cx + p + pw / 2, cy - s / 2), (cx + p - pw / 2, cy + s / 2, cx + p + pw / 2, cy + s / 2 + pl),
                                 (cx - s / 2 - pl, cy + p - pw / 2, cx - s / 2, cy + p + pw / 2), (cx + s / 2, cy + p - pw / 2, cx + s / 2 + pl, cy + p + pw / 2)]:
            d.rectangle([x0, y0, x1, y1], fill=(222, 184, 76, 255))
    # substrate
    d.rounded_rectangle([cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2], radius=s * 0.07, fill=(26, 86, 56, 255), outline=(70, 140, 100, 255), width=int(S * 0.004))
    for fx, fy in [(0.1, 0.1), (0.82, 0.1), (0.1, 0.84), (0.82, 0.84)]:
        d.rectangle([cx - s / 2 + s * fx, cy - s / 2 + s * fy, cx - s / 2 + s * (fx + 0.07), cy - s / 2 + s * (fy + 0.04)], fill=(190, 140, 50, 255))
    # lid (dark glass display) with an amber dot-matrix $
    m = s * 0.17
    d.rounded_rectangle([cx - s / 2 + m, cy - s / 2 + m, cx + s / 2 - m, cy + s / 2 - m], radius=s * 0.05, fill=(24, 18, 9, 255), outline=(120, 100, 60, 255), width=int(S * 0.003))
    lid = s - 2 * m
    pitch = lid * 0.8 / 7
    ox, oy = cx - pitch * 2.5, cy - pitch * 3.5
    halo = Image.new('RGBA', (S, S), (0, 0, 0, 0)); hd = ImageDraw.Draw(halo)
    for r, row in enumerate(DOLLAR):
        for c, bit in enumerate(row):
            x, y = ox + c * pitch + pitch / 2, oy + r * pitch + pitch / 2
            if bit == '1':
                hd.ellipse([x - pitch * 0.7, y - pitch * 0.7, x + pitch * 0.7, y + pitch * 0.7], fill=(255, 179, 64, 160))
    im.alpha_composite(halo.filter(ImageFilter.GaussianBlur(pitch * 0.5)))
    d = ImageDraw.Draw(im)
    for r, row in enumerate(DOLLAR):
        for c, bit in enumerate(row):
            x, y = ox + c * pitch + pitch / 2, oy + r * pitch + pitch / 2
            col = (255, 196, 96, 255) if bit == '1' else (255, 179, 64, 28)
            d.ellipse([x - pitch * 0.38, y - pitch * 0.38, x + pitch * 0.38, y + pitch * 0.38], fill=col)
    d.ellipse([cx + s * 0.4 - S * 0.008, cy - S * 0.008, cx + s * 0.4 + S * 0.008, cy + S * 0.008], fill=(61, 255, 138, 255))
    return im

BG0, BG1 = (30, 46, 64), (9, 15, 22)

def art(size, ss=2):
    S = size * ss
    base = radial(S, BG0, BG1, (0.5, 0.42), 0.8).convert('RGBA')
    base.alpha_composite(chip(S))
    return base.resize((size, size), Image.LANCZOS)

icon = art(1024)
mask = Image.new('L', (1024, 1024), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, 1023, 1023], radius=200, fill=255)
rounded = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)); rounded.paste(icon, (0, 0), mask)
rounded.save('build/icon.png')
icon.save('assets/icon-only.png')
radial(1024, BG0, BG1, (0.5, 0.42), 0.8).save('assets/icon-background.png')
fg = chip(2048).resize((1024, 1024), Image.LANCZOS)
fgc = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)); fgc.alpha_composite(fg.resize((760, 760), Image.LANCZOS), (132, 132))
fgc.save('assets/icon-foreground.png')
sp = radial(1366, (22, 34, 48), (8, 12, 18), (0.5, 0.45), 0.8).convert('RGBA')
sp.alpha_composite(chip(1366, traces=False).resize((520, 520), Image.LANCZOS), (423, 380))
sp = sp.resize((2732, 2732), Image.LANCZOS)
sp.save('assets/splash.png'); sp.save('assets/splash-dark.png')
print('icons ok')
