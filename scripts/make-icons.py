"""Genera los iconos PNG de Libreto sin dependencias (python3 scripts/make-icons.py).

Fondo #121212, círculo coral (#FF5C6C) y triángulo de play oscuro.
El círculo ocupa el 64 % del lado: queda dentro de la zona segura (80 %)
de los iconos "maskable" de Android.
"""
import struct, zlib, os, sys

BG = (0x12, 0x12, 0x12)
ACCENT = (0xFF, 0x5C, 0x6C)
SS = 4  # submuestras por eje (suavizado)

def inside_triangle(px, py, a, b, c):
    def s(p1, p2, p3):
        return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
    d1, d2, d3 = s((px, py), a, b), s((px, py), b, c), s((px, py), c, a)
    neg = d1 < 0 or d2 < 0 or d3 < 0
    pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (neg and pos)

def render(size, circle=0.32, corner=0.0):
    cx = cy = size / 2
    r = size * circle
    # Triángulo centrado ópticamente (un poco a la derecha)
    t = r * 0.62
    a = (cx - t * 0.62, cy - t)
    b = (cx - t * 0.62, cy + t)
    c = (cx + t * 1.02, cy)
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            acc = [0, 0, 0]; alpha = 0
            for sy in range(SS):
                for sx in range(SS):
                    px = x + (sx + 0.5) / SS
                    py = y + (sy + 0.5) / SS
                    # esquinas redondeadas (solo para el favicon)
                    if corner:
                        rr = size * corner
                        qx = min(px, size - px); qy = min(py, size - py)
                        if qx < rr and qy < rr and (rr - qx) ** 2 + (rr - qy) ** 2 > rr * rr:
                            continue
                    alpha += 1
                    if (px - cx) ** 2 + (py - cy) ** 2 <= r * r and not inside_triangle(px, py, a, b, c):
                        col = ACCENT
                    else:
                        col = BG
                    acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2]
            n = SS * SS
            if alpha:
                row += bytes([acc[0] // alpha, acc[1] // alpha, acc[2] // alpha, 255 * alpha // n])
            else:
                row += bytes([0, 0, 0, 0])
        rows.append(bytes(row))
    return rows

def write_png(path, size, rows):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
    raw = b''.join(rows)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)
    print(path, size)

out = sys.argv[1] if len(sys.argv) > 1 else 'public/icons'
os.makedirs(out, exist_ok=True)
for name, size, kw in [
    ('icon-192.png', 192, {}),
    ('icon-512.png', 512, {}),
    ('icon-maskable-512.png', 512, {'circle': 0.28}),
    ('apple-touch-icon.png', 180, {}),
    ('favicon-32.png', 32, {'circle': 0.40, 'corner': 0.22}),
]:
    write_png(os.path.join(out, name), size, render(size, **kw))
