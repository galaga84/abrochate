// PlayScene.js
import RouteCorridor from './RouteCorridor.js'; // ajusta la ruta si corresponde

export default class PlayScene extends Phaser.Scene {
  constructor(){
    super('PlayScene');

    // Música
    this._bgm = null; // instancia del BGM 'music'

    // FSM / retorno
    this.state='READY';
    this.rejectInput=false;
    this._queuedReturn=false;
    this._returning=false;
    this._advanceAfterReturn=false;

    // Rutas
    this.routeOrder=['recta','curva','s'];
    this.routeIndex=0;
    this.routeVariant=this.routeOrder[this.routeIndex];

    // Score/tiempo
    this.score=0; this.timeLeft=30; this.timerEvt=null;

    // Camino
    this.pathFillG=null; this.pathStrokeG=null; this.beltStrap=null;
    this.pathHalf=30; this.TOL=24;

    // Hotspots
    this.ZW=100; this.ZH=100;

    this.justScored=false;
  }

  preload(){
    this.load.image('bg','assets/img/fondo-juego.png');
    this.load.image('belt','assets/img/hebilla.png');
    this.load.audio('sfx_points','assets/audio/sfx/puntos.wav');

    // TU archivo de música (ruta correcta que pediste)
    this.load.audio('music','assets/audio/music/music.wav');
  }

