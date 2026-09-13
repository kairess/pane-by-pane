import type { Grid } from '../grid.ts';
import { otherCell } from '../grid.ts';
import { JOIN, UNKNOWN, WALL, type Comp, type Placement, type State } from '../state.ts';
import { keyOrientations, shapeSize, type ShapeKey } from '../shape.ts';
import type { Deduction, Rule } from './rule.ts';

/**
 * Deductions shared by every rule. They only look at component facts
 * (bounds, shape candidates) plus the rules' conflict hooks, so any rule that
 * narrows facts gets these for free.
 *
 * Tiers:
 *   1 size-full        component reached its max area → remaining edges are walls
 *   1 closed-shape     closed component's shape is now a fact (feeds Gemini/Delta)
 *   2 merge-conflict   two touching components can never be one region → wall
 *   2 forced-exit      component must grow and has a single way out → join
 *   3 reach            component cannot reach enough cells (contradiction), or
 *                      exactly enough → everything reachable joins
 *   3 shape-place      enumerate placements of allowed shapes; cells in every
 *                      placement join, cells in none are walled off
 */
export class CoreRule implements Rule {
  readonly kind = 'core';
  private rules: Rule[];
  constructor(rules: Rule[]) {
    this.rules = rules;
  }

  init(): boolean {
    return true;
  }

  check(): boolean {
    return true;
  }

  /**
   * Pair-conflict cache for the current propagation round. Conflicts are
   * monotone (once two components can never merge, that stays true), so a
   * stale "no conflict" inside one round can only cost a deduction, never
   * produce a wrong one.
   */
  private conflictCache = new Map<number, boolean>();

  private conflict(state: State, A: Comp, B: Comp): boolean {
    const key = A.id < B.id ? A.id * state.grid.cells + B.id : B.id * state.grid.cells + A.id;
    const hit = this.conflictCache.get(key);
    if (hit !== undefined) return hit;
    let c = state.mergeConflict(A, B);
    if (!c) for (const r of this.rules) if (r.mergeConflict && r.mergeConflict(state, A, B)) { c = true; break; }
    this.conflictCache.set(key, c);
    return c;
  }

  propagate(state: State, out: Deduction[]): boolean {
    this.conflictCache.clear();
    const g = state.grid;
    const seenEdge = new Uint8Array(g.edges);
    const push = (edge: number, value: 1 | 2, technique: string, tier: number) => {
      if (seenEdge[edge]) return;
      seenEdge[edge] = 1;
      out.push({ edge, value, technique, tier });
    };

    for (const comp of state.comps.values()) {
      const size = comp.cells.length;
      const open = state.openEdges(comp);
      const closed = open.length === 0;

      if (closed) {
        if (size < comp.lo) return false;
        const k = state.shapeOf(comp);
        if (comp.notShapes.has(k)) return false;
        if (!state.restrictShapes(comp, [k])) return false;
        if (!state.narrow(comp, size, size)) return false;
        continue;
      }

      // Shape candidates imply area bounds.
      if (comp.shapes) {
        let lo = Infinity;
        let hi = 0;
        for (const k of comp.shapes) {
          const n = shapeSize(k);
          if (n < lo) lo = n;
          if (n > hi) hi = n;
        }
        if (!state.narrow(comp, lo, hi)) return false;
      }

      if (size === comp.hi) {
        for (const e of open) push(e, WALL, 'size-full', 1);
        continue;
      }

      // Walls to components we can never join.
      let exits = 0;
      let lastExit = -1;
      for (const e of open) {
        const mine = otherEnd(state, e, comp);
        const other = state.comps.get(state.compOf[otherCell(g, e, mine)])!;
        if (this.conflict(state, comp, other)) push(e, WALL, 'merge-conflict', 2);
        else {
          exits++;
          lastExit = e;
        }
      }

      let mustGrow = size < comp.lo;
      if (!mustGrow && comp.shapes !== null) {
        let sameSize = false;
        for (const k of comp.shapes) if (shapeSize(k) === size) { sameSize = true; break; }
        mustGrow = !sameSize || !comp.shapes.has(state.shapeOf(comp));
      }
      if (mustGrow) {
        if (exits === 0) return false;
        if (exits === 1) push(lastExit, JOIN, 'forced-exit', 2);
      }

      // Reachability: how many cells could this component possibly absorb?
      // (only matters while it still has to grow; the search stops as soon
      // as more than `lo` cells are reachable, since then nothing follows)
      if (size < comp.lo) {
        const reach = this.reachable(state, comp, comp.lo);
        if (reach.count < comp.lo) return false;
        if (reach.count === comp.lo) {
          for (let e = 0; e < g.edges; e++) {
            if (state.edge[e] === UNKNOWN && reach.mark[g.edgeA[e]] && reach.mark[g.edgeB[e]]) push(e, JOIN, 'reach-exact', 3);
          }
        }
      }

      if (comp.shapes) {
        if (!this.placements(state, comp, push)) return false;
      }
    }
    return true;
  }

