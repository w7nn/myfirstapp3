// Every sprite is drawn once with Graphics and baked into a texture, so there are no image files.

import { VIEW, ROAD } from './config.js';
import { COLORS } from './theme.js';

function bake(scene, key, width, height, draw) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
}

export function createTextures(scene) {
  // Top-down blue soldier, rifle pointing up the road.
  bake(scene, 'soldier', 44, 48, (g) => {
    g.fillStyle(0x000000, 0.18).fillEllipse(22, 36, 34, 14);
    g.fillStyle(COLORS.gunmetal).fillRect(27, 2, 5, 22);
    g.fillStyle(COLORS.blue).fillEllipse(22, 28, 34, 22);
    g.lineStyle(2, COLORS.blueDark).strokeEllipse(22, 28, 34, 22);
    g.fillStyle(COLORS.blueHelmet).fillCircle(22, 22, 11);
    g.lineStyle(2, COLORS.blueDark).strokeCircle(22, 22, 11);
    g.fillStyle(COLORS.white, 0.6).fillCircle(18, 18, 4);
  });

  // Red raider charging down the road, rifle pointing at the squad.
  bake(scene, 'enemy', 48, 52, (g) => {
    g.fillStyle(0x000000, 0.18).fillEllipse(24, 40, 36, 14);
    g.fillStyle(COLORS.gunmetal).fillRect(14, 24, 5, 24);
    g.fillStyle(COLORS.beige).fillEllipse(24, 26, 36, 24);
    g.lineStyle(2, COLORS.beigeDark).strokeEllipse(24, 26, 36, 24);
    g.fillStyle(COLORS.red).fillRect(10, 24, 28, 6);
    g.fillStyle(COLORS.red).fillCircle(24, 22, 12);
    g.lineStyle(2, COLORS.redDark).strokeCircle(24, 22, 12);
    g.fillStyle(COLORS.white, 0.55).fillCircle(20, 18, 4);
  });

  bake(scene, 'bullet', 12, 26, (g) => {
    g.fillStyle(COLORS.bullet, 0.45).fillEllipse(6, 13, 12, 26);
    g.fillStyle(COLORS.white).fillEllipse(6, 11, 5, 16);
  });

  bake(scene, 'spark', 12, 12, (g) => {
    g.fillStyle(COLORS.white).fillCircle(6, 6, 6);
  });

  bake(scene, 'ice', 150, 110, (g) => {
    g.fillStyle(COLORS.iceEdge).fillRoundedRect(0, 6, 150, 104, 18);
    g.fillStyle(COLORS.ice, 0.95).fillRoundedRect(0, 0, 150, 102, 18);
    g.fillStyle(COLORS.white, 0.55).fillRoundedRect(10, 8, 60, 14, 7);
    g.lineStyle(3, COLORS.white, 0.7);
    g.lineBetween(110, 10, 96, 40).lineBetween(96, 40, 124, 62).lineBetween(30, 96, 46, 70);
    g.lineStyle(3, COLORS.iceEdge).strokeRoundedRect(1, 1, 148, 100, 18);
  });

  bake(scene, 'gun', 84, 30, (g) => {
    g.fillStyle(COLORS.gunmetal);
    g.fillRect(4, 8, 56, 10); // body
    g.fillRect(56, 11, 26, 4); // barrel
    g.fillTriangle(4, 8, 4, 26, 18, 18); // stock
    g.fillRect(30, 18, 8, 12); // magazine
    g.fillStyle(COLORS.blueHelmet).fillRect(20, 10, 22, 4);
  });

  bake(scene, 'jar', 110, 130, (g) => {
    g.fillStyle(0x000000, 0.15).fillEllipse(55, 122, 96, 16);
    g.fillStyle(COLORS.glass, 0.55).fillRoundedRect(4, 14, 102, 110, 24);
    g.lineStyle(3, COLORS.iceEdge).strokeRoundedRect(4, 14, 102, 110, 24);
    g.fillStyle(COLORS.white, 0.6).fillRoundedRect(14, 26, 12, 70, 6);
    g.fillStyle(COLORS.lid).fillRoundedRect(14, 2, 82, 18, 8);
  });

  // One tile of bridge and water; a TileSprite scrolls it.
  bake(scene, 'road', VIEW.width, 256, (g) => {
    g.fillStyle(COLORS.water).fillRect(0, 0, VIEW.width, 256);
    g.lineStyle(4, COLORS.waterLight, 0.7);
    g.lineBetween(24, 40, 60, 40).lineBetween(70, 170, 96, 170);
    g.lineBetween(VIEW.width - 80, 90, VIEW.width - 44, 90).lineBetween(VIEW.width - 100, 210, VIEW.width - 70, 210);
    const edge = 26;
    g.fillStyle(COLORS.rail).fillRect(ROAD.left - edge, 0, edge, 256).fillRect(ROAD.right, 0, edge, 256);
    g.fillStyle(COLORS.roadEdge).fillRect(ROAD.left - edge + 6, 0, 6, 256).fillRect(ROAD.right + edge - 12, 0, 6, 256);
    g.fillStyle(COLORS.road).fillRect(ROAD.left, 0, ROAD.right - ROAD.left, 256);
    g.fillStyle(COLORS.roadEdge).fillRect(ROAD.left, 0, 10, 256).fillRect(ROAD.right - 10, 0, 10, 256);
    g.fillStyle(COLORS.dash, 0.9).fillRect((ROAD.left + ROAD.right) / 2 - 4, 40, 8, 90);
    // Rail posts.
    g.fillStyle(COLORS.ink, 0.35);
    for (let y = 16; y < 256; y += 64) {
      g.fillRect(ROAD.left - edge, y, edge, 6).fillRect(ROAD.right, y, edge, 6);
    }
  });
}
