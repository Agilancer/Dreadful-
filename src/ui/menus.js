// Inventory, shops, pause/settings, death and title screens (DOM, touch friendly).
import { G } from '../state.js';
import { RNG } from '../rng.js';
import { describeItem, itemIconInfo, generateItem, potionPrice, gamblePrice, slotLabel } from '../items/itemgen.js';
import { itemIconCanvas } from '../gfx/sprites.js';
import { estimateDps, computeStats } from '../items/stats.js';
import { RARITY } from '../items/itemData.js';
import { INV_SIZE } from '../player.js';
import { sfx, setMuted, isMuted } from '../audio.js';
import { settings } from '../input.js';
import { SHOPS } from '../world/town.js';
import { spawnPickup } from '../world/entities.js';

const root = () => document.getElementById('menuRoot');
let current = null; // { id, render }
let sel = null; // { where: 'inv'|'eq'|'shop', key }

const EQ_SLOTS = ['weapon0', 'head', 'ring0', 'ring1', 'weapon1', 'chest', 'ring2', 'ring3', 'weapon2', 'legs'];
const EQ_LABEL = { weapon0: 'Wpn 1', weapon1: 'Wpn 2', weapon2: 'Wpn 3', head: 'Helm', chest: 'Body', legs: 'Legs', ring0: 'Ring', ring1: 'Ring', ring2: 'Ring', ring3: 'Ring' };

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function iconCanvas(item) {
  const info = itemIconInfo(item);
  const src = itemIconCanvas(info.icon, info.tier, info.gem);
  const c = document.createElement('canvas');
  c.width = 24; c.height = 24;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

function slotEl(item, opts = {}) {
  const d = document.createElement('div');
  d.className = 'slot' + (item ? ` r-${item.rarity}` : '') + (opts.sel ? ' sel' : '') + (opts.active ? ' active-weapon' : '');
  if (item) d.appendChild(iconCanvas(item));
  if (opts.label && !item) d.appendChild(el(`<span class="lbl">${opts.label}</span>`));
  if (opts.price != null) d.appendChild(el(`<span class="price">${opts.price}</span>`));
  if (opts.up) d.appendChild(el('<span class="up">▲</span>'));
  if (opts.onClick) d.addEventListener('click', (e) => { e.stopPropagation(); sfx('ui', 0.3); opts.onClick(); });
  return d;
}

function tipEl(item) {
  const box = document.createElement('div');
  box.className = 'tip';
  for (const l of describeItem(item)) {
    const d = document.createElement('div');
    d.textContent = l.text; d.style.color = l.color;
    if (l.big) d.className = 'big';
    box.appendChild(d);
  }
  return box;
}

export function isMenuOpen() { return !!current; }

export function closeMenu() {
  root().innerHTML = '';
  current = null;
  sel = null;
  G.menu = null;
  G.actions.menuClosed();
}

function open(id, render) {
  G.menu = id;
  current = { id, render };
  sel = null;
  render();
}
function rerender() { if (current) current.render(); }

function panel(title, right = '') {
  const m = el(`<div class="menu"><div class="panel"><div class="panelHead"><h2>${title}</h2><div style="display:flex;gap:10px;align-items:center">${right}<button class="btn small" data-close>✕</button></div></div><div class="panelBody"></div></div></div>`);
  m.querySelector('[data-close]').addEventListener('click', closeMenu);
  m.addEventListener('click', (e) => { if (e.target === m) closeMenu(); });
  root().innerHTML = '';
  root().appendChild(m);
  return m.querySelector('.panelBody');
}

// ---------------------------------------------------------------------------
// Inventory helpers
// ---------------------------------------------------------------------------
function prof() { return G.player.profile; }

function firstFree() {
  const inv = prof().inv;
  for (let i = 0; i < INV_SIZE; i++) if (!inv[i]) return i;
  return -1;
}

function equipFromInv(invIdx, slotKey) {
  const p = prof();
  const item = p.inv[invIdx];
  if (!item) return;
  const prev = p.equip[slotKey] || null;
  p.equip[slotKey] = item;
  p.inv[invIdx] = prev;
  if (slotKey.startsWith('weapon')) p.activeSlot = Number(slotKey.slice(6));
  G.player.recompute();
  sfx('switch', 0.5);
  sel = { where: 'eq', key: slotKey };
  G.saveSoon();
}

function unequip(slotKey) {
  const p = prof();
  const f = firstFree();
  if (f < 0) { G.ui.log('Inventory full!', '#ff6060'); sfx('error'); return; }
  p.inv[f] = p.equip[slotKey];
  p.equip[slotKey] = null;
  G.player.recompute();
  sel = { where: 'inv', key: f };
  G.saveSoon();
}

function defaultSlotFor(item) {
  const p = prof();
  if (item.slot === 'weapon') {
    for (let i = 0; i < 3; i++) if (!p.equip['weapon' + i]) return 'weapon' + i;
    return 'weapon' + p.activeSlot;
  }
  if (item.slot === 'ring') {
    for (let i = 0; i < 4; i++) if (!p.equip['ring' + i]) return 'ring' + i;
    return 'ring0';
  }
  return item.slot;
}

function comparison(item) {
  const p = G.player;
  const box = document.createElement('div');
  box.className = 'compare';
  if (item.slot === 'weapon') {
    const cur = p.activeWeapon();
    const dps = estimateDps(item, p.stats);
    if (!cur) { box.innerHTML = `≈ ${dps} DPS`; return box; }
    const cdps = estimateDps(cur, p.stats);
    const diff = dps - cdps;
    box.innerHTML = `≈ ${dps} DPS <span class="${diff >= 0 ? 'pos' : 'neg'}">(${diff >= 0 ? '+' : ''}${diff} vs equipped)</span>`;
  } else if (item.slot !== 'ring') {
    const cur = p.equip[item.slot];
    const test = { ...p.equip, [item.slot]: item };
    const ns = computeStats({ level: p.level, equip: test, buffs: p.buffs });
    const da = ns.armor - p.stats.armor, dl = ns.maxHp - p.stats.maxHp;
    if (cur || da || dl) box.innerHTML = `If equipped: Armor <span class="${da >= 0 ? 'pos' : 'neg'}">${da >= 0 ? '+' : ''}${da}</span> · Life <span class="${dl >= 0 ? 'pos' : 'neg'}">${dl >= 0 ? '+' : ''}${dl}</span>`;
  }
  return box;
}

function isUpgrade(item) {
  const p = G.player;
  if (!item) return false;
  if (item.slot === 'weapon') { const cur = p.activeWeapon(); return !cur || estimateDps(item, p.stats) > estimateDps(cur, p.stats); }
  if (item.slot === 'ring') return [0, 1, 2, 3].some((i) => !p.equip['ring' + i]);
  const cur = p.equip[item.slot];
  return !cur || (item.armor || 0) + (item.mods.life || 0) > (cur.armor || 0) + (cur.mods.life || 0);
}

function statsBlock() {
  const p = G.player, s = p.stats;
  const w = p.activeWeapon();
  const dps = w ? estimateDps(w, s) : 0;
  const lines = [
    `Level <b>${p.level}</b> · Gold <b class="gold">${p.gold.toLocaleString()}</b>`,
    `Life <b>${Math.ceil(p.hp)}/${s.maxHp}</b> · Armor <b>${s.armor}</b>`,
    `Damage <b>+${s.pctDmg}%</b> · Crit <b>${s.crit}%</b> (+${s.critDmg}%)`,
    `Weapon DPS <b>≈${dps}</b>`,
    `Res: <span style="color:#ff7a2a">F ${s.res.fire}</span> <span style="color:#7ccfff">C ${s.res.cold}</span> <span style="color:#fff27a">L ${s.res.lightning}</span> <span style="color:#70ff50">P ${s.res.poison}</span>`,
  ];
  const abil = [];
  if (s.extraJumps) abil.push(`${s.extraJumps + 1}x Jump`);
  if (s.dash) abil.push(`Dash x${s.dash}`);
  if (s.glide) abil.push('Glide');
  if (s.stomp) abil.push('Quake');
  if (s.dashNova) abil.push('Thunder Steps');
  if (s.moveSpeed) abil.push(`+${s.moveSpeed}% Speed`);
  if (s.lifeSteal) abil.push(`${s.lifeSteal}% Leech`);
  if (s.lifeRegen > 1) abil.push(`${s.lifeRegen.toFixed(1)} Regen`);
  if (s.magicFind) abil.push(`${s.magicFind}% MF`);
  if (s.goldFind) abil.push(`${s.goldFind}% GF`);
  if (abil.length) lines.push(`<span style="color:#9fd8ff">${abil.join(' · ')}</span>`);
  lines.push(`Potions <b>${p.profile.potions}</b> · Deepest <b>${G.save.bestDepth}</b>`);
  return el(`<div class="stats">${lines.join('<br>')}</div>`);
}

// ---------------------------------------------------------------------------
// Inventory screen (optionally in "sell" mode from a shop)
// ---------------------------------------------------------------------------
export function openInventory() {
  open('inventory', renderInventory);
}

function renderInventory() {
  const body = panel('Inventory', `<span class="gold">${G.player.gold.toLocaleString()} g</span>`);
  const p = prof();
  const left = el('<div class="col scroll" style="flex:0 0 auto"></div>');
  const doll = el('<div class="doll"></div>');
  for (const k of EQ_SLOTS) {
    const it = p.equip[k];
    doll.appendChild(slotEl(it, {
      label: EQ_LABEL[k], sel: sel?.where === 'eq' && sel.key === k, active: k === 'weapon' + p.activeSlot && !!it,
      onClick: () => {
        if (sel?.where === 'inv' && canGo(p.inv[sel.key], k)) equipFromInv(sel.key, k);
        else sel = it ? { where: 'eq', key: k } : null;
        rerender();
      },
    }));
  }
  // potion slot display
  const pot = el(`<div class="slot" style="color:#ff6060;font-size:22px">♥${p.potions}</div>`);
  doll.appendChild(pot);
  left.appendChild(doll);
  left.appendChild(statsBlock());
  body.appendChild(left);

  const mid = el('<div class="col scroll" style="flex:0 0 auto"></div>');
  const grid = el('<div class="grid"></div>');
  for (let i = 0; i < INV_SIZE; i++) {
    const it = p.inv[i];
    grid.appendChild(slotEl(it, {
      sel: sel?.where === 'inv' && sel.key === i, up: it && isUpgrade(it),
      onClick: () => {
        if (!it && sel?.where === 'eq') { unequipTo(sel.key, i); }
        else sel = it ? { where: 'inv', key: i } : null;
        rerender();
      },
    }));
  }
  mid.appendChild(grid);
  body.appendChild(mid);

  const right = el('<div class="col detail scroll"></div>');
  body.appendChild(right);
  renderDetail(right, false);
}

function canGo(item, slotKey) {
  if (!item) return false;
  return slotKey.replace(/\d/, '') === item.slot;
}

function unequipTo(slotKey, invIdx) {
  const p = prof();
  if (p.inv[invIdx]) return;
  p.inv[invIdx] = p.equip[slotKey];
  p.equip[slotKey] = null;
  G.player.recompute();
  sel = { where: 'inv', key: invIdx };
  G.saveSoon();
}

function renderDetail(box, shopMode, shopId) {
  box.innerHTML = '';
  const p = prof();
  if (!sel) {
    box.appendChild(el(`<div class="helpText">${G.touch ? 'Tap' : 'Click'} an item to inspect it.<br><br>Items marked <span style="color:#40ff40">▲</span> are upgrades.<br>Tap an equipped item, then an empty bag slot to unequip.${shopMode ? '<br><br>Select items in your bag to sell them.' : ''}</div>`));
    return;
  }
  const item = sel.where === 'inv' ? p.inv[sel.key] : p.equip[sel.key];
  if (!item) { sel = null; return renderDetail(box, shopMode, shopId); }
  box.appendChild(tipEl(item));
  if (sel.where === 'inv') box.appendChild(comparison(item));
  const acts = el('<div class="actions"></div>');
  const btn = (txt, fn, cls = '') => { const b = el(`<button class="btn small ${cls}">${txt}</button>`); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); rerender(); }); acts.appendChild(b); return b; };
  if (sel.where === 'inv') {
    const idx = sel.key;
    if (item.slot === 'weapon') for (let i = 0; i < 3; i++) btn(`Equip ${i + 1}${p.equip['weapon' + i] ? '' : ' (empty)'}`, () => equipFromInv(idx, 'weapon' + i));
    else if (item.slot === 'ring') for (let i = 0; i < 4; i++) btn(`Ring ${i + 1}${p.equip['ring' + i] ? '' : ' (empty)'}`, () => equipFromInv(idx, 'ring' + i));
    else btn('Equip', () => equipFromInv(idx, item.slot));
    if (shopMode) {
      btn(`Sell +${sellPrice(item)}g`, () => { sellItem(idx); }, 'danger');
    } else if (G.mode === 'dungeon') {
      btn('Drop', () => { p.inv[idx] = null; const pk = spawnPickup('item', G.player.pos.x, G.player.pos.y, G.player.pos.z, { item }); pk.refused = 3; sel = null; G.saveSoon(); });
    } else {
      btn('Discard', () => { if (confirmTwice('discard' + item.uid)) { p.inv[idx] = null; sel = null; G.saveSoon(); } }, 'danger');
    }
  } else {
    if (sel.key.startsWith('weapon') && p.activeSlot !== Number(sel.key.slice(6))) btn('Make Active', () => { G.player.switchWeapon(Number(sel.key.slice(6))); });
    btn('Unequip', () => unequip(sel.key));
  }
  box.appendChild(acts);
}

