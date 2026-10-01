// Keyboard + mouse (pointer lock) and iOS/Android touch controls.
import { G } from './state.js';
import { initAudio } from './audio.js';

export const input = {
  moveX: 0, moveY: 0, lookX: 0, lookY: 0,
  fire: false, firePressed: false,
  jumpPressed: false, jumpHeld: false,
  dash: false, use: false, potion: false,
  inventory: false, pause: false, map: false,
  weaponSlot: -1, weaponCycle: 0,
};

const keys = new Set();
let mouseDown = false, firePrev = false;
let mouseDX = 0, mouseDY = 0;
const pressed = new Set(); // one-shot actions queued this frame
export const settings = { mouseSens: 0.0022, touchSens: 0.0065, invertY: false };

let canvasEl = null;

export function initInput(canvas) {
  canvasEl = canvas;
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT')) return;
    initAudio();
    if (!keys.has(e.code)) onKeyPress(e.code);
    keys.add(e.code);
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; });

  canvas.addEventListener('mousedown', (e) => {
    initAudio();
    if (G.touch) return;
    if (G.menu || G.mode === 'title') return;
    if (document.pointerLockElement !== canvas) { canvas.requestPointerLock?.(); return; }
    if (e.button === 0) mouseDown = true;
    if (e.button === 2) pressed.add('dash');
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) { mouseDX += e.movementX; mouseDY += e.movementY; }
  });
  window.addEventListener('wheel', (e) => {
    if (document.pointerLockElement === canvas) input.weaponCycle = Math.sign(e.deltaY);
  }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas && G.mode !== 'title' && !G.menu && !G.player?.dead) G.actions?.openPause?.();
  });
  initTouch();
}

function onKeyPress(code) {
  switch (code) {
    case 'Space': pressed.add('jump'); break;
    case 'ShiftLeft': case 'ShiftRight': pressed.add('dash'); break;
    case 'KeyE': case 'KeyF': pressed.add('use'); break;
    case 'KeyQ': case 'KeyR': pressed.add('potion'); break;
    case 'KeyI': case 'Tab': case 'KeyB': pressed.add('inventory'); break;
    case 'Escape': case 'KeyP': pressed.add('pause'); break;
    case 'KeyM': pressed.add('mute'); break;
    case 'Digit1': input.weaponSlot = 0; break;
    case 'Digit2': input.weaponSlot = 1; break;
    case 'Digit3': input.weaponSlot = 2; break;
  }
}

export function consumePressed(name) {
  if (pressed.has(name)) { pressed.delete(name); return true; }
  return false;
}

export function releasePointer() {
  if (document.pointerLockElement) document.exitPointerLock?.();
}
export function requestPointer() {
  if (!G.touch && canvasEl && document.pointerLockElement !== canvasEl) canvasEl.requestPointerLock?.();
}

// Sample all inputs for this frame
export function pollInput() {
  const k = (c) => keys.has(c);
  let mx = 0, my = 0;
  if (k('KeyW') || k('ArrowUp')) my += 1;
  if (k('KeyS') || k('ArrowDown')) my -= 1;
  if (k('KeyA')) mx -= 1;
  if (k('KeyD')) mx += 1;
  let lx = mouseDX * settings.mouseSens, ly = mouseDY * settings.mouseSens * (settings.invertY ? -1 : 1);
  if (k('ArrowLeft')) lx -= 0.04;
  if (k('ArrowRight')) lx += 0.04;
  mouseDX = mouseDY = 0;
  // touch
  mx += touch.moveX; my += touch.moveY;
  lx += touch.lookX; ly += touch.lookY;
  touch.lookX = touch.lookY = 0;

  input.moveX = Math.max(-1, Math.min(1, mx));
  input.moveY = Math.max(-1, Math.min(1, my));
  input.lookX = lx; input.lookY = ly;
  const fire = mouseDown || touch.fire;
  input.fire = fire;
  input.firePressed = fire && !firePrev;
  firePrev = fire;
  input.jumpPressed = consumePressed('jump');
  input.jumpHeld = k('Space') || touch.jumpHeld;
  input.dash = consumePressed('dash');
  input.use = consumePressed('use');
  input.potion = consumePressed('potion');
  input.inventory = consumePressed('inventory');
  input.pause = consumePressed('pause');
  input.mute = consumePressed('mute');
  input.swap = consumePressed('swap');
  return input;
}

export function clearFrameInput() {
  input.weaponSlot = -1;
  input.weaponCycle = 0;
}

