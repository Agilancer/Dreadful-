// 20 monster families x 5 variants = 100 enemy types.
// Variants escalate in stats and gain abilities; depth scaling makes them endless.
import { creatureSheet } from '../gfx/sprites.js';

// body painters: humanoid, brute, beast, rat, blob, flyer, eye, spider, serpent, wisp
export const FAMILIES = [
  { id: 'vermin', names: ['Sewer Rat', 'Plague Rat', 'Gnawer', 'Bone Rat', 'Rat Fiend'], body: 'rat', h: 0.9, r: 0.35,
    tints: [0x7a6a5a, 0x6a7a4a, 0x5a4a3a, 0xd0c8b0, 0x8a2a2a], eyes: [0xff2020, 0xa0ff40, 0xff8020, 0x40e0ff, 0xffff40], accent: 0x302018,
    hp: 10, dmg: 4, spd: 5.2, xp: 3, min: 1, pack: [5, 9], ai: { melee: 1.2 }, elems: [null, 'poison', null, 'cold', 'fire'] },
  { id: 'ghoul', names: ['Ghoul', 'Rotting Ghoul', 'Grave Ghoul', 'Plague Ghoul', 'Ghoul Lord'], body: 'humanoid', h: 1.8, r: 0.45,
    tints: [0x7a8a6a, 0x6a7a50, 0x8a8a8a, 0x5a9a40, 0x9a5a7a], eyes: [0xffe040, 0xff4040, 0x80c0ff, 0x80ff40, 0xff40ff], accent: 0x404030,
    opts: { hunch: true, claws: true }, hp: 28, dmg: 8, spd: 3.1, xp: 9, min: 1, pack: [3, 6], ai: { melee: 1.6 }, elems: [null, null, 'cold', 'poison', 'poison'] },
  { id: 'skeleton', names: ['Skeleton', 'Returned', 'Bone Warrior', 'Burning Dead', 'Horror'], body: 'humanoid', h: 1.85, r: 0.4,
    tints: [0xd8d0b8, 0xc0b8a0, 0xe8e0d0, 0xd0a080, 0xa0a0c0], eyes: [0xff3020, 0x40a0ff, 0xffff60, 0xff8000, 0xc040ff], accent: 0x606068,
    opts: { skull: true, ribs: true, weapon: 'sword' }, hp: 24, dmg: 9, spd: 3.4, xp: 9, min: 1, pack: [3, 6], ai: { melee: 1.7 }, elems: [null, null, null, 'fire', 'cold'] },
  { id: 'skelarcher', names: ['Skeleton Archer', 'Corpse Archer', 'Bone Archer', 'Burning Archer', 'Horror Archer'], body: 'humanoid', h: 1.85, r: 0.4,
    tints: [0xd8d0b8, 0xb0a890, 0xe8e0d0, 0xd0a080, 0xa0a0c0], eyes: [0xff3020, 0x40ff80, 0xffff60, 0xff8000, 0xc040ff], accent: 0x606068,
    opts: { skull: true, ribs: true, weapon: 'bow' }, hp: 18, dmg: 7, spd: 3.2, xp: 10, min: 2, pack: [2, 4], ai: { ranged: { kind: 'arrow', cd: 2.0, speed: 22, dist: 12 } }, elems: [null, 'poison', null, 'fire', 'cold'] },
  { id: 'bat', names: ['Cave Bat', 'Blood Bat', 'Vampire Bat', 'Doom Bat', 'Night Terror'], body: 'flyer', h: 0.9, r: 0.35,
    tints: [0x4a3a3a, 0x7a2020, 0x2a2a3a, 0x3a1a4a, 0x101018], eyes: [0xffff40, 0xff2020, 0xff4040, 0x40ff40, 0xff00ff], accent: 0x2a1a1a,
    hp: 9, dmg: 5, spd: 6.2, xp: 5, min: 1, pack: [4, 7], ai: { melee: 1.3, fly: 1.6, swoop: true }, elems: [null, null, null, 'poison', 'cold'] },
  { id: 'cultist', names: ['Acolyte', 'Cultist', 'Dark Priest', 'Heretic', 'Arch-Heretic'], body: 'humanoid', h: 1.8, r: 0.4,
    tints: [0x5a3a6a, 0x7a2020, 0x202030, 0x6a6a20, 0x2a0a3a], eyes: [0xff60ff, 0xff8020, 0x40ffff, 0xffff40, 0xff2080], accent: 0xc0a040,
    opts: { robe: true, hood: true, weapon: 'staff' }, hp: 22, dmg: 8, spd: 3.0, xp: 13, min: 2, pack: [2, 4], ai: { ranged: { kind: 'magic', cd: 2.2, speed: 13, dist: 10 } }, elems: ['arcane', 'fire', 'cold', 'lightning', 'void'] },
  { id: 'imp', names: ['Imp', 'Fire Imp', 'Hell Imp', 'Pit Imp', 'Imp Lord'], body: 'flyer', h: 1.0, r: 0.35,
    tints: [0xa04020, 0xd06020, 0x802020, 0x603040, 0x400010], eyes: [0xffff00, 0xffffff, 0xff8000, 0x00ff80, 0xff00ff], accent: 0x301010,
    opts: { horns: true, tail: true }, hp: 15, dmg: 8, spd: 4.6, xp: 12, min: 3, pack: [3, 5], ai: { ranged: { kind: 'fire', cd: 2.4, speed: 12, dist: 9 }, fly: 1.8 }, elems: ['fire', 'fire', 'fire', 'poison', 'void'] },
  { id: 'spider', names: ['Crawler', 'Venom Spider', 'Blood Spider', 'Arach', 'Brood Mother'], body: 'spider', h: 1.0, r: 0.5,
    tints: [0x3a3030, 0x304a20, 0x6a1010, 0x202040, 0x1a1a1a], eyes: [0xff2020, 0x80ff40, 0xffff40, 0x40ffff, 0xff40ff], accent: 0xa02020,
    hp: 20, dmg: 9, spd: 4.4, xp: 11, min: 3, pack: [3, 6], ai: { melee: 1.5, leap: true }, elems: [null, 'poison', null, 'cold', 'poison'] },
  { id: 'slime', names: ['Ooze', 'Green Slime', 'Acid Blob', 'Magma Slime', 'Void Jelly'], body: 'blob', h: 1.1, r: 0.6,
    tints: [0x8a8a70, 0x40b040, 0xb0d020, 0xe05010, 0x7020c0], eyes: [0x101010, 0x102010, 0x201000, 0xffff80, 0xffffff], accent: 0x202020,
    hp: 36, dmg: 7, spd: 2.4, xp: 10, min: 2, pack: [2, 4], ai: { melee: 1.4, split: true }, elems: [null, 'poison', 'poison', 'fire', 'void'] },
  { id: 'wolf', names: ['Jackal', 'Wolf', 'Dire Wolf', 'Hellhound', 'Fenris Spawn'], body: 'beast', h: 1.2, r: 0.5,
    tints: [0x9a7a50, 0x707078, 0x404048, 0x8a2010, 0xc0d0e0], eyes: [0xffff40, 0xffe080, 0xff4040, 0xffa000, 0x40c0ff], accent: 0x302820,
    opts: { mane: false }, hp: 26, dmg: 10, spd: 5.4, xp: 13, min: 3, pack: [3, 5], ai: { melee: 1.6, charge: true }, elems: [null, null, null, 'fire', 'cold'] },
  { id: 'wraith', names: ['Ghost', 'Wraith', 'Specter', 'Banshee', 'Dread Wraith'], body: 'wisp', h: 1.9, r: 0.45,
    tints: [0xa0b0c0, 0x6080a0, 0x80a080, 0xc0a0d0, 0x302040], eyes: [0x40ffff, 0x80c0ff, 0x80ff80, 0xff80ff, 0xff2020], accent: 0x202030,
    hp: 30, dmg: 10, spd: 3.6, xp: 18, min: 5, pack: [2, 4], ai: { melee: 1.6, fly: 0.6, teleport: true }, elems: ['cold', 'cold', 'poison', 'arcane', 'void'] },
  { id: 'knight', names: ['Fallen Knight', 'Death Knight', 'Blood Knight', 'Doom Knight', 'Black Paladin'], body: 'humanoid', h: 2.0, r: 0.5,
    tints: [0x6a6a70, 0x3a3a48, 0x7a2020, 0x2a2a2a, 0x101010], eyes: [0xff4020, 0x40c0ff, 0xff0000, 0xff8000, 0xc040ff], accent: 0x9a9aa8,
    opts: { helm: true, armor: true, shield: true, weapon: 'sword', plume: true }, hp: 60, dmg: 14, spd: 3.3, xp: 30, min: 6, pack: [2, 3], ai: { melee: 1.9, charge: true }, elems: [null, 'cold', 'fire', 'lightning', 'void'] },
  { id: 'golem', names: ['Clay Golem', 'Stone Golem', 'Iron Golem', 'Flesh Golem', 'Obsidian Colossus'], body: 'brute', px: 48, h: 2.7, r: 0.8,
    tints: [0x9a7050, 0x808080, 0x6a6a78, 0xb06060, 0x201828], eyes: [0xffd040, 0x40c0ff, 0xff4020, 0x80ff40, 0xc040ff], accent: 0x505058,
    opts: { cracks: true, glowcore: true }, hp: 130, dmg: 22, spd: 2.3, xp: 55, min: 8, pack: [1, 2], ai: { melee: 2.4, slam: true }, elems: [null, null, 'lightning', 'poison', 'fire'] },
  { id: 'eye', names: ['Floating Eye', 'Gazer', 'Doom Gazer', 'Eye of Malice', 'All-Seeing'], body: 'eye', h: 1.4, r: 0.55,
    tints: [0x8a5a6a, 0x5a6a8a, 0x6a2a2a, 0x2a5a2a, 0x4a2a6a], eyes: [0xff2020, 0x2080ff, 0xff8000, 0x40ff40, 0xff40ff], accent: 0x302030,
    hp: 34, dmg: 6, spd: 2.6, xp: 24, min: 9, pack: [1, 3], ai: { ranged: { kind: 'bolt', cd: 2.6, speed: 18, dist: 11, burst: 3 }, fly: 1.8 }, elems: ['lightning', 'cold', 'fire', 'poison', 'void'] },
  { id: 'zealot', names: ['Zealot', 'Fanatic', 'Martyr', 'Plague Bearer', 'Hellbomber'], body: 'humanoid', h: 1.75, r: 0.4,
    tints: [0x8a6a40, 0xa04040, 0xc0c0a0, 0x60a040, 0xd06010], eyes: [0xff4020, 0xffff00, 0xffffff, 0x80ff40, 0xffa000], accent: 0xe0a020,
    opts: { robe: true, belt: true }, hp: 18, dmg: 26, spd: 5.0, xp: 12, min: 5, pack: [2, 4], ai: { explode: true }, elems: ['fire', 'fire', 'lightning', 'poison', 'fire'] },
  { id: 'serpent', names: ['Naga', 'Serpent', 'Sand Viper', 'Coil Witch', 'Naga Queen'], body: 'serpent', h: 1.8, r: 0.5,
    tints: [0x407040, 0x406080, 0xc0a060, 0x604080, 0x208070], eyes: [0xffff40, 0xff4040, 0xff8000, 0xff40ff, 0x40ffff], accent: 0x80a040,
    opts: { hood: true }, hp: 36, dmg: 11, spd: 3.6, xp: 22, min: 10, pack: [2, 4], ai: { ranged: { kind: 'spit', cd: 1.8, speed: 13, dist: 9, arc: true } }, elems: ['poison', 'cold', 'fire', 'arcane', 'poison'] },
  { id: 'necro', names: ['Bone Mage', 'Necromancer', 'Grave Caller', 'Soul Reaper', 'Lich Acolyte'], body: 'humanoid', h: 1.9, r: 0.4,
    tints: [0x303040, 0x202020, 0x402030, 0x203030, 0x404060], eyes: [0x80ff80, 0x40ffff, 0xff4040, 0xc080ff, 0xffffff], accent: 0xd0d0c0,
    opts: { robe: true, skull: true, weapon: 'staff', crown: false }, hp: 40, dmg: 10, spd: 2.9, xp: 34, min: 11, pack: [1, 2], ai: { ranged: { kind: 'skull', cd: 2.6, speed: 9, dist: 12, homing: 1.5 }, summon: 'skeleton' }, elems: ['void', 'cold', 'fire', 'poison', 'void'] },
  { id: 'gargoyle', names: ['Gargoyle', 'Stone Gargoyle', 'Granite Fiend', 'Iron Gargoyle', 'Obsidian Gargoyle'], body: 'flyer', h: 1.5, r: 0.5,
    tints: [0x707070, 0x8a8a80, 0x6a6058, 0x5a5a68, 0x181820], eyes: [0xff4020, 0xffd040, 0x40ff80, 0x40c0ff, 0xff00ff], accent: 0x404040,
    opts: { horns: true, tail: true }, hp: 46, dmg: 14, spd: 5.4, xp: 30, min: 12, pack: [2, 3], ai: { melee: 1.6, fly: 2.2, swoop: true, armor: 0.3 }, elems: [null, null, 'poison', 'lightning', 'void'] },
  { id: 'demon', names: ['Horned Fiend', 'Pit Fiend', 'Doom Lord', 'Abyssal', 'Archfiend'], body: 'brute', px: 48, h: 2.8, r: 0.85,
    tints: [0xa03020, 0x702020, 0x401818, 0x402060, 0x100808], eyes: [0xffff00, 0xff8000, 0xff0000, 0xff00ff, 0xffffff], accent: 0x302020,
    opts: { horns: true, wings: true }, hp: 160, dmg: 24, spd: 3.2, xp: 90, min: 14, pack: [1, 1], ai: { melee: 2.4, ranged: { kind: 'fire', cd: 3.0, speed: 14, dist: 14, spread: 3 } }, elems: ['fire', 'fire', 'fire', 'void', 'void'] },
  { id: 'lich', names: ['Lich', 'Dread Lich', 'Bone King', 'Frost Lich', 'Void Lich'], body: 'wisp', h: 2.2, r: 0.5,
    tints: [0x4a3a6a, 0x2a2a4a, 0x6a6050, 0x6080c0, 0x200830], eyes: [0x40ffff, 0xff2020, 0xffff40, 0xffffff, 0xff00ff], accent: 0x202020,
    opts: { skull: true, crown: true }, hp: 140, dmg: 14, spd: 2.8, xp: 120, min: 16, pack: [1, 1], weight: 0.5, ai: { ranged: { kind: 'frost', cd: 2.2, speed: 12, dist: 12 }, nova: true, summon: 'wraith', fly: 0.4, teleport: true }, elems: ['cold', 'void', 'fire', 'cold', 'void'] },
];

