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
  assert.equal(findViolations(puzzle, ps).size, 0);
  // enclose a 2x2 square (O4): size 4 > bankMax 3 → not flagged (could still be split)
  enclose(ps, [0, 1, 4, 5]);
  assert.equal(findViolations(puzzle, ps).size, 0);
  // enclose an I3 → fine
  const ps2 = new PlayerState(puzzle);
  enclose(ps2, [0, 1, 2]);
  assert.equal(findViolations(puzzle, ps2).size, 0);
  // enclose a domino → too small, flagged
  const ps3 = new PlayerState(puzzle);
  enclose(ps3, [0, 1]);
  assert.deepEqual([...findViolations(puzzle, ps3)].sort(), [0, 1]);
  // bank with a 4-cell shape: an enclosed O4 when the bank has only T4 → flagged
  const puzzle2: Puzzle = { width: 4, height: 4, clues: [{ type: 'shapeBank', shapes: [shapeFromName('T4')] }] };
  const ps4 = new PlayerState(puzzle2);
  enclose(ps4, [0, 1, 4, 5]);
  assert.deepEqual([...findViolations(puzzle2, ps4)].sort(), [0, 1, 4, 5]);
});

test('area number and paint violations', () => {
  const puzzle: Puzzle = { width: 4, height: 2, clues: [{ type: 'areaNumber', cell: 0, value: 3 }, { type: 'areaNumber', cell: 3, value: 2 }] };
  const ps = new PlayerState(puzzle);
  enclose(ps, [0, 1]); // region of 2 containing a 3 → flagged
  assert.deepEqual([...findViolations(puzzle, ps)].sort(), [0, 1]);
  const ps2 = new PlayerState(puzzle);
  const id = ps2.newRegion(0);
  ps2.extend(1, id);
  ps2.extend(2, id);
  ps2.extend(3, id); // one paint region holding 3 and 2 → flagged
  assert.equal(findViolations(puzzle, ps2).size, 4);
  const ps3 = new PlayerState(puzzle);
  // a wall that is merely different from the solution is not a violation
  ps3.setEdge(edgeBetween(ps3.grid, 1, 2), WALL);
  assert.equal(findViolations(puzzle, ps3).size, 0);
});