const confirmState = {};
function confirmTwice(key) {
  const now = performance.now();
  if (confirmState[key] && now - confirmState[key] < 2500) return true;
  confirmState[key] = now;
  G.ui.log('Press again to confirm', '#ffb060');
  return false;
}

// ---------------------------------------------------------------------------
// Shops
// ---------------------------------------------------------------------------
export function sellPrice(item) { return Math.max(1, Math.round(item.value * 0.25)); }
function buyPrice(item) { return Math.round(item.value * 1.1); }

function sellItem(idx) {
  const p = prof();
  const item = p.inv[idx];
  if (!item) return;
  p.gold += sellPrice(item);
  p.inv[idx] = null;
  sel = null;
  sfx('buy', 0.5);
  G.saveSoon();
}

export function generateShopStock() {
  const ilvl = Math.max(1, G.save.bestDepth);
  const rng = new RNG();
  const mk = (slot, n) => {
    const arr = [];
    for (let i = 0; i < n; i++) {
      const r = rng.next();
      const rarity = slot === 'ring' ? (r < 0.8 ? 'magic' : 'rare') : r < 0.25 ? 'normal' : r < 0.85 ? 'magic' : 'rare';
      arr.push(generateItem({ ilvl: Math.max(1, ilvl - rng.int(0, 2)), rng, slot, rarity }));
    }
    return arr;
  };
  G.shopStock = {
    smith: mk('weapon', 14),
    armorer: [...mk('head', 4), ...mk('chest', 4), ...mk('legs', 4)],
    jeweler: mk('ring', 10),
  };
}

