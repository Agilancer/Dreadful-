// World props (torches, chests, portals, NPCs, shrines, decor) and ground pickups.
import * as THREE from 'three';
import { G } from '../state.js';
import { rng, RNG } from '../rng.js';
import { billboardGeo, spriteMaterial } from '../gfx/materials.js';
import { objectSprite, creatureSheet, NPC_DEFS, itemIconTexture } from '../gfx/sprites.js';
import { generateItem, itemIconInfo } from '../items/itemgen.js';
import { RARITY } from '../items/itemData.js';
import { sfx } from '../audio.js';
import { canvas } from '../gfx/textures.js';

const PROP_DEFS = {
  torch: { sprite: 'torch', frames: 2, w: 0.6, h: 1.2, full: true, anim: 6 },
  brazier: { sprite: 'brazier', frames: 2, w: 1.2, h: 1.6, full: true, anim: 6, solid: 0.4 },
  chest: { sprite: 'chest', w: 1.1, h: 1.1, solid: 0.5 },
  chestGold: { sprite: 'chestGold', w: 1.2, h: 1.2, solid: 0.5 },
  portalUp: { sprite: 'portal', frames: 2, w: 2.0, h: 3.0, full: true, anim: 3 },
  dungeonGate: { sprite: 'portal', frames: 2, w: 2.4, h: 3.4, full: true, anim: 3, tint: [1.6, 0.5, 0.4] },
  stairsDown: { sprite: 'stairsDown', w: 2.4, h: 2.4, full: true, tint: [1.2, 0.6, 0.5] },
  shrine: { sprite: 'shrine', frames: 2, w: 1.0, h: 1.8, anim: 2, solid: 0.4 },
  tree: { sprite: 'tree', w: 4.5, h: 6 },
  deadtree: { sprite: 'deadtree', w: 4.5, h: 6 },
  barrel: { sprite: 'barrel', w: 0.9, h: 1.1, solid: 0.4 },
  bones: { sprite: 'bones', w: 1.0, h: 0.5 },
  fountain: { sprite: 'fountain', frames: 2, w: 5, h: 4, anim: 3 },
  anvil: { sprite: 'anvil', w: 1.2, h: 0.8, solid: 0.5 },
};

const SHRINES = {
  might: { name: 'Shrine of Might', desc: 'Damage doubled', color: [1, 0.3, 0.2] },
  swift: { name: 'Shrine of Swiftness', desc: 'Faster movement & attacks', color: [0.3, 1, 0.5] },
  armor: { name: 'Shrine of Stone', desc: 'Armor doubled', color: [0.7, 0.7, 0.8] },
  wisdom: { name: 'Shrine of Wisdom', desc: '+50% experience', color: [0.5, 0.6, 1] },
  fortune: { name: 'Shrine of Fortune', desc: 'More gold & magic items', color: [1, 0.85, 0.2] },
  frenzy: { name: 'Shrine of Frenzy', desc: 'Extra projectile & attack speed', color: [1, 0.2, 0.8] },
};

function makeBillboard(tex, frames, w, h, opts = {}) {
  const mat = spriteMaterial(tex, frames, opts);
  const mesh = new THREE.Mesh(billboardGeo, mat);
  mesh.scale.set(w, h, 1);
  return { mesh, mat };
}

export function buildProps(level) {
  G.props = [];
  for (const o of level.objects) {
    if (o.type === 'monster') continue;
    let kind = o.type;
    if (kind === 'chest' && o.gold) kind = 'chestGold';
    let tex, frames = 1, def = PROP_DEFS[kind];
    if (kind === 'npc') {
      const sheet = creatureSheet('npc_' + o.shop, NPC_DEFS[SHOP_NPC[o.shop]] || NPC_DEFS.smith);
      tex = sheet.texture; frames = 4;
      def = { w: 1.9, h: 1.9, solid: 0.45 };
    } else {
      if (!def) continue;
      const s = objectSprite(def.sprite, def.frames || 1);
      tex = s.texture; frames = def.frames || 1;
    }
    const { mesh, mat } = makeBillboard(tex, frames, def.w, def.h, { fullbright: def.full });
    mesh.position.set(o.x, o.y || 0, o.z);
    if (def.tint) mat.uniforms.tint.value.set(...def.tint);
    G.scene.add(mesh);
    level.sampleLight(o.x, o.z, mat.uniforms.baseLight.value);
    const prop = { kind, o, mesh, mat, def, frames, x: o.x, y: o.y || 0, z: o.z, anim: rng.float(0, 10) };
    if (kind === 'chest' || kind === 'chestGold') {
      prop.label = kind === 'chestGold' ? 'Open Ornate Chest' : 'Open Chest';
      prop.interact = () => openChest(prop);
    } else if (kind === 'portalUp') {
      prop.label = 'Return to Town';
      prop.interact = () => G.actions.returnToTown();
    } else if (kind === 'stairsDown') {
      prop.label = `Descend to Depth ${G.depth + 1}`;
      prop.interact = () => G.actions.descend();
    } else if (kind === 'dungeonGate') {
      prop.label = 'Enter the Dungeon';
      prop.interact = () => G.actions.enterDungeon();
    } else if (kind === 'npc') {
      prop.label = 'Trade';
      prop.shop = o.shop;
      prop.interact = () => G.actions.openShop(o.shop);
      prop.npc = true;
    } else if (kind === 'shrine') {
      const s = SHRINES[o.kind];
      prop.label = `Activate ${s.name}`;
      prop.shrine = o.kind;
      prop.interact = () => useShrine(prop);
    }
    G.props.push(prop);
  }
}

