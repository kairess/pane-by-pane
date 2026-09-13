import type { Grid } from './grid.ts';
import { otherCell } from './grid.ts';
import { regionKey, type ShapeKey } from './shape.ts';
import type { Labels } from './types.ts';

export const UNKNOWN = 0;
export const JOIN = 1;
export const WALL = 2;
export type EdgeValue = typeof UNKNOWN | typeof JOIN | typeof WALL;

/**
 * A component: a set of cells known to be in the same region (connected by
 * JOIN edges). Every cell starts as its own component. Components only ever
 * merge. Alongside the cells we keep monotone facts about the *final* region
 * this component will become:
 *
 *   lo..hi        bounds on its area
 *   shapes        finite set of allowed final shapes (null = unrestricted)
 *   notShapes     shapes it must not become
 *
 * Rules narrow these facts; the shared propagators (core.ts) turn them into
 * edge deductions. This is what lets e.g. Area Number + Gemini + Shape Bank
 * interact without the rules knowing about each other.
 */
export interface Comp {
  id: number;
  cells: number[];
  lo: number;
  hi: number;
  shapes: Set<ShapeKey> | null;
  notShapes: Set<ShapeKey>;
  /**
   * Cache of still-viable final-region placements (core.ts). Placements only
   * ever become invalid as the state is refined, so each round filters the
   * previous list. Treated as immutable: refining creates a new array.
   */
  plc?: readonly Placement[];
}

export interface Placement {
  readonly key: ShapeKey;
  readonly cells: readonly number[];
}

export class State {
  readonly grid: Grid;
  edge: Uint8Array;
  compOf: Int32Array;
  comps: Map<number, Comp>;
  unknownCount: number;
  /** bumped whenever a component fact (bounds/shapes) is narrowed */
  version = 0;

  constructor(grid: Grid, init = true) {
    this.grid = grid;
    this.edge = new Uint8Array(grid.edges);
    this.compOf = new Int32Array(grid.cells);
    this.comps = new Map();
    this.unknownCount = grid.edges;
    if (init) {
      for (let c = 0; c < grid.cells; c++) {
        this.compOf[c] = c;
        if (!grid.active[c]) continue;
        this.comps.set(c, {
          id: c,
          cells: [c],
          lo: 1,
          hi: grid.cells,
          shapes: null,
          notShapes: new Set(),
        });
      }
    }
  }

  clone(): State {
    const s = new State(this.grid, false);
    s.edge = this.edge.slice();
    s.compOf = this.compOf.slice();
    s.unknownCount = this.unknownCount;
    s.version = this.version;
    for (const [id, c] of this.comps) {
      s.comps.set(id, {
        id,
        cells: c.cells.slice(),
        lo: c.lo,
        hi: c.hi,
        shapes: c.shapes ? new Set(c.shapes) : null,
        notShapes: new Set(c.notShapes),
        plc: c.plc,
      });
    }
    return s;
  }

  comp(cell: number): Comp {
    return this.comps.get(this.compOf[cell])!;
  }

  isComplete(): boolean {
    return this.unknownCount === 0;
  }

  /** Unknown edges leaving the component. */
  openEdges(c: Comp): number[] {
    const out: number[] = [];
    const g = this.grid;
    for (const cell of c.cells) {
      const es = g.adjEdge[cell];
      for (let i = 0; i < es.length; i++) if (this.edge[es[i]] === UNKNOWN) out.push(es[i]);
    }
    return out;
  }

  /** Components adjacent across a WALL edge. */
  wallNeighbours(c: Comp): Comp[] {
    const seen = new Set<number>();
    const out: Comp[] = [];
    const g = this.grid;
    for (const cell of c.cells) {
      const es = g.adjEdge[cell];
      for (let i = 0; i < es.length; i++) {
        if (this.edge[es[i]] !== WALL) continue;
        const o = this.compOf[otherCell(g, es[i], cell)];
        if (o !== c.id && !seen.has(o)) {
          seen.add(o);
          out.push(this.comps.get(o)!);
        }
      }
    }
    return out;
  }

  isClosed(c: Comp): boolean {
    const g = this.grid;
    for (const cell of c.cells) {
      const es = g.adjEdge[cell];
      for (let i = 0; i < es.length; i++) if (this.edge[es[i]] === UNKNOWN) return false;
    }
    return true;
  }

  shapeOf(c: Comp): ShapeKey {
    return regionKey(this.grid.w, c.cells);
  }

  // -- monotone fact narrowing ---------------------------------------------

  /** Narrow area bounds. Returns false on contradiction. */
  narrow(c: Comp, lo: number, hi: number): boolean {
    if (lo > c.lo) {
      c.lo = lo;
      this.version++;
    }
    if (hi < c.hi) {
      c.hi = hi;
      this.version++;
    }
    return c.lo <= c.hi && c.cells.length <= c.hi;
  }

  restrictShapes(c: Comp, allowed: Iterable<ShapeKey>): boolean {
    const next = new Set<ShapeKey>();
    for (const k of allowed) {
      if (c.notShapes.has(k)) continue;
      if (c.shapes === null || c.shapes.has(k)) next.add(k);
    }
    if (c.shapes !== null && next.size === c.shapes.size) return c.shapes.size > 0;
    c.shapes = next;
    this.version++;
    return next.size > 0;
  }

