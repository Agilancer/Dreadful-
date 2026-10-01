// Static item tables: bases, affixes, uniques.

export const ELEMENTS = {
  physical: { name: 'Physical', color: [1.0, 0.9, 0.75], css: '#e8dcc0' },
  fire: { name: 'Fire', color: [1.0, 0.45, 0.1], css: '#ff7a2a' },
  cold: { name: 'Cold', color: [0.45, 0.8, 1.0], css: '#7ccfff' },
  lightning: { name: 'Lightning', color: [1.0, 1.0, 0.45], css: '#fff27a' },
  poison: { name: 'Poison', color: [0.4, 1.0, 0.25], css: '#70ff50' },
  arcane: { name: 'Arcane', color: [0.85, 0.4, 1.0], css: '#d070ff' },
  void: { name: 'Void', color: [0.55, 0.2, 0.9], css: '#9a50ff' },
};

export const RARITY = {
  normal: { name: 'Normal', css: '#d8d8d8', value: 1 },
  magic: { name: 'Magic', css: '#6f8cff', value: 2.5 },
  rare: { name: 'Rare', css: '#ffe060', value: 5 },
  unique: { name: 'Unique', css: '#c8a060', value: 12 },
};

// proj kinds drive visuals: bolt arrow missile orb flame shard spark pellet cannon disc skull wave void javelin glob
export const WEAPON_BASES = [
  { id: 'crossbow', icon: 'crossbow', names: ['Light Crossbow', 'Arbalest', 'Siege Arbalest'], proj: 'bolt', dmg: [10, 16], rate: 1.8, speed: 48, life: 1.4, size: 0.12, elem: 'physical', sound: 'twang' },
  { id: 'repeater', icon: 'repeater', names: ['Repeater', 'Ballista Repeater', 'Myriad Repeater'], proj: 'bolt', dmg: [4, 7], rate: 6, speed: 42, life: 1.2, size: 0.09, spread: 0.035, elem: 'physical', sound: 'click' },
  { id: 'longbow', icon: 'longbow', names: ['Longbow', 'War Bow', 'Hydra Bow'], proj: 'arrow', dmg: [13, 22], rate: 1.3, speed: 40, life: 2.0, size: 0.12, gravity: 5, pierce: 1, elem: 'physical', sound: 'twang' },
  { id: 'wand', icon: 'wand', names: ['Yew Wand', 'Bone Wand', 'Lich Wand'], proj: 'missile', dmg: [5, 9], rate: 3.6, speed: 22, life: 1.8, size: 0.16, homing: 2.2, elem: 'arcane', sound: 'zap' },
  { id: 'staff', icon: 'staff', names: ['Battle Staff', 'War Staff', 'Archon Staff'], proj: 'orb', dmg: [18, 30], rate: 1.0, speed: 15, life: 2.5, size: 0.32, explode: 2.2, elem: 'fire', sound: 'whoosh' },
  { id: 'gauntlet', icon: 'gauntlet', names: ['Ember Gauntlet', 'Pyre Gauntlet', 'Inferno Gauntlet'], proj: 'flame', dmg: [2, 4], rate: 11, speed: 16, life: 0.45, size: 0.3, count: 2, spread: 0.14, pierce: 2, elem: 'fire', sound: 'flame' },
  { id: 'tome', icon: 'tome', names: ['Frost Tome', 'Grimoire of Rime', 'Codex of Winter'], proj: 'shard', dmg: [4, 7], rate: 1.6, speed: 32, life: 1.0, size: 0.12, count: 5, spread: 0.13, elem: 'cold', sound: 'shard' },
  { id: 'rod', icon: 'rod', names: ['Storm Rod', 'Tempest Rod', 'Thunder Scepter'], proj: 'spark', dmg: [6, 12], rate: 2.3, speed: 60, life: 0.8, size: 0.14, chain: 2, elem: 'lightning', sound: 'zap2' },
  { id: 'blunderbuss', icon: 'blunderbuss', names: ['Blunderbuss', 'Dragon Blunderbuss', 'Doom Blunderbuss'], proj: 'pellet', dmg: [3, 5], rate: 1.2, speed: 42, life: 0.7, size: 0.07, count: 8, spread: 0.2, elem: 'physical', sound: 'boom', knock: 3 },
  { id: 'cannon', icon: 'cannon', names: ['Hand Cannon', 'Bombard', 'Siege Cannon'], proj: 'cannon', dmg: [20, 34], rate: 0.8, speed: 24, life: 3, size: 0.25, gravity: 9, explode: 3.0, elem: 'fire', sound: 'boom' },
  { id: 'chakram', icon: 'chakram', names: ['Chakram', 'War Disc', 'Eclipse Ring'], proj: 'disc', dmg: [8, 13], rate: 2.0, speed: 26, life: 1.6, size: 0.22, bounce: 3, boomerang: 1, elem: 'physical', sound: 'whoosh' },
  { id: 'censer', icon: 'censer', names: ['Skull Censer', 'Bone Censer', 'Soul Censer'], proj: 'skull', dmg: [9, 15], rate: 1.6, speed: 11, life: 3, size: 0.25, homing: 3.5, elem: 'void', sound: 'moan' },
  { id: 'horn', icon: 'horn', names: ['War Horn', 'Bone Horn', 'Horn of Ruin'], proj: 'wave', dmg: [6, 10], rate: 1.4, speed: 18, life: 0.8, size: 0.7, pierce: 99, elem: 'arcane', knock: 6, sound: 'horn' },
  { id: 'voidorb', icon: 'voidorb', names: ['Void Orb', 'Abyssal Orb', 'Singularity'], proj: 'void', dmg: [7, 11], rate: 0.7, speed: 7, life: 3.2, size: 0.4, well: 1, pierce: 99, elem: 'void', sound: 'void' },
  { id: 'spear', icon: 'javelin', names: ['Spear Thrower', 'Lancer\'s Cradle', 'Dragon Spear Thrower'], proj: 'javelin', dmg: [14, 22], rate: 1.3, speed: 34, life: 2, size: 0.14, gravity: 3, pierce: 3, elem: 'physical', sound: 'twang' },
  { id: 'sling', icon: 'sling', names: ['Venom Sling', 'Plague Sling', 'Blight Sling'], proj: 'glob', dmg: [5, 8], rate: 2.0, speed: 19, life: 2, size: 0.2, gravity: 11, puddle: 1, elem: 'poison', sound: 'splat' },
];

