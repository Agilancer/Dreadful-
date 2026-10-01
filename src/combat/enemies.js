// Monster runtime: AI, movement (flow field), abilities, damage, death & rewards.
import * as THREE from 'three';
import { G } from '../state.js';
import { rng } from '../rng.js';
import { T } from '../world/level.js';
import { billboardGeo, spriteMaterial } from '../gfx/materials.js';
import { ENEMY_BY_ID, FAMILY_BY_ID, ENEMY_TYPES, enemySheet, depthScale } from './enemyTypes.js';
import { enemyShoot, enemyNova, elemColor, spawnProjectile } from './projectiles.js';
import { damagePlayer, healPlayer, playerGainXp } from '../player.js';
import { dropLoot } from '../world/entities.js';
import { sfx } from '../audio.js';
import { ELEMENTS } from '../items/itemData.js';

const tmp = new THREE.Vector3();

// --------------------------------------------------------------------------
// Flow field toward the player
// --------------------------------------------------------------------------
const flow = { dist: null, w: 0, h: 0, ptx: -1, ptz: -1, timer: 0 };
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function rebuildFlow() {
  const lvl = G.level, p = G.player;
  const w = lvl.w, h = lvl.h;
  if (!flow.dist || flow.dist.length !== w * h) flow.dist = new Int16Array(w * h);
  const dist = flow.dist;
  dist.fill(-1);
  const sx = Math.floor(p.pos.x / T), sz = Math.floor(p.pos.z / T);
  flow.ptx = sx; flow.ptz = sz; flow.w = w;
  if (lvl.isSolid(sx, sz)) return;
  const q = new Int32Array(w * h * 2);
  let qh = 0, qt = 0;
  q[qt++] = sx; q[qt++] = sz; dist[sz * w + sx] = 0;
  while (qh < qt) {
    const x = q[qh++], z = q[qh++];
    const d = dist[z * w + x];
    if (d > 60) continue;
    const hh = lvl.floorH[z * w + x];
    for (const [ox, oz] of DIRS8) {
      const nx = x + ox, nz = z + oz;
      if (lvl.isSolid(nx, nz)) continue;
      if (ox && oz && (lvl.isSolid(x + ox, z) || lvl.isSolid(x, z + oz))) continue;
      const i = nz * w + nx;
      if (dist[i] >= 0) continue;
      if (Math.abs(lvl.floorH[i] - hh) > 0.55) continue;
      dist[i] = d + 1;
      q[qt++] = nx; q[qt++] = nz;
    }
  }
}

function flowDir(e, out) {
  const lvl = G.level;
  const tx = Math.floor(e.pos.x / T), tz = Math.floor(e.pos.z / T);
  const w = lvl.w;
  const here = flow.dist[tz * w + tx];
  if (here < 0) return false;
  let best = here, bx = 0, bz = 0;
  for (const [ox, oz] of DIRS8) {
    const nx = tx + ox, nz = tz + oz;
    if (!lvl.inb(nx, nz)) continue;
    if (ox && oz && (lvl.isSolid(tx + ox, tz) || lvl.isSolid(tx, tz + oz))) continue;
    const d = flow.dist[nz * w + nx];
    if (d >= 0 && d < best) { best = d; bx = ox; bz = oz; }
  }
  if (!bx && !bz) return false;
  out.set((tx + bx + 0.5) * T - e.pos.x, 0, (tz + bz + 0.5) * T - e.pos.z).normalize();
  return true;
}

// --------------------------------------------------------------------------

