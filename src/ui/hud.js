// HUD: DOM bars/text + low-res canvas overlay (view model, crosshair, labels, numbers).
import * as THREE from 'three';
import { G } from '../state.js';
import { xpForLevel } from '../items/stats.js';
import { itemIconInfo } from '../items/itemgen.js';
import { itemIconCanvas } from '../gfx/sprites.js';
import { viewmodelCanvas } from './viewmodel.js';
import { RARITY, ELEMENTS } from '../items/itemData.js';
import { T } from '../world/level.js';

const $ = (id) => document.getElementById(id);
let hc, hctx, W = 320, H = 200;
const els = {};
const logLines = [];
const v3 = new THREE.Vector3();

export function initHud() {
  hc = $('hudCanvas');
  hctx = hc.getContext('2d');
  for (const id of ['hud', 'lifeFill', 'lifeText', 'xpFill', 'lvlText', 'buffs', 'target', 'targetName', 'targetFill', 'targetMods', 'goldText', 'depthText', 'minimap', 'weaponBar', 'prompt', 'log', 'banner', 'bannerTitle', 'bannerSub', 'dashPips', 'flash', 'btnUse', 'btnDash', 'potCount', 'btnSwap']) els[id] = $(id);
}

export function resizeHud(w, h) {
  W = w; H = h;
  hc.width = w; hc.height = h;
  hctx.imageSmoothingEnabled = false;
}

export function log(text, color = '#e6dcc6') {
  const d = document.createElement('div');
  d.textContent = text; d.style.color = color;
  els.log.appendChild(d);
  logLines.push({ el: d, t: 5 });
  while (logLines.length > 6) logLines.shift().el.remove();
}

let bannerT = 0;
export function banner(title, sub = '', secs = 2.6) {
  els.bannerTitle.textContent = title;
  els.bannerSub.textContent = sub;
  els.banner.classList.remove('hidden');
  bannerT = secs;
}

let wbarKey = '';
function updateWeaponBar(p) {
  const eq = p.equip;
  const key = [0, 1, 2].map((i) => eq['weapon' + i]?.uid || '-').join() + p.profile.activeSlot + p.profile.potions;
  if (key === wbarKey) return;
  wbarKey = key;
  els.weaponBar.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const it = eq['weapon' + i];
    const d = document.createElement('div');
    d.className = 'wslot' + (i === p.profile.activeSlot ? ' active' : '');
    d.innerHTML = `<span class="k">${i + 1}</span>`;
    if (it) {
      const info = itemIconInfo(it);
      const c = itemIconCanvas(info.icon, info.tier, info.gem);
      const cc = document.createElement('canvas'); cc.width = 24; cc.height = 24;
      cc.getContext('2d').drawImage(c, 0, 0);
      d.appendChild(cc);
    }
    els.weaponBar.appendChild(d);
  }
  const pd = document.createElement('div');
  pd.className = 'wslot potslot';
  pd.innerHTML = `<span class="k">Q</span>♥${p.profile.potions}`;
  els.weaponBar.appendChild(pd);
}