export const ARMOR_BASES = [
  { id: 'helm', slot: 'head', icon: 'head', names: ['Cap', 'Helm', 'Great Helm'], armor: 4 },
  { id: 'circlet', slot: 'head', icon: 'head', names: ['Hood', 'Circlet', 'Crown'], armor: 2, extraAffix: true },
  { id: 'mail', slot: 'chest', icon: 'chest', names: ['Leather Armor', 'Chain Mail', 'Plate Mail'], armor: 9 },
  { id: 'robe', slot: 'chest', icon: 'chest', names: ['Robe', 'Brigandine', 'Dragonscale'], armor: 6, extraAffix: true },
  { id: 'greaves', slot: 'legs', icon: 'legs', names: ['Leather Leggings', 'Chain Greaves', 'Plate Greaves'], armor: 5 },
  { id: 'trousers', slot: 'legs', icon: 'legs', names: ['Trousers', 'Studded Legs', 'Wyrmhide Greaves'], armor: 3, extraAffix: true },
];

export const RING_BASES = [
  { id: 'ring', slot: 'ring', icon: 'ring', names: ['Copper Ring', 'Silver Ring', 'Obsidian Ring'] },
];

// Affix definition:
//  id, kind: 'prefix'|'suffix', slots: [...], stat, tiers: [{name, min, lvl, lo, hi}], scale (multiply by ilvl factor)
const T = (name, lvl, lo, hi) => ({ name, lvl, lo, hi });
const W = ['weapon'], A = ['head', 'chest', 'legs'], R = ['ring'], AR = ['head', 'chest', 'legs', 'ring'], ALL = ['weapon', 'head', 'chest', 'legs', 'ring'];