export class Enemy {
  constructor(type, x, z, o = {}) {
    const depth = Math.max(1, G.depth);
    const sc = depthScale(depth);
    this.type = type;
    this.fam = type.family;
    this.ai = type.family.ai;
    this.depth = depth;
    this.champion = !!o.champion;
    this.unique = !!o.unique;
    this.minion = !!o.minion;
    this.mods = new Set(o.mods || []);
    this.name = o.name || (this.champion ? `Champion ${type.name}` : type.name);
    const sizeMul = (o.sizeMul || 1) * (this.unique ? 1.3 : this.champion ? 1.15 : 1);
    this.splitGen = o.splitGen || 0;
    let hp = type.hp * sc.hp * (this.unique ? 6 : this.champion ? 3 : 1) * (o.hpMul || 1);
    this.maxHp = this.hp = hp;
    this.dmg = type.dmg * sc.dmg * (this.champion ? 1.3 : 1) * (this.mods.has('strong') ? 1.6 : 1) * (this.mods.has('cursed') ? 1.25 : 1) * (o.dmgMul || 1);
    this.speed = type.spd * sc.spd * (this.champion ? 1.2 : 1) * (this.mods.has('fast') ? 1.45 : 1);
    this.xp = type.xp * sc.xp * (this.unique ? 8 : this.champion ? 3 : 1) * (o.xpMul || 1);
    this.radius = type.radius * sizeMul;
    this.height = type.height * sizeMul;
    this.element = this.mods.has('fireEnch') ? 'fire' : this.mods.has('coldEnch') ? 'cold' : this.mods.has('lightEnch') ? 'lightning' : type.element;
    this.fly = this.ai.fly || 0;
    this.pos = new THREE.Vector3(x, 0, z);
    this.pos.y = G.level.groundUnder(x, z, this.radius, 0.5, 0.6) + (this.fly ? this.fly : 0);
    this.kx = 0; this.kz = 0; this.vy = 0;
    this.awake = false;
    this.losT = 0; this.hasLos = false;
    this.atkCd = rng.float(0.5, 1.5);
    this.rangedCd = rng.float(1, 2.5);
    this.specialCd = rng.float(2, 5);
    this.windup = 0;
    this.charging = 0; this.leaping = false; this.fuse = 0; this.retreat = 0;
    this.strafe = rng.sign();
    this.burn = null; this.poison = null; this.chill = 0;
    this.flash = 0;
    this.anim = rng.float(0, 1);
    this.dead = false; this.deathT = 0;
    this.summons = 0;
    this.boss = this.unique;

    const sheet = enemySheet(type);
    this.mat = spriteMaterial(sheet.texture, 4);
    this.mesh = new THREE.Mesh(billboardGeo, this.mat);
    this.mesh.scale.set(this.height * 1.05, this.height * 1.05, 1);
    if (this.champion) this.mat.uniforms.tint.value.set(0.7, 0.85, 1.4);
    if (this.unique) this.mat.uniforms.tint.value.set(1.25, 1.1, 0.8);
    G.scene.add(this.mesh);
    this.light = new THREE.Vector3();
  }

  get isRanged() { return !!this.ai.ranged; }

