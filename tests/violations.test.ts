import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findViolations } from '../src/web/analysis.ts';
import { PlayerState, WALL } from '../src/web/model.ts';
import { edgeBetween } from '../src/engine/grid.ts';
import { shapeFromName } from '../src/engine/shape.ts';
import type { Puzzle } from '../src/engine/types.ts';

/** Draw walls around a set of cells. */
function enclose(ps: PlayerState, cells: number[]): void {
  const set = new Set(cells);
  const g = ps.grid;
  for (const c of cells) for (let i = 0; i < g.adj[c].length; i++) if (!set.has(g.adj[c][i])) ps.setEdge(g.adjEdge[c][i], WALL);
}

test('shape bank: an enclosed region whose shape is not in the bank is a violation', () => {
  const puzzle: Puzzle = { width: 4, height: 4, clues: [{ type: 'shapeBank', shapes: [shapeFromName('I3'), shapeFromName('L3')] }] };
  const ps = new PlayerState(puzzle);
  // nothing drawn: the whole board (16 cells) is bigger than the largest bank shape → not flagged
  assert.equal(findViolations(puzzle, ps).cells.size, 0);
  // enclose a 2x2 square (O4): size 4 > bankMax 3 → not flagged (could still be split)
  enclose(ps, [0, 1, 4, 5]);
  assert.equal(findViolations(puzzle, ps).cells.size, 0);
  // enclose an I3 → fine
  const ps2 = new PlayerState(puzzle);
  enclose(ps2, [0, 1, 2]);
  assert.equal(findViolations(puzzle, ps2).cells.size, 0);
  // enclose a domino → too small, flagged
  const ps3 = new PlayerState(puzzle);
  enclose(ps3, [0, 1]);
  assert.deepEqual([...findViolations(puzzle, ps3).cells].sort(), [0, 1]);
  // bank with a 4-cell shape: an enclosed O4 when the bank has only T4 → flagged
  const puzzle2: Puzzle = { width: 4, height: 4, clues: [{ type: 'shapeBank', shapes: [shapeFromName('T4')] }] };
  const ps4 = new PlayerState(puzzle2);
  enclose(ps4, [0, 1, 4, 5]);
  assert.deepEqual([...findViolations(puzzle2, ps4).cells].sort(), [0, 1, 4, 5]);
});

test('area number and paint violations', () => {
  const puzzle: Puzzle = { width: 4, height: 2, clues: [{ type: 'areaNumber', cell: 0, value: 3 }, { type: 'areaNumber', cell: 3, value: 2 }] };
  const ps = new PlayerState(puzzle);
  enclose(ps, [0, 1]); // region of 2 containing a 3 → flagged
  assert.deepEqual([...findViolations(puzzle, ps).cells].sort(), [0, 1]);
  const ps2 = new PlayerState(puzzle);
  const id = ps2.newRegion(0);
  ps2.extend(1, id);
  ps2.extend(2, id);
  ps2.extend(3, id); // one paint region holding 3 and 2 → flagged
  assert.equal(findViolations(puzzle, ps2).cells.size, 4);
  const ps3 = new PlayerState(puzzle);
  // a wall that is merely different from the solution is not a violation
  ps3.setEdge(edgeBetween(ps3.grid, 1, 2), WALL);
  assert.equal(findViolations(puzzle, ps3).cells.size, 0);
});

