// Diablo-style procedural dungeon floors: rooms + MST corridors + loops,
// raised platforms (some only reachable with extra jumps), torches, packs.
import { Level, T, tileCenter } from './level.js';
import { RNG } from '../rng.js';
import { THEMES } from '../gfx/textures.js';
import { floorRoster, MONSTER_MODS, uniqueMonsterName } from '../combat/enemyTypes.js';

export function themeForDepth(depth) {
  return THEMES[Math.floor((depth - 1) / 4) % THEMES.length];
}

export function generateDungeon(depth, seed) {
  const rng = new RNG(seed);
  const theme = themeForDepth(depth);
  const size = 44 + Math.min(28, depth * 2);
  const lvl = new Level(size, size, { ceilH: 4.5 + (rng.chance(0.3) ? 1.5 : 0), ambient: theme.ambient });
  lvl.theme = theme;
  lvl.depth = depth;

  // --- rooms ---------------------------------------------------------------
  const rooms = [];
  const target = 9 + Math.min(12, Math.floor(depth / 2)) + rng.int(0, 3);
  for (let a = 0; a < 600 && rooms.length < target; a++) {
    const w = rng.int(5, 11), h = rng.int(5, 11);
    const x = rng.int(2, size - w - 3), y = rng.int(2, size - h - 3);
    let ok = true;
    for (const r of rooms) if (x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y) { ok = false; break; }
    if (!ok) continue;
    rooms.push({ x, y, w, h, cx: x + Math.floor(w / 2), cz: y + Math.floor(h / 2), shape: rng.chance(0.25) ? 'cross' : 'rect' });
  }
  for (const r of rooms) {
    for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) {
      if (r.shape === 'cross') {
        const ci = Math.abs(i - (r.w - 1) / 2) > r.w / 4, cj = Math.abs(j - (r.h - 1) / 2) > r.h / 4;
        if (ci && cj) continue; // cut corners
      }
      lvl.open(r.x + i, r.y + j);
    }
  }

  // --- corridors: Prim MST + extra loops -----------------------------------
  const edges = [];
  const inTree = new Set([0]);
  while (inTree.size < rooms.length) {
    let best = null;
    for (const a of inTree) for (let b = 0; b < rooms.length; b++) {
      if (inTree.has(b)) continue;
      const d = Math.abs(rooms[a].cx - rooms[b].cx) + Math.abs(rooms[a].cz - rooms[b].cz);
      if (!best || d < best.d) best = { a, b, d };
    }
    inTree.add(best.b);
    edges.push([best.a, best.b]);
  }
  for (let k = 0; k < Math.floor(rooms.length * 0.3); k++) {
    const a = rng.int(0, rooms.length - 1), b = rng.int(0, rooms.length - 1);
    if (a !== b) edges.push([a, b]);
  }
  const carve = (x, z, wide) => {
    for (let dz = 0; dz < (wide ? 2 : 1); dz++) for (let dx = 0; dx < (wide ? 2 : 1); dx++) {
      const tx = x + dx, tz = z + dz;
      if (tx < 1 || tz < 1 || tx >= size - 1 || tz >= size - 1) continue;
      if (lvl.isSolid(tx, tz)) lvl.open(tx, tz);
    }
  };
  for (const [ai, bi] of edges) {
    const a = rooms[ai], b = rooms[bi];
    const wide = rng.chance(0.35);
    let x = a.cx, z = a.cz;
    const horizFirst = rng.chance(0.5);
    const stepX = () => { while (x !== b.cx) { carve(x, z, wide); x += Math.sign(b.cx - x); } };
    const stepZ = () => { while (z !== b.cz) { carve(x, z, wide); z += Math.sign(b.cz - z); } };
    if (horizFirst) { stepX(); stepZ(); } else { stepZ(); stepX(); }
    carve(x, z, wide);
  }

  // --- entrance / exit -------------------------------------------------------
  const bfs = (sx, sz) => {
    const dist = new Int32Array(size * size).fill(-1);
    const q = [sx, sz]; dist[lvl.idx(sx, sz)] = 0;
    let h = 0;
    while (h < q.length) {
      const x = q[h++], z = q[h++];
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox, nz = z + oz;
        if (lvl.isSolid(nx, nz)) continue;
        const i = lvl.idx(nx, nz);
        if (dist[i] < 0) { dist[i] = dist[lvl.idx(x, z)] + 1; q.push(nx, nz); }
      }
    }
    return dist;
  };
  const entrance = rooms[rng.int(0, rooms.length - 1)];
  const d0 = bfs(entrance.cx, entrance.cz);
  let exit = entrance, best = -1;
  for (const r of rooms) { const d = d0[lvl.idx(r.cx, r.cz)]; if (d > best) { best = d; exit = r; } }
  entrance.special = 'entrance'; exit.special = 'exit';

  // --- room features -------------------------------------------------------
  const objects = lvl.objects;
  const platformChests = [];
  for (const r of rooms) {
    if (r.special || r.shape !== 'rect') continue;
    const iw = r.w - 2, ih = r.h - 2;
    const roll = rng.next();
    if (roll < 0.32 && iw >= 3 && ih >= 3) {
      // raised platform inside the room, 1-tile walkway around
      const pw = rng.int(2, Math.min(5, iw - 1)), ph = rng.int(2, Math.min(5, ih - 1));
      const px = r.x + 1 + rng.int(0, iw - pw), pz = r.y + 1 + rng.int(0, ih - ph);
      const kind = rng.next();
      const high = kind < 0.55;
      const H = high ? 2.0 : 0.95;
      for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) lvl.open(px + i, pz + j, H, 1);
      if (high && kind < 0.3) {
        // add walkable steps up the side
        const side = rng.int(0, 1);
        for (let s = 1; s <= 3; s++) {
          const tx = side ? px - 1 : px + pw, tz = pz + Math.min(ph - 1, s - 1);
          if (tx > r.x && tx < r.x + r.w - 1) lvl.open(tx, tz, H * (s / 4), 1);
        }
      }
      platformChests.push({ x: tileCenter(px + Math.floor(pw / 2)), z: tileCenter(pz + Math.floor(ph / 2)), y: H, good: high });
      r.platform = true;
    } else if (roll < 0.5 && iw >= 5 && ih >= 5) {
      // pillars hall
      for (let j = 1; j < r.h - 1; j += 2) for (let i = 1; i < r.w - 1; i += 2) {
        if (i === Math.floor(r.w / 2) || j === Math.floor(r.h / 2)) continue;
        if (i > 1 && i < r.w - 2 && j > 1 && j < r.h - 2) { lvl.solid[lvl.idx(r.x + i, r.y + j)] = 2; }
      }
    }
  }
  // make sure pillars didn't seal anything: re-run BFS and unseal unreachable open tiles
  {
    const d = bfs(entrance.cx, entrance.cz);
    for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
      if (!lvl.isSolid(x, z) && d[lvl.idx(x, z)] < 0 && lvl.floorH[lvl.idx(x, z)] === 0) {
        // carve a path toward the room center of the nearest room
        let tx = x, tz = z;
        const r = rooms.reduce((b, rr) => (Math.abs(rr.cx - x) + Math.abs(rr.cz - z) < Math.abs(b.cx - x) + Math.abs(b.cz - z) ? rr : b), rooms[0]);
        while (tx !== r.cx || tz !== r.cz) {
          if (tx !== r.cx) tx += Math.sign(r.cx - tx); else tz += Math.sign(r.cz - tz);
          if (lvl.isSolid(tx, tz)) lvl.open(tx, tz);
        }
      }
    }
  }

  // --- torches --------------------------------------------------------------
  const torchCol = theme.torch;
  for (const r of rooms) {
    const n = rng.int(1, 3) + (r.special ? 1 : 0);
    for (let k = 0; k < n; k++) {
      for (let a = 0; a < 30; a++) {
        const tx = rng.int(r.x, r.x + r.w - 1), tz = rng.int(r.y, r.y + r.h - 1);
        if (lvl.isSolid(tx, tz) || lvl.floorH[lvl.idx(tx, tz)] > 0) continue;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ox, oz]) => lvl.isSolid(tx + ox, tz + oz));
        if (!dirs.length) continue;
        const [ox, oz] = rng.pick(dirs);
        const x = tileCenter(tx) + ox * (T / 2 - 0.15), z = tileCenter(tz) + oz * (T / 2 - 0.15);
        objects.push({ type: 'torch', x, z, y: 1.9 });
        lvl.lights.push({ x, z, y: 2.2, color: torchCol, radius: 10, intensity: 1.0 });
        break;
      }
    }
    if (!r.special && !r.platform && rng.chance(0.25)) {
      const x = tileCenter(r.cx), z = tileCenter(r.cz);
      if (!lvl.isSolid(r.cx, r.cz) && lvl.floorH[lvl.idx(r.cx, r.cz)] === 0) {
        objects.push({ type: 'brazier', x, z, y: 0 });
        lvl.lights.push({ x, z, y: 1.5, color: torchCol, radius: 12, intensity: 1.2 });
        r.center = true;
      }
    }
  }
  // corridor lights: sparse
  for (let k = 0; k < Math.floor(size / 6); k++) {
    const t = lvl.randomOpen(rng, (x, z) => !rooms.some((r) => x >= r.x && x < r.x + r.w && z >= r.y && z < r.y + r.h));
    if (!t) break;
    lvl.lights.push({ x: tileCenter(t[0]), z: tileCenter(t[1]), y: 3, color: theme.ambient.map((v) => v * 1.6), radius: 7, intensity: 0.8 });
  }

  // --- entrance / exit objects ---------------------------------------------
  const ex = tileCenter(entrance.cx), ez = tileCenter(entrance.cz);
  objects.push({ type: 'portalUp', x: ex, z: ez, y: 0 });
  lvl.lights.push({ x: ex, z: ez, y: 1.5, color: [0.4, 0.5, 1.0], radius: 9, intensity: 1.2 });
  lvl.spawn = { x: ex + T, z: ez, yaw: 0 };
  // make sure spawn tile is open
  if (lvl.isSolid(entrance.cx + 1, entrance.cz)) lvl.spawn.x = ex - T;
  if (lvl.isSolid(Math.floor(lvl.spawn.x / T), entrance.cz)) { lvl.spawn.x = ex; lvl.spawn.z = ez + T; }
  const sx = tileCenter(exit.cx), sz = tileCenter(exit.cz);
  objects.push({ type: 'stairsDown', x: sx, z: sz, y: 0 });
  lvl.lights.push({ x: sx, z: sz, y: 1.2, color: [1.0, 0.3, 0.2], radius: 9, intensity: 1.2 });
  lvl.exitPos = { x: sx, z: sz };

  // --- chests / shrines -------------------------------------------------------
  for (const pc of platformChests) objects.push({ type: 'chest', x: pc.x, z: pc.z, y: pc.y, gold: pc.good && rng.chance(0.6) });
  const nChests = rng.int(1, 3);
  for (let k = 0; k < nChests; k++) {
    const r = rng.pick(rooms);
    const t = lvl.randomOpen(rng, (x, z) => x >= r.x && x < r.x + r.w && z >= r.y && z < r.y + r.h && lvl.floorH[lvl.idx(x, z)] === 0);
    if (t) objects.push({ type: 'chest', x: tileCenter(t[0]), z: tileCenter(t[1]), y: 0, gold: rng.chance(0.12) });
  }
  const shrineKinds = ['might', 'swift', 'armor', 'wisdom', 'fortune', 'frenzy'];
  const nShr = rng.int(0, 2);
  for (let k = 0; k < nShr; k++) {
    const r = rng.pick(rooms.filter((rr) => !rr.special));
    if (!r) break;
    const t = lvl.randomOpen(rng, (x, z) => x >= r.x && x < r.x + r.w && z >= r.y && z < r.y + r.h && lvl.floorH[lvl.idx(x, z)] === 0);
    if (t) {
      objects.push({ type: 'shrine', kind: rng.pick(shrineKinds), x: tileCenter(t[0]), z: tileCenter(t[1]), y: 0 });
      lvl.lights.push({ x: tileCenter(t[0]), z: tileCenter(t[1]), y: 2, color: [0.3, 0.7, 1.0], radius: 6, intensity: 0.8 });
    }
  }
  // decor
  for (let k = 0; k < size / 2; k++) {
    const t = lvl.randomOpen(rng, (x, z) => lvl.floorH[lvl.idx(x, z)] === 0);
    if (t) objects.push({ type: rng.chance(0.6) ? 'bones' : 'barrel', x: tileCenter(t[0]) + rng.float(-0.8, 0.8), z: tileCenter(t[1]) + rng.float(-0.8, 0.8), y: 0 });
  }

  // --- monsters -------------------------------------------------------------
  const roster = floorRoster(depth, rng);
  lvl.roster = roster;
  const inRoom = (r) => (x, z) => x >= r.x && x < r.x + r.w && z >= r.y && z < r.y + r.h && lvl.floorH[lvl.idx(x, z)] === 0;
  const farFromEntrance = (tx, tz) => Math.abs(tx - entrance.cx) + Math.abs(tz - entrance.cz) > 7;
  const spawnPack = (r, type, count, extra = {}) => {
    for (let n = 0; n < count; n++) {
      const t = lvl.randomOpen(rng, (x, z) => inRoom(r)(x, z) && farFromEntrance(x, z));
      if (!t) continue;
      objects.push({ type: 'monster', typeId: type.id, x: tileCenter(t[0]) + rng.float(-0.6, 0.6), z: tileCenter(t[1]) + rng.float(-0.6, 0.6), ...extra });
    }
  };
  const packBonus = Math.min(4, Math.floor(depth / 8));
  for (const r of rooms) {
    if (r.special === 'entrance') continue;
    if (r.special !== 'exit' && rng.chance(0.25)) continue;
    const packs = 1 + (r.w * r.h > 60 && depth > 3 && rng.chance(0.5) ? 1 : 0);
    for (let p = 0; p < packs; p++) {
      const type = rng.pick(roster);
      const [a, b] = type.family.pack;
      const champion = depth >= 2 && rng.chance(0.1);
      const n = Math.max(1, Math.round(rng.int(a, b) * (depth < 4 ? 0.7 : 1)) + (a > 1 ? packBonus : 0) - (champion ? 1 : 0));
      spawnPack(r, type, n, champion ? { champion: true } : {});
    }
  }
  // corridor wanderers
  for (let k = 0; k < Math.min(14, 2 + Math.floor(depth / 2)); k++) {
    const t = lvl.randomOpen(rng, (x, z) => farFromEntrance(x, z) && lvl.floorH[lvl.idx(x, z)] === 0);
    if (t) objects.push({ type: 'monster', typeId: rng.pick(roster).id, x: tileCenter(t[0]), z: tileCenter(t[1]) });
  }
  // unique boss pack(s)
  const nUnique = depth >= 2 ? 1 + (depth >= 10 ? 1 : 0) + (depth % 5 === 0 ? 1 : 0) : 0;
  for (let u = 0; u < nUnique; u++) {
    const cand = rooms.filter((r) => r.special !== 'entrance');
    const r = u === 0 ? exit : rng.pick(cand);
    const type = rng.pick(roster);
    const mods = rng.shuffle([...MONSTER_MODS]).slice(0, Math.min(4, 1 + Math.floor(depth / 8))).map((m) => m.id);
    const t = lvl.randomOpen(rng, (x, z) => inRoom(r)(x, z) && farFromEntrance(x, z));
    if (!t) continue;
    objects.push({ type: 'monster', typeId: type.id, x: tileCenter(t[0]), z: tileCenter(t[1]), unique: true, name: uniqueMonsterName(rng), mods });
    spawnPack(r, type, rng.int(2, 4), { minion: true });
  }

  // cap the population for performance on mobile
  const cap = 55 + Math.min(35, depth);
  let mons = objects.filter((o) => o.type === 'monster' && !o.unique && !o.minion);
  while (objects.filter((o) => o.type === 'monster').length > cap && mons.length) {
    const victim = mons.splice(rng.int(0, mons.length - 1), 1)[0];
    objects.splice(objects.indexOf(victim), 1);
  }
  lvl.rooms = rooms;
  lvl.bakeLighting();
  return lvl;
}
