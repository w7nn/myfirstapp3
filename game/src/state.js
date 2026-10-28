// Pure game rules: no Phaser, no DOM. Everything the board can do goes through here.

import { GRID, MAX_LEVEL, UNIT_TYPES, ECONOMY } from './config.js';

export const TYPE_IDS = Object.keys(UNIT_TYPES);
export const CELL_COUNT = GRID.cols * GRID.rows;
const SAVE_VERSION = 1;

export function createState() {
  const cells = new Array(CELL_COUNT).fill(null);
  // Two matching starters so the first thing a new player does is merge.
  cells[11] = { type: 'infantry', level: 1 };
  cells[13] = { type: 'infantry', level: 1 };
  return {
    gold: ECONOMY.startGold,
    cells,
    bought: Object.fromEntries(TYPE_IDS.map((t) => [t, 0])),
    highest: Object.fromEntries(TYPE_IDS.map((t) => [t, 1])),
  };
}

export function unitPower(type, level) {
  return UNIT_TYPES[type].power * ECONOMY.levelGrowth ** (level - 1);
}

export function unitIncome(unit) {
  return unitPower(unit.type, unit.level) * ECONOMY.incomePerPower;
}

export function incomePerSecond(state) {
  return state.cells.reduce((sum, unit) => (unit ? sum + unitIncome(unit) : sum), 0);
}

export function unitCost(state, type) {
  return Math.ceil(UNIT_TYPES[type].baseCost * ECONOMY.costGrowth ** state.bought[type]);
}

export function sellValue(unit) {
  // A Lv N unit contains 2^(N-1) Lv1 units.
  return Math.floor(UNIT_TYPES[unit.type].baseCost * 2 ** (unit.level - 1) * ECONOMY.sellRefund);
}

export function discoveryReward(type, level) {
  return Math.round(unitIncome({ type, level }) * ECONOMY.discoveryRewardSeconds);
}

export function firstEmptyCell(state) {
  return state.cells.indexOf(null);
}

export function canMerge(a, b) {
  return Boolean(a && b && a.type === b.type && a.level === b.level && a.level < MAX_LEVEL);
}

export function buyUnit(state, type) {
  const index = firstEmptyCell(state);
  if (index === -1) return { ok: false, reason: 'full' };
  const cost = unitCost(state, type);
  if (state.gold < cost) return { ok: false, reason: 'gold', cost };
  state.gold -= cost;
  state.bought[type] += 1;
  state.cells[index] = { type, level: 1 };
  return { ok: true, index, cost };
}

// Drop the unit at `from` onto `to`: merge, swap, move, or nothing.
export function moveUnit(state, from, to) {
  const inBounds = (i) => Number.isInteger(i) && i >= 0 && i < CELL_COUNT;
  if (from === to || !inBounds(from) || !inBounds(to)) return { kind: 'none' };
  const a = state.cells[from];
  const b = state.cells[to];
  if (!a) return { kind: 'none' };

  if (!b) {
    state.cells[to] = a;
    state.cells[from] = null;
    return { kind: 'move' };
  }

  if (canMerge(a, b)) {
    const level = a.level + 1;
    state.cells[to] = { type: a.type, level };
    state.cells[from] = null;
    let reward = 0;
    const discovered = level > state.highest[a.type];
    if (discovered) {
      state.highest[a.type] = level;
      reward = discoveryReward(a.type, level);
      state.gold += reward;
    }
    return { kind: 'merge', level, discovered, reward };
  }

  state.cells[to] = a;
  state.cells[from] = b;
  return { kind: 'swap' };
}

export function sellUnit(state, index) {
  const unit = state.cells[index];
  if (!unit) return { ok: false };
  const value = sellValue(unit);
  state.cells[index] = null;
  state.gold += value;
  return { ok: true, value };
}

export function tick(state, dtSeconds) {
  state.gold += incomePerSecond(state) * dtSeconds;
}

export function serialize(state) {
  return JSON.stringify({ v: SAVE_VERSION, ...state });
}

// Returns a valid state, or null when the data is missing or malformed.
export function deserialize(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!data || data.v !== SAVE_VERSION) return null;
  if (!Number.isFinite(data.gold) || data.gold < 0) return null;
  if (!Array.isArray(data.cells) || data.cells.length !== CELL_COUNT) return null;

  const validUnit = (u) =>
    u === null ||
    (u && TYPE_IDS.includes(u.type) && Number.isInteger(u.level) && u.level >= 1 && u.level <= MAX_LEVEL);
  if (!data.cells.every(validUnit)) return null;

  const state = createState();
  state.gold = data.gold;
  state.cells = data.cells.map((u) => (u ? { type: u.type, level: u.level } : null));
  for (const t of TYPE_IDS) {
    const bought = data.bought?.[t];
    const highest = data.highest?.[t];
    state.bought[t] = Number.isInteger(bought) && bought >= 0 ? bought : 0;
    state.highest[t] = Number.isInteger(highest) && highest >= 1 && highest <= MAX_LEVEL ? highest : 1;
  }
  return state;
}