test('fixed walls: the brush stops at one, drawing on it is ignored, paint across one is flagged', () => {
  const puzzle: Puzzle = { width: 3, height: 1, walls: [{ a: 0, b: 1 }], clues: [] };
  const ps = new PlayerState(puzzle);
  const e = edgeBetween(ps.grid, 0, 1);
  assert.equal(ps.fixed[e], 1);
  ps.setEdge(e, WALL);
  assert.equal(ps.edge[e], 0, 'fixed walls are not player marks');
  assert.equal(ps.areaOf(0).count, 1, 'fixed wall bounds the area');
  const id = ps.newRegion(0);
  assert.ok(!ps.extend(1, id), 'the brush cannot cross a fixed wall');
  assert.equal(ps.paint[1], 0);
  assert.equal(findViolations(puzzle, ps).edges.size, 0);
  // paint that nevertheless straddles a fixed wall (e.g. an old save) flags the wall
  ps.paint[1] = id;
  const v = findViolations(puzzle, ps);
  assert.deepEqual([...v.edges], [e]);
  assert.equal(v.cells.size, 0);
});

test('a region that grows into a same-hue neighbour is recoloured', () => {
  const puzzle: Puzzle = { width: 4, height: 1, clues: [] };
  for (let trial = 0; trial < 20; trial++) {
    const ps = new PlayerState(puzzle);
    const a = ps.newRegion(0);
    const b = ps.newRegion(3);
    ps.hue[b] = ps.hue[a]; // force a clash once they touch
    ps.extend(1, a);
    ps.extend(2, b);
    assert.notEqual(ps.hue[a], ps.hue[b]);
  }
});

test('solitude, boxy and area-marker violations', () => {
  // solitude: a walled region without a symbol, paint joining two symbols
  const sol: Puzzle = { width: 4, height: 1, clues: [{ type: 'solitude' }, { type: 'areaNumber', cell: 0, value: 2 }, { type: 'areaNumber', cell: 3, value: 2 }] };
  const ps = new PlayerState(sol);
  enclose(ps, [1]); // cell 1 alone holds no symbol
  assert.deepEqual([...findViolations(sol, ps).cells].sort(), [0, 1], 'cell 1 holds no symbol; cell 0 is walled in below its number');
  const ps2 = new PlayerState(sol);
  const id = ps2.newRegion(0);
  for (const c of [1, 2, 3]) ps2.extend(c, id); // two symbols in one paint region
  assert.equal(findViolations(sol, ps2).cells.size, 4);
  // boxy: a definite L-shaped region is flagged; non-boxy flags a definite rectangle and any walled region under three cells
  const boxy: Puzzle = { width: 3, height: 2, clues: [{ type: 'boxy' }] };
  const ps3 = new PlayerState(boxy);
  enclose(ps3, [0, 1, 3]);
  const l = ps3.newRegion(0);
  ps3.extend(1, l);
  ps3.extend(3, l);
  assert.deepEqual([...findViolations(boxy, ps3).cells].sort(), [0, 1, 3]);
  const nonBoxy: Puzzle = { width: 3, height: 2, clues: [{ type: 'nonBoxy' }] };
  const ps4 = new PlayerState(nonBoxy);
  enclose(ps4, [0, 1]);
  assert.deepEqual([...findViolations(nonBoxy, ps4).cells].sort(), [0, 1]);
  // inequality / difference between two definite regions
  const ineq: Puzzle = { width: 4, height: 1, clues: [{ type: 'inequality', edge: { a: 1, b: 2 }, larger: 'a' }, { type: 'difference', edge: { a: 2, b: 3 }, value: 1 }] };
  const ps5 = new PlayerState(ineq);
  for (const cells of [[0, 1], [2], [3]]) {
    enclose(ps5, cells);
    const r = ps5.newRegion(cells[0]);
    for (const c of cells.slice(1)) ps5.extend(c, r);
  }
  assert.equal(findViolations(ineq, ps5).cells.size, 2, 'cells 2 and 3 have equal areas but a difference of 1 is marked');
  const ps6 = new PlayerState(ineq);
  for (const cells of [[0], [1], [2, 3]]) {
    enclose(ps6, cells);
    const r = ps6.newRegion(cells[0]);
    for (const c of cells.slice(1)) ps6.extend(c, r);
  }
  assert.deepEqual([...findViolations(ineq, ps6).cells].sort(), [1, 2, 3], 'the left side of the sign is not larger');
});
