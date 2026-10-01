// The player: movement (jumps, dash, glide), weapons, health, XP and inventory.
import * as THREE from 'three';
import { G } from './state.js';
import { rng } from './rng.js';
import { computeStats, weaponSpec, xpForLevel, ARMOR_K } from './items/stats.js';
import { fireWeapon, spawnProjectile } from './combat/projectiles.js';
import { propCollide } from './world/entities.js';
import { sfx } from './audio.js';

export const INV_SIZE = 40;
export const EYE = 1.55;
const GRAV = 24;
const JUMP_V = 7.6;
const STEP = 0.5;
const RADIUS = 0.38;

export class Player {
  constructor(profile) {
    this.profile = profile; // persistent data (level, xp, gold, items)
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = true;
    this.jumpsUsed = 0;
    this.dashCharges = 0; this.dashT = 0; this.dashRecharge = 0; this.dashDir = new THREE.Vector3();
    this.iframes = 0;
    this.fireCd = 0;
    this.hurtT = 0;
    this.chill = 0;
    this.dead = false;
    this.bob = 0; this.recoil = 0;
    this.fallStartY = 0;
    this.buffs = {};
    this.recompute();
    this.hp = this.stats.maxHp;
  }

  // --- persistent profile passthroughs
  get level() { return this.profile.level; }
  get xp() { return this.profile.xp; }
  get gold() { return this.profile.gold; }
  set gold(v) { this.profile.gold = v; }
  get equip() { return this.profile.equip; }
  get inv() { return this.profile.inv; }

  recompute() {
    const prevMax = this.stats?.maxHp;
    this.stats = computeStats({ level: this.profile.level, equip: this.profile.equip, buffs: this.buffs });
    if (prevMax && this.hp > this.stats.maxHp) this.hp = this.stats.maxHp;
    this.dashCharges = Math.min(this.dashCharges, this.stats.dash);
    const w = this.activeWeapon();
    this.spec = w ? weaponSpec(w, this.stats) : null;
  }

  activeWeapon() {
    const eq = this.profile.equip;
    let w = eq['weapon' + this.profile.activeSlot];
    if (!w) {
      for (let i = 0; i < 3; i++) if (eq['weapon' + i]) { this.profile.activeSlot = i; return eq['weapon' + i]; }
    }
    return w;
  }

  switchWeapon(i) {
    if (i === this.profile.activeSlot) return;
    if (!this.profile.equip['weapon' + i]) return;
    this.profile.activeSlot = i;
    this.recompute();
    this.switchT = 0.25;
    sfx('switch', 0.4);
  }
  cycleWeapon(dir) {
    for (let k = 1; k <= 3; k++) {
      const i = (this.profile.activeSlot + dir * k + 30) % 3;
      if (this.profile.equip['weapon' + i]) { this.switchWeapon(i); return; }
    }
  }

  addItem(item) {
    const inv = this.profile.inv;
    for (let i = 0; i < INV_SIZE; i++) if (!inv[i]) { inv[i] = item; G.saveSoon?.(); return true; }
    return false;
  }

  addBuff(id, secs) { this.buffs[id] = secs; this.recompute(); }

