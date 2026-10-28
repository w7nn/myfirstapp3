// Pure game simulation: no Phaser, no DOM. The scene draws whatever this holds.

import {
  VIEW, ROAD, ROAD_CENTER, SCROLL_SPEED, SQUAD, WEAPON, SIZES, SCORE, PX_PER_METRE, BLOCK_CRUSH, difficulty,
} from './config.js';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// Offset of soldier i from the squad centre, packed in a sunflower spiral.
export function formationSlot(i) {
  if (i === 0) return { x: 0, y: 0 };
  const r = SQUAD.spacing * Math.sqrt(i);
  const a = i * GOLDEN_ANGLE;
  return { x: r * Math.cos(a), y: r * Math.sin(a) * 0.8 };
}

export function squadRadius(count) {
  return SQUAD.spacing * Math.sqrt(Math.min(Math.max(count, 1), SQUAD.maxVisible)) + 16;
}

export function bulletDamage(weaponLevel) {
  return 1 + WEAPON.damagePerLevel * (weaponLevel - 1);
}

export function shotsPerSecond(count) {
  return WEAPON.baseShotsPerSec + Math.min(count, WEAPON.maxSoldiersFiring) * WEAPON.shotsPerSoldier;
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function circleHitsRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x - rect.w / 2, rect.x + rect.w / 2);
  const ny = clamp(cy, rect.y - rect.h / 2, rect.y + rect.h / 2);
  return (cx - nx) ** 2 + (cy - ny) ** 2 <= r * r;
}

export class Sim {
  // autoSpawn: false lets tests place every entity by hand.
  constructor({ rng = Math.random, autoSpawn = true } = {}) {
    this.rng = rng;
    this.autoSpawn = autoSpawn;
    this.reset();
  }

  reset() {
    this.time = 0;
    this.scrolled = 0;
    this.kills = 0;
    this.bonusScore = 0;
    this.over = false;
    this.squad = { x: ROAD_CENTER, count: SQUAD.startCount };
    this.weaponLevel = 1;
    this.enemies = [];
    this.blocks = [];
    this.capsules = [];
    this.bullets = [];
    this.events = [];
    this.nextId = 1;
    this.fireAccumulator = 0;
    this.timers = { enemy: 1.2, block: 5, capsule: 2.5 };
  }

  get metres() {
    return Math.floor(this.scrolled / PX_PER_METRE);
  }

  get score() {
    return this.bonusScore + this.metres * SCORE.perMetre;
  }

  squadBounds() {
    const margin = Math.min(squadRadius(this.squad.count), (ROAD.right - ROAD.left) / 2);
    return { min: ROAD.left + margin, max: ROAD.right - margin };
  }

  // ---------- Spawning ----------

  spawnEnemy(x, y, hp = difficulty(this.time).enemyHp) {
    const enemy = { id: this.nextId++, x, y, hp, maxHp: hp };
    this.enemies.push(enemy);
    return enemy;
  }

  spawnBlock(x, y, hp = difficulty(this.time).blockHp) {
    const block = { id: this.nextId++, x, y, hp, maxHp: hp, ...SIZES.block };
    this.blocks.push(block);
    return block;
  }

  spawnCapsule(x, y, reward = difficulty(this.time).capsuleReward, hp = difficulty(this.time).capsuleHp) {
    const capsule = { id: this.nextId++, x, y, hp, maxHp: hp, reward, ...SIZES.capsule };
    this.capsules.push(capsule);
    return capsule;
  }

  randomLaneX(width) {
    return ROAD.left + width / 2 + this.rng() * (ROAD.right - ROAD.left - width);
  }

  runSpawners(dt) {
    const d = difficulty(this.time);
    this.timers.enemy -= dt;
    this.timers.block -= dt;
    this.timers.capsule -= dt;

    if (this.timers.enemy <= 0) {
      this.timers.enemy += d.spawnEvery;
      const size = Math.ceil(d.maxGroup / 2) + Math.floor(this.rng() * Math.ceil(d.maxGroup / 2));
      for (let i = 0; i < size; i++) {
        const x = clamp(ROAD_CENTER + (this.rng() * 2 - 1) * d.spread, ROAD.left + 24, ROAD.right - 24);
        this.spawnEnemy(x, -40 - i * 34 - this.rng() * 20, d.enemyHp);
      }
    }
    if (this.timers.block <= 0) {
      this.timers.block += d.blockEvery;
      this.spawnBlock(this.randomLaneX(SIZES.block.w), -SIZES.block.h, d.blockHp);
    }
    if (this.timers.capsule <= 0) {
      this.timers.capsule += d.capsuleEvery;
      const reward = d.capsuleReward + Math.floor(this.rng() * 2);
      this.spawnCapsule(this.randomLaneX(SIZES.capsule.w), -SIZES.capsule.h, reward, d.capsuleHp);
    }
  }

