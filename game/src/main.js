import { LAYOUT } from './config.js';
import { BoardScene } from './scenes/BoardScene.js';

// Phaser draws text onto a canvas, so the web fonts must be ready before the first frame.
function fontsReady() {
  if (!document.fonts) return Promise.resolve();
  const loads = Promise.all([
    document.fonts.load('48px "Saira Stencil One"'),
    document.fonts.load('600 24px "Barlow Condensed"'),
    document.fonts.load('700 24px "Barlow Condensed"'),
  ]);
  const timeout = new Promise((resolve) => setTimeout(resolve, 2500));
  return Promise.race([loads, timeout]).catch(() => {});
}

fontsReady().then(() => {
  window.mergeCommand = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: LAYOUT.width,
    height: LAYOUT.height,
    backgroundColor: '#d8c79c',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BoardScene],
  });
});
