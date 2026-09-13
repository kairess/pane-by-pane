import { createEngine, initialState, propagate, verify, type Engine, type Step } from './engine.ts';
import type { Deduction } from './rules/rule.ts';
import { chooseEdge } from './solver.ts';
import { JOIN, WALL, type State } from './state.ts';
import type { Labels, Puzzle } from './types.ts';

/**
 * Solver B: human-style. Applies the cheapest available deduction tier each
 * round and records the sequence. When no direct deduction exists it tries a
 * single hypothetical ("if this edge were a JOIN, we reach a contradiction, so
 * it is a WALL") — tier 6. Puzzles that need deeper guessing are reported as
 * not logically solvable.
 */
export interface LogicalResult {
  solved: boolean;
  /** the puzzle is inconsistent (no solution) */
  broken: boolean;
  steps: Step[];
  deductions: number;
  maxTier: number;
  bifurcations: number;
  techniques: Record<string, number>;
  /** raw difficulty score, see `difficultyScore` */
  difficulty: number;
  /** 1..7 star rating */
  stars: number;
  /** progress when we gave up: fraction of edges determined */
  progress: number;
  labels?: Labels;
}

export const TIER_NAMES: Record<number, string> = {
  1: 'trivial',
  2: 'local',
  3: 'placement/reach',
  4: 'short what-if',
  5: 'what-if chain',
  6: 'deep what-if',
};

/** Cost of one step at each tier, used by the difficulty score. */
const TIER_COST: Record<number, number> = { 1: 0.1, 2: 0.25, 3: 0.5, 4: 1.0, 5: 2.0, 6: 3.5 };

/** A hypothetical that reaches a contradiction within `depth` propagation rounds. */
function hypotheticalTier(depth: number): number {
  return depth <= 2 ? 4 : depth <= 5 ? 5 : 6;
}

export interface LogicalOptions {
  /** allow hypotheticals (tiers 4-6, default true) */
  allowBifurcation?: boolean;
  /** max hypotheticals before giving up (default 40) */
  maxBifurcations?: number;
}

export function solveLogically(puzzle: Puzzle | Engine, opts: LogicalOptions = {}): LogicalResult {
  const engine = 'rules' in puzzle ? puzzle : createEngine(puzzle);
  const allowBif = opts.allowBifurcation ?? true;
  const maxBif = opts.maxBifurcations ?? 40;
  const steps: Step[] = [];
  const result: LogicalResult = {
    solved: false,
    broken: false,
    steps,
    deductions: 0,
    maxTier: 0,
    bifurcations: 0,
    techniques: {},
    difficulty: 0,
    stars: 1,
    progress: 0,
  };
  const finish = (state: State | null): LogicalResult => {
    for (const s of steps) {
      result.deductions += s.edges;
      result.maxTier = Math.max(result.maxTier, s.tier);
      for (const [t, n] of Object.entries(s.techniques)) result.techniques[t] = (result.techniques[t] ?? 0) + n;
    }
    result.bifurcations = result.techniques['bifurcation'] ?? 0;
    if (state) result.progress = 1 - state.unknownCount / engine.grid.edges;
    result.difficulty = difficultyScore(result, engine);
    result.stars = starsFor(result.difficulty);
    return result;
  };

  const state = initialState(engine, { stepwise: true, steps });
  if (!state) {
    result.broken = true;
    return finish(null);
  }

  for (;;) {
    if (!propagate(engine, state, { stepwise: true, steps })) {
      result.broken = true;
      return finish(state);
    }
    if (state.isComplete()) {
      const labels = state.labels();
      if (!verify(engine, labels)) {
        result.broken = true;
        return finish(state);
      }
      result.solved = true;
      result.labels = labels;
      return finish(state);
    }
    if (!allowBif || result.bifurcations >= maxBif) return finish(state);
    const found = bifurcate(engine, state);
    if (!found) return finish(state);
    if (!state.setEdge(found.edge, found.value)) {
      result.broken = true;
      return finish(state);
    }
    steps.push({ tier: hypotheticalTier(found.depth), techniques: { bifurcation: 1 }, edges: 1 });
    result.bifurcations++;
  }
}