  /**
   * Cells `comp` could still absorb: reachable through non-WALL edges via
   * compatible components, within the area budget. Absorbing a component
   * costs its whole size, so a cell that needs a long path is out of reach
   * of a small region (Dijkstra over components with cost = component size).
   */
  private reachable(state: State, comp: Comp, enough: number): { count: number; mark: Uint8Array } {
    const g = state.grid;
    const mark = new Uint8Array(g.cells);
    const budget = comp.hi - comp.cells.length;
    const cost = new Map<number, number>([[comp.id, 0]]);
    const done = new Set<number>();
    const queue: Comp[] = [comp];
    for (const c of comp.cells) mark[c] = 1;
    let count = comp.cells.length;
    while (queue.length) {
      // pick the cheapest pending component
      let bi = 0;
      for (let i = 1; i < queue.length; i++) if (cost.get(queue[i].id)! < cost.get(queue[bi].id)!) bi = i;
      const cur = queue.splice(bi, 1)[0];
      if (done.has(cur.id)) continue;
      done.add(cur.id);
      const base = cost.get(cur.id)!;
      for (const c of cur.cells) {
        const es = g.adjEdge[c];
        for (let i = 0; i < es.length; i++) {
          const e = es[i];
          if (state.edge[e] === WALL) continue;
          const oc = state.comps.get(state.compOf[otherCell(g, e, c)])!;
          if (oc.id === cur.id || done.has(oc.id)) continue;
          const nc = base + oc.cells.length;
          if (nc > budget) continue;
          const prev = cost.get(oc.id);
          if (prev !== undefined && prev <= nc) continue;
          if (prev === undefined) {
            if (this.conflict(state, comp, oc)) {
              done.add(oc.id);
              continue;
            }
            for (const cc of oc.cells) mark[cc] = 1;
            count += oc.cells.length;
            if (count > enough) return { count, mark };
          }
          cost.set(oc.id, nc);
          queue.push(oc);
        }
      }
    }
    return { count, mark };
  }

  /**
   * Enumerate every placement of every allowed shape that could be the final
   * region of `comp`. Deduce joins/walls from the intersection/union.
   * The viable list is cached on the component and only filtered afterwards.
   */
  private placements(state: State, comp: Comp, push: (e: number, v: 1 | 2, t: string, tier: number) => void): boolean {
    const g = state.grid;
    const scratch = scratchFor(g);
    const { inComp, inside, unionMark, interCount } = scratch;
    inComp.fill(0);
    unionMark.fill(0);
    interCount.fill(0);
    for (const c of comp.cells) inComp[c] = 1;

    const viableShapes = new Set<ShapeKey>();
    const viable: Placement[] = [];
    const consider = (key: string, cells: readonly number[]) => {
      const stamp = ++scratch.stamp;
      if (!this.placementOk(state, comp, cells, inComp, inside, stamp)) return;
      viable.push({ key, cells });
      viableShapes.add(key);
      for (const c of cells) {
        unionMark[c] = 1;
        interCount[c]++;
      }
    };

    if (comp.plc) {
      for (const p of comp.plc) {
        if (!comp.shapes!.has(p.key) || comp.notShapes.has(p.key)) continue;
        consider(p.key, p.cells);
      }
    } else {
      const anchor = comp.cells[0];
      const ax = anchor % g.w;
      const ay = (anchor - ax) / g.w;
      for (const key of comp.shapes!) {
        if (comp.notShapes.has(key)) continue;
        const n = shapeSize(key);
        if (n < comp.lo || n > comp.hi) continue;
        for (const t of placementTable(g, key)) {
          if (ax + t.minDx < 0 || ax + t.maxDx >= g.w || ay + t.minDy < 0 || ay + t.maxDy >= g.h) continue;
          consider(key, t.offsets.map((o) => o + anchor));
        }
      }
    }
    const count = viable.length;
    if (count === 0) return false;
    comp.plc = viable;
    if (!state.restrictShapes(comp, viableShapes)) return false;

    for (const c of comp.cells) {
      const es = g.adjEdge[c];
      for (let i = 0; i < es.length; i++) {
        const e = es[i];
        if (state.edge[e] !== UNKNOWN) continue;
        const o = otherCell(g, e, c);
        if (interCount[o] === count) push(e, JOIN, 'shape-place', 3);
        else if (!unionMark[o]) push(e, WALL, 'shape-place', 3);
      }
    }
    // Cells in every placement but not yet in the component: edges between
    // two such cells are joins too.
    for (let e = 0; e < g.edges; e++) {
      if (state.edge[e] !== UNKNOWN) continue;
      if (interCount[g.edgeA[e]] === count && interCount[g.edgeB[e]] === count) push(e, JOIN, 'shape-place', 3);
    }
    return true;
  }