  spawnAt(x, z, yaw, y = 0) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw; this.pitch = 0;
    this.onGround = true;
    this.pos.y = G.level.groundUnder(x, z, RADIUS, 10, 0);
  }

  heal(n) {
    if (this.dead || n <= 0) return;
    const before = this.hp;
    this.hp = Math.min(this.stats.maxHp, this.hp + n);
    if (this.hp - before >= 1) this.healFlash = 0.3;
  }

  knock(vx, vz) { this.vel.x += vx; this.vel.z += vz; }

  usePotion() {
    if (this.dead) return;
    if (this.profile.potions <= 0) { G.ui.log('No potions! Buy them from Brother Wendel in town.', '#ff8080'); return; }
    if (this.hp >= this.stats.maxHp) return;
    this.profile.potions--;
    this.heal(this.stats.maxHp * 0.5);
    this.regenBoost = 4;
    sfx('potion', 0.7);
    G.fx.burst({ x: this.pos.x, y: this.pos.y + 1, z: this.pos.z }, [1, 0.2, 0.2], 16, 2, 0.6, 0.12);
  }

  update(dt, input) {
    const st = this.stats;
    // buffs
    let buffChanged = false;
    for (const k of Object.keys(this.buffs)) { this.buffs[k] -= dt; if (this.buffs[k] <= 0) { delete this.buffs[k]; buffChanged = true; } }
    if (buffChanged) this.recompute();

    if (this.dead) { this.deathT = (this.deathT || 0) + dt; return; }

    // look
    this.yaw -= input.lookX;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - input.lookY));

    // regen
    const regen = st.lifeRegen + (this.regenBoost > 0 ? st.maxHp * 0.05 : 0);
    if (this.regenBoost > 0) this.regenBoost -= dt;
    this.hp = Math.min(st.maxHp, this.hp + regen * dt);
    if (G.mode === 'town') this.hp = Math.min(st.maxHp, this.hp + st.maxHp * 0.25 * dt);

    // movement
    const speedMul = (1 + st.moveSpeed / 100) * (this.chill > 0 ? 0.65 : 1);
    if (this.chill > 0) this.chill -= dt;
    const maxSpeed = 6.2 * speedMul;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3().addScaledVector(fwd, input.moveY).addScaledVector(right, input.moveX);
    const wl = wish.length();
    if (wl > 1) wish.divideScalar(wl);

    // dash
    if (this.stats.dash > 0) {
      if (this.dashCharges < st.dash) {
        this.dashRecharge -= dt;
        if (this.dashRecharge <= 0) { this.dashCharges++; this.dashRecharge = 1.1; }
      }
      if (input.dash && this.dashCharges > 0 && this.dashT <= 0) {
        this.dashCharges--; this.dashRecharge = 1.1;
        this.dashT = 0.18;
        this.dashDir.copy(wl > 0.1 ? wish.clone().normalize() : fwd);
        this.iframes = 0.25;
        sfx('dash', 0.6);
        if (st.dashNova) this.dashNova();
      }
    }
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vel.x = this.dashDir.x * 22 * Math.sqrt(speedMul);
      this.vel.z = this.dashDir.z * 22 * Math.sqrt(speedMul);
      this.vel.y = Math.max(this.vel.y, 0);
      if (rng.chance(0.8)) G.fx.trail({ x: this.pos.x, y: this.pos.y + 0.8, z: this.pos.z }, [0.6, 0.8, 1], 0.2, 0.3);
    } else {
      const accel = this.onGround ? 60 : 18;
      const target = wish.clone().multiplyScalar(maxSpeed);
      const dvx = target.x - this.vel.x, dvz = target.z - this.vel.z;
      const dl = Math.hypot(dvx, dvz);
      const step = Math.min(dl, accel * dt);
      if (dl > 0) { this.vel.x += (dvx / dl) * step; this.vel.z += (dvz / dl) * step; }
    }

    // jumping
    const maxJumps = 1 + st.extraJumps;
    if (input.jumpPressed) {
      if (this.onGround) { this.vel.y = JUMP_V; this.onGround = false; this.jumpsUsed = 1; sfx('jump', 0.3); }
      else if (this.jumpsUsed < maxJumps) {
        this.vel.y = JUMP_V * 0.95; this.jumpsUsed++;
        sfx('jump2', 0.4);
        G.fx.ring({ x: this.pos.x, y: this.pos.y, z: this.pos.z }, [0.7, 0.8, 1], 0.4);
      }
    }
    let grav = GRAV;
    if (st.glide && input.jumpHeld && this.vel.y < 0 && !this.onGround) { grav = 4; this.vel.y = Math.max(this.vel.y, -2.2); }
    if (!this.onGround) this.vel.y -= grav * dt;

    // horizontal move with collision
    const lvl = G.level;
    lvl.moveCircle(this.pos, this.vel.x * dt, this.vel.z * dt, RADIUS, STEP);
    propCollide(this.pos, RADIUS);
    for (const e of G.enemies) {
      if (e.dead) continue;
      const dx = this.pos.x - e.pos.x, dz = this.pos.z - e.pos.z;
      const rr = RADIUS + e.radius * 0.8;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-4 && this.pos.y < e.pos.y + e.height * 0.8 && this.pos.y + 1.7 > e.pos.y) {
        const d = Math.sqrt(d2);
        lvl.moveCircle(this.pos, (dx / d) * (rr - d), (dz / d) * (rr - d), RADIUS, STEP);
      }
    }
    // vertical
    const ground = lvl.groundUnder(this.pos.x, this.pos.z, RADIUS, this.pos.y, STEP);
    const ceil = lvl.outdoor ? 100 : lvl.ceilH - 1.75;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y > ceil) { this.pos.y = ceil; this.vel.y = Math.min(0, this.vel.y); }
    if (this.pos.y <= ground) {
      if (!this.onGround) {
        const fall = -this.vel.y;
        if (fall > 9) { sfx('land', 0.5); this.landT = 0.15; }
        if (st.stomp && fall > 8) this.stomp(fall);
      }
      this.pos.y = ground; this.vel.y = 0; this.onGround = true; this.jumpsUsed = 0;
    } else if (this.pos.y > ground + 0.05 && this.onGround) {
      // walked off a ledge (step down smoothly if small)
      if (this.pos.y - ground < STEP + 0.05 && this.vel.y <= 0) this.pos.y = ground;
      else { this.onGround = false; this.jumpsUsed = Math.max(this.jumpsUsed, 1); }
    }

    // bob
    const hsp = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hsp > 0.5) {
      const before = Math.sin(this.bob);
      this.bob += dt * hsp * 1.6;
      if (before < 0 && Math.sin(this.bob) >= 0) sfx('step', 0.12);
    }
    this.recoil = Math.max(0, this.recoil - dt * 6);
    if (this.switchT > 0) this.switchT -= dt;
    if (this.iframes > 0) this.iframes -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.healFlash > 0) this.healFlash -= dt;
    if (this.landT > 0) this.landT -= dt;

    // fire
    this.fireCd -= dt;
    if (input.fire && this.spec && this.fireCd <= 0 && !(this.switchT > 0) && G.mode === 'dungeon') {
      this.fire();
    } else if (input.firePressed && G.mode === 'town') {
      G.ui.log('The town guard frowns. Weapons are for the dungeon.', '#aaa');
    }
  }

  eyePos(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + EYE, this.pos.z);
  }
  aimDir(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp).normalize();
  }

  fire() {
    const spec = this.spec;
    this.fireCd = 1 / spec.rate;
    const origin = this.eyePos();
    const dir = this.aimDir();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    fireWeapon(spec, origin, dir, right);
    this.recoil = Math.min(1, this.recoil + 0.35 + 0.15 / Math.max(1, spec.rate));
    this.muzzle = 0.06;
    sfx(spec.sound, spec.rate > 5 ? 0.25 : 0.5);
    const col = spec.chaos ? [1, 0.5, 1] : (G.fx && spec ? null : null);
    void col;
  }

  dashNova() {
    const spec = this.spec;
    const dmg = spec ? (spec.dmg[0] + spec.dmg[1]) * 0.5 : 10;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      spawnProjectile({ x: this.pos.x, y: this.pos.y + 0.8, z: this.pos.z, dx: Math.cos(a), dy: 0, dz: Math.sin(a), speed: 20, kind: 'spark', elem: 'lightning', dmg, size: 0.14, life: 0.6, chain: 1, spec });
    }
    sfx('zap2', 0.5);
  }

  stomp(fall) {
    const R = 3 + fall * 0.1;
    const dmg = this.stats.stomp * (1 + fall * 0.05);
    G.fx.ring({ x: this.pos.x, y: this.pos.y, z: this.pos.z }, [0.9, 0.7, 0.4], R);
    G.fx.shake = Math.max(G.fx.shake, 0.4);
    sfx('slam', 0.7);
    for (const e of G.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
      if (d < R) { e.takeDamage(dmg, 'physical', this.spec, { aoe: true }); e.kx += (e.pos.x - this.pos.x) / (d || 1) * 8; e.kz += (e.pos.z - this.pos.z) / (d || 1) * 8; }
    }
  }
}