const SHOP_NPC = { smith: 'smith', armorer: 'armorer', jeweler: 'jeweler', alchemist: 'alchemist', gambler: 'gambler' };

function openChest(prop) {
  if (prop.opened) return;
  prop.opened = true;
  prop.label = null; prop.interact = null;
  const s = objectSprite('chestOpen', 1);
  prop.mat.uniforms.map.value = s.texture;
  sfx('chest', 0.7);
  const gold = prop.kind === 'chestGold';
  dropLoot(prop.x, prop.z, prop.y, {
    itemChance: 1, items: gold ? rng.int(3, 5) : rng.int(1, 3), bonus: gold ? 1.2 : 0.4,
    goldChance: 1, goldMul: gold ? 5 : 2, orbChance: 0.3, mf: G.player.stats.magicFind, spread: 3,
  });
}

function useShrine(prop) {
  const s = SHRINES[prop.shrine];
  prop.label = null; prop.interact = null;
  prop.mat.uniforms.map.value = objectSprite('shrineUsed', 1).texture;
  prop.mat.uniforms.frames.value = 1;
  prop.frames = 1; prop.def = { ...prop.def, anim: 0 };
  G.player.addBuff(prop.shrine, 60);
  G.ui.log(`${s.name}: ${s.desc} (60s)`, '#9fd8ff');
  G.fx.burst({ x: prop.x, y: 1.5, z: prop.z }, s.color, 40, 6, 0.8, 0.2);
  sfx('shrine', 0.8);
}

export function updateProps(dt) {
  const lvl = G.level;
  for (const p of G.props) {
    if (p.def.anim && p.frames > 1) {
      p.anim += dt * p.def.anim;
      p.mat.uniforms.frame.value = Math.floor(p.anim) % p.frames;
    }
    if (p.kind === 'portalUp' || p.kind === 'dungeonGate' || p.kind === 'stairsDown') {
      if (rng.chance(dt * 20)) {
        const col = p.kind === 'portalUp' ? [0.4, 0.5, 1] : [1, 0.3, 0.2];
        G.fx.glow.emit(p.x + rng.float(-0.8, 0.8), p.y + rng.float(0, 0.5), p.z + rng.float(-0.8, 0.8), 0, rng.float(1, 3), 0, col[0], col[1], col[2], 1, 0.12, 1, 0, 0);
      }
    }
    if (p.kind === 'torch' || p.kind === 'brazier') {
      if (rng.chance(dt * (p.kind === 'brazier' ? 10 : 3))) G.fx.glow.emit(p.x + rng.float(-0.1, 0.1), p.y + (p.kind === 'brazier' ? 1.3 : 1.15), p.z + rng.float(-0.1, 0.1), 0, rng.float(0.8, 1.6), 0, 1, 0.55, 0.15, 1, 0.06, 0.6, 0, 0);
    }
    if (p.npc) {
      // face the player-ish, idle bob between frames 0/1 slowly
      p.anim += dt;
      p.mat.uniforms.frame.value = Math.floor(p.anim * 0.8) % 2;
      lvl.sampleLight(p.x, p.z, p.mat.uniforms.baseLight.value);
    }
  }
}