export function openShop(id) {
  open('shop', () => renderShop(id));
}

let shopTab = 'buy';
function renderShop(id) {
  const shop = SHOPS[id];
  const body = panel(shop.name, `<span class="gold">${G.player.gold.toLocaleString()} g</span>`);
  if (id === 'alchemist') return renderAlchemist(body);
  if (id === 'gambler') return renderGambler(body);
  const tabs = el('<div class="tabs"></div>');
  for (const t of ['buy', 'sell']) {
    const b = el(`<button class="btn small ${shopTab === t ? 'on' : ''}">${t === 'buy' ? 'Buy' : 'Sell'}</button>`);
    b.addEventListener('click', () => { shopTab = t; sel = null; rerender(); });
    tabs.appendChild(b);
  }
  const left = el('<div class="col scroll" style="flex:1"></div>');
  left.appendChild(tabs);
  const right = el('<div class="col detail scroll"></div>');
  if (shopTab === 'buy') {
    const list = el('<div class="shopList"></div>');
    const stock = G.shopStock[id] || [];
    stock.forEach((it, i) => {
      if (!it) return;
      list.appendChild(slotEl(it, { price: buyPrice(it), sel: sel?.where === 'shop' && sel.key === i, up: isUpgrade(it), onClick: () => { sel = { where: 'shop', key: i }; rerender(); } }));
    });
    left.appendChild(list);
    if (sel?.where === 'shop' && stock[sel.key]) {
      const it = stock[sel.key];
      right.appendChild(tipEl(it));
      right.appendChild(comparison(it));
      const price = buyPrice(it);
      const b = el(`<button class="btn small" ${G.player.gold < price ? 'disabled' : ''}>Buy for ${price}g</button>`);
      b.addEventListener('click', () => {
        if (G.player.gold < price) { sfx('error'); return; }
        const f = firstFree();
        if (f < 0) { G.ui.log('Inventory full!', '#ff6060'); sfx('error'); return; }
        G.player.gold -= price;
        prof().inv[f] = it;
        stock[sel.key] = null;
        sel = { where: 'inv', key: f };
        sfx('buy', 0.6);
        G.saveSoon();
        shopTab = 'buy';
        rerender();
      });
      right.appendChild(el('<div class="actions"></div>')).appendChild(b);
    } else right.appendChild(el(`<div class="helpText">"${greeting(id)}"<br><br>Stock is refreshed every time you return to town and scales with the deepest floor you have reached (<b>${G.save.bestDepth}</b>).</div>`));
  } else {
    const grid = el('<div class="grid"></div>');
    const p = prof();
    for (let i = 0; i < INV_SIZE; i++) {
      const it = p.inv[i];
      grid.appendChild(slotEl(it, { sel: sel?.where === 'inv' && sel.key === i, price: it ? sellPrice(it) : null, onClick: () => { sel = it ? { where: 'inv', key: i } : null; rerender(); } }));
    }
    left.appendChild(grid);
    const junk = el('<button class="btn small" style="margin-top:6px">Sell all Normal & Magic</button>');
    junk.addEventListener('click', () => {
      let total = 0;
      p.inv.forEach((it, i) => { if (it && (it.rarity === 'normal' || it.rarity === 'magic')) { total += sellPrice(it); p.inv[i] = null; } });
      if (total) { p.gold += total; sfx('buy', 0.6); G.ui.log(`Sold junk for ${total} gold`, '#d4b030'); G.saveSoon(); }
      sel = null; rerender();
    });
    left.appendChild(junk);
    renderDetail(right, true, id);
  }
  body.appendChild(left);
  body.appendChild(right);
}