export const AFFIXES = [
  // ---- weapon prefixes
  { id: 'pctDmg', kind: 'prefix', slots: W, stat: 'pctDmg', tiers: [T('Jagged', 1, 10, 25), T('Deadly', 5, 26, 45), T('Vicious', 10, 46, 70), T('Brutal', 16, 71, 100), T('Savage', 24, 101, 140), T('Merciless', 34, 141, 200), T('Godly', 46, 201, 300)] },
  { id: 'addFire', kind: 'prefix', slots: W, stat: 'addFire', tiers: [T('Smoldering', 2, 10, 20), T('Burning', 8, 21, 40), T('Blazing', 18, 41, 70), T('Infernal', 32, 71, 120)] },
  { id: 'addCold', kind: 'prefix', slots: W, stat: 'addCold', tiers: [T('Chilling', 2, 10, 20), T('Freezing', 8, 21, 40), T('Glacial', 18, 41, 70), T('Arctic', 32, 71, 120)] },
  { id: 'addLightning', kind: 'prefix', slots: W, stat: 'addLightning', tiers: [T('Static', 2, 10, 20), T('Shocking', 8, 21, 40), T('Arcing', 18, 41, 70), T('Thundering', 32, 71, 120)] },
  { id: 'addPoison', kind: 'prefix', slots: W, stat: 'addPoison', tiers: [T('Septic', 2, 10, 20), T('Toxic', 8, 21, 40), T('Venomous', 18, 41, 70), T('Pestilent', 32, 71, 120)] },
  { id: 'addArcane', kind: 'prefix', slots: W, stat: 'addArcane', tiers: [T('Mystic', 4, 10, 25), T('Arcane', 14, 26, 50), T('Eldritch', 30, 51, 100)] },
  { id: 'proj', kind: 'prefix', slots: W, stat: 'extraProj', tiers: [T('Twinned', 6, 1, 1), T('Tripled', 18, 2, 2), T('Myriad', 36, 3, 4)] },
  { id: 'pierce', kind: 'prefix', slots: W, stat: 'pierce', tiers: [T('Piercing', 3, 1, 2), T('Impaling', 14, 3, 5)] },
  { id: 'homing', kind: 'prefix', slots: W, stat: 'homing', tiers: [T('Seeking', 4, 1.5, 2), T('Hunting', 16, 2.5, 4)] },
  { id: 'explode', kind: 'prefix', slots: W, stat: 'explode', tiers: [T('Volatile', 4, 1.5, 2.2), T('Explosive', 14, 2.3, 3.2), T('Cataclysmic', 30, 3.3, 4.8)] },
  { id: 'split', kind: 'prefix', slots: W, stat: 'split', tiers: [T('Splintering', 8, 2, 2), T('Fracturing', 20, 3, 4), T('Shattering', 40, 5, 7)] },
  { id: 'bounce', kind: 'prefix', slots: W, stat: 'bounce', tiers: [T('Ricocheting', 5, 1, 2), T('Caroming', 18, 3, 5)] },
  { id: 'chain', kind: 'prefix', slots: W, stat: 'chain', tiers: [T('Forking', 7, 1, 2), T('Branching', 22, 3, 4)] },
  // ---- weapon suffixes
  { id: 'fireRate', kind: 'suffix', slots: W, stat: 'fireRate', tiers: [T('of Speed', 1, 8, 15), T('of Haste', 8, 16, 28), T('of Alacrity', 20, 29, 45), T('of Fury', 38, 46, 70)] },
  { id: 'projSpeed', kind: 'suffix', slots: W, stat: 'projSpeed', tiers: [T('of Flight', 1, 15, 30), T('of the Gale', 12, 31, 60)] },
  { id: 'crit', kind: 'suffix', slots: ['weapon', 'head', 'ring'], stat: 'crit', tiers: [T('of Precision', 3, 3, 6), T('of Accuracy', 12, 7, 12), T('of the Assassin', 28, 13, 20)] },
  { id: 'critDmg', kind: 'suffix', slots: ['weapon', 'ring'], stat: 'critDmg', tiers: [T('of Ruin', 6, 20, 40), T('of Devastation', 20, 41, 80), T('of Annihilation', 40, 81, 150)] },
  { id: 'lifeSteal', kind: 'suffix', slots: ['weapon', 'ring'], stat: 'lifeSteal', tiers: [T('of the Leech', 3, 1, 2), T('of the Bat', 12, 3, 4), T('of the Vampire', 26, 5, 7)] },
  { id: 'lifeOnKill', kind: 'suffix', slots: ['weapon', 'ring', 'head'], stat: 'lifeOnKill', scale: true, tiers: [T('of Feasting', 2, 2, 5), T('of Gluttony', 14, 6, 12)] },
  { id: 'knock', kind: 'suffix', slots: W, stat: 'knock', tiers: [T('of Force', 1, 2, 4), T('of the Titan', 14, 5, 9)] },
  { id: 'sine', kind: 'suffix', slots: W, stat: 'sine', tiers: [T('of the Serpent', 6, 1, 1)] },
  { id: 'boomerang', kind: 'suffix', slots: W, stat: 'boomerang', tiers: [T('of Returning', 10, 1, 1)] },
  { id: 'nova', kind: 'suffix', slots: W, stat: 'nova', tiers: [T('of Novas', 22, 6, 8), T('of Supernovas', 44, 10, 14)] },
  { id: 'cluster', kind: 'suffix', slots: W, stat: 'cluster', tiers: [T('of Clusters', 28, 3, 5)] },
  { id: 'meteor', kind: 'suffix', slots: W, stat: 'meteor', tiers: [T('of Meteors', 36, 15, 30), T('of Armageddon', 60, 31, 60)] },
  { id: 'fractal', kind: 'suffix', slots: W, stat: 'fractal', tiers: [T('of the Fractal', 50, 1, 1)] },
  { id: 'chaos', kind: 'suffix', slots: W, stat: 'chaos', tiers: [T('of Chaos', 55, 1, 1)] },
  { id: 'grow', kind: 'suffix', slots: W, stat: 'grow', tiers: [T('of Swelling', 15, 1, 2)] },
  { id: 'spiral', kind: 'suffix', slots: W, stat: 'spiral', tiers: [T('of the Vortex', 32, 1, 1)] },
  // ---- armor prefixes
  { id: 'life', kind: 'prefix', slots: AR, stat: 'life', scale: true, tiers: [T('Sturdy', 1, 5, 10), T('Robust', 6, 11, 20), T('Hale', 14, 21, 32), T('Vigorous', 26, 33, 46), T('Colossal', 40, 47, 64)] },
  { id: 'pctArmor', kind: 'prefix', slots: A, stat: 'pctArmor', tiers: [T('Reinforced', 1, 15, 35), T('Fortified', 10, 36, 70), T('Impregnable', 26, 71, 120)] },
  { id: 'moveSpeed', kind: 'prefix', slots: ['legs', 'ring'], stat: 'moveSpeed', tiers: [T('Swift', 2, 5, 10), T('Fleet', 12, 11, 18), T('Mercurial', 28, 19, 28)] },
  { id: 'armorDmg', kind: 'prefix', slots: ['head', 'ring'], stat: 'pctDmg', tiers: [T('Fierce', 3, 5, 12), T('Wrathful', 14, 13, 25), T('Apocalyptic', 32, 26, 45)] },
  { id: 'ringFire', kind: 'prefix', slots: ['ring'], stat: 'fireRate', tiers: [T('Quick', 4, 5, 10), T('Frenzied', 18, 11, 18)] },
  { id: 'leaping', kind: 'prefix', slots: R, stat: 'extraJumps', tiers: [T('Leaping', 1, 1, 1), T('Soaring', 24, 2, 2)] },
  { id: 'stomp', kind: 'prefix', slots: ['ring', 'legs'], stat: 'stomp', scale: true, tiers: [T('Quaking', 12, 15, 30)] },
  { id: 'hydra', kind: 'prefix', slots: R, stat: 'extraProj', tiers: [T('Hydra', 40, 1, 1)] },
  // ---- armor / ring suffixes
  { id: 'resFire', kind: 'suffix', slots: AR, stat: 'resFire', tiers: [T('of the Salamander', 1, 8, 15), T('of the Phoenix', 12, 16, 30)] },
  { id: 'resCold', kind: 'suffix', slots: AR, stat: 'resCold', tiers: [T('of Warmth', 1, 8, 15), T('of the Hearth', 12, 16, 30)] },
  { id: 'resLightning', kind: 'suffix', slots: AR, stat: 'resLightning', tiers: [T('of Grounding', 1, 8, 15), T('of the Storm', 12, 16, 30)] },
  { id: 'resPoison', kind: 'suffix', slots: AR, stat: 'resPoison', tiers: [T('of the Antidote', 1, 8, 15), T('of Purity', 12, 16, 30)] },
  { id: 'resAll', kind: 'suffix', slots: AR, stat: 'resAll', tiers: [T('of the Prism', 10, 5, 10), T('of the Rainbow', 26, 11, 20)] },
  { id: 'regen', kind: 'suffix', slots: AR, stat: 'lifeRegen', scale: true, tiers: [T('of Regeneration', 2, 0.5, 1.2), T('of Renewal', 16, 1.3, 2.5)] },
  { id: 'thorns', kind: 'suffix', slots: A, stat: 'thorns', scale: true, tiers: [T('of Thorns', 3, 3, 8), T('of Spikes', 16, 9, 20)] },
  { id: 'xp', kind: 'suffix', slots: ['head', 'ring', 'chest'], stat: 'xpPct', tiers: [T('of Wisdom', 4, 5, 10), T('of Enlightenment', 20, 11, 20)] },
  { id: 'gold', kind: 'suffix', slots: ALL, stat: 'goldFind', tiers: [T('of Greed', 1, 15, 40), T('of Avarice', 14, 41, 80)] },
  { id: 'mf', kind: 'suffix', slots: ALL, stat: 'magicFind', tiers: [T('of Fortune', 3, 8, 18), T('of Luck', 16, 19, 35)] },
  { id: 'magnet', kind: 'suffix', slots: ['ring', 'chest'], stat: 'pickupRadius', tiers: [T('of Magnetism', 2, 2, 4)] },
  { id: 'dash', kind: 'suffix', slots: R, stat: 'dash', tiers: [T('of the Wind', 1, 1, 1), T('of the Tempest', 20, 2, 2)] },
  { id: 'glide', kind: 'suffix', slots: R, stat: 'glide', tiers: [T('of Feathers', 6, 1, 1)] },
  { id: 'dashNova', kind: 'suffix', slots: ['ring', 'legs'], stat: 'dashNova', tiers: [T('of Thunder Steps', 22, 1, 1)] },
];

