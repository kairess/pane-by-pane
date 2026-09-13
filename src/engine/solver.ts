import { createEngine, initialState, propagate, verify, type Engine } from './engine.ts';
import { JOIN, WALL, type Comp, type State } from './state.ts';
import type { Labels, Puzzle } from './types.ts';

/**
 * Solver A: complete search. Its only job is to answer "how many solutions?"
 * (we stop at `limit`, normally 2). It uses the same propagators as the
 * logical solver but branches freely on edges.
 */
export interface SolveOptions {
  /** stop after this many solutions (default 2 = uniqueness check) */
  limit?: number;
  /** give up after this many search nodes */
  nodeLimit?: number;
}

export interface SolveResult {
  solutions: Labels[];
  nodes: number;
  /** true if nodeLimit was hit; the count is then a lower bound */
  aborted: boolean;
}

export function solve(puzzle: Puzzle | Engine, opts: SolveOptions = {}): SolveResult {
  const engine = 'rules' in puzzle ? puzzle : createEngine(puzzle);
  const limit = opts.limit ?? 2;
  const nodeLimit = opts.nodeLimit ?? 500_000;
  const res: SolveResult = { solutions: [], nodes: 0, aborted: false };
  const start = initialState(engine);
  if (!start) return res;

  const dfs = (state: State): boolean => {
    res.nodes++;
    if (res.nodes > nodeLimit) {
      res.aborted = true;
      return true;
    }
    if (state.isComplete()) {
      const labels = state.labels();
      if (verify(engine, labels)) res.solutions.push(labels);
      return res.solutions.length >= limit;
    }
    const e = chooseEdge(state);
    for (const v of [JOIN, WALL] as const) {
      const next = state.clone();
      if (!next.setEdge(e, v)) continue;
      if (!propagate(engine, next)) continue;
      if (dfs(next)) return true;
    }
    return false;
  };
  dfs(start);
  return res;
}

/** Pick the unknown edge on the most constrained open component. */
export function chooseEdge(state: State): number {
  let best: Comp | null = null;
  let bestScore = Infinity;
  let bestEdge = -1;
  for (const comp of state.comps.values()) {
    const open = state.openEdges(comp);
    if (open.length === 0) continue;
    // fewer exits first; then components with tight facts; then bigger ones
    const tight = (comp.shapes ? 0 : 1) + (comp.lo === comp.hi ? 0 : 1);
    const score = open.length * 4 + tight - Math.min(comp.cells.length, 3) * 0.1;
    if (score < bestScore) {
      bestScore = score;
      best = comp;
      bestEdge = open[0];
    }
  }
  if (!best) throw new Error('no open edge on incomplete state');
  return bestEdge;
}

export function countSolutions(puzzle: Puzzle | Engine, limit = 2): number {
  return solve(puzzle, { limit }).solutions.length;
}

export function isUnique(puzzle: Puzzle | Engine): boolean {
  const r = solve(puzzle, { limit: 2 });
  return !r.aborted && r.solutions.length === 1;
}
