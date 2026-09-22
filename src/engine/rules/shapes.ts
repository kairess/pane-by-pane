import type { Grid } from '../grid.ts';
import { edgeBetween } from '../grid.ts';
import { allPolyominoes, canonical, isRectangleKey, parseKey, regionKey, shapeSize, type ShapeKey } from '../shape.ts';
import { WALL, type Comp, type State } from '../state.ts';
import type { DeltaClue, GeminiClue, Labels, PolyominoClue, ShapeBankClue } from '../types.ts';
import { JOIN, UNKNOWN } from '../state.ts';
import type { Deduction, RegionSizes, Rule } from './rule.ts';

/** Shape Bank: every region's free-polyomino shape is in the bank. */
export class ShapeBankRule implements Rule {
  readonly kind = 'shapeBank';
  readonly bank: Set<ShapeKey>;
  constructor(clues: ShapeBankClue[]) {
    // Several bank clues intersect.
    let bank: Set<ShapeKey> | null = null;
    for (const c of clues) {
      const s = new Set<ShapeKey>(c.shapes.map((k) => canonical(parseKey(k))));
      if (bank === null) {
        bank = s;
      } else {
        const prev: Set<ShapeKey> = bank;
        bank = new Set<ShapeKey>([...prev].filter((k) => s.has(k)));
      }
    }
    this.bank = bank ?? new Set<ShapeKey>();
  }

  init(state: State): boolean {
    for (const comp of state.comps.values()) if (!state.restrictShapes(comp, this.bank)) return false;
    return true;
  }

  propagate(): boolean {
    return true;
  }

  regionSizes(): RegionSizes {
    return { sizes: [...new Set([...this.bank].map(shapeSize))] };
  }

  check(g: Grid, _labels: Labels, regions: number[][]): boolean {
    return regions.every((r) => this.bank.has(regionKey(g.w, r)));
  }
}

/** Polyomino: the region containing the clue cell has exactly the given shape. */
export class PolyominoRule implements Rule {
  readonly kind = 'polyomino';
  private clues: PolyominoClue[];
  constructor(clues: PolyominoClue[]) {
    this.clues = clues.map((c) => ({ ...c, shape: canonical(parseKey(c.shape)) }));
  }

  init(state: State): boolean {
    for (const c of this.clues) if (!state.restrictShapes(state.comp(c.cell), [c.shape])) return false;
    return true;
  }

  propagate(): boolean {
    return true;
  }

  check(g: Grid, labels: Labels, regions: number[][]): boolean {
    return this.clues.every((c) => regionKey(g.w, regions[labels[c.cell]]) === c.shape);
  }
}

/**
 * Gemini (same shape) and Delta (different shape) markers on an edge. The
 * marked edge is always a border. Facts flow between the two sides:
 *   Gemini: bounds and shape candidates are shared (intersected).
 *   Delta:  once one side is pinned to a single shape, the other excludes it.
 */
export class PairShapeRule implements Rule {
  readonly kind: 'gemini' | 'delta';
  private edges: number[];

  constructor(kind: 'gemini' | 'delta', clues: (GeminiClue | DeltaClue)[], grid: Grid) {
    this.kind = kind;
    this.edges = clues.map((c) => {
      const e = edgeBetween(grid, c.edge.a, c.edge.b);
      if (e < 0) throw new Error(`${kind} clue on non-adjacent cells ${c.edge.a},${c.edge.b}`);
      return e;
    });
  }

  init(state: State, out: Deduction[]): boolean {
    for (const e of this.edges) out.push({ edge: e, value: WALL, technique: 'marker-wall', tier: 1 });
    return true;
  }

  private sides(state: State, e: number): [Comp, Comp] {
    const g = state.grid;
    return [state.comp(g.edgeA[e]), state.comp(g.edgeB[e])];
  }

  propagate(state: State): boolean {
    for (const e of this.edges) {
      const [A, B] = this.sides(state, e);
      if (A === B) return false;
      if (this.kind === 'gemini') {
        const lo = Math.max(A.lo, B.lo);
        const hi = Math.min(A.hi, B.hi);
        if (!state.narrow(A, lo, hi) || !state.narrow(B, lo, hi)) return false;
        for (const k of A.notShapes) if (!state.excludeShape(B, k)) return false;
        for (const k of B.notShapes) if (!state.excludeShape(A, k)) return false;
        if (A.shapes && !state.restrictShapes(B, A.shapes)) return false;
        if (B.shapes && !state.restrictShapes(A, B.shapes)) return false;
      } else {
        if (A.shapes?.size === 1) for (const k of A.shapes) if (!state.excludeShape(B, k)) return false;
        if (B.shapes?.size === 1) for (const k of B.shapes) if (!state.excludeShape(A, k)) return false;
      }
    }
    return true;
  }

