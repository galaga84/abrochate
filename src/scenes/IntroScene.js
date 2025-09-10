// src/scenes/IntroScene.js
export default class IntroScene extends Phaser.Scene {
  constructor() {
    super('IntroScene');

    this.transitioning = false;
    this.bg1 = null;
    this.bg2 = null;
    this.prompt = null;
    this.handleZone = null;

    // efectos
    this.sfxPasos = null;
    this.sfxAbrir = null;
    this.sfxCerrar = null;
  }

  preload() {
    this.load.image('bg_intro', 'assets/img/fondo-intro.png');
    this.load.image('bg_intro_2', 'assets/img/fondo-intro-2.png');

    // audios
    this.load.audio('pasos', 'assets/audio/sfx/pasos.wav');
    this.load.audio('abrir', 'assets/audio/sfx/abrir.wav');
    this.load.audio('cerrar', 'assets/audio/sfx/cerrar.mp3');
  }

  create() {
    const { width, height } = this.scale;

    // Fondo 1
    this.bg1 = this.add.image(width * 0.5, height * 0.5, 'bg_intro').setOrigin(0.5);
    this.fitCover(this.bg1);

    // Fondo 2 (oculto)
    this.bg2 = this.add.image(width * 0.5, height * 0.5, 'bg_intro_2')
      .setOrigin(0.5)
      .setAlpha(0);
    this.fitCover(this.bg2);

    // Texto
    const textY = height * 0.35;
    this.prompt = this.add.text(width * 0.5, textY, 'Haz click para abrir la puerta del automóvil', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Arial',
      fontSize: '40px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: Math.min(width * 0.85, 700), useAdvancedWrap: true },
    }).setOrigin(0.5).setAlpha(0);
    this.prompt.setShadow(0, 2, '#000000', 4, true, true);

    // Hotspot
    this.handleZone = this.add.zone(474.5, 664, 156, 81)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    // Cámara
    const cam = this.cameras.main;
    cam.fadeIn(400, 0, 0, 0);

    // Animaciones de entrada
    this.tweens.add({
      targets: this.bg1,
      scale: this.bg1.scale * 1.03,
      duration: 2200,
      ease: 'Quad.easeOut'
    });

    this.tweens.add({
      targets: this.prompt,
      alpha: 1,
      y: textY - 8,
      duration: 650,
      ease: 'Quad.easeOut',
      delay: 200
    });

    // --- inicializar sonidos ---
    this.sfxPasos = this.sound.add('pasos');
    this.sfxAbrir = this.sound.add('abrir');
    this.sfxCerrar = this.sound.add('cerrar');

    // Pasos inicial (2 segundos)
    this.sfxPasos.play({ volume: 1 });
    this.time.delayedCall(2000, () => this.sfxPasos.stop());

    // --- Interacción ---
    const goNext = () => {
      if (this.transitioning) return;
      this.transitioning = true;
      this.handleZone.disableInteractive();

      // Abrir puerta inmediatamente
      this.sfxAbrir.play({ volume: 1 });

      // Pasos (2s) durante el cruce a la imagen 2
      this.sfxPasos.play({ volume: 1 });
      this.time.delayedCall(2000, () => this.sfxPasos.stop());

      // Crossfade a bg2
      this.tweens.add({
        targets: this.bg2,
        alpha: 1,
        duration: 600,
        ease: 'Quad.easeInOut',
        onStart: () => {
          this.tweens.add({ targets: this.prompt, alpha: 0, duration: 300, ease: 'Quad.easeOut' });
        },
        onComplete: () => {
          // Zoom suave 3s en la imagen 2
          this.tweens.add({
            targets: this.bg2,
            scale: this.bg2.scale * 1.90,
            duration: 3000,
            ease: 'Quad.easeInOut'
          });

          // Tras 3s, funde a negro
          this.time.delayedCall(3000, () => {
            cam.fadeOut(500, 0, 0, 0);

            // ✅ Cuando YA está todo en negro (bg2 ya no visible), reproduce "cerrar"
            cam.once('camerafadeoutcomplete', () => {
              // reproducir cerrar.mp3 cuando la imagen 2 ya se desvaneció
              this.sfxCerrar.play({ volume: 1 });

              // esperar a que termine cerrar.mp3 y luego cambiar de escena
              const durMs = (this.sfxCerrar.duration || 1.0) * 1000;
              this.sfxCerrar.once('complete', () => this.scene.start('PlayScene'));

              // Fallback por si el evento 'complete' no dispara en algún navegador
              this.time.delayedCall(Math.ceil(durMs) + 50, () => {
                if (!this.scene.isActive('PlayScene')) this.scene.start('PlayScene');
              });
            });
          });
        }
      });
    };

    this.handleZone.once('pointerdown', goNext);
    this.input.keyboard?.once('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') goNext();
    });

    this.scale.on('resize', this.onResize, this);
  }

  onResize(gameSize) {
    const { width, height } = gameSize;
    const cx = width * 0.5;
    const cy = height * 0.5;

    if (this.bg1) { this.bg1.setPosition(cx, cy); this.fitCover(this.bg1, width, height); }
    if (this.bg2) { this.bg2.setPosition(cx, cy); this.fitCover(this.bg2, width, height); }
    if (this.prompt) {
      this.prompt.setPosition(cx, height * 0.35);
      this.prompt.setWordWrapWidth(Math.min(width * 0.85, 700), true);
    }
  }

  fitCover(img, w = this.scale.width, h = this.scale.height) {
    const scaleX = w / img.width;
    const scaleY = h / img.height;
    img.setScale(Math.max(scaleX, scaleY));
  }
}








