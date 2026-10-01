// Projectile simulation: dozens of composable behaviours (homing, split, chain,
// bounce, explode, nova, meteor, fractal, chaos...) for both player and monsters.
import * as THREE from 'three';
import { G } from '../state.js';
import { rng } from '../rng.js';
import { ELEMENTS } from '../items/itemData.js';
import { damageEnemy, knockEnemy } from './enemies.js';
import { damagePlayer } from '../player.js';
import { sfx } from '../audio.js';

const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
const CHAOS_ELEMS = ['fire', 'cold', 'lightning', 'poison', 'arcane', 'void'];
const CHAOS_FX = ['homing', 'bounce', 'split', 'explode', 'sine', 'chain', 'grow', 'pierce'];

export function elemColor(el) { return (ELEMENTS[el] || ELEMENTS.physical).color; }

// Spawn one projectile. opts: everything in a "shot"
export function spawnProjectile(o) {
  const p = {
    x: o.x, y: o.y, z: o.z,
    vx: o.dx * o.speed, vy: o.dy * o.speed, vz: o.dz * o.speed,
    speed: o.speed,
    hostile: !!o.hostile,
    kind: o.kind || 'bolt',
    elem: o.elem || 'physical',
    elems: o.elems || null,
    dmg: o.dmg,
    size: o.size || 0.12,
    size0: o.size || 0.12,
    life: o.life || 2,
    maxLife: o.life || 2,
    age: 0,
    gravity: o.gravity || 0,
    homing: o.homing || 0,
    pierce: o.pierce || 0,
    bounce: o.bounce || 0,
    split: o.split || 0,
    chain: o.chain || 0,
    explode: o.explode || 0,
    cluster: o.cluster || 0,
    nova: o.nova || 0,
    boomerang: o.boomerang || 0,
    sine: o.sine || 0,
    spiral: o.spiral || 0,
    grow: o.grow || 0,
    well: o.well || 0,
    puddle: o.puddle || 0,
    fractal: o.fractal || 0,
    knock: o.knock || 0,
    gen: o.gen || 0,
    spec: o.spec || null,
    hit: new Set(),
    target: null,
    retarget: 0,
    phase: rng.float(0, Math.PI * 2),
    bx: o.x, by: o.y, bz: o.z,
    tick: 0,
    dead: false,
  };
  if (p.boomerang) { p.life *= 1.8; p.maxLife = p.life; }
  if (p.sine) {
    // perpendicular (horizontal) for weaving
    const l = Math.hypot(o.dx, o.dz) || 1;
    p.px = -o.dz / l; p.pz = o.dx / l;
  }
  p.color = elemColor(p.elem);
  G.projectiles.push(p);
  return p;
}