// Solid props push the player out
export function propCollide(pos, r) {
  for (const p of G.props) {
    const s = p.def.solid;
    if (!s) continue;
    const dx = pos.x - p.x, dz = pos.z - p.z;
    const d = Math.hypot(dx, dz), rr = s + r;
    if (d < rr && d > 1e-4 && pos.y < p.y + p.def.h * 0.8) { pos.x = p.x + (dx / d) * rr; pos.z = p.z + (dz / d) * rr; }
  }
}

export function nearestInteractable(pos, yaw) {
  let best = null, bs = 1e9;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  for (const p of G.props) {
    if (!p.interact) continue;
    const dx = p.x - pos.x, dz = p.z - pos.z;
    const d = Math.hypot(dx, dz);
    const reach = p.npc ? 3.2 : p.kind === 'dungeonGate' || p.kind === 'portalUp' || p.kind === 'stairsDown' ? 2.8 : 2.3;
    if (d > reach || Math.abs(p.y - pos.y) > 1.6) continue;
    const facing = d < 1.2 ? 1 : (dx * fx + dz * fz) / d;
    if (facing < 0.2) continue;
    const score = d - facing * 2;
    if (score < bs) { bs = score; best = p; }
  }
  return best;
}

export function clearProps() {
  for (const p of G.props) { G.scene.remove(p.mesh); p.mat.dispose(); }
  G.props = [];
  clearPickups();
}

// --------------------------------------------------------------------------
// Pickups
// --------------------------------------------------------------------------
let beamTex = null;
function getBeamTex() {
  if (beamTex) return beamTex;
  const c = canvas(4, 32), ctx = c.getContext('2d');
  for (let y = 0; y < 32; y++) {
    const a = (y / 32) ** 1.5;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(1, y, 2, 1);
    ctx.fillStyle = `rgba(255,255,255,${a * 0.4})`;
    ctx.fillRect(0, y, 1, 1); ctx.fillRect(3, y, 1, 1);
  }
  beamTex = new THREE.CanvasTexture(c);
  beamTex.magFilter = beamTex.minFilter = THREE.NearestFilter;
  return beamTex;
}

const RARITY_BEAM = { magic: [0.35, 0.45, 1.0], rare: [1.0, 0.85, 0.2], unique: [1.0, 0.55, 0.15] };

export function spawnPickup(kind, x, y, z, data = {}) {
  const pk = { kind, x, y: y + 0.6, z, vx: rng.float(-2, 2) * (data.spread || 1), vy: rng.float(3, 5), vz: rng.float(-2, 2) * (data.spread || 1), ...data, t: 0 };
  let tex, w = 0.5, h = 0.5;
  if (kind === 'gold') { tex = objectSprite('coin').texture; w = h = 0.5; }
  else if (kind === 'orb') { tex = objectSprite('orb').texture; w = h = 0.45; }
  else if (kind === 'item') {
    const info = itemIconInfo(data.item);
    tex = itemIconTexture(info.icon, info.tier, info.gem);
    w = h = 0.75;
  }
  const { mesh, mat } = makeBillboard(tex, 1, w, h, { fullbright: kind !== 'gold' });
  pk.mesh = mesh; pk.mat = mat;
  G.scene.add(mesh);
  if (kind === 'item' && RARITY_BEAM[data.item.rarity]) {
    const b = makeBillboard(getBeamTex(), 1, 0.35, data.item.rarity === 'unique' ? 6 : 3.5, { fullbright: true, transparent: true, additive: true });
    b.mat.uniforms.tint.value.set(...RARITY_BEAM[data.item.rarity]);
    b.mat.uniforms.opacity.value = 0.8;
    // beam texture is transparent-heavy; disable alpha discard by using additive tint
    b.mat.fragmentShader = b.mat.fragmentShader.replace('if (tex.a < 0.5) discard;', 'if (tex.a < 0.02) discard; tex.rgb *= tex.a;');
    pk.beam = b.mesh; pk.beamMat = b.mat;
    G.scene.add(b.mesh);
    if (data.item.rarity === 'unique') sfx('uniqueDrop', 0.8);
    else if (data.item.rarity === 'rare') sfx('rareDrop', 0.5);
  }
  G.pickups.push(pk);
  return pk;
}

