// Persistent profile in localStorage. Death never deletes anything.
import { generateItem } from './items/itemgen.js';
import { RNG } from './rng.js';
import { INV_SIZE } from './player.js';

const KEY = 'dreadful-save-v1';

export function defaultSettings() {
  return { sens: 1, pixel: 0, invertY: false, muted: false };
}

export function newSave() {
  const rng = new RNG();
  const starter = generateItem({ ilvl: 1, rng, baseId: 'crossbow', rarity: 'normal' });
  const wand = generateItem({ ilvl: 1, rng, baseId: 'wand', rarity: 'normal' });
  return {
    version: 1,
    created: Date.now(),
    bestDepth: 0,
    runDepth: 1,
    kills: 0,
    deaths: 0,
    settings: defaultSettings(),
    profile: {
      level: 1, xp: 0, gold: 60, potions: 3, activeSlot: 0,
      equip: { weapon0: starter, weapon1: wand, weapon2: null, head: null, chest: null, legs: null, ring0: null, ring1: null, ring2: null, ring3: null },
      inv: new Array(INV_SIZE).fill(null),
    },
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.profile) return null;
    s.settings = { ...defaultSettings(), ...(s.settings || {}) };
    const inv = s.profile.inv || [];
    while (inv.length < INV_SIZE) inv.push(null);
    s.profile.inv = inv;
    return s;
  } catch {
    return null;
  }
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}