// Fire the player's weapon spec from eye position along a direction
export function fireWeapon(spec, origin, dir, right) {
  const shots = spec.count;
  const baseCount = spec.base.count || 1;
  for (let i = 0; i < shots; i++) {
    // pattern: base spread cone + fan for extra projectiles
    let yawOff = 0, pitchOff = 0;
    if (i >= baseCount || baseCount === 1) {
      const fanIdx = baseCount === 1 ? i : i - baseCount + 1;
      const fanN = baseCount === 1 ? shots : shots - baseCount + 1;
      if (fanN > 1) yawOff = (fanIdx - (fanN - 1) / 2) * (spec.fan || 0.07);
    }
    if (spec.spread) { yawOff += rng.float(-spec.spread, spec.spread); pitchOff += rng.float(-spec.spread, spec.spread) * 0.6; }
    const d = dir.clone();
    if (yawOff) d.applyAxisAngle(THREE.Object3D.DEFAULT_UP, yawOff);
    if (pitchOff) d.addScaledVector(new THREE.Vector3(0, 1, 0), pitchOff).normalize();
    let elem = spec.element, extra = {};
    if (spec.chaos) {
      elem = rng.pick(CHAOS_ELEMS);
      const f = rng.pick(CHAOS_FX);
      extra = { homing: 3, bounce: 3, split: 3, explode: 2.5, sine: 1, chain: 3, grow: 2, pierce: 4 };
      extra = { [f]: extra[f] };
    }
    const dmg = rng.float(spec.dmg[0], spec.dmg[1]);
    spawnProjectile({
      x: origin.x + right.x * 0.25, y: origin.y - 0.2, z: origin.z + right.z * 0.25,
      dx: d.x, dy: d.y, dz: d.z,
      speed: spec.speed * (spec.proj === 'flame' ? rng.float(0.8, 1.2) : 1),
      kind: spec.proj, elem, elems: spec.elems, dmg,
      size: spec.size, life: spec.life, gravity: spec.gravity, homing: spec.homing,
      pierce: spec.pierce, bounce: spec.bounce, split: spec.split, chain: spec.chain,
      explode: spec.explode, cluster: spec.cluster, nova: spec.nova, boomerang: spec.boomerang,
      sine: spec.sine, spiral: spec.spiral ? (i % 2 ? 1 : -1) * 2.2 : 0, grow: spec.grow, well: spec.well,
      puddle: spec.puddle, fractal: spec.fractal, knock: spec.knock, spec,
      ...extra,
    });
  }
  // meteors
  if (spec.meteor && rng.chance(spec.meteor / 100)) {
    const hit = aimPoint(origin, dir, 30);
    callMeteor(hit, spec);
  }
}

export function aimPoint(origin, dir, maxDist) {
  const step = 0.4;
  const p = origin.clone();
  for (let t = 0; t < maxDist; t += step) {
    p.addScaledVector(dir, step);
    if (G.level.pointSolid(p.x, p.y, p.z)) return p;
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < e.radius + 0.3 && p.y >= e.pos.y && p.y <= e.pos.y + e.height) return p;
    }
  }
  return p;
}

function callMeteor(at, spec) {
  const dmg = rng.float(spec.dmg[0], spec.dmg[1]) * 2.5;
  spawnProjectile({
    x: at.x + rng.float(-2, 2), y: at.y + 14, z: at.z + rng.float(-2, 2),
    dx: 0, dy: -1, dz: 0, speed: 26, kind: 'meteor', elem: 'fire', dmg, size: 0.6, life: 2,
    explode: 3.5, cluster: spec.cluster || 0, spec, pierce: 0,
  });
  // nudge direction toward target
  const m = G.projectiles[G.projectiles.length - 1];
  tmpA.set(at.x - m.x, at.y - m.y, at.z - m.z).normalize().multiplyScalar(26);
  m.vx = tmpA.x; m.vy = tmpA.y; m.vz = tmpA.z;
}

// Monster shot
export function enemyShoot(e, kind, target, opts = {}) {
  const ox = e.pos.x, oy = e.pos.y + e.height * 0.65, oz = e.pos.z;
  tmpA.set(target.x - ox, target.y - oy, target.z - oz);
  const dist = tmpA.length();
  tmpA.normalize();
  const speed = opts.speed || 14;
  let gravity = 0;
  if (opts.arc) {
    gravity = 9;
    // add upward component so the glob lands near the target
    const t = dist / speed;
    tmpA.y += (0.5 * gravity * t) / speed;
    tmpA.normalize();
  }
  const kindMap = { arrow: 'arrow', magic: 'missile', fire: 'orb', bolt: 'spark', spit: 'glob', frost: 'shard', skull: 'skull' };
  const n = opts.count || 1;
  for (let i = 0; i < n; i++) {
    const d = tmpA.clone();
    if (n > 1) d.applyAxisAngle(THREE.Object3D.DEFAULT_UP, (i - (n - 1) / 2) * 0.18);
    spawnProjectile({
      x: ox, y: oy, z: oz, dx: d.x, dy: d.y, dz: d.z, speed, hostile: true,
      kind: kindMap[kind] || 'missile', elem: opts.elem || (kind === 'fire' ? 'fire' : kind === 'frost' ? 'cold' : kind === 'spit' ? 'poison' : kind === 'bolt' ? 'lightning' : kind === 'arrow' ? 'physical' : 'arcane'),
      dmg: opts.dmg, size: kind === 'fire' ? 0.25 : kind === 'skull' ? 0.25 : 0.14, life: 4, gravity,
      homing: opts.homing || 0, explode: opts.explode || 0,
    });
  }
}

