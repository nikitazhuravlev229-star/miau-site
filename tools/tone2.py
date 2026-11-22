"""Тонирование «бордо + живая кожа».
Фон уходит в бордово-бежевую гамму сайта (как tone.py), а кожа (руки, лицо, тело)
сохраняет свой цвет, чуть подогретый. Использование:
  python3 tone2.py src dst [skin_strength=0.9]
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

import os
SRC = os.path.join(os.path.dirname(__file__), 'tonesrc/')

def build_lut():
    L = []; C = []
    for f in ['hair-wash.jpg', 'lips-red.jpg', 'irina.jpg', 'candle-hands.jpg', 'nails-red.jpg']:
        a = np.asarray(Image.open(SRC + f).convert('RGB')).astype(float).reshape(-1, 3)
        L.append((a @ [.299, .587, .114]).round().astype(int)); C.append(a)
    L = np.concatenate(L); C = np.concatenate(C)
    xs = []; ys = []
    for v in range(256):
        m = L == v
        if m.sum() > 200: xs.append(v); ys.append(C[m].mean(0))
    xs = np.array(xs); ys = np.array(ys)
    lut = np.stack([np.interp(np.arange(256), xs, ys[:, c]) for c in range(3)], 1)
    top = xs.max()
    for i in range(top, 256):
        lut[i] = ys[-1] + (np.array([239, 228, 214]) - ys[-1]) * (i - top) / max(1, 255 - top)
    return lut

LUT = build_lut()

def skin_mask(rgb):
    """Мягкая маска кожи по YCrCb + проверка на тёплый оттенок."""
    r, g, b = [rgb[..., i] for i in range(3)]
    y = .299 * r + .587 * g + .114 * b
    cr = (r - y) * .713 + 128
    cb = (b - y) * .564 + 128
    # расстояние до «центра кожи» в плоскости CrCb, мягкий край
    d = np.sqrt(((cr - 152) / 20) ** 2 + ((cb - 110) / 17) ** 2)
    m = np.clip(1.6 - d, 0, 1)
    m *= (r > g) & (r > b * 1.05)          # кожа всегда теплее: R > G, R > B
    m *= np.clip((cr - 137) / 8, 0, 1)     # без насыщенности это стена, а не кожа
    m *= np.clip((y - 35) / 40, 0, 1)      # не трогаем глубокие тени
    m *= np.clip((250 - y) / 30, 0, 1)     # и пересветы (белые простыни, стены)
    im = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=rgb.shape[1] / 300))
    return np.asarray(im).astype(float)[..., None] / 255

def tone(src, dst, strength=0.9, gamma=1.0, width=1200):
    im = Image.open(src).convert('RGB')
    if im.width > width:
        im = im.resize((width, round(width * im.height / im.width)), Image.LANCZOS)
    rgb = np.asarray(im).astype(float)
    lum = (rgb @ [.299, .587, .114]) / 255
    toned = LUT[(np.clip(lum, 0, 1) ** gamma * 255).round().astype(int)]
    # кожа: оригинал, чуть подогретый и с бордовыми тенями, чтобы не выпадал из гаммы
    warm = rgb * [1.03, .97, .92]
    warm = warm * .82 + toned * .18
    m = skin_mask(rgb) * strength
    out = toned * (1 - m) + warm * m
    Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(dst, quality=86)
    return float(m.mean())

if __name__ == '__main__':
    s = float(sys.argv[3]) if len(sys.argv) > 3 else .9
    print(tone(sys.argv[1], sys.argv[2], s))
