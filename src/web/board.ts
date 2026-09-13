import { edgeBetween, type Grid } from '../engine/grid.ts';
import { parseKey, type ShapeKey } from '../engine/shape.ts';
import type { Puzzle } from '../engine/types.ts';
import type { Hint } from './analysis.ts';
import { HUES, NONE, PlayerState, WALL, type Snapshot } from './model.ts';

const ROSE_GLYPHS = ['○', '△', '□', '☆', '◇', '♡'];
const LONG_PRESS_MS = 450;
const MOVE_SLOP = 8;

export interface BoardCallbacks {
  /** called after any change to the player's marks */
  onChange(): void;
  /** area counter shown/hidden (long press on a cell) */
  onArea(info: { cell: number; count: number } | null): void;
}

type Hit = { cell: number; zone: 'inner' | 'band'; edge: number };

/**
 * Canvas board with touch-first gestures. Nothing changes on pointer-down;
 * the gesture is decided by what happens next, so a drag that starts near a
 * border never leaves a stray wall behind:
 *   tap empty cell          start a new paint region (auto colour)
 *   tap painted cell        erase that cell (press-and-drag from it extends instead)
 *   drag (from anywhere)    paint: extend the region of the start cell (never across a wall)
 *   tap on a border         toggle a wall, applied on release (no dragging along borders)
 *   long-press on a cell    show the size of the wall-bounded area
 *   eraser mode             tap/drag removes paint (walls are removed by tapping them)
 */
export class Board {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  puzzle: Puzzle | null = null;
  grid: Grid | null = null;
  ps: PlayerState | null = null;
  eraser = false;
  /** hypothesis mode base: marks that differ from it are drawn translucent */
  hypoBase: Snapshot | null = null;
  /** solution walls overlay */
  overlay: Uint8Array | null = null;
  hint: Hint | null = null;
  /** cells violating a rule (drawn with dark-red hatching) */
  errors: Set<number> = new Set();
  private hatch: CanvasPattern | null = null;
  private cell = 64;
  private pad = 12;
  private cb: BoardCallbacks;

  // gesture state
  private pointerId = -1;
  private downPos: [number, number] = [0, 0];
  private downHit: Hit | null = null;
  private moved = false;
  private changed = false;
  private gesture: 'none' | 'paint' | 'consumed' = 'none';
  private brush = 0;
  private longTimer: number | null = null;
  private areaCells: number[] | null = null;