export const VARIANT_GAP = 7; // depth levels between variants of a family
export const FAMILY_BY_ID = Object.fromEntries(FAMILIES.map((f) => [f.id, f]));

// Expand to the 100 concrete types
export const ENEMY_TYPES = [];
for (const fam of FAMILIES) {
  for (let v = 0; v < 5; v++) {
    const tint = fam.tints[v];
    const r = (tint >> 16) & 255, g = (tint >> 8) & 255, b = tint & 255;
    ENEMY_TYPES.push({
      id: `${fam.id}_${v}`,
      family: fam,
      variant: v,
      name: fam.names[v],
      element: fam.elems[v],
      minDepth: fam.min + v * VARIANT_GAP,
      hp: fam.hp * (1 + 0.55 * v),
      dmg: fam.dmg * (1 + 0.3 * v),
      spd: fam.spd * (1 + 0.05 * v),
      xp: fam.xp * (1 + 0.6 * v),
      height: fam.h * (1 + 0.04 * v),
      radius: fam.r,
      sprite: {
        body: fam.body, px: fam.px || 32,
        palette: { body: [r, g, b], dark: [r * 0.45, g * 0.45, b * 0.45], accent: fam.accent, eye: fam.eyes[v], skin: [Math.min(255, r * 1.1), Math.min(255, g * 1.05), b] },
        opts: { ...(fam.opts || {}), ...(v >= 4 && fam.body === 'humanoid' && !fam.opts?.helm ? { horns: true } : {}), ...(v >= 3 && fam.body === 'beast' ? { spikes: true } : {}) },
      },
    });
  }
}
export const ENEMY_BY_ID = Object.fromEntries(ENEMY_TYPES.map((t) => [t.id, t]));

