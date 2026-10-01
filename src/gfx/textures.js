// Procedural pixel-art textures. Everything is generated at runtime so the game
// ships with zero image assets.
import * as THREE from 'three';
import { RNG, clamp } from '../rng.js';

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function toTexture(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  return t;
}

// Tileable value noise on an integer lattice.
function makeNoise(rng, size, cell) {
  const n = Math.ceil(size / cell);
  const g = new Float32Array(n * n).map(() => rng.next());
  return (x, y) => {
    const fx = x / cell, fy = y / cell;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const at = (i, j) => g[((j % n + n) % n) * n + ((i % n + n) % n)];
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
}

class Pix {
  constructor(size) {
    this.size = size;
    this.c = canvas(size, size);
    this.ctx = this.c.getContext('2d');
    this.img = this.ctx.createImageData(size, size);
  }
  set(x, y, r, g, b, a = 255) {
    const s = this.size;
    x = ((x % s) + s) % s; y = ((y % s) + s) % s;
    const i = (y * s + x) * 4;
    const d = this.img.data;
    d[i] = clamp(r, 0, 255); d[i + 1] = clamp(g, 0, 255); d[i + 2] = clamp(b, 0, 255); d[i + 3] = a;
  }
  get(x, y) {
    const s = this.size;
    x = ((x % s) + s) % s; y = ((y % s) + s) % s;
    const i = (y * s + x) * 4, d = this.img.data;
    return [d[i], d[i + 1], d[i + 2]];
  }
  mul(x, y, f) { const [r, g, b] = this.get(x, y); this.set(x, y, r * f, g * f, b * f); }
  done() { this.ctx.putImageData(this.img, 0, 0); return this.c; }
}

const shade = (col, f) => [col[0] * f, col[1] * f, col[2] * f];

// --- pattern generators -----------------------------------------------------

function bricks(rng, col, opts = {}) {
  const S = 32, p = new Pix(S);
  const bh = opts.bh || 8, bw = opts.bw || 16;
  const mortar = shade(col, 0.35);
  const nz = makeNoise(rng, S, 4);
  for (let row = 0; row < S / bh; row++) {
    const off = (row % 2) * (bw / 2);
    for (let bx = -1; bx < S / bw + 1; bx++) {
      const v = 0.75 + rng.next() * 0.45;
      const tint = [rng.next() * 12 - 6, rng.next() * 12 - 6, rng.next() * 12 - 6];
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        const px = bx * bw + x + off, py = row * bh + y;
        if (px < 0 || px >= S + bw) continue;
        let c;
        if (y === bh - 1 || x === bw - 1) c = mortar;
        else {
          let f = v * (0.85 + nz(px, py) * 0.3) * (0.9 + rng.next() * 0.2);
          if (y === 0) f *= 1.18;
          if (y === bh - 2) f *= 0.78;
          if (x === 0) f *= 1.1;
          c = [col[0] * f + tint[0], col[1] * f + tint[1], col[2] * f + tint[2]];
        }
        p.set(px, py, ...c);
      }
    }
  }
  if (opts.moss) {
    const mn = makeNoise(rng, S, 8);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++)
      if (mn(x, y) + (y / S) * 0.4 > 0.85 && rng.chance(0.7)) p.set(x, y, 40 + rng.int(0, 30), 90 + rng.int(0, 40), 30);
  }
  if (opts.cracks) {
    for (let k = 0; k < 3; k++) {
      let x = rng.int(0, S), y = rng.int(0, S);
      for (let i = 0; i < 14; i++) {
        p.set(x, y, ...opts.cracks);
        p.set(x + 1, y, ...shade(opts.cracks, 0.6));
        x += rng.int(-1, 1); y += 1;
      }
    }
  }
  return p.done();
}

