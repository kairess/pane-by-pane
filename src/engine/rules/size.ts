import type { Grid } from '../grid.ts';
import type { Comp, State } from '../state.ts';
import type { AreaNumberClue, Labels, RangeClue } from '../types.ts';
import type { Deduction, RegionSizes, Rule } from './rule.ts';

/** Area Number: the region containing the clue cell has exactly `value` cells. */
export class AreaNumberRule implements Rule {
  readonly kind = 'areaNumber';
  private clues: AreaNumberClue[];
  constructor(clues: AreaNumberClue[]) {
    this.clues = clues;
  }

  init(state: State): boolean {
    for (const c of this.clues) if (!state.narrow(state.comp(c.cell), c.value, c.value)) return false;
    return true;
  }

  propagate(): boolean {
    return true; // bounds do all the work via core
  }

  check(_g: Grid, labels: Labels, regions: number[][]): boolean {
    for (const c of this.clues) if (regions[labels[c.cell]].length !== c.value) return false;
    return true;
  }
}

/** Range / Minimum / Maximum / Precision: min ≤ every region's area ≤ max. */
export class RangeRule implements Rule {
  readonly kind = 'range';
  readonly min: number;
  readonly max: number;
  constructor(clues: RangeClue[], grid: Grid) {
    let min = 1;
    let max = grid.cells;
    for (const c of clues) {
      if (c.min !== undefined) min = Math.max(min, c.min);
      if (c.max !== undefined) max = Math.min(max, c.max);
    }
    this.min = min;
    this.max = max;
  }

  init(state: State): boolean {
    for (const comp of state.comps.values()) if (!state.narrow(comp, this.min, this.max)) return false;
    return true;
  }

  propagate(): boolean {
    return true;
  }

  regionSizes(): RegionSizes {
    return { lo: this.min, hi: this.max };
  }

  check(_g: Grid, _labels: Labels, regions: number[][]): boolean {
    return regions.every((r) => r.length >= this.min && r.length <= this.max);
  }
}

/**
 * Size Separation: two regions sharing a border have different areas.
 * Interval bounds cannot express "≠ n" in general, so we narrow only at the
 * ends of the interval and otherwise check at closure / placement time.
 */
export class SizeSeparationRule implements Rule {
  readonly kind = 'sizeSeparation';

  init(): boolean {
    return true;
  }

  propagate(state: State, _out: Deduction[]): boolean {
    for (const comp of state.comps.values()) {
      const exact = comp.lo === comp.hi ? comp.lo : -1;
      if (exact < 0) continue;
      for (const nb of state.wallNeighbours(comp)) {
        if (nb.lo === nb.hi && nb.lo === exact) return false;
        if (nb.lo === exact && !state.narrow(nb, exact + 1, nb.hi)) return false;
        if (nb.hi === exact && !state.narrow(nb, nb.lo, exact - 1)) return false;
      }
    }
    return true;
  }

  placementConflict(state: State, _base: Comp, cells: readonly number[], inside: Int32Array, stamp: number): boolean {
    const g = state.grid;
    const n = cells.length;
    for (const c of cells) {
      const nbs = g.adj[c];
      for (let i = 0; i < nbs.length; i++) {
        const o = nbs[i];
        if (inside[o] === stamp) continue;
        const oc = state.comp(o);
        if (oc.lo === oc.hi && oc.lo === n) return true;
      }
    }
    return false;
  }

  check(g: Grid, labels: Labels, regions: number[][]): boolean {
    for (let e = 0; e < g.edges; e++) {
      const a = labels[g.edgeA[e]];
      const b = labels[g.edgeB[e]];
      if (a !== b && regions[a].length === regions[b].length) return false;
    }
    return true;
  }
}