let mmT = 0;
export function updateHud(dt, ctx) {
  const p = G.player;
  if (!p) return;
  const st = p.stats;
  els.lifeFill.style.width = `${(p.hp / st.maxHp) * 100}%`;
  els.lifeText.textContent = `${Math.ceil(p.hp)} / ${st.maxHp}`;
  const need = xpForLevel(p.level);
  els.xpFill.style.width = `${(p.xp / need) * 100}%`;
  els.lvlText.textContent = `Level ${p.level}  ·  XP ${p.xp}/${need}`;
  els.goldText.textContent = `${p.gold.toLocaleString()} gold`;
  els.depthText.textContent = G.mode === 'town' ? 'Hollowmere' : `${G.level.theme.name} · Depth ${G.depth}`;
  const buffs = Object.entries(p.buffs).map(([k, v]) => `${k} ${Math.ceil(v)}s`).join('  ');
  els.buffs.textContent = buffs;
  els.potCount.textContent = p.profile.potions;
  updateWeaponBar(p);

  // dash pips
  const dc = st.dash;
  if (dc > 0) {
    let h = '';
    for (let i = 0; i < dc; i++) h += `<i class="${i < p.dashCharges ? '' : 'off'}"></i>`;
    if (els.dashPips.innerHTML !== h) els.dashPips.innerHTML = h;
  } else if (els.dashPips.innerHTML) els.dashPips.innerHTML = '';
  els.btnDash.style.display = dc > 0 ? '' : 'none';
  els.btnSwap.style.display = [0, 1, 2].filter((i) => p.equip['weapon' + i]).length > 1 ? '' : 'none';

  // target
  const tgt = ctx.target;
  if (tgt && !tgt.dead) {
    els.target.classList.remove('hidden');
    els.targetName.textContent = tgt.name;
    els.targetName.style.color = tgt.unique ? '#c8a060' : tgt.champion ? '#7f9cff' : '#e6dcc6';
    els.targetFill.style.width = `${Math.max(0, tgt.hp / tgt.maxHp) * 100}%`;
    els.targetMods.textContent = tgt.mods.size ? [...tgt.mods].map(modName).join(', ') : '';
  } else els.target.classList.add('hidden');

  // interact prompt
  const it = ctx.interact;
  if (it && it.label) {
    els.prompt.classList.remove('hidden');
    els.prompt.textContent = G.touch ? it.label : `[E] ${it.label}`;
    els.btnUse.style.display = '';
    els.btnUse.textContent = it.npc ? 'TALK' : 'USE';
  } else {
    els.prompt.classList.add('hidden');
    els.btnUse.style.display = 'none';
  }

  // log fade
  for (const l of logLines) { l.t -= dt; l.el.style.opacity = l.t < 1 ? Math.max(0, l.t) : 1; }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) els.banner.classList.add('hidden'); }

  // screen flash
  const fx = G.fx;
  let fl = fx.flash;
  let fc = fx.flashColor;
  if (p.healFlash > 0 && fl < 0.05) { fl = p.healFlash * 0.3; fc = '255,60,60'; }
  els.flash.style.opacity = Math.min(0.6, fl);
  els.flash.style.background = `radial-gradient(ellipse at center, rgba(${fc},0.15), rgba(${fc},0.7))`;
  if (p.dead) { els.flash.style.opacity = Math.min(0.75, (p.deathT || 0) * 0.5); els.flash.style.background = 'rgba(120,0,0,1)'; }

  mmT -= dt;
  if (mmT <= 0) { mmT = 0.15; drawMinimap(); }
  drawCanvas(dt, ctx);
}

const MOD_NAMES = { fast: 'Extra Fast', strong: 'Extra Strong', stone: 'Stone Skin', fireEnch: 'Fire Enchanted', coldEnch: 'Cold Enchanted', lightEnch: 'Lightning Enchanted', teleport: 'Teleportation', multishot: 'Multiple Shots', vampiric: 'Vampiric', cursed: 'Cursed' };
const modName = (m) => MOD_NAMES[m] || m;

function project(x, y, z) {
  v3.set(x, y, z).project(G.camera);
  if (v3.z > 1 || v3.z < -1) return null;
  return [(v3.x * 0.5 + 0.5) * W, (-v3.y * 0.5 + 0.5) * H];
}

