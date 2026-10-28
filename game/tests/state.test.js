import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ECONOMY, MAX_LEVEL } from '../src/config.js';
import * as S from '../src/state.js';
import { formatNumber, formatRate } from '../src/format.js';

function emptyState(gold = 1000) {
  const state = S.createState();
  state.cells.fill(null);
  state.gold = gold;
  return state;
}

test('new game starts with two mergeable soldiers', () => {
  const state = S.createState();
  const units = state.cells.filter(Boolean);
  assert.equal(units.length, 2);
  assert.ok(S.canMerge(units[0], units[1]));
  assert.equal(state.gold, ECONOMY.startGold);
});

test('merging two matching units makes one unit a level higher', () => {
  const state = emptyState();
  state.cells[0] = { type: 'tank', level: 3 };
  state.cells[1] = { type: 'tank', level: 3 };
  state.highest.tank = 5;
  const result = S.moveUnit(state, 0, 1);
  assert.equal(result.kind, 'merge');
  assert.equal(result.level, 4);
  assert.equal(result.discovered, false);
  assert.equal(state.cells[0], null);
  assert.deepEqual(state.cells[1], { type: 'tank', level: 4 });
});

test('reaching a new highest level pays a discovery reward once', () => {
  const state = emptyState(0);
  state.cells[0] = { type: 'infantry', level: 1 };
  state.cells[1] = { type: 'infantry', level: 1 };
  state.cells[2] = { type: 'infantry', level: 1 };
  state.cells[3] = { type: 'infantry', level: 1 };

  const first = S.moveUnit(state, 0, 1);
  assert.equal(first.discovered, true);
  assert.equal(first.reward, S.discoveryReward('infantry', 2));
  assert.equal(state.gold, first.reward);
  assert.equal(state.highest.infantry, 2);

  const second = S.moveUnit(state, 2, 3);
  assert.equal(second.discovered, false);
  assert.equal(second.reward, 0);
  assert.equal(state.gold, first.reward);
});

test('different units swap, empty cells take a move', () => {
  const state = emptyState();
  state.cells[0] = { type: 'infantry', level: 2 };
  state.cells[1] = { type: 'aircraft', level: 2 };
  assert.equal(S.moveUnit(state, 0, 1).kind, 'swap');
  assert.equal(state.cells[0].type, 'aircraft');
  assert.equal(state.cells[1].type, 'infantry');

  assert.equal(S.moveUnit(state, 1, 7).kind, 'move');
  assert.equal(state.cells[1], null);
  assert.equal(state.cells[7].type, 'infantry');
});

test('max level units do not merge', () => {
  const state = emptyState();
  state.cells[0] = { type: 'tank', level: MAX_LEVEL };
  state.cells[1] = { type: 'tank', level: MAX_LEVEL };
  assert.equal(S.moveUnit(state, 0, 1).kind, 'swap');
});

test('invalid moves do nothing', () => {
  const state = emptyState();
  state.cells[0] = { type: 'tank', level: 1 };
  assert.equal(S.moveUnit(state, 0, 0).kind, 'none');
  assert.equal(S.moveUnit(state, 0, -1).kind, 'none');
  assert.equal(S.moveUnit(state, 0, S.CELL_COUNT).kind, 'none');
  assert.equal(S.moveUnit(state, 5, 6).kind, 'none');
  assert.deepEqual(state.cells[0], { type: 'tank', level: 1 });
});

test('buying charges gold, fills the first empty cell and raises the price', () => {
  const state = emptyState(100);
  state.cells[0] = { type: 'tank', level: 1 };
  const price = S.unitCost(state, 'infantry');
  const result = S.buyUnit(state, 'infantry');
  assert.equal(result.ok, true);
  assert.equal(result.index, 1);
  assert.equal(state.gold, 100 - price);
  assert.ok(S.unitCost(state, 'infantry') > price);
  assert.equal(S.unitCost(state, 'tank'), Math.ceil(15), 'other types keep their own price');
});

test('buying fails without gold or space', () => {
  const poor = emptyState(0);
  assert.deepEqual(S.buyUnit(poor, 'tank'), { ok: false, reason: 'gold', cost: S.unitCost(poor, 'tank') });

  const full = emptyState(1e9);
  full.cells.fill({ type: 'infantry', level: 1 });
  assert.equal(S.buyUnit(full, 'tank').reason, 'full');
});

test('selling returns half the base value of the units merged into it', () => {
  const state = emptyState(0);
  state.cells[4] = { type: 'infantry', level: 3 };
  const result = S.sellUnit(state, 4);
  assert.equal(result.value, 10 * 4 * ECONOMY.sellRefund);
  assert.equal(state.gold, result.value);
  assert.equal(state.cells[4], null);
  assert.equal(S.sellUnit(state, 4).ok, false);
});

test('merging raises income, so it is never a loss', () => {
  const a = { type: 'aircraft', level: 4 };
  const merged = { type: 'aircraft', level: 5 };
  assert.ok(S.unitIncome(merged) > 2 * S.unitIncome(a));
});

test('tick adds income over time', () => {
  const state = emptyState(0);
  state.cells[0] = { type: 'infantry', level: 1 };
  S.tick(state, 10);
  assert.equal(state.gold, 10 * S.incomePerSecond(state));
});

test('saves round-trip and reject bad data', () => {
  const state = emptyState(123.5);
  state.cells[2] = { type: 'aircraft', level: 7 };
  state.bought.tank = 4;
  state.highest.aircraft = 7;
  assert.deepEqual(S.deserialize(S.serialize(state)), state);

  assert.equal(S.deserialize('not json'), null);
  assert.equal(S.deserialize('{"v":99}'), null);
  const bad = JSON.parse(S.serialize(state));
  bad.cells[0] = { type: 'dragon', level: 1 };
  assert.equal(S.deserialize(JSON.stringify(bad)), null);
});

test('numbers format with suffixes', () => {
  assert.equal(formatNumber(950.7), '950');
  assert.equal(formatNumber(1000), '1K');
  assert.equal(formatNumber(12_340), '12.3K');
  assert.equal(formatNumber(4_560_000), '4.56M');
  assert.equal(formatNumber(999_999), '1M');
  assert.equal(formatNumber(100_000), '100K');
  assert.equal(formatNumber(20_000_000), '20M');
  assert.equal(formatRate(2.25), '2.3');
  assert.equal(formatRate(3), '3');
});
