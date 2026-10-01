// Procedural sprite sheets for monsters, NPCs, world objects and item icons.
import * as THREE from 'three';
import { PixCanvas, hex, mix, dk, lt } from './pixel.js';
import { RNG } from '../rng.js';

function sheetTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

// ---------------------------------------------------------------------------
// Creature painters. Each paints one frame onto a PixCanvas of size S x S.
// frame: 0 = walk A, 1 = walk B, 2 = attack, 3 = pain
// ---------------------------------------------------------------------------

function eyes(p, x, y, sep, col, size = 1) {
  p.rect(x - sep - size + 1, y, size, size, col);
  p.rect(x + sep, y, size, size, col);
}

const painters = {
  humanoid(p, S, f, pal, o) {
    const cx = S / 2, step = f === 1 ? 1 : f === 0 ? -1 : 0;
    const hunch = o.hunch ? 3 : 0;
    const top = S * 0.18 + hunch;
    // legs
    if (o.robe) {
      p.tri(cx - 7, S - 2, cx + 7, S - 2, cx, top + 8, pal.dark);
      p.rect(cx - 6 + step, S - 3, 4, 2, dk(pal.dark));
      p.rect(cx + 2 - step, S - 3, 4, 2, dk(pal.dark));
    } else {
      p.rect(cx - 5 + step, S * 0.62, 3, S * 0.36, pal.dark);
      p.rect(cx + 2 - step, S * 0.62, 3, S * 0.36, pal.dark);
      p.rect(cx - 6 + step, S - 3, 4, 2, dk(pal.dark, 0.5));
      p.rect(cx + 2 - step, S - 3, 4, 2, dk(pal.dark, 0.5));
    }
    // torso
    p.rect(cx - 6, top + 6, 12, S * 0.38, pal.body);
    if (o.ribs) for (let i = 0; i < 4; i++) p.rect(cx - 4, top + 8 + i * 2, 8, 1, dk(pal.body, 0.55));
    if (o.armor) { p.rect(cx - 6, top + 6, 12, 4, pal.accent); p.rect(cx - 1, top + 10, 2, 8, pal.accent); }
    if (o.belt) p.rect(cx - 6, top + 6 + S * 0.3, 12, 2, pal.accent);
    // arms
    const armY = top + 7;
    if (f === 2) {
      // raised / forward attack pose
      p.line(cx - 6, armY, cx - 10, armY - 7, pal.body, 3);
      p.line(cx + 6, armY, cx + 10, armY - 7, pal.body, 3);
      if (o.claws) { p.line(cx - 10, armY - 7, cx - 12, armY - 10, pal.eye); p.line(cx + 10, armY - 7, cx + 12, armY - 10, pal.eye); }
    } else {
      p.line(cx - 7, armY, cx - 8, armY + 9 - step, pal.body, 3);
      p.line(cx + 7, armY, cx + 8, armY + 9 + step, pal.body, 3);
    }
    // head
    const hy = top + 1;
    if (o.hood) {
      p.ell(cx, hy + 1, 5, 5, pal.dark);
      p.ell(cx, hy + 2, 3, 3, [10, 6, 12]);
      eyes(p, cx, hy + 2, 1, pal.eye);
    } else if (o.skull) {
      p.ell(cx, hy, 4, 4, [220, 214, 190]);
      p.rect(cx - 3, hy + 3, 6, 2, [200, 194, 170]);
      eyes(p, cx, hy - 1, 1, f === 2 ? lt(pal.eye, 0.5) : [20, 10, 10], 2);
      eyes(p, cx, hy, 1, pal.eye);
    } else if (o.helm) {
      p.ell(cx, hy, 4, 5, pal.accent);
      p.rect(cx - 3, hy, 6, 1, [16, 10, 10]);
      eyes(p, cx, hy, 1, pal.eye);
      if (o.plume) p.line(cx, hy - 5, cx + 3, hy - 9, pal.eye, 2);
    } else {
      p.ell(cx, hy, 4, 4, pal.skin || pal.body);
      eyes(p, cx, hy - 1, 1, pal.eye);
      if (f === 2) p.rect(cx - 2, hy + 2, 4, 1, [40, 0, 0]);
    }
    if (o.horns) {
      p.line(cx - 3, hy - 3, cx - 6, hy - 8, pal.accent, 2);
      p.line(cx + 3, hy - 3, cx + 6, hy - 8, pal.accent, 2);
    }
    if (o.crown) { p.rect(cx - 4, hy - 6, 9, 2, [240, 200, 60]); for (let i = -4; i <= 4; i += 4) p.rect(cx + i, hy - 8, 1, 2, [240, 200, 60]); }
    // held item
    if (o.weapon === 'sword') p.line(cx + 9, armY + 8, cx + 13, armY - 6 - (f === 2 ? 4 : 0), [200, 200, 215], 2);
    if (o.weapon === 'bow') { p.line(cx - 9, armY - 3, cx - 12, armY + 4, [120, 80, 40], 1); p.line(cx - 12, armY + 4, cx - 9, armY + 11, [120, 80, 40], 1); p.line(cx - 9, armY - 3, cx - 9, armY + 11, [220, 220, 220]); }
    if (o.weapon === 'staff') { p.line(cx + 9, S - 2, cx + 9, top - 2, [110, 76, 46], 2); p.ell(cx + 9, top - 3, 2, 2, pal.eye); }
    if (o.weapon === 'axe') { p.line(cx + 9, armY + 8, cx + 10, armY - 6, [110, 76, 46], 2); p.ell(cx + 12, armY - 5, 3, 3, [180, 180, 190]); }
    if (o.shield) p.ell(cx - 8, armY + 6, 4, 5, pal.accent);
  },

  brute(p, S, f, pal, o) {
    const cx = S / 2, step = f === 1 ? 2 : f === 0 ? -2 : 0;
    p.rect(cx - 9 + step, S * 0.66, 6, S * 0.34, pal.dark);
    p.rect(cx + 3 - step, S * 0.66, 6, S * 0.34, pal.dark);
    p.ell(cx, S * 0.48, S * 0.3, S * 0.24, pal.body);
    if (o.cracks) for (let i = 0; i < 6; i++) p.line(cx - 8 + i * 3, S * 0.36, cx - 6 + i * 3, S * 0.6, dk(pal.body, 0.6));
    if (o.glowcore) p.ell(cx, S * 0.48, 3, 3, pal.eye);
    const ay = S * 0.36;
    if (f === 2) {
      p.line(cx - 12, ay, cx - 15, ay - 10, pal.body, 5);
      p.line(cx + 12, ay, cx + 15, ay - 10, pal.body, 5);
      p.ell(cx - 15, ay - 11, 3, 3, pal.accent); p.ell(cx + 15, ay - 11, 3, 3, pal.accent);
    } else {
      p.line(cx - 13, ay, cx - 15, ay + 13 + step, pal.body, 5);
      p.line(cx + 13, ay, cx + 15, ay + 13 - step, pal.body, 5);
      p.ell(cx - 15, ay + 14 + step, 3, 3, pal.accent); p.ell(cx + 15, ay + 14 - step, 3, 3, pal.accent);
    }
    p.ell(cx, S * 0.22, 5, 5, pal.skin || pal.body);
    eyes(p, cx, S * 0.21, 2, pal.eye);
    if (f === 2) p.rect(cx - 3, S * 0.27, 6, 2, [40, 0, 0]);
    if (o.horns) { p.line(cx - 4, S * 0.17, cx - 10, S * 0.05, pal.accent, 2); p.line(cx + 4, S * 0.17, cx + 10, S * 0.05, pal.accent, 2); }
    if (o.wings) { p.tri(cx - 10, S * 0.3, cx - 22, S * 0.1, cx - 18, S * 0.55, dk(pal.dark, 0.8)); p.tri(cx + 10, S * 0.3, cx + 22, S * 0.1, cx + 18, S * 0.55, dk(pal.dark, 0.8)); }
  },

  beast(p, S, f, pal, o) {
    const cx = S / 2, by = S * 0.6, step = f === 1 ? 2 : f === 0 ? -2 : 0;
    // legs (front view-ish quadruped, slightly 3/4)
    for (const [lx, d] of [[-8, step], [-4, -step], [4, step], [8, -step]]) p.rect(cx + lx - 1, by + 2 + (d > 0 ? 1 : 0), 3, S - by - 3, pal.dark);
    p.ell(cx, by, S * 0.32, S * 0.16, pal.body);
    if (o.spikes) for (let i = -3; i <= 3; i++) p.tri(cx + i * 3 - 1, by - 4, cx + i * 3 + 1, by - 4, cx + i * 3, by - 9, pal.accent);
    if (o.mane) p.ell(cx, by - 5, 8, 6, pal.accent);
    // head
    const hy = by - 5 + (f === 2 ? 3 : 0);
    p.ell(cx, hy, 6, 5, pal.skin || pal.body);
    p.tri(cx - 5, hy - 3, cx - 2, hy - 4, cx - 5, hy - 9, pal.dark);
    p.tri(cx + 5, hy - 3, cx + 2, hy - 4, cx + 5, hy - 9, pal.dark);
    eyes(p, cx, hy - 1, 2, pal.eye);
    p.rect(cx - 2, hy + 2, 4, 2, dk(pal.body, 0.5));
    if (f === 2) { p.rect(cx - 3, hy + 3, 6, 2, [70, 0, 0]); p.set(cx - 2, hy + 3, [255, 255, 255]); p.set(cx + 2, hy + 3, [255, 255, 255]); }
  },

  rat(p, S, f, pal) {
    const cx = S / 2, by = S * 0.78, step = f === 1 ? 1 : f === 0 ? -1 : 0;
    p.line(cx + 6, by, cx + 13, by - 4 + step, pal.skin || [200, 140, 140]);
    p.ell(cx, by, 7, 4, pal.body);
    p.rect(cx - 5 + step, by + 3, 2, 3, pal.dark); p.rect(cx + 3 - step, by + 3, 2, 3, pal.dark);
    p.ell(cx - 6, by - 2 + (f === 2 ? 2 : 0), 4, 3, pal.body);
    p.ell(cx - 8, by - 6, 2, 2, pal.skin || [200, 140, 140]);
    p.ell(cx - 4, by - 6, 2, 2, pal.skin || [200, 140, 140]);
    p.set(cx - 7, by - 3, pal.eye); p.set(cx - 5, by - 3, pal.eye);
    if (f === 2) p.rect(cx - 8, by, 3, 1, [255, 255, 255]);
  },

  blob(p, S, f, pal) {
    const cx = S / 2, squash = f === 1 ? 2 : f === 2 ? -3 : 0;
    p.ell(cx, S - 9 + squash / 2, 11 + squash, 8 - squash, pal.body);
    p.ell(cx - 3, S - 13, 3, 2, lt(pal.body, 0.4));
    p.ell(cx + 4, S - 7, 2, 2, dk(pal.body, 0.7));
    eyes(p, cx, S - 11 + squash, 3, pal.eye, 2);
    if (f === 2) p.ell(cx, S - 6, 4, 2, dk(pal.dark, 0.3));
  },

  flyer(p, S, f, pal, o) {
    const cx = S / 2, cy = S * 0.45, up = f === 1 || f === 2;
    const wing = pal.dark;
    if (up) {
      p.tri(cx - 3, cy, cx - 15, cy - 11, cx - 13, cy + 2, wing);
      p.tri(cx + 3, cy, cx + 15, cy - 11, cx + 13, cy + 2, wing);
    } else {
      p.tri(cx - 3, cy, cx - 15, cy + 7, cx - 9, cy + 9, wing);
      p.tri(cx + 3, cy, cx + 15, cy + 7, cx + 9, cy + 9, wing);
    }
    p.ell(cx, cy, 4, 5, pal.body);
    p.tri(cx - 3, cy - 3, cx - 1, cy - 4, cx - 4, cy - 8, pal.body);
    p.tri(cx + 3, cy - 3, cx + 1, cy - 4, cx + 4, cy - 8, pal.body);
    eyes(p, cx, cy - 1, 1, pal.eye);
    if (o.tail) p.line(cx, cy + 5, cx + 2, cy + 12, pal.accent, 1);
    if (o.horns) { p.line(cx - 2, cy - 4, cx - 4, cy - 9, pal.accent); p.line(cx + 2, cy - 4, cx + 4, cy - 9, pal.accent); }
    if (f === 2) p.rect(cx - 1, cy + 2, 3, 2, [255, 230, 230]);
  },

  eye(p, S, f, pal) {
    const cx = S / 2, cy = S * 0.42;
    for (let i = -2; i <= 2; i++) {
      const sway = (f === 1 ? 2 : -2) * (i % 2 ? 1 : -1);
      p.line(cx + i * 3, cy + 8, cx + i * 4 + sway, cy + 16, pal.dark, 2);
    }
    p.ell(cx, cy, 10, 10, pal.body);
    p.ell(cx, cy, 6, f === 2 ? 6 : 5, [240, 236, 220]);
    p.ell(cx, cy, 3, 3, pal.eye);
    p.ell(cx, cy, 1, 1, [0, 0, 0]);
    if (f === 3) p.rect(cx - 6, cy - 1, 12, 2, pal.body);
  },

  spider(p, S, f, pal) {
    const cx = S / 2, cy = S * 0.62;
    for (let i = 0; i < 4; i++) {
      const lift = (f + i) % 2 ? 2 : 0;
      const ang = 0.4 + i * 0.35;
      for (const s of [-1, 1]) {
        const kx = cx + s * (6 + i * 2), ky = cy - 6 + i;
        p.line(cx + s * 3, cy, kx, ky - lift, pal.dark, 1);
        p.line(kx, ky - lift, cx + s * (9 + i * 3), S - 2 - (i === 0 ? 2 : 0), pal.dark, 1);
        void ang;
      }
    }
    p.ell(cx, cy - 2, 7, 6, pal.body);
    p.ell(cx, cy + 3, 4, 3, dk(pal.body, 0.8));
    p.rect(cx - 2, cy - 5, 2, 1, pal.accent); p.rect(cx + 1, cy - 5, 2, 1, pal.accent);
    for (let i = 0; i < 3; i++) { p.set(cx - 3 + i * 3, cy - 1, pal.eye); }
    p.set(cx - 2, cy + 1, pal.eye); p.set(cx + 2, cy + 1, pal.eye);
    if (f === 2) { p.line(cx - 2, cy + 4, cx - 3, cy + 7, [230, 230, 230]); p.line(cx + 2, cy + 4, cx + 3, cy + 7, [230, 230, 230]); }
  },

  serpent(p, S, f, pal, o) {
    const cx = S / 2;
    p.ell(cx, S - 5, 11, 4, pal.dark);
    p.ell(cx + 2, S - 8, 8, 3, pal.body);
    const sway = f === 1 ? 2 : f === 0 ? -2 : 0;
    p.line(cx + 3, S - 9, cx + sway, S * 0.35, pal.body, 6);
    p.line(cx + 3, S - 9, cx + sway, S * 0.35, lt(pal.body, 0.2), 2);
    const hy = S * 0.3 + (f === 2 ? -2 : 0);
    if (o.hood) p.ell(cx + sway, hy + 3, 8, 6, pal.accent);
    p.ell(cx + sway, hy, 4, 4, pal.body);
    eyes(p, cx + sway, hy - 1, 2, pal.eye);
    if (f === 2) { p.line(cx + sway, hy + 3, cx + sway, hy + 7, [220, 40, 60]); }
  },

  wisp(p, S, f, pal, o) {
    const cx = S / 2, top = S * 0.15;
    const wave = f === 1 ? 1 : -1;
    for (let y = 0; y < S * 0.75; y++) {
      const t = y / (S * 0.75);
      const w = (1 - Math.abs(t - 0.35) * 1.2) * 9 + Math.sin(y * 0.8 + wave) * 1.5;
      const col = mix(pal.body, pal.dark, t);
      p.rect(cx - w, top + y, w * 2, 1, col);
    }
    for (let i = -2; i <= 2; i++) p.tri(cx + i * 4 - 2, top + S * 0.72, cx + i * 4 + 2, top + S * 0.72, cx + i * 4 + wave, top + S * 0.82, pal.dark);
    p.ell(cx, top + 4, 5, 5, o.skull ? [210, 205, 190] : pal.body);
    p.ell(cx, top + 5, 3, 3, [10, 5, 20]);
    eyes(p, cx, top + 4, 1, pal.eye);
    if (f === 2) {
      p.line(cx - 8, top + 10, cx - 13, top + 4, pal.body, 2);
      p.line(cx + 8, top + 10, cx + 13, top + 4, pal.body, 2);
    }
    if (o.crown) { p.rect(cx - 4, top - 2, 9, 2, [240, 200, 60]); p.rect(cx - 4, top - 4, 1, 2, [240, 200, 60]); p.rect(cx, top - 4, 1, 2, [240, 200, 60]); p.rect(cx + 4, top - 4, 1, 2, [240, 200, 60]); }
  },
};