export function enemyNova(e, n, dmg, elem) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    spawnProjectile({
      x: e.pos.x, y: e.pos.y + e.height * 0.5, z: e.pos.z, dx: Math.cos(a), dy: 0, dz: Math.sin(a), speed: 9, hostile: true,
      kind: elem === 'cold' ? 'shard' : 'missile', elem, dmg, size: 0.18, life: 3,
    });
  }
}

// ---------------------------------------------------------------------------

function findTarget(p, range = 22) {
  let best = null, bd = range * range;
  const vl = Math.hypot(p.vx, p.vy, p.vz) || 1;
  for (const e of G.enemies) {
    if (e.dead || p.hit.has(e)) continue;
    const dx = e.pos.x - p.x, dy = e.pos.y + e.height * 0.5 - p.y, dz = e.pos.z - p.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > bd) continue;
    const dot = (dx * p.vx + dy * p.vy + dz * p.vz) / (Math.sqrt(d2) * vl);
    if (dot < -0.1 && !p.boomerang) continue;
    if (!G.level.los(p.x, p.z, e.pos.x, e.pos.z)) continue;
    bd = d2; best = e;
  }
  return best;
}

export function nearestEnemy(x, y, z, range, exclude) {
  let best = null, bd = range * range;
  for (const e of G.enemies) {
    if (e.dead || (exclude && exclude.has(e))) continue;
    const dx = e.pos.x - x, dz = e.pos.z - z, dy = e.pos.y + e.height * 0.5 - y;
    const d2 = dx * dx + dz * dz + dy * dy;
    if (d2 < bd && G.level.los(x, z, e.pos.x, e.pos.z)) { bd = d2; best = e; }
  }
  return best;
}

function explode(p, x, y, z) {
  const R = p.explode * (p.grow ? p.size / p.size0 : 1) ** 0.5;
  const col = p.color;
  G.fx.explosion({ x, y, z }, R, col);
  sfx('explode', Math.min(1, R / 4));
  if (p.hostile) {
    const pl = G.player;
    const d = Math.hypot(pl.pos.x - x, pl.pos.y + 0.9 - y, pl.pos.z - z);
    if (d < R + 0.4) damagePlayer(p.dmg * (1 - (d / (R + 0.4)) * 0.5), p.elem, { x, z });
  } else {
    for (const e of G.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.pos.x - x, e.pos.y + e.height * 0.5 - y, e.pos.z - z) - e.radius;
      if (d < R) {
        damageEnemy(e, p.dmg * 0.8 * (1 - Math.max(0, d / R) * 0.5), p.elem, p.spec, { aoe: true });
        knockEnemy(e, x, z, 4 + p.knock);
      }
    }
  }
  if (p.cluster && p.gen < 1) {
    for (let i = 0; i < p.cluster; i++) {
      spawnProjectile({
        x, y: y + 0.3, z, dx: rng.float(-1, 1), dy: rng.float(0.6, 1.2), dz: rng.float(-1, 1), speed: rng.float(5, 9), kind: 'cannon',
        elem: p.elem, dmg: p.dmg * 0.4, size: 0.12, life: 1.5, gravity: 14, explode: Math.max(1.2, p.explode * 0.45), gen: p.gen + 1, spec: p.spec, hostile: p.hostile,
      });
    }
  }
  if (p.puddle) spawnPuddle(x, z, p);
}

