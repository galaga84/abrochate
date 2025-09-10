// src/scenes/TitleScene.js
export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
    this.bgm = null;
  }

  preload() {
    this.load.audio('bgm', 'assets/audio/music/music.wav');
    this.load.image('logo', 'assets/img/logo.png');
    // Fondo pantalla completa
    this.load.image('titleBG', 'assets/img/inicio-01.png');
  }

  create() {
    const { width, height } = this.scale;

    // ===== Fondo (cover) =====
    const bg = this.add.image(width * 0.5, height * 0.5, 'titleBG')
      .setOrigin(0.5)
      .setDepth(-10)
      .setScrollFactor(0);

    const fitBG = () => {
      const w = this.scale.width;
      const h = this.scale.height;
      bg.setPosition(w * 0.5, h * 0.5);
      const scaleX = w / bg.width;
      const scaleY = h / bg.height;
      bg.setScale(Math.max(scaleX, scaleY)); // cover
    };
    fitBG();

    // ===== Audio =====
    let bgm = this.sound.get('bgm');
    if (!bgm) {
      bgm = this.sound.add('bgm', { loop: true, volume: 0.6 });
    }
    this.bgm = bgm;

    const tryPlay = () => {
      if (!this.bgm.isPlaying) this.bgm.play();
    };

    if (this.sound.locked) {
      this.sound.once('unlocked', tryPlay);
    } else {
      tryPlay();
    }

    // ===== LOGO (mitad superior) =====
    const logo = this.add.image(width * 0.5, height * 0.25, 'logo').setOrigin(0.5);
    const sizeLogo = () => {
      const maxLogoW = this.scale.width * 0.7;
      const maxLogoH = this.scale.height * 0.30;
      const s = Math.min(maxLogoW / logo.width, maxLogoH / logo.height, 1);
      logo.setScale(s);
      logo.setPosition(this.scale.width * 0.5, this.scale.height * 0.25);
    };
    sizeLogo();

    // ===== BOTÓN cápsula (mitad inferior) =====
    const btnWidth = Math.min(440, width * 0.75);
    const btnHeight = 96;
    const radius = 48;

    const g = this.add.graphics();
    g.fillStyle(0x4f0b7b, 1).fillRoundedRect(0, 0, btnWidth, btnHeight, radius);
    g.generateTexture('btnCapsule', btnWidth, btnHeight);
    g.destroy();

    const button = this.add.image(this.scale.width * 0.5, this.scale.height * 0.75, 'btnCapsule')
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const label = this.add.text(button.x, button.y, 'Comenzar', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Arial',
      fontSize: '36px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const placeButton = () => {
      button.setPosition(this.scale.width * 0.5, this.scale.height * 0.75);
      label.setPosition(button.x, button.y);
    };
    placeButton();

    // En la PRIMERA interacción, fuerza el play (por si 'unlocked' ya pasó)
    const ensureMusic = () => {
      if (this.sound.locked) return;
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

    // ===== Manejo de resize =====
    const onResize = (gameSize) => {
      fitBG();
      sizeLogo();
      placeButton();
    };
    this.scale.on('resize', onResize);

    // Limpiar listener al salir de la escena
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', onResize);
    });
  }
}

