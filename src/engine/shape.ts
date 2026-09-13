/**
 * Polyomino shapes. A shape is a set of integer points. Two shapes are the
 * same "free polyomino" if one can be rotated and/or reflected into the other
 * (the game treats rotations and reflections as equal for Shape Bank, Gemini,
 * Delta and Polyomino clues).
 *
 * `ShapeKey` is the canonical string of a free polyomino, e.g. "0,0;1,0;2,0;2,1".
 */
export type Pt = readonly [number, number];
export type ShapeKey = string;

export function normalize(pts: readonly Pt[]): Pt[] {
  let mx = Infinity;
  let my = Infinity;
  for (const [x, y] of pts) {
    if (x < mx) mx = x;
    if (y < my) my = y;
  }
  const out: Pt[] = pts.map(([x, y]) => [x - mx, y - my] as const);
  out.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return out;
}

/** Key of a fixed (already normalized) orientation. */
export function fixedKey(pts: readonly Pt[]): string {
  return normalize(pts)
    .map(([x, y]) => `${x},${y}`)
    .join(';');
}

const TRANSFORMS: ((p: Pt) => Pt)[] = [
  ([x, y]) => [x, y],
  ([x, y]) => [-y, x],
  ([x, y]) => [-x, -y],
  ([x, y]) => [y, -x],
  ([x, y]) => [-x, y],
  ([x, y]) => [y, x],
  ([x, y]) => [x, -y],
  ([x, y]) => [-y, -x],
];

/** Distinct orientations (rotations + reflections) of a shape, normalized. */
export function orientations(pts: readonly Pt[]): Pt[][] {
  const seen = new Map<string, Pt[]>();
  for (const t of TRANSFORMS) {
    const o = normalize(pts.map(t));
    seen.set(fixedKey(o), o);
  }
  return [...seen.values()];
}

const canonCache = new Map<string, ShapeKey>();

/** Canonical key of the free polyomino: lexicographically smallest orientation key. */
export function canonical(pts: readonly Pt[]): ShapeKey {
  const fk = fixedKey(pts);
  const hit = canonCache.get(fk);
  if (hit) return hit;
  let best: string | null = null;
  for (const o of orientations(pts)) {
    const k = fixedKey(o);
    if (best === null || k < best) best = k;
  }
  canonCache.set(fk, best!);
  return best!;
}

export function parseKey(key: string): Pt[] {
  return key.split(';').map((s) => {
    const [x, y] = s.split(',').map(Number);
    return [x, y] as const;
  });
}

const sizeCache = new Map<ShapeKey, number>();
export function shapeSize(key: ShapeKey): number {
  let n = sizeCache.get(key);
  if (n === undefined) {
    n = key.split(';').length;
    sizeCache.set(key, n);
  }
  return n;
}

const orientCache = new Map<ShapeKey, Pt[][]>();
export function keyOrientations(key: ShapeKey): Pt[][] {
  let o = orientCache.get(key);
  if (!o) {
    o = orientations(parseKey(key));
    orientCache.set(key, o);
  }
  return o;
}

export function isRectangleKey(key: ShapeKey): boolean {
  const pts = parseKey(key);
  let w = 0;
  let h = 0;
  for (const [x, y] of pts) {
    if (x + 1 > w) w = x + 1;
    if (y + 1 > h) h = y + 1;
  }
  return w * h === pts.length;
}

/** Cells of a grid region → shape points. */
export function cellsToPts(w: number, cells: readonly number[]): Pt[] {
  return cells.map((c) => [c % w, Math.floor(c / w)] as const);
}

export function regionKey(w: number, cells: readonly number[]): ShapeKey {
  return canonical(cellsToPts(w, cells));
}

// ---------------------------------------------------------------------------
// Names for small shapes, for display / readable JSON.

const NAMED: [string, string][] = [
  ['O1', '0,0'],
  ['I2', '0,0;1,0'],
  ['I3', '0,0;1,0;2,0'],
  ['L3', '0,0;1,0;0,1'],
  ['I4', '0,0;1,0;2,0;3,0'],
  ['O4', '0,0;1,0;0,1;1,1'],
  ['T4', '0,0;1,0;2,0;1,1'],
  ['L4', '0,0;1,0;2,0;0,1'],
  ['S4', '1,0;2,0;0,1;1,1'],
  ['F5', '1,0;2,0;0,1;1,1;1,2'],
  ['I5', '0,0;1,0;2,0;3,0;4,0'],
  ['L5', '0,0;1,0;2,0;3,0;0,1'],
  ['N5', '2,0;3,0;0,1;1,1;2,1'],
  ['P5', '0,0;1,0;0,1;1,1;0,2'],
  ['T5', '0,0;1,0;2,0;1,1;1,2'],
  ['U5', '0,0;2,0;0,1;1,1;2,1'],
  ['V5', '0,0;0,1;0,2;1,2;2,2'],
  ['W5', '0,0;0,1;1,1;1,2;2,2'],
  ['X5', '1,0;0,1;1,1;2,1;1,2'],
  ['Y5', '0,0;1,0;2,0;3,0;1,1'],
  ['Z5', '0,0;1,0;1,1;1,2;2,2'],
];

const nameByKey = new Map<ShapeKey, string>();
const keyByName = new Map<string, ShapeKey>();
for (const [name, k] of NAMED) {
  const ck = canonical(parseKey(k));
  nameByKey.set(ck, name);
  keyByName.set(name, ck);
}

/** Short name like "T4" or "L5"; unnamed shapes get "P<size>:<key>". */
export function shapeName(key: ShapeKey): string {
  return nameByKey.get(key) ?? `P${shapeSize(key)}:${key}`;
}

/** Inverse of shapeName; also accepts raw keys. */
export function shapeFromName(name: string): ShapeKey {
  const k = keyByName.get(name);
  if (k) return k;
  const m = /^P\d+:(.*)$/.exec(name);
  return canonical(parseKey(m ? m[1] : name));
}

export function shapeToAscii(key: ShapeKey): string[] {
  const pts = parseKey(key);
  let w = 0;
  let h = 0;
  for (const [x, y] of pts) {
    w = Math.max(w, x + 1);
    h = Math.max(h, y + 1);
  }
  const rows = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
  for (const [x, y] of pts) rows[y][x] = '#';
  return rows.map((r) => r.join(''));
}
