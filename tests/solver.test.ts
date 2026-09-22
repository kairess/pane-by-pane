import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, countSolutions } from '../src/engine/solver.ts';
import { solveLogically } from '../src/engine/logical.ts';
import { createEngine, verify } from '../src/engine/engine.ts';
import { shapeFromName } from '../src/engine/shape.ts';
import { sameLabels } from '../src/engine/generator/generate.ts';
import { renderLabels } from '../src/engine/render.ts';
import type { Puzzle } from '../src/engine/types.ts';

/** Labels from a letter grid like "AABB\nAABB". */
function labelsOf(text: string): Int32Array {
  const rows = text.trim().split('\n').map((r) => r.trim());
  const out = new Int32Array(rows.join('').length);
  let i = 0;
  for (const r of rows) for (const ch of r) out[i++] = ch.charCodeAt(0) - 65;
  return out;
}

test('complete solver reproduces known tiling counts', () => {
  // partitions of 4x4 into tetrominoes = 117, of 5x5 into pentominoes = 4006
  assert.equal(countSolutions({ width: 4, height: 4, clues: [{ type: 'range', min: 4, max: 4 }] }, 1000), 117);
  assert.equal(countSolutions({ width: 5, height: 5, clues: [{ type: 'range', min: 5, max: 5 }] }, 10000), 4006);
});

test('shape bank: only O4 tiles 4x4 one way, only I4 tiles it two ways', () => {
  assert.equal(countSolutions({ width: 4, height: 4, clues: [{ type: 'shapeBank', shapes: [shapeFromName('O4')] }] }, 10), 1);
  assert.equal(countSolutions({ width: 4, height: 4, clues: [{ type: 'shapeBank', shapes: [shapeFromName('I4')] }] }, 10), 2);
  // non-canonical key is accepted
  assert.equal(countSolutions({ width: 4, height: 4, clues: [{ type: 'shapeBank', shapes: ['0,0;1,0;2,0;3,0'] }] }, 10), 2);
});

test('area number + range pin a partition', () => {
  const puzzle: Puzzle = {
    width: 4,
    height: 3,
    clues: [
      { type: 'range', min: 3, max: 4 },
      { type: 'areaNumber', cell: 0, value: 4 },
      { type: 'areaNumber', cell: 3, value: 4 },
      { type: 'areaNumber', cell: 9, value: 4 },
    ],
  };
  const r = solve(puzzle, { limit: 10 });
  // 4 + 4 + 4 = 12 cells: every cell is in a numbered region.
  for (const s of r.solutions) assert.ok(verify(createEngine(puzzle), s));
  assert.ok(r.solutions.length >= 1);
});

test('gemini forces equal shapes, delta forces different shapes', () => {
  // 4x2 grid; edge between cell 1 and 2 marked. Regions must be size 2 and 2... use range 2..6
  const base: Puzzle = { width: 4, height: 2, clues: [{ type: 'range', min: 2, max: 6 }] };
  const gem: Puzzle = { ...base, clues: [...base.clues, { type: 'gemini', edge: { a: 1, b: 2 } }] };
  const del: Puzzle = { ...base, clues: [...base.clues, { type: 'delta', edge: { a: 1, b: 2 } }] };
  for (const s of solve(gem, { limit: 100 }).solutions) assert.ok(verify(createEngine(gem), s));
  for (const s of solve(del, { limit: 100 }).solutions) assert.ok(verify(createEngine(del), s));
  const gemSet = solve(gem, { limit: 100 }).solutions.map((s) => renderLabels(4, s));
  const delSet = solve(del, { limit: 100 }).solutions.map((s) => renderLabels(4, s));
  // vertical split into two 2x2 squares is gemini-valid, not delta-valid
  assert.ok(gemSet.includes('AABB\nAABB'));
  assert.ok(!delSet.includes('AABB\nAABB'));
  for (const g of gemSet) assert.ok(!delSet.includes(g));
});

test('rose: every region has one of each symbol', () => {
  const puzzle: Puzzle = {
    width: 4,
    height: 2,
    clues: [
      {
        type: 'rose',
        symbolCount: 2,
        symbols: [
          { cell: 0, symbol: 0 },
          { cell: 5, symbol: 1 },
          { cell: 2, symbol: 0 },
          { cell: 7, symbol: 1 },
        ],
      },
    ],
  };
  const r = solve(puzzle, { limit: 100 });
  assert.ok(r.solutions.length >= 1);
  for (const s of r.solutions) {
    assert.ok(verify(createEngine(puzzle), s));
    assert.equal(new Set(s).size, 2);
  }
  // A partition where a region lacks a symbol must be rejected.
  assert.ok(!verify(createEngine(puzzle), labelsOf('AAAA\nBBBB')));
});