const sheetCache = new Map();

// def: { body: 'humanoid', palette: {body, dark, accent, eye, skin}, opts: {}, size: 32|48 }
export function creatureSheet(key, def) {
  if (sheetCache.has(key)) return sheetCache.get(key);
  const S = def.px || 32;
  const pal = {};
  for (const k of Object.keys(def.palette)) pal[k] = hex(def.palette[k]);
  const sheet = new PixCanvas(S * 4, S);
  for (let f = 0; f < 4; f++) {
    const p = new PixCanvas(S, S);
    const fpal = f === 3 ? Object.fromEntries(Object.entries(pal).map(([k, v]) => [k, lt(v, 0.55)])) : pal;
    painters[def.body](p, S, f, fpal, def.opts || {});
    p.finish();
    p.blit(sheet, f * S, 0);
  }
  const c = sheet.toCanvas();
  const res = { texture: sheetTexture(c), canvas: c, frames: 4, px: S };
  sheetCache.set(key, res);
  return res;
}

// ---------------------------------------------------------------------------
// World objects (single or few frames)
// ---------------------------------------------------------------------------

function objPainter(kind, frame) {
  let p;
  switch (kind) {
    case 'chest': case 'chestOpen': case 'chestGold': {
      p = new PixCanvas(24, 24);
      const gold = kind === 'chestGold';
      const wood = gold ? [150, 30, 30] : [120, 78, 40], band = gold ? [240, 200, 60] : [150, 150, 160];
      p.rect(3, 11, 18, 11, wood);
      p.rect(3, 15, 18, 2, band); p.rect(5, 11, 2, 11, band); p.rect(17, 11, 2, 11, band);
      if (kind === 'chestOpen') {
        p.rect(3, 6, 18, 4, dk(wood, 0.7)); p.rect(5, 10, 14, 2, [20, 10, 5]);
        p.rect(7, 9, 10, 2, [255, 210, 70]);
      } else {
        p.rect(3, 7, 18, 5, lt(wood, 0.1)); p.rect(3, 7, 18, 1, lt(wood, 0.25));
        p.rect(11, 12, 2, 3, [240, 220, 120]);
      }
      p.finish();
      break;
    }
    case 'torch': {
      p = new PixCanvas(12, 24);
      p.rect(5, 12, 2, 10, [90, 60, 34]); p.rect(4, 11, 4, 2, [70, 70, 80]);
      const fl = frame ? 1 : 0;
      p.ell(6, 8 - fl, 3, 4, [255, 140, 30]);
      p.ell(6 + (fl ? 1 : -1), 6 - fl, 2, 3, [255, 220, 90]);
      p.set(6, 2 - fl, [255, 255, 200]);
      p.finish(null, false);
      break;
    }
    case 'brazier': {
      p = new PixCanvas(24, 32);
      p.rect(10, 16, 4, 14, [70, 70, 78]); p.rect(6, 28, 12, 3, [60, 60, 66]);
      p.ell(12, 16, 8, 3, [90, 90, 100]);
      const fl = frame ? 1 : 0;
      p.ell(12, 10 - fl, 6, 6, [255, 120, 20]); p.ell(12 + (fl ? 1 : -1), 8 - fl, 4, 5, [255, 200, 70]); p.ell(12, 6, 2, 2, [255, 255, 210]);
      p.finish(null, false);
      break;
    }
    case 'stairsDown': {
      p = new PixCanvas(32, 32);
      for (let i = 0; i < 5; i++) p.rect(4 + i * 2, 6 + i * 5, 24 - i * 4, 5, dk([120, 110, 100], 1 - i * 0.15));
      p.rect(10, 28, 12, 3, [10, 5, 10]);
      p.finish();
      break;
    }
    case 'portal': {
      p = new PixCanvas(32, 48);
      const c1 = frame ? [120, 80, 255] : [80, 140, 255];
      p.ell(16, 24, 12, 20, [40, 30, 90]);
      p.ell(16, 24, 10, 18, c1);
      p.ell(16, 24, 7, 14, lt(c1, 0.4));
      p.ell(16, 24, 3, 8, [255, 255, 255]);
      p.finish(null, false);
      break;
    }
    case 'tree': {
      p = new PixCanvas(48, 64);
      p.rect(21, 36, 6, 28, [70, 46, 30]);
      p.line(24, 44, 14, 34, [70, 46, 30], 2);
      p.ell(24, 26, 18, 16, [28, 64, 36]); p.ell(14, 32, 10, 9, [24, 56, 30]); p.ell(34, 32, 10, 9, [30, 70, 40]);
      p.ell(22, 18, 10, 9, [40, 84, 46]);
      p.finish();
      break;
    }
    case 'deadtree': {
      p = new PixCanvas(48, 64);
      p.rect(21, 20, 5, 44, [60, 50, 44]);
      p.line(23, 34, 10, 20, [60, 50, 44], 2); p.line(23, 28, 36, 14, [60, 50, 44], 2); p.line(12, 22, 8, 12, [60, 50, 44]);
      p.finish();
      break;
    }
    case 'barrel': {
      p = new PixCanvas(20, 24);
      p.ell(10, 13, 8, 10, [120, 80, 44]); p.rect(2, 6, 16, 2, [90, 90, 96]); p.rect(2, 18, 16, 2, [90, 90, 96]);
      p.finish();
      break;
    }
    case 'fountain': {
      p = new PixCanvas(48, 40);
      p.rect(2, 26, 44, 12, [130, 126, 120]); p.rect(4, 24, 40, 4, [80, 120, 200]);
      p.rect(20, 8, 8, 18, [130, 126, 120]); p.ell(24, 8, 8, 3, [130, 126, 120]);
      const fl = frame ? 1 : 0;
      for (let i = 0; i < 6; i++) p.set(24 + (i - 3) * 2, 4 + fl + (i % 2), [180, 210, 255]);
      p.finish();
      break;
    }
    case 'sign': {
      p = new PixCanvas(24, 24);
      p.rect(11, 10, 2, 14, [80, 54, 34]); p.rect(2, 2, 20, 10, [140, 100, 60]);
      p.finish();
      break;
    }
    case 'anvil': {
      p = new PixCanvas(24, 16);
      p.rect(4, 2, 18, 4, [80, 80, 90]); p.tri(0, 2, 4, 2, 4, 6, [80, 80, 90]); p.rect(9, 6, 7, 5, [70, 70, 80]); p.rect(6, 11, 13, 4, [60, 60, 70]);
      p.finish();
      break;
    }
    case 'shrine': {
      p = new PixCanvas(24, 40);
      p.rect(6, 12, 12, 26, [110, 110, 120]); p.rect(4, 36, 16, 4, [90, 90, 100]); p.rect(4, 10, 16, 3, [90, 90, 100]);
      p.ell(12, 6, 5, 5, frame ? [120, 220, 255] : [80, 180, 255]);
      p.finish();
      break;
    }
    case 'shrineUsed': {
      p = new PixCanvas(24, 40);
      p.rect(6, 12, 12, 26, [80, 80, 86]); p.rect(4, 36, 16, 4, [70, 70, 76]); p.rect(4, 10, 16, 3, [70, 70, 76]);
      p.ell(12, 6, 5, 5, [50, 50, 60]);
      p.finish();
      break;
    }
    case 'coin': {
      p = new PixCanvas(12, 12);
      p.ell(4, 8, 3, 2, [200, 150, 30]); p.ell(8, 8, 3, 2, [230, 180, 40]); p.ell(6, 5, 3, 2, [255, 220, 80]);
      p.finish();
      break;
    }
    case 'orb': {
      p = new PixCanvas(12, 12);
      p.ell(6, 6, 4, 4, [200, 20, 30]); p.ell(5, 5, 2, 2, [255, 120, 120]); p.set(4, 4, [255, 255, 255]);
      p.finish(null);
      break;
    }
    case 'bones': {
      p = new PixCanvas(24, 12);
      p.ell(6, 7, 3, 3, [210, 205, 190]); p.line(9, 9, 20, 7, [200, 195, 180], 2); p.line(12, 4, 18, 10, [200, 195, 180], 1);
      p.finish();
      break;
    }
    case 'pillarTop': {
      p = new PixCanvas(16, 16);
      p.rect(0, 0, 16, 16, [100, 100, 100]);
      break;
    }
    default:
      p = new PixCanvas(8, 8); p.rect(0, 0, 8, 8, [255, 0, 255]);
  }
  return p;
}

