import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ROAD, ROAD_CENTER, SQUAD, SCORE, BLOCK_CRUSH, STAGE, BOSS, difficulty, applyGate, gateOptions,
} from '../src/config.js';
import { Sim, formationSlot, squadRadius, bulletDamage, shotsPerSecond } from '../src/sim.js';
import { formatNumber } from '../src/format.js';

// Deterministic pseudo-random numbers so runs are repeatable.
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function quietSim() {
  return new Sim({ rng: seeded(), autoSpawn: false });
}

function run(sim, seconds, targetX = sim.squad.x) {
  for (let t = 0; t < seconds; t += 1 / 60) sim.step(1 / 60, targetX);
}

test('a new run starts at the centre with the starting squad', () => {
  const sim = quietSim();
  assert.equal(sim.squad.x, ROAD_CENTER);
  assert.equal(sim.squad.count, SQUAD.startCount);
  assert.equal(sim.weaponLevel, 1);
  assert.equal(sim.over, false);
});

test('the squad slides toward the target and stays on the road', () => {
  const sim = quietSim();
  run(sim, 1, 10_000);
  const { max } = sim.squadBounds();
  assert.equal(sim.squad.x, max);
  assert.ok(max < ROAD.right);

  run(sim, 1, -10_000);
  assert.equal(sim.squad.x, sim.squadBounds().min);
});

test('the squad fires on its own, faster with more soldiers', () => {
  const sim = quietSim();
  sim.step(0.5, sim.squad.x);
  assert.ok(sim.bullets.length > 0);
  assert.ok(shotsPerSecond(20) > shotsPerSecond(5));
});

test('bullets kill an enemy in the firing line and score it', () => {
  const sim = quietSim();
  const enemy = sim.spawnEnemy(sim.squad.x, 500, 1);
  run(sim, 0.6);
  assert.ok(!sim.enemies.includes(enemy));
  assert.equal(sim.kills, 1);
  assert.equal(sim.squad.count, SQUAD.startCount);
  assert.ok(sim.score >= SCORE.enemy);
});

test('an enemy that reaches the squad takes one soldier', () => {
  const sim = quietSim();
  sim.spawnEnemy(sim.squad.x, SQUAD.y - 10, 999);
  sim.step(1 / 60, sim.squad.x);
  assert.equal(sim.squad.count, SQUAD.startCount - 1);
  assert.equal(sim.enemies.length, 0);
  assert.ok(sim.drainEvents().some((e) => e.type === 'soldierLost'));
});

test('dodged enemies are not hit by bullets or the squad', () => {
  const sim = quietSim();
  sim.squad.x = ROAD.left + 60;
  sim.spawnEnemy(ROAD.right - 30, 200, 999);
  run(sim, 0.5, sim.squad.x);
  assert.equal(sim.squad.count, SQUAD.startCount);
  assert.equal(sim.enemies[0].hp, 999);
});

test('shooting a jar open rescues its soldiers', () => {
  const sim = quietSim();
  sim.spawnCapsule(sim.squad.x, 400, 4, 3);
  run(sim, 1);
  assert.equal(sim.capsules.length, 0);
  assert.equal(sim.squad.count, SQUAD.startCount + 4);
  assert.ok(sim.drainEvents().some((e) => e.type === 'rescued' && e.amount === 4));
});

test('breaking an ice block upgrades the gun', () => {
  const sim = quietSim();
  sim.spawnBlock(sim.squad.x, 300, 3);
  run(sim, 1.5);
  assert.equal(sim.blocks.length, 0);
  assert.equal(sim.weaponLevel, 2);
  assert.ok(bulletDamage(2) > bulletDamage(1));
});

test('an ice block that reaches the squad crushes soldiers', () => {
  const sim = quietSim();
  sim.squad.count = 10;
  sim.spawnBlock(sim.squad.x, SQUAD.y - 40, 1e9);
  sim.step(1 / 60, sim.squad.x);
  assert.equal(sim.squad.count, 10 - BLOCK_CRUSH);
});

test('losing the last soldier ends the run and freezes the sim', () => {
  const sim = quietSim();
  sim.squad.count = 1;
  sim.spawnEnemy(sim.squad.x, SQUAD.y, 999);
  sim.step(1 / 60, sim.squad.x);
  assert.equal(sim.over, true);
  assert.equal(sim.squad.count, 0);
  assert.ok(sim.drainEvents().some((e) => e.type === 'gameover'));

  const time = sim.time;
  sim.step(1, sim.squad.x);
  assert.equal(sim.time, time);
});

test('reset starts a fresh run', () => {
  const sim = quietSim();
  run(sim, 2);
  sim.weaponLevel = 5;
  sim.reset();
  assert.equal(sim.time, 0);
  assert.equal(sim.weaponLevel, 1);
  assert.equal(sim.bullets.length, 0);
  assert.equal(sim.score, 0);
});

test('enemies keep coming from the centre of the road', () => {
  const sim = new Sim({ rng: seeded(7) });
  let spawned = 0;
  for (let t = 0; t < 10; t += 1 / 60) {
    const before = new Set(sim.enemies.map((e) => e.id));
    sim.step(1 / 60, sim.squad.x);
    for (const e of sim.enemies) {
      if (before.has(e.id)) continue;
      spawned += 1;
      assert.ok(Math.abs(e.x - ROAD_CENTER) <= difficulty(sim.time).spread + 1);
    }
  }
  assert.ok(spawned >= 5, `expected a stream of enemies, got ${spawned}`);
});