  // ---------- Main step ----------

  // targetX: where the player wants the squad centre to be.
  step(dt, targetX) {
    if (this.over) return;
    this.time += dt;
    this.scrolled += SCROLL_SPEED * dt;
    const d = difficulty(this.time);

    const { min, max } = this.squadBounds();
    const goal = clamp(targetX, min, max);
    const maxMove = SQUAD.moveSpeed * dt;
    this.squad.x += clamp(goal - this.squad.x, -maxMove, maxMove);

    if (this.autoSpawn) this.runSpawners(dt);
    this.fire(dt);

    for (const b of this.bullets) b.y -= WEAPON.bulletSpeed * dt;
    for (const e of this.enemies) {
      e.y += (SCROLL_SPEED + d.enemySpeed) * dt;
      // Once they're on screen, enemies home in on the squad.
      if (e.y > 150) e.x += clamp((this.squad.x - e.x) * 1.5, -d.enemySteer, d.enemySteer) * dt;
    }
    for (const o of this.blocks) o.y += SCROLL_SPEED * dt;
    for (const o of this.capsules) o.y += SCROLL_SPEED * dt;

    this.resolveBullets();
    this.resolveSquadContact();
    this.cull();

    if (this.squad.count <= 0) {
      this.squad.count = 0;
      this.over = true;
      this.events.push({ type: 'gameover' });
    }
  }

  fire(dt) {
    this.fireAccumulator += shotsPerSecond(this.squad.count) * dt;
    const visible = Math.min(this.squad.count, SQUAD.maxVisible);
    while (this.fireAccumulator >= 1 && visible > 0) {
      this.fireAccumulator -= 1;
      const slot = formationSlot(Math.floor(this.rng() * visible));
      this.bullets.push({ id: this.nextId++, x: this.squad.x + slot.x, y: SQUAD.y + slot.y - 24 });
    }
  }

  resolveBullets() {
    const damage = bulletDamage(this.weaponLevel);
    const r = SIZES.bulletRadius;
    const enemyReach = (SIZES.enemyRadius + r) ** 2;

    for (const b of this.bullets) {
      let hit = this.enemies.find((e) => e.hp > 0 && (e.x - b.x) ** 2 + (e.y - b.y) ** 2 <= enemyReach);
      hit ??= this.blocks.find((o) => o.hp > 0 && circleHitsRect(b.x, b.y, r, o));
      hit ??= this.capsules.find((o) => o.hp > 0 && circleHitsRect(b.x, b.y, r, o));
      if (!hit) continue;
      b.dead = true;
      hit.hp -= damage;
      if (hit.hp > 0) continue;

      if (this.enemies.includes(hit)) {
        this.kills += 1;
        this.bonusScore += SCORE.enemy;
        this.events.push({ type: 'enemyKilled', x: hit.x, y: hit.y });
      } else if (this.blocks.includes(hit)) {
        this.weaponLevel += 1;
        this.bonusScore += SCORE.block;
        this.events.push({ type: 'blockBroken', x: hit.x, y: hit.y, level: this.weaponLevel });
      } else {
        this.squad.count += hit.reward;
        this.bonusScore += SCORE.capsule;
        this.events.push({ type: 'rescued', x: hit.x, y: hit.y, amount: hit.reward });
      }
    }
  }

  resolveSquadContact() {
    const radius = squadRadius(this.squad.count);
    const reach = (radius + SIZES.enemyRadius) ** 2;
    for (const e of this.enemies) {
      if (e.hp <= 0 || this.squad.count <= 0) continue;
      if ((e.x - this.squad.x) ** 2 + (e.y - SQUAD.y) ** 2 <= reach) {
        e.hp = 0;
        this.squad.count -= 1;
        this.events.push({ type: 'soldierLost', x: e.x, y: e.y, amount: 1 });
      }
    }
    for (const o of this.blocks) {
      if (o.hp <= 0 || this.squad.count <= 0) continue;
      if (circleHitsRect(this.squad.x, SQUAD.y, radius, o)) {
        o.hp = 0;
        const lost = Math.min(BLOCK_CRUSH, this.squad.count);
        this.squad.count -= lost;
        this.events.push({ type: 'crushed', x: o.x, y: o.y, amount: lost });
      }
    }
  }

  cull() {
    const bottom = VIEW.height + 160;
    const alive = (o) => o.hp > 0 && o.y < bottom;
    this.enemies = this.enemies.filter(alive);
    this.blocks = this.blocks.filter(alive);
    this.capsules = this.capsules.filter(alive);
    this.bullets = this.bullets.filter((b) => !b.dead && b.y > -40);
  }

  // Hands the scene everything that happened since the last call.
  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }
}