const objCache = new Map();
export function objectSprite(kind, frames = 1) {
  const key = kind + ':' + frames;
  if (objCache.has(key)) return objCache.get(key);
  const ps = [];
  for (let f = 0; f < frames; f++) ps.push(objPainter(kind, f));
  const w = ps[0].w, h = ps[0].h;
  const sheet = new PixCanvas(w * frames, h);
  ps.forEach((p, i) => p.blit(sheet, i * w, 0));
  const c = sheet.toCanvas();
  const res = { texture: sheetTexture(c), frames, pxW: w, pxH: h };
  objCache.set(key, res);
  return res;
}

// ---------------------------------------------------------------------------
// NPC shopkeepers (humanoid with specific outfits)
// ---------------------------------------------------------------------------
export const NPC_DEFS = {
  smith: { body: 'humanoid', palette: { body: 0x8a5a3c, dark: 0x3a2a20, accent: 0x555560, eye: 0x101010, skin: 0xd8a080 }, opts: { belt: true, weapon: 'axe' } },
  armorer: { body: 'humanoid', palette: { body: 0x7a7a88, dark: 0x303040, accent: 0xa0a0b0, eye: 0x101010, skin: 0xe0b090 }, opts: { armor: true, shield: true } },
  jeweler: { body: 'humanoid', palette: { body: 0x6a2a7a, dark: 0x2a1030, accent: 0xe0c040, eye: 0x101010, skin: 0xe8c0a0 }, opts: { robe: true, crown: true } },
  alchemist: { body: 'humanoid', palette: { body: 0x2a6a4a, dark: 0x103020, accent: 0x80ff80, eye: 0x80ffa0, skin: 0xe0c0a0 }, opts: { robe: true, hood: true, weapon: 'staff' } },
  gambler: { body: 'humanoid', palette: { body: 0x803030, dark: 0x301010, accent: 0xe0c040, eye: 0x101010, skin: 0xd09070 }, opts: { robe: true } },
};

