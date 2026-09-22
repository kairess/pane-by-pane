import { createEngine } from '../engine.ts';
import { edgeBetween, makeGrid, type Grid } from '../grid.ts';
import { solveLogically, type LogicalResult } from '../logical.ts';
import { Rng } from '../random.ts';
import type { ShapeKey } from '../shape.ts';
import { solve } from '../solver.ts';
import type { Clue, EdgeRef, Labels, Puzzle, RuleKind } from '../types.ts';
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
  /**
   * Region area bounds for the random partition. Default: chosen from the
   * board size and the target stars (larger regions make harder puzzles) and
   * varied a little per solution — see `autoSizeBand`. Ignored with Shape
   * Bank: regions are the bank's shapes.
   */
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
   * Fixed walls: borders that belong to the board (the window's leading).
   * Fraction of the solution's border edges to fix, drawn as short straight
   * runs (default 0 = none; true = random 0.1..0.3).
   */
  walls?: number | boolean;
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
  /**
   * Attempts: each is one minimisation run (the attempt budget also bounds
   * the total work). A solution is reused for up to `ordersPerSolution`
   * consecutive attempts, each removing clues in a different order, before a
   * new solution is drawn. Default 200 attempts, 8 orders per solution.
   */
  attempts?: number;
  ordersPerSolution?: number;
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
  /** which removal order on the current solution this attempt was (1 = fresh solution) */
  order?: number;
  ms: number;
}

export interface GeneratedPuzzle {
  puzzle: Puzzle;
  solution: Labels;
  analysis: LogicalResult;
  seed: number;
  attempts: number;
  /**
   * The requested star range was not reached within the attempt budget and
   * this is the closest the generator got. Callers should say so rather than
   * present the puzzle as what was asked for.
   */
  missed?: boolean;
}

/** Search budget for uniqueness checks inside the generator. A puzzle whose
 *  uniqueness cannot be settled quickly is treated as not unique. */
const GEN_NODE_LIMIT = 30_000;