export function enemySheet(type) {
  return creatureSheet(type.id, type.sprite);
}

// Global depth scaling (endless)
export function depthScale(depth) {
  const d = depth - 1;
  return {
    hp: Math.pow(1.14, d) * (1 + d * 0.05),
    dmg: 0.6 * Math.pow(1.085, d) * (1 + d * 0.02),
    xp: Math.pow(1.11, d) * (1 + d * 0.03),
    spd: 1 + Math.min(0.35, d * 0.008),
  };
}

// Choose the monster roster for a floor (D2-style themed sets)
export function floorRoster(depth, rng) {
  const avail = ENEMY_TYPES.filter((t) => t.minDepth <= depth);
  // Prefer each family's highest available variant (with some lower ones mixed in)
  const byFam = new Map();
  for (const t of avail) {
    if (!byFam.has(t.family.id)) byFam.set(t.family.id, []);
    byFam.get(t.family.id).push(t);
  }
  const fams = rng.shuffle([...byFam.keys()]);
  const count = Math.min(fams.length, 3 + Math.min(3, Math.floor(depth / 6)));
  const roster = [];
  for (const fid of fams) {
    if (roster.length >= count) break;
    const fam = FAMILY_BY_ID[fid];
    if (fam.weight && !rng.chance(fam.weight)) continue;
    const list = byFam.get(fid);
    const top = list.length - 1;
    const v = Math.max(0, top - (rng.chance(0.3) ? 1 : 0));
    roster.push(list[v]);
  }
  if (!roster.length) roster.push(ENEMY_TYPES[0]);
  return roster;
}