export function dropLoot(x, z, y, o) {
  const depth = Math.max(1, G.depth);
  const items = [];
  if (rng.chance(o.goldChance || 0)) {
    const amt = Math.max(1, Math.round(rng.int(3, 9) * (1 + depth * 0.45) * Math.pow(1.05, depth) * (o.goldMul || 1)));
    spawnPickup('gold', x, y, z, { amount: amt, spread: o.spread });
  }
  if (rng.chance(o.orbChance || 0)) spawnPickup('orb', x, y, z, { spread: o.spread });
  if (rng.chance(o.itemChance || 0)) {
    for (let i = 0; i < (o.items || 1); i++) {
      const ilvl = depth + (rng.chance(0.2) ? 1 : 0);
      const item = generateItem({ ilvl, rng: new RNG(), mf: o.mf || 0, bonus: o.bonus || 0 });
      items.push(item);
      spawnPickup('item', x, y, z, { item, spread: o.spread });
    }
  }
  return items;
}

export function updatePickups(dt) {
  const pl = G.player;
  const lvl = G.level;
  for (const pk of G.pickups) {
    pk.t += dt;
    // physics
    pk.vy -= 18 * dt;
    const nx = pk.x + pk.vx * dt, nz = pk.z + pk.vz * dt;
    if (!lvl.isSolid(Math.floor(nx / 3), Math.floor(nz / 3))) { pk.x = nx; pk.z = nz; } else { pk.vx = -pk.vx * 0.3; pk.vz = -pk.vz * 0.3; }
    pk.y += pk.vy * dt;
    const g = lvl.heightAt(Math.floor(pk.x / 3), Math.floor(pk.z / 3));
    const ground = g < 50 ? g : 0;
    if (pk.y < ground) { pk.y = ground; pk.vy = Math.abs(pk.vy) > 2 ? -pk.vy * 0.35 : 0; pk.vx *= 0.5; pk.vz *= 0.5; }
    const dx = pl.pos.x - pk.x, dz = pl.pos.z - pk.z, dy = pl.pos.y - pk.y;
    const d = Math.hypot(dx, dz);
    // magnet for gold/orbs
    if (pk.kind !== 'item' && d < pl.stats.pickupRadius + 1 && Math.abs(dy) < 2.5 && pk.t > 0.4) {
      pk.x += (dx / (d || 1)) * dt * 9; pk.z += (dz / (d || 1)) * dt * 9;
      pk.y += (pl.pos.y + 0.5 - pk.y) * dt * 6;
    }
    const reach = pk.kind === 'item' ? 1.5 : 0.8;
    if (d < reach && Math.abs(pl.pos.y + 0.5 - pk.y) < 1.6 && pk.t > 0.35 && !pl.dead) {
      if (pk.kind === 'gold') {
        pl.gold += pk.amount; sfx('gold', 0.5);
        G.fx.text({ x: pk.x, y: pk.y + 0.6, z: pk.z }, `+${pk.amount}g`, '#ffd040');
        pk.dead = true;
      } else if (pk.kind === 'orb') {
        healPlayerPct(0.15); sfx('orb', 0.5); pk.dead = true;
      } else if (pk.kind === 'item' && !pk.refused) {
        if (pl.addItem(pk.item)) {
          sfx('pickup', 0.6);
          G.ui.log(`Picked up ${pk.item.name}`, RARITY[pk.item.rarity].css);
          pk.dead = true;
        } else {
          pk.refused = 2;
          G.ui.log('Inventory full!', '#ff6060');
        }
      }
    }
    if (pk.refused) { pk.refused -= dt; if (pk.refused <= 0) pk.refused = 0; }
    const bob = pk.kind === 'item' ? Math.sin(pk.t * 3) * 0.08 + 0.05 : 0;
    pk.mesh.position.set(pk.x, pk.y + bob, pk.z);
    if (pk.beam) pk.beam.position.set(pk.x, pk.y, pk.z);
    if (pk.kind === 'gold') lvl.sampleLight(pk.x, pk.z, pk.mat.uniforms.baseLight.value);
    if (pk.kind === 'orb') G.fx.addFrameLight(pk.x, pk.y + 0.3, pk.z, [0.8, 0.1, 0.1], 2.5);
  }
  for (const pk of G.pickups) if (pk.dead) removePickup(pk);
  G.pickups = G.pickups.filter((p) => !p.dead);
}

function healPlayerPct(f) { G.player.heal(G.player.stats.maxHp * f); }

function removePickup(pk) {
  G.scene.remove(pk.mesh); pk.mat.dispose();
  if (pk.beam) { G.scene.remove(pk.beam); pk.beamMat.dispose(); }
}

export function clearPickups() {
  for (const pk of G.pickups) removePickup(pk);
  G.pickups = [];
}

export { SHRINES };