  placementConflict(state: State, _base: Comp, cells: readonly number[], inside: Int32Array, stamp: number): boolean {
    const g = state.grid;
    const n = cells.length;
    for (const e of this.edges) {
      const a = g.edgeA[e];
      const b = g.edgeB[e];
      const ia = inside[a] === stamp;
      const ib = inside[b] === stamp;
      if (ia && ib) return true;
      if (!ia && !ib) continue;
      const other = state.comp(ia ? b : a);
      if (this.kind === 'gemini') {
        if (n < other.lo || n > other.hi) return true;
        if (other.shapes || other.notShapes.size) {
          const k = regionKey(g.w, cells);
          if (other.notShapes.has(k)) return true;
          if (other.shapes && !other.shapes.has(k)) return true;
        }
      } else if (other.shapes?.size === 1) {
        const k = regionKey(g.w, cells);
        if (other.shapes.has(k)) return true;
      }
    }
    return false;
  }

  check(g: Grid, labels: Labels, regions: number[][]): boolean {
    for (const e of this.edges) {
      const a = labels[g.edgeA[e]];
      const b = labels[g.edgeB[e]];
      if (a === b) return false;
      const same = regionKey(g.w, regions[a]) === regionKey(g.w, regions[b]);
      if (same !== (this.kind === 'gemini')) return false;
    }
    return true;
  }
}

/**
 * Mingle Shape: bordering regions have different shapes, Delta on every
 * border. Once a region's shape is pinned, every region across a wall from it
 * excludes that shape; a candidate placement is rejected when a pinned
 * component outside it touches it (they will share a border).
 */
export class MingleRule implements Rule {
  readonly kind = 'mingle';

  init(): boolean {
    return true;
  }

  private pinned(c: Comp): ShapeKey | null {
    if (c.shapes?.size === 1) for (const k of c.shapes) return k;
    return null;
  }

  propagate(state: State): boolean {
    for (const comp of state.comps.values()) {
      const k = this.pinned(comp);
      if (k === null) continue;
      for (const nb of state.wallNeighbours(comp)) if (!state.excludeShape(nb, k)) return false;
    }
    return true;
  }

  placementConflict(state: State, base: Comp, cells: readonly number[], inside: Int32Array, stamp: number): boolean {
    const g = state.grid;
    let key: ShapeKey | null = null;
    for (const c of cells) {
      const es = g.adjEdge[c];
      for (let i = 0; i < es.length; i++) {
        const o = g.adj[c][i];
        if (inside[o] === stamp) continue;
        const oc = state.comp(o);
        if (oc === base) continue;
        const k = this.pinned(oc);
        if (k === null) continue;
        key ??= regionKey(g.w, cells);
        if (k === key && state.edge[es[i]] !== UNKNOWN) return true;
        // an unknown edge to a same-shaped pinned component: joining is a different question, but the
        // placement excludes the outside cell, so the edge would be a border and the shapes would clash
        if (k === key) return true;
      }
    }
    return false;
  }

  check(g: Grid, labels: Labels, regions: number[][]): boolean {
    const keys = regions.map((r) => regionKey(g.w, r));
    for (let e = 0; e < g.edges; e++) {
      const a = labels[g.edgeA[e]];
      const b = labels[g.edgeB[e]];
      if (a !== b && keys[a] === keys[b]) return false;
    }
    return true;
  }
}

/**
 * Match: every region has the same shape, so every region has the same area.
 * Any component pinned to one shape pins them all, and the area bounds of all
 * components are one interval.
 */
export class MatchRule implements Rule {
  readonly kind = 'match';

  init(): boolean {
    return true;
  }

  propagate(state: State): boolean {
    let lo = 1;
    let hi = Infinity;
    let pinned: ShapeKey | null = null;
    for (const comp of state.comps.values()) {
      if (comp.lo > lo) lo = comp.lo;
      if (comp.hi < hi) hi = comp.hi;
      if (comp.shapes?.size === 1) for (const k of comp.shapes) pinned = k;
    }
    for (const comp of state.comps.values()) {
      if (!state.narrow(comp, lo, hi)) return false;
      if (pinned !== null && !state.restrictShapes(comp, [pinned])) return false;
    }
    return true;
  }

  placementConflict(state: State, base: Comp, cells: readonly number[]): boolean {
    const key = regionKey(state.grid.w, cells);
    for (const comp of state.comps.values()) {
      if (comp === base) continue;
      if (cells.length < comp.lo || cells.length > comp.hi) return true;
      if (comp.shapes?.size === 1 && !comp.shapes.has(key)) return true;
    }
    return false;
  }

  check(g: Grid, _labels: Labels, regions: number[][]): boolean {
    const keys = regions.map((r) => regionKey(g.w, r));
    return keys.every((k) => k === keys[0]);
  }
}

/**
 * Mismatch: no two regions share a shape. A shape one component is pinned to
 * is excluded from every other. The original's Mismatch-only windows rest on
 * counting: once every polyomino of up to m cells is taken by a finished
 * region, a walled-off pocket of up to 2m+1 cells cannot be cut in two (one
 * piece would have at most m cells and repeat a taken shape), so it joins
 * (`mismatch-count`, tier 2).
 */
