// Item generation, naming, valuation and tooltip description.
import { WEAPON_BASES, ARMOR_BASES, RING_BASES, AFFIXES, UNIQUES, RARITY, STAT_LABELS, ELEMENTS, rareName } from './itemData.js';

export const BASE_BY_ID = Object.fromEntries([...WEAPON_BASES, ...ARMOR_BASES, ...RING_BASES].map((b) => [b.id, b]));
const AFFIX_BY_ID = Object.fromEntries(AFFIXES.map((a) => [a.id, a]));
const UNIQUE_BY_ID = Object.fromEntries(UNIQUES.map((u) => [u.id, u]));

export const SLOT_OF = (base) => (WEAPON_BASES.includes(base) ? 'weapon' : base.slot);
const TIER_MULT = [1, 1.7, 2.6];
const ARMOR_TIER = [1, 2, 3.2];

export const ilvlDamageScale = (ilvl) => Math.pow(1.125, ilvl - 1) * (1 + 0.04 * (ilvl - 1));
export const ilvlArmorScale = (ilvl) => Math.pow(1.08, ilvl - 1);
export const statScale = (ilvl) => 1 + (ilvl - 1) * 0.08;

let uidN = 0;
export const newUid = () => Date.now().toString(36) + (uidN++).toString(36) + Math.random().toString(36).slice(2, 6);

export function tierFor(ilvl, rng) {
  let t = ilvl >= 22 ? 2 : ilvl >= 9 ? 1 : 0;
  if (t > 0 && rng.chance(0.25)) t--;
  return t;
}

export function rollRarity(rng, mf = 0, bonus = 0) {
  const m = 1 + mf / 100;
  const u = 0.012 * m * (1 + bonus * 3);
  const r = 0.07 * m * (1 + bonus * 2);
  const g = 0.32 * (1 + bonus);
  const x = rng.next();
  if (x < u) return 'unique';
  if (x < u + r) return 'rare';
  if (x < u + r + g) return 'magic';
  return 'normal';
}

const SLOT_WEIGHTS = { weapon: 40, head: 13, chest: 13, legs: 13, ring: 21 };

function pickAffix(rng, slot, kind, ilvl, taken) {
  const cands = AFFIXES.filter((a) => a.kind === kind && a.slots.includes(slot) && !taken.has(a.id) && a.tiers[0].lvl <= ilvl);
  if (!cands.length) return null;
  const a = rng.pick(cands);
  const elig = a.tiers.map((t, i) => [t, i]).filter(([t]) => t.lvl <= ilvl);
  // favour the top eligible tiers
  const [tier, ti] = rng.weighted(elig, ([, i]) => Math.pow(i + 1, 1.6));
  let v = tier.lo + rng.next() * (tier.hi - tier.lo);
  const isFloat = !Number.isInteger(tier.lo) || !Number.isInteger(tier.hi);
  if (a.scale) v *= statScale(ilvl);
  v = isFloat ? Math.round(v * 10) / 10 : Math.round(v);
  return { id: a.id, t: ti, v, stat: a.stat, name: tier.name };
}

