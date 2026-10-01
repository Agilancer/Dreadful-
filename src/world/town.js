// The overworld town of Hollowmere: shops around a plaza, dungeon gate to the north.
import { Level, T, tileCenter } from './level.js';
import { RNG } from '../rng.js';
import { TOWN_THEME } from '../gfx/textures.js';

export const SHOPS = {
  smith: { name: 'Garrick the Weaponsmith', title: 'Weapons', npc: 'smith', sells: 'weapon' },
  armorer: { name: 'Hilde the Armorer', title: 'Armor', npc: 'armorer', sells: 'armor' },
  jeweler: { name: 'Orsolya the Jeweler', title: 'Rings', npc: 'jeweler', sells: 'ring' },
  alchemist: { name: 'Brother Wendel', title: 'Potions', npc: 'alchemist', sells: 'potion' },
  gambler: { name: 'Mad Tobias', title: 'Gamble', npc: 'gambler', sells: 'gamble' },
};

export function generateTown() {
  const S = 36;
  const rng = new RNG(1234);
  const lvl = new Level(S, S, { outdoor: true, wallH: 6, ambient: TOWN_THEME.ambient });
  lvl.theme = TOWN_THEME;
  lvl.depth = 0;
  // open everything inside the border as grass
  for (let z = 1; z < S - 1; z++) for (let x = 1; x < S - 1; x++) lvl.open(x, z, 0, 2);
  // plaza and roads (cobble)
  for (let z = 10; z < 27; z++) for (let x = 10; x < 26; x++) lvl.open(x, z, 0, 0);
  for (let z = 3; z < 33; z++) for (let x = 16; x < 20; x++) lvl.open(x, z, 0, 0);
  for (let z = 13; z < 18; z++) for (let x = 3; x < 33; x++) lvl.open(x, z, 0, 0);

  const building = (x0, z0, x1, z1, code = 3, h = 5.5) => {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const i = lvl.idx(x, z);
      lvl.solid[i] = code; lvl.wallH[i] = h;
    }
  };
  const objects = lvl.objects;
  const torchCol = TOWN_THEME.torch;
  const shopAt = (id, bx0, bz0, bx1, bz1, ntx, ntz) => {
    building(bx0, bz0, bx1, bz1);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++)
      if (!lvl.isSolid(ntx + dx, ntz + dz)) lvl.open(ntx + dx, ntz + dz, 0, 0);
    const x = tileCenter(ntx), z = tileCenter(ntz);
    objects.push({ type: 'npc', shop: id, x, z, y: 0 });
    // lantern near shopkeeper
    lvl.lights.push({ x, z, y: 2.6, color: torchCol, radius: 9, intensity: 1.1 });
  };
  shopAt('smith', 3, 9, 8, 12, 6, 13);
  objects.push({ type: 'anvil', x: tileCenter(7), z: tileCenter(14), y: 0 });
  shopAt('armorer', 27, 9, 32, 12, 29, 13);
  shopAt('jeweler', 4, 27, 11, 31, 8, 26);
  shopAt('alchemist', 24, 27, 31, 31, 27, 26);
  shopAt('gambler', 4, 3, 9, 6, 7, 7);
  // extra houses
  building(24, 3, 29, 6);
  building(27, 19, 32, 23, 3, 5);
  building(3, 19, 8, 23, 3, 5);

  // dungeon gate structure
  building(14, 1, 21, 5, 1, 7.5);
  for (let z = 3; z <= 5; z++) for (let x = 16; x <= 19; x++) lvl.open(x, z, 0, 0);
  const gx = tileCenter(17) + T / 2, gz = tileCenter(4);
  objects.push({ type: 'dungeonGate', x: gx, z: gz, y: 0 });
  lvl.lights.push({ x: gx, z: gz, y: 1.5, color: [1.0, 0.25, 0.15], radius: 11, intensity: 1.5 });
  objects.push({ type: 'brazier', x: tileCenter(15), z: tileCenter(7), y: 0 });
  objects.push({ type: 'brazier', x: tileCenter(20), z: tileCenter(7), y: 0 });
  lvl.lights.push({ x: tileCenter(15), z: tileCenter(7), y: 1.6, color: torchCol, radius: 10, intensity: 1.2 });
  lvl.lights.push({ x: tileCenter(20), z: tileCenter(7), y: 1.6, color: torchCol, radius: 10, intensity: 1.2 });

  // fountain in the plaza center (invisible blocker under it)
  lvl.solid[lvl.idx(17, 19)] = 4; lvl.solid[lvl.idx(18, 19)] = 4;
  objects.push({ type: 'fountain', x: tileCenter(17) + T / 2, z: tileCenter(19), y: 0 });
  lvl.lights.push({ x: tileCenter(17) + T / 2, z: tileCenter(19), y: 2, color: [0.4, 0.5, 0.8], radius: 8, intensity: 0.6 });

  // plaza braziers
  for (const [tx, tz] of [[11, 11], [24, 11], [11, 25], [24, 25]]) {
    objects.push({ type: 'brazier', x: tileCenter(tx), z: tileCenter(tz), y: 0 });
    lvl.lights.push({ x: tileCenter(tx), z: tileCenter(tz), y: 1.6, color: torchCol, radius: 11, intensity: 1.1 });
  }
  // trees on grass
  for (let k = 0; k < 40; k++) {
    const t = lvl.randomOpen(rng, (x, z) => lvl.floorMat[lvl.idx(x, z)] === 2);
    if (!t) continue;
    objects.push({ type: rng.chance(0.7) ? 'tree' : 'deadtree', x: tileCenter(t[0]) + rng.float(-0.8, 0.8), z: tileCenter(t[1]) + rng.float(-0.8, 0.8), y: 0 });
    lvl.solid[lvl.idx(t[0], t[1])] = 4;
  }
  for (let k = 0; k < 8; k++) {
    const t = lvl.randomOpen(rng, (x, z) => lvl.floorMat[lvl.idx(x, z)] === 0 && (x < 12 || x > 23));
    if (t) objects.push({ type: 'barrel', x: tileCenter(t[0]), z: tileCenter(t[1]), y: 0 });
  }
  lvl.spawn = { x: tileCenter(17) + T / 2, z: tileCenter(23), yaw: 0 };
  lvl.bakeLighting();
  return lvl;
}
