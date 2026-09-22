import { createEngine, initialState, propagate, verify, type Engine, type Step } from './engine.ts';
import type { Deduction } from './rules/rule.ts';
import { chooseEdge } from './solver.ts';
import { JOIN, UNKNOWN, WALL, type State } from './state.ts';
import type { Labels, Puzzle } from './types.ts';

/**
 * Solver B: human-style. Applies the cheapest available deduction tier each
 * round and records the sequence. When no direct deduction exists it first
 * looks one move ahead (an edge whose other value breaks a rule at once —
 * tier 3, "lookahead"), then tries a single hypothetical ("if this edge were
 * a JOIN, we reach a contradiction, so it is a WALL") — tiers 4-6 by how much
 * has to be worked out inside it. Puzzles that need deeper guessing are
 * reported as not logically solvable.
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
  3: 'placement/reach/lookahead',
  4: 'short what-if',
  5: 'what-if chain',
  6: 'deep what-if',
};

/** Cost of one step at each tier, used by the difficulty score. */
const TIER_COST: Record<number, number> = { 1: 0.1, 2: 0.25, 3: 0.5, 4: 1.0, 5: 2.0, 6: 3.5 };

/**
 * Tier of a hypothetical from how many edges had to be settled inside it
 * before the contradiction showed. Propagation rounds are a poor measure: a
 * corridor of forced joins takes many rounds but one glance.
 */
function hypotheticalTier(inner: number): number {
  return inner <= 3 ? 4 : inner <= 10 ? 5 : 6;
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
    // One look ahead: every edge whose other value breaks a rule at once.
    // Each is sound on its own, and adding facts only makes the others more
    // certain, so they are applied together as one round.
    const looks = lookahead(engine, state);
    if (looks.length) {
      let n = 0;
      for (const d of looks) {
        if (state.edge[d.edge] !== UNKNOWN) continue;
        if (!state.setEdge(d.edge, d.value)) {
          result.broken = true;
          return finish(state);
        }
        n++;
      }
      steps.push({ tier: 3, techniques: { lookahead: n }, edges: n });
      continue;
    }
    if (!allowBif || result.bifurcations >= maxBif) return finish(state);
    const found = bifurcate(engine, state);
    if (!found) return finish(state);
    if (!state.setEdge(found.edge, found.value)) {
      result.broken = true;
      return finish(state);
    }
    steps.push({ tier: hypotheticalTier(found.inner), techniques: { bifurcation: 1 }, edges: 1 });
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
  lookahead: '반대로 놓으면 바로 규칙에 어긋납니다',
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
  const looks = lookahead(engine, state);
  if (looks.length) return looks;
  const b = bifurcate(engine, state);
  return b ? [{ edge: b.edge, value: b.value, technique: 'bifurcation', tier: hypotheticalTier(b.inner) }] : [];
}

/**
 * Edges whose other value breaks a rule at once: setting it is rejected, or
 * one pass of the rules finds a contradiction ("a wall here traps the 5 with
 * three cells"). A human sees these in one look; the solver's direct
 * propagators phrase only some of them, so they are found by trying.
 */
function lookahead(engine: Engine, state: State): Deduction[] {
  const out: Deduction[] = [];
  for (let e = 0; e < engine.grid.edges; e++) {
    if (state.edge[e] !== UNKNOWN) continue;
    for (const v of [JOIN, WALL] as const) {
      if (!breaksAtOnce(engine, state, e, v)) continue;
      out.push({ edge: e, value: v === JOIN ? WALL : JOIN, technique: 'lookahead', tier: 3 });
      break;
    }
  }
  return out;
}

function breaksAtOnce(engine: Engine, state: State, e: number, v: 1 | 2): boolean {
  const next = state.clone();
  if (!next.setEdge(e, v)) return true;
  const ds: Deduction[] = [];
  for (const r of engine.rules) if (!r.propagate(next, ds)) return true;
  for (const d of ds) {
    const cur = next.edge[d.edge];
    if (cur === d.value) continue;
    if (cur !== UNKNOWN || !next.setEdge(d.edge, d.value)) return true;
  }
  return false;
}

/**
 * Find the edge whose one value leads to a contradiction with the least work
 * inside the hypothetical (edges settled before it breaks) — the "what-if" a
 * human would spot first.
 */
function bifurcate(engine: Engine, state: State): { edge: number; value: 1 | 2; inner: number } | null {
  const tried = new Set<number>();
  const order: number[] = [chooseEdge(state)];
  for (const comp of [...state.comps.values()].sort((a, b) => (a.hi - a.cells.length) - (b.hi - b.cells.length))) {
    for (const e of state.openEdges(comp)) order.push(e);
  }
  let best: { edge: number; value: 1 | 2; inner: number } | null = null;
  for (const e of order) {
    if (tried.has(e)) continue;
    tried.add(e);
    for (const v of [JOIN, WALL] as const) {
      const next = state.clone();
      const rounds: Step[] = [];
      if (!next.setEdge(e, v) || !propagate(engine, next, { stepwise: true, steps: rounds })) {
        let inner = 0;
        for (const s of rounds) inner += s.edges;
        if (!best || inner < best.inner) best = { edge: e, value: v === JOIN ? WALL : JOIN, inner };
        if (inner <= 3) return best;
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
  let direct = 0;
  let hypo = 0;
  for (const s of r.steps) {
    const c = TIER_COST[s.tier] ?? 1;
    if (s.techniques['bifurcation']) hypo += c;
    else direct += c;
  }
  // normalise the amount of work by grid size so 5x5 and 8x8 are comparable
  const norm = Math.sqrt(engine.grid.activeCount / 36);
  let score = WEIGHT_TIER * r.maxTier + (WEIGHT_HYPO * hypo + WEIGHT_DIRECT * direct) / norm;
  if (!r.solved) score += 8;
  return Math.round(score * 100) / 100;
}

/**
 * The hardest technique and the hypotheticals carry the score; the length of
 * the routine chain only nudges it. (A long chain of easy steps is work, not
 * difficulty.)
 */
const WEIGHT_TIER = 1.0;
const WEIGHT_HYPO = 1.0;
const WEIGHT_DIRECT = 0.2;

// Star boundaries, read against the score's parts (max tier + hypotheticals
// + a fifth of the routine chain):
//   1★ only trivial/local steps       2★ placement, reach or one-look steps
//   3★ a short what-if                 4★ several short what-ifs, or one chain
//   5★ three chains, or one deep       6★ a deep what-if plus chains
//   7★ two deep what-ifs and more
// Minimal 6x6 puzzles land mostly at 2-5★, 8x8 at 4-7★.
const STAR_THRESHOLDS = [3.5, 5.5, 8, 10.5, 14, 18];
export function starsFor(score: number): number {
  let s = 1;
  for (const t of STAR_THRESHOLDS) if (score >= t) s++;
  return s;
}
