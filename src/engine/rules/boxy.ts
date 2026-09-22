import type { Grid } from '../grid.ts';
import { otherCell } from '../grid.ts';
import { isRectangleKey } from '../shape.ts';
import { JOIN, UNKNOWN, WALL, type Comp, type State } from '../state.ts';
import type { Labels } from '../types.ts';
import type { Deduction, RegionSizes, Rule } from './rule.ts';

/** Bounding box of a cell set. */
function bbox(w: number, cells: readonly number[]): { x0: number; x1: number; y0: number; y1: number } {
  let x0 = Infinity;
  let x1 = -1;
  let y0 = Infinity;
  let y1 = -1;
  for (const c of cells) {
    const x = c % w;
    const y = (c - x) / w;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, x1, y0, y1 };
}

export function isRectangle(w: number, cells: readonly number[]): boolean {
  const b = bbox(w, cells);
  return (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1) === cells.length;
}

/**
 * Cap on the rectangles enumerated for one component per round. A cell with
 * a loose upper bound could be part of hundreds of rectangles and the
 * enumeration would say nothing; a numbered or nearly full component has a
 * handful, and those are the telling ones.
 */
const MAX_RECTS = 60;

/**
 * Boxy: every region is a rectangle. A component's bounding box is part of
 * its final region, so every cell in the box joins (tier 1, `boxy-fill`);
 * the rectangles that could still be the final region are enumerated like
 * shape placements: cells in all of them join, cells in none are walled off.
 */
export class BoxyRule implements Rule {
  readonly kind = 'boxy';

  init(state: State): boolean {
    for (const comp of state.comps.values()) if (!this.dropNonRect(state, comp)) return false;
    return true;
  }

  private dropNonRect(state: State, comp: Comp): boolean {
    if (!comp.shapes) return true;
    for (const k of [...comp.shapes]) if (!isRectangleKey(k) && !state.excludeShape(comp, k)) return false;
    return true;
  }

  regionSizes(): RegionSizes {
    return {};
  }

  propagate(state: State, out: Deduction[]): boolean {
    const g = state.grid;
    for (const comp of state.comps.values()) {
      if (!this.dropNonRect(state, comp)) return false;
      const b = bbox(g.w, comp.cells);
      const area = (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1);
      if (!state.narrow(comp, area, comp.hi)) return false;
      if (area > comp.cells.length) {
        // fill the box
        for (let y = b.y0; y <= b.y1; y++) {
          for (let x = b.x0; x <= b.x1; x++) {
            const c = y * g.w + x;
            if (!g.active[c]) return false;
            const oc = state.comp(c);
            if (oc !== comp && state.mergeConflict(comp, oc)) return false;
            const es = g.adjEdge[c];
            for (let i = 0; i < es.length; i++) {
              const o = g.adj[c][i];
              const ox = o % g.w;
              const oy = (o - ox) / g.w;
              if (ox < b.x0 || ox > b.x1 || oy < b.y0 || oy > b.y1 || o < c) continue;
              const v = state.edge[es[i]];
              if (v === WALL) return false;
              if (v === UNKNOWN) out.push({ edge: es[i], value: JOIN, technique: 'boxy-fill', tier: 1 });
            }
          }
        }
        continue; // the box joins first; growth is judged next round
      }
      if (state.isClosed(comp) || comp.cells.length === comp.hi) continue;
      if (!this.rectangles(state, comp, b, out)) return false;
    }
    return true;
  }

  /** Enumerate the rectangles that could be the final region of a rectangular component. */
  private rectangles(state: State, comp: Comp, b: ReturnType<typeof bbox>, out: Deduction[]): boolean {
    const g = state.grid;
    const h = b.y1 - b.y0 + 1;
    const w = b.x1 - b.x0 + 1;
    // count the rectangles containing the box with an area in [lo, hi] before enumerating them
    const spans = (len: number, lo0: number, hi0: number, size: number) => Math.max(0, Math.min(lo0, size - len) - Math.max(0, hi0 - len + 1) + 1);
    let combos = 0;
    for (let rw = w; rw <= g.w && combos <= MAX_RECTS; rw++) {
      const cx = spans(rw, b.x0, b.x1, g.w);
      if (!cx) continue;
      for (let rh = h; rh <= g.h; rh++) {
        const area = rw * rh;
        if (area > comp.hi) break;
        if (area < comp.lo) continue;
        combos += cx * spans(rh, b.y0, b.y1, g.h);
      }
    }
    if (combos > MAX_RECTS) return true;
    const inter = new Int32Array(g.cells);
    const union = new Uint8Array(g.cells);
    let count = 0;
    for (let x0 = b.x0; x0 >= 0; x0--) {
      for (let x1 = b.x1; x1 < g.w; x1++) {
        const rw = x1 - x0 + 1;
        if (rw * h > comp.hi) break;
        for (let y0 = b.y0; y0 >= 0; y0--) {
          for (let y1 = b.y1; y1 < g.h; y1++) {
            const area = rw * (y1 - y0 + 1);
            if (area > comp.hi) break;
            if (area < comp.lo) continue;
            if (!this.rectOk(state, comp, x0, x1, y0, y1)) continue;
            count++;
            for (let y = y0; y <= y1; y++) {
              for (let x = x0; x <= x1; x++) {
                const c = y * g.w + x;
                union[c] = 1;
                inter[c]++;
              }
            }
          }
        }
      }
    }
    if (count === 0) return false;
    for (const c of comp.cells) {
      const es = g.adjEdge[c];
      for (let i = 0; i < es.length; i++) {
        if (state.edge[es[i]] !== UNKNOWN) continue;
        const o = g.adj[c][i];
        if (inter[o] === count) out.push({ edge: es[i], value: JOIN, technique: 'shape-place', tier: 3 });
        else if (!union[o]) out.push({ edge: es[i], value: WALL, technique: 'shape-place', tier: 3 });
      }
    }
    return true;
  }

