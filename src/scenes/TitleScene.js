// src/scenes/TitleScene.js
export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
    this.bgm = null;
  }

 preload() {
  this.load.audio('bgm', 'assets/audio/music/music.wav');
  this.load.image('logo', 'assets/img/logo.png');
}

  create() {
  const { width, height } = this.scale;

  // 1) Reusar una instancia existente si ya fue creada en otra visita a la escena
  let bgm = this.sound.get('bgm');
  if (!bgm) {
    bgm = this.sound.add('bgm', { loop: true, volume: 0.6 });
  }
  this.bgm = bgm;

  // 2) Solo reproducir si NO está sonando
  const tryPlay = () => {
    if (!this.bgm.isPlaying) this.bgm.play();
  };

  if (this.sound.locked) {
    // Desbloqueo en móvil: solo suscríbete si está bloqueado
    this.sound.once('unlocked', tryPlay);
  } else {
    tryPlay();
  }

    // LOGO (mitad superior)
    const logo = this.add.image(width * 0.5, height * 0.25, 'logo').setOrigin(0.5);
    const maxLogoW = width * 0.7, maxLogoH = height * 0.30;
    logo.setScale(Math.min(maxLogoW / logo.width, maxLogoH / logo.height, 1));

    // BOTÓN cápsula (mitad inferior)
    const btnWidth = Math.min(440, width * 0.75), btnHeight = 96, radius = 48;
    const g = this.add.graphics();
    g.fillStyle(0x4f0b7b, 1).fillRoundedRect(0, 0, btnWidth, btnHeight, radius);
    g.generateTexture('btnCapsule', btnWidth, btnHeight);
    g.destroy();

    const button = this.add.image(width * 0.5, height * 0.75, 'btnCapsule').setOrigin(0.5).setInteractive({ useHandCursor: true });
    const label  = this.add.text(button.x, button.y, 'Comenzar', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Arial',
      fontSize: '36px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    // En la PRIMERA interacción, fuerza el play (por si el evento 'unlocked' ya pasó)
    const ensureMusic = () => {
      if (this.sound.locked) return; // aún bloqueado, 'unlocked' hará el play
      if (this.bgm && !this.bgm.isPlaying) this.bgm.play();
    };
    this.input.once('pointerdown', ensureMusic);

    // Efectos de hover/click
    const press = () => button.setAlpha(0.85);
    const release = () => button.setAlpha(1);
    button.on('pointerover', () => button.setAlpha(0.92));
    button.on('pointerout',  release);
    button.on('pointerdown', press);
    const goIntro = () => { release(); ensureMusic(); this.scene.start('IntroScene'); };
    button.on('pointerup', goIntro);
    label.on('pointerup',  goIntro);

    // Acceso con teclado (desktop)
    this.input.keyboard?.on('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') goIntro();
    });
  }
}