export function generate(opt: GenerateOptions): GeneratedPuzzle | null {
  const seed = opt.seed ?? Math.floor(Math.random() * 0xffffffff);
  const rng = new Rng(seed);
  const rect = makeGrid(opt.width, opt.height);
  const attempts = opt.attempts ?? 200;
  const requireLogical = opt.requireLogical ?? true;
  const [starLo, starHi] = opt.stars ?? [1, 7];
  const useBank = opt.rules.includes('shapeBank');
  const sizeSep = opt.rules.includes('sizeSeparation');
  // Rose: every region holds one of each symbol kind, so regions need at least that many cells.
  const roseK = opt.rules.includes('rose') ? Math.max(1, opt.roseSymbols ?? 2) : 0;
  // Rose on its own (or with markers / size separation, which only constrain
  // regions something else outlines): the symbols must pin every region by
  // themselves, which needs small, path-like regions (see roseSymbolCells).
  const outlining = opt.rules.some((r) => r === 'areaNumber' || r === 'shapeBank' || r === 'polyomino');
  const roseOnly = roseK >= 2 && !outlining;
  // Range, twin/unlike markers, size separation and rose cannot outline
  // regions by themselves. Like the original's lead lines, the board's fixed
  // walls then serve as the clue: start from every border of the solution and
  // take walls away while the rule still pins it. (Rose-only puzzles usually
  // end up with few or no walls, but on a plain rectangle two dominoes in a
  // 2x2 block with diagonal symbols can be paired either way, and only a wall
  // settles that.)
  const wallMode = !outlining;
  const [autoLo, autoHi] = autoSizeBand(opt.width, opt.height, starLo, starHi);
  const explicitSize = opt.minSize !== undefined || opt.maxSize !== undefined;
  // Markers only (twin / unlike / size separation, with no area rule): nothing
  // bounds a region from below, so a region can always be cut in two unless a
  // marker forbids it. As in the original's marker windows, the regions are
  // therefore small (single cells included) so that every cut breaks a marker:
  // measured on masked boards, "all walls + all markers" pins the solution for
  // about half of the partitions with regions of 1-3 cells, a tenth with 1-4,
  // and never with 1-5.
  const markerOnly = wallMode && !opt.rules.includes('range') && roseK === 0;
  /** region size bounds for the next solution */
  const sizeBand = (): [number, number] => {
    let lo = opt.minSize ?? autoLo;
    let hi = opt.maxSize ?? autoHi;
    if (markerOnly && !explicitSize) return [1, (sizeSep ? 4 : 3) + rng.int(2)];
    // automatic band: vary it a little per solution so windows differ in grain,
    // and keep room for at least four regions on a small board
    if (!explicitSize) {
      lo += rng.int(2);
      hi += rng.int(3) - 1;
      lo = Math.min(lo, Math.max(2, Math.floor(g.activeCount / 4)));
      if (hi < lo + 2) hi = lo + 2;
    }
    if (roseOnly) {
      // Rose-only regions are small by construction: at most k+2 cells (k+3
      // with size separation), and from k cells up unless the caller says
      // otherwise: a region with more tips than symbols cannot be pinned by
      // its symbols (see roseSymbolCells), and the smallest regions have the
      // fewest tips. The lower bound stays below the upper one so that at
      // least two sizes remain, or one region size would have to divide the board.
      const sizeHi = Math.max(roseK, Math.min(hi, roseK + (sizeSep ? 3 : 2)));
      const sizeLo = Math.max(roseK, Math.min(explicitSize ? lo : roseK, sizeHi - 1));
      return [sizeLo, sizeHi];
    }
    return [Math.max(lo, roseK), Math.max(hi, roseK)];
  };
  let g = rect;
  let walls: EdgeRef[] = [];
  const maxClues = () => opt.maxClues ?? Math.ceil(g.activeCount / 2);
  const mkPuzzle = (clues: Clue[]): Puzzle => {
    const p: Puzzle = { width: g.w, height: g.h, clues };
    if (g.holes.length) p.holes = [...g.holes];
    if (walls.length) p.walls = walls.map((w) => ({ ...w }));
    return p;
  };

  /**
   * Star cap for the current solution. Normally the requested upper bound;
   * when even the full clue set rates above it (a rule set that never gets
   * that easy) the cap is lifted to the full set's rating, so the minimiser
   * keeps the puzzle as easy as it can be and the result is reported as a miss.
   */
  let cap = starHi;
  /** The oracle: is this clue set an acceptable puzzle? Returns its analysis. */
  const accept = (clues: Clue[]): LogicalResult | null => {
    const puzzle = mkPuzzle(clues);
    if (!requireLogical && !isUniqueFast(puzzle)) return null;
    const a = solveLogically(puzzle);
    if (requireLogical && !a.solved) return null;
    return a.stars <= cap ? a : null;
  };

  /**
   * Wall minimisation (wall mode): take walls away, in chunks then singly,
   * while the puzzle with `clues` stays acceptable. Returns the analysis of
   * what is left. What is minimised first is what gets removed, and what
   * stays carries the puzzle: walls carry it plainly (easier), markers and
   * symbols make the solver work for it (harder). So a hard target takes the
   * walls away first, once per solution, since with every clue present the
   * outcome barely depends on the order; otherwise the clues go first and the
   * walls are trimmed per order, which also keeps the marker count down
   * (walls are board, not clues, and the original's marker windows keep many
   * leads and few markers).
   */
  const minimiseWalls = (clues: Clue[], start: LogicalResult): LogicalResult => {
    let analysis = start;
    let wallsKept = rng.shuffle(walls.slice());
    const without = (drop: EdgeRef[]): boolean => {
      const before = walls;
      walls = wallsKept.filter((w) => !drop.includes(w));
      const a = accept(clues);
      if (a) {
        wallsKept = walls;
        analysis = a;
        return true;
      }
      walls = before;
      return false;
    };
    const CHUNK = 4;
    const settled = new Set<EdgeRef>();
    for (let i = 0; i + CHUNK <= wallsKept.length; i += CHUNK) {
      const chunk = wallsKept.slice(i, i + CHUNK);
      if (without(chunk)) for (const w of chunk) settled.add(w);
    }
    for (const w of wallsKept.slice()) if (!settled.has(w)) without([w]);
    walls = wallsKept;
    return analysis;
  };

  let best: GeneratedPuzzle | null = null;
  // Difficulty comes far more from *which* clues survive minimisation than
  // from the solution itself: one solution minimised in different orders
  // spans 2-7 stars. Preparing a solution (partition, clue derivation,
  // uniqueness) is the expensive part, so each one is minimised in several
  // orders before a new one is drawn.
  interface Prepared {
    g: Grid;
    solution: Labels;
    /** fixed walls (in wall mode: every border, minimised per order) */
    walls: EdgeRef[];
    units: ClueUnit[];
    fullAnalysis: LogicalResult;
    repairs: number;
  }
  let prepared: Prepared | null = null;
  let order = 0;
  const ordersPerSolution = Math.max(1, opt.ordersPerSolution ?? 8);
  /** clue sets already produced from the current solution: a repeat means the order no longer matters */
  const seen = new Set<string>();
  // Asked for a hard puzzle: minimise clue by clue for more varied outcomes
  // (the cap at starHi still holds).
  const prefer = starLo >= 3 ? 'hard' : undefined;
  const wallsFirst = wallMode && !markerOnly && prefer === 'hard';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const t0 = Date.now();
    let repairs = 0;
    const report = (reason: AttemptInfo['reason'], stars?: number, clues?: number) =>
      opt.onAttempt?.({ attempt, reason, stars, clues, repairs, order: order || undefined, ms: Date.now() - t0 });

    if (!prepared || order >= ordersPerSolution) {
      prepared = null;
      order = 0;
      // ① board + solution
      g = opt.mask === 'symmetric' ? makeGrid(rect.w, rect.h, randomMask(rect.w, rect.h, rng, { ratio: opt.holeRatio, symmetry: opt.symmetry, asymmetry: opt.asymmetry })) : rect;
      let solution: Labels | null;
      let decoys: ShapeKey[] = [];
      if (useBank) {
        const sizes = { minSize: Math.max(opt.bankShapeSizes?.[0] ?? 1, roseK), maxSize: opt.bankShapeSizes?.[1] };
        const bank = catalogBank(rng, { count: opt.bankSize, ...sizes });
        solution = tilePartition(g, bank, rng, { sizeSeparation: sizeSep });
        if (opt.bankDecoys) decoys = catalogBank(rng, { count: opt.bankDecoys, ...sizes, exclude: bank });
      } else {
        const [sizeLo, sizeHi] = sizeBand();
        solution = growPartition(g, rng, { minSize: sizeLo, maxSize: sizeHi, sizeSeparation: sizeSep, maxTips: roseOnly ? roseK : undefined });
      }
      if (!solution) {
        report('no-partition');
        continue;
      }
      const wallRatio = opt.walls === true ? 0.1 + rng.next() * 0.2 : typeof opt.walls === 'number' ? opt.walls : 0;
      walls = wallMode ? allBorders(g, solution) : wallRatio > 0 ? pickWalls(g, solution, rng, wallRatio) : [];

      // ② all true clues
      const derive = () =>
        deriveClueUnits(g, solution!, rng, {
          rules: opt.rules,
          roseSymbols: opt.roseSymbols,
          roseForced: roseOnly,
          bankDecoys: decoys,
          numbersPerRegion: opt.numbersPerRegion,
          polyominoesPerRegion: opt.polyominoesPerRegion,
          markersPerPair: opt.markersPerPair,
        });
      let units = derive();
      // Every rule the puzzle was asked for must be derivable from this solution
      // (twin markers need two same-shaped neighbours, rose needs big enough regions, …).
      if (opt.rules.some((k) => !units.some((u) => u.kind === k))) {
        report('no-clues');
        continue;
      }

      // ③ the full clue set must pin this solution (and be acceptable itself).
      // On an irregular Shape Bank board we may carve the board instead of
      // giving up: removing a whole region keeps the solution valid and often
      // kills the alternative tilings.
      let full = mkPuzzle(flatten(units));
      let pinned = uniqueWith(full, solution);
      // Cell clues share out the cells (one symbol each), so which cells the rose
      // symbols land on decides how much the numbers can say. Re-deal a few times
      // before giving up on this solution.
      const hasCellClues = opt.rules.some((r) => r === 'areaNumber' || r === 'polyomino');
      for (let redeal = 0; !pinned && roseK > 0 && hasCellClues && redeal < 8; redeal++) {
        units = derive();
        full = mkPuzzle(flatten(units));
        pinned = uniqueWith(full, solution);
      }
      const maxRepairs = useBank && opt.mask === 'symmetric' ? (opt.repairs ?? 4) : 0;
      while (!pinned && repairs < maxRepairs) {
        const carved = carveRegion(g, solution, full, rng);
        if (!carved) break;
        repairs++;
        g = carved.grid;
        solution = carved.solution;
        walls = walls.filter((w) => g.active[w.a] && g.active[w.b]);
        units = derive();
        full = mkPuzzle(flatten(units));
        pinned = uniqueWith(full, solution);
      }
      if (!pinned) {
        report('not-unique');
        continue;
      }
      cap = starHi;
      let fullAnalysis = accept(full.clues);
      if (!fullAnalysis) {
        // Above the requested cap with every clue present? Aim for as easy as possible instead.
        const a = solveLogically(full);
        if (!a.solved || (!requireLogical && !isUniqueFast(full))) {
          report('not-logical');
          continue;
        }
        cap = a.stars;
        fullAnalysis = a;
      }
      if (wallsFirst) fullAnalysis = minimiseWalls(full.clues, fullAnalysis);
      prepared = { g, solution, walls, units, fullAnalysis, repairs };
      seen.clear();
    }

    // One removal order on the prepared solution.
    order++;
    g = prepared.g;
    walls = prepared.walls;
    repairs = prepared.repairs;
    const { solution, units } = prepared;

    // ④–⑥ minimise against the oracle (walls last unless they went first at preparation)
    const minimised = minimise(units, prepared.fullAnalysis, accept, rng, opt.keepRedundant ?? 0, opt.rules, prefer);
    const kept = minimised.kept;
    let analysis = minimised.analysis;
    if (wallMode && !wallsFirst) analysis = minimiseWalls(flatten(kept), analysis);
    const puzzle = mkPuzzle(flatten(kept));
    // Nothing left to vary on this solution (no removable local clues, say):
    // move on rather than spend the remaining orders on the same puzzle.
    const signature = JSON.stringify([puzzle.clues, walls]);
    if (seen.has(signature)) order = ordersPerSolution;
    seen.add(signature);
    // With the cap lifted no order can bring this solution into range: one is enough.
    if (cap > starHi) order = ordersPerSolution;

    // ⑦⑧ difficulty gate
    if (puzzle.clues.length > maxClues()) {
      report('too-many-clues', analysis.stars, puzzle.clues.length);
      continue;
    }
    const result: GeneratedPuzzle = { puzzle, solution, analysis, seed, attempts: attempt };
    if (analysis.stars >= starLo && analysis.stars <= starHi) {
      report('ok', analysis.stars, puzzle.clues.length);
      return result;
    }
    report('stars', analysis.stars, puzzle.clues.length);
    // Keep the closest miss (on either side) in case we run out of attempts.
    const miss = (st: number) => (st < starLo ? starLo - st : st - starHi);
    if (!best || miss(analysis.stars) < miss(best.analysis.stars)) best = result;
  }
  if (best) best.missed = true;
  return best;
}

