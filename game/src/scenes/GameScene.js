import { VIEW, ROAD, ROAD_CENTER, SCROLL_SPEED, SQUAD, GATE, BEST_SCORE_KEY } from '../config.js';
import { Sim, formationSlot, squadRadius } from '../sim.js';
import { formatNumber } from '../format.js';
import { COLORS, CSS, FONTS, TEXT_RESOLUTION } from '../theme.js';
import { createTextures } from '../textures.js';

const MAX_STEP = 1 / 60; // sub-step so fast bullets never skip past an enemy
const KEY_SPEED = 900; // px/s the target moves while an arrow key is held
const DRAG_GAIN = 1.2; // finger movement -> squad movement
const SOLDIER_SCALE = 1.25;
const ENEMY_SCALE = 1.2;

const DEPTH = { road: 0, gates: 5, pickups: 10, bullets: 15, enemies: 20, boss: 25, squad: 30, fx: 40, banner: 90, hud: 100, panel: 200 };

// Display text for a gate option. En dash because the display font has no minus sign.
const GATE_SYMBOL = { '+': '+', '−': '–', '×': '×', '÷': '÷' };
const isGoodGate = (option) => option.op === '+' || option.op === '×';

function text(scene, x, y, value, style) {
  return scene.add.text(x, y, value, { resolution: TEXT_RESOLUTION, ...style });
}

