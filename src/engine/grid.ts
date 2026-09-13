/**
 * Grid geometry. Cells are indexed `y * w + x` over the bounding rectangle;
 * some cells may be holes (inactive). Edges exist only between two active,
 * orthogonally adjacent cells and are numbered compactly — use `edgeBetween`
 * or `adjEdge` to find them, never a formula.
 *
 * The true puzzle state is the JOIN/WALL assignment of these edges; colours
 * in a UI are just a rendering of the connected components.
 */
export interface Grid {
  readonly w: number;
  readonly h: number;
  /** size of the index space (w*h), including holes */
  readonly cells: number;
  /** active[c] = 1 if the cell is part of the puzzle */
  readonly active: Uint8Array;
  readonly activeCount: number;
  readonly holes: readonly number[];
  readonly edges: number;
  /** edgeA[e], edgeB[e]: the two cells an edge separates (a < b). */
  readonly edgeA: Int32Array;
  readonly edgeB: Int32Array;
  /** adj[c]: active neighbouring cells of c; adjEdge[c][i] is the edge to adj[c][i]. */
  readonly adj: readonly (readonly number[])[];
  readonly adjEdge: readonly (readonly number[])[];
}

const cache = new Map<string, Grid>();

export function makeGrid(w: number, h: number, holes: readonly number[] = []): Grid {
  if (w < 1 || h < 1) throw new Error(`invalid grid ${w}x${h}`);
  const cells = w * h;
  const active = new Uint8Array(cells).fill(1);
  for (const c of holes) {
    if (!Number.isInteger(c) || c < 0 || c >= cells) throw new Error(`hole ${c} outside ${w}x${h}`);
    active[c] = 0;
  }
  const holeList = [...new Set(holes)].sort((a, b) => a - b);
  const key = holeList.length ? '' : `${w}x${h}`;
  if (key) {
    const hit = cache.get(key);
    if (hit) return hit;
  }
  let activeCount = 0;
  for (let c = 0; c < cells; c++) activeCount += active[c];
  const edgeA: number[] = [];
  const edgeB: number[] = [];
  const adj: number[][] = Array.from({ length: cells }, () => []);
  const adjEdge: number[][] = Array.from({ length: cells }, () => []);
  const link = (a: number, b: number) => {
    if (!active[a] || !active[b]) return;
    const e = edgeA.length;
    edgeA.push(a);
    edgeB.push(b);
    adj[a].push(b);
    adjEdge[a].push(e);
    adj[b].push(a);
    adjEdge[b].push(e);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = y * w + x;
      if (x < w - 1) link(c, c + 1);
      if (y < h - 1) link(c, c + w);
    }
  }
  const g: Grid = {
    w,
    h,
    cells,
    active,
    activeCount,
    holes: holeList,
    edges: edgeA.length,
    edgeA: Int32Array.from(edgeA),
    edgeB: Int32Array.from(edgeB),
    adj,
    adjEdge,
  };
  if (key) cache.set(key, g);
  return g;
}

export function cellAt(g: Grid, x: number, y: number): number {
  return y * g.w + x;
}

export function cellXY(g: Grid, c: number): [number, number] {
  return [c % g.w, Math.floor(c / g.w)];
}

/** Edge between two cells, or -1 if they are not adjacent active cells. */
export function edgeBetween(g: Grid, a: number, b: number): number {
  const n = g.adj[a];
  for (let i = 0; i < n.length; i++) if (n[i] === b) return g.adjEdge[a][i];
  return -1;
}

export function otherCell(g: Grid, e: number, c: number): number {
  return g.edgeA[e] === c ? g.edgeB[e] : g.edgeA[e];
}

/** True if the edge separates horizontally adjacent cells (a vertical line). */
export function isHorizontalEdge(g: Grid, e: number): boolean {
  return g.edgeB[e] === g.edgeA[e] + 1;
}

/** Active cells in scan order. */
export function activeCells(g: Grid): number[] {
  const out: number[] = [];
  for (let c = 0; c < g.cells; c++) if (g.active[c]) out.push(c);
  return out;
}
