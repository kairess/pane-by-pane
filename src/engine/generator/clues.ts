import type { Grid } from '../grid.ts';
import type { Rng } from '../random.ts';
import { regionKey, type ShapeKey } from '../shape.ts';
import type { Clue, Labels, RuleKind } from '../types.ts';
import { adjacentRegions, regionsOf } from './partition.ts';

/**
 * Step ②: from a solution, derive every clue that would be *true* for it.
 * Clues are grouped into removable units so the minimiser can drop them one
 * at a time. A unit may offer weaker alternatives (e.g. Range → Max only)
 * that are tried when the whole unit cannot be removed.
 */
export interface ClueUnit {
  kind: RuleKind;
  clues: Clue[];
  weaker?: Clue[][];
  /** never removed by the minimiser (a rule the puzzle was asked to feature) */
  required?: boolean;
}

export interface ClueOptions {
  rules: RuleKind[];
  /** Rose: number of symbol kinds (default 2; 1 = Solitude) */
  roseSymbols?: number;
  /**
   * Rose: only offer the rose unit when the symbols can be placed so that every
   * cell without a symbol is a bridge inside its region (see `roseSymbolCells`).
   * Used when rose is the only rule that outlines regions.
   */
  roseForced?: boolean;
  /** Shape Bank: extra shapes not used by the solution */
  bankDecoys?: ShapeKey[];
  /** Area Number: max number clues per region offered to the minimiser (default: every cell) */
  numbersPerRegion?: number;
  /** Polyomino: max polyomino clues per region (default 1) */
  polyominoesPerRegion?: number;
  /** Gemini/Delta: max marker candidates per bordering pair (default 2) */
  markersPerPair?: number;
}

export function deriveClueUnits(g: Grid, labels: Labels, rng: Rng, opt: ClueOptions): ClueUnit[] {
  const regions = regionsOf(labels);
  const keys = regions.map((r) => regionKey(g.w, r));
  const sizes = regions.map((r) => r.length);
  const pairs = adjacentRegions(g, labels);
  const units: ClueUnit[] = [];
  const has = (k: RuleKind) => opt.rules.includes(k);
  // A cell carries at most one symbol. Rose symbols are placed first (their
  // cells are constrained and the unit is never minimised away), then one
  // polyomino per region, then the numbers take what is left.
  const taken = new Set<number>();
  const someCells = (r: number, n: number) => {
    const cells = rng.shuffle(regions[r].filter((c) => !taken.has(c))).slice(0, n);
    for (const c of cells) taken.add(c);
    return cells;
  };

  if (has('rose')) {
    const k = opt.roseSymbols ?? 2;
    if (regions.every((r) => r.length >= k)) {
      const symbols: { cell: number; symbol: number }[] = [];
      let ok = true;
      for (const r of regions) {
        const cells = roseSymbolCells(g, r, k, rng, opt.roseForced ?? false);
        if (!cells) {
          ok = false;
          break;
        }
        rng.shuffle(cells).forEach((cell, symbol) => symbols.push({ cell, symbol }));
      }
      // Rose is what the puzzle is about when asked for: keep it through minimisation.
      if (ok) {
        units.push({ kind: 'rose', clues: [{ type: 'rose', symbolCount: k, symbols }], required: true });
        for (const sym of symbols) taken.add(sym.cell);
      }
    }
  }

  // Cell clues: offer several per region; the minimiser keeps only what is needed.
  if (has('polyomino')) {
    for (const r of regions.keys()) {
      for (const cell of someCells(r, opt.polyominoesPerRegion ?? 1)) {
        units.push({ kind: 'polyomino', clues: [{ type: 'polyomino', cell, shape: keys[r] }] });
      }
    }
  }

  if (has('areaNumber')) {
    for (const r of regions.keys()) {
      for (const cell of someCells(r, opt.numbersPerRegion ?? sizes[r])) {
        units.push({ kind: 'areaNumber', clues: [{ type: 'areaNumber', cell, value: sizes[r] }] });
      }
    }
  }

  if (has('range')) {
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    // A rule the puzzle was asked for stays (it may still be weakened to Maximum / Minimum).
    units.push({
      kind: 'range',
      clues: [{ type: 'range', min, max }],
      weaker: min === max ? [] : [[{ type: 'range', max }], [{ type: 'range', min }]],
      required: true,
    });
  }

  if (has('shapeBank')) {
    const shapes = [...new Set([...keys, ...(opt.bankDecoys ?? [])])];
    units.push({ kind: 'shapeBank', clues: [{ type: 'shapeBank', shapes: rng.shuffle(shapes) }] });
  }

  if (has('gemini') || has('delta')) {
    for (const [key, edges] of pairs) {
      const [a, b] = key.split('-').map(Number);
      const same = keys[a] === keys[b];
      const kind: RuleKind = same ? 'gemini' : 'delta';
      if (!has(kind)) continue;
      for (const e of rng.shuffle(edges.slice()).slice(0, opt.markersPerPair ?? 2)) {
        units.push({ kind, clues: [{ type: kind, edge: { a: g.edgeA[e], b: g.edgeB[e] } }] });
      }
    }
  }

  if (has('sizeSeparation')) {
    let ok = true;
    for (const key of pairs.keys()) {
      const [a, b] = key.split('-').map(Number);
      if (sizes[a] === sizes[b]) { ok = false; break; }
    }
    if (ok) units.push({ kind: 'sizeSeparation', clues: [{ type: 'sizeSeparation' }], required: true });
  }

  return units;
}

/**
 * Which cells of a region carry the rose symbols. A cell without a symbol can
 * move to a neighbouring region without breaking the rose rule unless removing
 * it would cut its own region in two, so the symbols go on the cells that are
 * *not* cut cells (a path's two ends, a T's three tips), and the rest are
 * bridges. When the region has more such cells than symbols this is impossible;
 * `forced` then gives up, otherwise the cells are picked at random.
 */
export function roseSymbolCells(g: Grid, region: number[], k: number, rng: Rng, forced: boolean): number[] | null {
  const inRegion = new Set(region);
  const connectedWithout = (skip: number): boolean => {
    const start = region.find((c) => c !== skip);
    if (start === undefined) return true;
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const c = stack.pop()!;
      for (const n of g.adj[c]) if (n !== skip && inRegion.has(n) && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
    return seen.size === region.length - 1;
  };
  const tips = region.length === 1 ? region.slice() : region.filter((c) => connectedWithout(c));
  if (tips.length > k) return forced ? null : rng.shuffle(region.slice()).slice(0, k);
  const rest = rng.shuffle(region.filter((c) => !tips.includes(c)));
  return [...tips, ...rest.slice(0, k - tips.length)];
}

export function flatten(units: ClueUnit[]): Clue[] {
  return units.flatMap((u) => u.clues);
}
