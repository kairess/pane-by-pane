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