// ---------------------------------------------------------------------------
// Item icons (24x24) — drawn per family with tier metal + rarity gem colors.
// ---------------------------------------------------------------------------

const TIER_METAL = [[150, 120, 90], [170, 175, 190], [210, 180, 80]];
const WOOD = [120, 80, 46];

const iconPainters = {
  crossbow(p, m, g) { p.line(4, 19, 18, 5, WOOD, 3); p.line(7, 6, 17, 16, m, 2); p.line(7, 6, 12, 11, [220, 220, 220]); p.set(19, 4, g); p.set(18, 4, g); },
  repeater(p, m, g) { p.line(4, 19, 18, 5, WOOD, 3); p.rect(10, 7, 6, 5, m); p.line(7, 6, 17, 16, m, 2); p.set(13, 9, g); },
  longbow(p, m, g) { for (let i = 0; i < 18; i++) { const a = -1.1 + (i / 17) * 2.2; p.set(12 + Math.cos(a) * -9 + 6, 12 + Math.sin(a) * 10, WOOD); p.set(12 + Math.cos(a) * -9 + 7, 12 + Math.sin(a) * 10, WOOD); } p.line(10, 3, 10, 21, [230, 230, 230]); p.rect(9, 11, 3, 3, m); p.set(10, 12, g); },
  wand(p, m, g) { p.line(5, 19, 16, 8, WOOD, 2); p.rect(15, 6, 3, 3, m); p.ell(18, 5, 2, 2, g); },
  staff(p, m, g) { p.line(4, 22, 17, 6, WOOD, 2); p.ell(18, 5, 3, 3, m); p.ell(18, 5, 2, 2, g); },
  gauntlet(p, m, g) { p.rect(6, 10, 12, 10, m); p.rect(6, 6, 3, 5, m); p.rect(9, 5, 3, 6, m); p.rect(12, 5, 3, 6, m); p.rect(15, 6, 3, 5, m); p.ell(12, 15, 2, 2, g); },
  tome(p, m, g) { p.rect(5, 4, 14, 17, [90, 30, 40]); p.rect(5, 4, 2, 17, m); p.rect(18, 5, 2, 15, [230, 220, 200]); p.ell(12, 12, 3, 3, g); },
  rod(p, m, g) { p.line(5, 21, 15, 8, m, 2); p.line(15, 8, 13, 3, m); p.line(15, 8, 20, 6, m); p.ell(16, 6, 2, 2, g); },
  blunderbuss(p, m, g) { p.line(3, 18, 10, 14, WOOD, 3); p.line(10, 14, 18, 7, m, 3); p.ell(19, 6, 3, 3, m); p.set(19, 6, [20, 20, 20]); p.set(8, 15, g); },
  cannon(p, m, g) { p.rect(4, 12, 16, 7, m); p.ell(19, 15, 3, 4, m); p.set(20, 15, [10, 10, 10]); p.rect(5, 18, 5, 4, WOOD); p.set(7, 14, g); },
  chakram(p, m, g) { p.ell(12, 12, 9, 9, m); p.ell(12, 12, 5, 5, [0, 0, 0]); for (let a = 0; a < 6.28; a += 1.05) p.set(12 + Math.cos(a) * 10, 12 + Math.sin(a) * 10, lt(m, 0.4)); p.set(12, 3, g); },
  censer(p, m, g) { p.line(12, 2, 12, 9, m); p.ell(12, 14, 6, 6, [215, 210, 190]); p.rect(9, 12, 2, 2, g); p.rect(13, 12, 2, 2, g); p.rect(10, 17, 4, 1, [40, 30, 30]); },
  horn(p, m, g) { for (let i = 0; i < 16; i++) { const t = i / 15; p.ell(4 + t * 15, 18 - Math.sin(t * 2.6) * 10, 1 + t * 3, 1 + t * 3, mix([230, 220, 190], m, t * 0.5)); } p.set(6, 17, g); },
  voidorb(p, m, g) { p.ell(12, 11, 7, 7, [30, 10, 50]); p.ell(12, 11, 5, 5, g); p.ell(12, 11, 2, 2, [0, 0, 0]); p.rect(9, 18, 6, 4, m); },
  javelin(p, m, g) { p.line(3, 21, 18, 6, WOOD, 2); p.tri(17, 3, 21, 7, 15, 9, m); p.set(18, 6, g); p.line(3, 21, 6, 20, [220, 40, 40]); },
  sling(p, m, g) { p.line(4, 4, 11, 16, [140, 100, 60]); p.line(20, 4, 13, 16, [140, 100, 60]); p.ell(12, 17, 3, 3, [110, 70, 40]); p.ell(12, 16, 2, 2, g); void m; },
  head(p, m, g) { p.ell(12, 12, 8, 8, m); p.rect(4, 12, 16, 9, m); p.rect(7, 13, 10, 2, [10, 10, 10]); p.rect(11, 13, 2, 6, [10, 10, 10]); p.set(12, 5, g); },
  chest(p, m, g) { p.rect(5, 4, 14, 17, m); p.rect(2, 4, 4, 8, m); p.rect(18, 4, 4, 8, m); p.rect(11, 8, 2, 10, dk(m, 0.7)); p.set(12, 10, g); },
  legs(p, m, g) { p.rect(6, 3, 12, 6, m); p.rect(6, 8, 5, 14, m); p.rect(13, 8, 5, 14, m); p.rect(5, 20, 6, 2, dk(m)); p.rect(13, 20, 6, 2, dk(m)); p.set(12, 5, g); },
  ring(p, m, g) { for (let a = 0; a < 6.28; a += 0.2) { p.set(12 + Math.cos(a) * 6, 14 + Math.sin(a) * 5, m); p.set(12 + Math.cos(a) * 5, 14 + Math.sin(a) * 4, dk(m, 0.8)); } p.ell(12, 8, 3, 3, g); p.set(11, 7, lt(g, 0.7)); },
  potion(p, m, g) { p.rect(10, 3, 4, 5, [180, 180, 200]); p.ell(12, 14, 7, 7, [200, 220, 240]); p.ell(12, 15, 6, 5, g); p.set(9, 12, [255, 255, 255]); void m; },
};