function greeting(id) {
  return {
    smith: 'Steel and string, friend. The deeper you go, the better I can make them.',
    armorer: 'Plate, mail and leather. Keeps the claws out — mostly.',
    jeweler: 'Rings of power... leaping, dashing, swiftness. Choose wisely.',
  }[id] || 'Welcome.';
}

function renderAlchemist(body) {
  const p = prof();
  const price = potionPrice(G.save.bestDepth);
  const box = el(`<div class="col" style="flex:1"><div class="helpText">"Healing draughts, brewed from cave-moss and prayer. Each restores half your life."<br><br>You carry <b>${p.potions}</b> / 10 potions.</div><div class="actions"></div></div>`);
  const acts = box.querySelector('.actions');
  for (const n of [1, 5]) {
    const cost = price * n;
    const b = el(`<button class="btn small" ${p.gold < cost || p.potions + n > 10 ? 'disabled' : ''}>Buy ${n} (${cost}g)</button>`);
    b.addEventListener('click', () => {
      if (p.gold < cost || p.potions + n > 10) { sfx('error'); return; }
      p.gold -= cost; p.potions += n; sfx('buy', 0.6); G.saveSoon(); rerender();
    });
    acts.appendChild(b);
  }
  const fill = Math.max(0, 10 - p.potions);
  if (fill > 1) {
    const cost = price * fill;
    const b = el(`<button class="btn small" ${p.gold < cost ? 'disabled' : ''}>Fill Belt (${cost}g)</button>`);
    b.addEventListener('click', () => { if (p.gold < cost) return; p.gold -= cost; p.potions = 10; sfx('buy', 0.6); G.saveSoon(); rerender(); });
    acts.appendChild(b);
  }
  body.appendChild(box);
  body.appendChild(statsBlock());
}