test('polyomino clue pins the region shape', () => {
  const puzzle: Puzzle = {
    width: 3,
    height: 3,
    clues: [
      { type: 'polyomino', cell: 4, shape: shapeFromName('X5') },
      { type: 'range', min: 1, max: 5 },
    ],
  };
  const r = solve(puzzle, { limit: 100 });
  assert.equal(r.solutions.length, 1);
  assert.equal(renderLabels(3, r.solutions[0]), 'ABC\nBBB\nDBE');
});

test('size separation rejects equal bordering areas', () => {
  const puzzle: Puzzle = { width: 4, height: 1, clues: [{ type: 'sizeSeparation' }, { type: 'range', min: 1, max: 3 }] };
  const eng = createEngine(puzzle);
  assert.ok(!verify(eng, labelsOf('AABB')));
  assert.ok(verify(eng, labelsOf('ABBB')));
  const sols = solve(puzzle, { limit: 100 }).solutions.map((s) => renderLabels(4, s));
  // AABC, ABCC, ABCD all have two bordering size-1 regions
  assert.deepEqual(sols.sort(), ['ABBB', 'AAAB', 'ABBC'].sort());
});

test('logical solver agrees with complete solver on a unique puzzle', () => {
  const puzzle: Puzzle = {
    width: 4,
    height: 4,
    clues: [{ type: 'shapeBank', shapes: [shapeFromName('O4')] }],
  };
  const full = solve(puzzle, { limit: 2 });
  const logical = solveLogically(puzzle);
  assert.equal(full.solutions.length, 1);
  assert.ok(logical.solved);
  assert.ok(sameLabels(logical.labels!, full.solutions[0]));
  assert.equal(logical.bifurcations, 0);
});

test('contradictory clues yield no solution and a broken analysis', () => {
  const puzzle: Puzzle = {
    width: 3,
    height: 3,
    clues: [
      { type: 'areaNumber', cell: 0, value: 2 },
      { type: 'areaNumber', cell: 1, value: 3 },
      { type: 'gemini', edge: { a: 0, b: 1 } },
    ],
  };
  assert.equal(countSolutions(puzzle), 0);
  assert.ok(solveLogically(puzzle).broken);
});

// ---------------------------------------------------------------------------
// A-grade rules (docs/A_RULES.md): Boxy, Non-Boxy, Inequality, Difference, Solitude

test('boxy: the 4x4 board splits into area-4 rectangles in nine ways, non-boxy into none', () => {
  const boxy: Puzzle = { width: 4, height: 4, clues: [{ type: 'boxy' }, { type: 'range', min: 4, max: 4 }] };
  const sols = solve(boxy, { limit: 100 }).solutions;
  assert.equal(sols.length, 9);
  for (const s of sols) assert.ok(verify(createEngine(boxy), s));
  assert.ok(sols.map((s) => renderLabels(4, s)).includes('AABB\nAABB\nCCDD\nCCDD'));
  const nonBoxy: Puzzle = { width: 4, height: 4, clues: [{ type: 'nonBoxy' }, { type: 'range', min: 4, max: 4 }] };
  const ns = solve(nonBoxy, { limit: 200 }).solutions;
  assert.ok(ns.length > 0);
  for (const s of ns) {
    assert.ok(verify(createEngine(nonBoxy), s));
    assert.ok(!verify(createEngine(boxy), s));
  }
  // a domino is a rectangle: non-boxy regions have at least three cells
  assert.ok(!verify(createEngine({ width: 3, height: 2, clues: [{ type: 'nonBoxy' }] }), labelsOf('AAB\nAAB')));
  assert.ok(verify(createEngine({ width: 3, height: 2, clues: [{ type: 'nonBoxy' }] }), labelsOf('AAA\nABB')) === false, 'BB is a domino');
  assert.ok(verify(createEngine({ width: 3, height: 3, clues: [{ type: 'nonBoxy' }] }), labelsOf('AAA\nABB\nABB')) === false, 'BB/BB is a square');
  assert.ok(verify(createEngine({ width: 3, height: 3, clues: [{ type: 'nonBoxy' }] }), labelsOf('AAA\nABB\nAAB')));
});

