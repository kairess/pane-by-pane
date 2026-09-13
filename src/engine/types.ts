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
  | 'sizeSeparation';

export const RULE_KINDS: readonly RuleKind[] = [
  'areaNumber',
  'range',
  'shapeBank',
  'polyomino',
  'gemini',
  'delta',
  'rose',
  'sizeSeparation',
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
 * region must contain exactly one cell of each kind. With symbolCount = 1 this
 * is the "Solitude" rule.
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

export type Clue =
  | AreaNumberClue
  | RangeClue
  | ShapeBankClue
  | PolyominoClue
  | GeminiClue
  | DeltaClue
  | RoseClue
  | SizeSeparationClue;

export interface Puzzle {
  width: number;
  height: number;
  /** cells (y*width+x) that are not part of the board */
  holes?: number[];
  clues: Clue[];
}

/** A solution: region label per cell (arbitrary small integers; -1 for holes). */
export type Labels = Int32Array;