  private placementOk(state: State, comp: Comp, cells: readonly number[], inComp: Uint8Array, inside: Int32Array, stamp: number): boolean {
    const g = state.grid;
    let covered = 0;
    for (const c of cells) {
      if (!g.active[c]) return false;
      inside[c] = stamp;
      if (inComp[c]) covered++;
    }
    if (covered !== comp.cells.length) return false;
    const n = cells.length;
    for (const c of cells) {
      const es = g.adjEdge[c];
      for (let i = 0; i < es.length; i++) {
        const e = es[i];
        const v = state.edge[e];
        if (v === UNKNOWN) continue;
        const o = otherCell(g, e, c);
        if (inside[o] === stamp) {
          if (v === WALL) return false;
        } else if (v === JOIN) return false;
      }
    }
    let touched: number[] | null = null;
    for (const c of cells) {
      const oc = state.compOf[c];
      if (oc === comp.id) continue;
      if (touched && touched.includes(oc)) continue;
      (touched ??= []).push(oc);
      const other = state.comps.get(oc)!;
      if (n < other.lo || n > other.hi) return false;
      if (this.conflict(state, comp, other)) return false;
    }
    for (const r of this.rules) if (r.placementConflict && r.placementConflict(state, comp, cells, inside, stamp)) return false;
    return true;
  }
}

/** Per-grid scratch buffers for placement enumeration. */
interface Scratch {
  inComp: Uint8Array;
  inside: Int32Array;
  unionMark: Uint8Array;
  interCount: Int32Array;
  stamp: number;
}
const scratchCache = new WeakMap<Grid, Scratch>();
function scratchFor(g: Grid): Scratch {
  let s = scratchCache.get(g);
  if (!s) {
    s = { inComp: new Uint8Array(g.cells), inside: new Int32Array(g.cells), unionMark: new Uint8Array(g.cells), interCount: new Int32Array(g.cells), stamp: 0 };
    scratchCache.set(g, s);
  }
  return s;
}

/**
 * Every way to place a shape so that one of its cells lands on the anchor:
 * cell offsets (relative to the anchor index) plus the bounding box needed
 * for the bounds check.
 */
interface PlacementTemplate {
  offsets: number[];
  minDx: number;
  maxDx: number;
  minDy: number;
  maxDy: number;
}
const tableCache = new WeakMap<Grid, Map<ShapeKey, PlacementTemplate[]>>();
function placementTable(g: Grid, key: ShapeKey): PlacementTemplate[] {
  let byKey = tableCache.get(g);
  if (!byKey) {
    byKey = new Map();
    tableCache.set(g, byKey);
  }
  let t = byKey.get(key);
  if (t) return t;
  t = [];
  for (const orient of keyOrientations(key)) {
    for (let i = 0; i < orient.length; i++) {
      const [ox, oy] = orient[i];
      let minDx = 0;
      let maxDx = 0;
      let minDy = 0;
      let maxDy = 0;
      const offsets: number[] = [];
      for (const [x, y] of orient) {
        const dx = x - ox;
        const dy = y - oy;
        offsets.push(dy * g.w + dx);
        if (dx < minDx) minDx = dx;
        if (dx > maxDx) maxDx = dx;
        if (dy < minDy) minDy = dy;
        if (dy > maxDy) maxDy = dy;
      }
      t.push({ offsets, minDx, maxDx, minDy, maxDy });
    }
  }
  byKey.set(key, t);
  return t;
}

function otherEnd(state: State, e: number, comp: Comp): number {
  const g = state.grid;
  return state.compOf[g.edgeA[e]] === comp.id ? g.edgeA[e] : g.edgeB[e];
}
