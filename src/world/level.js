// Tile-based level: collision queries, baked lighting and mesh construction.
import * as THREE from 'three';
import { levelMaterial } from '../gfx/materials.js';

export const T = 3; // world units per tile

// solid codes: 0 = open, 1 = wall, 2 = alt wall, 3 = timber (town), 4 = invisible blocker
// floor material codes: 0 = floor, 1 = platform, 2 = grass, 3 = planks
export class Level {
  constructor(w, h, opts = {}) {
    this.w = w; this.h = h;
    this.solid = new Uint8Array(w * h).fill(1);
    this.floorH = new Float32Array(w * h);
    this.floorMat = new Uint8Array(w * h);
    this.wallH = new Float32Array(w * h).fill(opts.wallH || 4.5);
    this.ceilH = opts.ceilH || 4.5;
    this.outdoor = !!opts.outdoor;
    this.lights = []; // {x,y,z,color:[r,g,b],radius}
    this.objects = []; // generator-side descriptions
    this.light = new Float32Array(w * h * 3);
    this.seen = new Uint8Array(w * h);
    this.ambient = opts.ambient || [0.2, 0.2, 0.2];
  }
  idx(tx, tz) { return tz * this.w + tx; }
  inb(tx, tz) { return tx >= 0 && tz >= 0 && tx < this.w && tz < this.h; }
  isSolid(tx, tz) { return !this.inb(tx, tz) || this.solid[tz * this.w + tx] !== 0; }
  open(tx, tz, fh = 0, mat = 0) {
    if (!this.inb(tx, tz)) return;
    const i = this.idx(tx, tz);
    this.solid[i] = 0; this.floorH[i] = fh; this.floorMat[i] = mat;
  }
  tileOf(x) { return Math.floor(x / T); }
  heightAt(tx, tz) { return this.isSolid(tx, tz) ? 999 : this.floorH[tz * this.w + tx]; }

  // Is the tile blocking for a body whose feet are at feetY that can step `step` high?
  blocks(tx, tz, feetY, step) {
    if (this.isSolid(tx, tz)) return true;
    return this.floorH[tz * this.w + tx] > feetY + step;
  }

