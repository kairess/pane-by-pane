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
}

export interface ClueOptions {
  rules: RuleKind[];
  /** Rose: number of symbol kinds (default 2; 1 = Solitude) */
  roseSymbols?: number;
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
  const someCells = (r: number, n: number) => rng.shuffle(regions[r].slice()).slice(0, n);

  // Cell clues: offer several per region; the minimiser keeps only what is needed.
  if (has('areaNumber')) {
    for (const r of regions.keys()) {
      for (const cell of someCells(r, opt.numbersPerRegion ?? sizes[r])) {
        units.push({ kind: 'areaNumber', clues: [{ type: 'areaNumber', cell, value: sizes[r] }] });
      }
    }
  }

  if (has('polyomino')) {
    for (const r of regions.keys()) {
      for (const cell of someCells(r, opt.polyominoesPerRegion ?? 1)) {
        units.push({ kind: 'polyomino', clues: [{ type: 'polyomino', cell, shape: keys[r] }] });
      }
    }
  }

  if (has('range')) {
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    units.push({
      kind: 'range',
      clues: [{ type: 'range', min, max }],
      weaker: min === max ? [] : [[{ type: 'range', max }], [{ type: 'range', min }]],
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

  if (has('rose')) {
    const k = opt.roseSymbols ?? 2;
    if (regions.every((r) => r.length >= k)) {
      const symbols: { cell: number; symbol: number }[] = [];
      for (const r of regions) {
        const cells = rng.shuffle(r.slice()).slice(0, k);
        cells.forEach((cell, symbol) => symbols.push({ cell, symbol }));
      }
      units.push({ kind: 'rose', clues: [{ type: 'rose', symbolCount: k, symbols }] });
    }
  }

  if (has('sizeSeparation')) {
    let ok = true;
    for (const key of pairs.keys()) {
      const [a, b] = key.split('-').map(Number);
      if (sizes[a] === sizes[b]) { ok = false; break; }
    }
    if (ok) units.push({ kind: 'sizeSeparation', clues: [{ type: 'sizeSeparation' }] });
  }

  return units;
}

export function flatten(units: ClueUnit[]): Clue[] {
  return units.flatMap((u) => u.clues);
}
