import type { Rng } from '../random.ts';

/**
 * Random "nice" irregular boards: a rectangle with some cells removed.
 *
 * Niceness rules (so boards look designed, not random):
 *   - symmetric under left-right and/or top-bottom mirroring
 *   - the active cells stay connected
 *   - no dead ends: every active cell keeps at least 2 active neighbours
 *   - cells are only removed from the outside in (notches, cut corners),
 *     plus optionally one symmetric interior hole
 *   - finally a few asymmetric tweaks (a cell punched out or restored) so
 *     boards are not all mirror images — the original game's boards mostly
 *     are not perfectly symmetric
 */
export type Symmetry = 'lr' | 'tb' | 'both';

export interface MaskOptions {
  /** fraction of cells to remove (default: random in 0.08..0.22) */
  ratio?: number;
  /** which symmetry to enforce (default: random) */
  symmetry?: Symmetry;
  /** allow one interior hole (default true) */
  interiorHole?: boolean;
  /** asymmetric tweaks applied after the symmetric base (default: random 0..3) */
  asymmetry?: number;
}

/** Returns the list of hole cells (indices `y*w+x`). */
export function randomMask(w: number, h: number, rng: Rng, opt: MaskOptions = {}): number[] {
  const ratio = opt.ratio ?? 0.08 + rng.next() * 0.14;
  const symmetry: Symmetry = opt.symmetry ?? rng.pick<Symmetry>(['lr', 'tb', 'both', 'both']);
  const cells = w * h;
  const active = new Uint8Array(cells).fill(1);
  const target = Math.round(cells * ratio);
  let removed = 0;

  const idx = (x: number, y: number) => y * w + x;
  const orbit = (c: number): number[] => {
    const x = c % w;
    const y = (c - x) / w;
    const set = new Set<number>([c]);
    if (symmetry === 'lr' || symmetry === 'both') set.add(idx(w - 1 - x, y));
    if (symmetry === 'tb' || symmetry === 'both') set.add(idx(x, h - 1 - y));
    if (symmetry === 'both') set.add(idx(w - 1 - x, h - 1 - y));
    return [...set];
  };
  const neighbours = (c: number): number[] => {
    const x = c % w;
    const y = (c - x) / w;
    const out: number[] = [];
    if (x > 0) out.push(c - 1);
    if (x < w - 1) out.push(c + 1);
    if (y > 0) out.push(c - w);
    if (y < h - 1) out.push(c + w);
    return out;
  };
  const outsideSides = (c: number): number => 4 - neighbours(c).filter((n) => active[n]).length;

  const tryRemove = (c: number): boolean => {
    const orb = orbit(c);
    if (orb.some((o) => !active[o])) return false;
    if (removed + orb.length > target + 1) return false;
    for (const o of orb) active[o] = 0;
    if (isNice(w, h, active)) {
      removed += orb.length;
      return true;
    }
    for (const o of orb) active[o] = 1;
    return false;
  };

  // Optional interior hole first (it needs room).
  if ((opt.interiorHole ?? true) && cells >= 30 && rng.chance(0.5)) {
    const interior: number[] = [];
    for (let c = 0; c < cells; c++) {
      const x = c % w;
      const y = (c - x) / w;
      if (x > 0 && y > 0 && x < w - 1 && y < h - 1 && outsideSides(c) === 0) interior.push(c);
    }
    for (let t = 0; t < 10 && interior.length; t++) if (tryRemove(rng.pick(interior))) break;
  }

  // Erode from the outside, preferring corner-like cells.
  for (let t = 0; t < 200 && removed < target; t++) {
    const candidates: number[] = [];
    for (let c = 0; c < cells; c++) {
      if (!active[c]) continue;
      const sides = outsideSides(c);
      if (sides === 0) continue;
      candidates.push(c);
      if (sides >= 2) candidates.push(c, c); // weight corners ×3
    }
    if (!candidates.length) break;
    tryRemove(rng.pick(candidates));
  }

  // Asymmetric tweaks: punch a single cell (edge or interior) or restore a
  // removed cell, keeping the board nice. Each tweak breaks the mirror symmetry
  // locally, which is what makes boards look designed rather than stamped.
  const tweaks = opt.asymmetry ?? rng.int(4);
  for (let t = 0, done = 0; t < 40 && done < tweaks; t++) {
    if (rng.chance(0.5)) {
      const c = rng.int(cells);
      if (!active[c] || removed >= cells * 0.35) continue;
      active[c] = 0;
      if (isNice(w, h, active)) {
        removed++;
        done++;
      } else active[c] = 1;
    } else {
      const c = rng.int(cells);
      if (active[c] || !neighbours(c).some((n) => active[n])) continue;
      active[c] = 1;
      if (isNice(w, h, active)) {
        removed--;
        done++;
      } else active[c] = 0;
    }
  }

  const holes: number[] = [];
  for (let c = 0; c < cells; c++) if (!active[c]) holes.push(c);
  return holes;
}

/** Connected, and every active cell has at least two active neighbours. */
export function isNice(w: number, h: number, active: Uint8Array): boolean {
  const cells = w * h;
  let start = -1;
  let count = 0;
  for (let c = 0; c < cells; c++) {
    if (!active[c]) continue;
    count++;
    if (start < 0) start = c;
    const x = c % w;
    let n = 0;
    if (x > 0 && active[c - 1]) n++;
    if (x < w - 1 && active[c + 1]) n++;
    if (c >= w && active[c - w]) n++;
    if (c + w < cells && active[c + w]) n++;
    if (n < 2) return false;
  }
  if (count === 0) return false;
  const seen = new Uint8Array(cells);
  const stack = [start];
  seen[start] = 1;
  let reached = 0;
  while (stack.length) {
    const c = stack.pop()!;
    reached++;
    const x = c % w;
    const nb = [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, c - w, c + w];
    for (const n of nb) {
      if (n < 0 || n >= cells || !active[n] || seen[n]) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }
  return reached === count;
}