/** Human-readable names for techniques (used by the web UI's hints). */
export const TECHNIQUE_LABELS: Record<string, string> = {
  'fixed-wall': '미리 그어진 경계선입니다',
  'marker-wall': '마커가 있는 자리는 경계선입니다',
  'same-symbol': '같은 기호끼리는 한 구역이 될 수 없습니다',
  'size-full': '이 구역은 이미 최대 넓이이므로 더 넓어질 수 없습니다',
  'merge-conflict': '양쪽을 합치면 규칙에 어긋나므로 경계선입니다',
  'forced-exit': '이 구역이 더 커질 수 있는 길이 이 한 곳뿐입니다',
  'reach-exact': '필요한 넓이를 채우려면 닿을 수 있는 칸을 전부 써야 합니다',
  'shape-place': '허용된 형태를 놓아 보면 여기는 정해져 있습니다',
  bifurcation: '반대로 가정하면 모순이 납니다',
};

/**
 * The next deduction from an arbitrary (consistent, propagated) state: the
 * cheapest direct deduction, else the shallowest hypothetical. Used for hints.
 */
export function nextDeduction(engine: Engine, state: State): Deduction | null {
  return allDeductions(engine, state)?.[0] ?? null;
}

/**
 * Every deduction available from a state, cheapest tier first (null on
 * contradiction). Falls back to one hypothetical when no direct deduction
 * exists. Lets a UI pick among equally cheap deductions, e.g. the one nearest
 * to where the player is working.
 */
export function allDeductions(engine: Engine, state: State): Deduction[] | null {
  const out: Deduction[] = [];
  for (const r of engine.rules) if (!r.propagate(state.clone(), out)) return null;
  const seen = new Set<number>();
  const fresh = out.filter((d) => state.edge[d.edge] === 0 && !seen.has(d.edge) && seen.add(d.edge));
  if (fresh.length) return fresh.sort((a, b) => a.tier - b.tier);
  const b = bifurcate(engine, state);
  return b ? [{ edge: b.edge, value: b.value, technique: 'bifurcation', tier: hypotheticalTier(b.depth) }] : [];
}

/**
 * Find the edge whose one value leads to a contradiction in the fewest
 * propagation rounds — the "what-if" a human would spot first.
 */
function bifurcate(engine: Engine, state: State): { edge: number; value: 1 | 2; depth: number } | null {
  const tried = new Set<number>();
  const order: number[] = [chooseEdge(state)];
  for (const comp of [...state.comps.values()].sort((a, b) => (a.hi - a.cells.length) - (b.hi - b.cells.length))) {
    for (const e of state.openEdges(comp)) order.push(e);
  }
  let best: { edge: number; value: 1 | 2; depth: number } | null = null;
  for (const e of order) {
    if (tried.has(e)) continue;
    tried.add(e);
    for (const v of [JOIN, WALL] as const) {
      const next = state.clone();
      const rounds: Step[] = [];
      if (!next.setEdge(e, v) || !propagate(engine, next, { stepwise: true, steps: rounds })) {
        const depth = rounds.length + 1;
        if (!best || depth < best.depth) best = { edge: e, value: v === JOIN ? WALL : JOIN, depth };
        if (depth <= 2) return best;
      }
    }
  }
  return best;
}

/**
 * Difficulty heuristic. Solver time is *not* a good proxy for human
 * difficulty; the deduction sequence is. We weight the hardest technique
 * needed, hypotheticals, and the length of the chain, normalised by grid size.
 */
export function difficultyScore(r: Pick<LogicalResult, 'steps' | 'maxTier' | 'solved'>, engine: Engine): number {
  let work = 0;
  for (const s of r.steps) work += TIER_COST[s.tier] ?? 1;
  // normalise the amount of work by grid size so 5x5 and 8x8 are comparable
  const chain = work / Math.sqrt(engine.grid.activeCount / 36);
  let score = 0.5 * r.maxTier + 0.5 * chain;
  if (!r.solved) score += 8;
  return Math.round(score * 100) / 100;
}

// Calibrated on generated 6x6 puzzles: minimal (hardest) puzzles land at 10-22,
// puzzles with many redundant clues and no what-ifs at 2.5-4.5.
const STAR_THRESHOLDS = [3, 4.5, 6.5, 9, 12, 16];
export function starsFor(score: number): number {
  let s = 1;
  for (const t of STAR_THRESHOLDS) if (score >= t) s++;
  return s;
}
