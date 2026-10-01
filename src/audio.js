// Fully synthesized retro sound effects (WebAudio), no audio files needed.
let ctx = null, master = null, noiseBuf = null;
const last = {};
let muted = false;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp); comp.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // iOS unlock: play a silent buffer
  const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(master); s.start(0);
}

export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; }
export function isMuted() { return muted; }

function env(g, t, a, peak, dcy) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
}

function tone(type, f0, f1, dur, vol, delay = 0) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, 0.005, vol, dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur, vol, filt = 'lowpass', f0 = 2000, f1 = 200, q = 1, delay = 0) {
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = filt; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = ctx.createGain();
  env(g, t, 0.003, vol, dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

const R = () => 0.9 + Math.random() * 0.2;

const SOUNDS = {
  twang: (v) => { tone('triangle', 520 * R(), 180, 0.12, v * 0.5); noise(0.08, v * 0.4, 'highpass', 3000, 1500); },
  click: (v) => { tone('square', 900 * R(), 300, 0.04, v * 0.25); noise(0.04, v * 0.3, 'bandpass', 2500, 1200, 3); },
  zap: (v) => { tone('sawtooth', 1400 * R(), 300, 0.12, v * 0.25); tone('sine', 700, 1400, 0.1, v * 0.2); },
  zap2: (v) => { noise(0.18, v * 0.5, 'bandpass', 4000, 800, 4); tone('square', 120 * R(), 60, 0.15, v * 0.25); },
  whoosh: (v) => { noise(0.25, v * 0.5, 'bandpass', 400, 1600, 2); tone('sine', 200, 90, 0.25, v * 0.3); },
  flame: (v) => { noise(0.12, v * 0.35, 'lowpass', 1500 * R(), 400); },
  shard: (v) => { tone('triangle', 1800 * R(), 2400, 0.08, v * 0.25); noise(0.1, v * 0.3, 'highpass', 5000, 3000); },
  boom: (v) => { noise(0.35, v * 0.9, 'lowpass', 1800, 80); tone('sine', 140 * R(), 40, 0.3, v * 0.7); },
  moan: (v) => { tone('sawtooth', 220 * R(), 110, 0.35, v * 0.2); tone('sine', 330, 165, 0.35, v * 0.2); },
  horn: (v) => { tone('sawtooth', 110, 105, 0.45, v * 0.35); tone('square', 165, 160, 0.45, v * 0.15); },
  void: (v) => { tone('sine', 90, 40, 0.6, v * 0.6); noise(0.5, v * 0.3, 'lowpass', 300, 60); },
  splat: (v) => { noise(0.15, v * 0.5, 'lowpass', 900, 200); tone('sine', 300, 100, 0.12, v * 0.3); },
  explode: (v) => { noise(0.6, v * 1.0, 'lowpass', 2500, 60); tone('sine', 90 * R(), 30, 0.5, v * 0.8); },
  hit: (v) => { noise(0.08, v * 0.6, 'lowpass', 1200, 300); tone('square', 150, 80, 0.08, v * 0.3); },
  hurt: (v) => { tone('sawtooth', 220 * R(), 110, 0.18, v * 0.4); noise(0.12, v * 0.4, 'lowpass', 1500, 400); },
  death: (v) => { tone('sawtooth', 300, 40, 1.4, v * 0.5); noise(1.0, v * 0.5, 'lowpass', 1000, 60); },
  die: (v) => { tone('sawtooth', 260 * R(), 60, 0.45, v * 0.35); noise(0.3, v * 0.35, 'lowpass', 900, 100); },
  squish: (v) => { noise(0.25, v * 0.5, 'lowpass', 700, 100); tone('sine', 200 * R(), 50, 0.25, v * 0.35); },
  growl: (v) => { tone('sawtooth', 80 * R(), 60, 0.5, v * 0.3); noise(0.4, v * 0.2, 'lowpass', 400, 100); },
  roar: (v) => { tone('sawtooth', 120 * R(), 70, 0.6, v * 0.4); noise(0.5, v * 0.3, 'bandpass', 600, 300, 2); },
  enemyShoot: (v) => { tone('square', 600 * R(), 200, 0.15, v * 0.2); },
  fuse: (v) => { for (let i = 0; i < 4; i++) tone('square', 900, 900, 0.05, v * 0.2, i * 0.13); },
  blink: (v) => { tone('sine', 300, 1600, 0.2, v * 0.3); },
  summon: (v) => { tone('triangle', 200, 600, 0.4, v * 0.3); tone('triangle', 300, 900, 0.4, v * 0.2, 0.05); },
  nova: (v) => { noise(0.4, v * 0.5, 'highpass', 2000, 6000); tone('sine', 800, 200, 0.4, v * 0.2); },
  slam: (v) => { tone('sine', 70, 30, 0.5, v * 0.9); noise(0.4, v * 0.6, 'lowpass', 600, 50); },
  pickup: (v) => { tone('square', 660, 660, 0.06, v * 0.2); tone('square', 990, 990, 0.08, v * 0.2, 0.06); },
  gold: (v) => { tone('triangle', 1800 * R(), 1800, 0.05, v * 0.25); tone('triangle', 2400, 2400, 0.07, v * 0.2, 0.04); },
  orb: (v) => { tone('sine', 400, 800, 0.2, v * 0.3); },
  potion: (v) => { for (let i = 0; i < 4; i++) tone('sine', 300 + i * 80, 350 + i * 80, 0.08, v * 0.25, i * 0.07); },
  chest: (v) => { noise(0.3, v * 0.4, 'lowpass', 600, 200); tone('square', 220, 110, 0.2, v * 0.2); tone('triangle', 880, 1320, 0.3, v * 0.2, 0.15); },
  shrine: (v) => { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.3, v * 0.25, i * 0.08)); },
  levelup: (v) => { [392, 523, 659, 784, 1046].forEach((f, i) => tone('square', f, f, 0.18, v * 0.18, i * 0.09)); },
  rareDrop: (v) => { tone('triangle', 1200, 1200, 0.15, v * 0.25); tone('triangle', 1600, 1600, 0.2, v * 0.2, 0.1); },
  uniqueDrop: (v) => { [784, 988, 1175, 1568].forEach((f, i) => tone('triangle', f, f, 0.35, v * 0.25, i * 0.1)); },
  jump: (v) => { tone('square', 200, 400, 0.08, v * 0.15); },
  jump2: (v) => { tone('square', 300, 700, 0.1, v * 0.18); noise(0.1, v * 0.2, 'highpass', 3000, 6000); },
  land: (v) => { noise(0.1, v * 0.4, 'lowpass', 500, 100); },
  dash: (v) => { noise(0.2, v * 0.5, 'bandpass', 800, 3000, 1.5); },
  step: (v) => { noise(0.05, v * 0.5, 'lowpass', 400 * R(), 100); },
  switch: (v) => { tone('square', 300, 300, 0.04, v * 0.2); tone('square', 450, 450, 0.04, v * 0.2, 0.05); },
  buy: (v) => { tone('triangle', 1500, 1500, 0.06, v * 0.3); tone('triangle', 2000, 2000, 0.1, v * 0.3, 0.06); },
  ui: (v) => { tone('square', 700, 700, 0.03, v * 0.15); },
  portal: (v) => { tone('sine', 200, 900, 0.8, v * 0.4); noise(0.8, v * 0.2, 'bandpass', 500, 2000, 3); },
  error: (v) => { tone('square', 150, 150, 0.12, v * 0.25); },
};

export function sfx(name, vol = 0.5) {
  if (!ctx || muted) return;
  const now = performance.now();
  if (last[name] && now - last[name] < 45) return;
  last[name] = now;
  const f = SOUNDS[name];
  if (f) try { f(vol); } catch { /* ignore audio errors */ }
}

// Ambient drone
let drone = null;
export function setAmbience(kind) {
  if (!ctx) return;
  if (drone) { try { drone.forEach((n) => n.stop()); } catch { /* */ } drone = null; }
  if (kind === 'none') return;
  const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
  g.gain.linearRampToValueAtTime(kind === 'town' ? 0.05 : 0.07, ctx.currentTime + 2);
  const base = kind === 'town' ? 110 : 55;
  const nodes = [];
  for (const [mult, type] of [[1, 'sine'], [1.5, 'triangle'], [2.01, 'sine']]) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = base * mult;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.1;
    const lg = ctx.createGain(); lg.gain.value = base * 0.01;
    lfo.connect(lg); lg.connect(o.frequency);
    o.connect(g); o.start(); lfo.start();
    nodes.push(o, lfo);
  }
  drone = nodes;
}
