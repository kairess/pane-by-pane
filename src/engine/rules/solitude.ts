import type { Grid } from '../grid.ts';
import type { Clue } from '../types.ts';
import { RoseRule } from './rose.ts';

/**
 * Solitude: every region contains exactly one symbol, where a symbol is any
 * cell clue of the puzzle (area number, polyomino tile, palisade tile, rose symbol). It is
 * the one-symbol rose rule over the clue cells: two symbols in one connected
 * area prove a border between them, and a pocket that can no longer reach a
 * symbol proves a merge outward. As in the original it never stands alone.
 */
export class SolitudeRule extends RoseRule {
  override readonly kind = 'solitude';

  constructor(clues: Clue[], grid: Grid) {
    super({ type: 'rose', symbolCount: 1, symbols: symbolCells(clues).map((cell) => ({ cell, symbol: 0 })) }, grid);
    this.wallTechnique = 'one-symbol';
  }
}

/** Cells carrying a symbol in the Solitude sense (one per cell by construction). */
export function symbolCells(clues: Clue[]): number[] {
  const out = new Set<number>();
  for (const c of clues) {
    if (c.type === 'areaNumber' || c.type === 'polyomino' || c.type === 'palisade') out.add(c.cell);
    else if (c.type === 'rose') for (const s of c.symbols) out.add(s.cell);
  }
  return [...out].sort((a, b) => a - b);
}
