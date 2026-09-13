import { edgeBetween, type Grid } from '../engine/grid.ts';
import { parseKey, type ShapeKey } from '../engine/shape.ts';
import type { Puzzle } from '../engine/types.ts';
import type { Hint, Mistake } from './analysis.ts';
import { Haptics } from './haptics.ts';
import { HUES, NONE, PlayerState, WALL, huePool } from './model.ts';

/** colour of borders drawn by the player: a graphite sketch line, unlike the dark lead of the window */
const PLAYER_WALL = '#5b5560';
/** lead came: fixed walls, the frame, and the player's borders once the window is done */
const LEAD = '#1d1c21';
const LEAD_LIGHT = 'rgba(255,255,255,0.28)';
/** glass with no colour yet */
const CLEAR_GLASS = '#e4e9ef';
/** clue ink */
const INK = '#17161a';
const CLUE_FONT = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif";
const REDUCED_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const ROSE_GLYPHS = ['○', '△', '□', '☆', '◇', '♡'];
const LONG_PRESS_MS = 450;
const MOVE_SLOP = 8;
/** Border band width, as a fraction of the cell size on each side of an edge (was 0.2; halved). */
const BAND_MARGIN = 0.1;

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
 *   drag (from anywhere)    paint: extend the region of the start cell (never across a wall);
 *                           if the drag's first new cell is already part of that same
 *                           region, the whole stroke erases instead (a quick way to clear
 *                           a region without switching to eraser mode)
 *   tap on a border         toggle a wall, applied on release (no dragging along borders)
 *   long-press on a cell    show the size of the wall-bounded area
 *   eraser mode             tap/drag removes paint (walls are removed by tapping them)
 */
export class Board {
  readonly canvas: HTMLCanvasElement;
  /** wraps the canvas; receives the gestures (on iOS a switch on top of the canvas gets the touches) */
  private stage: HTMLElement;
  /** the stone wall around the window (#board-wrap) */
  private wrap: HTMLElement;
  private haptics: Haptics;
  private ctx: CanvasRenderingContext2D;
  puzzle: Puzzle | null = null;
  grid: Grid | null = null;
  ps: PlayerState | null = null;
  eraser = false;
  /** when set, this state is drawn instead of the player's and input is ignored (solution reveal) */
  reveal: PlayerState | null = null;
  hint: Hint | Mistake | null = null;
  /** 1 = where to look, 2 = what to do */
  hintStage = 1;
  /** cells violating a rule (drawn with dark-red hatching) */
  errors: Set<number> = new Set();
  /** fixed walls the player painted across (drawn hatched) */
  errorEdges: Set<number> = new Set();
  private hatch: CanvasPattern | null = null;
  private grain: CanvasPattern | null = null;
  /** the window is finished by the player (lights up) */
  private complete = false;
  /** 0 = puzzle in progress, 1 = finished window; animated between the two */
  private lit = 0;
  private litFrom = 0;
  private litT0 = 0;
  private litDur = 1;
  /** when the play of light on the finished window began */
  private shineT0 = 0;
  private now = 0;
  private anim: number | null = null;
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
  /** decided lazily, the first time a paint drag reaches a cell other than the start cell */
  private dragMode: 'extend' | 'erase' | null = null;
  private brush = 0;
  private longTimer: number | null = null;
  private areaCells: number[] | null = null;

  constructor(canvas: HTMLCanvasElement, cb: BoardCallbacks) {
    this.canvas = canvas;
    this.stage = canvas.parentElement!;
    this.wrap = this.stage.parentElement!;
    this.ctx = canvas.getContext('2d')!;
    this.cb = cb;
    this.haptics = new Haptics(this.stage, canvas);
    const stage = this.stage;
    stage.addEventListener('pointerdown', (e) => this.onDown(e));
    stage.addEventListener('pointermove', (e) => this.onMove(e));
    stage.addEventListener('pointerup', (e) => this.onUp(e));
    stage.addEventListener('pointercancel', (e) => this.onUp(e));
    stage.addEventListener('contextmenu', (e) => e.preventDefault());
    // Block the browser's own touch gestures on the board (pinch zoom, double-tap
    // zoom, long-press magnifier/selection); pointer events still fire. With the
    // haptic switch in place the touches must keep their default handling (that
    // is what ticks), and CSS touch-action / user-select do the blocking.
    if (!this.haptics.overlay) for (const t of ['touchstart', 'touchmove', 'touchend'] as const) stage.addEventListener(t, (e) => e.preventDefault(), { passive: false });
    window.addEventListener('resize', () => this.layout());
  }

