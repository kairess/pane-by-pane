#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { generate, type GenerateOptions } from './engine/generator/generate.ts';
import { solveLogically, TIER_NAMES } from './engine/logical.ts';
import { render, renderLabels } from './engine/render.ts';
import { shapeName } from './engine/shape.ts';
import { solve } from './engine/solver.ts';
import { RULE_KINDS, type Puzzle, type RuleKind } from './engine/types.ts';

const HELP = `pane-by-pane puzzle engine

  pbp gen   [options]          generate puzzles
  pbp solve <puzzle.json>      count solutions + logical analysis
  pbp batch [options]          generate many, print difficulty distribution

options (gen/batch):
  --size 6            square grid (or --w 6 --h 5)
  --rules a,b,c       ${RULE_KINDS.join(',')}
  --min 3 --max 6     region area bounds for the generated solution
                      (with shapeBank: filters catalogue shapes by cell count; default = whole catalogue)
  --bank 2            shape bank size (default: original game's 1-3 distribution)
  --decoys 1          extra unused shapes in the bank
  --rose 2            rose symbol kinds (1 = Solitude)
  --stars 2-5         accepted star range (1..7)
  --mask              irregular symmetric board (holes); --holes 0.15 fixes the fraction
  --symmetry lr|tb|both
  --asym 2            asymmetric tweaks after the symmetric base (default random 0-3)
  --walls [0.2]       fixed walls (board leading): fraction of the solution's borders (flag alone = random 0.1-0.3)
  --repairs 4         Shape Bank: max regions carved out of the board to force uniqueness (0 = off)
  --count 3           how many puzzles
  --seed 42           reproducible generation
  --attempts 200      solutions tried per puzzle
  --guess             allow puzzles that need deeper guessing
  --json out.json     also write puzzles as JSON
`;

function parseArgs(argv: string[]): { cmd: string; pos: string[]; flags: Record<string, string | true> } {
  const [cmd = 'help', ...rest] = argv;
  const pos: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = rest[i + 1];
      if (v !== undefined && !v.startsWith('--')) {
        flags[k] = v;
        i++;
      } else flags[k] = true;
    } else pos.push(a);
  }
  return { cmd, pos, flags };
}

function genOptions(flags: Record<string, string | true>): GenerateOptions {
  const num = (k: string, d: number) => (typeof flags[k] === 'string' ? Number(flags[k]) : d);
  const size = num('size', 6);
  const rules = (typeof flags.rules === 'string' ? flags.rules.split(',') : ['areaNumber', 'gemini', 'delta']) as RuleKind[];
  for (const r of rules) if (!RULE_KINDS.includes(r)) throw new Error(`unknown rule "${r}" (known: ${RULE_KINDS.join(', ')})`);
  let stars: [number, number] | undefined;
  if (typeof flags.stars === 'string') {
    const [a, b] = flags.stars.split('-').map(Number);
    stars = [a, b ?? a];
  }
  return {
    width: num('w', size),
    height: num('h', size),
    rules,
    minSize: num('min', 3),
    maxSize: num('max', 6),
    bankSize: typeof flags.bank === 'string' ? Number(flags.bank) : undefined,
    bankShapeSizes: typeof flags.min === 'string' || typeof flags.max === 'string' ? [num('min', 1), num('max', 99)] : undefined,
    bankDecoys: num('decoys', 0),
    roseSymbols: num('rose', 2),
    stars,
    seed: typeof flags.seed === 'string' ? Number(flags.seed) : undefined,
    attempts: num('attempts', 200),
    requireLogical: !flags.guess,
    mask: flags.mask ? 'symmetric' : 'rect',
    holeRatio: typeof flags.holes === 'string' ? Number(flags.holes) : undefined,
    symmetry: typeof flags.symmetry === 'string' ? (flags.symmetry as 'lr' | 'tb' | 'both') : undefined,
    asymmetry: typeof flags.asym === 'string' ? Number(flags.asym) : undefined,
    walls: typeof flags.walls === 'string' ? Number(flags.walls) : flags.walls === true,
    repairs: typeof flags.repairs === 'string' ? Number(flags.repairs) : undefined,
  };
}