/**
 * Region size band when the caller gives none: about six to ten regions for
 * the board, shifted up for hard targets and down for easy ones. Larger
 * regions leave fewer clues and need more what-ifs (6x6: at 2-4 cells most
 * windows are 2★, at 5-10 a third are 6-7★), so the band is part of aiming
 * at the requested stars rather than a setting of its own.
 */
export function autoSizeBand(width: number, height: number, starLo: number, starHi: number): [number, number] {
  const side = Math.sqrt(width * height);
  // Never below 3: two-cell regions next to each other can be re-paired
  // without changing any number, so the full clue set is rarely unique.
  let lo = side < 8.5 ? 3 : 4;
  let hi = side < 5.5 ? 5 : side < 7 ? 6 : side < 8.5 ? 7 : 8;
  if (starLo >= 5) {
    lo += 1;
    hi += 2;
  } else if (starLo >= 3) {
    hi += 1;
  } else if (starHi <= 2) {
    hi -= 1;
  }
  return [lo, hi];
}

/** Every border of a solution as fixed walls (the starting point of wall mode). */
export function allBorders(g: Grid, solution: Labels): EdgeRef[] {
  const out: EdgeRef[] = [];
  for (let e = 0; e < g.edges; e++) if (solution[g.edgeA[e]] !== solution[g.edgeB[e]]) out.push({ a: g.edgeA[e], b: g.edgeB[e] });
  return out;
}

