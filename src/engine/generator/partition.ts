import { activeCells, makeGrid, type Grid } from '../grid.ts';
import type { Rng } from '../random.ts';
import { canonical, keyOrientations, regionKey, type Pt, type ShapeKey } from '../shape.ts';
import { BANK_CATALOG, BANK_SIZE_WEIGHTS } from './bankCatalog.ts';
import type { Labels } from '../types.ts';

/**
 * Solution-first generation step ①: produce a random partition of the grid
 * into connected regions. Two strategies:
 *
 *   growPartition   regions of random size in [min,max], grown cell by cell
 *   tilePartition   regions drawn from a fixed shape bank (backtracking tiler)
 */
export interface PartitionOptions {
  minSize: number;
  maxSize: number;
  /** reject partitions where two bordering regions have equal area */
  sizeSeparation?: boolean;
  /** reject partitions where two bordering regions have the same shape (Mingle) */
  distinctNeighbours?: boolean;
  /**
   * Rose-only puzzles: a region may have at most this many tips (cells whose
   * removal leaves it connected), one per symbol. Regions that come out with
   * more are regrown from their seed a few times before the partition is
   * rejected.
   */
  maxTips?: number;
}

/** Cells of a region whose removal leaves it connected (a path's ends, a T's three tips). */
export function tipCount(g: Grid, region: readonly number[]): number {
  if (region.length <= 2) return region.length;
  const inRegion = new Set(region);
  let tips = 0;
  for (const skip of region) {
    const start = region.find((c) => c !== skip)!;
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const c = stack.pop()!;
      for (const n of g.adj[c]) if (n !== skip && inRegion.has(n) && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
    if (seen.size === region.length - 1) tips++;
  }
  return tips;
}

export function growPartition(g: Grid, rng: Rng, opt: PartitionOptions, attempts = 200): Labels | null {
  for (let a = 0; a < attempts; a++) {
    const labels = growOnce(g, rng, opt);
    if (labels && acceptable(g, labels, opt)) return labels;
  }
  return null;
}

function growOnce(g: Grid, rng: Rng, opt: PartitionOptions): Labels | null {
  const labels = new Int32Array(g.cells).fill(-1);
  const sizes: number[] = [];
  const order = rng.shuffle(activeCells(g));
  for (const seed of order) {
    if (labels[seed] >= 0) continue;
    const id = sizes.length;
    let target = rng.range(opt.minSize, opt.maxSize);
    if (opt.sizeSeparation) {
      // Size separation: pick a size the finished regions around the seed do
      // not have, so that far fewer partitions are thrown away afterwards.
      const taken = new Set<number>();
      for (const n of g.adj[seed]) if (labels[n] >= 0) taken.add(sizes[labels[n]]);
      const options: number[] = [];
      for (let n = opt.minSize; n <= opt.maxSize; n++) if (!taken.has(n)) options.push(n);
      if (options.length) target = rng.pick(options);
    }
    let cells = [seed];
    for (let regrow = 0; ; regrow++) {
      cells = [seed];
      labels[seed] = id;
      while (cells.length < target) {
        const frontier: number[] = [];
        for (const c of cells) for (const n of g.adj[c]) if (labels[n] < 0) frontier.push(n);
        if (frontier.length === 0) break;
        const pick = rng.pick(frontier);
        labels[pick] = id;
        cells.push(pick);
      }
      if (opt.maxTips === undefined || regrow >= 6 || tipCount(g, cells) <= opt.maxTips) break;
      for (const c of cells) labels[c] = -1;
    }
    sizes.push(cells.length);
  }
  // Regions that came out too small: merge into a bordering region if that
  // keeps it within maxSize; otherwise fail.
  for (let id = 0; id < sizes.length; id++) {
    if (sizes[id] >= opt.minSize) continue;
    const cells: number[] = [];
    for (let c = 0; c < g.cells; c++) if (labels[c] === id) cells.push(c);
    const candidates = new Set<number>();
    for (const c of cells) for (const n of g.adj[c]) if (labels[n] !== id) candidates.add(labels[n]);
    const ok = [...candidates].filter((o) => sizes[o] + sizes[id] <= opt.maxSize);
    if (ok.length === 0) return null;
    const into = rng.pick(ok);
    for (const c of cells) labels[c] = into;
    sizes[into] += sizes[id];
    sizes[id] = 0;
  }
  return relabel(labels);
}

/** Renumber labels 0..k-1 in order of first appearance (-1 stays -1). */
export function relabel(labels: Labels): Labels {
  const map = new Map<number, number>();
  const out = new Int32Array(labels.length);
  for (let c = 0; c < labels.length; c++) {
    if (labels[c] < 0) {
      out[c] = -1;
      continue;
    }
    let l = map.get(labels[c]);
    if (l === undefined) {
      l = map.size;
      map.set(labels[c], l);
    }
    out[c] = l;
  }
  return out;
}

/** Regions as cell lists, indexed by label (labels must be dense 0..k-1; use relabel). */
export function regionsOf(labels: Labels): number[][] {
  const out: number[][] = [];
  for (let c = 0; c < labels.length; c++) if (labels[c] >= 0) (out[labels[c]] ??= []).push(c);
  for (let i = 0; i < out.length; i++) out[i] ??= [];
  return out;
}

/** Pairs of region ids that share at least one border edge. */
export function adjacentRegions(g: Grid, labels: Labels): Map<string, number[]> {
  const pairs = new Map<string, number[]>();
  for (let e = 0; e < g.edges; e++) {
    const a = labels[g.edgeA[e]];
    const b = labels[g.edgeB[e]];
    if (a === b) continue;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    (pairs.get(key) ?? pairs.set(key, []).get(key)!).push(e);
  }
  return pairs;
}

function acceptable(g: Grid, labels: Labels, opt: PartitionOptions): boolean {
  const regions = regionsOf(labels);
  if (regions.some((r) => r.length < opt.minSize || r.length > opt.maxSize)) return false;
  if (opt.maxTips !== undefined && regions.some((r) => tipCount(g, r) > opt.maxTips!)) return false;
  if (opt.sizeSeparation || opt.distinctNeighbours) {
    const keys = regions.map((r) => regionKey(g.w, r));
    for (const key of adjacentRegions(g, labels).keys()) {
      const [a, b] = key.split('-').map(Number);
      if (opt.sizeSeparation && regions[a].length === regions[b].length) return false;
      if (opt.distinctNeighbours && keys[a] === keys[b]) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Twin pairs for hard marker-only puzzles.

export interface PairPartitionOptions {
  /** number of congruent pairs to place (all of them, unless `minPairs` allows fewer on a crowded board) */
  pairs: number;
  minPairs?: number;
  /** cell count of the paired shapes */
  sizeLo: number;
  sizeHi: number;
  /** cell count of the regions filling the rest of the board */
  restLo: number;
  restHi: number;
}

/**
 * A partition built around pairs of congruent regions that border each other,
 * with the rest of the board cut into small regions. Made for twin/unlike
 * marker puzzles asked for high stars: a random partition of 1-3-cell regions
 * pins its solution easily but tops out around 5★, since every what-if is
 * settled within a couple of cells. Two bordering copies of a 3-4-cell shape
 * under a twin marker make the solver work out both shapes together, and
 * several such pairs give the deep what-ifs a 6-7★ rating needs more often
 * (200 attempts, twelve seeds on 6x6: 3 hits with four pairs against 1 with
 * random small regions, in half the time; 8x8, six seeds: 4 against 2, in a
 * quarter of the time). Most 6x6 requests still come back as 5★ misses.
 */
export function pairPartition(g: Grid, rng: Rng, opt: PairPartitionOptions, attempts = 60): Labels | null {
  const minPairs = Math.max(1, Math.min(opt.pairs, opt.minPairs ?? opt.pairs));
  for (let attempt = 0; attempt < attempts; attempt++) {
    const labels = new Int32Array(g.cells).fill(-1);
    const free = g.active.slice();
    let id = 0;
    let placed = 0;
    for (let p = 0; p < opt.pairs; p++) {
      const orients = keyOrientations(randomShape(rng.range(opt.sizeLo, opt.sizeHi), rng));
      const a = placeShape(g, free, rng.pick(orients), rng, null);
      if (!a) continue;
      for (const c of a) free[c] = 0;
      const b = placeShape(g, free, rng.pick(orients), rng, a);
      if (!b) {
        for (const c of a) free[c] = 1;
        continue;
      }
      for (const c of b) free[c] = 0;
      for (const c of a) labels[c] = id;
      for (const c of b) labels[c] = id + 1;
      id += 2;
      placed++;
    }
    if (placed < minPairs) continue;
    const holes: number[] = [];
    for (let c = 0; c < g.cells; c++) if (!free[c]) holes.push(c);
    if (holes.length === g.cells) return relabel(labels);
    const rest = growPartition(makeGrid(g.w, g.h, holes), rng, { minSize: opt.restLo, maxSize: opt.restHi }, 50);
    if (!rest) continue;
    for (let c = 0; c < g.cells; c++) if (rest[c] >= 0) labels[c] = id + rest[c];
    return relabel(labels);
  }
  return null;
}

/** Random placement of an oriented shape on free cells; with `touching`, it must border one of those cells. */
function placeShape(g: Grid, free: Uint8Array, shape: readonly Pt[], rng: Rng, touching: readonly number[] | null, tries = 400): number[] | null {
  const touch = touching ? new Set(touching) : null;
  for (let t = 0; t < tries; t++) {
    const x0 = rng.int(g.w);
    const y0 = rng.int(g.h);
    const cells: number[] = [];
    for (const [dx, dy] of shape) {
      const x = x0 + dx;
      const y = y0 + dy;
      if (x < 0 || x >= g.w || y < 0 || y >= g.h || !free[y * g.w + x]) break;
      cells.push(y * g.w + x);
    }
    if (cells.length !== shape.length) continue;
    if (touch && !cells.some((c) => g.adj[c].some((n) => touch.has(n)))) continue;
    return cells;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tiling with a shape bank.

/** Random free polyomino of a given size, by growth. */
export function randomShape(size: number, rng: Rng): ShapeKey {
  const pts: Pt[] = [[0, 0]];
  const has = new Set(['0,0']);
  while (pts.length < size) {
    const [x, y] = rng.pick(pts);
    const [dx, dy] = rng.pick([
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const);
    const k = `${x + dx},${y + dy}`;
    if (has.has(k)) continue;
    has.add(k);
    pts.push([x + dx, y + dy]);
  }
  return canonical(pts);
}

export interface BankOptions {
  /** number of shapes; default: drawn from the original game's distribution (1–3) */
  count?: number;
  /** optional size filter; default: the whole catalogue (1..17 cells) */
  minSize?: number;
  maxSize?: number;
  /** shapes to exclude (e.g. when drawing decoys) */
  exclude?: readonly ShapeKey[];
}

/**
 * A bank drawn from the catalogue of shapes the original game uses, weighted
 * by how often each appears there. Falls back to random shapes if the
 * catalogue has too few shapes in the size range.
 */
export function catalogBank(rng: Rng, opt: BankOptions): ShapeKey[] {
  // Single-shape banks in the original are mostly tutorial boards, and they
  // pin a unique tiling only on a few board outlines (so the same puzzle keeps
  // coming back); weight them down.
  const count = opt.count ?? weightedPick(rng, BANK_SIZE_WEIGHTS.filter(([n]) => n <= 3).map(([n, w]) => [n, n === 1 ? Math.round(w / 4) : w] as const));
  const lo = opt.minSize ?? 1;
  const hi = opt.maxSize ?? Infinity;
  const pool = BANK_CATALOG.filter((s) => s.size >= lo && s.size <= hi && !opt.exclude?.includes(s.key));
  const out: ShapeKey[] = [];
  while (out.length < count && pool.length) {
    const total = pool.reduce((a, s) => a + s.weight, 0);
    let r = rng.next() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= pool[i].weight;
      if (r < 0) break;
    }
    out.push(pool[i].key);
    pool.splice(i, 1);
  }
  if (out.length < count) for (const k of randomBank(count - out.length, lo, Math.min(hi, 6), rng)) if (!out.includes(k)) out.push(k);
  return out;
}

function weightedPick(rng: Rng, entries: readonly (readonly [number, number])[]): number {
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = rng.next() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r < 0) return v;
  }
  return entries[entries.length - 1][0];
}

/** A bank of `count` distinct random (grown) shapes with sizes in [min,max]. */
export function randomBank(count: number, minSize: number, maxSize: number, rng: Rng): ShapeKey[] {
  const out = new Set<ShapeKey>();
  let guard = 0;
  while (out.size < count && guard++ < 1000) out.add(randomShape(rng.range(minSize, maxSize), rng));
  return [...out];
}

/**
 * Tile the grid using only shapes from the bank (each may be reused). Fills the
 * first empty cell in scan order with a random viable placement, backtracking.
 */
export function tilePartition(g: Grid, bank: ShapeKey[], rng: Rng, opt: Partial<PartitionOptions> = {}, nodeLimit = 20000): Labels | null {
  const labels = new Int32Array(g.cells).fill(-1);
  for (let c = 0; c < g.cells; c++) if (!g.active[c]) labels[c] = -2; // hole: never fillable
  // Placements anchored so that the shape's first (scan-order) cell is the anchor.
  const options: number[][][] = [];
  for (const key of bank) {
    for (const orient of keyOrientations(key)) {
      const [ox, oy] = orient[0];
      options.push(orient.map(([x, y]) => [x - ox, y - oy]));
    }
  }
  let nodes = 0;
  let nextId = 0;
  const sizeOf: number[] = [];
  const rec = (): boolean => {
    if (++nodes > nodeLimit) return false;
    let first = -1;
    for (let c = 0; c < g.cells; c++) if (labels[c] === -1) { first = c; break; }
    if (first < 0) return true;
    const fx = first % g.w;
    const fy = Math.floor(first / g.w);
    const order = rng.shuffle(options.slice());
    for (const o of order) {
      const cells: number[] = [];
      let ok = true;
      for (const [dx, dy] of o) {
        const x = fx + dx;
        const y = fy + dy;
        if (x < 0 || x >= g.w || y < 0 || y >= g.h) { ok = false; break; }
        const c = y * g.w + x;
        if (labels[c] !== -1) { ok = false; break; }
        cells.push(c);
      }
      if (!ok) continue;
      // size separation: a placed neighbour of the same size would doom this branch
      if (opt.sizeSeparation) {
        for (const c of cells) {
          for (const n of g.adj[c]) {
            const l = labels[n];
            if (l >= 0 && sizeOf[l] === cells.length) { ok = false; break; }
          }
          if (!ok) break;
        }
        if (!ok) continue;
      }
      const id = nextId++;
      sizeOf[id] = cells.length;
      for (const c of cells) labels[c] = id;
      if (rec()) return true;
      for (const c of cells) labels[c] = -1;
      nextId--;
      if (nodes > nodeLimit) return false;
    }
    return false;
  };
  if (!rec()) return null;
  for (let c = 0; c < g.cells; c++) if (labels[c] === -2) labels[c] = -1;
  const out = relabel(labels);
  const full: PartitionOptions = { minSize: 1, maxSize: g.cells, ...opt };
  return acceptable(g, out, full) ? out : null;
}
