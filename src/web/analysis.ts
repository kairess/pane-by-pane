import { initialState, propagate, verify, type Engine } from '../engine/engine.ts';
import { nextDeduction, TECHNIQUE_LABELS } from '../engine/logical.ts';
import { JOIN, WALL as EWALL, type State } from '../engine/state.ts';
import { WALL, type PlayerState } from './model.ts';
import { edgeBetween } from '../engine/grid.ts';
import { canonical, parseKey, regionKey, shapeSize } from '../engine/shape.ts';
import type { Puzzle } from '../engine/types.ts';

/**
 * Bridge between the player's marks and the puzzle engine: completion in
 * either notation, error attribution, and logical hints.
 */

export type Completion = { done: true; by: 'borders' | 'paint' } | { done: false; reason: 'dangling' | 'incomplete' | 'wrong' };

/** Completion, like the original game: all borders drawn, or all cells painted. */
export function checkCompletion(engine: Engine, ps: PlayerState): Completion {
  const g = ps.grid;
  // Method 1: borders. Every wall must separate two different regions.
  const byWalls = ps.labelsByWalls();
  const regions = new Set(byWalls.filter((l) => l >= 0)).size;
  let dangling = false;
  for (let e = 0; e < g.edges; e++) if (ps.edge[e] === WALL && byWalls[g.edgeA[e]] === byWalls[g.edgeB[e]]) dangling = true;
  if (!dangling && regions > 1 && verify(engine, byWalls)) return { done: true, by: 'borders' };

  // Method 2: paint. Every cell painted, no wall inside a paint region.
  const byPaint = ps.labelsByPaint();
  const allPainted = byPaint.every((l) => l !== -2);
  if (allPainted) {
    let wallInside = false;
    for (let e = 0; e < g.edges; e++) if (ps.edge[e] === WALL && byPaint[g.edgeA[e]] === byPaint[g.edgeB[e]]) wallInside = true;
    if (!wallInside && verify(engine, byPaint)) return { done: true, by: 'paint' };
    return { done: false, reason: 'wrong' };
  }
  if (dangling) return { done: false, reason: 'dangling' };
  return { done: false, reason: 'incomplete' };
}

/** Facts the player has asserted, as engine edges, in the order they were made. */
function playerFacts(ps: PlayerState): { edge: number; value: 1 | 2; stamp: number; cell?: number }[] {
  const g = ps.grid;
  const facts: { edge: number; value: 1 | 2; stamp: number; cell?: number }[] = [];
  for (let e = 0; e < g.edges; e++) if (ps.edge[e] === WALL) facts.push({ edge: e, value: EWALL, stamp: ps.stamp[g.cells + e] });
  // Paint: two adjacent cells with the same paint id are joined (the later-painted cell is blamed).
  for (let e = 0; e < g.edges; e++) {
    const a = g.edgeA[e];
    const b = g.edgeB[e];
    if (ps.paint[a] && ps.paint[a] === ps.paint[b] && ps.edge[e] !== WALL) {
      const later = ps.stamp[a] >= ps.stamp[b] ? a : b;
      facts.push({ edge: e, value: JOIN, stamp: ps.stamp[later], cell: later });
    }
  }
  return facts.sort((x, y) => x.stamp - y.stamp);
}

/** Engine state with the player's facts applied and propagated, or null if they contradict. */
export function stateFromPlayer(engine: Engine, ps: PlayerState): State | null {
  const state = initialState(engine);
  if (!state) return null;
  for (const f of playerFacts(ps)) if (!state.setEdge(f.edge, f.value)) return null;
  return propagate(engine, state) ? state : null;
}

