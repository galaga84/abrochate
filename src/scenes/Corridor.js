// src/game/Corridor.js
export default class Corridor {
  /**
   * @param {Phaser.Scene} scene
   * @param {{x:number,y:number}} start
   * @param {{x:number,y:number}} end
   * @param {{
   *   graphics?: Phaser.GameObjects.Graphics,
   *   halfWidth?: number,
   *   tolerance?: number,
   *   fillColor?: number,
   *   fillAlpha?: number,
   *   dash?: number,
   *   gap?: number,
   *   borderWidth?: number,
   *   borderColor?: number,
   *   borderAlpha?: number
   * }} [opts]
   */
  constructor(scene, start, end, opts = {}) {
    this.scene = scene;
    this.start = { x: start.x, y: start.y };
    this.end   = { x: end.x,   y: end.y   };

    this.halfWidth = opts.halfWidth ?? 30;     // “medio ancho” visual del corredor
    this.tolerance = opts.tolerance ?? 24;     // tolerancia de validación

    this.fillColor   = opts.fillColor   ?? 0xffffff;
    this.fillAlpha   = opts.fillAlpha   ?? 0.30;
    this.dash        = opts.dash        ?? 16;
    this.gap         = opts.gap         ?? 10;
    this.borderWidth = opts.borderWidth ?? 5;
    this.borderColor = opts.borderColor ?? 0xffffff;
    this.borderAlpha = opts.borderAlpha ?? 0.50;

    this.g = opts.graphics ?? scene.add.graphics();
    // Si quieres controlar profundidad desde afuera, quita esta línea:
    this.g.setDepth(opts.depth ?? 2);
  }

  setHalfWidth(w) { this.halfWidth = Math.max(1, w|0); return this; }
  setTolerance(t) { this.tolerance = Math.max(0, t|0); return this; }

  /** Actualiza endpoints (por ejemplo si cambian hotspots) */
  setEndpoints(start, end) {
    this.start.x = start.x; this.start.y = start.y;
    this.end.x   = end.x;   this.end.y   = end.y;
    return this;
  }

  /** Distancia perpendicular del punto a la línea central (start→end) */
  distanceToCenterline(p) {
    const a = this.start, b = this.end;
    const abx = b.x - a.x, aby = b.y - a.y;
    const apx = p.x - a.x, apy = p.y - a.y;
    const ab2 = abx * abx + aby * aby || 1e-6;
    let t = (apx * abx + apy * aby) / ab2;
    t = Phaser.Math.Clamp(t, 0, 1);
    const projx = a.x + abx * t, projy = a.y + aby * t;
    return Phaser.Math.Distance.Between(p.x, p.y, projx, projy);
  }

  /** ¿El punto está dentro del corredor según tolerancia? */
  isInside(p) {
    return this.distanceToCenterline(p) <= this.tolerance;
  }

  /** Dibuja relleno + bordes punteados */
  draw() {
    const a = new Phaser.Math.Vector2(this.start.x, this.start.y);
    const b = new Phaser.Math.Vector2(this.end.x,   this.end.y);
    const dir = b.clone().subtract(a);
    const len = dir.length() || 1;
    dir.scale(1 / len);
    const perp = new Phaser.Math.Vector2(-dir.y, dir.x);

    const half = this.halfWidth;
    const la = a.clone().add(perp.clone().scale(+half));
    const lb = b.clone().add(perp.clone().scale(+half));
    const ra = a.clone().add(perp.clone().scale(-half));
    const rb = b.clone().add(perp.clone().scale(-half));

    const g = this.g;
    g.clear();

    // Relleno
    g.fillStyle(this.fillColor, this.fillAlpha);
    g.beginPath();
    g.moveTo(la.x, la.y);
    g.lineTo(lb.x, lb.y);
    g.lineTo(rb.x, rb.y);
    g.lineTo(ra.x, ra.y);
    g.closePath();
    g.fillPath();

    // Bordes punteados
    g.lineStyle(this.borderWidth, this.borderColor, this.borderAlpha);
    this.#strokeDashed(la, lb, this.dash, this.gap);
    this.#strokeDashed(ra, rb, this.dash, this.gap);
  }

  clear() { this.g.clear(); }

  destroy() {
    if (this.g && !this.g.destroyed) this.g.destroy();
    this.g = null;
  }

  // ----------------- helpers privados -----------------
  #strokeDashed(p0, p1, dash = 12, gap = 8) {
    const g = this.g;
    const seg = new Phaser.Math.Vector2(p1.x - p0.x, p1.y - p0.y);
    const L = seg.length() || 0.0001;
    const dir = seg.clone().scale(1 / L);

    let traveled = 0;
    let draw = true;
    let curr = p0.clone();

    while (traveled < L) {
      const step = Math.min(draw ? dash : gap, L - traveled);
      const next = curr.clone().add(dir.clone().scale(step));
      if (draw) {
        g.beginPath();
        g.moveTo(curr.x, curr.y);
        g.lineTo(next.x, next.y);
        g.strokePath();
      }
      curr.copy(next);
      traveled += step;
      draw = !draw;
    }
  }
}
