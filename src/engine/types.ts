import type { ShapeKey } from './shape.ts';

/**
 * Puzzle definition = grid size + clues. Every rule of the game is expressed
 * as a clue; a puzzle with no clues has every partition as a solution.
 *
 * Cells are `y * width + x`. Edge clues reference the two cells they sit between.
 */
export type RuleKind =
  | 'areaNumber'
  | 'range'
  | 'shapeBank'
  | 'polyomino'
  | 'gemini'
  | 'delta'
  | 'rose'
  | 'sizeSeparation'
  | 'solitude'
  | 'boxy'
  | 'nonBoxy'
  | 'inequality'
  | 'difference'
  | 'mingle'
  | 'match'
  | 'mismatch'
  | 'palisade'
  | 'bricky'
  | 'loopy'
  | 'watchtower';

export const RULE_KINDS: readonly RuleKind[] = [
  'areaNumber',
  'range',
  'shapeBank',
  'polyomino',
  'gemini',
  'delta',
  'rose',
  'sizeSeparation',
  'solitude',
  'boxy',
  'nonBoxy',
  'inequality',
  'difference',
  'mingle',
  'match',
  'mismatch',
  'palisade',
  'bricky',
  'loopy',
  'watchtower',
];

export interface EdgeRef {
  a: number;
  b: number;
}

/** Area Number: the region containing `cell` has exactly `value` cells. */
export interface AreaNumberClue {
  type: 'areaNumber';
  cell: number;
  value: number;
}

/**
 * Range / Minimum / Maximum / Precision: every region has min ≤ area ≤ max.
 * Omit `min` for Maximum, omit `max` for Minimum, min === max for Precision.
 */
export interface RangeClue {
  type: 'range';
  min?: number;
  max?: number;
}

/** Shape Bank: every region's shape (up to rotation/reflection) is in `shapes`. */
export interface ShapeBankClue {
  type: 'shapeBank';
  shapes: ShapeKey[];
}

/** Polyomino: the region containing `cell` has exactly this shape. */
export interface PolyominoClue {
  type: 'polyomino';
  cell: number;
  shape: ShapeKey;
}

/** Gemini: the edge is a border, and the regions on both sides have the same shape. */
export interface GeminiClue {
  type: 'gemini';
  edge: EdgeRef;
}

/** Delta: the edge is a border, and the regions on both sides have different shapes. */
export interface DeltaClue {
  type: 'delta';
  edge: EdgeRef;
}

/**
 * Rose Window: `symbolCount` symbol kinds (0..k-1) are placed on cells; every
 * region must contain exactly one cell of each kind. (symbolCount = 1 is a
 * one-symbol rose window, which the original also has; its "Solitude" rule is
 * the separate `solitude` clue below.)
 */
export interface RoseClue {
  type: 'rose';
  symbolCount: number;
  symbols: { cell: number; symbol: number }[];
}

/** Size Separation: regions that share a border cannot have the same area. */
export interface SizeSeparationClue {
  type: 'sizeSeparation';
}

/**
 * Solitude: every region contains exactly one symbol, counting every cell clue
 * of the puzzle (area numbers, polyomino tiles, rose symbols) as a symbol. As
 * in the original it never stands alone: the symbols come from other rules.
 */
export interface SolitudeClue {
  type: 'solitude';
}

/** Boxy: every region is a rectangle. */
export interface BoxyClue {
  type: 'boxy';
}

/** Non-Boxy: no region is a rectangle (so every region has at least three cells). */
export interface NonBoxyClue {
  type: 'nonBoxy';
}

/**
 * Inequality: the edge is a border, and the region on the `larger` side
 * (`'a'` = the region containing edge.a) has strictly more cells than the other.
 */
export interface InequalityClue {
  type: 'inequality';
  edge: EdgeRef;
  larger: 'a' | 'b';
}

/** Mingle Shape: regions that share a border have different shapes (Delta everywhere). */
export interface MingleClue {
  type: 'mingle';
}

/** Match: every region has the same shape. */
export interface MatchClue {
  type: 'match';
}

/** Mismatch: no two regions have the same shape. */
export interface MismatchClue {
  type: 'mismatch';
}

/**
 * Palisade: the four sides of `cell` are borders exactly where `sides` has a
 * bit set (N = 1, E = 2, S = 4, W = 8). A side on the board's edge or on a
 * hole is a border, so those bits are always set.
 */
export interface PalisadeClue {
  type: 'palisade';
  cell: number;
  sides: number;
}

/** Bricky: no grid vertex has borders on all four of its edges. */
export interface BrickyClue {
  type: 'bricky';
}

/**
 * Loopy: at every grid vertex an even number of its edges are borders (0, 2
 * or 4), so borders never end or branch; a border cannot reach the frame,
 * which makes every region an island inside another.
 */
export interface LoopyClue {
  type: 'loopy';
}

/**
 * Watchtower: the grid vertex at (`x`, `y`) — corner coordinates, 0..width
 * and 0..height — touches exactly `count` different regions.
 */
export interface WatchtowerClue {
  type: 'watchtower';
  x: number;
  y: number;
  count: number;
}

/** Difference: the edge is a border, and the two regions' areas differ by exactly `value` (0 = equal). */
export interface DifferenceClue {
  type: 'difference';
  edge: EdgeRef;
  value: number;
}

export type Clue =
  | AreaNumberClue
  | RangeClue
  | ShapeBankClue
  | PolyominoClue
  | GeminiClue
  | DeltaClue
  | RoseClue
  | SizeSeparationClue
  | SolitudeClue
  | BoxyClue
  | NonBoxyClue
  | InequalityClue
  | DifferenceClue
  | MingleClue
  | MatchClue
  | MismatchClue
  | PalisadeClue
  | BrickyClue
  | LoopyClue
  | WatchtowerClue;

export interface Puzzle {
  width: number;
  height: number;
  /** cells (y*width+x) that are not part of the board */
  holes?: number[];
  /** borders that are part of the board: no region may span one */
  walls?: EdgeRef[];
  clues: Clue[];
}

/** A solution: region label per cell (arbitrary small integers; -1 for holes). */
export type Labels = Int32Array;