  constructor(canvas: HTMLCanvasElement, cb: BoardCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.cb = cb;
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointercancel', (e) => this.onUp(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // Block the browser's own touch gestures on the board (pinch zoom, double-tap
    // zoom, long-press magnifier/selection); pointer events still fire.
    for (const t of ['touchstart', 'touchmove', 'touchend'] as const) canvas.addEventListener(t, (e) => e.preventDefault(), { passive: false });
    window.addEventListener('resize', () => this.layout());
  }

  setPuzzle(p: Puzzle, ps: PlayerState): void {
    this.puzzle = p;
    this.ps = ps;
    this.grid = ps.grid;
    this.overlay = null;
    this.hint = null;
    this.errors = new Set();
    this.hypoBase = null;
    this.brush = 0;
    this.layout();
  }

  // -- geometry ----------------------------------------------------------------

  layout(): void {
    if (!this.grid) return;
    const wrap = this.canvas.parentElement!;
    const avail = Math.min(wrap.clientWidth, wrap.clientHeight || 9999) - 2 * this.pad - 8;
    this.cell = Math.max(30, Math.min(72, Math.floor(avail / Math.max(this.grid.w, this.grid.h))));
    const cssW = this.grid.w * this.cell + 2 * this.pad;
    const cssH = this.grid.h * this.cell + 2 * this.pad;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  private hit(px: number, py: number): Hit | null {
    const g = this.grid!;
    const x = (px - this.pad) / this.cell;
    const y = (py - this.pad) / this.cell;
    if (x < 0 || y < 0 || x >= g.w || y >= g.h) return null;
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    const c = cy * g.w + cx;
    if (!g.active[c]) return null;
    const fx = x - cx;
    const fy = y - cy;
    const dx = Math.abs(fx - 0.5);
    const dy = Math.abs(fy - 0.5);
    if (Math.max(dx, dy) < 0.3) return { cell: c, zone: 'inner', edge: -1 };
    let other: number;
    if (dx > dy) other = fx < 0.5 ? (cx > 0 ? c - 1 : -1) : cx < g.w - 1 ? c + 1 : -1;
    else other = fy < 0.5 ? (cy > 0 ? c - g.w : -1) : cy < g.h - 1 ? c + g.w : -1;
    const edge = other >= 0 ? edgeBetween(g, c, other) : -1;
    if (edge < 0) return { cell: c, zone: 'inner', edge: -1 };
    return { cell: c, zone: 'band', edge };
  }

  private pos(e: PointerEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  // -- gestures ----------------------------------------------------------------

  private onDown(e: PointerEvent): void {
    if (!this.ps || this.pointerId !== -1) return;
    const p = this.pos(e);
    const hit = this.hit(...p);
    if (!hit) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);
    this.downPos = p;
    this.downHit = hit;
    this.moved = false;
    this.changed = false;
    this.gesture = 'none';
    this.hint = null;
    const ps = this.ps;
    // Nothing is changed yet: a wall waits for release, paint waits for a tap or a move.
    this.brush = this.eraser ? 0 : ps.paint[hit.cell];
    if (hit.zone === 'band' || this.eraser) return;
    this.startLongPress(() => {
      const { count, cells } = ps.areaOf(hit.cell);
      this.areaCells = cells;
      this.cb.onArea({ cell: hit.cell, count });
      this.gesture = 'consumed';
      this.draw();
    });
  }

  private onMove(e: PointerEvent): void {
    if (!this.ps || e.pointerId !== this.pointerId) return;
    const p = this.pos(e);
    if (!this.moved && Math.hypot(p[0] - this.downPos[0], p[1] - this.downPos[1]) > MOVE_SLOP) {
      this.moved = true;
      this.cancelLongPress();
    }
    if (!this.moved || this.gesture === 'consumed') return;
    const ps = this.ps;
    const start = this.downHit!;
    if (this.gesture === 'none') {
      // First movement decides: every drag is a paint (or erase) stroke from the start cell.
      this.gesture = 'paint';
      if (this.eraser) {
        if (ps.paint[start.cell]) this.change(() => ps.erasePaint(start.cell));
      } else if (!this.brush) {
        this.change(() => {
          this.brush = ps.newRegion(start.cell);
        });
      }
    }
    const hit = this.hit(...p);
    if (!hit) return;
    if (this.eraser) {
      if (ps.paint[hit.cell]) this.change(() => ps.erasePaint(hit.cell));
    } else if (this.brush && ps.paint[hit.cell] !== this.brush) {
      this.change(() => ps.extend(hit.cell, this.brush));
    }
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = -1;
    this.cancelLongPress();
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    if (this.areaCells) {
      this.areaCells = null;
      this.cb.onArea(null);
      this.draw();
    }
    const ps = this.ps;
    const hit = this.downHit;
    if (!ps || !hit) return;
    const tap = !this.moved && this.gesture === 'none';
    if (tap && hit.zone === 'band') {
      // walls toggle on release only, so a drag that began near a border paints instead
      this.change(() => ps.toggleWall(hit.edge));
    } else if (tap && ps.paint[hit.cell]) {
      // a plain tap on a painted cell erases it (in eraser mode too)
      this.change(() => ps.erasePaint(hit.cell));
    } else if (tap && !this.eraser) {
      this.change(() => ps.newRegion(hit.cell));
    }
    if (this.changed) this.cb.onChange();
    this.draw();
  }

  /** Apply a state change inside one undo step per gesture. */
  private change(fn: () => void): void {
    if (!this.ps) return;
    if (!this.changed) {
      this.ps.beginChange();
      this.changed = true;
    }
    fn();
    this.draw();
  }

  private startLongPress(fn: () => void): void {
    this.cancelLongPress();
    this.longTimer = window.setTimeout(() => {
      this.longTimer = null;
      fn();
    }, LONG_PRESS_MS);
  }

  private cancelLongPress(): void {
    if (this.longTimer !== null) {
      clearTimeout(this.longTimer);
      this.longTimer = null;
    }
  }

  // -- drawing -------------------------------------------------------------------

  private edgeSegment(e: number): [number, number, number, number] {
    const g = this.grid!;
    const a = g.edgeA[e];
    const ax = a % g.w;
    const ay = (a - ax) / g.w;
    const s = this.cell;
    const p = this.pad;
    if (g.edgeB[e] === a + 1) {
      const x = p + (ax + 1) * s;
      return [x, p + ay * s, x, p + (ay + 1) * s];
    }
    const y = p + (ay + 1) * s;
    return [p + ax * s, y, p + (ax + 1) * s, y];
  }

  draw(): void {
    const g = this.grid;
    const p = this.puzzle;
    const ps = this.ps;
    const ctx = this.ctx;
    if (!g || !p || !ps) return;
    const s = this.cell;
    const pad = this.pad;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const base = this.hypoBase;
    if (!this.hatch) this.hatch = makeHatch(ctx);

    // cell fills
    for (let c = 0; c < g.cells; c++) {
      if (!g.active[c]) continue;
      const x = c % g.w;
      const y = (c - x) / g.w;
      const id = ps.paint[c];
      ctx.globalAlpha = base && base.paint[c] !== id ? 0.45 : 1;
      ctx.fillStyle = id ? HUES[ps.hue[id] ?? 0] : '#fff';
      ctx.fillRect(pad + x * s, pad + y * s, s, s);
      ctx.globalAlpha = 1;
      if (this.errors.has(c) && this.hatch) {
        ctx.fillStyle = this.hatch;
        ctx.fillRect(pad + x * s, pad + y * s, s, s);
      }
      if (this.areaCells?.includes(c)) {
        ctx.fillStyle = 'rgba(37,99,235,0.18)';
        ctx.fillRect(pad + x * s, pad + y * s, s, s);
      }
    }

    // dotted grid between active cells (dash count shrinks with cell size, like the original)
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    const dashes = s >= 56 ? 8 : s >= 40 ? 7 : 6;
    const unit = s / (dashes * 2 - 1);
    ctx.setLineDash([unit, unit]);
    ctx.beginPath();
    for (let e = 0; e < g.edges; e++) {
      if (ps.edge[e] !== NONE) continue;
      const [x1, y1, x2, y2] = this.edgeSegment(e);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // clues in cells
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const clue of p.clues) {
      if (clue.type === 'areaNumber') this.text(String(clue.value), clue.cell, `${Math.round(s * 0.42)}px sans-serif`, '#111');
      else if (clue.type === 'rose') for (const sym of clue.symbols) this.text(ROSE_GLYPHS[sym.symbol] ?? String(sym.symbol), sym.cell, `${Math.round(s * 0.42)}px sans-serif`, '#111');
      else if (clue.type === 'polyomino') this.miniShape(clue.shape, clue.cell);
    }

    // hint
    if (this.hint) {
      const [x1, y1, x2, y2] = this.edgeSegment(this.hint.edge);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.setLineDash(this.hint.value === 'wall' ? [] : [4, 6]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // walls
    ctx.lineCap = 'round';
    for (let e = 0; e < g.edges; e++) {
      if (ps.edge[e] !== WALL) continue;
      const [x1, y1, x2, y2] = this.edgeSegment(e);
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 4;
      ctx.globalAlpha = base && base.edge[e] !== WALL ? 0.4 : 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // solution overlay
    if (this.overlay) {
      ctx.strokeStyle = 'rgba(220,38,38,0.7)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      for (let e = 0; e < g.edges; e++) {
        if (!this.overlay[e]) continue;
        const [x1, y1, x2, y2] = this.edgeSegment(e);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // outer border: every side of an active cell facing a hole or the outside
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 4;
    ctx.lineCap = 'square';
    ctx.beginPath();
    const act = (nx: number, ny: number) => nx >= 0 && ny >= 0 && nx < g.w && ny < g.h && g.active[ny * g.w + nx] === 1;
    for (let c = 0; c < g.cells; c++) {
      if (!g.active[c]) continue;
      const x = c % g.w;
      const y = (c - x) / g.w;
      const X0 = pad + x * s;
      const Y0 = pad + y * s;
      if (!act(x - 1, y)) { ctx.moveTo(X0, Y0); ctx.lineTo(X0, Y0 + s); }
      if (!act(x + 1, y)) { ctx.moveTo(X0 + s, Y0); ctx.lineTo(X0 + s, Y0 + s); }
      if (!act(x, y - 1)) { ctx.moveTo(X0, Y0); ctx.lineTo(X0 + s, Y0); }
      if (!act(x, y + 1)) { ctx.moveTo(X0, Y0 + s); ctx.lineTo(X0 + s, Y0 + s); }
    }
    ctx.stroke();
    ctx.lineCap = 'round';

    // edge markers (gemini / delta)
    for (const clue of p.clues) {
      if (clue.type !== 'gemini' && clue.type !== 'delta') continue;
      const e = edgeBetween(g, clue.edge.a, clue.edge.b);
      const [x1, y1, x2, y2] = this.edgeSegment(e);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const r = s * 0.17;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#111';
      ctx.font = `${Math.round(r * 1.5)}px sans-serif`;
      ctx.fillText(clue.type === 'gemini' ? '=' : '≠', mx, my + 0.5);
    }

    // area counter
    if (this.areaCells && this.areaCells.length) {
      let sx = 0;
      let sy = 0;
      for (const c of this.areaCells) {
        sx += (c % g.w) + 0.5;
        sy += Math.floor(c / g.w) + 0.5;
      }
      const cx = pad + (sx / this.areaCells.length) * s;
      const cy = pad + (sy / this.areaCells.length) * s;
      ctx.fillStyle = 'rgba(17,24,39,0.85)';
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(s * 0.45)}px sans-serif`;
      ctx.fillText(String(this.areaCells.length), cx, cy + 1);
    }
  }

  private text(t: string, cell: number, font: string, color: string): void {
    const g = this.grid!;
    const x = cell % g.w;
    const y = (cell - x) / g.w;
    this.ctx.fillStyle = color;
    this.ctx.font = font;
    this.ctx.fillText(t, this.pad + (x + 0.5) * this.cell, this.pad + (y + 0.5) * this.cell + 1);
  }

  private miniShape(key: ShapeKey, cell: number): void {
    const g = this.grid!;
    const x = cell % g.w;
    const y = (cell - x) / g.w;
    const pts = parseKey(key);
    let w = 0;
    let h = 0;
    for (const [px, py] of pts) {
      w = Math.max(w, px + 1);
      h = Math.max(h, py + 1);
    }
    const unit = (this.cell * 0.62) / Math.max(w, h);
    const ox = this.pad + (x + 0.5) * this.cell - (w * unit) / 2;
    const oy = this.pad + (y + 0.5) * this.cell - (h * unit) / 2;
    this.ctx.fillStyle = '#374151';
    for (const [px, py] of pts) this.ctx.fillRect(ox + px * unit + 0.5, oy + py * unit + 0.5, unit - 1, unit - 1);
  }
}

/** Diagonal dark-red hatching used to mark rule violations. */
function makeHatch(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const c = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  const size = 8;
  c.width = size * dpr;
  c.height = size * dpr;
  const p = c.getContext('2d')!;
  p.scale(dpr, dpr);
  p.strokeStyle = 'rgba(127,29,29,0.55)';
  p.lineWidth = 2;
  p.beginPath();
  p.moveTo(-2, size + 2);
  p.lineTo(size + 2, -2);
  p.moveTo(-2, 2);
  p.lineTo(2, -2);
  p.moveTo(size - 2, size + 2);
  p.lineTo(size + 2, size - 2);
  p.stroke();
  const pat = ctx.createPattern(c, 'repeat');
  if (pat && 'setTransform' in pat) pat.setTransform(new DOMMatrix().scale(1 / dpr));
  return pat;
}

/** Wall edges of a label array. */
export function wallsOf(g: Grid, labels: ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(g.edges);
  for (let e = 0; e < g.edges; e++) out[e] = labels[g.edgeA[e]] !== labels[g.edgeB[e]] ? 1 : 0;
  return out;
}

/** Small canvas drawing a shape, for the rules panel. */
export function shapeIcon(key: ShapeKey, unit = 9): HTMLCanvasElement {
  const pts = parseKey(key);
  let w = 0;
  let h = 0;
  for (const [x, y] of pts) {
    w = Math.max(w, x + 1);
    h = Math.max(h, y + 1);
  }
  const c = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  c.width = (w * unit + 6) * dpr;
  c.height = (h * unit + 6) * dpr;
  c.style.width = `${w * unit + 6}px`;
  c.style.height = `${h * unit + 6}px`;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#374151';
  for (const [x, y] of pts) ctx.fillRect(3 + x * unit + 0.5, 3 + y * unit + 0.5, unit - 1, unit - 1);
  return c;
}