function renderGambler(body) {
  const p = prof();
  const box = el(`<div class="col" style="flex:1"><div class="helpText">"Care for a wager? Pay me, and take a mystery item. Could be junk... could be <span style="color:#c8a060">legendary</span>."<br><br>Gambled items roll with much better odds of Rare and Unique quality.</div><div class="actions"></div><div class="gres"></div></div>`);
  const acts = box.querySelector('.actions');
  for (const slot of ['weapon', 'head', 'chest', 'legs', 'ring']) {
    const cost = gamblePrice(slot, G.save.bestDepth);
    const b = el(`<button class="btn small" ${p.gold < cost ? 'disabled' : ''}>${slotLabel(slot)} (${cost}g)</button>`);
    b.addEventListener('click', () => {
      if (p.gold < cost) { sfx('error'); return; }
      const f = firstFree();
      if (f < 0) { G.ui.log('Inventory full!', '#ff6060'); sfx('error'); return; }
      p.gold -= cost;
      const rng = new RNG();
      const item = generateItem({ ilvl: G.save.bestDepth + rng.int(0, 3), rng, slot, bonus: 2.5, mf: 50, rarity: rng.chance(0.25) ? undefined : 'magic' });
      p.inv[f] = item;
      sel = { where: 'inv', key: f };
      sfx(item.rarity === 'unique' ? 'uniqueDrop' : item.rarity === 'rare' ? 'rareDrop' : 'buy', 0.7);
      G.saveSoon();
      rerender();
      const res = document.querySelector('.gres');
      if (res) { res.innerHTML = ''; res.appendChild(tipEl(item)); }
    });
    acts.appendChild(b);
  }
  body.appendChild(box);
  const right = el('<div class="col detail scroll"></div>');
  if (sel?.where === 'inv' && p.inv[sel.key]) right.appendChild(tipEl(p.inv[sel.key]));
  body.appendChild(right);
}

