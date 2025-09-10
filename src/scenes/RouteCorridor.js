// RouteCorridor.js
// Dibuja un corredor con relleno segmentado (sin “líneas internas”) y bordes SÓLIDOS.
// No hace clamp interno: respeta exactamente los puntos que recibe.
// Incluye métodos de compat como setBounds(...) (no-op).

export default class RouteCorridor {
  /**
   * @param {Phaser.Scene} scene
   * @param {Array<{x:number,y:number}>} points  // primer y último = hotspots
   * @param {{
   *   graphicsFill?: Phaser.GameObjects.Graphics,
   *   graphicsStroke?: Phaser.GameObjects.Graphics,
   *   graphics?: Phaser.GameObjects.Graphics,    // compat legado (una sola capa)
   *   halfWidth?: number,
   *   tolerance?: number,
   *   fillColor?: number,
   *   fillAlpha?: number,
   *   borderWidth?: number,
   *   borderColor?: number,
   *   borderAlpha?: number,
   *   depthFill?: number,
   *   depthStroke?: number,
   *   depth?: number,                             // compat legado
   *   smooth?: boolean,
   *   smoothSamples?: number
   * }} [opts]
   */
  constructor(scene, points, opts = {}) {
    this.scene = scene;
    this.points = Array.isArray(points) ? points.slice() : [];

    // Parámetros geométricos / visuales
    this.halfWidth   = (typeof opts.halfWidth   === 'number') ? opts.halfWidth   : 30;
    this.tolerance   = (typeof opts.tolerance   === 'number') ? opts.tolerance   : 24;

    this.fillColor   = (typeof opts.fillColor   === 'number') ? opts.fillColor   : 0xffffff;
    this.fillAlpha   = (typeof opts.fillAlpha   === 'number') ? opts.fillAlpha   : 0.30;

    this.borderWidth = (typeof opts.borderWidth === 'number') ? opts.borderWidth : 5;
    this.borderColor = (typeof opts.borderColor === 'number') ? opts.borderColor : 0xffffff;
    this.borderAlpha = (typeof opts.borderAlpha === 'number') ? opts.borderAlpha : 0.50;

    this.smooth      = (typeof opts.smooth === 'boolean') ? opts.smooth : true;
    const defaultSamples = (this.points.length > 1) ? (this.points.length - 1) * 48 : 32;
    this.smoothSamples = Math.max(16, (typeof opts.smoothSamples === 'number' ? opts.smoothSamples : defaultSamples) | 0);

    // Capas (compat: si pasan "graphics" único, lo uso de stroke y creo fill debajo)
    const depthFillDefault   = (typeof opts.depthFill   === 'number') ? opts.depthFill   : ((typeof opts.depth === 'number') ? opts.depth     : 2);
    const depthStrokeDefault = (typeof opts.depthStroke === 'number') ? opts.depthStroke : ((typeof opts.depth === 'number') ? opts.depth + 1 : 3);

    this.gFill   = opts.graphicsFill   ? opts.graphicsFill   : this.scene.add.graphics();
    this.gStroke = opts.graphicsStroke ? opts.graphicsStroke : (opts.graphics ? opts.graphics : this.scene.add.graphics());

    this.gFill.setDepth(depthFillDefault);
    this.gStroke.setDepth(depthStrokeDefault);
  }

  /* ================= API pública ================= */

  setPoints(points){ this.points = points.slice(); return this; }
  setHalfWidth(w){ this.halfWidth = Math.max(1, (w|0)); return this; }
  setTolerance(t){ this.tolerance = Math.max(0, (t|0)); return this; }
  setSmooth(on, samples){
    this.smooth = !!on;
    if (typeof samples === 'number') this.smoothSamples = Math.max(16, samples|0);
    return this;
  }
  // Compat: no-op (dejado para no romper PlayScenes que lo llamen)
  setBounds(_rect, _pad){ return this; }

  clear(){ this.gFill.clear(); this.gStroke.clear(); }