/**
 * Explicit rule violations in the player's marks. Deliberately *not* based on
 * the solver or the solution, so it never reveals anything the player could
 * not check by hand:
 *
 *   wall regions   (cells enclosed by walls; they can only be subdivided later)
 *                  → too small for a number / range / bank / polyomino, missing rose symbol;
 *                    once no bigger than the largest bank shape, the shape must be in the bank;
 *                    a polyomino clue whose region is exactly the shape's size must match it
 *   claimed regions (cells joined by paint; they can only grow)
 *                  → too big, two different numbers, duplicate rose symbol, two polyominoes
 *   definite regions (a wall region that is exactly one claimed region)
 *                  → exact checks: number, range, bank shape, polyomino, rose set,
 *                    plus pairwise Size Separation / Gemini / Delta between definite neighbours
 *   markers        → paint across a Gemini/Delta marker
 *
 * Returns the violating cells.
 */
export function findViolations(puzzle: Puzzle, ps: PlayerState): Set<number> {
  const g = ps.grid;
  const bad = new Set<number>();
  const numbers = new Map<number, number>();
  const polys = new Map<number, string>();
  let rangeMin = 1;
  let rangeMax = Infinity;
  let bank: Set<string> | null = null;
  let bankMin = Infinity;
  let bankMax = 0;
  const markers: { edge: number; same: boolean }[] = [];
  let rose: { k: number; symbolOf: Int8Array } | null = null;
  let sizeSep = false;
  for (const c of puzzle.clues) {
    switch (c.type) {
      case 'areaNumber':
        numbers.set(c.cell, c.value);
        break;
      case 'polyomino':
        polys.set(c.cell, canonical(parseKey(c.shape)));
        break;
      case 'range':
        if (c.min !== undefined) rangeMin = Math.max(rangeMin, c.min);
        if (c.max !== undefined) rangeMax = Math.min(rangeMax, c.max);
        break;
      case 'shapeBank':
        bank = new Set(c.shapes.map((k) => canonical(parseKey(k))));
        for (const k of bank) {
          bankMin = Math.min(bankMin, shapeSize(k));
          bankMax = Math.max(bankMax, shapeSize(k));
        }
        break;
      case 'gemini':
      case 'delta':
        markers.push({ edge: edgeBetween(g, c.edge.a, c.edge.b), same: c.type === 'gemini' });
        break;
      case 'rose': {
        const symbolOf = new Int8Array(g.cells).fill(-1);
        for (const s of c.symbols) symbolOf[s.cell] = s.symbol;
        rose = { k: c.symbolCount, symbolOf };
        break;
      }
      case 'sizeSeparation':
        sizeSep = true;
        break;
    }
  }
  const minSize = Math.max(rangeMin, bank ? bankMin : 1);
  const maxSize = Math.min(rangeMax, bank ? bankMax : Infinity);

  const groups = (labels: Int32Array): number[][] => {
    const out: number[][] = [];
    for (let c = 0; c < g.cells; c++) if (labels[c] >= 0) (out[labels[c]] ??= []).push(c);
    return out.filter(Boolean);
  };
  const symbolMask = (cells: number[]): { mask: number; dup: boolean } => {
    let mask = 0;
    let dup = false;
    if (rose) for (const c of cells) {
      const s = rose.symbolOf[c];
      if (s < 0) continue;
      if (mask & (1 << s)) dup = true;
      mask |= 1 << s;
    }
    return { mask, dup };
  };
  const flag = (cells: number[]) => {
    for (const c of cells) bad.add(c);
  };

  // wall regions: can only shrink
  const byWalls = ps.labelsByWalls();
  const wallRegions = groups(byWalls);
  for (const cells of wallRegions) {
    const n = cells.length;
    let v = n < minSize;
    const key = bank || polys.size ? regionKey(g.w, cells) : '';
    if (bank && n <= bankMax && !bank.has(key)) v = true;
    for (const c of cells) {
      const num = numbers.get(c);
      if (num !== undefined && n < num) v = true;
      const pk = polys.get(c);
      if (pk !== undefined && (n < shapeSize(pk) || (n === shapeSize(pk) && key !== pk))) v = true;
    }
    if (rose && symbolMask(cells).mask !== (1 << rose.k) - 1) v = true;
    if (v) flag(cells);
  }

  // claimed regions (paint): can only grow
  const claimed = ps.components((e) => {
    if (ps.edge[e] === WALL) return false;
    const a = g.edgeA[e];
    return ps.paint[a] !== 0 && ps.paint[a] === ps.paint[g.edgeB[e]];
  });
  const claimedRegions = groups(claimed).filter((cells) => cells.length > 1 || ps.paint[cells[0]] !== 0);
  for (const cells of claimedRegions) {
    const n = cells.length;
    let v = n > maxSize;
    const nums = new Set<number>();
    const ps2 = new Set<string>();
    for (const c of cells) {
      const num = numbers.get(c);
      if (num !== undefined) {
        nums.add(num);
        if (n > num) v = true;
      }
      const pk = polys.get(c);
      if (pk !== undefined) {
        ps2.add(pk);
        if (n > shapeSize(pk)) v = true;
      }
    }
    if (nums.size > 1 || ps2.size > 1) v = true;
    if (rose && symbolMask(cells).dup) v = true;
    if (v) flag(cells);
  }

  // definite regions: a wall region whose cells are one claimed region
  const definite = new Map<number, number[]>(); // wall label -> cells
  for (const cells of wallRegions) {
    const l = claimed[cells[0]];
    if (l >= 0 && cells.every((c) => claimed[c] === l) && cells.length === claimedRegions.find((r) => claimed[r[0]] === l)?.length) definite.set(byWalls[cells[0]], cells);
  }
  const shapeOf = new Map<number, string>();
  for (const [label, cells] of definite) {
    const n = cells.length;
    const key = regionKey(g.w, cells);
    shapeOf.set(label, key);
    let v = n < rangeMin || n > rangeMax;
    if (bank && !bank.has(key)) v = true;
    for (const c of cells) {
      const num = numbers.get(c);
      if (num !== undefined && num !== n) v = true;
      const pk = polys.get(c);
      if (pk !== undefined && pk !== key) v = true;
    }
    if (rose) {
      const { mask, dup } = symbolMask(cells);
      if (dup || mask !== (1 << rose.k) - 1) v = true;
    }
    if (v) flag(cells);
  }
  // pairwise between definite neighbours
  if (sizeSep || markers.length) {
    for (let e = 0; e < g.edges; e++) {
      if (ps.edge[e] !== WALL) continue;
      const la = byWalls[g.edgeA[e]];
      const lb = byWalls[g.edgeB[e]];
      if (la === lb) continue;
      const A = definite.get(la);
      const B = definite.get(lb);
      if (!A || !B) continue;
      if (sizeSep && A.length === B.length) {
        flag(A);
        flag(B);
      }
      const m = markers.find((mk) => mk.edge === e);
      if (m && (shapeOf.get(la) === shapeOf.get(lb)) !== m.same) {
        flag(A);
        flag(B);
      }
    }
  }
  // paint across a marker
  for (const m of markers) {
    const a = g.edgeA[m.edge];
    const b = g.edgeB[m.edge];
    if (ps.paint[a] !== 0 && ps.paint[a] === ps.paint[b]) {
      bad.add(a);
      bad.add(b);
    }
  }
  return bad;
}

export interface Hint {
  edge: number;
  /** what the edge must be */
  value: 'wall' | 'join';
  technique: string;
  label: string;
  tier: number;
}

/**
 * Next logical step from the player's current marks: the cheapest deduction
 * the engine can make, or null if the marks are contradictory / nothing found.
 */
export function nextHint(engine: Engine, ps: PlayerState): Hint | null | 'error' {
  if (!stateFromPlayer(engine, ps)) return 'error';
  // Deduce relative to what the player has marked, not to everything the
  // engine could already infer — otherwise every hint would be a what-if.
  const state = initialState(engine, { propagate: false });
  if (!state) return 'error';
  for (const f of playerFacts(ps)) if (!state.setEdge(f.edge, f.value)) return 'error';
  if (state.isComplete()) return null;
  const d = nextDeduction(engine, state);
  if (!d) return null;
  return {
    edge: d.edge,
    value: d.value === EWALL ? 'wall' : 'join',
    technique: d.technique,
    label: TECHNIQUE_LABELS[d.technique] ?? d.technique,
    tier: d.tier,
  };
}