// ---------------------------------------------------------------------------
// Pause / settings / help
// ---------------------------------------------------------------------------
export function openPause() {
  open('pause', renderPause);
}

function renderPause() {
  const body = panel('Paused');
  const col = el('<div class="col scroll" style="flex:1;align-items:flex-start"></div>');
  const addBtn = (txt, fn, cls = '') => { const b = el(`<button class="btn ${cls}">${txt}</button>`); b.addEventListener('click', fn); col.appendChild(b); };
  addBtn('Resume', closeMenu);
  addBtn('Inventory', () => { closeMenu(); openInventory(); });
  const sens = el(`<div class="settingRow">Look Sensitivity <input type="range" min="0.3" max="3" step="0.1" value="${G.save.settings.sens}"></div>`);
  sens.querySelector('input').addEventListener('input', (e) => { G.save.settings.sens = Number(e.target.value); applySettings(); G.saveSoon(); });
  col.appendChild(sens);
  const res = el(`<div class="settingRow">Pixel Size <input type="range" min="1" max="6" step="1" value="${G.save.settings.pixel}"></div>`);
  res.querySelector('input').addEventListener('input', (e) => { G.save.settings.pixel = Number(e.target.value); G.actions.resize(); G.saveSoon(); });
  col.appendChild(res);
  const inv = el(`<label class="settingRow"><input type="checkbox" ${G.save.settings.invertY ? 'checked' : ''}> Invert Look Y</label>`);
  inv.querySelector('input').addEventListener('change', (e) => { G.save.settings.invertY = e.target.checked; applySettings(); G.saveSoon(); });
  col.appendChild(inv);
  const mute = el(`<label class="settingRow"><input type="checkbox" ${isMuted() ? 'checked' : ''}> Mute Sound</label>`);
  mute.querySelector('input').addEventListener('change', (e) => { G.save.settings.muted = e.target.checked; setMuted(e.target.checked); G.saveSoon(); });
  col.appendChild(mute);
  addBtn('Save & Quit to Title', () => { G.saveNow(); closeMenu(); G.actions.toTitle(); }, 'danger');
  body.appendChild(col);
  body.appendChild(el(`<div class="col scroll helpText" style="flex:1.3">${helpHtml()}</div>`));
}