export function pickWalls(g: Grid, solution: Labels, rng: Rng, ratio: number): EdgeRef[] {
  const border: number[] = [];
  for (let e = 0; e < g.edges; e++) if (solution[g.edgeA[e]] !== solution[g.edgeB[e]]) border.push(e);
  // asked for walls: show at least one
  const target = Math.max(border.length ? 1 : 0, Math.round(border.length * ratio));
  const chosen = new Set<number>();
  const isBorder = new Uint8Array(g.edges);
  for (const e of border) isBorder[e] = 1;
  /** the two collinear continuations of an edge (or -1) */
  const along = (e: number): number[] => {
    const a = g.edgeA[e];
    const b = g.edgeB[e];
    const horizontalPair = b === a + 1; // vertical segment between a and a+1
    const d = horizontalPair ? g.w : 1;
    const out: number[] = [];
    for (const s of [-d, d]) {
      const a2 = a + s;
      const b2 = b + s;
      if (a2 < 0 || b2 < 0 || a2 >= g.cells || b2 >= g.cells) continue;
      if (!horizontalPair && Math.floor(a2 / g.w) !== Math.floor(a / g.w)) continue;
      out.push(edgeBetween(g, a2, b2));
    }
    return out;
  };
  for (let t = 0; t < 200 && chosen.size < target && border.length; t++) {
    const start = rng.pick(border);
    if (chosen.has(start)) continue;
    const run = 1 + rng.int(3);
    chosen.add(start);
    let frontier = [start];
    for (let k = 1; k < run && chosen.size < target; k++) {
      const next: number[] = [];
      for (const e of frontier) for (const n of along(e)) if (n >= 0 && isBorder[n] && !chosen.has(n)) next.push(n);
      if (!next.length) break;
      const pickd = rng.pick(next);
      chosen.add(pickd);
      frontier = [pickd];
    }
  }
  return [...chosen].sort((x, y) => x - y).map((e) => ({ a: g.edgeA[e], b: g.edgeB[e] }));
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
  mustShow: readonly RuleKind[] = [],
  prefer?: 'hard',
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
    if (us.some((u) => u.required)) return false;
    for (const u of us) current.delete(u);
    // a rule the puzzle was asked for keeps at least one clue, even a redundant one
    if (mustShow.some((k) => ![...current].some((u) => u.kind === k))) {
      for (const u of us) current.add(u);
      return false;
    }
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
  // Chunked removal is a speed-up that also narrows the outcome: the same
  // solution minimised clue by clue in random orders reaches high stars more
  // often per second than any guided or chunked scheme tried, so a hard
  // target goes straight to single removals.
  for (let i = 0; prefer !== 'hard' && i + CHUNK <= locals.length; i += CHUNK) {
    const chunk = locals.slice(i, i + CHUNK);
    if (keepRedundant > 0 && chunk.some(() => rng.chance(keepRedundant))) continue;
    if (tryWithout(chunk)) for (const u of chunk) settled.add(u);
  }
  for (const u of [...locals, ...globals]) {
    if (settled.has(u)) continue;
    if (keepRedundant > 0 && rng.chance(keepRedundant)) continue;
    if (!u.required && tryWithout([u])) continue;
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
