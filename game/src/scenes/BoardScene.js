import { GRID, LAYOUT, SAVE, UNIT_TYPES } from '../config.js';
import * as S from '../state.js';
import { loadGame, saveGame, clearSave } from '../storage.js';
import { formatNumber, formatRate } from '../format.js';
import { COLORS, CSS, FONTS, TEXT_RESOLUTION } from '../theme.js';
import { createUnitView, createUnitIcon } from '../units.js';

const UNIT_SIZE = LAYOUT.cell - 16;
const PITCH = LAYOUT.cell + LAYOUT.gap;
const GRID_WIDTH = GRID.cols * LAYOUT.cell + (GRID.cols - 1) * LAYOUT.gap;
const GRID_HEIGHT = GRID.rows * LAYOUT.cell + (GRID.rows - 1) * LAYOUT.gap;
const GRID_LEFT = (LAYOUT.width - GRID_WIDTH) / 2;

function text(scene, x, y, value, style) {
  return scene.add.text(x, y, value, { resolution: TEXT_RESOLUTION, ...style });
}

export class BoardScene extends Phaser.Scene {
  constructor() {
    super('Board');
  }

  create() {
    this.state = loadGame() ?? S.createState();
    this.sprites = new Array(S.CELL_COUNT).fill(null);
    this.resetArmed = false;

    this.drawField();
    this.drawGrid();
    this.drawHud();
    this.drawSellBin();
    this.drawShop();
    this.drawResetButton();
    this.overlay = this.add.graphics().setDepth(5);

    this.state.cells.forEach((unit, i) => unit && this.spawnSprite(i, false));
    this.setupDrag();
    this.refreshHud(true);

    const isNewGame = this.state.cells.filter(Boolean).length === 2 && this.state.highest.infantry === 1;
    this.toast(isNewGame ? 'Drag one soldier onto the other to merge' : 'Welcome back, Commander', 4000);

    this.time.addEvent({ delay: SAVE.intervalMs, loop: true, callback: () => this.persist() });
    const onHide = () => document.hidden && this.persist();
    document.addEventListener('visibilitychange', onHide);
    this.events.once('shutdown', () => document.removeEventListener('visibilitychange', onHide));
  }

  update(_time, delta) {
    // Clamp so a long background tab doesn't dump a huge tick on return.
    S.tick(this.state, Math.min(delta, 250) / 1000);
    this.refreshHud(false);
  }

  persist() {
    saveGame(this.state);
  }

  // ---------- Layout helpers ----------

  cellCenter(index) {
    const col = index % GRID.cols;
    const row = Math.floor(index / GRID.cols);
    return {
      x: GRID_LEFT + col * PITCH + LAYOUT.cell / 2,
      y: LAYOUT.gridTop + row * PITCH + LAYOUT.cell / 2,
    };
  }

  // Nearest cell under a point, or -1 when outside the board.
  cellAt(x, y) {
    const lx = x - GRID_LEFT;
    const ly = y - LAYOUT.gridTop;
    if (lx < 0 || ly < 0 || lx > GRID_WIDTH || ly > GRID_HEIGHT) return -1;
    const col = Math.min(Math.floor(lx / PITCH), GRID.cols - 1);
    const row = Math.min(Math.floor(ly / PITCH), GRID.rows - 1);
    return row * GRID.cols + col;
  }

  overSellBin(x, y) {
    return this.sellZone.getBounds().contains(x, y);
  }

  // ---------- Static scenery ----------

  drawField() {
    const g = this.add.graphics();
    g.fillStyle(COLORS.sand).fillRect(0, 0, LAYOUT.width, LAYOUT.height);
    // Faint tyre tracks across the sand.
    g.lineStyle(10, COLORS.sandDark, 0.35);
    for (let i = -2; i < 8; i++) {
      const x = i * 140;
      g.lineBetween(x, LAYOUT.height, x + 420, 0);
      g.lineBetween(x + 26, LAYOUT.height, x + 446, 0);
    }
  }

