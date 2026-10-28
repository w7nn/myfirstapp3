import { VIEW } from './config.js';
import { GameScene } from './scenes/GameScene.js';

// Phaser draws text onto a canvas, so the web fonts must be ready before the first frame.
function fontsReady() {
  if (!document.fonts) return Promise.resolve();
  const loads = Promise.all([
    document.fonts.load('48px "Lilita One"'),
    document.fonts.load('800 24px "Nunito"'),
  ]);
  const timeout = new Promise((resolve) => setTimeout(resolve, 2500));
  return Promise.race([loads, timeout]).catch(() => {});
}

fontsReady().then(() => {
  window.squadRush = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: VIEW.width,
    height: VIEW.height,
    backgroundColor: '#3fa7c9',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [GameScene],
  });
});