const iconCache = new Map();
export function itemIconCanvas(iconKey, tier = 0, gemColor = [255, 255, 255]) {
  const key = iconKey + '|' + tier + '|' + gemColor.join(',');
  if (iconCache.has(key)) return iconCache.get(key);
  const p = new PixCanvas(24, 24);
  (iconPainters[iconKey] || iconPainters.ring)(p, TIER_METAL[Math.min(2, tier)], gemColor);
  p.finish();
  const c = p.toCanvas();
  iconCache.set(key, c);
  return c;
}

const iconTexCache = new Map();
export function itemIconTexture(iconKey, tier, gemColor) {
  const key = iconKey + '|' + tier + '|' + gemColor.join(',');
  if (!iconTexCache.has(key)) iconTexCache.set(key, sheetTexture(itemIconCanvas(iconKey, tier, gemColor)));
  return iconTexCache.get(key);
}

export function randomPalette(seed) {
  const r = new RNG(seed);
  const hue = r.next();
  const hsl = (h, s, l) => {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  };
  return { body: hsl(hue, 0.4, 0.45), dark: hsl(hue, 0.35, 0.22), accent: hsl((hue + 0.5) % 1, 0.5, 0.55), eye: hsl((hue + 0.3) % 1, 1, 0.6) };
}