  drawGrid() {
    const g = this.add.graphics();
    g.fillStyle(COLORS.tileShade, 0.6).fillRoundedRect(GRID_LEFT - 14, LAYOUT.gridTop - 14, GRID_WIDTH + 28, GRID_HEIGHT + 28, 26);
    for (let i = 0; i < S.CELL_COUNT; i++) {
      const { x, y } = this.cellCenter(i);
      const h = LAYOUT.cell / 2;
      g.fillStyle(COLORS.tileShade).fillRoundedRect(x - h, y - h + 4, LAYOUT.cell, LAYOUT.cell, 18);
      g.fillStyle(COLORS.tile).fillRoundedRect(x - h, y - h, LAYOUT.cell, LAYOUT.cell - 4, 18);
    }
  }

  drawHud() {
    const g = this.add.graphics();
    g.fillStyle(COLORS.olive).fillRect(0, 0, LAYOUT.width, LAYOUT.hudHeight);
    g.fillStyle(COLORS.ink).fillRect(0, LAYOUT.hudHeight - 8, LAYOUT.width, 8);

    g.fillStyle(COLORS.goldDark).fillCircle(56, 72, 24);
    g.fillStyle(COLORS.gold).fillCircle(56, 68, 24);
    g.lineStyle(3, COLORS.goldDark).strokeCircle(56, 68, 15);

    text(this, 94, 22, 'GOLD', { fontFamily: FONTS.body, fontSize: '22px', fontStyle: '700', color: CSS.oliveMuted, letterSpacing: 3 });
    this.goldText = text(this, 92, 42, '0', { fontFamily: FONTS.display, fontSize: '64px', color: CSS.gold });
    this.rateText = text(this, 96, 112, '', { fontFamily: FONTS.body, fontSize: '28px', fontStyle: '600', color: CSS.paper });

    text(this, LAYOUT.width - 32, 22, 'BEST UNIT', {
      fontFamily: FONTS.body, fontSize: '22px', fontStyle: '700', color: CSS.oliveMuted, letterSpacing: 3,
    }).setOrigin(1, 0);
    this.bestTexts = {};
    S.TYPE_IDS.forEach((type, i) => {
      const y = 62 + i * 32;
      text(this, LAYOUT.width - 110, y, UNIT_TYPES[type].short, {
        fontFamily: FONTS.body, fontSize: '26px', fontStyle: '600', color: CSS.oliveMuted,
      }).setOrigin(1, 0);
      this.bestTexts[type] = text(this, LAYOUT.width - 32, y, '', {
        fontFamily: FONTS.body, fontSize: '26px', fontStyle: '700', color: CSS.paper,
      }).setOrigin(1, 0);
    });

    this.toastText = text(this, LAYOUT.width / 2, LAYOUT.toastY, '', {
      fontFamily: FONTS.body, fontSize: '30px', fontStyle: '700', color: CSS.ink, align: 'center',
    }).setOrigin(0.5).setDepth(20);
  }

  drawSellBin() {
    const w = GRID_WIDTH;
    const h = LAYOUT.sellHeight;
    const x = GRID_LEFT;
    const y = LAYOUT.sellY - h / 2;
    this.sellGraphics = this.add.graphics();
    this.sellZone = this.add.zone(x, y, w, h).setOrigin(0);
    this.sellLabel = text(this, LAYOUT.width / 2, LAYOUT.sellY, '', {
      fontFamily: FONTS.body, fontSize: '28px', fontStyle: '700', color: CSS.olive, letterSpacing: 2,
    }).setOrigin(0.5);
    this.paintSellBin(null);
  }

