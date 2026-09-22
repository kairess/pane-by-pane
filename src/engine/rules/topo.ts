import type { Grid } from '../grid.ts';
import { edgeBetween, neighbourInDirection, vertexCells, vertexEdges } from '../grid.ts';
import { JOIN, UNKNOWN, WALL, type Comp, type State } from '../state.ts';
import type { Labels, PalisadeClue, WatchtowerClue } from '../types.ts';
import type { Deduction, Rule } from './rule.ts';

/**
 * Palisade: a tile shows which of its cell's four sides are borders. The
 * sides are facts from the start (tier 1); the difficulty of the original's
 * Palisade windows comes from reading several tiles together.
 */
export class PalisadeRule implements Rule {
  readonly kind = 'palisade';
  private clues: PalisadeClue[];
  constructor(clues: PalisadeClue[]) {
    this.clues = clues;
  }

  init(state: State, out: Deduction[]): boolean {
    const g = state.grid;
    for (const c of this.clues) {
      for (let dir = 0; dir < 4; dir++) {
        const n = neighbourInDirection(g, c.cell, dir);
        const wall = (c.sides >> dir) & 1;
        if (n < 0) {
          if (!wall) return false; // a side on the frame or a hole is always a border
          continue;
        }
        out.push({ edge: edgeBetween(g, c.cell, n), value: wall ? WALL : JOIN, technique: 'palisade', tier: 1 });
      }
    }
    return true;
  }

  propagate(): boolean {
    return true;
  }

  check(g: Grid, labels: Labels): boolean {
    for (const c of this.clues) {
      for (let dir = 0; dir < 4; dir++) {
        const n = neighbourInDirection(g, c.cell, dir);
        const wall = ((c.sides >> dir) & 1) === 1;
        if (n < 0 ? !wall : (labels[c.cell] !== labels[n]) !== wall) return false;
      }
    }
    return true;
  }
}

/** The (x, y) vertices of a grid, with the edges meeting at each. */
function allVertices(g: Grid): { x: number; y: number; edges: number[] }[] {
  const out: { x: number; y: number; edges: number[] }[] = [];
  for (let y = 0; y <= g.h; y++) {
    for (let x = 0; x <= g.w; x++) {
      const edges = vertexEdges(g, x, y);
      if (edges.length) out.push({ x, y, edges });
    }
  }
  return out;
}
const vertexCache = new WeakMap<Grid, { x: number; y: number; edges: number[] }[]>();
function vertices(g: Grid): { x: number; y: number; edges: number[] }[] {
  let v = vertexCache.get(g);
  if (!v) {
    v = allVertices(g);
    vertexCache.set(g, v);
  }
  return v;
}

/** Bricky: no vertex has four borders. Three borders at a vertex make the fourth edge a join. */
export class BrickyRule implements Rule {
  readonly kind = 'bricky';

  init(): boolean {
    return true;
  }

  propagate(state: State, out: Deduction[]): boolean {
    for (const v of vertices(state.grid)) {
      if (v.edges.length < 4) continue;
      let walls = 0;
      let unknown = -1;
      for (const e of v.edges) {
        if (state.edge[e] === WALL) walls++;
        else if (state.edge[e] === UNKNOWN) unknown = e;
      }
      if (walls === 4) return false;
      if (walls === 3 && unknown >= 0) out.push({ edge: unknown, value: JOIN, technique: 'bricky', tier: 1 });
    }
    return true;
  }

  check(g: Grid, labels: Labels): boolean {
    for (const v of vertices(g)) {
      if (v.edges.length < 4) continue;
      if (v.edges.every((e) => labels[g.edgeA[e]] !== labels[g.edgeB[e]])) return false;
    }
    return true;
  }
}

/**
 * Loopy: an even number of borders at every vertex (0, 2 or 4). Where all
 * but one edge of a vertex are known, the last one fixes the parity. At the
 * frame a vertex has a single edge, so no border may touch the frame.
 */
export class LoopyRule implements Rule {
  readonly kind = 'loopy';

  init(): boolean {
    return true;
  }

  propagate(state: State, out: Deduction[]): boolean {
    for (const v of vertices(state.grid)) {
      let walls = 0;
      let unknowns = 0;
      let last = -1;
      for (const e of v.edges) {
        if (state.edge[e] === WALL) walls++;
        else if (state.edge[e] === UNKNOWN) {
          unknowns++;
          last = e;
        }
      }
      if (unknowns === 0 && walls % 2 === 1) return false;
      if (unknowns === 1) out.push({ edge: last, value: walls % 2 === 1 ? WALL : JOIN, technique: 'loopy', tier: 1 });
    }
    return true;
  }

  check(g: Grid, labels: Labels): boolean {
    for (const v of vertices(g)) {
      let walls = 0;
      for (const e of v.edges) if (labels[g.edgeA[e]] !== labels[g.edgeB[e]]) walls++;
      if (walls % 2 === 1) return false;
    }
    return true;
  }
}

/**
 * Watchtower: the vertex touches exactly `count` regions. One region joins
 * all its cells; as many regions as cells walls them all off and keeps the
 * diagonal cells apart. In between, the components around the vertex can
 * only merge, so once they are down to `count` they must all stay separate.
 */
export class WatchtowerRule implements Rule {
  readonly kind = 'watchtower';
  private towers: { cells: number[]; edges: number[]; count: number }[];

  constructor(clues: WatchtowerClue[], grid: Grid) {
    this.towers = clues.map((c) => {
      const cells = vertexCells(grid, c.x, c.y).filter((x) => x >= 0);
      if (!Number.isInteger(c.count) || c.count < 1 || c.count > cells.length) throw new Error(`watchtower at ${c.x},${c.y} cannot see ${c.count} regions`);
      return { cells, edges: vertexEdges(grid, c.x, c.y), count: c.count };
    });
  }

  init(_state: State, out: Deduction[]): boolean {
    for (const t of this.towers) {
      if (t.count === 1) for (const e of t.edges) out.push({ edge: e, value: JOIN, technique: 'watchtower', tier: 1 });
      if (t.count === t.cells.length && t.count > 1) for (const e of t.edges) out.push({ edge: e, value: WALL, technique: 'watchtower', tier: 1 });
    }
    return true;
  }

  private distinct(state: State, t: { cells: number[] }): Set<number> {
    const ids = new Set<number>();
    for (const c of t.cells) ids.add(state.compOf[c]);
    return ids;
  }

  propagate(state: State): boolean {
    for (const t of this.towers) if (this.distinct(state, t).size < t.count) return false;
    return true;
  }

  mergeConflict(state: State, A: Comp, B: Comp): boolean {
    for (const t of this.towers) {
      const ids = this.distinct(state, t);
      if (ids.size === t.count && ids.has(A.id) && ids.has(B.id)) return true;
    }
    return false;
  }

  placementConflict(state: State, _base: Comp, cells: readonly number[], inside: Int32Array, stamp: number): boolean {
    for (const t of this.towers) {
      let k = 0;
      for (const c of t.cells) if (inside[c] === stamp) k++;
      if (k === 0) continue;
      if (t.count === 1 && k < t.cells.length) return true;
      if (k === t.cells.length && t.count > 1) return true;
      // the remaining cells outside the placement can give at most as many regions as they have cells
      if (1 + (t.cells.length - k) < t.count) return true;
      // components outside the placement that could not merge anyway: no cheap bound, left to the search
      void state;
    }
    return false;
  }

  check(_g: Grid, labels: Labels): boolean {
    for (const t of this.towers) if (new Set(t.cells.map((c) => labels[c])).size !== t.count) return false;
    return true;
  }
}
