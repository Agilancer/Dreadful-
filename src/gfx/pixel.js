// Tiny software pixel canvas used to paint all sprites, icons and view models.
import { canvas } from './textures.js';

export function hex(c) {
  if (Array.isArray(c)) return c;
  const n = typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : c;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const dk = (c, f = 0.6) => [c[0] * f, c[1] * f, c[2] * f];
export const lt = (c, f = 0.4) => mix(c, [255, 255, 255], f);

export class PixCanvas {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  set(x, y, c, a = 255) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a;
  }
  alpha(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[(y * this.w + x) * 4 + 3];
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  ell(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.3), dy = (y - cy) / (ry + 0.3);
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
  }
  // Thick line
  line(x0, y0, x1, y1, c, t = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      if (t <= 1) this.set(x, y, c);
      else this.ell(x, y, t / 2, t / 2, c);
    }
  }
  tri(x0, y0, x1, y1, x2, y2, c) {
    const minX = Math.floor(Math.min(x0, x1, x2)), maxX = Math.ceil(Math.max(x0, x1, x2));
    const minY = Math.floor(Math.min(y0, y1, y2)), maxY = Math.ceil(Math.max(y0, y1, y2));
    const e = (ax, ay, bx, by, px, py) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const a = e(x0, y0, x1, y1, x, y), b = e(x1, y1, x2, y2, x, y), d = e(x2, y2, x0, y0, x, y);
      if ((a >= 0 && b >= 0 && d >= 0) || (a <= 0 && b <= 0 && d <= 0)) this.set(x, y, c);
    }
  }
  // Mirror the left half onto the right half (for symmetric creatures)
  mirror() {
    const hw = Math.floor(this.w / 2);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < hw; x++) {
      const s = (y * this.w + x) * 4, t = (y * this.w + (this.w - 1 - x)) * 4;
      for (let k = 0; k < 4; k++) this.d[t + k] = this.d[s + k];
    }
  }
  // Pixel-art finishing: bevel shading + dark outline
  finish(outline = [12, 8, 14], bevel = true) {
    const w = this.w, h = this.h, src = new Uint8ClampedArray(this.d);
    const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3]);
    if (bevel) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!A(x, y)) continue;
        const i = (y * w + x) * 4;
        let f = 1;
        if (!A(x, y - 1)) f *= 1.3;
        if (!A(x - 1, y)) f *= 1.12;
        if (!A(x, y + 1)) f *= 0.65;
        if (!A(x + 1, y)) f *= 0.8;
        if (f !== 1) for (let k = 0; k < 3; k++) this.d[i + k] = Math.min(255, src[i + k] * f);
      }
    }
    if (outline) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (A(x, y)) continue;
        if (A(x - 1, y) || A(x + 1, y) || A(x, y - 1) || A(x, y + 1)) this.set(x, y, outline);
      }
    }
    return this;
  }
  // Blit into a region of another PixCanvas
  blit(dst, ox, oy) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = (y * this.w + x) * 4;
      if (this.d[i + 3]) dst.set(ox + x, oy + y, [this.d[i], this.d[i + 1], this.d[i + 2]], this.d[i + 3]);
    }
  }
  tint(c, f) {
    for (let i = 0; i < this.d.length; i += 4) {
      if (!this.d[i + 3]) continue;
      for (let k = 0; k < 3; k++) this.d[i + k] = this.d[i + k] * (1 - f) + c[k] * f;
    }
    return this;
  }
  toCanvas() {
    const c = canvas(this.w, this.h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(this.w, this.h);
    img.data.set(this.d);
    ctx.putImageData(img, 0, 0);
    return c;
  }
}