export function generateItem({ ilvl, rng, slot, rarity, mf = 0, bonus = 0, baseId }) {
  ilvl = Math.max(1, Math.floor(ilvl));
  if (!slot && baseId) slot = SLOT_OF(BASE_BY_ID[baseId]);
  if (!slot) slot = rng.weighted(Object.keys(SLOT_WEIGHTS), (k) => SLOT_WEIGHTS[k]);
  if (!rarity) rarity = rollRarity(rng, mf, bonus);
  if (slot === 'ring' && rarity === 'normal') rarity = 'magic';

  if (rarity === 'unique') {
    const cands = UNIQUES.filter((u) => u.lvl <= ilvl && SLOT_OF(BASE_BY_ID[u.base]) === slot && (!baseId || u.base === baseId));
    if (cands.length) return makeUnique(rng.pick(cands), ilvl, rng);
    rarity = 'rare';
  }

  let base;
  if (baseId) base = BASE_BY_ID[baseId];
  else if (slot === 'weapon') base = rng.pick(WEAPON_BASES);
  else if (slot === 'ring') base = RING_BASES[0];
  else base = rng.pick(ARMOR_BASES.filter((b) => b.slot === slot));
  const tier = tierFor(ilvl, rng);

  const item = { uid: newUid(), slot, base: base.id, tier, ilvl, rarity, affixes: [], mods: {} };
  rollBaseStats(item, base, rng);

  let nPre = 0, nSuf = 0;
  if (rarity === 'magic') {
    const r = rng.next();
    nPre = r < 0.6 ? 1 : 0; nSuf = r > 0.3 ? 1 : 0;
  } else if (rarity === 'rare') {
    const total = rng.int(3, 5) + (base.extraAffix ? 1 : 0);
    nPre = Math.min(3, rng.int(1, total - 1)); nSuf = Math.min(3, total - nPre);
  }
  const taken = new Set();
  const pres = [], sufs = [];
  for (let i = 0; i < nPre; i++) { const a = pickAffix(rng, slot, 'prefix', ilvl, taken); if (a) { taken.add(a.id); pres.push(a); } }
  for (let i = 0; i < nSuf; i++) { const a = pickAffix(rng, slot, 'suffix', ilvl, taken); if (a) { taken.add(a.id); sufs.push(a); } }
  if (rarity === 'magic' && !pres.length && !sufs.length) { const a = pickAffix(rng, slot, 'suffix', ilvl, taken); if (a) sufs.push(a); }
  item.affixes = [...pres, ...sufs].map(({ id, t, v }) => ({ id, t, v }));
  for (const a of [...pres, ...sufs]) item.mods[a.stat] = (item.mods[a.stat] || 0) + a.v;

  const bname = base.names[tier];
  if (rarity === 'normal') item.name = bname;
  else if (rarity === 'magic') item.name = [pres[0]?.name, bname, sufs[0]?.name].filter(Boolean).join(' ');
  else item.name = rareName(rng, slot);
  item.baseName = bname;
  item.value = itemValue(item);
  return item;
}

function rollBaseStats(item, base, rng) {
  if (item.slot === 'weapon') {
    const s = TIER_MULT[item.tier] * ilvlDamageScale(item.ilvl);
    const v = 0.9 + rng.next() * 0.2;
    item.dmg = [Math.max(1, Math.round(base.dmg[0] * s * v)), Math.max(2, Math.round(base.dmg[1] * s * v))];
  } else if (item.slot !== 'ring') {
    item.armor = Math.max(1, Math.round(base.armor * ARMOR_TIER[item.tier] * ilvlArmorScale(item.ilvl) * (0.9 + rng.next() * 0.25)));
  }
}

function makeUnique(u, ilvl, rng) {
  const base = BASE_BY_ID[u.base];
  const slot = SLOT_OF(base);
  const tier = Math.max(ilvl >= 22 ? 2 : ilvl >= 9 ? 1 : 0, 0);
  const item = { uid: newUid(), slot, base: base.id, tier, ilvl, rarity: 'unique', uniqueId: u.id, affixes: [], mods: {} };
  rollBaseStats(item, base, rng);
  if (item.dmg) item.dmg = item.dmg.map((d) => Math.round(d * 1.15));
  for (const [k, v] of Object.entries(u.mods)) {
    let scaled = v;
    if (k === 'lifeRegen') scaled = Math.round(v * statScale(ilvl) * 10) / 10;
    else if (['life', 'lifeOnKill', 'thorns', 'stomp'].includes(k)) scaled = Math.round(v * statScale(ilvl));
    item.mods[k] = scaled;
  }
  item.name = u.name;
  item.baseName = base.names[tier];
  item.value = itemValue(item);
  return item;
}

