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
};

export const WEAPON = {
  bulletSpeed: 1100,
  baseShotsPerSec: 2,
  shotsPerSoldier: 0.5,
  maxSoldiersFiring: 60,
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
  perMetre: 1,
};

// px of scroll per metre shown in the HUD.
export const PX_PER_METRE = 20;

// An ice block that reaches the squad crushes this many soldiers.
export const BLOCK_CRUSH = 3;

export const BEST_SCORE_KEY = 'squad-rush-best-v1';
