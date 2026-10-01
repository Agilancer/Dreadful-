// Boot, game loop and high-level flow (title → town ⇄ dungeon floors).
import * as THREE from 'three';
import { G } from './state.js';
import { shared } from './gfx/materials.js';
import { townTextures, themeTextures, skyTexture } from './gfx/textures.js';
import { generateTown } from './world/town.js';
import { generateDungeon } from './world/dungeon.js';
import { buildProps, updateProps, clearProps, nearestInteractable, updatePickups } from './world/entities.js';
import { spawnEnemiesFromLevel, updateEnemies, clearEnemies } from './combat/enemies.js';
import { updateProjectiles } from './combat/projectiles.js';
import { FX } from './fx.js';
import { Player } from './player.js';
import { initInput, pollInput, clearFrameInput, releasePointer, requestPointer, resetHeld } from './input.js';
import { initAudio, sfx, setAmbience, setMuted, isMuted } from './audio.js';
import { initHud, resizeHud, updateHud, log, banner, setHudVisible } from './ui/hud.js';
import { openInventory, openShop, openPause, openDeath, closeMenu, showTitle, hideTitle, generateShopStock, applySettings, isMenuOpen } from './ui/menus.js';
import { loadSave, newSave, writeSave, hasSave } from './save.js';
import { T } from './world/level.js';

THREE.ColorManagement.enabled = false;

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.05, 300);
camera.rotation.order = 'YXZ';
G.renderer = renderer; G.scene = scene; G.camera = camera;
G.fx = new FX(scene);
G.ui = { log, banner };

// Sky dome (town only)
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(150, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
  new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, depthWrite: false, fog: false }),
);
sky.material.map.repeat.set(2, 1);
sky.renderOrder = -1;
scene.add(sky);

initHud();
initInput(canvas);

// ---------------------------------------------------------------------------
// Save handling
// ---------------------------------------------------------------------------
let saveTimer = 0;
G.saveSoon = () => { saveTimer = 1; };
G.saveNow = () => { if (G.save) writeSave(G.save); saveTimer = 0; };

