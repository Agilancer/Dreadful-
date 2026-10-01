// Player stat aggregation and per-weapon projectile specs.
import { BASE_BY_ID, dominantElement } from './itemgen.js';

export const ARMOR_K = (depth) => 40 * Math.pow(1.08, Math.max(0, depth - 1));

export function xpForLevel(lvl) {
  return Math.round(100 * Math.pow(1.22, lvl - 1) + 40 * (lvl - 1));
}

export function computeStats(p) {
  const s = {
    maxHp: 100 + 12 * (p.level - 1),
    armor: 0, pctArmor: 0,
    pctDmg: 5 * (p.level - 1),
    crit: 5, critDmg: 50,
    lifeSteal: 0, lifeOnKill: 0, lifeRegen: 0.5 + p.level * 0.05, thorns: 0,
    moveSpeed: 0, extraJumps: 0, dash: 0, glide: 0, stomp: 0, dashNova: 0,
    pickupRadius: 1.6, xpPct: 0, goldFind: 0, magicFind: 0,
    fireRate: 0, projSpeed: 0, extraProj: 0,
    res: { fire: 0, cold: 0, lightning: 0, poison: 0, arcane: 0, void: 0, physical: 0 },
  };
  let resAll = 0;
  const add = (k, v) => {
    if (k === 'life') s.maxHp += v;
    else if (k === 'resFire') s.res.fire += v;
    else if (k === 'resCold') s.res.cold += v;
    else if (k === 'resLightning') s.res.lightning += v;
    else if (k === 'resPoison') s.res.poison += v;
    else if (k === 'resAll') resAll += v;
    else if (k in s && typeof s[k] === 'number') s[k] += v;
  };
  const eq = p.equip;
  for (const slot of ['head', 'chest', 'legs', 'ring0', 'ring1', 'ring2', 'ring3']) {
    const it = eq[slot];
    if (!it) continue;
    if (it.armor) s.armor += it.armor;
    for (const [k, v] of Object.entries(it.mods || {})) add(k, v);
  }
  s.armor = Math.round(s.armor * (1 + s.pctArmor / 100));
  for (const k of ['fire', 'cold', 'lightning', 'poison']) s.res[k] = Math.min(75, s.res[k] + resAll);
  s.res.arcane = Math.min(75, resAll * 0.5);
  s.res.void = Math.min(75, resAll * 0.5);
  // temporary shrine buffs
  const b = p.buffs || {};
  if (b.might) s.pctDmg += 100;
  if (b.swift) { s.moveSpeed += 30; s.fireRate += 30; }
  if (b.armor) s.armor = Math.round(s.armor * 2 + 20);
  if (b.wisdom) s.xpPct += 50;
  if (b.fortune) { s.magicFind += 100; s.goldFind += 100; }
  if (b.frenzy) { s.fireRate += 60; s.extraProj += 1; }
  s.moveSpeed = Math.min(120, s.moveSpeed);
  s.maxHp = Math.round(s.maxHp);
  return s;
}

const CHAOS_ELEMS = ['fire', 'cold', 'lightning', 'poison', 'arcane', 'void'];

// Resolve everything a weapon shot needs.
export function weaponSpec(item, stats) {
  const base = BASE_BY_ID[item.base];
  const m = item.mods || {};
  const g = (k) => m[k] || 0;
  const dmgMult = 1 + (g('pctDmg') + stats.pctDmg) / 100;
  const addTotal = g('addFire') + g('addCold') + g('addLightning') + g('addPoison') + g('addArcane');
  const mult = dmgMult * (1 + addTotal / 100);
  const count = (base.count || 1) + g('extraProj') + stats.extraProj;
  const elems = new Set([base.elem]);
  if (g('addFire')) elems.add('fire');
  if (g('addCold')) elems.add('cold');
  if (g('addLightning')) elems.add('lightning');
  if (g('addPoison')) elems.add('poison');
  return {
    base,
    proj: base.proj,
    element: dominantElement(item),
    elems,
    dmg: [item.dmg[0] * mult, item.dmg[1] * mult],
    rate: base.rate * (1 + (g('fireRate') + stats.fireRate) / 100),
    speed: base.speed * (1 + (g('projSpeed') + stats.projSpeed) / 100),
    life: base.life * (1 + Math.max(0, g('projSpeed')) / 300),
    size: base.size,
    count,
    spread: base.spread || 0,
    fan: count > (base.count || 1) ? 0.07 : 0,
    gravity: base.gravity || 0,
    pierce: (base.pierce || 0) + g('pierce'),
    homing: Math.max(base.homing || 0, g('homing')) + (base.homing && g('homing') ? 1 : 0),
    explode: base.explode && g('explode') ? base.explode + g('explode') * 0.5 : Math.max(base.explode || 0, g('explode')),
    split: g('split'),
    bounce: (base.bounce || 0) + g('bounce'),
    chain: (base.chain || 0) + g('chain'),
    boomerang: (base.boomerang || 0) + g('boomerang'),
    sine: g('sine'),
    nova: g('nova'),
    cluster: g('cluster'),
    meteor: g('meteor'),
    fractal: g('fractal'),
    chaos: g('chaos'),
    grow: g('grow'),
    spiral: g('spiral'),
    well: base.well || 0,
    puddle: base.puddle || 0,
    knock: (base.knock || 0) + g('knock'),
    crit: stats.crit + g('crit'),
    critDmg: stats.critDmg + g('critDmg'),
    lifeSteal: stats.lifeSteal + g('lifeSteal'),
    lifeOnKill: stats.lifeOnKill + g('lifeOnKill'),
    goldFind: g('goldFind'),
    magicFind: g('magicFind'),
    sound: base.sound,
  };
}

export function randomChaosElement(rng) { return rng.pick(CHAOS_ELEMS); }

// Rough DPS for comparisons
export function estimateDps(item, stats) {
  const s = weaponSpec(item, stats);
  const avg = (s.dmg[0] + s.dmg[1]) / 2;
  let dps = avg * s.rate * s.count * (1 + (s.crit / 100) * (s.critDmg / 100));
  if (s.explode) dps *= 1.4;
  if (s.split) dps *= 1 + s.split * 0.15;
  if (s.chain) dps *= 1 + s.chain * 0.3;
  if (s.pierce) dps *= 1 + Math.min(4, s.pierce) * 0.15;
  return Math.round(dps);
}