function spawnPuddle(x, z, p) {
  const fh = G.level.heightAt(Math.floor(x / 3), Math.floor(z / 3));
  G.hazards.push({ x, z, y: fh < 50 ? fh : 0, r: 1.6 + (p.explode || 0) * 0.3, life: 3.5, tick: 0, dmg: p.dmg * 0.35, elem: p.elem, color: p.color, hostile: p.hostile, spec: p.spec });
}

function splitProjectile(p, x, y, z, excludeEnemy) {
  const n = p.split;
  const canSplitAgain = p.fractal && p.gen < 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.float(-0.3, 0.3);
    const np = spawnProjectile({
      x, y, z, dx: Math.cos(a), dy: rng.float(-0.15, 0.25), dz: Math.sin(a), speed: p.speed * 0.8,
      kind: p.kind === 'void' ? 'missile' : p.kind, elem: p.elem, dmg: p.dmg * 0.5, size: p.size0 * 0.75, life: Math.min(1.2, p.maxLife * 0.6),
      homing: p.homing, pierce: Math.min(2, p.pierce), bounce: Math.min(1, p.bounce), split: canSplitAgain ? Math.max(2, n - 1) : 0,
      fractal: p.fractal, explode: p.explode * 0.5, gen: p.gen + 1, spec: p.spec, hostile: p.hostile, knock: p.knock * 0.5, chain: Math.min(1, p.chain),
    });
    if (excludeEnemy) np.hit.add(excludeEnemy);
  }
}

function chainFrom(p, e) {
  let src = e;
  const visited = new Set([e]);
  for (let c = 0; c < p.chain; c++) {
    const nxt = nearestEnemy(src.pos.x, src.pos.y + src.height * 0.5, src.pos.z, 9, visited);
    if (!nxt) break;
    visited.add(nxt);
    tmpA.set(src.pos.x, src.pos.y + src.height * 0.6, src.pos.z);
    tmpB.set(nxt.pos.x, nxt.pos.y + nxt.height * 0.6, nxt.pos.z);
    G.fx.arcs.add(tmpA, tmpB, p.elem === 'lightning' ? [1, 1, 0.6] : p.color, 0.2, 0.35);
    G.fx.burst(tmpB, p.color, 6, 3, 0.25, 0.12);
    damageEnemy(nxt, p.dmg * 0.7, p.elem === 'physical' ? 'lightning' : p.elem, p.spec, { chain: true });
    src = nxt;
  }
  if (visited.size > 1) sfx('zap2', 0.4);
}

function novaFrom(p, x, y, z) {
  const n = p.nova;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    spawnProjectile({ x, y, z, dx: Math.cos(a), dy: 0, dz: Math.sin(a), speed: 16, kind: 'shard', elem: p.elem, dmg: p.dmg * 0.35, size: 0.1, life: 0.7, gen: p.gen + 1, spec: p.spec, pierce: 1 });
  }
}

function onHitEnemy(p, e) {
  p.hit.add(e);
  const sizeMul = p.grow ? Math.sqrt(p.size / p.size0) : 1;
  const dealt = damageEnemy(e, p.dmg * sizeMul, p.elem, p.spec, { elems: p.elems });
  if (p.knock) knockEnemy(e, p.x - p.vx, p.z - p.vz, p.knock);
  G.fx.burst({ x: p.x, y: p.y, z: p.z }, p.color, 6, 3, 0.25, 0.1);
  if (p.chain) chainFrom(p, e);
  if (p.split && p.gen < (p.fractal ? 3 : 1)) splitProjectile(p, p.x, p.y, p.z, e);
  if (p.nova && p.gen === 0 && rng.chance(0.2)) novaFrom(p, p.x, p.y, p.z);
  if (p.explode) explode(p, p.x, p.y, p.z);
  return dealt;
}

