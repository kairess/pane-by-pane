/**
 * Generation sweep: every rule set the web form allows, at several board
 * sizes, the two difficulty extremes, plain and masked boards. Prints one
 * line per run and a NONE count at the end; grep NONE / missed / the ms
 * column to find failures, target misses and slow cases.
 *
 *   node scripts/sweep.ts > sweep.log          (about 30-40 minutes)
 *   grep -E "NONE|missed" sweep.log
 *
 * To tell a regression from a pre-existing limit, run the same script from
 * an older checkout: `git archive <commit> | tar -x -C /tmp/old` and point
 * the import below at it (or run it there with `node scripts/sweep.ts`).
 */
import { generate } from '../src/engine/generator/generate.ts';
import type { RuleKind } from '../src/engine/types.ts';

const sets: RuleKind[][] = [
  ['areaNumber'], ['range'], ['shapeBank'], ['polyomino'], ['gemini', 'delta'], ['rose'], ['sizeSeparation'],
  ['areaNumber', 'rose'], ['rose', 'gemini', 'delta'], ['rose', 'sizeSeparation'], ['range', 'sizeSeparation'],
  ['polyomino', 'rose'], ['areaNumber', 'range', 'gemini', 'delta', 'rose'],
];
const sizes = (process.argv[2] ?? '4,7,9').split(',').map(Number);
let none = 0;
let runs = 0;
for (const n of sizes) {
  for (const rules of sets) {
    for (const stars of [[1, 1], [7, 7]] as const) {
      for (const mask of ['rect', 'symmetric'] as const) {
        for (const k of rules.includes('rose') ? [2, 4] : [2]) {
          const t0 = Date.now();
          const r = generate({ width: n, height: n, rules, roseSymbols: k, stars: [stars[0], stars[1]], mask, walls: mask === 'symmetric', seed: 1, attempts: 40 });
          runs++;
          if (!r) none++;
          const got = r ? `${r.analysis.stars}★${r.missed ? ' missed' : ''}` : 'NONE';
          console.log(`${n}x${n} ${rules.join('+').padEnd(40)} k=${k} ${stars[0]}-${stars[1]} ${mask.padEnd(9)} ${got.padEnd(10)} ${Date.now() - t0} ms`);
        }
      }
    }
  }
}
console.log(`done: ${runs} runs, NONE = ${none}`);
