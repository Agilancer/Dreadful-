// Particles, dynamic lights, lightning arcs, floating text and screen effects.
import * as THREE from 'three';
import { particleMaterial, shared, MAX_LIGHTS } from './gfx/materials.js';
import { glowTexture } from './gfx/textures.js';
import { rng } from './rng.js';

class PointPool {
  constructor(cap, additive) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 4);
    this.size = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.max = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.drag = new Float32Array(cap);
    this.size0 = new Float32Array(cap);
    this.shrink = new Uint8Array(cap);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('pcolor', this.aCol);
    geo.setAttribute('size', this.aSize);
    this.mat = particleMaterial(glowTexture(), additive);
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 10 : 5;
  }
  emit(x, y, z, vx, vy, vz, r, g, b, a, size, life, grav = 0, drag = 0, shrink = 1) {
    const i = this.next; this.next = (this.next + 1) % this.cap;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
    this.size[i] = size; this.size0[i] = size;
    this.life[i] = life; this.max[i] = life; this.grav[i] = grav; this.drag[i] = drag; this.shrink[i] = shrink;
  }
  update(dt, level) {
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const k = i * 3;
      this.vel[k + 1] -= this.grav[i] * dt;
      if (this.drag[i]) { const d = Math.max(0, 1 - this.drag[i] * dt); this.vel[k] *= d; this.vel[k + 1] *= d; this.vel[k + 2] *= d; }
      let nx = this.pos[k] + this.vel[k] * dt, ny = this.pos[k + 1] + this.vel[k + 1] * dt, nz = this.pos[k + 2] + this.vel[k + 2] * dt;
      if (this.grav[i] && level) {
        const fh = level.heightAt(Math.floor(nx / 3), Math.floor(nz / 3));
        if (ny < fh + 0.02 && fh < 50) { ny = fh + 0.02; this.vel[k + 1] *= -0.3; this.vel[k] *= 0.6; this.vel[k + 2] *= 0.6; }
      }
      this.pos[k] = nx; this.pos[k + 1] = ny; this.pos[k + 2] = nz;
      const t = Math.max(0, this.life[i] / this.max[i]);
      this.size[i] = this.shrink[i] ? this.size0[i] * (0.3 + 0.7 * t) : this.size0[i];
      if (this.life[i] <= 0) this.size[i] = 0;
    }
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = true;
  }
  clear() { this.life.fill(0); this.size.fill(0); this.aSize.needsUpdate = true; }
}

// One-frame points (projectile bodies, glowing pickups)
class ImmediatePoints {
  constructor(cap) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 4);
    this.size = new Float32Array(cap);
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('pcolor', this.aCol);
    geo.setAttribute('size', this.aSize);
    this.geo = geo;
    this.points = new THREE.Points(geo, particleMaterial(glowTexture(), true));
    this.points.frustumCulled = false;
    this.points.renderOrder = 11;
    this.n = 0;
  }
  begin() { this.n = 0; }
  add(x, y, z, r, g, b, size) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = 1;
    this.size[i] = size;
  }
  end() {
    this.geo.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = true;
  }
}

class Arcs {
  constructor(cap = 600) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 6);
    this.col = new Float32Array(cap * 6);
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('color', this.aCol);
    this.geo = geo;
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.lines.frustumCulled = false;
    this.list = [];
  }
  add(a, b, color, life = 0.18, jag = 0.5) {
    const pts = [a.clone()];
    const n = Math.max(3, Math.floor(a.distanceTo(b) / 0.8));
    for (let i = 1; i < n; i++) {
      const p = a.clone().lerp(b, i / n);
      p.x += rng.float(-jag, jag); p.y += rng.float(-jag, jag); p.z += rng.float(-jag, jag);
      pts.push(p);
    }
    pts.push(b.clone());
    this.list.push({ pts, color, life, max: life });
  }
  update(dt) {
    let s = 0;
    this.list = this.list.filter((a) => (a.life -= dt) > 0);
    for (const a of this.list) {
      const f = a.life / a.max;
      for (let i = 0; i < a.pts.length - 1 && s < this.cap; i++, s++) {
        const p = a.pts[i], q = a.pts[i + 1];
        this.pos.set([p.x, p.y, p.z, q.x, q.y, q.z], s * 6);
        const c = a.color;
        this.col.set([c[0] * f, c[1] * f, c[2] * f, c[0] * f, c[1] * f, c[2] * f], s * 6);
      }
    }
    this.geo.setDrawRange(0, s * 2);
    this.aPos.needsUpdate = this.aCol.needsUpdate = true;
  }
  clear() { this.list = []; }
}

