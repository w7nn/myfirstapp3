// All tuning numbers live here so the game can be balanced without touching logic.

// Logical canvas size (portrait); Phaser scales it to fit the screen.
export const VIEW = { width: 720, height: 1280 };

// The bridge the squad runs along. Everything happens between these edges.
export const ROAD = { left: 120, right: 600 };
export const ROAD_CENTER = (ROAD.left + ROAD.right) / 2;

// How fast the world scrolls toward the squad, in px/s.
export const SCROLL_SPEED = 160;

export const SQUAD = {
  y: 1040, // where the squad stands
  startCount: 6,
  moveSpeed: 1500, // px/s the squad slides toward the finger
  spacing: 22, // formation density: radius grows with spacing * sqrt(count)
  maxVisible: 60, // soldiers drawn; the count can go higher
  maxCount: 150, // gates and rescues can't push the squad past this
};

export const WEAPON = {
  bulletSpeed: 1100,
  baseShotsPerSec: 2,
  shotsPerSoldier: 0.5,
  maxSoldiersFiring: 150,
  // Damage per bullet = 1 + damagePerLevel * (level - 1)
  damagePerLevel: 0.5,
};

export const SIZES = {
  enemyRadius: 20,
  bulletRadius: 6,
  block: { w: 150, h: 110 },
  capsule: { w: 110, h: 130 },
};

// Difficulty as a function of seconds survived.
export function difficulty(t) {
  return {
    // Linear at first, then a quadratic term so a big squad eventually gets overrun.
    enemyHp: 1 + t / 25 + 2 * (t / 60) ** 2,
    enemySpeed: 100 + Math.min(t * 1.5, 200), // on top of the scroll speed
    enemySteer: 70 + Math.min(t, 130), // px/s sideways toward the squad
    spawnEvery: Math.max(0.5, 1.8 - t * 0.012),
    maxGroup: Math.min(2 + Math.floor(t / 18), 14),
    spread: Math.min(60 + t, 200), // how far from centre enemies appear
    blockEvery: 9,
    blockHp: Math.round(10 + t * 1.5 + 2 * (t / 30) ** 2),
    capsuleEvery: 4,
    capsuleHp: Math.round(5 + t * 0.8 + (t / 30) ** 2),
    capsuleReward: 2 + Math.floor(t / 40),
  };
}

export const SCORE = {
  enemy: 10,
  block: 50,
  capsule: 25,
  bossPerStage: 500,
  perMetre: 1,
};

// Each stage is a timed run, then a boss. Beating the boss starts the next stage.
export const STAGE = {
  runSeconds: 40,
  clearPause: 3, // calm seconds after a boss before the next stage starts
};

export const BOSS = {
  radius: 62,
  speed: 70, // on top of the scroll speed, until it reaches the squad
  steer: 60,
  hitInterval: 0.3, // seconds between hits while it is standing on the squad
  crush: (stage) => stage, // soldiers lost per hit
  hp: (stage) => Math.round(300 * stage ** 1.5),
  rescue: (stage) => 3 + 2 * stage, // soldiers freed when it falls
};

// A pair of gates spans the road; the squad goes through whichever half it is on.
export const GATE = {
  first: 7,
  every: 11,
  height: 96,
  clearance: 1.6, // seconds kept free of jars and ice around a gate
};

// Options for one gate pair at time t. rng returns [0, 1).
export function gateOptions(t, rng) {
  const small = 4 + Math.floor(t / 8) + Math.floor(rng() * 5);
  const good = [{ op: '+', n: small }];
  if (t > 20 && rng() < 0.35) good.push({ op: '×', n: 2 });
  if (t > 60 && rng() < 0.1) good.push({ op: '×', n: 3 });
  const bad = [{ op: '−', n: 3 + Math.floor(t / 8) + Math.floor(rng() * 5) }];
  if (t > 30) bad.push({ op: '÷', n: 2 });

  const pick = (list) => list[Math.floor(rng() * list.length)];
  // Mostly a good-or-bad choice; sometimes two good gates of different kinds.
  const pair = rng() < 0.65 || good.length < 2 ? [pick(good), pick(bad)] : [good[0], good[1]];
  return rng() < 0.5 ? pair : [pair[1], pair[0]];
}

export function applyGate(count, { op, n }) {
  let next = count;
  if (op === '+') next = count + n;
  else if (op === '−') next = count - n;
  else if (op === '×') next = count * n;
  else if (op === '÷') next = Math.ceil(count / n);
  return clampCount(next);
}

export function clampCount(n) {
  return Math.min(Math.max(n, 0), SQUAD.maxCount);
}

// px of scroll per metre shown in the HUD.
export const PX_PER_METRE = 20;

// An ice block that reaches the squad crushes this many soldiers.
export const BLOCK_CRUSH = 3;

export const BEST_SCORE_KEY = 'squad-rush-best-v1';