function rock(rng, col, opts = {}) {
  const S = 32, p = new Pix(S);
  const n1 = makeNoise(rng, S, 8), n2 = makeNoise(rng, S, 4), n3 = makeNoise(rng, S, 2);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = n1(x, y) * 0.5 + n2(x, y) * 0.3 + n3(x, y) * 0.2;
    v = Math.floor(v * 6) / 6; // banding for a pixel-art look
    const f = 0.55 + v * 0.75;
    p.set(x, y, ...shade(col, f));
  }
  // edge shading: darken where the next pixel is brighter
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = n1(x, y) + n2(x, y) * 0.5, b = n1(x + 1, y + 1) + n2(x + 1, y + 1) * 0.5;
    if (b - a > 0.08) p.mul(x, y, 0.7);
    if (a - b > 0.1) p.mul(x, y, 1.15);
  }
  if (opts.glow) {
    const gn = makeNoise(rng, S, 8);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const g = gn(x, y);
      if (g > 0.47 && g < 0.53) p.set(x, y, ...opts.glow);
    }
  }
  if (opts.speck) for (let i = 0; i < 18; i++) p.set(rng.int(0, S), rng.int(0, S), ...opts.speck);
  return p.done();
}

function flagstone(rng, col, opts = {}) {
  const S = 32, p = new Pix(S);
  const nz = makeNoise(rng, S, 4);
  const mortar = shade(col, 0.4);
  // 2x2 large stones with jittered seams
  const cells = [];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) cells.push(0.75 + rng.next() * 0.4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const ci = (Math.floor(x / 16) % 2) + 2 * (Math.floor(y / 16) % 2);
    const lx = x % 16, ly = y % 16;
    let c;
    if (lx === 0 || ly === 0) c = mortar;
    else {
      let f = cells[ci] * (0.8 + nz(x, y) * 0.4);
      if (lx === 1 || ly === 1) f *= 1.15;
      if (lx === 15 || ly === 15) f *= 0.8;
      f = Math.floor(f * 10) / 10;
      c = shade(col, f);
    }
    p.set(x, y, ...c);
  }
  if (opts.speck) for (let i = 0; i < 10; i++) p.set(rng.int(0, S), rng.int(0, S), ...opts.speck);
  return p.done();
}

function cobble(rng, col) {
  const S = 32, p = new Pix(S);
  const mortar = shade(col, 0.35);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) p.set(x, y, ...mortar);
  const stones = [];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++)
    stones.push([i * 8 + 4 + rng.int(-1, 1) + (j % 2) * 4, j * 8 + 4 + rng.int(-1, 1), 3 + rng.next() * 1.2, 0.7 + rng.next() * 0.5]);
  for (const [cx, cy, r, v] of stones) {
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= r) {
        let f = v * (1 - (x + y) * 0.035);
        p.set(cx + x, cy + y, ...shade(col, f));
      }
    }
  }
  return p.done();
}

function grass(rng, col) {
  const S = 32, p = new Pix(S);
  const nz = makeNoise(rng, S, 8);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = Math.floor((0.6 + nz(x, y) * 0.5 + rng.next() * 0.15) * 6) / 6;
    p.set(x, y, ...shade(col, v));
  }
  for (let i = 0; i < 40; i++) {
    const x = rng.int(0, S), y = rng.int(0, S);
    p.set(x, y, ...shade(col, 1.35)); p.set(x, y + 1, ...shade(col, 1.1));
  }
  return p.done();
}

function planks(rng, col) {
  const S = 32, p = new Pix(S);
  for (let y = 0; y < S; y++) {
    const row = Math.floor(y / 8);
    const v = 0.75 + ((row * 37) % 5) * 0.08;
    for (let x = 0; x < S; x++) {
      let f = v * (0.85 + Math.sin(x * 0.7 + row * 3 + Math.sin(y * 0.5) * 2) * 0.08 + rng.next() * 0.08);
      if (y % 8 === 7) f = 0.35;
      if (y % 8 === 0) f *= 1.15;
      if ((x + row * 11) % 32 === 0) f = 0.4;
      p.set(x, y, ...shade(col, f));
    }
  }
  return p.done();
}

function timber(rng) {
  const S = 32, p = new Pix(S);
  const plaster = [196, 182, 150], wood = [82, 54, 34];
  const nz = makeNoise(rng, S, 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let c = shade(plaster, 0.85 + nz(x, y) * 0.2);
    const beamV = x < 3 || x >= 29;
    const beamH = y < 3 || (y >= 15 && y < 18);
    const diag = Math.abs((x - 3) - (y - 18) * (26 / 11)) < 2.2 && y > 17;
    if (beamV || beamH || diag) c = shade(wood, 0.8 + rng.next() * 0.3 + (beamV && x === 0 ? 0.25 : 0));
    p.set(x, y, ...c);
  }
  return p.done();
}