export class FX {
  constructor(scene) {
    this.glow = new PointPool(2500, true);
    this.solid = new PointPool(1500, false);
    this.imm = new ImmediatePoints(1500);
    this.arcs = new Arcs();
    scene.add(this.glow.points, this.solid.points, this.imm.points, this.arcs.lines);
    this.tempLights = []; // {x,y,z,color,radius,life,max}
    this.frameLights = [];
    this.texts = []; // floating damage numbers
    this.shake = 0;
    this.flash = 0; this.flashColor = '255,0,0';
  }
  clear() {
    this.glow.clear(); this.solid.clear(); this.arcs.clear();
    this.tempLights = []; this.texts = [];
  }
  burst(p, color, n = 10, speed = 4, life = 0.5, size = 0.15, grav = 0, additive = true) {
    const pool = additive ? this.glow : this.solid;
    for (let i = 0; i < n; i++) {
      const th = rng.float(0, Math.PI * 2), ph = rng.float(-1, 1), sp = speed * rng.float(0.3, 1);
      const sr = Math.sqrt(1 - ph * ph);
      pool.emit(p.x, p.y, p.z, Math.cos(th) * sr * sp, ph * sp, Math.sin(th) * sr * sp,
        color[0], color[1], color[2], 1, size * rng.float(0.6, 1.3), life * rng.float(0.6, 1.2), grav, 1.5);
    }
  }
  blood(p, color = [0.6, 0.02, 0.02], n = 10) {
    for (let i = 0; i < n; i++) {
      this.solid.emit(p.x, p.y, p.z, rng.float(-3, 3), rng.float(0, 5), rng.float(-3, 3),
        color[0] * rng.float(0.6, 1), color[1], color[2], 1, rng.float(0.06, 0.14), rng.float(0.5, 1.2), 14, 0.5, 0);
    }
  }
  trail(p, color, size = 0.1, life = 0.25) {
    this.glow.emit(p.x, p.y, p.z, rng.float(-0.3, 0.3), rng.float(-0.3, 0.3), rng.float(-0.3, 0.3), color[0], color[1], color[2], 1, size, life, 0, 0);
  }
  explosion(p, radius, color) {
    this.burst(p, color, Math.min(80, 20 + radius * 10), radius * 4, 0.5, 0.25 + radius * 0.05);
    this.burst(p, [1, 1, 0.8], 10, radius * 2, 0.3, 0.3);
    for (let i = 0; i < 8; i++) this.solid.emit(p.x, p.y, p.z, rng.float(-1, 1), rng.float(0.5, 2), rng.float(-1, 1), 0.1, 0.09, 0.08, 0.6, rng.float(0.15, 0.3), rng.float(0.5, 1.0), -0.5, 1, 1);
    this.light(p, color, radius * 3.5, 0.35);
    this.shake = Math.max(this.shake, Math.min(0.6, radius * 0.08));
  }
  ring(p, color, radius) {
    const n = Math.floor(16 + radius * 6);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.glow.emit(p.x, p.y + 0.2, p.z, Math.cos(a) * radius * 3, 0.3, Math.sin(a) * radius * 3, color[0], color[1], color[2], 1, 0.25, 0.35, 0, 2);
    }
  }
  light(p, color, radius, life) {
    this.tempLights.push({ x: p.x, y: p.y, z: p.z, color, radius, life, max: life });
  }
  addFrameLight(x, y, z, color, radius) {
    this.frameLights.push({ x, y, z, color, radius });
  }
  text(p, str, color = '#fff', big = false) {
    this.texts.push({ x: p.x, y: p.y, z: p.z, str, color, big, life: 0.9, vy: 1.5 });
  }
  update(dt, level) {
    this.glow.update(dt, level);
    this.solid.update(dt, level);
    this.arcs.update(dt);
    this.tempLights = this.tempLights.filter((l) => (l.life -= dt) > 0);
    for (const t of this.texts) { t.life -= dt; t.y += t.vy * dt; t.vy *= 0.95; }
    this.texts = this.texts.filter((t) => t.life > 0);
    this.shake = Math.max(0, this.shake - dt * 1.5);
    this.flash = Math.max(0, this.flash - dt * 2);
  }
  // Pick lights for the shader: slot 0 = player lantern
  commitLights(camPos, lantern) {
    const cand = [];
    for (const l of this.tempLights) { const f = l.life / l.max; cand.push({ ...l, color: l.color.map((c) => c * f * 1.6) }); }
    for (const l of this.frameLights) cand.push(l);
    for (const c of cand) c.d = (c.x - camPos.x) ** 2 + (c.z - camPos.z) ** 2 - c.radius * c.radius;
    cand.sort((a, b) => a.d - b.d);
    const P = shared.lPos.value, C = shared.lCol.value, R = shared.lRad.value;
    P[0].set(lantern.x, lantern.y, lantern.z); C[0].set(...lantern.color); R[0] = lantern.radius;
    for (let i = 1; i < MAX_LIGHTS; i++) {
      const c = cand[i - 1];
      if (c) { P[i].set(c.x, c.y, c.z); C[i].set(c.color[0], c.color[1], c.color[2]); R[i] = c.radius; }
      else { P[i].set(0, -999, 0); C[i].set(0, 0, 0); R[i] = 1; }
    }
    this.frameLights.length = 0;
  }
}