function drawCanvas(dt, ctx) {
  const c = hctx;
  c.clearRect(0, 0, W, H);
  const p = G.player;
  const fs = Math.max(8, Math.round(H / 20));
  c.textAlign = 'center';
  c.textBaseline = 'middle';

  // ground item labels (Diablo style)
  c.font = `${Math.max(8, Math.round(H / 24))}px VT323, monospace`;
  const camPos = G.camera.position;
  const fwd = p.aimDir();
  const labels = [];
  for (const pk of G.pickups) {
    if (pk.kind !== 'item') continue;
    const dx = pk.x - camPos.x, dz = pk.z - camPos.z, dy = pk.y - camPos.y;
    const d = Math.hypot(dx, dz);
    if (d > 14 || (dx * fwd.x + dy * fwd.y + dz * fwd.z) < 0) continue;
    if (!G.level.los(camPos.x, camPos.z, pk.x, pk.z)) continue;
    const s = project(pk.x, pk.y + 0.95, pk.z);
    if (!s) continue;
    labels.push({ s, text: pk.item.name, color: RARITY[pk.item.rarity].css, d });
  }
  labels.sort((a, b) => b.d - a.d);
  for (const l of labels) {
    const w = c.measureText(l.text).width + 4;
    c.fillStyle = 'rgba(0,0,0,0.65)';
    c.fillRect(Math.round(l.s[0] - w / 2), Math.round(l.s[1] - fs * 0.45), Math.round(w), Math.round(fs * 0.9));
    c.fillStyle = l.color;
    c.fillText(l.text, Math.round(l.s[0]), Math.round(l.s[1]));
  }

  // damage numbers
  for (const t of G.fx.texts) {
    const s = project(t.x, t.y, t.z);
    if (!s) continue;
    c.font = `${t.big ? fs + 3 : fs - 1}px VT323, monospace`;
    c.globalAlpha = Math.min(1, t.life * 2);
    c.fillStyle = '#000';
    c.fillText(t.str, Math.round(s[0]) + 1, Math.round(s[1]) + 1);
    c.fillStyle = t.color;
    c.fillText(t.str, Math.round(s[0]), Math.round(s[1]));
  }
  c.globalAlpha = 1;

  // enemy health pips above champions/uniques
  for (const e of G.enemies) {
    if (e.dead || !(e.unique || e.champion) || !e.awake) continue;
    const d = Math.hypot(e.pos.x - camPos.x, e.pos.z - camPos.z);
    if (d > 18) continue;
    const s = project(e.pos.x, e.pos.y + e.height + 0.3, e.pos.z);
    if (!s) continue;
    const w = 20;
    c.fillStyle = '#000'; c.fillRect(Math.round(s[0] - w / 2) - 1, Math.round(s[1]) - 1, w + 2, 4);
    c.fillStyle = e.unique ? '#c8a060' : '#7f9cff';
    c.fillRect(Math.round(s[0] - w / 2), Math.round(s[1]), Math.round(w * e.hp / e.maxHp), 2);
  }

  if (G.mode === 'dungeon' && !p.dead) {
    // crosshair
    const cx = Math.round(W / 2), cy = Math.round(H / 2);
    c.fillStyle = ctx.target ? '#ff5040' : 'rgba(255,240,200,0.85)';
    c.fillRect(cx - 4, cy, 3, 1); c.fillRect(cx + 2, cy, 3, 1);
    c.fillRect(cx, cy - 4, 1, 3); c.fillRect(cx, cy + 2, 1, 3);

    // hurt direction
    if (p.hurtDirT > 0) {
      p.hurtDirT -= dt;
      const rel = p.hurtDir - p.yaw - Math.PI;
      const r = Math.min(W, H) * 0.3;
      const hx = cx - Math.sin(rel) * r, hy = cy - Math.cos(rel) * r;
      c.fillStyle = `rgba(255,30,20,${Math.min(0.8, p.hurtDirT)})`;
      c.beginPath(); c.arc(hx, hy, 4, 0, Math.PI * 2); c.fill();
    }
    drawViewmodel(c, p);
  }
}

function drawViewmodel(c, p) {
  const w = p.activeWeapon();
  if (!w) return;
  const info = itemIconInfo(w);
  const vm = viewmodelCanvas(info.icon, info.tier, info.gem);
  const scale = Math.max(1, Math.floor((H * 0.42) / vm.h));
  const bobX = Math.sin(p.bob) * 4 * (p.onGround ? 1 : 0.2);
  const bobY = Math.abs(Math.cos(p.bob)) * 3 + (p.landT > 0 ? 4 : 0);
  const sw = p.switchT > 0 ? p.switchT * 4 * vm.h : 0;
  const x = Math.round(W / 2 - (vm.w * scale) / 2 + W * 0.12 + bobX);
  const y = Math.round(H - vm.h * scale + bobY + p.recoil * 8 * scale + sw);
  // muzzle glow
  const tip = vm.tip;
  if (p.muzzle > 0 || p.recoil > 0.6) {
    const el = ELEMENTS[p.spec?.element || 'physical'];
    const [r, g, b] = el.color.map((v) => Math.round(v * 255));
    const gx = x + tip[0] * scale, gy = y + tip[1] * scale;
    const rad = 10 * scale * (0.6 + p.recoil * 0.6);
    const grd = c.createRadialGradient(gx, gy, 0, gx, gy, rad);
    grd.addColorStop(0, `rgba(255,255,255,0.9)`);
    grd.addColorStop(0.3, `rgba(${r},${g},${b},0.7)`);
    grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
    c.fillStyle = grd;
    c.fillRect(gx - rad, gy - rad, rad * 2, rad * 2);
    p.muzzle -= 1 / 60;
  }
  // lighting: darken the view model in dark areas
  const L = G.level.sampleLight(p.pos.x, p.pos.z, v3);
  const lum = Math.min(1, 0.35 + (L.x + L.y + L.z) / 3 * 0.9);
  c.drawImage(vm.canvas, x, y, vm.w * scale, vm.h * scale);
  if (lum < 0.98) {
    c.globalAlpha = 1 - lum;
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = '#000';
    c.fillRect(x, y, vm.w * scale, vm.h * scale);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
  }
}