export const STAT_LABELS = {
  pctDmg: (v) => `+${v}% Damage`,
  addFire: (v) => `+${v}% Damage as Fire`,
  addCold: (v) => `+${v}% Damage as Cold`,
  addLightning: (v) => `+${v}% Damage as Lightning`,
  addPoison: (v) => `+${v}% Damage as Poison`,
  addArcane: (v) => `+${v}% Damage as Arcane`,
  extraProj: (v) => `+${v} Projectile${v > 1 ? 's' : ''}`,
  pierce: (v) => (v >= 50 ? 'Pierces All Enemies' : `Pierces ${v} Enem${v > 1 ? 'ies' : 'y'}`),
  homing: (v) => `Projectiles Seek Targets (${v.toFixed(1)})`,
  explode: (v) => `Explodes on Impact (${v.toFixed(1)}m)`,
  split: (v) => `Splits into ${v} on Hit`,
  bounce: (v) => `Ricochets off Walls ${v}x`,
  chain: (v) => `Chains to ${v} Additional Target${v > 1 ? 's' : ''}`,
  fireRate: (v) => `+${v}% Attack Speed`,
  projSpeed: (v) => `+${v}% Projectile Speed`,
  crit: (v) => `+${v}% Critical Strike Chance`,
  critDmg: (v) => `+${v}% Critical Damage`,
  lifeSteal: (v) => `${v}% Life Stolen per Hit`,
  lifeOnKill: (v) => `+${v} Life per Kill`,
  knock: (v) => `Knockback +${v}`,
  sine: () => 'Projectiles Weave like Serpents',
  boomerang: () => 'Projectiles Return to You',
  nova: (v) => `Hits Release a Nova of ${v} Shards (20%)`,
  cluster: (v) => `Explosions Scatter ${v} Bomblets`,
  meteor: (v) => `${v}% Chance to Call Down a Meteor`,
  fractal: () => 'Splits Recursively (Fractal)',
  chaos: () => 'Every Shot is Chaos',
  grow: (v) => `Projectiles Swell in Flight (+${v * 100}%)`,
  spiral: () => 'Projectiles Spiral Outward',
  life: (v) => `+${v} Maximum Life`,
  pctArmor: (v) => `+${v}% Armor`,
  moveSpeed: (v) => `+${v}% Movement Speed`,
  extraJumps: (v) => (v === 1 ? 'Grants Double Jump' : `+${v} Extra Jumps`),
  stomp: (v) => `Landing Quakes the Ground (${v} dmg)`,
  resFire: (v) => `Fire Resist +${v}%`,
  resCold: (v) => `Cold Resist +${v}%`,
  resLightning: (v) => `Lightning Resist +${v}%`,
  resPoison: (v) => `Poison Resist +${v}%`,
  resAll: (v) => `All Resistances +${v}%`,
  lifeRegen: (v) => `Regenerate ${v} Life per Second`,
  thorns: (v) => `Attackers Take ${v} Damage`,
  xpPct: (v) => `+${v}% Experience Gained`,
  goldFind: (v) => `${v}% Extra Gold from Monsters`,
  magicFind: (v) => `${v}% Better Chance of Magic Items`,
  pickupRadius: (v) => `+${v}m Pickup Radius`,
  dash: (v) => (v === 1 ? 'Grants Dash' : `Grants Dash (${v} charges)`),
  glide: () => 'Hold Jump to Glide',
  dashNova: () => 'Dashing Unleashes Lightning',
  armor: (v) => `+${v} Armor`,
  burn: () => 'Sets Enemies Ablaze',
  well: () => 'Pulls Enemies Inward',
  puddle: () => 'Leaves Toxic Pools',
};