  update(dt) {
    if (this.dead) {
      this.deathT += dt;
      const f = Math.min(1, this.deathT / 0.5);
      this.mat.uniforms.frame.value = 3;
      this.mesh.scale.y = this.height * 1.05 * (1 - f * 0.85);
      this.mat.uniforms.opacity.value = 1;
      if (this.deathT > 0.6) { G.scene.remove(this.mesh); this.mat.dispose(); this.removed = true; }
      return;
    }
    const pl = G.player;
    const lvl = G.level;
    const dx = pl.pos.x - this.pos.x, dz = pl.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    this.losT -= dt;
    if (this.losT <= 0) {
      this.losT = 0.2 + rng.float(0, 0.15);
      this.hasLos = dist < 40 && lvl.los(this.pos.x, this.pos.z, pl.pos.x, pl.pos.z);
      if (!this.awake && this.hasLos && dist < 20) this.wake();
    }
    // status effects
    let slow = 1;
    if (this.chill > 0) { this.chill -= dt; slow = 0.55; }
    if (this.burn) {
      this.burn.t -= dt;
      this.hp -= this.burn.dps * dt;
      if (rng.chance(dt * 12)) G.fx.trail({ x: this.pos.x + rng.float(-0.3, 0.3), y: this.pos.y + rng.float(0.2, this.height), z: this.pos.z + rng.float(-0.3, 0.3) }, [1, 0.5, 0.1], 0.12, 0.4);
      if (this.burn.t <= 0) this.burn = null;
    }
    if (this.poison) {
      this.poison.t -= dt;
      this.hp -= this.poison.dps * dt;
      if (rng.chance(dt * 6)) G.fx.trail({ x: this.pos.x, y: this.pos.y + this.height * 0.7, z: this.pos.z }, [0.3, 1, 0.2], 0.1, 0.5);
      if (this.poison.t <= 0) this.poison = null;
    }
    if (this.hp <= 0) { this.die(this.lastSpec); return; }
    if (this.flash > 0) this.flash -= dt;

    const move = tmp.set(0, 0, 0);
    let speed = this.speed * slow;
    let attackPose = false;

    if (this.awake && !pl.dead) {
      this.atkCd -= dt; this.rangedCd -= dt; this.specialCd -= dt;
      const ai = this.ai;
      const pdy = pl.pos.y - this.pos.y;
      const meleeReach = this.radius + 0.45 + (ai.melee || 0) * 0.5;

      // --- specials
      if (this.specialCd <= 0) this.trySpecial(dist);

      if (this.windup > 0) {
        this.windup -= dt;
        attackPose = true;
        speed *= 0.2;
        if (this.windup <= 0) this.resolveMelee(dist, pdy);
      } else if (this.fuse > 0) {
        this.fuse -= dt;
        this.flash = 0.1 * (Math.floor(this.fuse * 10) % 2);
        speed *= 0.3;
        if (this.fuse <= 0) { this.selfDestruct(); return; }
      } else if (this.charging > 0) {
        this.charging -= dt;
        speed *= 2.8;
        move.set(this.chargeDir.x, 0, this.chargeDir.z);
        if (dist < meleeReach + 0.3 && Math.abs(pdy) < 2) {
          damagePlayer(this.dmg * 1.3, this.element || 'physical', this.pos);
          this.charging = 0; this.atkCd = 1.2;
          pl.knock(this.chargeDir.x * 10, this.chargeDir.z * 10);
        }
      } else {
        // --- ranged behaviour
        if (ai.ranged && this.hasLos && dist < ai.ranged.dist * 1.8) {
          const r = ai.ranged;
          if (this.rangedCd <= 0 && (!ai.melee || dist > meleeReach * 1.5)) {
            this.shootRanged(r);
            attackPose = true;
          }
          if (!ai.melee) {
            if (dist < r.dist * 0.55) move.set(-dx, 0, -dz).normalize();
            else if (dist > r.dist) move.set(dx, 0, dz).normalize();
            else move.set(-dz * this.strafe, 0, dx * this.strafe).normalize().multiplyScalar(0.6);
            if (rng.chance(dt * 0.5)) this.strafe *= -1;
          }
        }
        // --- melee approach
        if (ai.melee || ai.explode || (!this.hasLos && ai.ranged) || (ai.ranged && !this.hasLos)) {
          if (this.retreat > 0) { this.retreat -= dt; move.set(-dx, 0, -dz).normalize(); }
          else if (dist > meleeReach * 0.8) this.pathToward(move, dist);
          if (ai.melee && dist < meleeReach && Math.abs(pdy) < 1.8 + this.fly && this.atkCd <= 0) {
            this.windup = ai.slam ? 0.55 : 0.32;
            this.atkCd = 1.1 + rng.float(0, 0.5);
          }
          if (ai.explode && dist < 2.2) { this.fuse = 0.6; sfx('fuse', 0.5); }
          if (ai.leap && !this.leaping && dist > 3 && dist < 9 && this.hasLos && this.specialCd <= 1 && Math.abs(pdy) < 1) {
            this.leaping = true; this.vy = 7; this.leapDir = new THREE.Vector3(dx, 0, dz).normalize(); this.specialCd = 3.5;
          }
          if (ai.charge && this.hasLos && dist > 5 && dist < 15 && this.specialCd <= 0.5) {
            this.charging = 1.1; this.chargeDir = new THREE.Vector3(dx, 0, dz).normalize(); this.specialCd = 5; sfx('roar', 0.5);
          }
        }
      }
    } else if (!this.awake) {
      // idle shuffle
      if (rng.chance(dt * 0.3)) this.idleDir = new THREE.Vector3(rng.float(-1, 1), 0, rng.float(-1, 1)).normalize();
      if (this.idleDir && rng.chance(0.5)) { move.copy(this.idleDir).multiplyScalar(0.25); }
    }

    // separation
    for (const o of G.enemies) {
      if (o === this || o.dead) continue;
      const ox = this.pos.x - o.pos.x, oz = this.pos.z - o.pos.z;
      const rr = this.radius + o.radius;
      const d2 = ox * ox + oz * oz;
      if (d2 < rr * rr && d2 > 1e-4) {
        const d = Math.sqrt(d2);
        move.x += (ox / d) * (rr - d) * 2; move.z += (oz / d) * (rr - d) * 2;
      }
    }

    // personal space around the player
    {
      const ox = this.pos.x - pl.pos.x, oz = this.pos.z - pl.pos.z;
      const rr = this.radius + 0.5;
      const d2 = ox * ox + oz * oz;
      if (d2 < rr * rr && d2 > 1e-4 && Math.abs(pl.pos.y - (this.pos.y - (this.fly || 0))) < 1.6 + this.fly) {
        const d = Math.sqrt(d2);
        move.x += (ox / d) * (rr - d) * 6; move.z += (oz / d) * (rr - d) * 6;
      }
    }

    // leap physics
    if (this.leaping) { move.copy(this.leapDir).multiplyScalar(2.6); }

    let mx = move.x * speed * dt + this.kx * dt;
    let mz = move.z * speed * dt + this.kz * dt;
    this.kx *= Math.max(0, 1 - dt * 8); this.kz *= Math.max(0, 1 - dt * 8);
    const step = this.fly ? 10 : 0.55;
    const feet = this.fly ? this.pos.y - this.fly : this.pos.y;
    const save = this.pos.y;
    this.pos.y = feet;
    const hit = lvl.moveCircle(this.pos, mx, mz, this.radius, step);
    this.pos.y = save;
    if ((hit.hitX || hit.hitZ) && this.charging > 0) this.charging = 0;
    if ((hit.hitX || hit.hitZ) && !this.awake && this.idleDir) this.idleDir.negate();

    // vertical
    const ground = lvl.groundUnder(this.pos.x, this.pos.z, this.radius * 0.6, feet, this.fly ? 10 : 0.6);
    if (this.fly) {
      const target = ground + this.fly + Math.sin(G.time * 2 + this.anim * 6) * 0.25 + (this.awake ? Math.max(0, Math.min(1.5, (pl.pos.y + 0.6) - ground - this.fly)) : 0);
      this.pos.y += (target - this.pos.y) * Math.min(1, dt * 3);
      this.pos.y = Math.min(this.pos.y, (lvl.outdoor ? 20 : lvl.ceilH) - this.height - 0.05);
    } else if (this.leaping || this.pos.y > ground + 0.01) {
      this.vy -= 22 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= ground) {
        this.pos.y = ground; this.vy = 0;
        if (this.leaping) {
          this.leaping = false;
          if (Math.hypot(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z) < this.radius + 1.2) damagePlayer(this.dmg * 1.2, this.element || 'physical', this.pos);
        }
      }
    } else this.pos.y = ground;

