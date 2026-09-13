import { createEngine } from '../engine.ts';
import { makeGrid, type Grid } from '../grid.ts';
import { solveLogically, type LogicalResult } from '../logical.ts';
import { Rng } from '../random.ts';
import type { ShapeKey } from '../shape.ts';
import { solve } from '../solver.ts';
import type { Clue, Labels, Puzzle, RuleKind } from '../types.ts';
import { deriveClueUnits, flatten, type ClueUnit } from './clues.ts';
import { isNice, randomMask, type Symmetry } from './mask.ts';
import { catalogBank, growPartition, relabel, tilePartition } from './partition.ts';

/**
 * Solution-first pipeline (docs/IDEA.md §3):
 *
 *   ① random partition               (partition.ts)
 *   ② derive all true clues          (clues.ts)
 *   ③ full clue set must be unique   (solver.ts) – otherwise new solution
 *   ④⑤⑥ remove clues one at a time while the puzzle stays *acceptable*
 *   ⑦ logical solver → difficulty    (logical.ts)
 *   ⑧ retry until target difficulty
 *
 * "Acceptable" is the key choice. Minimising for uniqueness alone yields
 * expert puzzles (every clue is load-bearing), so by default a clue may only
 * be removed while the human-style solver still finishes within the target
 * star range. Because that solver only makes sound deductions, finishing is
 * itself a uniqueness proof — no separate search is needed.
 */
export interface GenerateOptions {
  width: number;
  height: number;
  rules: RuleKind[];
  seed?: number;
  /** region area bounds for the random partition (default 3..6). Ignored with Shape Bank: regions are the bank's shapes. */
  minSize?: number;
  maxSize?: number;
  /** Shape Bank: number of shapes in the bank (default: original game's 1–3 distribution) */
  bankSize?: number;
  /** Shape Bank: restrict catalogue shapes to this cell-count range (default: whole catalogue) */
  bankShapeSizes?: [number, number];
  /** Shape Bank: number of decoy shapes added to the bank */
  bankDecoys?: number;
  /** Rose: symbol kinds (1 = Solitude) */
  roseSymbols?: number;
  /** board shape: 'rect' (default) or 'symmetric' (holes: mirror-symmetric base + a few asymmetric tweaks) */
  mask?: 'rect' | 'symmetric';
  /** fraction of cells removed when mask is 'symmetric' (default: random 0.08..0.22) */
  holeRatio?: number;
  /** symmetry of the base mask (default random) */
  symmetry?: Symmetry;
  /** number of asymmetric tweaks (cells punched or restored) after the symmetric base (default random 0..3) */
  asymmetry?: number;
  /**
   * Shape Bank on an irregular board: when the bank alone does not pin the
   * tiling, remove whole regions of the solution from the board (they become
   * holes) until it does. Max removals per attempt (default 4, 0 = off).
   */
  repairs?: number;
  /** Area Number: max number candidates per region (default: every cell) */
  numbersPerRegion?: number;
  /** Polyomino: max candidates per region (default 1) */
  polyominoesPerRegion?: number;
  /** Gemini/Delta: max marker candidates per bordering pair (default 2) */
  markersPerPair?: number;
  /** star rating range to accept (1..7) */
  stars?: [number, number];
  /**
   * Require the puzzle to be solvable by the human-style solver (default
   * true). With false, clues are minimised for uniqueness only and the
   * puzzle may need deeper guessing.
   */
  requireLogical?: boolean;
  /** solutions to try (default 200) */
  attempts?: number;
  /** keep redundant clues with this probability (0 = fully minimal, default 0) */
  keepRedundant?: number;
  /** reject puzzles with more clues than this (default: half the cell count) */
  maxClues?: number;
  /** diagnostics: called once per attempt with the reason it was rejected (or 'ok') */
  onAttempt?: (info: AttemptInfo) => void;
}

export interface AttemptInfo {
  attempt: number;
  reason: 'no-partition' | 'no-clues' | 'not-unique' | 'not-logical' | 'too-many-clues' | 'stars' | 'ok';
  stars?: number;
  clues?: number;
  /** regions removed from the board to make the tiling unique */
  repairs?: number;
  ms: number;
}

export interface GeneratedPuzzle {
  puzzle: Puzzle;
  solution: Labels;
  analysis: LogicalResult;
  seed: number;
  attempts: number;
}

/** Search budget for uniqueness checks inside the generator. A puzzle whose
 *  uniqueness cannot be settled quickly is treated as not unique. */
const GEN_NODE_LIMIT = 30_000;

