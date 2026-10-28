// All balancing numbers live here so the game can be tuned without touching logic.

export const GRID = { cols: 5, rows: 5 };

export const MAX_LEVEL = 30;

// power: strength of a Lv1 unit. baseCost: price of the first Lv1 purchase.
export const UNIT_TYPES = {
  infantry: { name: 'Infantry', short: 'INF', power: 1, baseCost: 10 },
  tank: { name: 'Tank', short: 'TNK', power: 1.5, baseCost: 15 },
  aircraft: { name: 'Aircraft', short: 'AIR', power: 2, baseCost: 20 },
};

export const ECONOMY = {
  startGold: 40,
  // Each purchase of a type raises that type's next price by this factor.
  costGrowth: 1.07,
  // Power multiplier per level. Above 2 means merging two units is a net gain.
  levelGrowth: 2.2,
  // Gold per second earned per point of power on the board.
  incomePerPower: 0.5,
  // Reaching a new highest level pays this many seconds of the new unit's income.
  discoveryRewardSeconds: 30,
  // Share of a unit's base value returned when sold.
  sellRefund: 0.5,
};

export const SAVE = {
  key: 'merge-command-save-v1',
  intervalMs: 5000,
};

// Logical canvas size (portrait); Phaser scales it to fit the screen.
export const LAYOUT = {
  width: 720,
  height: 1280,
  hudHeight: 170,
  toastY: 212,
  gridTop: 250,
  cell: 120,
  gap: 12,
  sellY: 965,
  sellHeight: 72,
  shopY: 1125,
  shopHeight: 170,
  resetY: 1248,
};