  excludeShape(c: Comp, k: ShapeKey): boolean {
    if (!c.notShapes.has(k)) {
      c.notShapes.add(k);
      this.version++;
    }
    if (c.shapes) {
      if (c.shapes.delete(k)) this.version++;
      return c.shapes.size > 0;
    }
    return true;
  }

  // -- edge assignment -------------------------------------------------------

  /**
   * Set an edge. Returns false on contradiction (JOIN inside a WALL'd pair,
   * WALL inside one component, merge that violates facts).
   */
  setEdge(e: number, v: EdgeValue): boolean {
    const cur = this.edge[e];
    if (cur === v) return true;
    if (cur !== UNKNOWN) return false;
    const g = this.grid;
    const a = g.edgeA[e];
    const b = g.edgeB[e];
    const ca = this.compOf[a];
    const cb = this.compOf[b];
    if (v === WALL) {
      if (ca === cb) return false;
      this.edge[e] = WALL;
      this.unknownCount--;
      return true;
    }
    this.edge[e] = JOIN;
    this.unknownCount--;
    if (ca === cb) return true;
    return this.merge(this.comps.get(ca)!, this.comps.get(cb)!);
  }

  /** Would merging A and B immediately violate a generic fact? (rules add their own) */
  mergeConflict(A: Comp, B: Comp): boolean {
    if (this.wallBetween(A, B)) return true;
    const lo = Math.max(A.lo, B.lo);
    const hi = Math.min(A.hi, B.hi);
    if (lo > hi) return true;
    if (A.cells.length + B.cells.length > hi) return true;
    const shapes = A.shapes ?? B.shapes;
    if (shapes) {
      let any = false;
      for (const k of shapes) {
        if (A.shapes && !A.shapes.has(k)) continue;
        if (B.shapes && !B.shapes.has(k)) continue;
        if (A.notShapes.has(k) || B.notShapes.has(k)) continue;
        any = true;
        break;
      }
      if (!any) return true;
    }
    return false;
  }

  /** Is there a WALL edge directly between the two components? */
  wallBetween(A: Comp, B: Comp): boolean {
    if (A.cells.length < B.cells.length) [A, B] = [B, A];
    const g = this.grid;
    for (const cell of B.cells) {
      const es = g.adjEdge[cell];
      for (let i = 0; i < es.length; i++) {
        if (this.edge[es[i]] === WALL && this.compOf[otherCell(g, es[i], cell)] === A.id) return true;
      }
    }
    return false;
  }

  private merge(A: Comp, B: Comp): boolean {
    if (A.cells.length < B.cells.length) [A, B] = [B, A];
    const g = this.grid;
    if (this.wallBetween(A, B)) return false;
    // Merge facts.
    if (!this.narrow(A, B.lo, B.hi)) return false;
    for (const k of B.notShapes) A.notShapes.add(k);
    if (B.shapes) {
      if (!this.restrictShapes(A, B.shapes)) return false;
    } else if (A.shapes) {
      for (const k of A.notShapes) A.shapes.delete(k);
      if (A.shapes.size === 0) return false;
    }
    for (const cell of B.cells) this.compOf[cell] = A.id;
    A.cells.push(...B.cells);
    this.comps.delete(B.id);
    if (A.cells.length > A.hi) return false;
    // Every UNKNOWN edge now inside the component is a JOIN.
    for (const cell of B.cells) {
      const es = g.adjEdge[cell];
      for (let i = 0; i < es.length; i++) {
        const e = es[i];
        if (this.edge[e] === UNKNOWN && this.compOf[otherCell(g, e, cell)] === A.id) {
          this.edge[e] = JOIN;
          this.unknownCount--;
        }
      }
    }
    return true;
  }

  // -- output ---------------------------------------------------------------

  labels(): Labels {
    const out = new Int32Array(this.grid.cells);
    const map = new Map<number, number>();
    for (let c = 0; c < this.grid.cells; c++) {
      if (!this.grid.active[c]) {
        out[c] = -1;
        continue;
      }
      const id = this.compOf[c];
      let l = map.get(id);
      if (l === undefined) {
        l = map.size;
        map.set(id, l);
      }
      out[c] = l;
    }
    return out;
  }
}

/** Build a fully-determined state from a label array (used by verifiers/tests). */
export function stateFromLabels(grid: Grid, labels: Labels): State {
  const s = new State(grid);
  for (let e = 0; e < grid.edges; e++) {
    const v: EdgeValue = labels[grid.edgeA[e]] === labels[grid.edgeB[e]] ? JOIN : WALL;
    if (!s.setEdge(e, v)) throw new Error('labels are not a valid partition');
  }
  return s;
}

/** Regions of a label array as cell lists, in order of first appearance (holes = -1 skipped). */
export function regionsFromLabels(labels: Labels): number[][] {
  const map = new Map<number, number[]>();
  for (let c = 0; c < labels.length; c++) {
    if (labels[c] < 0) continue;
    let r = map.get(labels[c]);
    if (!r) {
      r = [];
      map.set(labels[c], r);
    }
    r.push(c);
  }
  return [...map.values()];
}