export function updateProjectiles(dt) {
  const lvl = G.level;
  const pl = G.player;
  const imm = G.fx.imm;
  for (const p of G.projectiles) {
    if (p.dead) continue;
    p.age += dt;
    if (p.age >= p.life) {
      if (p.explode && !p.hostile) explode(p, p.x, p.y, p.z);
      else if (p.explode && p.hostile) explode(p, p.x, p.y, p.z);
      p.dead = true; continue;
    }
    // --- steering behaviours
    if (p.homing) {
      if (p.hostile) {
        tmpA.set(pl.pos.x - p.x, pl.pos.y + 1 - p.y, pl.pos.z - p.z).normalize();
        steer(p, tmpA, p.homing, dt);
      } else {
        p.retarget -= dt;
        if (p.retarget <= 0 || (p.target && p.target.dead)) { p.target = findTarget(p); p.retarget = 0.15; }
        if (p.target && p.age > 0.08) {
          const e = p.target;
          tmpA.set(e.pos.x - p.x, e.pos.y + e.height * 0.55 - p.y, e.pos.z - p.z).normalize();
          steer(p, tmpA, p.homing, dt);
        }
      }
    }
    if (p.boomerang && p.age > p.life * 0.4) {
      tmpA.set(pl.pos.x - p.x, pl.pos.y + 1.2 - p.y, pl.pos.z - p.z);
      if (tmpA.length() < 1.2) { p.dead = true; continue; }
      tmpA.normalize();
      steer(p, tmpA, 6, dt);
      if (p.hit.size && p.age > p.life * 0.4 && !p.returned) { p.hit.clear(); p.returned = true; }
    }
    if (p.spiral) {
      const a = p.spiral * dt * Math.max(0.2, 1.4 - p.age);
      const c = Math.cos(a), s = Math.sin(a);
      const vx = p.vx * c - p.vz * s, vz = p.vx * s + p.vz * c;
      p.vx = vx; p.vz = vz;
    }
    if (p.gravity) p.vy -= p.gravity * dt;
    if (p.grow) p.size = p.size0 * (1 + p.grow * Math.min(1, p.age / p.maxLife) * 1.5);
    if (p.kind === 'flame') p.size = p.size0 * (0.6 + p.age / p.maxLife * 1.8);

    // --- integrate (sine weaves around a base path)
    let nx, ny, nz;
    if (p.sine) {
      p.bx += p.vx * dt; p.by += p.vy * dt; p.bz += p.vz * dt;
      const off = Math.sin(p.age * 12 + p.phase) * 0.9;
      nx = p.bx + p.px * off; ny = p.by; nz = p.bz + p.pz * off;
    } else {
      nx = p.x + p.vx * dt; ny = p.y + p.vy * dt; nz = p.z + p.vz * dt;
    }

    // --- walls / floors
    if (lvl.pointSolid(nx, ny, nz)) {
      if (p.bounce > 0) {
        p.bounce--;
        const sx = lvl.pointSolid(nx, p.y, p.z), sz = lvl.pointSolid(p.x, p.y, nz), sy = lvl.pointSolid(p.x, ny, p.z);
        if (sx) p.vx = -p.vx;
        if (sz) p.vz = -p.vz;
        if (sy || (!sx && !sz)) p.vy = -p.vy * 0.8;
        if (p.sine) { p.bx = p.x; p.by = p.y; p.bz = p.z; const l = Math.hypot(p.vx, p.vz) || 1; p.px = -p.vz / l; p.pz = p.vx / l; }
        G.fx.burst({ x: p.x, y: p.y, z: p.z }, p.color, 4, 2, 0.2, 0.08);
        p.hit.clear();
        continue;
      }
      if (p.explode) explode(p, p.x, p.y, p.z);
      else {
        G.fx.burst({ x: p.x, y: p.y, z: p.z }, p.color, 5, 2.5, 0.25, 0.09);
        if (p.puddle) spawnPuddle(p.x, p.z, p);
      }
      p.dead = true;
      continue;
    }
    p.x = nx; p.y = ny; p.z = nz;

    // --- hits
    if (p.hostile) {
      const dx = pl.pos.x - p.x, dz = pl.pos.z - p.z;
      if (dx * dx + dz * dz < (0.4 + p.size) ** 2 && p.y > pl.pos.y - 0.1 && p.y < pl.pos.y + 1.9 && !pl.dead) {
        if (p.explode) explode(p, p.x, p.y, p.z);
        else damagePlayer(p.dmg, p.elem, { x: p.x - p.vx, z: p.z - p.vz });
        G.fx.burst({ x: p.x, y: p.y, z: p.z }, p.color, 6, 3, 0.25, 0.1);
        p.dead = true;
      }
    } else if (p.well) {
      // gravity well: pull & tick-damage everything nearby
      p.tick -= dt;
      const doTick = p.tick <= 0;
      if (doTick) p.tick = 0.25;
      const R = 5 * (p.size / p.size0);
      for (const e of G.enemies) {
        if (e.dead) continue;
        const dx = p.x - e.pos.x, dz = p.z - e.pos.z, d = Math.hypot(dx, dz);
        if (d < R) {
          const pull = (1 - d / R) * 9 * dt * (e.boss ? 0.3 : 1);
          lvl.moveCircle(e.pos, (dx / (d || 1)) * pull, (dz / (d || 1)) * pull, e.radius, 0.5);
          if (doTick && d < R * 0.55) damageEnemy(e, p.dmg * 0.5, p.elem, p.spec, { aoe: true });
        }
      }
      for (let k = 0; k < 2; k++) {
        const a = rng.float(0, 6.28), r = rng.float(1, R);
        G.fx.glow.emit(p.x + Math.cos(a) * r, p.y + rng.float(-0.5, 0.5), p.z + Math.sin(a) * r, -Math.cos(a) * r * 2, 0, -Math.sin(a) * r * 2, p.color[0], p.color[1], p.color[2], 1, 0.12, 0.4, 0, 0);
      }
    } else {
      for (const e of G.enemies) {
        if (e.dead || p.hit.has(e)) continue;
        const dx = e.pos.x - p.x, dz = e.pos.z - p.z;
        const rr = e.radius + p.size;
        if (dx * dx + dz * dz < rr * rr && p.y > e.pos.y - p.size && p.y < e.pos.y + e.height + p.size) {
          onHitEnemy(p, e);
          if (p.pierce > 0) p.pierce--;
          else { p.dead = true; break; }
        }
      }
    }
    if (p.dead) continue;

    // --- visuals
    drawProjectile(p, imm, dt);
  }
  G.projectiles = G.projectiles.filter((p) => !p.dead);

  // hazards (pools)
  for (const h of G.hazards) {
    h.life -= dt; h.tick -= dt;
    if (rng.chance(0.5)) G.fx.glow.emit(h.x + rng.float(-h.r, h.r) * 0.7, h.y + 0.05, h.z + rng.float(-h.r, h.r) * 0.7, 0, rng.float(0.3, 0.8), 0, h.color[0], h.color[1], h.color[2], 1, 0.15, 0.6, 0, 0);
    G.fx.addFrameLight(h.x, h.y + 0.5, h.z, h.color.map((c) => c * 0.5), h.r * 2);
    if (h.tick <= 0) {
      h.tick = 0.4;
      if (h.hostile) {
        const d = Math.hypot(pl.pos.x - h.x, pl.pos.z - h.z);
        if (d < h.r && pl.pos.y < h.y + 0.5) damagePlayer(h.dmg, h.elem, null, true);
      } else {
        for (const e of G.enemies) if (!e.dead && Math.hypot(e.pos.x - h.x, e.pos.z - h.z) < h.r + e.radius && (!e.fly || e.pos.y < h.y + 1)) damageEnemy(e, h.dmg, h.elem, h.spec, { aoe: true, dot: true });
      }
    }
  }
  G.hazards = G.hazards.filter((h) => h.life > 0);
}