function drawMinimap() {
  const cv = els.minimap, c = cv.getContext('2d');
  const lvl = G.level, p = G.player;
  const S = 96, cell = 2, R = 24;
  c.clearRect(0, 0, S, S);
  const ptx = Math.floor(p.pos.x / T), ptz = Math.floor(p.pos.z / T);
  // reveal around player
  for (let z = -6; z <= 6; z++) for (let x = -6; x <= 6; x++) {
    const tx = ptx + x, tz = ptz + z;
    if (!lvl.inb(tx, tz) || x * x + z * z > 40) continue;
    if (lvl.seen[lvl.idx(tx, tz)]) continue;
    if (lvl.los(p.pos.x, p.pos.z, (tx + 0.5) * T, (tz + 0.5) * T) || lvl.isSolid(tx, tz)) lvl.seen[lvl.idx(tx, tz)] = 1;
  }
  for (let z = -R; z < R; z++) for (let x = -R; x < R; x++) {
    const tx = ptx + x, tz = ptz + z;
    if (!lvl.inb(tx, tz) || !lvl.seen[lvl.idx(tx, tz)]) continue;
    const solid = lvl.isSolid(tx, tz);
    if (solid) {
      // only draw walls next to open tiles
      let edge = false;
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!lvl.isSolid(tx + ox, tz + oz)) edge = true;
      if (!edge) continue;
      c.fillStyle = 'rgba(200,170,120,0.9)';
    } else c.fillStyle = lvl.floorH[lvl.idx(tx, tz)] > 0.1 ? 'rgba(120,110,160,0.5)' : 'rgba(80,70,60,0.45)';
    c.fillRect((x + R) * cell, (z + R) * cell, cell, cell);
  }
  // markers
  for (const pr of G.props) {
    if (!['stairsDown', 'portalUp', 'dungeonGate', 'npc', 'chest', 'chestGold', 'shrine'].includes(pr.kind)) continue;
    const tx = Math.floor(pr.x / T), tz = Math.floor(pr.z / T);
    if (!lvl.seen[lvl.idx(tx, tz)]) continue;
    const x = tx - ptx + R, z = tz - ptz + R;
    if (x < 0 || z < 0 || x >= 2 * R || z >= 2 * R) continue;
    c.fillStyle = pr.kind === 'stairsDown' || pr.kind === 'dungeonGate' ? '#ff4030' : pr.kind === 'portalUp' ? '#4080ff' : pr.kind === 'npc' ? '#40ff60' : pr.kind === 'shrine' ? '#60e0ff' : pr.opened ? '#665' : '#ffd040';
    c.fillRect(x * cell - 1, z * cell - 1, 4, 4);
  }
  // player arrow
  const cx = R * cell + 1, cz = R * cell + 1;
  c.fillStyle = '#fff';
  c.fillRect(cx - 1, cz - 1, 3, 3);
  c.strokeStyle = '#fff';
  c.beginPath(); c.moveTo(cx, cz); c.lineTo(cx - Math.sin(p.yaw) * 6, cz - Math.cos(p.yaw) * 6); c.stroke();
}

export function setHudVisible(v) { els.hud.classList.toggle('hidden', !v); }