function iceTex(rng, col) {
  const S = 32, p = new Pix(S);
  const n1 = makeNoise(rng, S, 16), n2 = makeNoise(rng, S, 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = n1(x, y) * 0.6 + n2(x, y) * 0.4;
    const f = 0.6 + Math.floor(v * 5) / 5 * 0.7;
    p.set(x, y, ...shade(col, f));
  }
  for (let k = 0; k < 4; k++) {
    let x = rng.int(0, S), y = rng.int(0, S), dx = rng.sign(), dy = rng.sign();
    for (let i = 0; i < 12; i++) { p.set(x, y, 230, 245, 255); x += dx; if (rng.chance(0.5)) y += dy; }
  }
  return p.done();
}

function voidTex(rng, col) {
  const S = 32, p = new Pix(S);
  const n1 = makeNoise(rng, S, 8);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = n1(x, y);
    p.set(x, y, ...shade(col, 0.4 + Math.floor(v * 4) / 4 * 0.6));
    if (Math.abs(v - 0.5) < 0.025) p.set(x, y, 220, 120, 255);
  }
  for (let i = 0; i < 12; i++) p.set(rng.int(0, S), rng.int(0, S), 255, 230, 255);
  return p.done();
}

function metal(rng, col) {
  const S = 32, p = new Pix(S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let f = 0.8 + rng.next() * 0.1;
    if (x % 16 === 0 || y % 16 === 0) f = 0.45;
    if ((x % 16 === 2 || x % 16 === 13) && (y % 16 === 2 || y % 16 === 13)) f = 1.4;
    p.set(x, y, ...shade(col, f));
  }
  return p.done();
}

// --- themes -----------------------------------------------------------------

export const THEMES = [
  { name: 'The Crypt', wall: ['bricks', [92, 90, 100]], floor: ['flag', [74, 68, 64]], ceil: ['rock', [50, 46, 50]],
    fog: [0.03, 0.03, 0.05], ambient: [0.2, 0.19, 0.24], torch: [1.0, 0.65, 0.3], sky: null },
  { name: 'The Caverns', wall: ['rock', [112, 82, 58]], floor: ['rock', [84, 66, 50]], ceil: ['rock', [60, 46, 36]],
    fog: [0.05, 0.035, 0.02], ambient: [0.22, 0.18, 0.14], torch: [1.0, 0.6, 0.25] },
  { name: 'The Sunken Temple', wall: ['moss', [96, 104, 84]], floor: ['flag', [66, 78, 62]], ceil: ['rock', [44, 56, 44]],
    fog: [0.02, 0.06, 0.04], ambient: [0.15, 0.24, 0.17], torch: [0.55, 1.0, 0.5] },
  { name: 'The Inferno', wall: ['hell', [120, 44, 30]], floor: ['lava', [80, 30, 22]], ceil: ['rock', [54, 22, 18]],
    fog: [0.12, 0.02, 0.0], ambient: [0.3, 0.12, 0.08], torch: [1.0, 0.45, 0.1] },
  { name: 'The Frozen Depths', wall: ['ice', [120, 160, 200]], floor: ['ice', [140, 170, 196]], ceil: ['rock', [70, 90, 110]],
    fog: [0.06, 0.09, 0.14], ambient: [0.22, 0.27, 0.36], torch: [0.5, 0.8, 1.0] },
  { name: 'The Void', wall: ['void', [64, 40, 96]], floor: ['metal', [60, 50, 80]], ceil: ['void', [30, 20, 50]],
    fog: [0.04, 0.0, 0.07], ambient: [0.2, 0.12, 0.3], torch: [0.85, 0.4, 1.0] },
];

export const TOWN_THEME = {
  name: 'Hollowmere', fog: [0.08, 0.08, 0.16], ambient: [0.42, 0.42, 0.55], torch: [1.0, 0.7, 0.35],
};