  setPuzzle(p: Puzzle, ps: PlayerState): void {
    this.puzzle = p;
    this.ps = ps;
    this.grid = ps.grid;
    this.reveal = null;
    this.hint = null;
    this.errors = new Set();
    this.errorEdges = new Set();
    this.brush = 0;
    this.setComplete(false);
    this.lit = 0;
    this.layout();
  }

  // -- geometry ----------------------------------------------------------------

  layout(): void {
    if (!this.grid) return;
    const wrap = this.wrap;
    // fit the content box of the stage (its padding excluded); the goal strip
    // above the window takes its share of the height
    const cs = getComputedStyle(wrap);
    const strip = wrap.querySelector<HTMLElement>('.goal-area');
    const stripH = strip && !strip.hidden ? strip.offsetHeight + 8 : 0;
    const innerW = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const innerH = (wrap.clientHeight || 9999) - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - stripH;
    const avail = Math.min(innerW, innerH) - 2 * this.pad - 8;
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
    if (Math.max(dx, dy) < 0.5 - BAND_MARGIN) return { cell: c, zone: 'inner', edge: -1 };
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
    if (!this.ps || this.reveal || this.pointerId !== -1) return;
    const p = this.pos(e);
    const hit = this.hit(...p);
    if (!hit) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.stage.setPointerCapture(e.pointerId);
    this.haptics.begin();
    this.downPos = p;
    this.downHit = hit;
    this.moved = false;
    this.changed = false;
    this.gesture = 'none';
    this.dragMode = null;
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
      return;
    }
    if (!this.brush) return;
    if (this.dragMode === null && hit.cell !== start.cell) {
      // The first cell the drag actually reaches (not just any sample still inside
      // the start cell) decides the rest of the stroke: onto the same region reads
      // as "erase this", onto anything else keeps extending/filling as before.
      this.dragMode = ps.paint[hit.cell] === this.brush ? 'erase' : 'extend';
      // The stroke started on the region too, so it erases like the rest of it.
      if (this.dragMode === 'erase' && ps.paint[start.cell]) this.change(() => ps.erasePaint(start.cell));
    }
    if (this.dragMode === 'erase') {
      if (ps.paint[hit.cell]) this.change(() => ps.erasePaint(hit.cell));
    } else if (ps.canExtend(hit.cell, this.brush)) {
      // A blocked stroke (across a wall) changes nothing and leaves no undo step.
      this.change(() => ps.extend(hit.cell, this.brush));
    }
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = -1;
    this.cancelLongPress();
    if (this.stage.hasPointerCapture(e.pointerId)) this.stage.releasePointerCapture(e.pointerId);
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
      if (!ps.fixed[hit.edge]) this.change(() => ps.toggleWall(hit.edge));
    } else if (tap && ps.paint[hit.cell]) {
      // a plain tap on a painted cell erases it (in eraser mode too)
      this.change(() => ps.erasePaint(hit.cell));
    } else if (tap && !this.eraser) {
      this.change(() => ps.newRegion(hit.cell));
    }
    this.haptics.end(this.changed);
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
    this.haptics.tick();
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

  /**
   * Completion: the window "lights up". The player's borders become leading,
   * the glass deepens and glows, cutting lines and clues fade, and light plays
   * over the glass for as long as the window stays finished. Never used for
   * the solution reveal.
   */
  setComplete(done: boolean): void {
    if (done === this.complete) return;
    this.complete = done;
    this.canvas.classList.toggle('lit', done);
    this.wrap.classList.toggle('lit', done);
    this.litFrom = this.lit;
    this.litT0 = performance.now();
    this.litDur = done ? 1100 : 350;
    if (done) this.shineT0 = this.litT0 + 400;
    if (this.anim === null) this.anim = requestAnimationFrame((t) => this.tick(t));
  }

  /** One animation frame: the light ramp, then the play of light while finished. */
  private tick(now: number): void {
    const k = Math.min(1, (now - this.litT0) / this.litDur);
    const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    this.lit = this.litFrom + ((this.complete ? 1 : 0) - this.litFrom) * ease;
    // the play of light is slow: half the frame rate is plenty once the ramp is over
    if (k < 1 || now - this.now >= 30) {
      this.now = now;
      this.draw();
    }
    // keep animating while ramping, and while the finished window shimmers (unless the viewer prefers stillness)
    const more = k < 1 || (this.complete && !REDUCED_MOTION && !this.reveal);
    this.anim = more ? requestAnimationFrame((t) => this.tick(t)) : null;
  }

  /**
   * Light on the finished glass: a sunbeam sweeping across the window (strong
   * once, then faintly every so often) and two soft patches of light that drift
   * slowly, as if clouds were passing outside.
   */
  private drawShine(): void {
    const g = this.grid!;
    const ctx = this.ctx;
    const s = this.cell;
    const pad = this.pad;
    const t = (this.now - this.shineT0) / 1000;
    if (t < 0) return;
    const W = g.w * s;
    const H = g.h * s;
    ctx.save();
    ctx.beginPath();
    for (let c = 0; c < g.cells; c++) if (g.active[c]) ctx.rect(pad + (c % g.w) * s, pad + Math.floor(c / g.w) * s, s, s);
    ctx.clip();

    // drifting patches of light
    const cx = pad + W / 2;
    const cy = pad + H / 2;
    const R = Math.max(W, H);
    const patches: [number, number, number, number][] = [
      [cx + 0.32 * W * Math.sin(t * 0.21), cy + 0.28 * H * Math.cos(t * 0.17 + 1), 0.55 * R, 0.2],
      [cx + 0.3 * W * Math.cos(t * 0.13 + 2), cy + 0.3 * H * Math.sin(t * 0.19 + 3), 0.45 * R, 0.14],
    ];
    const fade = Math.min(1, t / 2.5);
    for (const [px, py, r, a] of patches) {
      const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, `rgba(255,244,220,${a * fade})`);
      grad.addColorStop(1, 'rgba(255,244,220,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(pad, pad, W, H);
    }

    // sunbeam: a soft diagonal band crossing the window from top-left to bottom-right
    const PERIOD = 14;
    const SWEEP = 2.4;
    const phase = t % PERIOD;
    if (phase < SWEEP) {
      const first = t < PERIOD;
      const u = phase / SWEEP;
      const eased = u * u * (3 - 2 * u);
      const d = Math.SQRT1_2;
      const pMin = (pad + pad) * d;
      const pMax = (pad + W + pad + H) * d;
      const w = 0.18 * (pMax - pMin);
      const c = pMin - w + (pMax - pMin + 2 * w) * eased;
      const grad = ctx.createLinearGradient((c - w) * d, (c - w) * d, (c + w) * d, (c + w) * d);
      const a = (first ? 0.8 : 0.4) * Math.sin(Math.PI * u);
      grad.addColorStop(0, 'rgba(255,250,235,0)');
      grad.addColorStop(0.35, `rgba(255,250,235,${a * 0.35})`);
      grad.addColorStop(0.5, `rgba(255,252,240,${a})`);
      grad.addColorStop(0.65, `rgba(255,250,235,${a * 0.35})`);
      grad.addColorStop(1, 'rgba(255,250,235,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(pad, pad, W, H);
    }
    ctx.restore();
  }

  draw(): void {
    const g = this.grid;
    const p = this.puzzle;
    const ps = this.reveal ?? this.ps;
    const ctx = this.ctx;
    if (!g || !p || !ps) return;
    const s = this.cell;
    const pad = this.pad;
    const lit = this.reveal ? 0 : this.lit;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.hatch) this.hatch = makeHatch(ctx);
    if (!this.grain) this.grain = makeGrain(ctx);
    const cellX = (c: number) => pad + (c % g.w) * s;
    const cellY = (c: number) => pad + Math.floor(c / g.w) * s;

    // -- glass ------------------------------------------------------------------
    // Each paint region is one pane: a flat colour, then light coming through
    // from behind (a radial highlight over the pane), then the grain of the glass.
    const panes = new Map<number, { x0: number; y0: number; x1: number; y1: number; cells: number[] }>();
    for (let c = 0; c < g.cells; c++) {
      if (!g.active[c]) continue;
      const id = ps.paint[c];
      const x = c % g.w;
      const y = (c - x) / g.w;
      let b = panes.get(id);
      if (!b) panes.set(id, (b = { x0: x, y0: y, x1: x, y1: y, cells: [] }));
      b.x0 = Math.min(b.x0, x);
      b.y0 = Math.min(b.y0, y);
      b.x1 = Math.max(b.x1, x);
      b.y1 = Math.max(b.y1, y);
      b.cells.push(c);
    }
    for (const [id, b] of panes) {
      const painted = id > 0;
      const base = painted ? HUES[ps.hue[id] ?? 0] : CLEAR_GLASS;
      ctx.save();
      ctx.beginPath();
      for (const c of b.cells) ctx.rect(cellX(c), cellY(c), s, s);
      ctx.clip();
      ctx.fillStyle = painted && lit > 0 ? mix(base, deepen(base), lit) : base;
      ctx.fillRect(pad + b.x0 * s, pad + b.y0 * s, (b.x1 - b.x0 + 1) * s, (b.y1 - b.y0 + 1) * s);
      if (painted) {
        // light behind the pane, centred a little above the middle
        const cx = pad + ((b.x0 + b.x1 + 1) / 2) * s;
        const cy = pad + ((b.y0 + b.y1 + 1) / 2) * s - s * 0.15;
        const r = Math.max(b.x1 - b.x0 + 1, b.y1 - b.y0 + 1) * s * 0.8;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, `rgba(255,255,255,${0.3 + 0.25 * lit})`);
        grad.addColorStop(0.55, `rgba(255,255,255,${0.08 + 0.1 * lit})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
        ctx.fillStyle = `rgba(20,10,40,${0.05 * (1 - lit)})`;
        ctx.fillRect(pad + b.x0 * s, pad + b.y0 * s, (b.x1 - b.x0 + 1) * s, (b.y1 - b.y0 + 1) * s);
      } else {
        // clear glass: cool, with a faint sheen from the top-left
        const grad = ctx.createLinearGradient(pad + b.x0 * s, pad + b.y0 * s, pad + (b.x1 + 1) * s, pad + (b.y1 + 1) * s);
        grad.addColorStop(0, 'rgba(255,255,255,0.7)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(pad + b.x0 * s, pad + b.y0 * s, (b.x1 - b.x0 + 1) * s, (b.y1 - b.y0 + 1) * s);
      }
      if (this.grain) {
        ctx.globalAlpha = painted ? 0.7 : 0.35;
        ctx.fillStyle = this.grain;
        ctx.fillRect(pad + b.x0 * s, pad + b.y0 * s, (b.x1 - b.x0 + 1) * s, (b.y1 - b.y0 + 1) * s);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    for (let c = 0; c < g.cells; c++) {
      if (!g.active[c]) continue;
      if (this.errors.has(c) && this.hatch) {
        ctx.fillStyle = this.hatch;
        ctx.fillRect(cellX(c), cellY(c), s, s);
      }
      if (this.areaCells?.includes(c)) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(cellX(c), cellY(c), s, s);
      }
    }

    // cutting lines between cells whose border is undecided (they vanish when the window is done)
    if (lit < 1) {
      ctx.strokeStyle = `rgba(30,25,40,${0.28 * (1 - lit)})`;
      ctx.lineWidth = 1;
      const dashes = s >= 56 ? 8 : s >= 40 ? 7 : 6;
      const unit = s / (dashes * 2 - 1);
      ctx.setLineDash([unit, unit]);
      ctx.beginPath();
      for (let e = 0; e < g.edges; e++) {
        if (ps.edge[e] !== NONE || ps.fixed[e]) continue;
        const [x1, y1, x2, y2] = this.edgeSegment(e);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // clues, etched into the glass (they fade once the window is done)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 1 - 0.6 * lit;
    const clueFont = `600 ${Math.round(s * 0.42)}px ${CLUE_FONT}`;
    for (const clue of p.clues) {
      if (clue.type === 'areaNumber') this.text(String(clue.value), clue.cell, clueFont);
      else if (clue.type === 'rose') for (const sym of clue.symbols) this.text(ROSE_GLYPHS[sym.symbol] ?? String(sym.symbol), sym.cell, `${Math.round(s * 0.42)}px sans-serif`);
      else if (clue.type === 'polyomino') this.miniShape(clue.shape, clue.cell);
    }
    ctx.globalAlpha = 1;
    if (lit > 0 && this.complete) this.drawShine();

    // hint
    if (this.hint?.kind === 'step') {
      const h = this.hint;
      // stage 1: tint the region the reasoning is about
      ctx.fillStyle = 'rgba(255,196,0,0.4)';
      for (const c of h.region) ctx.fillRect(cellX(c), cellY(c), s, s);
      if (this.hintStage >= 2) {
        if (h.value === 'wall') {
          const [x1, y1, x2, y2] = this.edgeSegment(h.edge);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 7;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        } else if (h.focus >= 0) {
          // the cell to add: outlined, with an arrow-ish dash on the shared edge
          const fx = cellX(h.focus);
          const fy = cellY(h.focus);
          ctx.fillStyle = 'rgba(255,196,0,0.4)';
          ctx.fillRect(fx, fy, s, s);
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 4]);
          ctx.strokeRect(fx + 3, fy + 3, s - 6, s - 6);
          ctx.setLineDash([]);
        }
      }
    } else if (this.hint?.kind === 'mistake') {
      const m = this.hint;
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 4]);
      for (const c of m.cells) ctx.strokeRect(cellX(c) + 3, cellY(c) + 3, s - 6, s - 6);
      ctx.setLineDash([]);
      // a wrong wall is recoloured in the wall pass below
    }

    // -- leading -----------------------------------------------------------------
    // Fixed walls and the frame are the lead came of the window. The player's
    // borders are a graphite sketch until the window is done, then they become lead too.
    const lead: [number, number, number, number][] = [];
    const leadW = 5 + 1.5 * lit;
    // Corners touched by lead (fixed walls, even a bad one still drawn thick, and the
    // frame) are collected first: a player-drawn wall needs a bigger gap there to clear
    // the lead's own thickness, or the gap just reads as "swallowed" by the black line.
    const leadCorners = new Set<string>();
    const corner = (x: number, y: number) => leadCorners.add(`${Math.round(x)},${Math.round(y)}`);
    for (let e = 0; e < g.edges; e++) {
      if (ps.fixed[e] !== 1) continue;
      const seg = this.edgeSegment(e);
      corner(seg[0], seg[1]);
      corner(seg[2], seg[3]);
      if (!this.errorEdges.has(e)) lead.push(seg);
    }
    // outer frame: every side of an active cell facing a hole or the outside
    const act = (nx: number, ny: number) => nx >= 0 && ny >= 0 && nx < g.w && ny < g.h && g.active[ny * g.w + nx] === 1;
    for (let c = 0; c < g.cells; c++) {
      if (!g.active[c]) continue;
      const x = c % g.w;
      const y = (c - x) / g.w;
      const X0 = pad + x * s;
      const Y0 = pad + y * s;
      const sides: [number, number, number, number][] = [];
      if (!act(x - 1, y)) sides.push([X0, Y0, X0, Y0 + s]);
      if (!act(x + 1, y)) sides.push([X0 + s, Y0, X0 + s, Y0 + s]);
      if (!act(x, y - 1)) sides.push([X0, Y0, X0 + s, Y0]);
      if (!act(x, y + 1)) sides.push([X0, Y0 + s, X0 + s, Y0 + s]);
      for (const seg of sides) {
        corner(seg[0], seg[1]);
        corner(seg[2], seg[3]);
        lead.push(seg);
      }
    }
    // baseGap: a small breathing room between two player-drawn strokes that share a
    // corner. leadGap: enough to actually clear the lead's own half-width, so the gap
    // isn't just painted back over once the lead is stroked (see strokeLead below).
    const baseGap = 3 * (1 - lit);
    const leadGap = (leadW / 2 + 3.5) * (1 - lit);
    for (let e = 0; e < g.edges; e++) {
      const fixed = ps.fixed[e] === 1;
      if (!fixed && ps.edge[e] !== WALL) continue;
      const bad = this.errorEdges.has(e);
      if (fixed && !bad) continue; // already in `lead`, drawn below
      const seg = this.edgeSegment(e);
      const wrong = this.hint?.kind === 'mistake' && this.hint.edge === e;
      const [x1, y1, x2, y2] = seg;
      let [sx1, sy1, sx2, sy2] = seg;
      if (!fixed) {
        const g1 = leadCorners.has(`${Math.round(x1)},${Math.round(y1)}`) ? leadGap : baseGap;
        const g2 = leadCorners.has(`${Math.round(x2)},${Math.round(y2)}`) ? leadGap : baseGap;
        if (x1 === x2) {
          sy1 += g1;
          sy2 -= g2;
        } else {
          sx1 += g1;
          sx2 -= g2;
        }
      }
      ctx.strokeStyle = bad ? '#7f1d1d' : wrong ? '#dc2626' : lit > 0 ? mix(PLAYER_WALL, LEAD, lit) : PLAYER_WALL;
      ctx.lineWidth = fixed ? 5 : wrong ? 7 : 3 + (leadW - 3) * lit;
      ctx.lineCap = fixed || lit > 0.5 ? 'square' : 'round';
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();
      if (bad && this.hatch) {
        // a hatched band across the wall, like the original's error mark
        const t = Math.max(10, s * 0.28);
        ctx.fillStyle = this.hatch;
        if (x1 === x2) ctx.fillRect(x1 - t / 2, y1, t, y2 - y1);
        else ctx.fillRect(x1, y1 - t / 2, x2 - x1, t);
      }
    }
    this.strokeLead(lead, leadW);

    // edge markers (gemini / delta), like small solder tags on the leading
    for (const clue of p.clues) {
      if (clue.type !== 'gemini' && clue.type !== 'delta') continue;
      const e = edgeBetween(g, clue.edge.a, clue.edge.b);
      const [x1, y1, x2, y2] = this.edgeSegment(e);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const r = s * 0.17;
      ctx.fillStyle = '#fbf7ef';
      ctx.strokeStyle = LEAD;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = LEAD;
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
      ctx.fillStyle = 'rgba(28,28,33,0.88)';
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fbf7ef';
      ctx.font = `bold ${Math.round(s * 0.45)}px sans-serif`;
      ctx.fillText(String(this.areaCells.length), cx, cy + 1);
    }
  }

  /** Lead came: a dark bar with a thin light catching its upper-left edge. */
  private strokeLead(segs: [number, number, number, number][], w: number): void {
    const ctx = this.ctx;
    ctx.lineCap = 'square';
    ctx.strokeStyle = LEAD;
    ctx.lineWidth = w;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of segs) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    ctx.strokeStyle = LEAD_LIGHT;
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    const o = w / 2 - 1.4;
    for (const [x1, y1, x2, y2] of segs) {
      if (x1 === x2) {
        ctx.moveTo(x1 - o, y1 + 1);
        ctx.lineTo(x2 - o, y2 - 1);
      } else {
        ctx.moveTo(x1 + 1, y1 - o);
        ctx.lineTo(x2 - 1, y2 - o);
      }
    }
    ctx.stroke();
    ctx.lineCap = 'round';
  }

  private text(t: string, cell: number, font: string): void {
    const g = this.grid!;
    const x = cell % g.w;
    const y = (cell - x) / g.w;
    const ctx = this.ctx;
    const px = this.pad + (x + 0.5) * this.cell;
    const py = this.pad + (y + 0.5) * this.cell + 1;
    ctx.font = font;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.strokeText(t, px, py);
    ctx.fillStyle = INK;
    ctx.fillText(t, px, py);
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
    this.ctx.fillStyle = INK;
    for (const [px, py] of pts) this.ctx.fillRect(ox + px * unit + 0.5, oy + py * unit + 0.5, unit - 1, unit - 1);
  }
}

/** Hatching used to mark rule violations: dark red with a light stripe so it reads on any glass. */
function makeHatch(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const c = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  const size = 8;
  c.width = size * dpr;
  c.height = size * dpr;
  const p = c.getContext('2d')!;
  p.scale(dpr, dpr);
  const line = (offset: number, style: string, width: number) => {
    p.strokeStyle = style;
    p.lineWidth = width;
    p.beginPath();
    p.moveTo(-2 + offset, size + 2 + offset);
    p.lineTo(size + 2 + offset, -2 + offset);
    p.moveTo(-2 + offset, 2 + offset);
    p.lineTo(2 + offset, -2 + offset);
    p.moveTo(size - 2 + offset, size + 2 + offset);
    p.lineTo(size + 2 + offset, size - 2 + offset);
    p.stroke();
  };
  line(0, 'rgba(110,20,20,0.75)', 2.2);
  line(1.6, 'rgba(255,255,255,0.55)', 0.8);
  const pat = ctx.createPattern(c, 'repeat');
  if (pat && 'setTransform' in pat) pat.setTransform(new DOMMatrix().scale(1 / dpr));
  return pat;
}

/** The grain of hand-rolled glass: faint diagonal streaks and a little mottling. */
function makeGrain(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const c = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  const size = 160;
  c.width = size * dpr;
  c.height = size * dpr;
  const p = c.getContext('2d')!;
  p.scale(dpr, dpr);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  p.lineCap = 'round';
  for (let i = 0; i < 22; i++) {
    const x = rnd() * size * 2 - size;
    const len = 40 + rnd() * 100;
    const light = rnd() < 0.6;
    p.strokeStyle = light ? `rgba(255,255,255,${0.03 + rnd() * 0.05})` : `rgba(0,0,30,${0.02 + rnd() * 0.03})`;
    p.lineWidth = 3 + rnd() * 9;
    p.beginPath();
    // streaks are tiled: draw each one three times so the pattern wraps
    for (const dx of [-size, 0, size]) {
      p.moveTo(x + dx, size);
      p.lineTo(x + dx + len, size - len);
    }
    p.stroke();
  }
  for (let i = 0; i < 90; i++) {
    const light = rnd() < 0.65;
    p.fillStyle = light ? `rgba(255,255,255,${0.02 + rnd() * 0.04})` : `rgba(0,0,30,${0.015 + rnd() * 0.025})`;
    const x = rnd() * size;
    const y = rnd() * size;
    const rr = 6 + rnd() * 18;
    // mottling is tiled too: draw near the edges again so the pattern wraps
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      p.beginPath();
      p.arc(x + dx, y + dy, rr, 0, Math.PI * 2);
      p.fill();
    }
  }
  const pat = ctx.createPattern(c, 'repeat');
  if (pat && 'setTransform' in pat) pat.setTransform(new DOMMatrix().scale(1 / dpr));
  return pat;
}

function hexToRgb(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

/** Linear blend of two hex colours (t = 0 → a, t = 1 → b). */
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}

/** A richer version of a glass colour: more saturated and a touch darker. */
function deepen(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2 / 255;
  let h = 0;
  const d = (max - min) / 255;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / 255 / d) % 6;
    else if (max === g) h = (b - r) / 255 / d + 2;
    else h = (r - g) / 255 / d + 4;
  }
  const s2 = Math.min(1, sat * 1.25 + 0.1);
  const l2 = Math.max(0, l - 0.08);
  const c = (1 - Math.abs(2 * l2 - 1)) * s2;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = l2 - c / 2;
  const [r2, g2, b2] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r2)}${to(g2)}${to(b2)}`;
}

/** Wall edges of a label array. */
export function wallsOf(g: Grid, labels: ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(g.edges);
  for (let e = 0; e < g.edges; e++) out[e] = labels[g.edgeA[e]] !== labels[g.edgeB[e]] ? 1 : 0;
  return out;
}

/**
 * A solution as the player would have marked it: every region painted (with
 * neighbouring regions in different hues) and its borders drawn.
 */
export function solutionView(puzzle: Puzzle, labels: ArrayLike<number>): PlayerState {
  const ps = new PlayerState(puzzle);
  const g = ps.grid;
  const hue: number[] = [];
  for (let c = 0; c < g.cells; c++) {
    const l = labels[c];
    if (l < 0) continue;
    if (hue[l] === undefined) {
      // greedy colouring: avoid hues already given to any neighbouring region
      const used = new Set<number>();
      for (let d = 0; d < g.cells; d++) {
        if (labels[d] !== l) continue;
        for (const n of g.adj[d]) if (labels[n] !== l && labels[n] >= 0 && hue[labels[n]] !== undefined) used.add(hue[labels[n]]);
      }
      const pool = huePool(used);
      hue[l] = pool.length ? pool[l % pool.length] : l % HUES.length;
    }
    ps.paint[c] = l + 1;
    ps.hue[l + 1] = hue[l];
  }
  for (let e = 0; e < g.edges; e++) if (labels[g.edgeA[e]] !== labels[g.edgeB[e]]) ps.setEdge(e, WALL);
  return ps;
}

/** Small canvas drawing a shape, for the rules panel. */
export function shapeIcon(key: ShapeKey, unit = 9, fill = '#374151'): HTMLCanvasElement {
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
  ctx.fillStyle = fill;
  for (const [x, y] of pts) ctx.fillRect(3 + x * unit + 0.5, 3 + y * unit + 0.5, unit - 1, unit - 1);
  return c;
}
