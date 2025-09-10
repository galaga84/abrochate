// src/main.js
import TitleScene from './scenes/TitleScene.js';
import IntroScene from './scenes/IntroScene.js';
import PlayScene from './scenes/PlayScene.js';
import GameOverScene from './scenes/GameOverScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#111427',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 720,   // Vertical 9:16 aprox
    height: 1280,
  },
  audio: { disableWebAudio: false },
  scene: [TitleScene, IntroScene, PlayScene, GameOverScene], // arranca en TitleScene
};

window.addEventListener('load', () => {
  new Phaser.Game(config);
});




