// GameOverScene.js
export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');

    this.finalScore = 0;
    this._bg = null;
    this._bgmGO = null;

    this._ui = { scrim:null, panel:null, title:null, scoreTxt:null, bestTxt:null, retryBtn:null };
    this._onResize = null;
    this._keys = null;
  }

  preload() {
    this.load.image('bg_gameover', 'assets/img/fondo-final.png');
    this.load.audio('sfx_gameover', 'assets/audio/sfx/motor-encendido.wav');
    this.load.audio('bgm_gameover', 'assets/audio/music/over.wav');
  }

  init(data) {
    this.finalScore = (data && typeof data.score === 'number') ? data.score : 0;
  }

  create() {
    const { width, height } = this.scale;

    // Audio: corta lo anterior y reproduce GO
    try { this.sound.stopAll(); } catch {}
    if (this.cache.audio?.exists('sfx_gameover')) this.sound.play('sfx_gameover', { volume: 0.9 });
    if (this.cache.audio?.exists('bgm_gameover')) {
      this._bgmGO = this.sound.add('bgm_gameover', { loop: true, volume: 0.7 });
      this._bgmGO.play();
    }

    // Fondo cover
    const bgKey = this.textures.exists('bg_gameover') ? 'bg_gameover' :
                  (this.textures.exists('bg') ? 'bg' : null);
    if (bgKey) {
      this._bg = this.add.image(width/2, height/2, bgKey).setOrigin(0.5).setDepth(0);
      this._fitCover(this._bg, width, height);
    }

    // UI
    this._ui.scrim = this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.60).setDepth(1);
    const pw = Math.min(520, width * 0.9);
    const ph = Math.min(360, height * 0.8);
    this._ui.panel = this.add.rectangle(width/2, height/2, pw, ph, 0x1a1a1a, 0.98)
      .setStrokeStyle(2, 0xffffff, 0.15).setDepth(2);
    this._ui.title = this.add.text(width/2, height/2 - ph*0.32, '¡Fin del juego!', {
      fontSize: '32px', color: '#ffffff', align: 'center'
    }).setOrigin(0.5).setDepth(3);

    // récord local
    const bestKey = 'bestScore';
    let best = Number(localStorage.getItem(bestKey) || 0);
    let isNewBest = false;
    if (this.finalScore > best) {
      best = this.finalScore; isNewBest = true;
      try { localStorage.setItem(bestKey, String(best)); } catch {}
    }

    this._ui.scoreTxt = this.add.text(width/2, this._ui.title.y + 48, `Puntaje: ${this.finalScore}`, {
      fontSize: '22px', color: '#ffffff'
    }).setOrigin(0.5).setDepth(3);

    this._ui.bestTxt = this.add.text(
      width/2,
      this._ui.scoreTxt.y + 28,
      isNewBest ? `Récord: ${best} (¡Nuevo!)` : `Récord: ${best}`,
      { fontSize: '18px', color: isNewBest ? '#86ff86' : '#dddddd' }
    ).setOrigin(0.5).setDepth(3);

    // Botón Reintentar
    const makeBtn = (x, y, w, h, label, cb) => {
      const bg = this.add.rectangle(x, y, w, h, 0x2b2b2b, 1)
        .setStrokeStyle(2, 0xffffff, 0.25).setDepth(3).setInteractive({ useHandCursor: true });
      const txt = this.add.text(x, y, label, { fontSize: '18px', color: '#ffffff' })
        .setOrigin(0.5).setDepth(4);
      bg.on('pointerover', () => bg.setAlpha(0.9));
      bg.on('pointerout',  () => bg.setAlpha(1));
      bg.on('pointerup',   () => cb && cb());
      return { bg, txt };
    };

    const btnW = Math.min(220, pw * 0.7);
    const btnH = 50;
    const btnY = this._ui.bestTxt.y + 70;
    this._ui.retryBtn = makeBtn(width/2, btnY, btnW, btnH, 'Reintentar', () => this._startPlay());

    // Teclas
    this._keys = this.input.keyboard.addKeys({
      enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE
    });
    this._keys.enter.on('down', () => this._ui?.retryBtn?.bg?.emit('pointerup'));
    this._keys.space.on('down', () => this._ui?.retryBtn?.bg?.emit('pointerup'));

    // Resize
    this._onResize = (gameSize) => {
      const w = gameSize.width, h = gameSize.height;
      if (!this.sys?.isActive()) return;
      if (this._bg) { this._bg.setPosition(w/2, h/2); this._fitCover(this._bg, w, h); }
      this._ui.scrim?.setSize(w, h).setPosition(w/2, h/2);

      const npw = Math.min(520, w * 0.9);
      const nph = Math.min(360, h * 0.8);
      this._ui.panel?.setSize(npw, nph).setPosition(w/2, h/2);

      this._ui.title?.setPosition(w/2, h/2 - nph*0.32);
      this._ui.scoreTxt?.setPosition(w/2, this._ui.title.y + 48);
      this._ui.bestTxt?.setPosition(w/2, this._ui.scoreTxt.y + 28);

      const nBtnW = Math.min(220, npw * 0.7);
      const btnH2 = 50;
      const ny = (this._ui.bestTxt?.y ?? (h/2)) + 70;
      if (this._ui.retryBtn) {
        this._ui.retryBtn.bg.setSize(nBtnW, btnH2).setPosition(w/2, ny);
        this._ui.retryBtn.txt.setPosition(w/2, ny);
      }
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, this._onResize, this);
    this._onResize({ width, height });

    // Limpieza
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this._cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY,  () => this._cleanup());
  }

  _startPlay() {
    // Silencia GO
    try { this.sound?.stopAll(); } catch {}
    try { this._bgmGO?.stop(); } catch {}

    // Resetea punteros por si quedaron “down”
    const im = this.input?.manager;
    if (im?.pointers) {
      for (const p of im.pointers) { try { p.reset?.(); } catch {} }
    }

    this.time.delayedCall(30, () => {
      // PlayScene debe encargarse de iniciar la música `music` si no está sonando
      this.scene.start('PlayScene', { forceStartMusic: true, from: 'GameOver' });
    });
  }

  _fitCover(img, viewportW, viewportH){
    const iw = img.width, ih = img.height;
    if (!iw || !ih) return;
    img.setScale(Math.max(viewportW/iw, viewportH/ih));
  }

  _cleanup() {
    if (this._onResize) { this.scale.off(Phaser.Scale.Events.RESIZE, this._onResize, this); this._onResize = null; }
    this._keys?.enter?.removeAllListeners();
    this._keys?.space?.removeAllListeners();
    this._keys = null;

    try { this._bgmGO?.stop(); } catch {}
    this._bgmGO?.destroy?.(); this._bgmGO = null;

    if (this._bg && !this._bg.destroyed) { this._bg.destroy(); this._bg = null; }

    const U = this._ui;
    if (U?.retryBtn){ U.retryBtn.bg.destroy(); U.retryBtn.txt.destroy(); }
    U?.title?.destroy(); U?.scoreTxt?.destroy(); U?.bestTxt?.destroy();
    U?.panel?.destroy(); U?.scrim?.destroy();
    this._ui = {};
  }
}