// ---------------------------------------------------------------------------
// Resize (low internal resolution for the chunky retro look)
// ---------------------------------------------------------------------------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  let px = G.save?.settings?.pixel || 0;
  if (!px) px = Math.max(2, Math.min(5, Math.round(h / 210)));
  const rw = Math.max(160, Math.floor(w / px)), rh = Math.max(100, Math.floor(h / px));
  renderer.setSize(rw, rh, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  resizeHud(rw, rh);
  for (const pool of [G.fx.glow, G.fx.solid, G.fx.imm]) pool.points.material.uniforms.scale.value = rh * 0.9;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------------------------------------------------------------------------
// Level loading
// ---------------------------------------------------------------------------
function unloadLevel() {
  clearEnemies();
  clearProps();
  G.projectiles = [];
  G.hazards = [];
  G.fx.clear();
  if (G.levelGroup) {
    scene.remove(G.levelGroup);
    G.levelGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
}

function setEnvironment(theme, outdoor) {
  const f = theme.fog;
  shared.fogColor.value.set(f[0], f[1], f[2]);
  shared.fogNear.value = outdoor ? 20 : 3;
  shared.fogFar.value = outdoor ? 80 : 30;
  renderer.setClearColor(new THREE.Color(f[0], f[1], f[2]));
  sky.visible = outdoor;
}

function loadTown() {
  unloadLevel();
  G.mode = 'town';
  G.depth = 0;
  const lvl = generateTown();
  G.level = lvl;
  G.levelGroup = lvl.buildMesh(townTextures());
  scene.add(G.levelGroup);
  setEnvironment(lvl.theme, true);
  buildProps(lvl);
  if (G.player) {
    G.player.spawnAt(lvl.spawn.x, lvl.spawn.z, lvl.spawn.yaw);
    G.player.hp = G.player.stats.maxHp;
    G.player.buffs = {};
    G.player.recompute();
  }
  if (G.save) generateShopStock();
  setAmbience('town');
}

function loadDungeon(depth) {
  unloadLevel();
  G.mode = 'dungeon';
  G.depth = depth;
  const seed = (Math.random() * 2 ** 31) | 0;
  const lvl = generateDungeon(depth, seed);
  G.level = lvl;
  G.levelGroup = lvl.buildMesh(themeTextures(lvl.theme, depth));
  scene.add(G.levelGroup);
  setEnvironment(lvl.theme, false);
  buildProps(lvl);
  G.player.spawnAt(lvl.spawn.x, lvl.spawn.z, faceToward(lvl.spawn, lvl.exitPos));
  spawnEnemiesFromLevel(lvl);
  setAmbience('dungeon');
  if (depth > G.save.bestDepth) G.save.bestDepth = depth;
  G.save.runDepth = depth;
  G.saveNow();
}

function faceToward(a, b) {
  // look roughly away from the nearest wall: pick an open direction
  const lvl = G.level;
  const tx = Math.floor(a.x / T), tz = Math.floor(a.z / T);
  const dirs = [[0, -1, 0], [1, 0, -Math.PI / 2], [0, 1, Math.PI], [-1, 0, Math.PI / 2]];
  let best = 0, bestLen = -1;
  for (const [dx, dz, yaw] of dirs) {
    let n = 0;
    while (n < 10 && !lvl.isSolid(tx + dx * (n + 1), tz + dz * (n + 1))) n++;
    if (n > bestLen) { bestLen = n; best = yaw; }
  }
  void b;
  return best;
}

// ---------------------------------------------------------------------------
// Actions used by world objects and menus
// ---------------------------------------------------------------------------
G.actions = {
  enterDungeon() {
    const d = Math.max(1, G.save.runDepth || 1);
    transition(() => {
      loadDungeon(d);
      banner(G.level.theme.name, `Depth ${d}`);
    });
    sfx('portal', 0.7);
  },
  descend() {
    const d = G.depth + 1;
    transition(() => {
      loadDungeon(d);
      banner(G.level.theme.name, `Depth ${d}`);
    });
    sfx('portal', 0.7);
  },
  returnToTown() {
    transition(() => {
      loadTown();
      banner('Hollowmere', 'You may re-enter the dungeon at depth ' + (G.save.runDepth || 1));
      G.saveNow();
    });
    sfx('portal', 0.7);
  },
  openShop(id) { releasePointer(); resetHeld(); openShop(id); },
  playerDied() {
    G.save.deaths++;
    const depth = G.depth;
    G.save.runDepth = 1;
    G.saveNow();
    setTimeout(() => { releasePointer(); resetHeld(); openDeath(depth); }, 1600);
  },
  respawnInTown() {
    G.player.dead = false;
    loadTown();
    banner('Hollowmere', 'Death is not the end. The dungeon has shifted.');
    G.saveNow();
  },
  openPause() { if (!isMenuOpen() && G.mode !== 'title') { resetHeld(); openPause(); } },
  menuClosed() { resetHeld(); if (G.mode !== 'title' && !G.player?.dead) requestPointer(); },
  toTitle() { G.mode = 'title'; goTitle(); },
  resize,
};

let fade = 0, fadeCb = null;
function transition(cb) { fade = 0.0001; fadeCb = cb; }

// ---------------------------------------------------------------------------
// Title & start
// ---------------------------------------------------------------------------
function goTitle() {
  G.mode = 'title';
  setHudVisible(false);
  releasePointer();
  if (!G.level || G.level.depth !== 0) loadTown();
  G.mode = 'title';
  showTitle(hasSave(), () => startGame(loadSave()), () => startGame(newSave()));
}

function startGame(save) {
  initAudio();
  G.save = save || newSave();
  applySettings();
  resize();
  G.player = new Player(G.save.profile);
  hideTitle();
  setHudVisible(true);
  loadTown();
  G.mode = 'town';
  banner('Hollowmere', 'The dungeon gate lies to the north');
  log(G.touch ? 'Walk to a shopkeeper and tap TALK to trade.' : 'Click to capture the mouse. Walk to shopkeepers and press E to trade.', '#c8b890');
  requestPointer();
  G.saveNow();
}

// ---------------------------------------------------------------------------
// Targeting / aim assist
// ---------------------------------------------------------------------------
const tmpDir = new THREE.Vector3(), tmpTo = new THREE.Vector3(), tmpEye = new THREE.Vector3();
function findTarget(cone) {
  const p = G.player;
  p.eyePos(tmpEye);
  p.aimDir(tmpDir);
  let best = null, bestScore = cone;
  for (const e of G.enemies) {
    if (e.dead) continue;
    tmpTo.set(e.pos.x - tmpEye.x, e.pos.y + e.height * 0.55 - tmpEye.y, e.pos.z - tmpEye.z);
    const d = tmpTo.length();
    if (d > 40) continue;
    const ang = Math.acos(Math.max(-1, Math.min(1, tmpTo.dot(tmpDir) / d)));
    const ar = Math.atan(e.radius / d);
    const score = ang - ar;
    if (score < bestScore && G.level.los(tmpEye.x, tmpEye.z, e.pos.x, e.pos.z)) { bestScore = score; best = e; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const hudCtx = { target: null, interact: null };
let last = performance.now();
let autosave = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;
  shared.time.value = G.time;

  const p = G.player;
  if (G.mode === 'title') {
    // idle camera orbit over the town
    const a = G.time * 0.05;
    camera.position.set(52 + Math.cos(a) * 20, 6, 60 + Math.sin(a) * 20);
    camera.rotation.set(-0.1, a + Math.PI / 2, 0);
    renderFrame();
    return;
  }
  if (!p) { renderFrame(); return; }

  const input = pollInput();
  const paused = isMenuOpen();

  if (input.mute) { const m = !isMuted(); setMuted(m); G.save.settings.muted = m; log(m ? 'Sound muted' : 'Sound on'); }
  if (input.pause) {
    if (isMenuOpen()) closeMenu();
    else { releasePointer(); G.actions.openPause(); }
  }
  if (input.inventory && !p.dead) {
    if (G.menu === 'inventory' || G.menu === 'shop') closeMenu();
    else if (!isMenuOpen()) { releasePointer(); resetHeld(); openInventory(); }
  }

  if (!paused) {
    if (input.weaponSlot >= 0) p.switchWeapon(input.weaponSlot);
    if (input.weaponCycle) p.cycleWeapon(input.weaponCycle);
    if (input.swap) p.cycleWeapon(1);
    if (input.potion) p.usePotion();

    // aim assist (Hexen-style vertical autoaim + gentle touch magnetism)
    const target = G.mode === 'dungeon' ? findTarget(G.touch ? 0.16 : 0.06) : null;
    if (target && G.touch && !p.dead) {
      const e = target;
      p.eyePos(tmpEye);
      const dx = e.pos.x - tmpEye.x, dz = e.pos.z - tmpEye.z, dy = e.pos.y + e.height * 0.55 - tmpEye.y;
      const wantYaw = Math.atan2(-dx, -dz);
      let dyaw = wantYaw - p.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      const wantPitch = Math.atan2(dy, Math.hypot(dx, dz));
      const k = input.fire ? 6 : 2;
      p.yaw += dyaw * Math.min(1, dt * k);
      p.pitch += (wantPitch - p.pitch) * Math.min(1, dt * k);
    } else if (target && input.fire && !p.dead) {
      // vertical autoaim only
      p.eyePos(tmpEye);
      const e = target;
      const wantPitch = Math.atan2(e.pos.y + e.height * 0.55 - tmpEye.y, Math.hypot(e.pos.x - tmpEye.x, e.pos.z - tmpEye.z));
      p.autoPitch = wantPitch;
    }
    const savedPitch = p.pitch;
    if (p.autoPitch != null && !G.touch) p.pitch = p.autoPitch;
    p.update(dt, input);
    if (p.autoPitch != null && !G.touch) { p.pitch = savedPitch - input.lookY; p.pitch = Math.max(-1.45, Math.min(1.45, p.pitch)); }
    p.autoPitch = null;

    hudCtx.target = target || findTarget(0.03);
    const inter = p.dead ? null : nearestInteractable(p.pos, p.yaw);
    hudCtx.interact = inter;
    if (input.use && inter) { inter.interact(); }

    updateEnemies(dt);
    updateProjectiles(dt);
    updatePickups(dt);
    updateProps(dt);
    G.fx.update(dt, G.level);
  } else {
    clearFrameInput();
  }
  clearFrameInput();

  // camera
  p.eyePos(camera.position);
  const bobY = p.onGround ? Math.sin(p.bob * 2) * 0.05 * Math.min(1, Math.hypot(p.vel.x, p.vel.z) / 6) : 0;
  camera.position.y += bobY - (p.landT > 0 ? p.landT * 0.6 : 0);
  if (p.dead) camera.position.y = p.pos.y + Math.max(0.3, 1.55 - (p.deathT || 0) * 1.5);
  const sh = G.fx.shake;
  camera.rotation.set(p.pitch + (Math.random() - 0.5) * sh * 0.08, p.yaw + (Math.random() - 0.5) * sh * 0.08, p.dead ? Math.min(0.6, (p.deathT || 0) * 0.5) : 0);
  sky.position.copy(camera.position);

  // lights / uniforms
  const lantern = G.mode === 'town'
    ? { x: camera.position.x, y: camera.position.y, z: camera.position.z, color: [0.25, 0.22, 0.18], radius: 10 }
    : { x: camera.position.x, y: camera.position.y + 0.2, z: camera.position.z, color: [0.55, 0.45, 0.32], radius: 11 };
  G.fx.commitLights(camera.position, lantern);
  shared.camPos.value.copy(camera.position);
  shared.camRight.value.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));

  updateHud(dt, hudCtx);

  // fade transitions
  if (fade > 0) {
    fade += dt * 3;
    if (fade >= 1 && fadeCb) { const cb = fadeCb; fadeCb = null; cb(); fade = 1; }
    if (!fadeCb && fade >= 1) fade = -1;
    document.getElementById('flash').style.opacity = 1;
    document.getElementById('flash').style.background = '#000';
  } else if (fade < 0) {
    fade += dt * 2;
    document.getElementById('flash').style.opacity = Math.max(0, -fade);
    document.getElementById('flash').style.background = '#000';
    if (fade >= 0) fade = 0;
  }

  if (saveTimer > 0) { saveTimer -= dt; if (saveTimer <= 0) G.saveNow(); }
  autosave += dt;
  if (autosave > 20) { autosave = 0; G.saveNow(); }
  renderFrame();
}

function renderFrame() {
  if (G.mode === 'title') {
    shared.camPos.value.copy(camera.position);
    shared.camRight.value.set(Math.cos(camera.rotation.y), 0, -Math.sin(camera.rotation.y));
    sky.position.copy(camera.position);
    G.fx.commitLights(camera.position, { x: 0, y: -999, z: 0, color: [0, 0, 0], radius: 1 });
  }
  renderer.render(scene, camera);
}

window.addEventListener('beforeunload', () => G.saveNow());
document.addEventListener('visibilitychange', () => { if (document.hidden) { G.saveNow(); if (G.mode !== 'title' && G.player && !G.player.dead && !isMenuOpen()) G.actions.openPause(); } });

// expose for debugging / automated tests
window.__G = G;

resize();
goTitle();
requestAnimationFrame(frame);