// Uniques: fixed name + base + special mods. "scale" stats multiply with ilvl.
export const UNIQUES = [
  { id: 'hydraTongue', name: "The Hydra's Tongue", base: 'wand', lvl: 6, mods: { extraProj: 2, split: 3, homing: 2.5, pctDmg: 150 } },
  { id: 'cinderstorm', name: 'Cinderstorm', base: 'gauntlet', lvl: 8, mods: { explode: 1.6, pctDmg: 120, fireRate: 30, addFire: 50 } },
  { id: 'gravemaker', name: 'Gravemaker', base: 'censer', lvl: 12, mods: { nova: 8, pctDmg: 180, lifeOnKill: 8, extraProj: 1 } },
  { id: 'thunderfall', name: 'Thunderfall', base: 'rod', lvl: 10, mods: { chain: 6, meteor: 20, pctDmg: 160, addLightning: 40 } },
  { id: 'endlessWaltz', name: 'The Endless Waltz', base: 'chakram', lvl: 9, mods: { bounce: 10, extraProj: 2, pctDmg: 120, pierce: 3 } },
  { id: 'rainOfRuin', name: 'Rain of Ruin', base: 'crossbow', lvl: 5, mods: { split: 8, pctDmg: 200, crit: 10 } },
  { id: 'dragonBreath', name: "Dragon's Breath", base: 'blunderbuss', lvl: 11, mods: { explode: 1.4, addFire: 80, pctDmg: 150 } },
  { id: 'worldbreaker', name: 'Worldbreaker', base: 'cannon', lvl: 16, mods: { explode: 5.5, cluster: 6, pctDmg: 220 } },
  { id: 'eyeOfAbyss', name: 'Eye of the Abyss', base: 'voidorb', lvl: 18, mods: { extraProj: 2, pctDmg: 200, grow: 2 } },
  { id: 'bansheeWail', name: "Banshee's Wail", base: 'horn', lvl: 13, mods: { extraProj: 4, addCold: 60, pctDmg: 160 } },
  { id: 'fractalGrimoire', name: 'The Fractal Grimoire', base: 'tome', lvl: 20, mods: { fractal: 1, split: 3, pctDmg: 150 } },
  { id: 'serpentKiss', name: "Serpent's Kiss", base: 'sling', lvl: 7, mods: { sine: 1, extraProj: 2, addPoison: 70, pctDmg: 170 } },
  { id: 'skewer', name: 'Skewer of Saints', base: 'spear', lvl: 14, mods: { pierce: 99, projSpeed: 80, chain: 3, pctDmg: 200 } },
  { id: 'starfall', name: 'Starfall', base: 'staff', lvl: 22, mods: { meteor: 100, pctDmg: 180, explode: 3 } },
  { id: 'chaosEngine', name: 'The Chaos Engine', base: 'repeater', lvl: 25, mods: { chaos: 1, fireRate: 50, pctDmg: 120 } },
  { id: 'windrunner', name: 'Windrunner', base: 'longbow', lvl: 4, mods: { extraProj: 4, pierce: 2, homing: 1.2, pctDmg: 150 } },
  { id: 'vortexHeart', name: 'Heart of the Vortex', base: 'wand', lvl: 30, mods: { spiral: 1, extraProj: 3, split: 2, pctDmg: 220 } },
  { id: 'crownUndying', name: 'Crown of the Undying', base: 'circlet', lvl: 8, mods: { life: 40, lifeRegen: 3, resAll: 25 } },
  { id: 'visageWrath', name: 'Visage of Wrath', base: 'helm', lvl: 12, mods: { pctDmg: 50, crit: 10, life: 20 } },
  { id: 'dragonhide', name: 'Dragonhide Mantle', base: 'mail', lvl: 10, mods: { pctArmor: 150, resFire: 60, thorns: 20 } },
  { id: 'lichShroud', name: 'Shroud of the Lich', base: 'robe', lvl: 15, mods: { life: 60, resCold: 50, lifeSteal: 5 } },
  { id: 'sevenLeague', name: 'Seven League Greaves', base: 'greaves', lvl: 6, mods: { moveSpeed: 35, extraJumps: 1, life: 20 } },
  { id: 'stormtread', name: 'Stormtread', base: 'trousers', lvl: 16, mods: { moveSpeed: 20, dash: 1, dashNova: 1 } },
  { id: 'phoenixBand', name: 'Band of the Phoenix', base: 'ring', lvl: 6, mods: { extraJumps: 2, glide: 1, resFire: 40 } },
  { id: 'voidWalker', name: 'Ring of the Void Walker', base: 'ring', lvl: 14, mods: { dash: 2, moveSpeed: 20, dashNova: 1 } },
  { id: 'hydraCoil', name: 'Hydra Coil', base: 'ring', lvl: 24, mods: { extraProj: 1, pctDmg: 40 } },
  { id: 'bloodbond', name: 'Bloodbond', base: 'ring', lvl: 9, mods: { lifeSteal: 8, life: 30 } },
  { id: 'gildedGreed', name: 'Gilded Greed', base: 'ring', lvl: 3, mods: { goldFind: 150, magicFind: 80 } },
  { id: 'stomper', name: "Stomper's Signet", base: 'ring', lvl: 12, mods: { stomp: 40, extraJumps: 1 } },
];