// D2-style unique monster modifiers
export const MONSTER_MODS = [
  { id: 'fast', name: 'Extra Fast' },
  { id: 'strong', name: 'Extra Strong' },
  { id: 'stone', name: 'Stone Skin' },
  { id: 'fireEnch', name: 'Fire Enchanted' },
  { id: 'coldEnch', name: 'Cold Enchanted' },
  { id: 'lightEnch', name: 'Lightning Enchanted' },
  { id: 'teleport', name: 'Teleportation' },
  { id: 'multishot', name: 'Multiple Shots' },
  { id: 'vampiric', name: 'Vampiric' },
  { id: 'cursed', name: 'Cursed' },
];

const UNIQUE_PRE = ['Grim', 'Vile', 'Bone', 'Blood', 'Rot', 'Doom', 'Gloom', 'Storm', 'Ash', 'Venom', 'Hate', 'Dread', 'Bleak', 'Shadow', 'Pale', 'Iron', 'Plague', 'Soul', 'Night', 'Ember'];
const UNIQUE_SUF = ['maw', 'fang', 'gnasher', 'spawn', 'flayer', 'shank', 'grip', 'eye', 'heart', 'skull', 'wing', 'crusher', 'ripper', 'hound', 'shade', 'thirst', 'claw', 'brand', 'bane', 'drinker'];
const UNIQUE_TITLE = ['the Hungry', 'the Defiler', 'the Cold', 'the Wretched', 'the Unclean', 'the Hollow', 'the Butcher', 'the Witless', 'the Damned', 'the Black', 'the Cruel', 'the Ancient'];
export function uniqueMonsterName(rng) {
  return `${rng.pick(UNIQUE_PRE)}${rng.pick(UNIQUE_SUF)} ${rng.pick(UNIQUE_TITLE)}`;
}
