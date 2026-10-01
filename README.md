# Dreadful

A retro, Hexen-style first-person looter-shooter with Diablo II-style dungeon generation and itemization. It runs in any modern browser, including **iOS Safari in landscape with touch controls**.

Every texture, sprite, monster, weapon model and sound is generated procedurally at runtime, so the game ships with no image or audio assets.

## Play

There is no build step. Serve the folder with any static file server:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

It also works as-is on GitHub Pages or any other static host.

On iPhone, open the page in Safari and rotate to landscape. For full-screen play, use **Share → Add to Home Screen**.

## The game

- **Hollowmere (the town).** Five shops sit around the plaza:
  - Garrick sells weapons.
  - Hilde sells armor.
  - Orsolya sells rings.
  - Brother Wendel sells healing potions.
  - Mad Tobias runs a gambling stall that pays out mystery items with boosted rare and unique odds.

  Shop stock is refreshed on every visit and scales with the deepest floor you have reached.
- **The dungeon.** Every floor is procedurally generated, Diablo style: rooms are joined by a minimum spanning tree of corridors, with extra loops. Each floor has an entrance portal (back to town) and stairs down. The floors cycle through six themes: Crypt, Caverns, Sunken Temple, Inferno, Frozen Depths and Void. Floors also contain:
  - raised platforms, some with stairs and some reachable only with extra jumps, often holding ornate chests;
  - pillar halls;
  - torch-lit rooms;
  - shrines that grant timed buffs.
- **Endless.** Monster health and damage, item level and loot power keep scaling with depth forever.
- **Death.** You keep everything: gear, gold, levels and potions. You wake in town, your descent resets to depth 1, and the dungeon reshapes itself. If you leave through a portal instead of dying, you can resume at your current depth.
- **Leveling.** XP raises your level. Each level gives +12 max life and +5% damage.

### Monsters

There are 100 monster types: 20 families with 5 variants each. Each family has its own AI:

- melee swarms
- archers and casters that keep their distance
- leaping spiders
- charging knights and hounds
- swooping bats and gargoyles
- teleporting wraiths
- splitting slimes
- exploding zealots
- summoning necromancers
- nova-casting liches
- ground-slamming golems

Floors can also spawn D2-style **champion packs** and **unique monsters** with random modifiers: Extra Fast, Stone Skin, Fire/Cold/Lightning Enchanted, Teleportation, Multiple Shots, Vampiric and Cursed.

### Items

- **Rarities:** Normal, Magic (1–2 affixes), Rare (3–6 affixes, random names) and Unique (29 hand-designed items).
- **Weapons:** 16 weapon families × 3 tiers, each with its own projectile. The families include crossbows, repeaters, longbows, wands, battle staves, flame gauntlets, frost tomes, storm rods, blunderbusses, hand cannons, chakrams, skull censers, war horns, void orbs, spear throwers and venom slings.
- **Affixes:** about 60 prefixes and suffixes in tiers gated by item level. Projectile behaviours combine with each other: homing, piercing, wall ricochet, splitting, chain lightning, explosions, cluster bomblets, novas, boomerangs, serpentine weaving, spirals, swelling, meteors, recursive fractal splitting, and "Chaos" (random element and behaviour on every shot).
- **Armor:** head, chest and legs. They grant armor, life, resistances, regeneration, thorns and more.
- **Rings (4 slots):** grant abilities such as double or triple jump, dash (with charges), glide, landing quakes, Thunder Steps (lightning when you dash), move speed, life steal, magic find and gold find.

## Controls

**Desktop**

| Action | Keys |
|---|---|
| Move | WASD |
| Aim | Mouse (click the game to capture it) |
| Fire | Left click |
| Jump (press again in the air for extra jumps) | Space |
| Dash | Shift / right click |
| Use (chests, stairs, portals, shopkeepers) | E |
| Drink a potion | Q |
| Inventory | I / Tab |
| Switch weapon | 1–3 / mouse wheel |
| Pause and settings | Esc |
| Mute | M |

**Touch (iOS / Android, landscape)**

- **Left thumb:** floating move stick.
- **Right side:** drag to look.
- **FIRE:** hold to shoot. You can drag on it to aim while firing, and gentle aim assist helps.
- **JUMP / DASH:** DASH appears once a ring grants it.
- **USE / TALK:** appears near anything you can interact with.
- **♥:** drink a potion.
- **⇄:** swap weapon.
- **BAG:** inventory.
- **II:** pause and settings.

In the inventory, tap an item to inspect it and compare it with what you have equipped, then tap **Equip**. Items marked ▲ are upgrades.

## Tech

- [three.js](https://threejs.org/) r186 is vendored in `lib/` and loaded through an import map.
- Rendering uses low internal resolution with nearest-neighbour upscaling. Custom shaders give banded "sector" lighting, baked torch light flood-filled through the tile grid, up to 8 dynamic lights for projectiles and explosions, stepped fog, and cylindrical billboards for sprites.
- Monsters path-find with a flow field toward the player.
- Progress is saved to `localStorage`.

```
src/
  main.js            boot, loop, town/dungeon flow
  player.js          movement, jumps/dash/glide, weapons, damage, XP
  input.js           keyboard/mouse + touch controls
  audio.js           synthesized sound effects
  fx.js              particles, dynamic lights, lightning arcs
  world/             level geometry & collision, dungeon + town generators, props & loot
  combat/            100 enemy types, monster AI, projectile behaviours
  items/             bases, affixes, uniques, generation, stat aggregation
  gfx/               procedural textures, pixel-art sprites, retro shaders
  ui/                HUD, view models, inventory/shop/pause menus
```