  /** Could this rectangle be the final region of `comp`? */
  private rectOk(state: State, comp: Comp, x0: number, x1: number, y0: number, y1: number): boolean {
    const g = state.grid;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const c = y * g.w + x;
        if (!g.active[c]) return false;
        const oc = state.comp(c);
        if (oc !== comp) {
          if (state.mergeConflict(comp, oc)) return false;
          // the other component must lie entirely inside the rectangle
          for (const d of oc.cells) {
            const dx = d % g.w;
            const dy = (d - dx) / g.w;
            if (dx < x0 || dx > x1 || dy < y0 || dy > y1) return false;
          }
        }
        // no wall inside, no join across the boundary
        const es = g.adjEdge[c];
        for (let i = 0; i < es.length; i++) {
          const o = g.adj[c][i];
          const ox = o % g.w;
          const oy = (o - ox) / g.w;
          const inside = ox >= x0 && ox <= x1 && oy >= y0 && oy <= y1;
          const v = state.edge[es[i]];
          if (inside ? v === WALL : v === JOIN) return false;
        }
      }
    }
    return true;
  }

  mergeConflict(state: State, A: Comp, B: Comp): boolean {
    const g = state.grid;
    const a = bbox(g.w, A.cells);
    const b = bbox(g.w, B.cells);
    const x0 = Math.min(a.x0, b.x0);
    const x1 = Math.max(a.x1, b.x1);
    const y0 = Math.min(a.y0, b.y0);
    const y1 = Math.max(a.y1, b.y1);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > Math.min(A.hi, B.hi)) return true;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const c = y * g.w + x;
        if (!g.active[c]) return true;
        const es = g.adjEdge[c];
        for (let i = 0; i < es.length; i++) {
          const o = g.adj[c][i];
          if (o < c) continue;
          const ox = o % g.w;
          const oy = (o - ox) / g.w;
          if (ox >= x0 && ox <= x1 && oy >= y0 && oy <= y1 && state.edge[es[i]] === WALL) return true;
        }
      }
    }
    return false;
  }

  placementConflict(state: State, _base: Comp, cells: readonly number[]): boolean {
    return !isRectangle(state.grid.w, cells);
  }

  check(g: Grid, _labels: Labels, regions: number[][]): boolean {
    return regions.every((r) => isRectangle(g.w, r));
  }
}

/**
 * Non-Boxy: no region is a rectangle. Every region has at least three cells
 * (a single cell and a domino are rectangles); a component that is a
 * rectangle has to grow, so it cannot be closed, full, or out of exits.
 */
export class NonBoxyRule implements Rule {
  readonly kind = 'nonBoxy';

  init(state: State): boolean {
    for (const comp of state.comps.values()) {
      if (!state.narrow(comp, 3, comp.hi)) return false;
      if (!this.dropRect(state, comp)) return false;
    }
    return true;
  }

  private dropRect(state: State, comp: Comp): boolean {
    if (!comp.shapes) return true;
    for (const k of [...comp.shapes]) if (isRectangleKey(k) && !state.excludeShape(comp, k)) return false;
    return true;
  }

  regionSizes(): RegionSizes {
    return { lo: 3 };
  }

  propagate(state: State, out: Deduction[]): boolean {
    const g = state.grid;
    for (const comp of state.comps.values()) {
      if (!this.dropRect(state, comp)) return false;
      if (!isRectangle(g.w, comp.cells)) continue;
      // a rectangle must grow: at least one more cell
      if (!state.narrow(comp, comp.cells.length + 1, comp.hi)) return false;
      let exits = 0;
      let last = -1;
      for (const e of state.openEdges(comp)) {
        const c = state.compOf[g.edgeA[e]] === comp.id ? g.edgeA[e] : g.edgeB[e];
        const oc = state.comp(otherCell(g, e, c));
        if (state.mergeConflict(comp, oc)) continue;
        exits++;
        last = e;
      }
      if (exits === 0) return false;
      if (exits === 1) out.push({ edge: last, value: JOIN, technique: 'forced-exit', tier: 2 });
    }
    return true;
  }

  placementConflict(state: State, _base: Comp, cells: readonly number[]): boolean {
    return isRectangle(state.grid.w, cells);
  }

  check(g: Grid, _labels: Labels, regions: number[][]): boolean {
    return regions.every((r) => !isRectangle(g.w, r));
  }
}
