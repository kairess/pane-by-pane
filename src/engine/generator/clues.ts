import type { Grid } from '../grid.ts';
import type { Rng } from '../random.ts';
import { isRectangleKey, regionKey, type ShapeKey } from '../shape.ts';
import type { Clue, Labels, RuleKind } from '../types.ts';
import { neighbourInDirection, vertexCells } from '../grid.ts';
import { adjacentRegions, hasCross, regionsOf } from './partition.ts';

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
  /** Rose: number of symbol kinds (default 2; 1 = a one-symbol rose window) */
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
  /** Palisade: max tile candidates per region (default: every cell) */
  palisadesPerRegion?: number;
  /** Watchtower: max vertex candidates per region (default 2) */
  towersPerRegion?: number;
}

/** The Palisade tile of a cell in a solution: which of its sides are borders (N=1, E=2, S=4, W=8). */
export function palisadeSides(g: Grid, labels: Labels, cell: number): number {
  let sides = 0;
  for (let dir = 0; dir < 4; dir++) {
    const n = neighbourInDirection(g, cell, dir);
    if (n < 0 || labels[n] !== labels[cell]) sides |= 1 << dir;
  }
  return sides;
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

  // Solitude: every region holds exactly one symbol, so each region gets one
  // cell clue (a number or a polyomino tile, whichever rules are on) and no
  // other; none of them can be minimised away. Rose is not combined with it.
  if (has('solitude')) {
    const kinds: RuleKind[] = [];
    if (has('areaNumber')) kinds.push('areaNumber');
    if (has('polyomino')) kinds.push('polyomino');
    if (has('palisade')) kinds.push('palisade');
    if (kinds.length && !has('rose')) {
      for (const r of regions.keys()) {
        const [cell] = someCells(r, 1);
        const kind = rng.pick(kinds);
        const clue: Clue = kind === 'areaNumber' ? { type: 'areaNumber', cell, value: sizes[r] } : kind === 'polyomino' ? { type: 'polyomino', cell, shape: keys[r] } : { type: 'palisade', cell, sides: palisadeSides(g, labels, cell) };
        units.push({ kind, clues: [clue], required: true });
      }
      units.push({ kind: 'solitude', clues: [{ type: 'solitude' }], required: true });
    }
    return finish(units);
  }

  // Cell clues: offer several per region; the minimiser keeps only what is needed.
  if (has('polyomino')) {
    for (const r of regions.keys()) {
      for (const cell of someCells(r, opt.polyominoesPerRegion ?? 1)) {
        units.push({ kind: 'polyomino', clues: [{ type: 'polyomino', cell, shape: keys[r] }] });
      }
    }
  }

  if (has('palisade')) {
    for (const r of regions.keys()) {
      for (const cell of someCells(r, opt.palisadesPerRegion ?? sizes[r])) {
        units.push({ kind: 'palisade', clues: [{ type: 'palisade', cell, sides: palisadeSides(g, labels, cell) }] });
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

  return finish(units);

  /** Units that do not depend on the cell clues: global rules and area markers. */
  function finish(units: ClueUnit[]): ClueUnit[] {
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

    // Area markers on borders: which side is larger, or by how much the areas differ.
    if (has('inequality') || has('difference')) {
      for (const [key, edges] of pairs) {
        const [a, b] = key.split('-').map(Number);
        for (const e of rng.shuffle(edges.slice()).slice(0, opt.markersPerPair ?? 2)) {
          const edge = { a: g.edgeA[e], b: g.edgeB[e] };
          const sa = sizes[labels[edge.a]];
          const sb = sizes[labels[edge.b]];
          if (has('inequality') && sa !== sb) units.push({ kind: 'inequality', clues: [{ type: 'inequality', edge, larger: sa > sb ? 'a' : 'b' }] });
          if (has('difference')) units.push({ kind: 'difference', clues: [{ type: 'difference', edge, value: Math.abs(sa - sb) }] });
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

    if (has('mingle')) {
      let ok = true;
      for (const key of pairs.keys()) {
        const [a, b] = key.split('-').map(Number);
        if (keys[a] === keys[b]) { ok = false; break; }
      }
      if (ok) units.push({ kind: 'mingle', clues: [{ type: 'mingle' }], required: true });
    }

    if (has('match') && keys.every((k) => k === keys[0])) units.push({ kind: 'match', clues: [{ type: 'match' }], required: true });
    if (has('mismatch') && new Set(keys).size === keys.length) units.push({ kind: 'mismatch', clues: [{ type: 'mismatch' }], required: true });
    if (has('bricky') && !hasCross(g, labels)) units.push({ kind: 'bricky', clues: [{ type: 'bricky' }], required: true });
    if (has('loopy') && isLoopy(g, labels)) units.push({ kind: 'loopy', clues: [{ type: 'loopy' }], required: true });

    // Watchtowers: vertices on a region's boundary, a couple per region, with the number of regions they touch.
    if (has('watchtower')) {
      const perRegion = opt.towersPerRegion ?? 2;
      const used = new Set<string>();
      for (const r of regions.keys()) {
        const verts: [number, number, number][] = [];
        for (const c of regions[r]) {
          const cx = c % g.w;
          const cy = (c - cx) / g.w;
          for (const [vx, vy] of [[cx, cy], [cx + 1, cy], [cx, cy + 1], [cx + 1, cy + 1]]) {
            if (used.has(`${vx},${vy}`)) continue;
            const around = vertexCells(g, vx, vy).filter((x) => x >= 0);
            if (around.length < 2) continue;
            const count = new Set(around.map((x) => labels[x])).size;
            if (count < 2) continue;
            verts.push([vx, vy, count]);
          }
        }
        for (const [vx, vy, count] of rng.shuffle(verts).slice(0, perRegion)) {
          if (used.has(`${vx},${vy}`)) continue;
          used.add(`${vx},${vy}`);
          units.push({ kind: 'watchtower', clues: [{ type: 'watchtower', x: vx, y: vy, count }] });
        }
      }
    }

    if (has('boxy') && keys.every(isRectangleKey)) units.push({ kind: 'boxy', clues: [{ type: 'boxy' }], required: true });
    if (has('nonBoxy') && !keys.some(isRectangleKey)) units.push({ kind: 'nonBoxy', clues: [{ type: 'nonBoxy' }], required: true });

    return units;
  }
}

/**
 * Which cells of a region carry the rose symbols.
 *
 * `forced` (rose outlines the regions by itself): a cell without a symbol can
 * move to a neighbouring region without breaking the rose rule unless removing
 * it would cut its own region in two, so the symbols go on the cells that are
 * *not* cut cells (a path's two ends, a T's three tips), and the rest are
 * bridges. When the region has more such cells than symbols this is
 * impossible and null is returned.
 *
 * Otherwise another rule outlines the regions and the symbol cells are the
 * ones *without* a number (one symbol per cell). A symbol cell on a border can
 * trade places with the like symbol across it without changing any number, so
 * the symbols go to the innermost cells (fewest neighbours in other regions)
 * and the numbers keep the borders. Measured on plain 7x7-9x9 boards with two
 * symbols this makes the full clue set unique several times as often as
 * placing them on the tips.
 */
export function roseSymbolCells(g: Grid, region: number[], k: number, rng: Rng, forced: boolean): number[] | null {
  const inRegion = new Set(region);
  if (!forced) {
    const foreign = (c: number) => g.adj[c].filter((n) => !inRegion.has(n)).length;
    return rng.shuffle(region.slice()).sort((a, b) => foreign(a) - foreign(b)).slice(0, k);
  }
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
  if (tips.length > k) return null;
  const rest = rng.shuffle(region.filter((c) => !tips.includes(c)));
  return [...tips, ...rest.slice(0, k - tips.length)];
}

export function flatten(units: ClueUnit[]): Clue[] {
  return units.flatMap((u) => u.clues);
}

/** Loopy holds for a partition when every vertex has an even number of borders. */
export function isLoopy(g: Grid, labels: Labels): boolean {
  for (let y = 0; y <= g.h; y++) {
    for (let x = 0; x <= g.w; x++) {
      const [nw, ne, sw, se] = vertexCells(g, x, y);
      let walls = 0;
      const wall = (a: number, b: number) => a >= 0 && b >= 0 && labels[a] !== labels[b];
      if (wall(nw, ne)) walls++;
      if (wall(sw, se)) walls++;
      if (wall(nw, sw)) walls++;
      if (wall(ne, se)) walls++;
      if (walls % 2 === 1) return false;
    }
  }
  return true;
}