    // animation
    const moving = Math.abs(mx) + Math.abs(mz) > 0.002;
    if (moving) this.anim += dt * (2 + speed * 0.5);
    let frame = moving ? Math.floor(this.anim * 2) % 2 : (this.fam.body === 'flyer' || this.fam.body === 'eye' ? Math.floor(G.time * 4) % 2 : 0);
    if (attackPose || this.windup > 0 || this.shootPose > 0) frame = 2;
    if (this.flash > 0.05 && !this.fuse) frame = 3;
    if (this.shootPose > 0) this.shootPose -= dt;
    const u = this.mat.uniforms;
    u.frame.value = frame;
    u.flash.value = this.flash > 0 ? 0.7 : 0;
    u.flip.value = dx < 0 ? 1 : 0;
    lvl.sampleLight(this.pos.x, this.pos.z, u.baseLight.value);
    this.mesh.position.copy(this.pos);
  }

  wake() {
    if (this.awake) return;
    this.awake = true;
    // alert the pack
    for (const o of G.enemies) if (!o.awake && !o.dead && o.pos.distanceToSquared(this.pos) < 64) o.awake = true;
    if (rng.chance(0.3)) sfx('growl', 0.4);
  }

  pathToward(out, dist) {
    const pl = G.player;
    if (this.fly || (this.hasLos && dist < 7 && Math.abs(G.level.floorH[G.level.idx(Math.floor(pl.pos.x / T), Math.floor(pl.pos.z / T))] - (this.pos.y - (this.fly || 0))) < 0.6)) {
      out.set(pl.pos.x - this.pos.x, 0, pl.pos.z - this.pos.z).normalize();
      if (this.fly && !this.hasLos && flowDir(this, tmp2)) out.copy(tmp2);
      return;
    }
    if (!flowDir(this, out)) out.set(pl.pos.x - this.pos.x, 0, pl.pos.z - this.pos.z).normalize();
  }

  shootRanged(r) {
    const pl = G.player;
    const multi = this.mods.has('multishot') ? 3 : 1;
    const burst = r.burst || 1;
    const dmg = this.dmg * (r.burst ? 0.6 : 1);
    const target = { x: pl.pos.x, y: pl.pos.y + 1.0, z: pl.pos.z };
    for (let b = 0; b < burst; b++) {
      setTimeout(() => {
        if (this.dead || G.player.dead) return;
        enemyShoot(this, r.kind, { x: G.player.pos.x, y: G.player.pos.y + 1, z: G.player.pos.z }, { speed: r.speed, dmg, elem: this.element || undefined, arc: r.arc, homing: r.homing, count: (r.spread || 1) * multi });
      }, b * 160);
    }
    void target;
    sfx(r.kind === 'arrow' ? 'twang' : r.kind === 'spit' ? 'splat' : 'enemyShoot', 0.35);
    this.rangedCd = r.cd * rng.float(0.8, 1.3) * (this.mods.has('fast') ? 0.7 : 1);
    this.shootPose = 0.3;
  }

  trySpecial(dist) {
    const ai = this.ai;
    this.specialCd = rng.float(4, 7);
    if ((ai.teleport || this.mods.has('teleport')) && this.hasLos && dist > 5 && rng.chance(0.6)) {
      const pl = G.player;
      for (let a = 0; a < 12; a++) {
        const ang = rng.float(0, Math.PI * 2), r = rng.float(2.5, 4.5);
        const x = pl.pos.x + Math.cos(ang) * r, z = pl.pos.z + Math.sin(ang) * r;
        if (!G.level.circleBlocked(x, z, this.radius, pl.pos.y, 0.5)) {
          G.fx.burst({ x: this.pos.x, y: this.pos.y + 1, z: this.pos.z }, [0.6, 0.4, 1], 14, 3, 0.4, 0.15);
          this.pos.x = x; this.pos.z = z;
          G.fx.burst({ x, y: this.pos.y + 1, z }, [0.6, 0.4, 1], 14, 3, 0.4, 0.15);
          sfx('blink', 0.4);
          break;
        }
      }
    }
    if (ai.summon && this.summons < 6 && this.awake) {
      const fam = FAMILY_BY_ID[ai.summon];
      const types = ENEMY_TYPES.filter((t) => t.family === fam && t.minDepth <= Math.max(this.depth, fam.min));
      const type = types[types.length - 1] || ENEMY_TYPES.find((t) => t.family === fam);
      for (let i = 0; i < 2; i++) {
        const ang = rng.float(0, Math.PI * 2);
        const x = this.pos.x + Math.cos(ang) * 1.5, z = this.pos.z + Math.sin(ang) * 1.5;
        if (G.level.circleBlocked(x, z, type.radius, this.pos.y, 0.5)) continue;
        const m = new Enemy(type, x, z, { xpMul: 0.3 });
        m.awake = true;
        G.enemies.push(m);
        this.summons++;
        G.fx.burst({ x, y: this.pos.y + 0.5, z }, [0.5, 1, 0.5], 16, 3, 0.5, 0.15);
      }
      sfx('summon', 0.5);
    }
    if (ai.nova && this.hasLos && dist < 14) {
      enemyNova(this, 12, this.dmg * 0.6, this.element || 'cold');
      sfx('nova', 0.5);
    }
  }

  resolveMelee(dist, pdy) {
    const pl = G.player;
    const reach = this.radius + 0.45 + (this.ai.melee || 0) * 0.5 + 0.6;
    if (this.ai.slam) {
      G.fx.ring({ x: this.pos.x, y: this.pos.y, z: this.pos.z }, [0.8, 0.7, 0.5], 2.8);
      G.fx.shake = Math.max(G.fx.shake, 0.35);
      sfx('slam', 0.7);
      if (dist < 3.3 && pl.pos.y - this.pos.y < 1.2) damagePlayer(this.dmg, this.element || 'physical', this.pos);
    } else if (dist < reach && Math.abs(pdy) < 2 + this.fly) {
      const dealt = damagePlayer(this.dmg, this.element || 'physical', this.pos);
      if (this.mods.has('vampiric')) this.hp = Math.min(this.maxHp, this.hp + dealt * 2);
      if (this.mods.has('coldEnch') || this.mods.has('cursed') || this.element === 'cold') pl.chill = 1.5;
      if (pl.stats.thorns) this.takeDamage(pl.stats.thorns, 'physical', null, {});
      sfx('hit', 0.5);
    }
    if (this.ai.swoop) this.retreat = 0.7;
  }

  selfDestruct() {
    const R = 3.2;
    const col = elemColor(this.element || 'fire');
    G.fx.explosion({ x: this.pos.x, y: this.pos.y + 1, z: this.pos.z }, R, col);
    sfx('explode', 0.8);
    const pl = G.player;
    const d = Math.hypot(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z);
    if (d < R) damagePlayer(this.dmg * (1 - d / R * 0.5), this.element || 'fire', this.pos);
    for (const o of G.enemies) if (o !== this && !o.dead && o.pos.distanceTo(this.pos) < R) o.takeDamage(this.dmg * 0.5, 'fire', null, { aoe: true });
    this.die(null, true);
  }

  takeDamage(amount, elem, spec, o = {}) {
    if (this.dead) return 0;
    let dmg = amount;
    let crit = false;
    if (spec && !o.dot && rng.chance(spec.crit / 100)) { dmg *= 1 + spec.critDmg / 100; crit = true; }
    if (this.mods.has('stone')) dmg *= 0.6;
    if (this.ai.armor && elem === 'physical') dmg *= 1 - this.ai.armor;
    if (this.type.element && this.type.element === elem) dmg *= 0.5;
    this.hp -= dmg;
    this.lastSpec = spec;
    this.flash = Math.max(this.flash, o.dot ? 0 : 0.12);
    if (!this.awake) this.wake();
    // status
    const elems = o.elems || [elem];
    const has = (e) => elem === e || (o.elems && o.elems.has && o.elems.has(e));
    if (!o.dot) {
      if (has('fire')) this.burn = { dps: Math.max(this.burn?.dps || 0, dmg * 0.25), t: 3 };
      if (has('cold')) this.chill = 2;
      if (has('poison')) this.poison = { dps: (this.poison?.t > 0 ? this.poison.dps * 0.5 : 0) + dmg * 0.3, t: 4 };
      if (this.mods.has('lightEnch') && rng.chance(0.35)) {
        for (let i = 0; i < 3; i++) spawnProjectile({ x: this.pos.x, y: this.pos.y + 1, z: this.pos.z, dx: rng.float(-1, 1), dy: 0, dz: rng.float(-1, 1), speed: 10, hostile: true, kind: 'spark', elem: 'lightning', dmg: this.dmg * 0.4, size: 0.12, life: 1.2 });
      }
    }
    void elems;
    if (!o.dot || rng.chance(0.15)) {
      const col = crit ? '#ffef40' : (ELEMENTS[elem]?.css || '#fff');
      G.fx.text({ x: this.pos.x + rng.float(-0.3, 0.3), y: this.pos.y + this.height, z: this.pos.z + rng.float(-0.3, 0.3) }, Math.round(dmg).toString() + (crit ? '!' : ''), col, crit);
    }
    if (!o.dot && !o.aoe) G.fx.blood({ x: this.pos.x, y: this.pos.y + this.height * 0.6, z: this.pos.z }, this.fam.body === 'blob' ? this.type.sprite.palette.body.map((c) => c / 255) : this.fam.id === 'skeleton' || this.fam.id === 'skelarcher' || this.fam.id === 'golem' || this.fam.id === 'gargoyle' ? [0.7, 0.68, 0.6] : [0.55, 0.02, 0.02], 6);
    if (spec && spec.lifeSteal && !o.dot) healPlayer(dmg * spec.lifeSteal / 100 * 0.5);
    if (this.hp <= 0) this.die(spec);
    return dmg;
  }

  die(spec, silent) {
    if (this.dead) return;
    this.dead = true;
    this.hp = 0;
    const p = { x: this.pos.x, y: this.pos.y + this.height * 0.5, z: this.pos.z };
    G.fx.blood(p, [0.5, 0.02, 0.02], this.unique ? 30 : 12);
    if (!silent) sfx(this.fam.body === 'humanoid' || this.fam.body === 'brute' ? 'die' : 'squish', 0.6);
    playerGainXp(this.xp);
    const pl = G.player;
    if (spec?.lifeOnKill || pl.stats.lifeOnKill) healPlayer((spec?.lifeOnKill || pl.stats.lifeOnKill));
    // death effects
    if (this.mods.has('fireEnch')) {
      G.fx.explosion(p, 2.5, [1, 0.5, 0.1]);
      if (Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z) < 2.5) damagePlayer(this.dmg * 0.8, 'fire', p);
    }
    if (this.mods.has('coldEnch')) enemyNova(this, 10, this.dmg * 0.4, 'cold');
    if (this.ai.split && this.splitGen < 2) {
      for (let i = 0; i < 2; i++) {
        const m = new Enemy(this.type, this.pos.x + rng.float(-0.6, 0.6), this.pos.z + rng.float(-0.6, 0.6), { sizeMul: 0.7 ** (this.splitGen + 1), hpMul: 0.4, xpMul: 0.3, splitGen: this.splitGen + 1, dmgMul: 0.7 });
        m.awake = true;
        G.enemies.push(m);
      }
    }
    // loot
    const mf = (pl.stats.magicFind || 0) + (spec?.magicFind || 0);
    const gf = (pl.stats.goldFind || 0) + (spec?.goldFind || 0);
    dropLoot(this.pos.x, this.pos.z, this.pos.y - (this.fly || 0), {
      itemChance: this.unique ? 1 : this.champion ? 0.45 : this.minion ? 0.15 : 0.1,
      items: this.unique ? rng.int(2, 3) : 1,
      bonus: this.unique ? 0.8 : this.champion ? 0.35 : 0,
      goldChance: this.unique ? 1 : 0.42,
      goldMul: (this.unique ? 6 : this.champion ? 2.5 : 1) * (1 + gf / 100),
      orbChance: this.unique ? 1 : 0.1,
      mf,
    });
  }
}