export class MismatchRule implements Rule {
  readonly kind = 'mismatch';
  /** with Boxy, the inventory of shapes is the rectangles only */
  private rectangles: boolean;
  constructor(rectangles = false) {
    this.rectangles = rectangles;
  }

  private inventory(m: number): number {
    const all = allPolyominoes(m);
    return this.rectangles ? all.filter(isRectangleKey).length : all.length;
  }

  init(): boolean {
    return true;
  }

  /** Pocket id per cell: cells joined through non-wall edges (components that could still become one region). */
  private pockets(state: State): { pocketOf: Int32Array; sizes: number[]; inner: number[][] } {
    const g = state.grid;
    const pocketOf = new Int32Array(g.cells).fill(-1);
    const sizes: number[] = [];
    const inner: number[][] = [];
    for (let start = 0; start < g.cells; start++) {
      if (!g.active[start] || pocketOf[start] >= 0) continue;
      const id = sizes.length;
      const cells: number[] = [start];
      const edges: number[] = [];
      pocketOf[start] = id;
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        const es = g.adjEdge[c];
        for (let j = 0; j < es.length; j++) {
          const e = es[j];
          if (state.edge[e] === WALL) continue;
          if (state.edge[e] === UNKNOWN && g.adj[c][j] > c) edges.push(e);
          const o = g.adj[c][j];
          if (pocketOf[o] < 0) {
            pocketOf[o] = id;
            cells.push(o);
          }
        }
      }
      sizes.push(cells.length);
      inner.push(edges);
    }
    return { pocketOf, sizes, inner };
  }

  propagate(state: State, out: Deduction[]): boolean {
    const { pocketOf, sizes, inner } = this.pockets(state);
    // pinned components: a single allowed shape, or closed
    const pinned = new Map<number, ShapeKey>(); // comp id → shape
    const byShape = new Map<ShapeKey, number>();
    for (const comp of state.comps.values()) {
      let k: ShapeKey | null = null;
      if (comp.shapes?.size === 1) for (const s of comp.shapes) k = s;
      else if (state.isClosed(comp)) k = state.shapeOf(comp);
      if (k === null) continue;
      const other = byShape.get(k);
      // two pinned components of one shape in different pockets can never be one region
      if (other !== undefined && pocketOf[state.comps.get(other)!.cells[0]] !== pocketOf[comp.cells[0]]) return false;
      pinned.set(comp.id, k);
      byShape.set(k, comp.id);
    }
    if (pinned.size === 0) return true;
    // a pinned shape is excluded from every component in another pocket (those can never join it)
    for (const [id, k] of pinned) {
      const pk = pocketOf[state.comps.get(id)!.cells[0]];
      for (const comp of state.comps.values()) {
        if (comp.id === id || pocketOf[comp.cells[0]] === pk) continue;
        if (!state.excludeShape(comp, k)) return false;
      }
    }
    // counting: a pocket cannot be cut when every shape a piece could take is already taken elsewhere
    const pinnedPocket = new Map<number, ShapeKey[]>();
    for (const [id, k] of pinned) {
      const pk = pocketOf[state.comps.get(id)!.cells[0]];
      (pinnedPocket.get(pk) ?? pinnedPocket.set(pk, []).get(pk)!).push(k);
    }
    for (let pk = 0; pk < sizes.length; pk++) {
      if (!inner[pk].length) continue;
      const own = pinnedPocket.get(pk) ?? [];
      // a component inside pinned to a smaller shape means the pocket will be cut
      if (own.some((k) => shapeSize(k) !== sizes[pk])) continue;
      const takenBySize = new Map<number, number>();
      for (const [id, k] of pinned) if (pocketOf[state.comps.get(id)!.cells[0]] !== pk) takenBySize.set(shapeSize(k), (takenBySize.get(shapeSize(k)) ?? 0) + 1);
      let m = 0;
      while (takenBySize.get(m + 1) === this.inventory(m + 1)) m++;
      // a cut leaves one piece of at most floor(n/2) cells, all of whose shapes are taken
      if (m > 0 && Math.floor(sizes[pk] / 2) <= m) for (const e of inner[pk]) out.push({ edge: e, value: JOIN, technique: 'mismatch-count', tier: 2 });
    }
    return true;
  }

  placementConflict(state: State, base: Comp, cells: readonly number[], inside: Int32Array, stamp: number): boolean {
    const key = regionKey(state.grid.w, cells);
    for (const comp of state.comps.values()) {
      if (comp === base || inside[comp.cells[0]] === stamp) continue;
      if (comp.shapes?.size === 1 && comp.shapes.has(key)) return true;
    }
    return false;
  }

  check(g: Grid, _labels: Labels, regions: number[][]): boolean {
    const keys = regions.map((r) => regionKey(g.w, r));
    return new Set(keys).size === keys.length;
  }
}
