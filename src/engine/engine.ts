import { makeGrid, type Grid } from './grid.ts';
import { buildRules, type Deduction, type Rule } from './rules/index.ts';
import { regionsFromLabels, State, UNKNOWN } from './state.ts';
import type { Labels, Puzzle } from './types.ts';

/** A puzzle compiled into grid + rule objects. */
export interface Engine {
  puzzle: Puzzle;
  grid: Grid;
  rules: Rule[];
}

export function createEngine(puzzle: Puzzle): Engine {
  const grid = makeGrid(puzzle.width, puzzle.height, puzzle.holes ?? []);
  validate(puzzle, grid);
  return { puzzle, grid, rules: buildRules(puzzle, grid) };
}

function validate(p: Puzzle, g: Grid): void {
  const cellOk = (c: number) => Number.isInteger(c) && c >= 0 && c < g.cells && g.active[c] === 1;
  for (const c of p.clues) {
    switch (c.type) {
      case 'areaNumber':
        if (!cellOk(c.cell) || c.value < 1) throw new Error('bad areaNumber clue');
        break;
      case 'polyomino':
        if (!cellOk(c.cell)) throw new Error('bad polyomino clue');
        break;
      case 'gemini':
      case 'delta':
        if (!cellOk(c.edge.a) || !cellOk(c.edge.b)) throw new Error(`bad ${c.type} clue`);
        break;
      case 'rose':
        for (const s of c.symbols) if (!cellOk(s.cell)) throw new Error('bad rose clue');
        break;
      default:
        break;
    }
  }
}

/** One batch of same-tier deductions applied together. */
export interface Step {
  tier: number;
  techniques: Record<string, number>;
  edges: number;
}

export interface PropagateOptions {
  /** Apply only the lowest available tier per round and record each round. */
  stepwise?: boolean;
  steps?: Step[];
}

/**
 * Initial state with all rules' starting facts applied and propagated.
 * null = contradiction. With `propagate: false` only the rules' init facts
 * are applied (used to compute hints relative to a player's own marks).
 */
export function initialState(engine: Engine, opts: PropagateOptions & { propagate?: boolean } = {}): State | null {
  const state = new State(engine.grid);
  const out: Deduction[] = [];
  for (const r of engine.rules) if (!r.init(state, out)) return null;
  if (!apply(state, out, opts)) return null;
  if (opts.propagate === false) return state;
  return propagate(engine, state, opts) ? state : null;
}

function apply(state: State, ds: Deduction[], opts: PropagateOptions): boolean {
  if (ds.length === 0) return true;
  let tier = Infinity;
  if (opts.stepwise) for (const d of ds) if (d.tier < tier) tier = d.tier;
  const step: Step = { tier: opts.stepwise ? tier : 0, techniques: {}, edges: 0 };
  for (const d of ds) {
    if (opts.stepwise && d.tier !== tier) continue;
    const cur = state.edge[d.edge];
    if (cur === d.value) continue;
    if (cur !== UNKNOWN) return false;
    if (!state.setEdge(d.edge, d.value)) return false;
    step.edges++;
    step.techniques[d.technique] = (step.techniques[d.technique] ?? 0) + 1;
    if (!opts.stepwise) step.tier = Math.max(step.tier, d.tier);
  }
  if (step.edges && opts.steps) opts.steps.push(step);
  return true;
}

/** Run all propagators to a fixpoint. Returns false on contradiction. */
export function propagate(engine: Engine, state: State, opts: PropagateOptions = {}): boolean {
  for (;;) {
    const out: Deduction[] = [];
    const v0 = state.version;
    const u0 = state.unknownCount;
    for (const r of engine.rules) if (!r.propagate(state, out)) return false;
    if (out.length && !apply(state, out, opts)) return false;
    // Fixpoint: no edge set and no fact narrowed this round.
    if (state.version === v0 && state.unknownCount === u0) return true;
  }
}

/** Check a complete partition against every rule. */
export function verify(engine: Engine, labels: Labels): boolean {
  const regions = regionsFromLabels(labels);
  const g = engine.grid;
  for (let c = 0; c < g.cells; c++) if ((labels[c] < 0) !== (g.active[c] === 0)) return false;
  // connectivity of each region
  for (const r of regions) {
    const inR = new Set(r);
    const seen = new Set<number>([r[0]]);
    const stack = [r[0]];
    while (stack.length) {
      const c = stack.pop()!;
      for (const n of g.adj[c]) if (inR.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); }
    }
    if (seen.size !== r.length) return false;
  }
  return engine.rules.every((rule) => rule.check(g, labels, regions));
}