export function generate(opt: GenerateOptions): GeneratedPuzzle | null {
  const seed = opt.seed ?? Math.floor(Math.random() * 0xffffffff);
  const rng = new Rng(seed);
  const rect = makeGrid(opt.width, opt.height);
  const minSize = opt.minSize ?? 3;
  const maxSize = opt.maxSize ?? 6;
  const attempts = opt.attempts ?? 200;
  const requireLogical = opt.requireLogical ?? true;
  const [starLo, starHi] = opt.stars ?? [1, 7];
  const useBank = opt.rules.includes('shapeBank');
  const sizeSep = opt.rules.includes('sizeSeparation');
  let g = rect;
  const maxClues = () => opt.maxClues ?? Math.ceil(g.activeCount / 2);
  const mkPuzzle = (clues: Clue[]): Puzzle => (g.holes.length ? { width: g.w, height: g.h, holes: [...g.holes], clues } : { width: g.w, height: g.h, clues });

  /** The oracle: is this clue set an acceptable puzzle? Returns its analysis. */
  const accept = (clues: Clue[]): LogicalResult | null => {
    const puzzle = mkPuzzle(clues);
    if (!requireLogical && !isUniqueFast(puzzle)) return null;
    const a = solveLogically(puzzle);
    if (requireLogical && !a.solved) return null;
    return a.stars <= starHi ? a : null;
  };

  let best: GeneratedPuzzle | null = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const t0 = Date.now();
    let repairs = 0;
    const report = (reason: AttemptInfo['reason'], stars?: number, clues?: number) =>
      opt.onAttempt?.({ attempt, reason, stars, clues, repairs, ms: Date.now() - t0 });

    // ① board + solution
    g = opt.mask === 'symmetric' ? makeGrid(rect.w, rect.h, randomMask(rect.w, rect.h, rng, { ratio: opt.holeRatio, symmetry: opt.symmetry, asymmetry: opt.asymmetry })) : rect;
    let solution: Labels | null;
    let decoys: ShapeKey[] = [];
    if (useBank) {
      const sizes = { minSize: opt.bankShapeSizes?.[0], maxSize: opt.bankShapeSizes?.[1] };
      const bank = catalogBank(rng, { count: opt.bankSize, ...sizes });
      solution = tilePartition(g, bank, rng, { sizeSeparation: sizeSep });
      if (opt.bankDecoys) decoys = catalogBank(rng, { count: opt.bankDecoys, ...sizes, exclude: bank });
    } else {
      solution = growPartition(g, rng, { minSize, maxSize, sizeSeparation: sizeSep });
    }
    if (!solution) {
      report('no-partition');
      continue;
    }

    // ② all true clues
    const derive = () =>
      deriveClueUnits(g, solution!, rng, {
        rules: opt.rules,
        roseSymbols: opt.roseSymbols,
        bankDecoys: decoys,
        numbersPerRegion: opt.numbersPerRegion,
        polyominoesPerRegion: opt.polyominoesPerRegion,
        markersPerPair: opt.markersPerPair,
      });
    let units = derive();
    if (units.length === 0) {
      report('no-clues');
      continue;
    }

    // ③ the full clue set must pin this solution (and be acceptable itself).
    // On an irregular Shape Bank board we may carve the board instead of
    // giving up: removing a whole region keeps the solution valid and often
    // kills the alternative tilings.
    let full = mkPuzzle(flatten(units));
    let pinned = uniqueWith(full, solution);
    const maxRepairs = useBank && opt.mask === 'symmetric' ? (opt.repairs ?? 4) : 0;
    while (!pinned && repairs < maxRepairs) {
      const carved = carveRegion(g, solution, full, rng);
      if (!carved) break;
      repairs++;
      g = carved.grid;
      solution = carved.solution;
      units = derive();
      full = mkPuzzle(flatten(units));
      pinned = uniqueWith(full, solution);
    }
    if (!pinned) {
      report('not-unique');
      continue;
    }
    const fullAnalysis = accept(full.clues);
    if (!fullAnalysis) {
      report('not-logical');
      continue;
    }

    // ④–⑥ minimise against the oracle
    const { kept, analysis } = minimise(units, fullAnalysis, accept, rng, opt.keepRedundant ?? 0);
    const puzzle = mkPuzzle(flatten(kept));

    // ⑦⑧ difficulty gate
    if (puzzle.clues.length > maxClues()) {
      report('too-many-clues', analysis.stars, puzzle.clues.length);
      continue;
    }
    const result: GeneratedPuzzle = { puzzle, solution, analysis, seed, attempts: attempt };
    if (analysis.stars >= starLo) {
      report('ok', analysis.stars, puzzle.clues.length);
      return result;
    }
    report('stars', analysis.stars, puzzle.clues.length);
    // Keep the closest miss in case we run out of attempts.
    if (!best || starLo - analysis.stars < starLo - best.analysis.stars) best = result;
  }
  return best;
}

/**
 * Board repair: find a second solution, and remove from the board one region
 * of the intended solution that touches where the two solutions disagree.
 * Returns the new grid and solution (removed cells become holes), or null if
 * no removal keeps the board nice.
 */
