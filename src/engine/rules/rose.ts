import type { Grid } from '../grid.ts';
import { otherCell } from '../grid.ts';
import { WALL, type Comp, type State } from '../state.ts';
import type { Labels, RoseClue } from '../types.ts';
import type { Deduction, Rule } from './rule.ts';

/**
 * Rose Window: every region contains exactly one cell of each symbol kind.
 * (symbolCount = 1 is the Solitude rule.)
 */
export class RoseRule implements Rule {
  readonly kind = 'rose';
  readonly k: number;
  /** symbol kind per cell, -1 if none */
  readonly symbolOf: Int8Array;

  constructor(clue: RoseClue, grid: Grid) {
    this.k = clue.symbolCount;
    this.symbolOf = new Int8Array(grid.cells).fill(-1);
    for (const s of clue.symbols) {
      if (s.symbol < 0 || s.symbol >= this.k) throw new Error('rose symbol out of range');
      this.symbolOf[s.cell] = s.symbol;
    }
  }

  /** Bitmask of symbols held by a component. Returns -1 if a symbol repeats. */
  private held(c: Comp): number {
    let mask = 0;
    for (const cell of c.cells) {
      const s = this.symbolOf[cell];
      if (s < 0) continue;
      if (mask & (1 << s)) return -1;
      mask |= 1 << s;
    }
    return mask;
  }

  init(state: State, out: Deduction[]): boolean {
    const g = state.grid;
    for (const comp of state.comps.values()) if (!state.narrow(comp, this.k, comp.hi)) return false;
    for (let e = 0; e < g.edges; e++) {
      const a = this.symbolOf[g.edgeA[e]];
      if (a >= 0 && a === this.symbolOf[g.edgeB[e]]) out.push({ edge: e, value: WALL, technique: 'same-symbol', tier: 1 });
    }
    return true;
  }

  mergeConflict(_state: State, A: Comp, B: Comp): boolean {
    const a = this.held(A);
    const b = this.held(B);
    return a < 0 || b < 0 || (a & b) !== 0;
  }

  propagate(state: State, _out: Deduction[]): boolean {
    const full = (1 << this.k) - 1;
    for (const comp of state.comps.values()) {
      const have = this.held(comp);
      if (have < 0) return false;
      if (have === full) continue;
      if (state.isClosed(comp)) return false;
      // Each missing symbol must be reachable without crossing walls or
      // passing through a component that already holds a symbol we hold.
      const need = full & ~have;
      if (!this.canReach(state, comp, have, need)) return false;
    }
    return true;
  }

  private canReach(state: State, comp: Comp, have: number, need: number): boolean {
    const g = state.grid;
    const seen = new Set<number>([comp.id]);
    const stack = comp.cells.slice();
    let found = 0;
    while (stack.length) {
      const c = stack.pop()!;
      const es = g.adjEdge[c];
      for (let i = 0; i < es.length; i++) {
        const e = es[i];
        if (state.edge[e] === WALL) continue;
        const n = otherCell(g, e, c);
        const oc = state.comp(n);
        if (seen.has(oc.id)) continue;
        seen.add(oc.id);
        const h = this.held(oc);
        if (h < 0 || (h & have) !== 0) continue;
        if (state.mergeConflict(comp, oc)) continue;
        found |= h;
        if ((found & need) === need) return true;
        for (const cc of oc.cells) stack.push(cc);
      }
    }
    return (found & need) === need;
  }

  placementConflict(_state: State, _base: Comp, cells: readonly number[]): boolean {
    let mask = 0;
    for (const c of cells) {
      const s = this.symbolOf[c];
      if (s < 0) continue;
      if (mask & (1 << s)) return true;
      mask |= 1 << s;
    }
    return mask !== (1 << this.k) - 1;
  }

  check(_g: Grid, _labels: Labels, regions: number[][]): boolean {
    const full = (1 << this.k) - 1;
    for (const r of regions) {
      let mask = 0;
      for (const c of r) {
        const s = this.symbolOf[c];
        if (s < 0) continue;
        if (mask & (1 << s)) return false;
        mask |= 1 << s;
      }
      if (mask !== full) return false;
    }
    return true;
  }
}