function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(score));
  } catch {
    // Best score just won't persist.
  }
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    createTextures(this);
    this.sim = new Sim();
    this.mode = 'ready';
    this.targetX = ROAD_CENTER;
    this.best = loadBest();
    this.views = new Map(); // entity id -> game object

    this.road = this.add.tileSprite(0, 0, VIEW.width, VIEW.height, 'road').setOrigin(0).setDepth(DEPTH.road);
    this.soldiers = [];
    for (let i = 0; i < SQUAD.maxVisible; i++) {
      this.soldiers.push(this.add.image(ROAD_CENTER, SQUAD.y, 'soldier').setVisible(false));
    }
    this.bars = this.add.graphics().setDepth(DEPTH.enemies + 1);

    this.createFx();
    this.createHud();
    this.createBanner();
    this.createSquadLabel();
    this.createPanels();
    this.setupInput();
    this.syncSquad(true);
    this.showReady();
  }

  update(_time, deltaMs) {
    const dt = Math.min(deltaMs, 50) / 1000;
    if (this.mode === 'playing') {
      this.readKeys(dt);
      let left = dt;
      while (left > 0) {
        const step = Math.min(left, MAX_STEP);
        this.sim.step(step, this.targetX);
        left -= step;
      }
      this.road.tilePositionY -= SCROLL_SPEED * dt;
      this.handleEvents(this.sim.drainEvents());
    }
    this.syncEntities();
    this.syncSquad(false);
    this.refreshHud();
  }

  // ---------- Input ----------

  setupInput() {
    this.input.on('pointerdown', (pointer) => {
      this.dragX = pointer.x;
      if (this.mode === 'ready') this.startRun();
    });
    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown || this.dragX === undefined || this.mode !== 'playing') return;
      this.moveTarget((pointer.x - this.dragX) * DRAG_GAIN);
      this.dragX = pointer.x;
    });
    this.input.on('pointerup', () => {
      this.dragX = undefined;
    });

    this.keys = this.input.keyboard?.addKeys('LEFT,RIGHT,A,D,SPACE,ENTER');
    this.input.keyboard?.on('keydown', (event) => {
      if (this.mode === 'ready' || (this.mode === 'over' && ['Space', 'Enter'].includes(event.code))) this.startRun();
    });
  }

  readKeys(dt) {
    if (!this.keys) return;
    const dir = (this.keys.RIGHT.isDown || this.keys.D.isDown ? 1 : 0) - (this.keys.LEFT.isDown || this.keys.A.isDown ? 1 : 0);
    if (dir) this.moveTarget(dir * KEY_SPEED * dt);
  }

  moveTarget(dx) {
    // Keep the target inside the road so reversing direction responds instantly.
    const { min, max } = this.sim.squadBounds();
    this.targetX = Phaser.Math.Clamp(this.targetX + dx, min, max);
  }

  startRun() {
    this.sim.reset();
    this.targetX = ROAD_CENTER;
    for (const view of this.views.values()) view.destroy();
    this.views.clear();
    this.readyPanel.setVisible(false);
    this.overPanel.setVisible(false);
    this.mode = 'playing';
  }

  // ---------- Drawing the simulation ----------

  syncEntities() {
    const seen = new Set();
    const place = (entity, make, update) => {
      seen.add(entity.id);
      let view = this.views.get(entity.id);
      if (!view) {
        view = make(entity);
        this.views.set(entity.id, view);
      }
      view.setPosition(entity.x ?? 0, entity.y);
      update?.(view, entity);
    };

    for (const b of this.sim.bullets) place(b, () => this.add.image(0, 0, 'bullet').setDepth(DEPTH.bullets));
    for (const e of this.sim.enemies) place(e, () => this.add.image(0, 0, 'enemy').setScale(ENEMY_SCALE).setDepth(DEPTH.enemies));
    for (const o of this.sim.blocks) place(o, () => this.makeBlock(), (view, block) => view.getData('hp').setText(Math.ceil(block.hp)));
    for (const o of this.sim.capsules) place(o, (c) => this.makeCapsule(c), (view, c) => this.paintCapsuleBar(view, c));
    for (const g of this.sim.gates) place(g, (gate) => this.makeGate(gate));
    if (this.sim.boss) place(this.sim.boss, () => this.add.image(0, 0, 'boss').setDepth(DEPTH.boss), (view, boss) => this.animateBoss(view, boss));

    for (const [id, view] of this.views) {
      if (!seen.has(id)) {
        view.destroy();
        this.views.delete(id);
      }
    }

    // Health bars only for tougher, damaged enemies.
    this.bars.clear();
    for (const e of this.sim.enemies) {
      if (e.maxHp < 2 || e.hp >= e.maxHp) continue;
      this.bars.fillStyle(COLORS.ink, 0.6).fillRect(e.x - 18, e.y - 34, 36, 6);
      this.bars.fillStyle(COLORS.red).fillRect(e.x - 18, e.y - 34, 36 * (e.hp / e.maxHp), 6);
    }
  }

  makeBlock() {
    const ice = this.add.image(0, 0, 'ice');
    const gun = this.add.image(0, 14, 'gun');
    const hp = text(this, 0, -22, '', {
      fontFamily: FONTS.display, fontSize: '40px', color: CSS.blue, stroke: CSS.white, strokeThickness: 6,
    }).setOrigin(0.5);
    const c = this.add.container(0, 0, [ice, gun, hp]).setDepth(DEPTH.pickups);
    c.setData('hp', hp);
    return c;
  }

  makeGate(gate) {
    const half = (ROAD.right - ROAD.left) / 2;
    const h = GATE.height;
    const parts = [];
    const panels = gate.options.map((option, side) => {
      const color = isGoodGate(option) ? COLORS.good : COLORS.red;
      const cx = ROAD.left + half * side + half / 2;
      const g = this.add.graphics().setPosition(cx, 0);
      g.fillStyle(color, 0.45).fillRect(-half / 2 + 6, -h / 2, half - 12, h);
      g.fillStyle(color, 0.95).fillRect(-half / 2 + 6, -h / 2, half - 12, 14);
      g.lineStyle(4, COLORS.white, 0.8).strokeRect(-half / 2 + 6, -h / 2, half - 12, h);
      const label = text(this, cx, 8, `${GATE_SYMBOL[option.op]}${option.n}`, {
        fontFamily: FONTS.display, fontSize: '64px', color: CSS.white, stroke: CSS.ink, strokeThickness: 10,
      }).setOrigin(0.5);
      parts.push(g, label);
      return { g, label };
    });
    const posts = this.add.graphics();
    posts.fillStyle(COLORS.ink);
    for (const x of [ROAD.left, ROAD_CENTER, ROAD.right]) posts.fillRoundedRect(x - 7, -h / 2 - 14, 14, h + 22, 6);
    parts.push(posts);
    const c = this.add.container(0, gate.y, parts).setDepth(DEPTH.gates);
    c.setData('panels', panels);
    return c;
  }

  animateBoss(view, boss) {
    // Waddle while walking, flash when hit.
    const t = this.time.now;
    view.setScale(1 + 0.04 * Math.sin(t / 110), 1 - 0.04 * Math.sin(t / 110));
    view.setAngle(boss.onSquad ? 4 * Math.sin(t / 50) : 3 * Math.sin(t / 180));
    if (boss.hp < (view.getData('lastHp') ?? boss.hp)) view.setTint(0xffb0a8);
    else view.clearTint();
    view.setData('lastHp', boss.hp);
  }

  makeCapsule(capsule) {
    const parts = [this.add.image(0, 0, 'jar')];
    const inside = Math.min(capsule.reward, 3);
    for (let i = 0; i < inside; i++) {
      parts.push(this.add.image((i - (inside - 1) / 2) * 26, 16 + (i % 2) * 14, 'soldier').setScale(0.85));
    }
    parts.push(this.add.graphics());
    parts.push(
      text(this, 0, -86, `+${capsule.reward}`, {
        fontFamily: FONTS.display, fontSize: '42px', color: CSS.white, stroke: CSS.blue, strokeThickness: 8,
      }).setOrigin(0.5),
    );
    const c = this.add.container(0, 0, parts).setDepth(DEPTH.pickups);
    c.setData('bar', parts[parts.length - 2]);
    return c;
  }

  paintCapsuleBar(view, capsule) {
    const g = view.getData('bar').clear();
    g.fillStyle(COLORS.ink, 0.6).fillRoundedRect(-40, 50, 80, 10, 5);
    g.fillStyle(COLORS.good).fillRoundedRect(-40, 50, 80 * Math.max(capsule.hp / capsule.maxHp, 0), 10, 5);
  }

  syncSquad(snap) {
    const { count, x } = this.sim.squad;
    const visible = Math.min(count, SQUAD.maxVisible);
    this.soldiers.forEach((s, i) => {
      if (i >= visible) {
        s.setVisible(false);
        return;
      }
      const slot = formationSlot(i);
      const tx = x + slot.x;
      const ty = SQUAD.y + slot.y;
      if (!s.visible || snap) {
        s.setPosition(tx, ty).setVisible(true).setScale(snap ? SOLDIER_SCALE : 0.3);
        if (!snap) this.tweens.add({ targets: s, scale: SOLDIER_SCALE, duration: 220, ease: 'Back.easeOut' });
      } else {
        s.setPosition(Phaser.Math.Linear(s.x, tx, 0.35), Phaser.Math.Linear(s.y, ty, 0.35));
      }
      s.setDepth(DEPTH.squad + ty / VIEW.height);
    });

    const top = SQUAD.y - squadRadius(count) * 0.8 - 46;
    this.squadLabel.setPosition(x, top);
    if (this.squadLabelValue !== count) {
      this.squadLabelValue = count;
      this.squadLabelText.setText(String(count));
      this.tweens.add({ targets: this.squadLabel, scale: { from: 1.25, to: 1 }, duration: 180 });
    }
  }

  // ---------- Effects ----------

  createFx() {
    const burst = (tint, speed, scale) =>
      this.add
        .particles(0, 0, 'spark', {
          speed,
          lifespan: 420,
          scale: { start: scale, end: 0 },
          tint,
          emitting: false,
        })
        .setDepth(DEPTH.fx);
    this.fx = {
      enemy: burst([COLORS.red, COLORS.beige, COLORS.white], { min: 60, max: 220 }, 0.9),
      ice: burst([COLORS.ice, COLORS.white, COLORS.iceEdge], { min: 120, max: 380 }, 1.4),
      rescue: burst([COLORS.blueHelmet, COLORS.white, COLORS.bullet], { min: 100, max: 300 }, 1.1),
      hurt: burst([COLORS.red, COLORS.redDark], { min: 80, max: 240 }, 1),
    };
  }

  handleEvents(events) {
    for (const e of events) {
      if (e.type === 'enemyKilled') {
        this.fx.enemy.explode(10, e.x, e.y);
      } else if (e.type === 'blockBroken') {
        this.fx.ice.explode(30, e.x, e.y);
        this.floatText(e.x, e.y, `GUN Lv ${e.level}`, CSS.yellow);
        this.cameras.main.shake(120, 0.004);
      } else if (e.type === 'rescued') {
        this.fx.rescue.explode(26, e.x, e.y);
        this.floatText(e.x, e.y, `+${e.amount}`, CSS.white);
      } else if (e.type === 'soldierLost') {
        this.fx.hurt.explode(12, e.x, e.y);
        this.cameras.main.shake(80, 0.003);
      } else if (e.type === 'crushed') {
        this.fx.ice.explode(30, e.x, e.y);
        this.fx.hurt.explode(16, this.sim.squad.x, SQUAD.y);
        this.floatText(this.sim.squad.x, SQUAD.y - 80, `-${e.amount}`, CSS.red);
        this.cameras.main.shake(200, 0.008);
      } else if (e.type === 'gatePassed') {
        this.celebrateGate(e);
      } else if (e.type === 'bossIncoming') {
        this.showBanner('BOSS INCOMING!', CSS.red, 1800, true);
        this.cameras.main.shake(300, 0.006);
      } else if (e.type === 'bossDefeated') {
        this.fx.enemy.explode(60, e.x, e.y);
        this.fx.rescue.explode(40, e.x, e.y);
        this.cameras.main.shake(400, 0.012);
        this.floatText(e.x, e.y, `+${e.rescued}`, CSS.white);
        this.showBanner(`STAGE ${e.stage} CLEAR!`, CSS.yellow, 2200);
      } else if (e.type === 'stageStarted') {
        this.showBanner(`STAGE ${e.stage}`, CSS.white, 1400);
      } else if (e.type === 'gameover') {
        this.showGameOver();
      }
    }
  }

  celebrateGate(e) {
    const view = this.views.get(e.gateId);
    view?.getData('panels').forEach((panel, side) => {
      if (side === e.side) {
        this.tweens.add({ targets: panel.label, scale: 1.5, duration: 160, yoyo: true });
      } else {
        panel.g.setAlpha(0.25);
        panel.label.setAlpha(0.35);
      }
    });
    const good = e.change >= 0;
    const sign = good ? '+' : '–';
    this.floatText(this.sim.squad.x, SQUAD.y - 110, `${sign}${Math.abs(e.change)}`, good ? CSS.green : CSS.red);
    (good ? this.fx.rescue : this.fx.hurt).explode(24, this.sim.squad.x, SQUAD.y - 40);
    if (!good) this.cameras.main.shake(150, 0.006);
  }

  createBanner() {
    this.banner = text(this, VIEW.width / 2, 560, '', {
      fontFamily: FONTS.display, fontSize: '62px', color: CSS.white, stroke: CSS.ink, strokeThickness: 10, align: 'center',
    }).setOrigin(0.5).setDepth(DEPTH.banner).setAlpha(0);
  }

  showBanner(message, color, hold, pulse = false) {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(message).setColor(color).setAlpha(1).setScale(0.4);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 260, ease: 'Back.easeOut' });
    if (pulse) this.tweens.add({ targets: this.banner, alpha: 0.35, duration: 220, yoyo: true, repeat: Math.floor(hold / 440), delay: 260 });
    this.tweens.add({ targets: this.banner, alpha: 0, duration: 400, delay: hold });
  }

  floatText(x, y, message, color) {
    const t = text(this, x, y, message, {
      fontFamily: FONTS.display, fontSize: '44px', color, stroke: CSS.ink, strokeThickness: 8,
    }).setOrigin(0.5).setDepth(DEPTH.fx + 1);
    this.tweens.add({ targets: t, y: y - 90, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  // ---------- HUD and panels ----------

  createHud() {
    const bar = this.add.graphics().setDepth(DEPTH.hud);
    bar.fillStyle(COLORS.hud, 0.78).fillRoundedRect(16, 16, VIEW.width - 32, 92, 22);
    const label = { fontFamily: FONTS.body, fontSize: '20px', fontStyle: '800', color: CSS.muted, letterSpacing: 2 };
    const value = { fontFamily: FONTS.display, fontSize: '40px', color: CSS.white };

    const cols = [
      ['SCORE', 44, 0],
      ['STAGE', VIEW.width / 2, 0.5],
      ['GUN', VIEW.width - 44, 1],
    ];
    this.hud = {};
    for (const [name, x, align] of cols) {
      text(this, x, 28, name, label).setOrigin(align, 0).setDepth(DEPTH.hud);
      this.hud[name] = text(this, x, 52, '', value).setOrigin(align, 0).setDepth(DEPTH.hud);
    }

    // Stage progress toward the boss; turns into the boss's health bar during the fight.
    this.progress = this.add.graphics().setDepth(DEPTH.hud);
    this.progressLabel = text(this, VIEW.width / 2, 142, '', {
      fontFamily: FONTS.display, fontSize: '22px', color: CSS.white, stroke: CSS.ink, strokeThickness: 5,
    }).setOrigin(0.5).setDepth(DEPTH.hud + 1);
  }

  drawProgress() {
    const w = 440;
    const x = (VIEW.width - w) / 2;
    const y = 124;
    const g = this.progress.clear();
    const boss = this.sim.boss;
    g.fillStyle(COLORS.ink, 0.7).fillRoundedRect(x - 4, y - 4, w + 8, 26, 13);
    if (boss) {
      g.fillStyle(COLORS.red).fillRoundedRect(x, y, Math.max(w * (boss.hp / boss.maxHp), 0), 18, 9);
      this.progressLabel.setText(`BOSS  ${formatNumber(Math.ceil(boss.hp))}`);
    } else {
      g.fillStyle(COLORS.bullet).fillRoundedRect(x, y, Math.max(w * this.sim.stageProgress, 18), 18, 9);
      g.fillStyle(COLORS.red).fillCircle(x + w + 4, y + 9, 16);
      g.lineStyle(3, COLORS.white).strokeCircle(x + w + 4, y + 9, 16);
      this.progressLabel.setText('');
    }
  }

  refreshHud() {
    const values = {
      SCORE: formatNumber(this.sim.score),
      STAGE: String(this.sim.stage),
      GUN: `Lv ${this.sim.weaponLevel}`,
    };
    for (const [name, v] of Object.entries(values)) {
      if (this.hud[name].text !== v) this.hud[name].setText(v);
    }
    this.drawProgress();
  }

  createSquadLabel() {
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 0.8).fillRoundedRect(-44, -22, 88, 44, 22);
    g.fillStyle(COLORS.good).fillRoundedRect(-36, 12, 72, 6, 3);
    this.squadLabelText = text(this, 0, -3, '', {
      fontFamily: FONTS.display, fontSize: '32px', color: CSS.white,
    }).setOrigin(0.5);
    this.squadLabel = this.add.container(ROAD_CENTER, SQUAD.y - 80, [g, this.squadLabelText]).setDepth(DEPTH.squad + 2);
  }

  createPanels() {
    const cx = VIEW.width / 2;
    const title = { fontFamily: FONTS.display, fontSize: '84px', color: CSS.white, stroke: CSS.blue, strokeThickness: 14 };
    const body = { fontFamily: FONTS.body, fontSize: '30px', fontStyle: '800', color: CSS.ink, align: 'center' };

    const readyShade = this.add.rectangle(0, 0, VIEW.width, VIEW.height, COLORS.white, 0.35).setOrigin(0);
    const readyTitle = text(this, cx, 370, 'SQUAD RUSH', title).setOrigin(0.5);
    const readyHint = text(this, cx, 470, 'Drag left and right to aim.\nYour squad fires on its own.\n\nRun through the better gate.\nShoot jars to rescue soldiers.\nBreak ice for a better gun.\nBeat the boss to clear the stage.', body)
      .setOrigin(0.5, 0);
    this.readyCta = text(this, cx, 880, 'TAP TO START', {
      fontFamily: FONTS.display, fontSize: '52px', color: CSS.yellow, stroke: CSS.ink, strokeThickness: 10,
    }).setOrigin(0.5);
    this.readyBest = text(this, cx, 960, '', { ...body, fontSize: '26px' }).setOrigin(0.5);
    this.readyPanel = this.add.container(0, 0, [readyShade, readyTitle, readyHint, this.readyCta, this.readyBest]).setDepth(DEPTH.panel);
    this.tweens.add({ targets: this.readyCta, scale: 1.08, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const overShade = this.add.rectangle(0, 0, VIEW.width, VIEW.height, COLORS.ink, 0.72).setOrigin(0);
    const card = this.add.graphics();
    card.fillStyle(COLORS.white).fillRoundedRect(cx - 270, 380, 540, 560, 36);
    const overTitle = text(this, cx, 380, 'SQUAD LOST', { ...title, fontSize: '72px', stroke: CSS.red }).setOrigin(0.5);
    this.overStats = text(this, cx, 460, '', { ...body, fontSize: '32px', lineSpacing: 14 }).setOrigin(0.5, 0);
    const button = this.add.graphics();
    button.fillStyle(0xb5601a).fillRoundedRect(cx - 190, 808, 380, 100, 30);
    button.fillStyle(0xf28c28).fillRoundedRect(cx - 190, 800, 380, 100, 30);
    const buttonText = text(this, cx, 850, 'PLAY AGAIN', {
      fontFamily: FONTS.display, fontSize: '48px', color: CSS.white, stroke: '#b5601a', strokeThickness: 6,
    }).setOrigin(0.5);
    const hit = this.add.zone(cx - 190, 800, 380, 108).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.mode === 'over' && this.startRun());
    this.overPanel = this.add.container(0, 0, [overShade, card, overTitle, this.overStats, button, buttonText, hit])
      .setDepth(DEPTH.panel)
      .setVisible(false);
  }

  showReady() {
    this.readyBest.setText(this.best ? `Best score: ${formatNumber(this.best)}` : '');
    this.readyPanel.setVisible(true);
  }

  showGameOver() {
    const score = this.sim.score;
    const isRecord = score > this.best;
    if (isRecord) {
      this.best = score;
      saveBest(score);
    }
    this.overStats.setText(
      [
        `Score  ${formatNumber(score)}${isRecord ? '  NEW BEST!' : ''}`,
        `Best  ${formatNumber(this.best)}`,
        `Stage reached  ${this.sim.stage}`,
        `Distance  ${formatNumber(this.sim.metres)} m`,
        `Raiders stopped  ${formatNumber(this.sim.kills)}`,
      ].join('\n'),
    );
    // Short pause so a frantic tap doesn't skip the results.
    this.time.delayedCall(400, () => {
      this.mode = 'over';
      this.overPanel.setVisible(true);
    });
  }
}