export function itemValue(item) {
  const nA = Object.keys(item.mods || {}).length;
  const slotBase = item.slot === 'weapon' ? 24 : item.slot === 'ring' ? 30 : 16;
  return Math.round(slotBase * RARITY[item.rarity].value * (1 + item.ilvl * 0.35) * (1 + nA * 0.25) * Math.pow(1.03, item.ilvl));
}

export function potionPrice(depth) { return Math.round(20 + 8 * depth * Math.pow(1.03, depth)); }
export function gamblePrice(slot, depth) { return Math.round((slot === 'ring' ? 400 : 300) * (1 + depth * 0.3) * Math.pow(1.04, depth)); }

export function itemIconInfo(item) {
  const base = BASE_BY_ID[item.base];
  let gem = [255, 255, 255];
  if (item.slot === 'weapon') {
    const el = dominantElement(item);
    gem = ELEMENTS[el].color.map((c) => Math.round(c * 255));
  } else if (item.rarity === 'magic') gem = [110, 140, 255];
  else if (item.rarity === 'rare') gem = [255, 220, 80];
  else if (item.rarity === 'unique') gem = [255, 140, 40];
  return { icon: base.icon, tier: item.tier, gem };
}

export function dominantElement(item) {
  const base = BASE_BY_ID[item.base];
  const m = item.mods || {};
  let el = base.elem || 'physical', best = el === 'physical' ? 0 : 50;
  for (const [k, e] of [['addFire', 'fire'], ['addCold', 'cold'], ['addLightning', 'lightning'], ['addPoison', 'poison'], ['addArcane', 'arcane']]) {
    if ((m[k] || 0) > best) { best = m[k]; el = e; }
  }
  return el;
}

// Tooltip lines
export function describeItem(item) {
  const base = BASE_BY_ID[item.base];
  const lines = [];
  const rar = RARITY[item.rarity];
  lines.push({ text: item.name, color: rar.css, big: true });
  if (item.rarity !== 'normal' && item.name !== item.baseName) lines.push({ text: item.baseName, color: rar.css });
  lines.push({ text: `${rar.name} ${slotLabel(item.slot)} · Item Level ${item.ilvl}`, color: '#8a8a8a' });
  if (item.slot === 'weapon') {
    const el = dominantElement(item);
    lines.push({ text: `Damage: ${item.dmg[0]}-${item.dmg[1]}  (${ELEMENTS[el].name})`, color: '#fff' });
    lines.push({ text: `Attacks per Second: ${base.rate.toFixed(1)}`, color: '#fff' });
    const intr = [];
    if (base.count > 1) intr.push(`Fires ${base.count} projectiles`);
    if (base.homing) intr.push('Homing');
    if (base.explode) intr.push('Explosive');
    if (base.pierce && base.pierce < 50) intr.push(`Pierce ${base.pierce}`);
    if (base.pierce >= 50) intr.push('Piercing');
    if (base.chain) intr.push(`Chains ${base.chain}`);
    if (base.bounce) intr.push(`Ricochet ${base.bounce}`);
    if (base.boomerang) intr.push('Returns');
    if (base.gravity) intr.push('Arcing');
    if (base.well) intr.push('Gravity Well');
    if (base.puddle) intr.push('Toxic Pools');
    if (intr.length) lines.push({ text: intr.join(' · '), color: '#a8a090' });
  } else if (item.armor) {
    lines.push({ text: `Armor: ${item.armor}`, color: '#fff' });
  }
  for (const [k, v] of Object.entries(item.mods || {})) {
    const f = STAT_LABELS[k];
    lines.push({ text: f ? f(v) : `${k}: ${v}`, color: item.rarity === 'unique' ? '#c8a060' : '#7f9cff' });
  }
  lines.push({ text: `Value: ${item.value} gold`, color: '#d4b030' });
  return lines;
}

export function slotLabel(slot) {
  return { weapon: 'Weapon', head: 'Helm', chest: 'Body Armor', legs: 'Leg Armor', ring: 'Ring' }[slot] || slot;
}

export { AFFIX_BY_ID, UNIQUE_BY_ID };