  create(data){
    const {width,height}=this.scale;

    // Gráficos
    this.pathFillG   = this.add.graphics().setDepth(2);
    this.pathStrokeG = this.add.graphics().setDepth(3);
    this.beltStrap   = this.add.graphics().setDepth(4);

    // Drag thresholds
    this.input.dragDistanceThreshold=6;
    this.input.dragTimeThreshold=40;

    // Fondo cover
    const bg=this.add.image(width/2,height/2,'bg').setOrigin(0.5).setDepth(0);
    const scale=Math.max(width/bg.width,height/bg.height);
    bg.setScale(scale);

    // Normalización arte→canvas
    const artW=bg.width, artH=bg.height;
    const nx=(x)=> (x/artW)*width, ny=(y)=> (y/artH)*height;

    // Hotspots absolutos (ajusta a tu composición)
    const startAbs={x:697.5,y:961.5}, endAbs={x:2296,y:4900};
    const startX=nx(startAbs.x), startY=ny(startAbs.y);
    const endX  =nx(endAbs.x),   endY  =ny(endAbs.y);

    // Zonas
    this.startZone=this.add.rectangle(startX,startY,this.ZW,this.ZH,0x00ff00,0.20).setOrigin(0.5).setDepth(5);
    this.endZone  =this.add.rectangle(endX,  endY,  this.ZW,this.ZH,0xff0000,0.20).setOrigin(0.5).setDepth(5);
    this.goalCircle=new Phaser.Geom.Circle(endX,endY,Math.min(this.ZW,this.ZH)*0.5);

    // Hebilla
    this.belt=this.add.image(startX,startY,'belt')
      .setOrigin(0.5).setScale(0.5).setDepth(10)
      .setInteractive({draggable:true});

    // Camino según hebilla
    const beltW=this.belt.displayWidth||50;
    this.pathHalf=Math.max(14,Math.round(beltW*0.40));
    this.TOL     =Math.max(12,Math.round(beltW*0.36));

    // Ruta inicial
    this.routeVariant=this.routeOrder[this.routeIndex];
    const pts0=this._buildRoute(this.routeVariant,{x:startX,y:startY},{x:endX,y:endY});

    this.corridor=new RouteCorridor(this,pts0,{
      graphicsFill:   this.pathFillG,
      graphicsStroke: this.pathStrokeG,
      halfWidth:this.pathHalf,
      tolerance:this.TOL,
      fillColor:0xffffff, fillAlpha:0.30,
      dash:16, gap:10,
      borderWidth:5, borderColor:0xffffff, borderAlpha:0.5,
      depthFill:2, depthStroke:3,
      smooth:true, smoothSamples:(pts0.length - 1) * 60
    });
    this.corridor.draw();

    this.updateBeltRotation(); this.drawStrap();

    // HUD
    this.scoreTxt=this.add.text(10,10,'Puntos: 0',{fontSize:'20px',color:'#fff'}).setDepth(20);
    this.timerTxt=this.add.text(width-10,10,'30',{fontSize:'20px',color:'#fff'}).setOrigin(1,0).setDepth(20);

    // Drag
    this.input.on('drag',(pointer,obj,dx,dy)=>{
      if(this.state!=='PLAYING') return;
      if(this.rejectInput||this._returning||this._queuedReturn) return;

      obj.x=dx; obj.y=dy;
      this.updateBeltRotation(); this.drawStrap();

      if(!this.corridor.isInside({x:obj.x,y:obj.y})){
        this.cameras.main.shake(80,0.004);
        this.justScored=false;
        this.queueReturnToStart();
        return;
      }

      if(!this.justScored && this.isAtGoal()){
        this.justScored=true;
        this.addPoints();
        this._advanceAfterReturn=true;
        this.queueReturnToStart();
        this.time.delayedCall(120,()=> this.justScored=false);
      }
    });

    this.input.on('dragend',()=>{
      if(this.state!=='PLAYING') return;
      if(this.rejectInput||this._returning||this._queuedReturn) return;
      if(!this.justScored) this.returnBeltToStart(false);
      this.justScored=false;
    });

    // === Música: NO DUPLICAR ===
    // Si vienes de GameOver, permite crear; si vienes de Title, reutiliza.
    const allowCreate = !!(data && data.forceStartMusic);
    this._ensureBGM({ allowCreate, forcePlay:false }); // inicia si existe o crea (solo si allowCreate)

    this.showIntroModal();

    // Limpieza visual del corredor al cerrar
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=> this.corridor?.destroy?.());
  }

  // ====== BGM sin duplicarse (key: 'music') ======
  _ensureBGM({ allowCreate=false, forcePlay=false } = {}){
    const key = 'music';
    if (!this.cache.audio?.exists(key)) return;

    // 1) Dedup: si ya hay MÁS de una instancia, conserva la primera.
    const all = this.sound.getAll(key);
    if (all && all.length > 1) {
      for (let i = 1; i < all.length; i++) {
        try { all[i].stop(); } catch {}
        try { all[i].destroy(); } catch {}
      }
    }
    const existing = this.sound.get(key);

    // 2) Reutiliza si existe (no crees otra).
    if (existing) {
      this._bgm = existing;
      if (forcePlay && !this._bgm.isPlaying) {
        this._playBGM(this._bgm);
      }
      return;
    }

    // 3) Si NO existe, solo crea cuando está permitido (p.ej., desde GameOver).
    if (!allowCreate) return;

    this._bgm = this.sound.add(key, { loop: true, volume: 0.7 });
    this._playBGM(this._bgm);
  }

  _playBGM(sound){
    const tryPlay = () => { if (!sound.isPlaying) { try { sound.play(); } catch {} } };
    const ctx = this.sound?.context;

    if (ctx && ctx.state === 'suspended') {
      try { ctx.resume().then(tryPlay).catch(tryPlay); } catch { tryPlay(); }
    } else if (this.sound.locked) {
      this.sound.once('unlocked', tryPlay);
    } else {
      tryPlay();
    }
  }

  // ====== Rutas ======
  _buildRoute(variant,start,end){
    const a=new Phaser.Math.Vector2(start.x,start.y);
    const b=new Phaser.Math.Vector2(end.x,end.y);
    const dir=b.clone().subtract(a), len=dir.length()||1; dir.scale(1/len);
    const perp=new Phaser.Math.Vector2(-dir.y,dir.x);
    const bulge=Math.min(140,Math.max(60,len*0.10)); // 10% de largo

    const p=(t,l=0)=>({ x:a.x+dir.x*(len*t)+perp.x*l, y:a.y+dir.y*(len*t)+perp.y*l });

    switch((variant||'').toLowerCase()){
      case 'curva': return [ p(0,0), p(0.33, +bulge), p(0.66, +bulge), p(1,0) ];
      case 's':     return [ p(0,0), p(0.25,+bulge), p(0.50,0), p(0.75,-bulge), p(1,0) ];
      case 'recta':
      default:      return [ {x:a.x,y:a.y}, {x:b.x,y:b.y} ];
    }
  }

  // ====== Meta ======
  getBeltRadius(){ return Math.max(this.belt.displayWidth,this.belt.displayHeight)*0.35; }
  isAtGoal(){
    const beltC=new Phaser.Geom.Circle(this.belt.x,this.belt.y,this.getBeltRadius());
    return Phaser.Geom.Intersects.CircleToCircle(beltC,this.goalCircle);
  }

  // ====== Retorno ======
  queueReturnToStart(){
    if(this._queuedReturn||this._returning) return;
    this._queuedReturn=true; this.rejectInput=true;
    if(this.belt?.input) this.input.setDraggable(this.belt,false);

    const startTween=()=>{ this._queuedReturn=false; this._returning=true; this.returnBeltToStart(true); };

    if(!this.anyPointerDown()){ startTween(); return; }

    const onUp=()=>{ cleanup(); startTween(); };
    const onBlur=()=>{ cleanup(); startTween(); };
    const onTimeout=()=>{ cleanup(); startTween(); };
    const cleanup=()=>{
      this.input.off('pointerup',onUp);
      window.removeEventListener('mouseup',onUp,true);
      window.removeEventListener('blur',onBlur,true);
      if(this._releaseTimer){ this._releaseTimer.remove(false); this._releaseTimer=null; }
    };

    this.input.once('pointerup',onUp);
    window.addEventListener('mouseup',onUp,true);
    window.addEventListener('blur',onBlur,true);
    this._releaseTimer=this.time.delayedCall(800,onTimeout);
  }

  anyPointerDown(){
    const m=this.input.manager;
    if(m?.pointers) for(const p of m.pointers) if(p?.isDown) return true;
    return !!this.input.activePointer?.isDown;
  }

  returnBeltToStart(animated=true){
    const to={x:this.startZone.x,y:this.startZone.y};
    if(!animated){
      this.belt.setPosition(to.x,to.y);
      this.updateBeltRotation(); this.drawStrap(); this.finishReturn(); return;
    }
    this.tweens.add({
      targets:this.belt, x:to.x, y:to.y, duration:220, ease:'Quad.easeInOut',
      onUpdate:()=>{ this.updateBeltRotation(); this.drawStrap(); },
      onComplete:()=> this.finishReturn()
    });
  }

  finishReturn(){
    this.updateBeltRotation(); this.drawStrap();

    const arm=()=>{
      this.time.delayedCall(16,()=>{
        if(this.belt && !this.belt.input) this.belt.setInteractive({draggable:true});
        if(this.belt?.input) this.input.setDraggable(this.belt,true);

        if(this._advanceAfterReturn){
          this._advanceAfterReturn=false;
          this.advanceRoute();
        }

        this._returning=false; this.rejectInput=false;
      });
    };
    if(this.anyPointerDown()) this.input.once('pointerup',arm); else arm();
  }

  // ====== Cambio de ruta ======
  advanceRoute(){
    this.routeIndex   = (this.routeIndex + 1) % this.routeOrder.length;
    this.routeVariant = this.routeOrder[this.routeIndex];

    if (this.routeIndex === 0) {
      // ciclo completo: angosta 30%
      this.narrowCorridorBy(0.30);
      return;
    }

    const start = { x: this.startZone.x, y: this.startZone.y };
    const end   = { x: this.endZone.x,   y: this.endZone.y };
    const pts   = this._buildRoute(this.routeVariant, start, end);

    this.corridor
      .setPoints(pts)
      .setHalfWidth(this.pathHalf)
      .setTolerance(this.TOL)
      .setSmooth(true, (pts.length - 1) * 60)
      .draw();
  }

  narrowCorridorBy(ratio = 0.30){
    const old = this.pathHalf;

    const minHalf = Math.max(24, Math.round((this.belt ? this.belt.displayWidth : 50) * 0.24));
    this.pathHalf = Math.max(minHalf, Math.round(old * (1 - ratio)));

    this.TOL = Math.max(8, Math.min(this.pathHalf, Math.round(this.pathHalf * 0.96)));

    const start = { x: this.startZone.x, y: this.startZone.y };
    const end   = { x: this.endZone.x,   y: this.endZone.y };
    const pts   = this._buildRoute(this.routeVariant, start, end);

    this.corridor
      .setPoints(pts)
      .setHalfWidth(this.pathHalf)
      .setTolerance(this.TOL)
      .setSmooth(true, (pts.length - 1) * 60)
      .draw();
  }

  // ====== Tela ======
  drawStrap(){
    this.beltStrap.clear();
    this.beltStrap.fillStyle(0x3d3d3d,1);

    const s={x:this.startZone.x,y:this.startZone.y};
    const e={x:this.belt.x,y:this.belt.y};
    const w=Math.max(12,Math.round((this.belt.displayWidth||40)*0.6));
    const dx=e.x-s.x, dy=e.y-s.y, L=Math.hypot(dx,dy)||1;
    const nx=-dy/L, ny=dx/L, hw=w/2;

    const p1={x:s.x+nx*hw,y:s.y+ny*hw};
    const p2={x:s.x-nx*hw,y:s.y-ny*hw};
    const p3={x:e.x-nx*hw,y:e.y-ny*hw};
    const p4={x:e.x+nx*hw,y:e.y+ny*hw};

    this.beltStrap.fillPoints([p1,p2,p3,p4],true);
  }

  updateBeltRotation(){
    const ang=Phaser.Math.Angle.Between(this.belt.x,this.belt.y,this.endZone.x,this.endZone.y);
    this.belt.setRotation(ang);
  }

  // ====== Modal ======
  showIntroModal(){
    const { width, height } = this.scale;
    const scrim = this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.5)
      .setInteractive().setDepth(50);
    const txt = this.add.text(
      width/2, height/2,
      'Arrastra la hebilla\nsiguiendo el camino\n\n[Click para empezar]',
      { fontSize: '24px', color: '#fff', align: 'center' }
    ).setOrigin(0.5).setDepth(50);

    scrim.once('pointerup', () => {
      // dentro de gesto: si el navegador bloqueaba, aquí sí arranca
      // OJO: no crees otra si TitleScene ya la tenía
      this._ensureBGM({ allowCreate:false, forcePlay:true });

      scrim.destroy();
      txt.destroy();
      this.startGame();
    });
  }

  startGame(){
    // 1) capas limpias
    if (this.pathFillG && !this.pathFillG.destroyed) this.pathFillG.destroy();
    if (this.pathStrokeG && !this.pathStrokeG.destroyed) this.pathStrokeG.destroy();
    if (this.beltStrap && !this.beltStrap.destroyed) this.beltStrap.destroy();
    this.pathFillG   = this.add.graphics().setDepth(2);
    this.pathStrokeG = this.add.graphics().setDepth(3);
    this.beltStrap   = this.add.graphics().setDepth(4);

    // 2) corredor nuevo
    if (this.corridor?.destroy) this.corridor.destroy();
    this.corridor = null;

    // 3) estado
    this.state = 'PLAYING';
    this.score = 0; this.timeLeft = 30; this.updateHUD();

    if (this.belt?.input) this.input.setDraggable(this.belt, true);
    this.rejectInput = false; this._queuedReturn = false; this._returning = false; this._advanceAfterReturn = false;

    // 4) hebilla al inicio
    this.returnBeltToStart(false);

    // 5) ruta/redibujo
    const pts = this._buildRoute(
      this.routeVariant,
      { x: this.startZone.x, y: this.startZone.y },
      { x: this.endZone.x,   y: this.endZone.y }
    );

    this.corridor = new RouteCorridor(this, pts, {
      graphicsFill:   this.pathFillG,
      graphicsStroke: this.pathStrokeG,
      halfWidth: this.pathHalf,
      tolerance: this.TOL,
      fillColor: 0xffffff, fillAlpha: 0.30,
      dash: 16, gap: 10,
      borderWidth: 5, borderColor: 0xffffff, borderAlpha: 0.5,
      depthFill: 2, depthStroke: 3,
      smooth: true, smoothSamples: (pts.length - 1) * 60
    });

    this.corridor.draw();
    this.updateBeltRotation();
    this.drawStrap();

    // 6) timer
    if (this.timerEvt) { this.timerEvt.remove(false); this.timerEvt = null; }
    this.timerEvt = this.time.addEvent({
      delay: 1000, loop: true, callback: () => {
        this.timeLeft--; this.updateHUD(); if (this.timeLeft <= 0) this.endGame();
      }
    });
  }

  addPoints(){
    this.score += 100;
    if (this.cache?.audio?.exists('sfx_points')) this.sound.play('sfx_points');
    this.updateHUD();
  }

  updateHUD(){
    this.scoreTxt.setText('Puntos: ' + this.score);
    this.timerTxt.setText(this.timeLeft);
  }

  endGame(){
    this.state = 'GAMEOVER';
    if (this.timerEvt) { this.timerEvt.remove(false); this.timerEvt = null; }
    this.scene.start('GameOverScene', { score: this.score, forceStartMusic: false });
  }
}





