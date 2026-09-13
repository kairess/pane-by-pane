/** Small seedable PRNG (mulberry32) so generation is reproducible. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** integer in [0, n) */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  /** integer in [lo, hi] inclusive */
  range(lo: number, hi: number): number {
    return lo + this.int(hi - lo + 1);
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  fork(): Rng {
    return new Rng(Math.floor(this.next() * 0xffffffff));
  }
}
