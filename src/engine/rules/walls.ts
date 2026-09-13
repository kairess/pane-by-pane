import { edgeBetween, type Grid } from '../grid.ts';
import { WALL, type State } from '../state.ts';
import type { EdgeRef, Labels } from '../types.ts';
import type { Deduction, Rule } from './rule.ts';

/**
 * Fixed walls: borders that are part of the board itself (the leading of the
 * window in the original game). A region can never span one. They are not a
 * clue the generator minimises; they belong to the board like holes do.
 */
export class FixedWallsRule implements Rule {
  readonly kind = 'walls';
  readonly edges: number[];

  constructor(walls: EdgeRef[], grid: Grid) {
    this.edges = walls.map((w) => {
      const e = edgeBetween(grid, w.a, w.b);
      if (e < 0) throw new Error(`fixed wall between non-adjacent cells ${w.a},${w.b}`);
      return e;
    });
  }

  init(_state: State, out: Deduction[]): boolean {
    for (const e of this.edges) out.push({ edge: e, value: WALL, technique: 'fixed-wall', tier: 1 });
    return true;
  }

  propagate(): boolean {
    return true;
  }

  check(g: Grid, labels: Labels): boolean {
    for (const e of this.edges) if (labels[g.edgeA[e]] === labels[g.edgeB[e]]) return false;
    return true;
  }
}