function carveRegion(g: Grid, solution: Labels, puzzle: Puzzle, rng: Rng): { grid: Grid; solution: Labels } | null {
  const r = solve(createEngine(puzzle), { limit: 2, nodeLimit: GEN_NODE_LIMIT });
  const other = r.solutions.find((s) => !sameLabels(s, solution));
  if (!other) return null;
  // Regions of `solution` incident to an edge on which the two solutions differ.
  const score = new Map<number, number>();
  for (let e = 0; e < g.edges; e++) {
    const a = g.edgeA[e];
    const b = g.edgeB[e];
    const wall1 = solution[a] !== solution[b];
    const wall2 = other[a] !== other[b];
    if (wall1 === wall2) continue;
    for (const c of [a, b]) score.set(solution[c], (score.get(solution[c]) ?? 0) + 1);
  }
  const candidates = rng.shuffle([...score.entries()]).sort((x, y) => y[1] - x[1]).map(([id]) => id);
  const minCells = Math.max(8, Math.floor(g.activeCount * 0.6));
  for (const id of candidates) {
    const active = g.active.slice();
    let removed = 0;
    for (let c = 0; c < g.cells; c++) if (solution[c] === id) { active[c] = 0; removed++; }
    if (g.activeCount - removed < minCells) continue;
    if (!isNice(g.w, g.h, active)) continue;
    const holes: number[] = [];
    for (let c = 0; c < g.cells; c++) if (!active[c]) holes.push(c);
    const grid = makeGrid(g.w, g.h, holes);
    const labels = solution.slice();
    for (let c = 0; c < g.cells; c++) if (solution[c] === id) labels[c] = -1;
    return { grid, solution: relabel(labels) };
  }
  return null;
}

function isUniqueFast(puzzle: Puzzle): boolean {
  const r = solve(createEngine(puzzle), { limit: 2, nodeLimit: GEN_NODE_LIMIT });
  return !r.aborted && r.solutions.length === 1;
}

/** True if the puzzle has exactly one solution and it is `solution`. */
export function uniqueWith(puzzle: Puzzle, solution: Labels): boolean {
  const r = solve(createEngine(puzzle), { limit: 2, nodeLimit: GEN_NODE_LIMIT });
  if (r.aborted || r.solutions.length !== 1) return false;
  return sameLabels(r.solutions[0], solution);
}

export function sameLabels(a: Labels, b: Labels): boolean {
  const map = new Map<number, number>();
  for (let i = 0; i < a.length; i++) {
    if (a[i] < 0 || b[i] < 0) {
      if (a[i] !== b[i]) return false;
      continue;
    }
    const m = map.get(a[i]);
    if (m === undefined) map.set(a[i], b[i]);
    else if (m !== b[i]) return false;
  }
  return new Set(map.values()).size === map.size;
}

const isGlobal = (u: ClueUnit) => u.clues.length !== 1 || !('cell' in u.clues[0] || 'edge' in u.clues[0]);

/**
 * Greedy clue removal. Local clues (cells, markers) go first, in chunks —
 * most are redundant and one oracle call per chunk is cheap; global rules
 * (range, bank, rose, size separation) define the puzzle's character and are
 * tried last. A unit that cannot be removed may be replaced by a weaker form.
 */
function minimise(
  units: ClueUnit[],
  fullAnalysis: LogicalResult,
  accept: (clues: Clue[]) => LogicalResult | null,
  rng: Rng,
  keepRedundant: number,
): { kept: ClueUnit[]; analysis: LogicalResult } {
  const locals = rng.shuffle(units.filter((u) => !isGlobal(u)));
  const globals = rng.shuffle(units.filter(isGlobal));
  const current = new Set<ClueUnit>([...locals, ...globals]);
  let analysis = fullAnalysis;
  const clues = () => {
    const out: Clue[] = [];
    for (const u of current) out.push(...u.clues);
    return out;
  };
  const tryWithout = (us: ClueUnit[]): boolean => {
    for (const u of us) current.delete(u);
    const a = accept(clues());
    if (a) {
      analysis = a;
      return true;
    }
    for (const u of us) current.add(u);
    return false;
  };

  const CHUNK = 4;
  const settled = new Set<ClueUnit>();
  for (let i = 0; i + CHUNK <= locals.length; i += CHUNK) {
    const chunk = locals.slice(i, i + CHUNK);
    if (keepRedundant > 0 && chunk.some(() => rng.chance(keepRedundant))) continue;
    if (tryWithout(chunk)) for (const u of chunk) settled.add(u);
  }
  for (const u of [...locals, ...globals]) {
    if (settled.has(u)) continue;
    if (keepRedundant > 0 && rng.chance(keepRedundant)) continue;
    if (tryWithout([u])) continue;
    for (const alt of u.weaker ?? []) {
      const altUnit: ClueUnit = { kind: u.kind, clues: alt };
      current.delete(u);
      current.add(altUnit);
      const a = accept(clues());
      if (a) {
        analysis = a;
        break;
      }
      current.delete(altUnit);
      current.add(u);
    }
  }
  return { kept: [...current], analysis };
}
