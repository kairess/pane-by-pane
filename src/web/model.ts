import { makeGrid, otherCell, type Grid } from '../engine/grid.ts';
import type { Puzzle } from '../engine/types.ts';

/**
 * The player's marks on a board.
 *
 *   paint[c]   0 = unpainted, otherwise a paint-region id (cells with the same
 *              id are claimed to be one region; kept connected)
 *   edge[e]    NONE / WALL (border drawn)
 *
 * Painting and borders are independent notations, like the original game:
 * either one alone can complete a puzzle (see analysis.ts).
 */
export const NONE = 0;
export const WALL = 1;
export type EdgeMark = typeof NONE | typeof WALL;

export interface Snapshot {
  paint: Int32Array;
  edge: Uint8Array;
  hue: number[];
  stamp: Int32Array;
}

/** Pastel fills for paint regions; neighbouring regions get different ones. */
export const HUES = ['#bfdbfe', '#bbf7d0', '#fde68a', '#fbcfe8', '#ddd6fe', '#fed7aa', '#99f6e4', '#fecaca', '#bae6fd', '#d9f99d'];

export class PlayerState {
  readonly grid: Grid;
  paint: Int32Array;
  edge: Uint8Array;
  /** hue index per paint id (sparse) */
  hue: number[] = [];
  /** order in which marks were made (for error attribution) */
  stamp: Int32Array;
  private clock = 1;
  private nextId = 1;
  private history: Snapshot[] = [];
  private future: Snapshot[] = [];

  constructor(puzzle: Puzzle) {
    this.grid = makeGrid(puzzle.width, puzzle.height, puzzle.holes ?? []);
    this.paint = new Int32Array(this.grid.cells);
    this.edge = new Uint8Array(this.grid.edges);
    this.stamp = new Int32Array(this.grid.cells + this.grid.edges);
  }

  // -- snapshots -------------------------------------------------------------

  snapshot(): Snapshot {
    return { paint: this.paint.slice(), edge: this.edge.slice(), hue: this.hue.slice(), stamp: this.stamp.slice() };
  }

  restore(s: Snapshot): void {
    this.paint = s.paint.slice();
    this.edge = s.edge.slice();
    this.hue = s.hue.slice();
    this.stamp = s.stamp.slice();
    this.nextId = Math.max(1, ...Array.from(this.paint)) + 1;
  }

  /** Call before a gesture that changes state. */
  beginChange(): void {
    this.history.push(this.snapshot());
    if (this.history.length > 200) this.history.shift();
    this.future = [];
  }

  undo(): boolean {
    const s = this.history.pop();
    if (!s) return false;
    this.future.push(this.snapshot());
    this.restore(s);
    return true;
  }

  redo(): boolean {
    const s = this.future.pop();
    if (!s) return false;
    this.history.push(this.snapshot());
    this.restore(s);
    return true;
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }

  clear(): void {
    this.beginChange();
    this.paint.fill(0);
    this.edge.fill(NONE);
    this.hue = [];
    this.stamp.fill(0);
  }

  isEmpty(): boolean {
    return this.paint.every((p) => p === 0) && this.edge.every((e) => e === NONE);
  }

  // -- paint -----------------------------------------------------------------

  /** Start a new paint region at an unpainted cell; returns its id. */
  newRegion(cell: number): number {
    const id = this.nextId++;
    this.hue[id] = this.pickHue(cell, id);
    this.setPaint(cell, id);
    return id;
  }

  /**
   * Paint `cell` with region `id` if it touches that region across a non-wall
   * edge. If the cell already belongs to another region, that whole region is
   * absorbed into `id` (dragging the brush over a region recolours it).
   */
  extend(cell: number, id: number): boolean {
    if (!this.grid.active[cell] || this.paint[cell] === id) return false;
    const g = this.grid;
    let touches = false;
    for (let i = 0; i < g.adj[cell].length; i++) {
      const e = g.adjEdge[cell][i];
      if (this.edge[e] !== WALL && this.paint[g.adj[cell][i]] === id) {
        touches = true;
        break;
      }
    }
    if (!touches) return false;
    const old = this.paint[cell];
    if (old) {
      for (const c of this.regionCells(old)) this.setPaint(c, id);
      delete this.hue[old];
    } else this.setPaint(cell, id);
    return true;
  }

  erasePaint(cell: number): boolean {
    const old = this.paint[cell];
    if (!old) return false;
    this.setPaint(cell, 0);
    this.recompact(old);
    return true;
  }

  private setPaint(cell: number, id: number): void {
    this.paint[cell] = id;
    this.stamp[cell] = id ? this.clock++ : 0;
  }

  /** Cells of a paint region. */
  regionCells(id: number): number[] {
    const out: number[] = [];
    for (let c = 0; c < this.grid.cells; c++) if (this.paint[c] === id) out.push(c);
    return out;
  }