  distanceToRoute(p){
    const line = this._sampledPreservingEnds();
    let minD = Infinity;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i+1];
      const d = this._distanceToSegment(p, a, b);
      if (d < minD) minD = d;
    }
    return minD;
  }
  isInside(p){ return this.distanceToRoute(p) <= this.tolerance; }

  draw(){
    const line = this._sampledPreservingEnds();
    if (!line || line.length < 2) { this.clear(); return; }

    const { left, right } = this._offsetEdges(line, this.halfWidth);

    // Limpiar capas
    this.gFill.clear();
    this.gStroke.clear();

    // --- RELLENO por segmento (quad por quad) ---
    this.gFill.fillStyle(this.fillColor, this.fillAlpha);
    for (let i = 0; i < left.length - 1; i++) {
      // Quad ordenado para evitar auto-intersecciones
      const quad = [ left[i], right[i], right[i+1], left[i+1] ];
      this.gFill.fillPoints(quad, true);
    }

    // --- BORDES SÓLIDOS ---
    if (this.borderWidth > 0 && this.borderAlpha > 0) {
      this.gStroke.lineStyle(this.borderWidth, this.borderColor, this.borderAlpha);
      this._strokeSolidPolyline(left,  this.gStroke);
      this._strokeSolidPolyline(right, this.gStroke);
    }
  }

  destroy(){
    if (this.gFill && !this.gFill.destroyed) this.gFill.destroy();
    if (this.gStroke && !this.gStroke.destroyed) this.gStroke.destroy();
    this.gFill = null; this.gStroke = null;
  }

  /* ================= Internos ================= */

  // Suaviza (si procede) y garantiza que el último punto sea EXACTAMENTE el hotspot final.
  // No hace ningún clamp interno.
  _sampledPreservingEnds(){
    let pts;
    if (!this.smooth || this.points.length <= 2) {
      pts = this.points.slice();
    } else {
      const flat = [];
      for (let i = 0; i < this.points.length; i++) {
        flat.push(this.points[i].x, this.points[i].y);
      }
      const spline = new Phaser.Curves.Spline(flat);
      const N = Math.max(16, this.smoothSamples | 0);
      pts = spline.getSpacedPoints(N);

      // Asegura extremo final exacto
      const last = this.points[this.points.length - 1];
      const end = pts[pts.length - 1];
      if (!end || end.x !== last.x || end.y !== last.y) {
        pts.push({ x: last.x, y: last.y });
      }
    }
    return pts;
  }

  // Calcula los bordes desplazados (izq/der) a partir de la línea central
  _offsetEdges(line, hw){
    const n = line.length;
    const left  = new Array(n);
    const right = new Array(n);

    const normalOf = (dx, dy) => {
      const L = Math.hypot(dx, dy) || 1;
      return { x: -dy / L, y: dx / L };
    };

    // normales suavizadas en vértices
    const normals = new Array(n);
    for (let i = 0; i < n; i++) {
      if (i === 0) {
        const dx = line[1].x - line[0].x, dy = line[1].y - line[0].y;
        normals[i] = normalOf(dx, dy);
      } else if (i === n - 1) {
        const dx = line[i].x - line[i-1].x, dy = line[i].y - line[i-1].y;
        normals[i] = normalOf(dx, dy);
      } else {
        const dx1 = line[i].x - line[i-1].x, dy1 = line[i].y - line[i-1].y;
        const dx2 = line[i+1].x - line[i].x, dy2 = line[i+1].y - line[i].y;
        const n1 = normalOf(dx1, dy1), n2 = normalOf(dx2, dy2);
        const nx = n1.x + n2.x, ny = n1.y + n2.y;
        const L  = Math.hypot(nx, ny) || 1;
        normals[i] = { x: nx / L, y: ny / L };
      }
    }

    for (let i = 0; i < n; i++) {
      const p = line[i], no = normals[i];
      left[i]  = { x: p.x + no.x * hw, y: p.y + no.y * hw };
      right[i] = { x: p.x - no.x * hw, y: p.y - no.y * hw };
    }

    return { left, right };
  }

  // Trazo sólido continuo
  _strokeSolidPolyline(poly, g){
    if (!poly || poly.length < 2) return;
    g.beginPath();
    g.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) {
      g.lineTo(poly[i].x, poly[i].y);
    }
    g.strokePath();
  }

  // Distancia punto-segmento
  _distanceToSegment(p, a, b){
    const abx = b.x - a.x, aby = b.y - a.y;
    const apx = p.x - a.x, apy = p.y - a.y;
    const ab2 = abx*abx + aby*aby || 1e-6;
    let t = (apx*abx + apy*aby) / ab2;
    t = Phaser.Math.Clamp(t, 0, 1);
    const projx = a.x + abx * t, projy = a.y + aby * t;
    return Phaser.Math.Distance.Between(p.x, p.y, projx, projy);
  }
}