function gen(kind, col, seed) {
  const rng = new RNG(seed);
  switch (kind) {
    case 'bricks': return bricks(rng, col);
    case 'moss': return bricks(rng, col, { moss: true, bw: 16, bh: 8 });
    case 'hell': return bricks(rng, col, { cracks: [255, 150, 40], bw: 16, bh: 16 });
    case 'rock': return rock(rng, col);
    case 'lava': return rock(rng, col, { glow: [255, 120, 30] });
    case 'flag': return flagstone(rng, col);
    case 'ice': return iceTex(rng, col);
    case 'void': return voidTex(rng, col);
    case 'metal': return metal(rng, col);
    case 'cobble': return cobble(rng, col);
    case 'grass': return grass(rng, col);
    case 'planks': return planks(rng, col);
    case 'timber': return timber(rng);
    default: return rock(rng, col);
  }
}

const texCache = new Map();
export function getTexture(kind, col, seed = 1) {
  const key = kind + col.join(',') + seed;
  if (!texCache.has(key)) texCache.set(key, toTexture(gen(kind, col, seed)));
  return texCache.get(key);
}

// Material texture sets indexed by "material id" used in level tile data.
export function themeTextures(theme, depth) {
  // Shift hue slightly deeper into a theme band so repeat visits look different.
  const v = 1 + ((depth % 5) - 2) * 0.04;
  const c = (col) => col.map((x) => Math.round(x * v));
  return {
    wall: getTexture(theme.wall[0], c(theme.wall[1]), 11 + depth),
    wall2: getTexture(theme.wall[0] === 'rock' ? 'bricks' : 'rock', c(theme.wall[1]).map((x) => x * 0.85), 13 + depth),
    floor: getTexture(theme.floor[0], c(theme.floor[1]), 17 + depth),
    ceil: getTexture(theme.ceil[0], c(theme.ceil[1]), 19 + depth),
    platform: getTexture('metal', c(theme.floor[1]).map((x) => x * 1.1), 23),
  };
}

export function townTextures() {
  return {
    wall: getTexture('bricks', [120, 116, 110], 3),
    wall2: getTexture('timber', [0, 0, 0], 5),
    floor: getTexture('cobble', [110, 104, 96], 7),
    grass: getTexture('grass', [62, 110, 50], 9),
    planks: getTexture('planks', [120, 84, 52], 10),
    ceil: getTexture('rock', [60, 60, 60], 4),
    platform: getTexture('planks', [120, 84, 52], 10),
  };
}

// Radial glow used for projectiles / particles.
export function glowTexture() {
  const S = 16, c = canvas(S, S), ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x + 0.5 - S / 2) / (S / 2), dy = (y + 0.5 - S / 2) / (S / 2);
    const d = Math.sqrt(dx * dx + dy * dy);
    let a = Math.max(0, 1 - d);
    a = Math.floor(a * a * 5) / 4;
    const i = (y * S + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = Math.min(255, a * 255);
  }
  ctx.putImageData(img, 0, 0);
  const t = toTexture(c, false);
  t.generateMipmaps = false;
  t.minFilter = THREE.NearestFilter;
  return t;
}

export function skyTexture(seed = 99) {
  const rng = new RNG(seed);
  const W = 256, H = 128, c = canvas(W, H), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#05030f');
  g.addColorStop(0.5, '#140c2c');
  g.addColorStop(0.78, '#2e1846');
  g.addColorStop(0.88, '#5a2c40');
  g.addColorStop(1, '#100818');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const y = H * (0.12 + rng.next() * 0.66);
    ctx.fillStyle = `rgba(255,255,${200 + rng.int(0, 55)},${0.3 + rng.next() * 0.7})`;
    ctx.fillRect(rng.int(0, W), Math.floor(y), 1, 1);
  }
  // moon
  ctx.fillStyle = '#e8e2c8';
  ctx.beginPath(); ctx.arc(60, 70, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c8c0a0';
  ctx.fillRect(57, 68, 2, 2); ctx.fillRect(62, 72, 2, 1);
  // distant mountains silhouette near the horizon
  ctx.fillStyle = '#0c0614';
  let h = 110;
  for (let x = 0; x < W; x++) {
    h += rng.int(-1, 1); h = clamp(h, 104, 116);
    ctx.fillRect(x, h, 1, H - h);
  }
  const t = toTexture(c, true);
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