function steer(p, dir, strength, dt) {
  const sp = Math.hypot(p.vx, p.vy, p.vz) || p.speed;
  const k = Math.min(1, strength * dt);
  let vx = p.vx / sp + (dir.x - p.vx / sp) * k;
  let vy = p.vy / sp + (dir.y - p.vy / sp) * k;
  let vz = p.vz / sp + (dir.z - p.vz / sp) * k;
  const l = Math.hypot(vx, vy, vz) || 1;
  p.vx = (vx / l) * sp; p.vy = (vy / l) * sp; p.vz = (vz / l) * sp;
}

function drawProjectile(p, imm, dt) {
  const [r, g, b] = p.color;
  const s = p.size;
  switch (p.kind) {
    case 'arrow': case 'javelin': case 'bolt': {
      const sp = Math.hypot(p.vx, p.vy, p.vz) || 1;
      const len = p.kind === 'javelin' ? 0.9 : p.kind === 'arrow' ? 0.6 : 0.35;
      for (let i = 0; i < 4; i++) {
        const t = (i / 3) * len;
        imm.add(p.x - (p.vx / sp) * t, p.y - (p.vy / sp) * t, p.z - (p.vz / sp) * t, r * (1 - i * 0.2), g * (1 - i * 0.2), b * (1 - i * 0.2), s * (i === 0 ? 1.4 : 0.8));
      }
      break;
    }
    case 'disc': {
      for (let i = 0; i < 4; i++) {
        const a = p.age * 25 + (i * Math.PI) / 2;
        imm.add(p.x + Math.cos(a) * s, p.y, p.z + Math.sin(a) * s, r, g, b, s * 0.7);
      }
      imm.add(p.x, p.y, p.z, 1, 1, 1, s * 0.6);
      break;
    }
    case 'wave': {
      const l = Math.hypot(p.vx, p.vz) || 1;
      const px = -p.vz / l, pz = p.vx / l;
      const w = s * (1 + p.age * 2);
      for (let i = -3; i <= 3; i++) imm.add(p.x + px * i * w * 0.3, p.y + Math.abs(i) * -0.05, p.z + pz * i * w * 0.3, r, g, b, s * 0.6);
      break;
    }
    case 'void': {
      imm.add(p.x, p.y, p.z, r * 0.6, g * 0.3, b, s * 2.2);
      imm.add(p.x, p.y, p.z, 0.05, 0, 0.1, s * 1.2);
      break;
    }
    case 'meteor': {
      imm.add(p.x, p.y, p.z, 1, 0.8, 0.4, s * 2);
      for (let i = 0; i < 3; i++) G.fx.glow.emit(p.x, p.y, p.z, rng.float(-1, 1), rng.float(0, 2), rng.float(-1, 1), 1, rng.float(0.3, 0.6), 0.1, 1, 0.5, 0.5, 0, 1);
      break;
    }
    default:
      imm.add(p.x, p.y, p.z, r, g, b, s * 2);
      imm.add(p.x, p.y, p.z, 1, 1, 1, s * 0.8);
  }
  // trails
  if (p.kind === 'missile' || p.kind === 'skull' || p.kind === 'orb' || p.kind === 'glob' || p.kind === 'spark') {
    if (rng.chance(0.7)) G.fx.trail({ x: p.x, y: p.y, z: p.z }, p.color, s * 0.9, 0.3);
  } else if (p.kind === 'cannon' && p.gen === 0 && rng.chance(0.5)) {
    G.fx.solid.emit(p.x, p.y, p.z, 0, 0.4, 0, 0.12, 0.11, 0.1, 0.5, 0.12, 0.5, -0.3, 1, 1);
  }
  if (p.kind === 'spark' && rng.chance(0.3)) {
    tmpA.set(p.x, p.y, p.z); tmpB.set(p.x + rng.float(-0.8, 0.8), p.y + rng.float(-0.8, 0.8), p.z + rng.float(-0.8, 0.8));
    G.fx.arcs.add(tmpA, tmpB, [r, g, b], 0.06, 0.2);
  }
  if (s >= 0.12 || p.hostile) G.fx.addFrameLight(p.x, p.y, p.z, [r * 0.9, g * 0.9, b * 0.9], 3 + s * 8);
  void dt;
}