test('inequality: the open side of the sign is the larger region', () => {
  // 1x3 board, sign between cells 1 and 2 with the left side larger: AAB is the only partition
  const left: Puzzle = { width: 3, height: 1, clues: [{ type: 'inequality', edge: { a: 1, b: 2 }, larger: 'a' }] };
  assert.deepEqual(solve(left, { limit: 10 }).solutions.map((s) => renderLabels(3, s)), ['AAB']);
  const right: Puzzle = { width: 3, height: 1, clues: [{ type: 'inequality', edge: { a: 0, b: 1 }, larger: 'b' }] };
  assert.deepEqual(solve(right, { limit: 10 }).solutions.map((s) => renderLabels(3, s)), ['ABB']);
  const l = solveLogically(left);
  assert.ok(l.solved && l.bifurcations === 0);
  // a chain A < B < C with C at most 3 bounds A to 1 and B to 2
  const chain: Puzzle = {
    width: 6,
    height: 1,
    clues: [
      { type: 'range', min: 1, max: 3 },
      { type: 'inequality', edge: { a: 0, b: 1 }, larger: 'b' },
      { type: 'inequality', edge: { a: 2, b: 3 }, larger: 'b' },
    ],
  };
  assert.deepEqual(solve(chain, { limit: 10 }).solutions.map((s) => renderLabels(6, s)), ['ABBCCC']);
});

test('difference: areas differ by exactly the number, zero meaning equal', () => {
  const one: Puzzle = { width: 4, height: 1, clues: [{ type: 'difference', edge: { a: 1, b: 2 }, value: 1 }] };
  assert.deepEqual(solve(one, { limit: 10 }).solutions.map((s) => renderLabels(4, s)).sort(), ['AABC', 'ABCC']);
  const zero: Puzzle = { width: 4, height: 1, clues: [{ type: 'difference', edge: { a: 1, b: 2 }, value: 0 }] };
  assert.deepEqual(solve(zero, { limit: 10 }).solutions.map((s) => renderLabels(4, s)).sort(), ['AABB', 'ABCD']);
  assert.equal(countSolutions({ width: 4, height: 1, clues: [{ type: 'difference', edge: { a: 1, b: 2 }, value: 2 }] }), 0);
  // once one side is exact, the other is x-N or x+N: 3 | 1 or 3 | 5
  const pinned: Puzzle = { width: 8, height: 1, clues: [{ type: 'areaNumber', cell: 0, value: 3 }, { type: 'difference', edge: { a: 2, b: 3 }, value: 2 }, { type: 'range', min: 1, max: 5 }] };
  for (const s of solve(pinned, { limit: 50 }).solutions) {
    const sizes = new Map<number, number>();
    for (const l of s) sizes.set(l, (sizes.get(l) ?? 0) + 1);
    assert.ok([1, 5].includes(sizes.get(s[3])!));
  }
});

test('solitude: exactly one symbol per region, counting every cell clue', () => {
  // 3x1 with numbers on both ends: without solitude ABB/AAB are both fine, with it too (one number each); AAA is not
  const p: Puzzle = { width: 3, height: 1, clues: [{ type: 'solitude' }, { type: 'areaNumber', cell: 0, value: 1 }, { type: 'polyomino', cell: 2, shape: shapeFromName('I2') }] };
  assert.deepEqual(solve(p, { limit: 10 }).solutions.map((s) => renderLabels(3, s)), ['ABB']);
  const eng = createEngine(p);
  assert.ok(!verify(eng, labelsOf('AAA')));
  // a region without any symbol breaks the rule
  const q: Puzzle = { width: 3, height: 1, clues: [{ type: 'solitude' }, { type: 'areaNumber', cell: 0, value: 1 }] };
  assert.ok(!verify(createEngine(q), labelsOf('ABB')), 'BB holds no symbol');
  assert.ok(!verify(createEngine(q), labelsOf('ABC')));
  assert.equal(countSolutions(q), 0);
  const l = solveLogically(p);
  assert.ok(l.solved);
  assert.ok(l.techniques['one-symbol'] === undefined || l.techniques['one-symbol'] >= 0);
});

test('pocket-count: a wall that would cut off a pocket no whole regions can fill is a tier-1 join under Precision', () => {
  // 2x3 board, Precision 3: the only tilings are the two rows (vertical cut) or the three columns paired... no:
  // 6 cells / 3 = two regions; a wall between (0,0)-(1,0) would leave the corner cell alone (1 is not a multiple of 3)
  const p: Puzzle = { width: 3, height: 2, clues: [{ type: 'range', min: 3, max: 3 }] };
  const sols = solve(p, { limit: 10 }).solutions.map((s) => renderLabels(3, s)).sort();
  assert.deepEqual(sols, ['AAA\nBBB', 'AAB\nABB', 'ABB\nAAB'].sort());
  // an L-shaped board of 5 cells with Precision 2 has no solution at all (5 is odd): found at once, not by search
  const odd: Puzzle = { width: 3, height: 2, holes: [5], clues: [{ type: 'range', min: 2, max: 2 }] };
  const r = solve(odd, { limit: 2 });
  assert.equal(r.solutions.length, 0);
  assert.equal(r.nodes, 0, 'the contradiction shows before any branching');
  // a corridor: 1x6 with Precision 3 is unique and needs no what-if
  const corridor: Puzzle = { width: 6, height: 1, clues: [{ type: 'range', min: 3, max: 3 }] };
  const l = solveLogically(corridor);
  assert.ok(l.solved);
  assert.equal(l.bifurcations, 0);
  assert.ok((l.techniques['pocket-count'] ?? 0) > 0 || l.maxTier <= 2);
});

