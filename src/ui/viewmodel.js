// First-person weapon sprites, painted procedurally per weapon family.
import { PixCanvas, dk, lt, mix } from '../gfx/pixel.js';

const W = 112, H = 80;
const SKIN = [200, 150, 110], GLOVE = [90, 60, 40], WOOD = [116, 76, 44], IRON = [130, 130, 140];
const TIER_METAL = [[140, 110, 80], [165, 170, 185], [215, 180, 70]];

function hand(p, x, y, glove = GLOVE) {
  p.ell(x, y, 9, 7, glove);
  p.rect(x - 9, y + 2, 18, 14, glove);
  for (let i = 0; i < 4; i++) p.ell(x - 6 + i * 4, y - 6, 2, 3, lt(glove, 0.1));
}

const painters = {
  crossbow(p, m, g) {
    p.line(56, 80, 56, 30, WOOD, 9);
    p.line(56, 30, 56, 18, m, 5);
    // prod
    for (let i = -34; i <= 34; i++) p.ell(56 + i, 28 + Math.abs(i) * 0.18, 1.5, 2, m);
    p.line(22, 34, 56, 44, [220, 220, 220]); p.line(90, 34, 56, 44, [220, 220, 220]);
    p.line(56, 46, 56, 14, [180, 170, 150], 2); p.tri(53, 15, 59, 15, 56, 8, g);
    hand(p, 56, 70);
    return [56, 10];
  },
  repeater(p, m, g) {
    p.line(56, 80, 56, 30, WOOD, 10);
    p.rect(46, 26, 20, 16, m); p.rect(48, 28, 16, 3, dk(m));
    for (let i = -30; i <= 30; i++) p.ell(56 + i, 26 + Math.abs(i) * 0.2, 1.5, 2, m);
    p.line(26, 32, 56, 40, [220, 220, 220]); p.line(86, 32, 56, 40, [220, 220, 220]);
    p.line(56, 26, 56, 12, [180, 170, 150], 2); p.set(56, 10, g); p.set(56, 11, g);
    p.ell(56, 34, 3, 3, g);
    hand(p, 52, 70); hand(p, 72, 58);
    return [56, 10];
  },
  longbow(p, m, g) {
    for (let y = 0; y < 80; y++) { const x = 34 + Math.pow((y - 40) / 40, 2) * 18; p.ell(x, y, 2.2, 1, WOOD); }
    p.line(52, 0, 52, 80, [230, 230, 230]);
    p.line(36, 44, 70, 20, [170, 140, 100], 2); p.tri(68, 16, 74, 20, 72, 14, m); p.set(71, 17, g);
    hand(p, 36, 48); hand(p, 82, 74);
    return [72, 16];
  },
  wand(p, m, g) {
    p.line(80, 80, 62, 28, WOOD, 5);
    p.rect(58, 24, 8, 6, m);
    p.ell(62, 18, 5, 5, g); p.ell(61, 17, 2, 2, lt(g, 0.6));
    hand(p, 76, 70);
    return [62, 16];
  },
  staff(p, m, g) {
    p.line(90, 80, 58, 14, WOOD, 6);
    p.line(52, 6, 58, 14, m, 2); p.line(66, 6, 58, 14, m, 2);
    p.ell(58, 8, 7, 7, g); p.ell(56, 6, 3, 3, lt(g, 0.6));
    hand(p, 82, 64);
    return [58, 8];
  },
  gauntlet(p, m, g) {
    p.rect(36, 50, 40, 30, m); p.rect(36, 50, 40, 4, lt(m, 0.2));
    for (let i = 0; i < 4; i++) { p.rect(38 + i * 10, 34, 8, 18, m); p.rect(38 + i * 10, 34, 8, 2, lt(m, 0.3)); }
    p.rect(26, 52, 12, 10, m);
    p.ell(56, 60, 8, 6, g); p.ell(56, 60, 4, 3, lt(g, 0.6));
    return [56, 34];
  },
  tome(p, m, g) {
    p.tri(20, 60, 56, 52, 56, 80, [230, 220, 200]); p.tri(20, 60, 20, 80, 56, 80, [230, 220, 200]);
    p.tri(92, 60, 56, 52, 56, 80, [220, 210, 190]); p.tri(92, 60, 92, 80, 56, 80, [220, 210, 190]);
    p.rect(16, 62, 4, 18, [90, 30, 40]); p.rect(92, 62, 4, 18, [90, 30, 40]);
    for (let i = 0; i < 4; i++) { p.rect(28, 64 + i * 4, 20, 1, g); p.rect(64, 64 + i * 4, 20, 1, g); }
    p.ell(56, 46, 5, 5, g);
    hand(p, 24, 76, m); hand(p, 88, 76, m);
    return [56, 44];
  },
  rod(p, m, g) {
    p.line(82, 80, 58, 22, m, 5);
    p.line(58, 22, 50, 8, m, 2); p.line(58, 22, 66, 8, m, 2); p.line(58, 22, 58, 4, m, 2);
    p.ell(58, 20, 3, 3, g);
    hand(p, 78, 68);
    return [58, 6];
  },
  blunderbuss(p, m, g) {
    p.line(66, 80, 58, 50, WOOD, 12);
    p.line(58, 52, 56, 18, m, 7);
    p.ell(56, 16, 9, 5, m); p.ell(56, 16, 6, 3, [20, 16, 16]);
    p.rect(54, 44, 4, 4, g);
    hand(p, 64, 72); hand(p, 44, 50);
    return [56, 12];
  },
  cannon(p, m, g) {
    p.rect(44, 24, 24, 56, m); p.rect(44, 24, 4, 56, lt(m, 0.25));
    p.ell(56, 24, 13, 6, lt(m, 0.1)); p.ell(56, 24, 8, 4, [16, 12, 12]);
    p.rect(40, 50, 32, 4, dk(m)); p.rect(40, 66, 32, 4, dk(m));
    p.ell(56, 58, 3, 3, g);
    hand(p, 34, 72); hand(p, 80, 72);
    return [56, 20];
  },
  chakram(p, m, g) {
    for (let a = 0; a < Math.PI * 2; a += 0.04) {
      p.ell(56 + Math.cos(a) * 20, 40 + Math.sin(a) * 14, 2.5, 2.5, m);
    }
    for (let a = 0; a < Math.PI * 2; a += 0.5) p.tri(56 + Math.cos(a) * 21, 40 + Math.sin(a) * 15, 56 + Math.cos(a + 0.2) * 21, 40 + Math.sin(a + 0.2) * 15, 56 + Math.cos(a + 0.1) * 27, 40 + Math.sin(a + 0.1) * 19, lt(m, 0.4));
    p.set(56, 26, g);
    hand(p, 56, 64);
    return [56, 30];
  },
  censer(p, m, g) {
    p.line(70, 70, 62, 34, m, 1); p.line(72, 70, 66, 34, m, 1);
    p.ell(62, 28, 10, 9, [215, 210, 190]); p.rect(56, 26, 4, 3, g); p.rect(64, 26, 4, 3, g); p.rect(58, 33, 8, 2, [40, 30, 30]);
    p.ell(62, 20, 4, 3, dk(g, 0.8));
    hand(p, 72, 74);
    return [62, 26];
  },
  horn(p, m, g) {
    for (let i = 0; i < 40; i++) { const t = i / 39; p.ell(84 - t * 40, 76 - Math.sin(t * 2.6) * 40, 2 + t * 10, 2 + t * 10, mix([230, 220, 190], m, t * 0.4)); }
    p.ell(44, 44, 8, 8, [40, 30, 20]);
    p.rect(60, 54, 10, 3, g);
    hand(p, 82, 74);
    return [44, 40];
  },
  voidorb(p, m, g) {
    hand(p, 56, 72, m);
    p.ell(56, 36, 16, 16, [24, 8, 40]); p.ell(56, 36, 12, 12, g); p.ell(56, 36, 6, 6, [0, 0, 0]); p.ell(50, 30, 3, 3, lt(g, 0.6));
    return [56, 36];
  },
  javelin(p, m, g) {
    p.line(66, 80, 58, 18, WOOD, 4);
    p.tri(54, 20, 62, 20, 58, 4, m); p.set(58, 12, g);
    p.line(64, 70, 62, 62, [200, 40, 40], 2);
    hand(p, 64, 70);
    return [58, 6];
  },
  sling(p, m, g) {
    p.line(64, 70, 50, 34, [140, 100, 60], 1); p.line(74, 70, 62, 34, [140, 100, 60], 1);
    p.ell(56, 32, 7, 5, [110, 70, 40]); p.ell(56, 30, 4, 3, g);
    hand(p, 70, 74);
    return [56, 28];
  },
};

const cache = new Map();
export function viewmodelCanvas(icon, tier, gem) {
  const key = icon + tier + gem.join(',');
  if (cache.has(key)) return cache.get(key);
  const p = new PixCanvas(W, H);
  const f = painters[icon] || painters.wand;
  const tip = f(p, TIER_METAL[tier] || IRON, gem);
  p.finish([10, 6, 6]);
  const res = { canvas: p.toCanvas(), tip, w: W, h: H };
  cache.set(key, res);
  return res;
}