export function applySettings() {
  const s = G.save.settings;
  settings.mouseSens = 0.0022 * s.sens;
  settings.touchSens = 0.0065 * s.sens;
  settings.invertY = !!s.invertY;
  setMuted(!!s.muted);
}

export function helpHtml() {
  return `<b>Goal:</b> Delve ever deeper. Each floor has an entrance portal and stairs leading down. Deeper floors bring deadlier monsters — and far better loot. There is no bottom.<br><br>
  <b>Death</b> costs you nothing but your descent: you wake in Hollowmere with all your gear and gold, and the dungeon reshapes itself.<br><br>
  <b>Desktop:</b> WASD move · Mouse aim · Click fire · Space jump · Shift / Right-click dash · E use · Q potion · I / Tab inventory · 1-3 / wheel swap weapon · Esc pause<br><br>
  <b>Touch:</b> Left thumb moves · Drag right side to look · Hold FIRE (drag it to aim while firing) · JUMP · DASH · USE appears near chests, stairs and shopkeepers · ♥ potion · ⇄ swap weapon · BAG inventory<br><br>
  <b>Rings</b> grant powers: double jump, dash, glide, quakes, speed. Some chests sit on ledges only reachable with extra jumps.<br><br>
  <b>Loot colors:</b> <span style="color:#d8d8d8">Normal</span> · <span style="color:#6f8cff">Magic</span> · <span style="color:#ffe060">Rare</span> · <span style="color:#c8a060">Unique</span>`;
}

// ---------------------------------------------------------------------------
// Death
// ---------------------------------------------------------------------------
export function openDeath(depth) {
  open('death', () => {
    root().innerHTML = '';
    const m = el(`<div class="menu" style="background:rgba(40,0,0,0.55)"><div style="text-align:center">
      <div style="font-family:'Pirata One',serif;font-size:min(14vw,90px);color:#c02818;text-shadow:4px 4px 0 #000">YOU HAVE PERISHED</div>
      <div style="font-size:24px;margin-bottom:14px">Slain on depth ${depth}. Your belongings are safe — the dungeon will reshape itself.</div>
      <button class="btn">Return to Hollowmere</button></div></div>`);
    m.querySelector('button').addEventListener('click', () => { closeMenu(); G.actions.respawnInTown(); });
    root().appendChild(m);
  });
}

// ---------------------------------------------------------------------------
// Title screen
// ---------------------------------------------------------------------------
export function showTitle(hasSave, onContinue, onNew) {
  const t = document.getElementById('title');
  t.classList.remove('hidden');
  const b = document.getElementById('titleButtons');
  b.innerHTML = '';
  if (hasSave) {
    const c = el('<button class="btn">Continue</button>');
    c.addEventListener('click', onContinue);
    b.appendChild(c);
  }
  const n = el(`<button class="btn ${hasSave ? 'danger' : ''}">New Game</button>`);
  let armed = false;
  n.addEventListener('click', () => {
    if (hasSave && !armed) { armed = true; n.textContent = 'Erase save? Tap again'; return; }
    onNew();
  });
  b.appendChild(n);
  document.getElementById('titleHelp').innerHTML = G.touch
    ? 'Best played in landscape. Tip: on iPhone, use Share → Add to Home Screen for full-screen play.'
    : 'WASD + Mouse · Click to fire · Space jump · E use · I inventory';
}
export function hideTitle() { document.getElementById('title').classList.add('hidden'); }

void RARITY;