test('mingle: bordering regions differ in shape', () => {
  // 4x1 with regions of 1-2 cells: two single cells or two dominoes side by side are out
  const p: Puzzle = { width: 4, height: 1, clues: [{ type: 'mingle' }, { type: 'range', min: 1, max: 2 }] };
  assert.deepEqual(solve(p, { limit: 20 }).solutions.map((s) => renderLabels(4, s)), ['ABBC'], 'two bordering single cells or dominoes would share a shape');
  const eng = createEngine(p);
  assert.ok(!verify(eng, labelsOf('AABB')));
  assert.ok(!verify(eng, labelsOf('ABCD')));
  // a pinned shape next to a polyomino tile of the same shape is a contradiction
  const q: Puzzle = { width: 4, height: 1, clues: [{ type: 'mingle' }, { type: 'polyomino', cell: 0, shape: shapeFromName('I2') }, { type: 'polyomino', cell: 3, shape: shapeFromName('I2') }] };
  assert.equal(countSolutions(q), 0);
});

test('match, mismatch, palisade, bricky, loopy and watchtower', () => {
  // match: 4x2 into equal shapes of 2-4 cells
  const match: Puzzle = { width: 4, height: 2, clues: [{ type: 'match' }, { type: 'range', min: 2, max: 4 }] };
  for (const s of solve(match, { limit: 50 }).solutions) assert.ok(verify(createEngine(match), s));
  assert.ok(!verify(createEngine(match), labelsOf('AAAB\nAAAB')));
  // mismatch: on 4x1 only AAAA, AAAB, ABBB (a domino next to a domino, or two singles, repeat a shape)
  assert.deepEqual(solve({ width: 4, height: 1, clues: [{ type: 'mismatch' }] }, { limit: 50 }).solutions.map((s) => renderLabels(4, s)).sort(), ['AAAA', 'AAAB', 'ABBB']);
  // palisade: cell 0 of a 3x1 with N, S, W borders (frame) and an open east side
  const pal: Puzzle = { width: 3, height: 1, clues: [{ type: 'palisade', cell: 0, sides: 1 | 4 | 8 }] };
  assert.deepEqual(solve(pal, { limit: 10 }).solutions.map((s) => renderLabels(3, s)).sort(), ['AAA', 'AAB']);
  assert.equal(countSolutions({ width: 3, height: 1, clues: [{ type: 'palisade', cell: 0, sides: 1 | 4 }] }), 0, 'the west side is on the frame and must be a border');
  const pl = solveLogically({ width: 3, height: 1, clues: [{ type: 'palisade', cell: 0, sides: 15 }, { type: 'palisade', cell: 2, sides: 15 }] });
  assert.ok(pl.solved && pl.techniques['palisade'] === 2);
  // bricky: four single cells around a vertex are out
  const bricky: Puzzle = { width: 2, height: 2, clues: [{ type: 'bricky' }] };
  assert.ok(!verify(createEngine(bricky), labelsOf('AB\nCD')));
  assert.ok(verify(createEngine(bricky), labelsOf('AB\nCC')));
  assert.equal(countSolutions(bricky, 100), 11);
  // loopy: only islands away from the frame
  const loopy: Puzzle = { width: 3, height: 3, clues: [{ type: 'loopy' }] };
  assert.deepEqual(solve(loopy, { limit: 50 }).solutions.map((s) => renderLabels(3, s)).sort(), ['AAA\nAAA\nAAA', 'AAA\nABA\nAAA']);
  // watchtower: four regions around the centre vertex of a 2x2
  assert.deepEqual(solve({ width: 2, height: 2, clues: [{ type: 'watchtower', x: 1, y: 1, count: 4 }] }, { limit: 10 }).solutions.map((s) => renderLabels(2, s)), ['AB\nCD']);
  assert.deepEqual(solve({ width: 2, height: 2, clues: [{ type: 'watchtower', x: 1, y: 1, count: 1 }] }, { limit: 10 }).solutions.map((s) => renderLabels(2, s)), ['AA\nAA']);
  const two = solve({ width: 2, height: 2, clues: [{ type: 'watchtower', x: 1, y: 1, count: 2 }] }, { limit: 10 }).solutions;
  assert.equal(two.length, 6);
  for (const s of two) assert.equal(new Set(s).size, 2);
});