const tmp2 = new THREE.Vector3();

export function damageEnemy(e, amount, elem, spec, o) { return e.takeDamage(amount, elem, spec, o || {}); }

export function knockEnemy(e, fromX, fromZ, power) {
  if (e.dead) return;
  const resist = e.boss ? 0.25 : e.fam.body === 'brute' ? 0.3 : 1;
  const dx = e.pos.x - fromX, dz = e.pos.z - fromZ;
  const d = Math.hypot(dx, dz) || 1;
  e.kx += (dx / d) * power * resist; e.kz += (dz / d) * power * resist;
}

export function spawnEnemiesFromLevel(level) {
  for (const o of level.objects) {
    if (o.type !== 'monster') continue;
    const type = ENEMY_BY_ID[o.typeId];
    if (!type) continue;
    G.enemies.push(new Enemy(type, o.x, o.z, o));
  }
}

export function updateEnemies(dt) {
  flow.timer -= dt;
  const pl = G.player;
  const ptx = Math.floor(pl.pos.x / T), ptz = Math.floor(pl.pos.z / T);
  if (flow.timer <= 0 || ptx !== flow.ptx || ptz !== flow.ptz || !flow.dist) { rebuildFlow(); flow.timer = 0.5; }
  for (const e of G.enemies) {
    // cheap culling for far sleeping monsters
    if (!e.awake && !e.dead) {
      const d2 = (e.pos.x - pl.pos.x) ** 2 + (e.pos.z - pl.pos.z) ** 2;
      if (d2 > 900) { e.mesh.visible = d2 < 1600; e.losT -= dt; if (e.losT > 0) continue; }
      e.mesh.visible = true;
    }
    e.update(dt);
  }
  G.enemies = G.enemies.filter((e) => !e.removed);
}

export function clearEnemies() {
  for (const e of G.enemies) { G.scene.remove(e.mesh); e.mat.dispose(); }
  G.enemies = [];
  flow.dist = null;
}