// ---------------------------------------------------------------------------
export function damagePlayer(amount, elem = 'physical', from, isDot = false) {
  const p = G.player;
  if (!p || p.dead || G.mode !== 'dungeon') return 0;
  if (p.iframes > 0 && !isDot) return 0;
  const st = p.stats;
  let dmg = amount;
  if (elem === 'physical') {
    const dr = Math.min(0.8, st.armor / (st.armor + ARMOR_K(G.depth)));
    dmg *= 1 - dr;
  } else {
    dmg *= 1 - (st.res[elem] || 0) / 100;
    // armor helps a bit vs elemental
    dmg *= 1 - Math.min(0.3, st.armor / (st.armor + ARMOR_K(G.depth) * 3));
  }
  if (elem === 'cold' && !isDot) p.chill = Math.max(p.chill, 1.2);
  p.hp -= dmg;
  p.hurtT = 0.25;
  if (from && !isDot) {
    p.hurtDir = Math.atan2(from.x - p.pos.x, from.z - p.pos.z);
    p.hurtDirT = 0.8;
  }
  G.fx.flash = Math.min(0.6, G.fx.flash + 0.15 + (dmg / st.maxHp));
  G.fx.flashColor = elem === 'poison' ? '40,255,40' : elem === 'cold' ? '80,160,255' : elem === 'fire' ? '255,120,0' : '255,0,0';
  if (!isDot) { sfx('hurt', 0.5); G.fx.shake = Math.max(G.fx.shake, 0.15); }
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    p.deathT = 0;
    sfx('death', 1);
    G.actions.playerDied();
  }
  return dmg;
}

export function healPlayer(n) { G.player?.heal(n); }

export function playerGainXp(n) {
  const p = G.player;
  if (!p) return;
  const prof = p.profile;
  prof.xp += Math.round(n * (1 + p.stats.xpPct / 100));
  let leveled = false;
  while (prof.xp >= xpForLevel(prof.level)) {
    prof.xp -= xpForLevel(prof.level);
    prof.level++;
    leveled = true;
  }
  if (leveled) {
    p.recompute();
    p.hp = p.stats.maxHp;
    sfx('levelup', 1);
    G.ui.banner(`LEVEL ${prof.level}`, '+12 Life · +5% Damage');
    G.fx.burst({ x: p.pos.x, y: p.pos.y + 1, z: p.pos.z }, [1, 0.9, 0.4], 60, 6, 1, 0.2);
    G.saveSoon?.();
  }
}