const RARE_A = ['Doom', 'Grim', 'Blood', 'Storm', 'Bone', 'Soul', 'Dread', 'Wraith', 'Ghoul', 'Plague', 'Raven', 'Viper', 'Ember', 'Frost', 'Shadow', 'Rune', 'Corpse', 'Hate', 'Death', 'Gloom', 'Pain', 'Wyrm', 'Demon', 'Star', 'Eagle', 'Beast', 'Skull', 'Rift', 'Ash', 'Iron'];
const RARE_B = {
  weapon: ['Bite', 'Song', 'Thirst', 'Fang', 'Scourge', 'Breath', 'Wind', 'Howl', 'Strike', 'Spike', 'Call', 'Kiss', 'Spire', 'Sting', 'Wrack', 'Flight', 'Rain', 'Shot'],
  head: ['Visage', 'Crest', 'Cowl', 'Brow', 'Horn', 'Shroud', 'Veil', 'Mask', 'Hood', 'Visor'],
  chest: ['Hide', 'Shell', 'Coat', 'Mantle', 'Carapace', 'Wrap', 'Guard', 'Ward', 'Suit', 'Pelt'],
  legs: ['Stride', 'Tread', 'Greaves', 'Legs', 'Spurs', 'March', 'Track', 'Step'],
  ring: ['Band', 'Coil', 'Loop', 'Circle', 'Eye', 'Knot', 'Spiral', 'Grip', 'Twine', 'Hold'],
};
export function rareName(rng, slot) {
  return `${rng.pick(RARE_A)} ${rng.pick(RARE_B[slot])}`;
}