function describe(p: Puzzle, r: ReturnType<typeof solveLogically>): string {
  const techs = Object.entries(r.techniques)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${t}×${n}`)
    .join(', ');
  const stars = '★'.repeat(r.stars) + '☆'.repeat(7 - r.stars);
  return [
    `clues: ${p.clues.length}   logical: ${r.solved ? 'yes' : r.broken ? 'BROKEN' : `no (${Math.round(r.progress * 100)}%)`}`,
    `difficulty: ${r.difficulty}  ${stars}  max tier ${r.maxTier} (${TIER_NAMES[r.maxTier] ?? '-'})  hypotheticals ${r.bifurcations}`,
    `steps: ${r.steps.length}  deductions: ${r.deductions}  [${techs}]`,
  ].join('\n');
}

function main(argv: string[]): void {
  const { cmd, pos, flags } = parseArgs(argv);
  if (cmd === 'help' || flags.help) {
    console.log(HELP);
    return;
  }
  if (cmd === 'solve') {
    const file = pos[0];
    if (!file) throw new Error('usage: pbp solve <puzzle.json>');
    const data = JSON.parse(readFileSync(file, 'utf8'));
    const puzzles: Puzzle[] = Array.isArray(data) ? data : [data.puzzle ?? data];
    for (const p of puzzles) {
      console.log(render(p));
      const t = Date.now();
      const r = solve(p, { limit: 2 });
      console.log(`solutions: ${r.aborted ? '≥' : ''}${r.solutions.length}  (nodes ${r.nodes}, ${Date.now() - t} ms)`);
      const lg = solveLogically(p);
      console.log(describe(p, lg));
      const labels = lg.labels ?? r.solutions[0];
      if (labels) console.log(render(p, labels));
      console.log();
    }
    return;
  }
  if (cmd === 'gen' || cmd === 'batch') {
    const opt = genOptions(flags);
    const count = typeof flags.count === 'string' ? Number(flags.count) : cmd === 'batch' ? 30 : 3;
    const baseSeed = opt.seed ?? Math.floor(Math.random() * 0xffffffff);
    const results = [];
    const hist = new Map<number, number>();
    const t0 = Date.now();
    for (let i = 0; i < count; i++) {
      const t = Date.now();
      const r = generate({ ...opt, seed: (baseSeed + i * 7919) >>> 0 });
      if (!r) {
        console.log(`#${i + 1}: no puzzle found`);
        continue;
      }
      results.push(r);
      hist.set(r.analysis.stars, (hist.get(r.analysis.stars) ?? 0) + 1);
      if (cmd === 'gen') {
        console.log(`#${i + 1}  seed ${r.seed}  (attempt ${r.attempts}, ${Date.now() - t} ms)`);
        console.log(render(r.puzzle));
        console.log(describe(r.puzzle, r.analysis));
        console.log('solution:');
        console.log(render(r.puzzle, r.solution));
        console.log();
      } else {
        process.stdout.write(`${r.analysis.stars}`);
      }
    }
    if (cmd === 'batch') {
      console.log();
      console.log(`${results.length}/${count} puzzles in ${Date.now() - t0} ms`);
      for (let s = 1; s <= 7; s++) console.log(`  ${'★'.repeat(s).padEnd(7)}  ${'#'.repeat(hist.get(s) ?? 0)} ${hist.get(s) ?? 0}`);
      const tech = new Map<string, number>();
      for (const r of results) for (const [k, v] of Object.entries(r.analysis.techniques)) tech.set(k, (tech.get(k) ?? 0) + v);
      console.log('techniques:', [...tech.entries()].map(([k, v]) => `${k}×${v}`).join(', '));
    }
    if (typeof flags.json === 'string') {
      const out = results.map((r) => ({
        seed: r.seed,
        stars: r.analysis.stars,
        difficulty: r.analysis.difficulty,
        puzzle: r.puzzle,
        solution: Array.from(r.solution),
        solutionText: renderLabels(r.puzzle.width, r.solution),
        shapes: r.puzzle.clues.flatMap((c) => (c.type === 'shapeBank' ? c.shapes.map(shapeName) : [])),
      }));
      writeFileSync(flags.json, JSON.stringify(out, null, 2));
      console.log(`wrote ${flags.json}`);
    }
    return;
  }
  throw new Error(`unknown command "${cmd}"\n${HELP}`);
}

try {
  main(process.argv.slice(2));
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