  // hoverValue: the sell price while a unit hovers over the bin, otherwise null.
  paintSellBin(hoverValue, dragging = false) {
    const w = GRID_WIDTH;
    const h = LAYOUT.sellHeight;
    const x = GRID_LEFT;
    const y = LAYOUT.sellY - h / 2;
    const g = this.sellGraphics.clear();
    const hovering = hoverValue !== null;
    g.fillStyle(hovering ? COLORS.danger : COLORS.tileShade, hovering ? 1 : dragging ? 0.75 : 0.45).fillRoundedRect(x, y, w, h, 18);
    g.lineStyle(3, hovering ? COLORS.paper : COLORS.olive, hovering ? 1 : 0.5).strokeRoundedRect(x, y, w, h, 18);
    this.sellLabel.setText(hovering ? `SELL FOR ${formatNumber(hoverValue)} GOLD` : 'DRAG A UNIT HERE TO SELL');
    this.sellLabel.setColor(hovering ? CSS.paper : CSS.olive);
    this.sellLabel.setAlpha(hovering || dragging ? 1 : 0.7);
  }

  drawShop() {
    const w = (GRID_WIDTH - 2 * 18) / 3;
    const h = LAYOUT.shopHeight;
    this.shopButtons = {};
    S.TYPE_IDS.forEach((type, i) => {
      const left = GRID_LEFT + i * (w + 18);
      const top = LAYOUT.shopY - h / 2;
      const cx = left + w / 2;
      const bg = this.add.graphics();
      const icon = createUnitIcon(this, cx, top + 50, type, 0.9);
      const name = text(this, cx, top + 96, `BUY ${UNIT_TYPES[type].name.toUpperCase()}`, {
        fontFamily: FONTS.body, fontSize: '24px', fontStyle: '700', color: CSS.paper, letterSpacing: 1,
      }).setOrigin(0.5);
      const price = text(this, cx, top + 132, '', {
        fontFamily: FONTS.display, fontSize: '32px', color: CSS.paper,
      }).setOrigin(0.5);
      const zone = this.add.zone(left, top, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
      const button = { type, left, top, w, h, bg, parts: [icon, name, price], price, pressed: false, enabled: null };
      zone.on('pointerdown', () => {
        button.pressed = true;
        this.paintShopButton(button);
      });
      const release = () => {
        if (!button.pressed) return;
        button.pressed = false;
        this.paintShopButton(button);
      };
      zone.on('pointerout', release);
      zone.on('pointerup', () => {
        const wasPressed = button.pressed;
        release();
        if (wasPressed) this.buy(type);
      });
      this.shopButtons[type] = button;
    });
  }

  paintShopButton(button) {
    const { left, top, w, h, bg, pressed, enabled } = button;
    const face = enabled ? COLORS.signal : COLORS.disabled;
    const edge = enabled ? COLORS.signalDark : COLORS.disabledDark;
    const dy = pressed ? 6 : 0;
    bg.clear();
    bg.fillStyle(edge).fillRoundedRect(left, top + 8, w, h - 8, 22);
    bg.fillStyle(face).fillRoundedRect(left, top + dy, w, h - 8, 22);
    bg.lineStyle(3, COLORS.ink, 0.25).strokeRoundedRect(left, top + dy, w, h - 8, 22);
    const baseY = [50, 96, 132];
    button.parts.forEach((part, i) => part.setY(top + baseY[i] + dy - 4));
  }

  drawResetButton() {
    const label = text(this, LAYOUT.width / 2, LAYOUT.resetY, 'Reset progress', {
      fontFamily: FONTS.body, fontSize: '24px', fontStyle: '600', color: CSS.olive,
    }).setOrigin(0.5).setAlpha(0.6).setInteractive({ useHandCursor: true });
    label.on('pointerup', () => {
      if (!this.resetArmed) {
        this.resetArmed = true;
        label.setText('Tap again to erase your base').setColor(CSS.danger).setAlpha(1);
        this.time.delayedCall(3000, () => {
          this.resetArmed = false;
          label.setText('Reset progress').setColor(CSS.olive).setAlpha(0.6);
        });
        return;
      }
      clearSave();
      this.scene.restart();
    });
  }

  // ---------- HUD ----------

  refreshHud(force) {
    const gold = formatNumber(this.state.gold);
    if (force || gold !== this.lastGold) {
      this.goldText.setText(gold);
      this.lastGold = gold;
    }
    const rate = `+${formatRate(S.incomePerSecond(this.state))} gold / sec`;
    if (force || rate !== this.lastRate) {
      this.rateText.setText(rate);
      this.lastRate = rate;
    }
    const full = S.firstEmptyCell(this.state) === -1;
    for (const type of S.TYPE_IDS) {
      const button = this.shopButtons[type];
      const cost = S.unitCost(this.state, type);
      const enabled = !full && this.state.gold >= cost;
      const label = full ? 'BOARD FULL' : formatNumber(cost);
      if (force || enabled !== button.enabled || label !== button.priceLabel) {
        button.enabled = enabled;
        button.priceLabel = label;
        button.price.setText(label).setFontSize(full ? '26px' : '32px');
        this.paintShopButton(button);
      }
      this.bestTexts[type].setText(`Lv ${this.state.highest[type]}`);
    }
  }

  toast(message, duration = 2200, color = CSS.ink) {
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setText(message).setColor(color).setAlpha(1).setScale(1);
    this.tweens.add({ targets: this.toastText, scale: { from: 1.08, to: 1 }, duration: 180 });
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: duration, duration: 400 });
  }

  // ---------- Units ----------

  spawnSprite(index, animate) {
    const unit = this.state.cells[index];
    const { x, y } = this.cellCenter(index);
    const view = createUnitView(this, x, y, unit, UNIT_SIZE);
    view.setData('index', index).setDepth(10);
    view.setInteractive({ draggable: true, useHandCursor: true });
    this.sprites[index] = view;
    if (animate) {
      view.setScale(0.2);
      this.tweens.add({ targets: view, scale: 1, duration: 260, ease: 'Back.easeOut' });
    }
    return view;
  }

  moveSpriteTo(view, index) {
    const { x, y } = this.cellCenter(index);
    view.setData('index', index);
    this.sprites[index] = view;
    this.tweens.add({ targets: view, x, y, scale: 1, duration: 160, ease: 'Quad.easeOut', onComplete: () => view.setDepth(10) });
  }

  setupDrag() {
    this.input.on('dragstart', (_pointer, view) => {
      view.setDepth(50);
      this.tweens.killTweensOf(view);
      this.tweens.add({ targets: view, scale: 1.12, duration: 100 });
      this.dragFrom = view.getData('index');
    });

    this.input.on('drag', (pointer, view, dragX, dragY) => {
      view.setPosition(dragX, dragY);
      this.paintDragHints(pointer.worldX, pointer.worldY);
    });

    this.input.on('dragend', (pointer) => {
      const from = this.dragFrom;
      this.dragFrom = null;
      this.overlay.clear();
      this.paintSellBin(null);
      this.dropUnit(from, pointer.worldX, pointer.worldY);
    });
  }

  // Ring every unit that the dragged one can merge with, and outline the drop target.
  paintDragHints(px, py) {
    const g = this.overlay.clear();
    const dragged = this.state.cells[this.dragFrom];
    if (!dragged) return;
    const h = LAYOUT.cell / 2;
    const target = this.cellAt(px, py);
    const pulse = 0.55 + 0.45 * Math.sin(this.time.now / 140);

    this.state.cells.forEach((unit, i) => {
      if (i === this.dragFrom || !S.canMerge(dragged, unit)) return;
      const { x, y } = this.cellCenter(i);
      g.lineStyle(6, COLORS.mergeGlow, pulse).strokeRoundedRect(x - h + 2, y - h + 2, LAYOUT.cell - 4, LAYOUT.cell - 4, 18);
    });

    if (target !== -1 && target !== this.dragFrom) {
      const { x, y } = this.cellCenter(target);
      const merging = S.canMerge(dragged, this.state.cells[target]);
      g.fillStyle(merging ? COLORS.mergeGlow : COLORS.paper, 0.35).fillRoundedRect(x - h, y - h, LAYOUT.cell, LAYOUT.cell - 4, 18);
    }

    const overBin = this.overSellBin(px, py);
    this.paintSellBin(overBin ? S.sellValue(dragged) : null, true);
  }

  dropUnit(from, px, py) {
    const view = this.sprites[from];
    if (!view) return;

    if (this.overSellBin(px, py)) {
      const { value } = S.sellUnit(this.state, from);
      this.sprites[from] = null;
      view.disableInteractive();
      this.tweens.add({ targets: view, scale: 0, alpha: 0, duration: 200, onComplete: () => view.destroy() });
      this.floatText(px, py - 40, `+${formatNumber(value)}`, CSS.gold);
      this.afterAction();
      return;
    }

    const to = this.cellAt(px, py);
    const result = to === -1 ? { kind: 'none' } : S.moveUnit(this.state, from, to);

    if (result.kind === 'none') {
      this.moveSpriteTo(view, from);
    } else if (result.kind === 'move') {
      this.sprites[from] = null;
      this.moveSpriteTo(view, to);
    } else if (result.kind === 'swap') {
      const other = this.sprites[to];
      this.moveSpriteTo(view, to);
      this.moveSpriteTo(other, from);
    } else if (result.kind === 'merge') {
      this.sprites[from] = null;
      view.destroy();
      this.sprites[to].destroy();
      const merged = this.spawnSprite(to, false);
      this.mergeBurst(to, merged, result);
    }
    this.afterAction();
  }

  mergeBurst(index, view, result) {
    const { x, y } = this.cellCenter(index);
    view.setScale(1.45);
    this.tweens.add({ targets: view, scale: 1, duration: 320, ease: 'Back.easeOut' });

    const ring = this.add.graphics().setDepth(40).setPosition(x, y);
    ring.lineStyle(8, COLORS.mergeGlow).strokeCircle(0, 0, 40);
    this.tweens.add({ targets: ring, scale: 2, alpha: 0, duration: 380, onComplete: () => ring.destroy() });

    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const spark = this.add.graphics().setDepth(40).setPosition(x, y);
      spark.fillStyle(i % 2 ? COLORS.gold : COLORS.paper).fillCircle(0, 0, 7);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * 90,
        y: y + Math.sin(angle) * 90,
        scale: 0.2,
        alpha: 0,
        duration: 420,
        ease: 'Quad.easeOut',
        onComplete: () => spark.destroy(),
      });
    }

    if (result.discovered) {
      const name = UNIT_TYPES[this.state.cells[index].type].name;
      this.cameras.main.shake(160, 0.004);
      this.toast(`New unit: ${name} Lv ${result.level}!  +${formatNumber(result.reward)} gold`, 2600, CSS.olive);
      this.floatText(x, y - 70, `+${formatNumber(result.reward)}`, CSS.gold);
    }
  }

  floatText(x, y, message, color) {
    const t = text(this, x, y, message, {
      fontFamily: FONTS.display, fontSize: '40px', color, stroke: CSS.ink, strokeThickness: 6,
    }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  buy(type) {
    const result = S.buyUnit(this.state, type);
    if (!result.ok) {
      this.toast(
        result.reason === 'full'
          ? 'Board is full. Merge or sell a unit to make room.'
          : `Need ${formatNumber(result.cost - this.state.gold)} more gold`,
        2000,
        CSS.danger,
      );
      return;
    }
    this.spawnSprite(result.index, true);
    this.afterAction();
  }

  afterAction() {
    this.refreshHud(true);
    this.persist();
  }
}
