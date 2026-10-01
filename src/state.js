// Shared mutable game context. Modules import G and read/write fields on it.
export const G = {
  renderer: null,
  scene: null,
  camera: null,
  level: null,
  levelGroup: null,
  mode: 'title', // title | town | dungeon
  depth: 0,
  player: null,
  enemies: [],
  projectiles: [],
  pickups: [],
  props: [],
  hazards: [],
  fx: null,
  time: 0,
  paused: false,
  menu: null, // current open menu id
  save: null, // persistent profile
  touch: false,
};