  /**
   * After a cell is removed or a wall splits a region, the region may have
   * fallen apart: give each connected piece its own id (and a fresh hue for
   * the new pieces, like the original game).
   */
  private recompact(id: number): void {
    const g = this.grid;
    const cells = this.regionCells(id);
    if (cells.length === 0) {
      delete this.hue[id];
      return;
    }
    const seen = new Set<number>();
    let first = true;
    for (const start of cells) {
      if (seen.has(start)) continue;
      const comp: number[] = [];
      const stack = [start];
      seen.add(start);
      while (stack.length) {
        const c = stack.pop()!;
        comp.push(c);
        for (let i = 0; i < g.adj[c].length; i++) {
          const n = g.adj[c][i];
          if (this.paint[n] === id && !seen.has(n) && this.edge[g.adjEdge[c][i]] !== WALL) {
            seen.add(n);
            stack.push(n);
          }
        }
      }
      if (first) {
        first = false;
        continue;
      }
      const nid = this.nextId++;
      for (const c of comp) this.paint[c] = nid;
      this.hue[nid] = this.pickHue(comp[0], nid);
    }
  }

  private pickHue(cell: number, id: number): number {
    const used = new Set<number>();
    const g = this.grid;
    for (const n of g.adj[cell]) {
      const p = this.paint[n];
      if (p && p !== id && this.hue[p] !== undefined) used.add(this.hue[p]);
    }
    const free = HUES.map((_, i) => i).filter((i) => !used.has(i));
    const pool = free.length ? free : HUES.map((_, i) => i);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // -- edges -----------------------------------------------------------------

  setEdge(e: number, v: EdgeMark): void {
    if (this.edge[e] === v) return;
    this.edge[e] = v;
    this.stamp[this.grid.cells + e] = v === NONE ? 0 : this.clock++;
    if (v === WALL) {
      // A wall through a paint region splits it.
      const a = this.grid.edgeA[e];
      const b = this.grid.edgeB[e];
      if (this.paint[a] && this.paint[a] === this.paint[b]) this.recompact(this.paint[a]);
    }
  }

  toggleWall(e: number): void {
    this.setEdge(e, this.edge[e] === WALL ? NONE : WALL);
  }

  // -- derived partitions ------------------------------------------------------

  /** Region label per cell from walls only (-1 for holes). */
  labelsByWalls(): Int32Array {
    return this.components((e) => this.edge[e] !== WALL);
  }

  /** Region label per cell from paint (unpainted cells get -2). */
  labelsByPaint(): Int32Array {
    const out = new Int32Array(this.grid.cells);
    const map = new Map<number, number>();
    for (let c = 0; c < this.grid.cells; c++) {
      if (!this.grid.active[c]) out[c] = -1;
      else if (!this.paint[c]) out[c] = -2;
      else {
        let l = map.get(this.paint[c]);
        if (l === undefined) {
          l = map.size;
          map.set(this.paint[c], l);
        }
        out[c] = l;
      }
    }
    return out;
  }

  /** Connected components over edges accepted by `pass`. */
  components(pass: (e: number) => boolean): Int32Array {
    const g = this.grid;
    const parent = Int32Array.from({ length: g.cells }, (_, i) => i);
    const find = (x: number): number => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    };
    for (let e = 0; e < g.edges; e++) {
      if (!pass(e)) continue;
      const a = find(g.edgeA[e]);
      const b = find(g.edgeB[e]);
      if (a !== b) parent[a] = b;
    }
    const out = new Int32Array(g.cells);
    const map = new Map<number, number>();
    for (let c = 0; c < g.cells; c++) {
      if (!g.active[c]) {
        out[c] = -1;
        continue;
      }
      const r = find(c);
      let l = map.get(r);
      if (l === undefined) {
        l = map.size;
        map.set(r, l);
      }
      out[c] = l;
    }
    return out;
  }

  /** Size of the wall-bounded area containing `cell`. */
  areaOf(cell: number): { count: number; cells: number[] } {
    const labels = this.labelsByWalls();
    const cells: number[] = [];
    for (let c = 0; c < this.grid.cells; c++) if (labels[c] === labels[cell]) cells.push(c);
    return { count: cells.length, cells };
  }

  // -- persistence -------------------------------------------------------------

  serialize(): string {
    return JSON.stringify({ paint: Array.from(this.paint), edge: Array.from(this.edge), hue: this.hue });
  }

  deserialize(text: string): boolean {
    try {
      const d = JSON.parse(text) as { paint: number[]; edge: number[]; hue: (number | null)[] };
      if (d.paint.length !== this.grid.cells || d.edge.length !== this.grid.edges) return false;
      this.paint = Int32Array.from(d.paint);
      this.edge = Uint8Array.from(d.edge);
      this.hue = d.hue.map((h) => (h === null ? undefined : h)) as number[];
      this.nextId = Math.max(1, ...d.paint) + 1;
      this.history = [];
      this.future = [];
      return true;
    } catch {
      return false;
    }
  }
}

export { otherCell };
