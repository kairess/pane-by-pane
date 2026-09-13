import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, sameLabels } from '../src/engine/generator/generate.ts';
import { growPartition, tilePartition, randomBank, catalogBank, regionsOf } from '../src/engine/generator/partition.ts';
import { BANK_CATALOG } from '../src/engine/generator/bankCatalog.ts';
import { shapeSize } from '../src/engine/shape.ts';
import { Rng } from '../src/engine/random.ts';
import { makeGrid } from '../src/engine/grid.ts';
import { randomMask, isNice } from '../src/engine/generator/mask.ts';
import { solve } from '../src/engine/solver.ts';
import { createEngine, verify } from '../src/engine/engine.ts';
import { regionKey } from '../src/engine/shape.ts';
import type { RuleKind } from '../src/engine/types.ts';

test('growPartition respects size bounds and covers the grid', () => {
  const rng = new Rng(7);
  for (let i = 0; i < 10; i++) {
    const labels = growPartition(makeGrid(6, 6), rng, { minSize: 3, maxSize: 5 });
    assert.ok(labels);
    const regions = regionsOf(labels);
    assert.equal(regions.reduce((a, r) => a + r.length, 0), 36);
    for (const r of regions) assert.ok(r.length >= 3 && r.length <= 5);
  }
});

test('tilePartition only uses bank shapes', () => {
  const rng = new Rng(3);
  const bank = randomBank(3, 3, 5, rng);
  const labels = tilePartition(makeGrid(6, 6), bank, rng);
  assert.ok(labels);
  for (const r of regionsOf(labels)) assert.ok(bank.includes(regionKey(6, r)));
});

const combos: { rules: RuleKind[]; min?: number; max?: number }[] = [
  { rules: ['areaNumber', 'gemini', 'delta'] },
  { rules: ['areaNumber', 'range', 'sizeSeparation'] },
  { rules: ['shapeBank', 'delta'], min: 3, max: 5 },
  { rules: ['polyomino', 'range'] },
  { rules: ['rose', 'polyomino'], min: 3, max: 5 },
];

for (const c of combos) {
  test(`generate: ${c.rules.join('+')} yields a unique, logically solvable puzzle`, () => {
    const r = generate({ width: 5, height: 5, rules: c.rules, minSize: c.min ?? 3, maxSize: c.max ?? 6, seed: 11, attempts: 60 });
    assert.ok(r, 'no puzzle generated');
    const engine = createEngine(r.puzzle);
    assert.ok(verify(engine, r.solution));
    const s = solve(engine, { limit: 2 });
    assert.equal(s.solutions.length, 1);
    assert.ok(sameLabels(s.solutions[0], r.solution));
    assert.ok(r.analysis.solved);
    assert.ok(sameLabels(r.analysis.labels!, r.solution));
    // every clue kind used is one that was requested
    for (const clue of r.puzzle.clues) assert.ok(c.rules.includes(clue.type));
  });
}

test('catalogBank draws distinct catalogue shapes within the size range', () => {
  const rng = new Rng(9);
  const keys = new Set(BANK_CATALOG.map((s) => s.key));
  for (let i = 0; i < 30; i++) {
    const bank = catalogBank(rng, { minSize: 3, maxSize: 5 });
    assert.ok(bank.length >= 1 && bank.length <= 3);
    assert.equal(new Set(bank).size, bank.length);
    for (const k of bank) {
      assert.ok(keys.has(k));
      assert.ok(shapeSize(k) >= 3 && shapeSize(k) <= 5);
    }
  }
  assert.equal(catalogBank(rng, { count: 2, minSize: 4, maxSize: 4 }).length, 2);
});

test('randomMask with asymmetric tweaks stays connected without dead ends', () => {
  const rng = new Rng(8);
  for (let i = 0; i < 30; i++) {
    const holes = randomMask(6, 8, rng, { asymmetry: 3 });
    const active = new Uint8Array(48).fill(1);
    for (const c of holes) active[c] = 0;
    assert.ok(isNice(6, 8, active));
  }
});

test('randomMask base is symmetric, connected and has no dead ends', () => {
  const rng = new Rng(5);
  for (let i = 0; i < 20; i++) {
    const w = 6;
    const h = 8;
    const holes = randomMask(w, h, rng, { symmetry: 'lr', asymmetry: 0 });
    const active = new Uint8Array(w * h).fill(1);
    for (const c of holes) active[c] = 0;
    assert.ok(isNice(w, h, active));
    for (const c of holes) {
      const x = c % w;
      const y = (c - x) / w;
      assert.ok(holes.includes(y * w + (w - 1 - x)), 'mirror image is also a hole');
    }
  }
});

test('generate on an irregular board: holes are excluded and the puzzle is unique', () => {
  const r = generate({ width: 6, height: 7, rules: ['shapeBank'], minSize: 3, maxSize: 5, mask: 'symmetric', seed: 21, attempts: 200 });
  assert.ok(r, 'no puzzle generated');
  assert.ok(r.puzzle.holes && r.puzzle.holes.length > 0);
  for (const h of r.puzzle.holes) assert.equal(r.solution[h], -1);
  const engine = createEngine(r.puzzle);
  assert.ok(verify(engine, r.solution));
  const s = solve(engine, { limit: 2 });
  assert.equal(s.solutions.length, 1);
  assert.ok(sameLabels(s.solutions[0], r.solution));
});

test('generation is reproducible for a seed', () => {
  const a = generate({ width: 5, height: 5, rules: ['areaNumber', 'delta'], seed: 99, attempts: 30 });
  const b = generate({ width: 5, height: 5, rules: ['areaNumber', 'delta'], seed: 99, attempts: 30 });
  assert.deepEqual(a?.puzzle, b?.puzzle);
});
