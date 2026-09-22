import type { Grid } from '../grid.ts';
import type { Comp, EdgeValue, State } from '../state.ts';
import type { Labels } from '../types.ts';

/**
 * A single edge deduction produced by a propagator. `technique` names the
 * human reasoning step; `tier` is its difficulty (1 = trivial, 6 = needs a
 * hypothetical). The logical solver applies the cheapest available tier
 * first, so the recorded max tier reflects what a careful human would need.
 */
export interface Deduction {
  edge: number;
  value: EdgeValue;
  technique: string;
  tier: number;
}

export interface Rule {
  readonly kind: string;

  /** Apply initial facts (bounds, forced walls). Return false on contradiction. */
  init(state: State, out: Deduction[]): boolean;

  /**
   * Push edge deductions to `out`, and/or narrow component facts in place.
   * Return false on contradiction. Must not set edges directly.
   */
  propagate(state: State, out: Deduction[]): boolean;

  /** Would joining A and B (they touch across an UNKNOWN edge) break this rule? */
  mergeConflict?(state: State, A: Comp, B: Comp): boolean;

  /**
   * Would a region consisting of exactly `cells` (a candidate final region for
   * component `base`) break this rule? A cell c is inside iff inside[c] === stamp.
   */
  placementConflict?(state: State, base: Comp, cells: readonly number[], inside: Int32Array, stamp: number): boolean;

  /** Final check of a complete partition. */
  check(grid: Grid, labels: Labels, regions: number[][]): boolean;

  /**
   * Areas any region of the puzzle may have, when the rule bounds them for
   * every region at once (Range, Shape Bank, Non-Boxy). The core propagator
   * intersects these to tell whether a pocket of cells can be filled by whole
   * regions (see `pocket-count`).
   */
  regionSizes?(): RegionSizes;
}

export interface RegionSizes {
  lo?: number;
  hi?: number;
  /** an explicit set of allowed areas (Shape Bank) */
  sizes?: number[];
}