test('difficulty rises over time', () => {
  const early = difficulty(0);
  const late = difficulty(120);
  assert.ok(late.enemyHp > early.enemyHp);
  assert.ok(late.enemySpeed > early.enemySpeed);
  assert.ok(late.spawnEvery < early.spawnEvery);
  assert.ok(late.maxGroup > early.maxGroup);
});

test('formation grows outward from the centre soldier', () => {
  assert.deepEqual(formationSlot(0), { x: 0, y: 0 });
  const far = formationSlot(40);
  assert.ok(Math.hypot(far.x, far.y) > Math.hypot(formationSlot(4).x, formationSlot(4).y));
  assert.ok(squadRadius(40) > squadRadius(5));
});

test('numbers format with suffixes', () => {
  assert.equal(formatNumber(950.7), '950');
  assert.equal(formatNumber(1000), '1K');
  assert.equal(formatNumber(12_340), '12.3K');
  assert.equal(formatNumber(100_000), '100K');
  assert.equal(formatNumber(999_999), '1M');
});

test('gate maths, clamped to the squad limit', () => {
  assert.equal(applyGate(10, { op: '+', n: 5 }), 15);
  assert.equal(applyGate(10, { op: '−', n: 4 }), 6);
  assert.equal(applyGate(3, { op: '−', n: 9 }), 0);
  assert.equal(applyGate(10, { op: '×', n: 2 }), 20);
  assert.equal(applyGate(9, { op: '÷', n: 2 }), 5);
  assert.equal(applyGate(SQUAD.maxCount - 1, { op: '×', n: 3 }), SQUAD.maxCount);
});

test('the squad goes through the gate on its side of the road', () => {
  const left = quietSim();
  left.squad.x = ROAD_CENTER - 100;
  left.spawnGates(SQUAD.y - 5, [{ op: '+', n: 10 }, { op: '−', n: 3 }]);
  left.step(1 / 30, left.squad.x);
  assert.equal(left.squad.count, SQUAD.startCount + 10);

  const right = quietSim();
  right.squad.x = ROAD_CENTER + 100;
  right.spawnGates(SQUAD.y - 5, [{ op: '+', n: 10 }, { op: '−', n: 3 }]);
  right.step(1 / 30, right.squad.x);
  assert.equal(right.squad.count, SQUAD.startCount - 3);
  const passed = right.drainEvents().find((e) => e.type === 'gatePassed');
  assert.equal(passed.side, 1);
  assert.equal(passed.change, -3);

  right.step(1 / 30, right.squad.x);
  assert.equal(right.squad.count, SQUAD.startCount - 3, 'a gate only applies once');
});

test('a bad gate can wipe out the squad', () => {
  const sim = quietSim();
  sim.squad.x = ROAD_CENTER - 100;
  sim.spawnGates(SQUAD.y - 5, [{ op: '−', n: 99 }, { op: '+', n: 1 }]);
  sim.step(1 / 30, sim.squad.x);
  assert.equal(sim.over, true);
});

test('gate pairs always offer two valid options', () => {
  const rng = seeded(3);
  for (let t = 0; t < 300; t += 7) {
    const options = gateOptions(t, rng);
    assert.equal(options.length, 2);
    for (const o of options) {
      assert.ok(['+', '−', '×', '÷'].includes(o.op));
      assert.ok(Number.isInteger(o.n) && o.n > 0);
    }
  }
});

test('the boss arrives after the stage run and stops other spawns', () => {
  const sim = new Sim({ rng: seeded(5) });
  sim.squad.count = 150;
  let incoming = false;
  while (!incoming && sim.time < STAGE.runSeconds + 1) {
    sim.step(1 / 60, sim.squad.x);
    incoming = sim.drainEvents().some((e) => e.type === 'bossIncoming');
  }
  assert.ok(incoming);
  assert.equal(sim.phase, 'boss');
  assert.equal(sim.stageProgress, 1);
  assert.equal(sim.boss.hp, BOSS.hp(1));

  sim.enemies = [];
  sim.boss.hp = 1e9; // keep it alive while we watch the spawners
  run(sim, 2);
  assert.equal(sim.enemies.length, 0);
});

test('a boss standing on the squad keeps crushing soldiers', () => {
  const sim = quietSim();
  sim.squad.count = 20;
  sim.weaponLevel = 1;
  sim.phase = 'boss';
  sim.spawnBoss(SQUAD.y - 40).hp = 1e9;
  run(sim, 1);
  assert.ok(sim.boss.onSquad);
  assert.ok(sim.squad.count <= 20 - 3, `count ${sim.squad.count}`);
});

test('beating the boss rescues soldiers, scores, and starts the next stage', () => {
  const sim = quietSim();
  sim.phase = 'boss';
  sim.spawnBoss(600).hp = 1;
  run(sim, 0.5);
  assert.equal(sim.boss, null);
  assert.equal(sim.phase, 'clear');
  assert.equal(sim.squad.count, SQUAD.startCount + BOSS.rescue(1));
  assert.ok(sim.score >= SCORE.bossPerStage);
  const defeated = sim.drainEvents().find((e) => e.type === 'bossDefeated');
  assert.equal(defeated.stage, 1);

  run(sim, STAGE.clearPause + 0.1);
  assert.equal(sim.stage, 2);
  assert.equal(sim.phase, 'run');
  assert.ok(sim.drainEvents().some((e) => e.type === 'stageStarted' && e.stage === 2));
});
