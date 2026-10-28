// Unit art drawn with Phaser Graphics, so the prototype needs no image assets.

import { COLORS, FONTS, TEXT_RESOLUTION, tierColor } from './theme.js';

function darken(color, amount) {
  const c = Phaser.Display.Color.IntegerToColor(color);
  c.darken(amount);
  return c.color;
}

function drawInfantry(g) {
  // Shoulders, face, helmet with brim.
  g.fillStyle(COLORS.oliveLight).fillRoundedRect(-24, 14, 48, 22, 10);
  g.fillStyle(COLORS.skin).fillCircle(0, 6, 14);
  g.fillStyle(COLORS.ink).fillCircle(-5, 8, 2).fillCircle(5, 8, 2);
  g.fillStyle(COLORS.paper).slice(0, 0, 19, Math.PI, 0, false).fillPath();
  g.fillRect(-25, -2, 50, 6);
  g.lineStyle(3, COLORS.ink).strokeRect(-25, -2, 50, 6);
}

function drawTank(g) {
  g.fillStyle(COLORS.ink).fillRoundedRect(-33, 10, 66, 14, 7);
  g.fillStyle(COLORS.paper).fillRoundedRect(-28, -4, 56, 18, 5);
  g.fillRect(8, -11, 30, 7);
  g.fillCircle(0, -6, 13);
  g.lineStyle(3, COLORS.ink).strokeCircle(0, -6, 13);
  g.fillStyle(COLORS.paper);
  for (let x = -24; x <= 24; x += 12) g.fillCircle(x, 17, 3);
}

function drawAircraft(g) {
  g.fillStyle(COLORS.paper);
  g.fillTriangle(-34, 6, 34, 6, 0, -10);
  g.fillTriangle(-14, 28, 14, 28, 0, 18);
  g.fillRoundedRect(-6, -32, 12, 62, 6);
  g.fillStyle(COLORS.ink).fillRoundedRect(-3, -24, 6, 10, 3);
}

const ICONS = { infantry: drawInfantry, tank: drawTank, aircraft: drawAircraft };

// Returns a container centred on (x, y) showing one unit.
export function createUnitView(scene, x, y, unit, size) {
  const half = size / 2;
  const plate = tierColor(unit.level);
  const g = scene.add.graphics();

  g.fillStyle(0x000000, 0.18).fillEllipse(0, half - 4, size * 0.8, 14);
  g.fillStyle(darken(plate, 18)).fillRoundedRect(-half, -half + 6, size, size - 6, 22);
  g.fillStyle(plate).fillRoundedRect(-half, -half, size, size - 8, 22);
  g.lineStyle(3, darken(plate, 30)).strokeRoundedRect(-half, -half, size, size - 8, 22);

  const icon = scene.add.graphics();
  ICONS[unit.type](icon);
  icon.setPosition(0, -4);

  const badge = scene.add.graphics();
  badge.fillStyle(COLORS.ink).fillCircle(half - 14, -half + 14, 18);
  badge.lineStyle(3, COLORS.paper).strokeCircle(half - 14, -half + 14, 18);
  const label = scene.add
    .text(half - 14, -half + 14, String(unit.level), {
      fontFamily: FONTS.display,
      fontSize: unit.level >= 10 ? '20px' : '24px',
      color: '#f6f1e3',
      resolution: TEXT_RESOLUTION,
    })
    .setOrigin(0.5);

  const container = scene.add.container(x, y, [g, icon, badge, label]);
  container.setSize(size, size);
  return container;
}

// Small icon-only plate used on shop buttons.
export function createUnitIcon(scene, x, y, type, scale) {
  const g = scene.add.graphics();
  ICONS[type](g);
  g.setPosition(x, y).setScale(scale);
  return g;
}
