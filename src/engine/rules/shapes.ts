import type { Grid } from '../grid.ts';
import { edgeBetween } from '../grid.ts';
import { canonical, parseKey, regionKey, type ShapeKey } from '../shape.ts';
import { WALL, type Comp, type State } from '../state.ts';
import type { DeltaClue, GeminiClue, Labels, PolyominoClue, ShapeBankClue } from '../types.ts';
import type { Deduction, Rule } from './rule.ts';

/** Shape Bank: every region's free-polyomino shape is in the bank. */
export class ShapeBankRule implements Rule {
  readonly kind = 'shapeBank';
  readonly bank: Set<ShapeKey>;
  constructor(clues: ShapeBankClue[]) {
    // Several bank clues intersect.
    let bank: Set<ShapeKey> | null = null;
    for (const c of clues) {
      const s = new Set<ShapeKey>(c.shapes.map((k) => canonical(parseKey(k))));
      if (bank === null) {
        bank = s;
      } else {
        const prev: Set<ShapeKey> = bank;
        bank = new Set<ShapeKey>([...prev].filter((k) => s.has(k)));
      }
    }
    this.bank = bank ?? new Set<ShapeKey>();
  }

  init(state: State): boolean {
    for (const comp of state.comps.values()) if (!state.restrictShapes(comp, this.bank)) return false;
    return true;
  }

  propagate(): boolean {
    return true;
  }

  check(g: Grid, _labels: Labels, regions: number[][]): boolean {
    return regions.every((r) => this.bank.has(regionKey(g.w, r)));
  }
}

/** Polyomino: the region containing the clue cell has exactly the given shape. */
export class PolyominoRule implements Rule {
  readonly kind = 'polyomino';
  private clues: PolyominoClue[];
  constructor(clues: PolyominoClue[]) {
    this.clues = clues.map((c) => ({ ...c, shape: canonical(parseKey(c.shape)) }));
  }

  init(state: State): boolean {
    for (const c of this.clues) if (!state.restrictShapes(state.comp(c.cell), [c.shape])) return false;
    return true;
  }

  propagate(): boolean {
    return true;
  }

  check(g: Grid, labels: Labels, regions: number[][]): boolean {
    return this.clues.every((c) => regionKey(g.w, regions[labels[c.cell]]) === c.shape);
  }
}

/**
 * Gemini (same shape) and Delta (different shape) markers on an edge. The
 * marked edge is always a border. Facts flow between the two sides:
 *   Gemini: bounds and shape candidates are shared (intersected).
 *   Delta:  once one side is pinned to a single shape, the other excludes it.
 */
export class PairShapeRule implements Rule {
  readonly kind: 'gemini' | 'delta';
  private edges: number[];

  constructor(kind: 'gemini' | 'delta', clues: (GeminiClue | DeltaClue)[], grid: Grid) {
    this.kind = kind;
    this.edges = clues.map((c) => {
      const e = edgeBetween(grid, c.edge.a, c.edge.b);
      if (e < 0) throw new Error(`${kind} clue on non-adjacent cells ${c.edge.a},${c.edge.b}`);
      return e;
    });
  }

  init(state: State, out: Deduction[]): boolean {
    for (const e of this.edges) out.push({ edge: e, value: WALL, technique: 'marker-wall', tier: 1 });
    return true;
  }

  private sides(state: State, e: number): [Comp, Comp] {
    const g = state.grid;
    return [state.comp(g.edgeA[e]), state.comp(g.edgeB[e])];
  }

  propagate(state: State): boolean {
    for (const e of this.edges) {
      const [A, B] = this.sides(state, e);
      if (A === B) return false;
      if (this.kind === 'gemini') {
        const lo = Math.max(A.lo, B.lo);
        const hi = Math.min(A.hi, B.hi);
        if (!state.narrow(A, lo, hi) || !state.narrow(B, lo, hi)) return false;
        for (const k of A.notShapes) if (!state.excludeShape(B, k)) return false;
        for (const k of B.notShapes) if (!state.excludeShape(A, k)) return false;
        if (A.shapes && !state.restrictShapes(B, A.shapes)) return false;
        if (B.shapes && !state.restrictShapes(A, B.shapes)) return false;
      } else {
        if (A.shapes?.size === 1) for (const k of A.shapes) if (!state.excludeShape(B, k)) return false;
        if (B.shapes?.size === 1) for (const k of B.shapes) if (!state.excludeShape(A, k)) return false;
      }
    }
    return true;
  }

  placementConflict(state: State, _base: Comp, cells: readonly number[], inside: Int32Array, stamp: number): boolean {
    const g = state.grid;
    const n = cells.length;
    for (const e of this.edges) {
      const a = g.edgeA[e];
      const b = g.edgeB[e];
      const ia = inside[a] === stamp;
      const ib = inside[b] === stamp;
      if (ia && ib) return true;
      if (!ia && !ib) continue;
      const other = state.comp(ia ? b : a);
      if (this.kind === 'gemini') {
        if (n < other.lo || n > other.hi) return true;
        if (other.shapes || other.notShapes.size) {
          const k = regionKey(g.w, cells);
          if (other.notShapes.has(k)) return true;
          if (other.shapes && !other.shapes.has(k)) return true;
        }
      } else if (other.shapes?.size === 1) {
        const k = regionKey(g.w, cells);
        if (other.shapes.has(k)) return true;
      }
    }
    return false;
  }

  check(g: Grid, labels: Labels, regions: number[][]): boolean {
    for (const e of this.edges) {
      const a = labels[g.edgeA[e]];
      const b = labels[g.edgeB[e]];
      if (a === b) return false;
      const same = regionKey(g.w, regions[a]) === regionKey(g.w, regions[b]);
      if (same !== (this.kind === 'gemini')) return false;
    }
    return true;
  }
}