  // Highest floor under a circle (only tiles not blocking)
  groundUnder(x, z, r, feetY, step) {
    let g = -Infinity;
    const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T);
    const z0 = Math.floor((z - r) / T), z1 = Math.floor((z + r) / T);
    for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) {
      if (this.isSolid(tx, tz)) continue;
      const h = this.floorH[tz * this.w + tx];
      if (h <= feetY + step && h > g) g = h;
    }
    return g === -Infinity ? 0 : g;
  }

  // Move a circle with axis-separated collision. Mutates pos (Vector3, y = feet).
  // Returns {hitX, hitZ}
  moveCircle(pos, dx, dz, r, step) {
    let hitX = false, hitZ = false;
    // sub-step large moves
    const dist = Math.max(Math.abs(dx), Math.abs(dz));
    const n = Math.max(1, Math.ceil(dist / (r * 0.9)));
    const sx = dx / n, sz = dz / n;
    for (let s = 0; s < n; s++) {
      if (sx) {
        const nx = pos.x + sx;
        if (this.circleBlocked(nx, pos.z, r, pos.y, step)) {
          hitX = true;
          // snap to edge
          if (sx > 0) pos.x = Math.min(nx, (Math.floor((pos.x + r) / T) + 1) * T - r - 0.001);
          else pos.x = Math.max(nx, Math.floor((pos.x - r) / T) * T + r + 0.001);
          if (this.circleBlocked(pos.x, pos.z, r, pos.y, step)) pos.x = nx - sx; // fallback
        } else pos.x = nx;
      }
      if (sz) {
        const nz = pos.z + sz;
        if (this.circleBlocked(pos.x, nz, r, pos.y, step)) {
          hitZ = true;
          if (sz > 0) pos.z = Math.min(nz, (Math.floor((pos.z + r) / T) + 1) * T - r - 0.001);
          else pos.z = Math.max(nz, Math.floor((pos.z - r) / T) * T + r + 0.001);
          if (this.circleBlocked(pos.x, pos.z, r, pos.y, step)) pos.z = nz - sz;
        } else pos.z = nz;
      }
    }
    return { hitX, hitZ };
  }

  circleBlocked(x, z, r, feetY, step) {
    const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T);
    const z0 = Math.floor((z - r) / T), z1 = Math.floor((z + r) / T);
    for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++)
      if (this.blocks(tx, tz, feetY, step)) return true;
    return false;
  }

  // Point inside solid geometry? (for projectiles)
  pointSolid(x, y, z) {
    const tx = Math.floor(x / T), tz = Math.floor(z / T);
    if (this.isSolid(tx, tz)) return !this.outdoor || y < this.wallH[this.idx(tx, tz)] || !this.inb(tx, tz);
    if (y < this.floorH[tz * this.w + tx]) return true;
    if (!this.outdoor && y > this.ceilH) return true;
    return false;
  }

  // Grid line of sight (ignores heights)
  los(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0;
    const dist = Math.hypot(dx, dz);
    const steps = Math.ceil(dist / (T * 0.25));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isSolid(Math.floor((x0 + dx * t) / T), Math.floor((z0 + dz * t) / T))) return false;
    }
    return true;
  }

  // Bilinear baked light lookup at world position
  sampleLight(x, z, out) {
    const tx = Math.floor(x / T), tz = Math.floor(z / T);
    if (!this.inb(tx, tz)) { out.set(...this.ambient); return out; }
    const i = (tz * this.w + tx) * 3;
    out.set(this.light[i], this.light[i + 1], this.light[i + 2]);
    return out;
  }

  // Flood-fill light from each light source through open tiles.
  bakeLighting() {
    const { w, h } = this;
    const L = this.light;
    for (let i = 0; i < w * h; i++) { L[i * 3] = this.ambient[0]; L[i * 3 + 1] = this.ambient[1]; L[i * 3 + 2] = this.ambient[2]; }
    const dist = new Float32Array(w * h);
    for (const lt of this.lights) {
      const rTiles = lt.radius / T;
      const sx = Math.floor(lt.x / T), sz = Math.floor(lt.z / T);
      dist.fill(1e9);
      const q = [];
      // start from light tile, or open neighbors if the light sits in a wall
      const seeds = [];
      if (!this.isSolid(sx, sz)) seeds.push([sx, sz]);
      else for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!this.isSolid(sx + ox, sz + oz)) seeds.push([sx + ox, sz + oz]);
      for (const [x, z] of seeds) { dist[this.idx(x, z)] = 0; q.push(x, z); }
      let head = 0;
      while (head < q.length) {
        const x = q[head++], z = q[head++];
        const d = dist[this.idx(x, z)];
        // light falloff from true geometric distance, BFS only gates occlusion
        const gx = (x + 0.5) * T - lt.x, gz = (z + 0.5) * T - lt.z;
        const gd = Math.hypot(gx, gz) / T;
        const a = Math.max(0, 1 - Math.max(gd, d * 0.85) / rTiles);
        if (a > 0) {
          const k = (this.idx(x, z)) * 3, s = a * a * (lt.intensity || 1);
          L[k] += lt.color[0] * s; L[k + 1] += lt.color[1] * s; L[k + 2] += lt.color[2] * s;
        }
        if (d + 1 > rTiles) continue;
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + ox, nz = z + oz;
          if (this.isSolid(nx, nz)) continue;
          const ni = this.idx(nx, nz);
          if (dist[ni] > d + 1) { dist[ni] = d + 1; q.push(nx, nz); }
        }
      }
    }
    for (let i = 0; i < L.length; i++) L[i] = Math.min(L[i], 1.6);
  }

  // Light for a tile corner: average of up to 4 surrounding open tiles
  cornerLight(cx, cz, out) {
    let r = 0, g = 0, b = 0, n = 0;
    for (const [ox, oz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
      const tx = cx + ox, tz = cz + oz;
      if (this.isSolid(tx, tz)) continue;
      const k = this.idx(tx, tz) * 3;
      r += this.light[k]; g += this.light[k + 1]; b += this.light[k + 2]; n++;
    }
    if (!n) { out[0] = this.ambient[0]; out[1] = this.ambient[1]; out[2] = this.ambient[2]; return out; }
    out[0] = r / n; out[1] = g / n; out[2] = b / n;
    return out;
  }

  // Build merged meshes. textures: { wall, wall2, timber?, floor, platform, grass?, planks?, ceil }
  buildMesh(textures) {
    const groups = {};
    const get = (key) => (groups[key] ||= { pos: [], uv: [], light: [], idx: [] });
    const quad = (key, verts, uvs, lights) => {
      const g = get(key);
      const base = g.pos.length / 3;
      for (const v of verts) g.pos.push(v[0], v[1], v[2]);
      for (const u of uvs) g.uv.push(u[0], u[1]);
      for (const l of lights) g.light.push(l[0], l[1], l[2]);
      g.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const { w, h } = this;
    const c00 = [0, 0, 0], c10 = [0, 0, 0], c11 = [0, 0, 0], c01 = [0, 0, 0];
    const floorKeys = ['floor', 'platform', 'grass', 'planks'];
    const wallKeys = { 1: 'wall', 2: 'wall2', 3: 'timber', 4: null };
    const tileLight = (tx, tz) => { const k = this.idx(tx, tz) * 3; return [this.light[k], this.light[k + 1], this.light[k + 2]]; };

    for (let tz = 0; tz < h; tz++) for (let tx = 0; tx < w; tx++) {
      const i = this.idx(tx, tz);
      if (this.solid[i] !== 0) {
        // outdoor wall tops
        if (this.outdoor && this.solid[i] !== 4) {
          const top = this.wallH[i];
          let exposed = false;
          for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.inb(tx + ox, tz + oz) && !this.isSolid(tx + ox, tz + oz)) exposed = true;
          if (exposed) {
            const x0 = tx * T, z0 = tz * T, x1 = x0 + T, z1 = z0 + T;
            const L = this.ambient.map((v) => v * 0.8);
            quad(wallKeys[this.solid[i]] || 'wall', [[x0, top, z1], [x1, top, z1], [x1, top, z0], [x0, top, z0]], [[0, 0], [1, 0], [1, 1], [0, 1]], [L, L, L, L]);
          }
        }
        continue;
      }
      const fh = this.floorH[i];
      const x0 = tx * T, z0 = tz * T, x1 = x0 + T, z1 = z0 + T;
      this.cornerLight(tx, tz, c00); this.cornerLight(tx + 1, tz, c10);
      this.cornerLight(tx + 1, tz + 1, c11); this.cornerLight(tx, tz + 1, c01);
      // floor (CCW seen from above: normal +y)
      const fk = floorKeys[this.floorMat[i]] || 'floor';
      quad(fk, [[x0, fh, z1], [x1, fh, z1], [x1, fh, z0], [x0, fh, z0]], [[0, 0], [1, 0], [1, 1], [0, 1]], [c01, c11, c10, c00]);
      if (!this.outdoor) {
        const ch = this.ceilH;
        const dim = (c) => c.map((v) => v * 0.75);
        quad('ceil', [[x0, ch, z0], [x1, ch, z0], [x1, ch, z1], [x0, ch, z1]], [[0, 0], [1, 0], [1, 1], [0, 1]], [dim(c00), dim(c10), dim(c11), dim(c01)]);
      }
      // walls / ledges facing into this tile
      const sides = [
        [0, -1, [x0, z0], [x1, z0], c00, c10], // north neighbor: face points +z (south)
        [0, 1, [x1, z1], [x0, z1], c11, c01],
        [-1, 0, [x0, z1], [x0, z0], c01, c00],
        [1, 0, [x1, z0], [x1, z1], c10, c11],
      ];
      for (const [ox, oz, a, b, la, lb] of sides) {
        const nx = tx + ox, nz = tz + oz;
        const solidN = this.isSolid(nx, nz);
        let bottom, top, key;
        if (solidN) {
          const code = this.inb(nx, nz) ? this.solid[this.idx(nx, nz)] : 1;
          if (code === 4) continue;
          key = wallKeys[code] || 'wall';
          bottom = fh;
          top = this.outdoor ? (this.inb(nx, nz) ? this.wallH[this.idx(nx, nz)] : 6) : this.ceilH;
        } else {
          // ledge face: neighbor floor higher than ours -> draw face from our floor to theirs
          const nh = this.floorH[this.idx(nx, nz)];
          if (nh <= fh + 0.01) continue;
          key = 'platformSide';
          bottom = fh; top = nh;
        }
        const la2 = la.map((v) => v * (ox ? 0.8 : 1)), lb2 = lb.map((v) => v * (ox ? 0.8 : 1));
        const vTop = top / T, vBot = bottom / T;
        quad(key, [[a[0], bottom, a[1]], [b[0], bottom, b[1]], [b[0], top, b[1]], [a[0], top, a[1]]],
          [[0, vBot], [1, vBot], [1, vTop], [0, vTop]], [la2, lb2, lb2, la2]);
      }
    }
    void tileLight;
    const group = new THREE.Group();
    for (const [key, g] of Object.entries(groups)) {
      if (!g.idx.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
      geo.setAttribute('light', new THREE.Float32BufferAttribute(g.light, 3));
      geo.setIndex(g.idx);
      geo.computeBoundingSphere();
      const tex = textures[key] || (key === 'platformSide' ? textures.platform || textures.wall : textures.wall);
      const mesh = new THREE.Mesh(geo, levelMaterial(tex));
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    return group;
  }

  // Random open tile (optionally filtered)
  randomOpen(rng, filter) {
    for (let k = 0; k < 2000; k++) {
      const tx = rng.int(1, this.w - 2), tz = rng.int(1, this.h - 2);
      if (!this.isSolid(tx, tz) && (!filter || filter(tx, tz))) return [tx, tz];
    }
    return null;
  }
}

export const tileCenter = (t) => (t + 0.5) * T;
