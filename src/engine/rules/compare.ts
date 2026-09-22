import type { Grid } from '../grid.ts';
import { edgeBetween } from '../grid.ts';
import { WALL, type Comp, type State } from '../state.ts';
import type { DifferenceClue, InequalityClue, Labels } from '../types.ts';
import type { Deduction, Rule } from './rule.ts';

/**
 * Inequality (one side strictly larger) and Difference (areas differ by
 * exactly N) markers on an edge. Like Gemini/Delta the marked edge is a
 * border; area bounds flow between the two sides:
 *   Inequality: A > B  →  A.lo ≥ B.lo + 1, B.hi ≤ A.hi − 1 (chains through
 *               several markers by repeated propagation)
 *   Difference: |A − B| = N  →  A ∈ [B.lo − N, B.hi + N]; once one side is
 *               exact (x) the other is x−N or x+N, and whichever of the two
 *               the bounds still allow. The middle of that interval cannot be
 *               excluded by interval bounds alone (the ± the original's
 *               players complain about), so placements are checked exactly.
 */
export class InequalityRule implements Rule {
  readonly kind = 'inequality';
  /** [edge, cell on the larger side] */
  private marks: [number, number][];

  constructor(clues: InequalityClue[], grid: Grid) {
    this.marks = clues.map((c) => {
      const e = edgeBetween(grid, c.edge.a, c.edge.b);
      if (e < 0) throw new Error(`inequality clue on non-adjacent cells ${c.edge.a},${c.edge.b}`);
      return [e, c.larger === 'a' ? c.edge.a : c.edge.b];
    });
  }

  init(_state: State, out: Deduction[]): boolean {
    for (const [e] of this.marks) out.push({ edge: e, value: WALL, technique: 'marker-wall', tier: 1 });
    return true;
  }

  private sides(state: State, e: number, big: number): [Comp, Comp] {
    const g = state.grid;
    const other = g.edgeA[e] === big ? g.edgeB[e] : g.edgeA[e];
    return [state.comp(big), state.comp(other)];
  }

  propagate(state: State): boolean {
    for (const [e, big] of this.marks) {
      const [A, B] = this.sides(state, e, big);
      if (A === B) return false;
      if (!state.narrow(A, B.lo + 1, A.hi)) return false;
      if (!state.narrow(B, B.lo, A.hi - 1)) return false;
    }
    return true;
  }

  placementConflict(state: State, _base: Comp, cells: readonly number[], inside: Int32Array, stamp: number): boolean {
    const g = state.grid;
    const n = cells.length;
    for (const [e, big] of this.marks) {
      const a = g.edgeA[e];
      const b = g.edgeB[e];
      const ia = inside[a] === stamp;
      const ib = inside[b] === stamp;
      if (ia && ib) return true;
      if (!ia && !ib) continue;
      const mine = ia ? a : b;
      const other = state.comp(ia ? b : a);
      // the placed region is the larger side: it must beat the other's smallest possible area
      if (mine === big ? n <= other.lo : n >= other.hi) return true;
    }
    return false;
  }

  check(g: Grid, labels: Labels, regions: number[][]): boolean {
    for (const [e, big] of this.marks) {
      const a = labels[g.edgeA[e]];
      const b = labels[g.edgeB[e]];
      if (a === b) return false;
      const bigLabel = labels[big];
      const small = bigLabel === a ? b : a;
      if (regions[bigLabel].length <= regions[small].length) return false;
    }
    return true;
  }
}

export class DifferenceRule implements Rule {
  readonly kind = 'difference';
  private marks: [number, number][];

  constructor(clues: DifferenceClue[], grid: Grid) {
    this.marks = clues.map((c) => {
      const e = edgeBetween(grid, c.edge.a, c.edge.b);
      if (e < 0) throw new Error(`difference clue on non-adjacent cells ${c.edge.a},${c.edge.b}`);
      if (!Number.isInteger(c.value) || c.value < 0) throw new Error('difference value must be a non-negative integer');
      return [e, c.value];
    });
  }

  init(_state: State, out: Deduction[]): boolean {
    for (const [e] of this.marks) out.push({ edge: e, value: WALL, technique: 'marker-wall', tier: 1 });
    return true;
  }

  /** Narrow A given B and the difference N. */
  private narrowSide(state: State, A: Comp, B: Comp, n: number): boolean {
    if (B.lo === B.hi) {
      const x = B.lo;
      const cands = [x - n, x + n].filter((v) => v >= 1 && v >= A.lo && v <= A.hi);
      if (cands.length === 0) return false;
      return state.narrow(A, Math.min(...cands), Math.max(...cands));
    }
    return state.narrow(A, B.lo - n, B.hi + n);
  }

  propagate(state: State): boolean {
    const g = state.grid;
    for (const [e, n] of this.marks) {
      const A = state.comp(g.edgeA[e]);
      const B = state.comp(g.edgeB[e]);
      if (A === B) return false;
      if (!this.narrowSide(state, A, B, n) || !this.narrowSide(state, B, A, n)) return false;
    }
    return true;
  }

  placementConflict(state: State, _base: Comp, cells: readonly number[], inside: Int32Array, stamp: number): boolean {
    const g = state.grid;
    const size = cells.length;
    for (const [e, n] of this.marks) {
      const a = g.edgeA[e];
      const b = g.edgeB[e];
      const ia = inside[a] === stamp;
      const ib = inside[b] === stamp;
      if (ia && ib) return true;
      if (!ia && !ib) continue;
      const other = state.comp(ia ? b : a);
      const fits = (v: number) => v >= 1 && v >= other.lo && v <= other.hi;
      if (!fits(size - n) && !fits(size + n)) return true;
    }
    return false;
  }

  check(g: Grid, labels: Labels, regions: number[][]): boolean {
    for (const [e, n] of this.marks) {
      const a = labels[g.edgeA[e]];
      const b = labels[g.edgeB[e]];
      if (a === b) return false;
      if (Math.abs(regions[a].length - regions[b].length) !== n) return false;
    }
    return true;
  }
}