export function resetHeld() {
  mouseDown = false;
  touch.fire = false; touch.jumpHeld = false; touch.moveX = touch.moveY = 0;
  for (const [, t] of touches) t.el?.classList.remove('active');
  touches.clear();
  stickEls?.base && (stickEls.base.style.display = 'none');
}

// ---------------------------------------------------------------------------
// Touch
// ---------------------------------------------------------------------------
const touch = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, fire: false, jumpHeld: false };
const touches = new Map();
let stickEls = null;
const STICK_R = 56;

function initTouch() {
  const root = document.getElementById('touch');
  stickEls = { base: document.getElementById('stickBase'), knob: document.getElementById('stickKnob') };
  const isUI = (el) => el && el.closest && el.closest('.menu, .overlay, #title, #death, .no-touch-capture');

  const onStart = (e) => {
    if (!G.touch) { G.touch = true; document.body.classList.add('touch'); }
    initAudio();
    if (isUI(e.target)) return;
    if (G.mode === 'title' || G.menu) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      const btn = t.target.closest && t.target.closest('[data-btn]');
      if (btn) {
        const name = btn.dataset.btn;
        btn.classList.add('active');
        const rec = { kind: 'btn', name, el: btn, x: t.clientX, y: t.clientY };
        touches.set(t.identifier, rec);
        if (name === 'fire') touch.fire = true;
        else if (name === 'jump') { pressed.add('jump'); touch.jumpHeld = true; }
        else pressed.add(name);
        continue;
      }
      if (t.clientX < window.innerWidth * 0.42) {
        touches.set(t.identifier, { kind: 'stick', ox: t.clientX, oy: t.clientY });
        stickEls.base.style.display = 'block';
        stickEls.base.style.left = t.clientX - STICK_R + 'px';
        stickEls.base.style.top = t.clientY - STICK_R + 'px';
        stickEls.knob.style.transform = 'translate(0px,0px)';
      } else {
        touches.set(t.identifier, { kind: 'look', x: t.clientX, y: t.clientY });
      }
    }
  };
  const onMove = (e) => {
    if (isUI(e.target) && !touches.size) return;
    if (touches.size) e.preventDefault();
    for (const t of e.changedTouches) {
      const rec = touches.get(t.identifier);
      if (!rec) continue;
      if (rec.kind === 'stick') {
        let dx = t.clientX - rec.ox, dy = t.clientY - rec.oy;
        const d = Math.hypot(dx, dy);
        if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
        stickEls.knob.style.transform = `translate(${dx}px,${dy}px)`;
        const dead = 0.12;
        let nx = dx / STICK_R, ny = -dy / STICK_R;
        const m = Math.hypot(nx, ny);
        if (m < dead) { nx = ny = 0; } else { const s = Math.min(1, (m - dead) / (1 - dead)) / m; nx *= s; ny *= s; }
        touch.moveX = nx; touch.moveY = ny;
      } else if (rec.kind === 'look' || (rec.kind === 'btn' && rec.name === 'fire')) {
        // dragging on the fire button also aims
        const dx = t.clientX - rec.x, dy = t.clientY - rec.y;
        rec.x = t.clientX; rec.y = t.clientY;
        touch.lookX += dx * settings.touchSens;
        touch.lookY += dy * settings.touchSens * (settings.invertY ? -1 : 1);
      }
    }
  };
  const onEnd = (e) => {
    for (const t of e.changedTouches) {
      const rec = touches.get(t.identifier);
      if (!rec) continue;
      touches.delete(t.identifier);
      if (rec.kind === 'stick') {
        touch.moveX = touch.moveY = 0;
        stickEls.base.style.display = 'none';
      } else if (rec.kind === 'btn') {
        rec.el.classList.remove('active');
        if (rec.name === 'fire') touch.fire = false;
        if (rec.name === 'jump') touch.jumpHeld = false;
      }
    }
  };
  root.addEventListener('touchstart', onStart, { passive: false });
  // iOS only unlocks/resumes audio from touchend/click gestures
  document.addEventListener('touchend', () => initAudio(), { passive: true });
  document.addEventListener('click', () => initAudio(), { passive: true });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
  document.addEventListener('touchcancel', onEnd);
  // Block pinch-zoom & double-tap zoom in Safari
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    if (window.matchMedia('(pointer: coarse)').matches) { G.touch = true; document.body.classList.add('touch'); }
  }
}
