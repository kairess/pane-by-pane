import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerState, WALL } from '../src/web/model.ts';
import { edgeBetween } from '../src/engine/grid.ts';

const puzzle = { width: 4, height: 1, clues: [] };

test('dragging over another region absorbs it whole', () => {
  const ps = new PlayerState(puzzle);
  const a = ps.newRegion(0);
  const b = ps.newRegion(3);
  assert.ok(ps.extend(2, b)); // b = {2,3}
  assert.ok(ps.extend(1, a)); // a = {0,1}
  assert.ok(ps.extend(2, a)); // touches b -> b absorbed
  assert.deepEqual(Array.from(ps.paint), [a, a, a, a]);
  assert.equal(ps.hue[b], undefined);
});

test('a wall blocks extending and splits a region', () => {
  const ps = new PlayerState(puzzle);
  const a = ps.newRegion(0);
  ps.extend(1, a);
  ps.extend(2, a);
  const e = edgeBetween(ps.grid, 1, 2);
  ps.setEdge(e, WALL);
  assert.notEqual(ps.paint[2], a, 'cell beyond the wall gets a new id');
  assert.equal(ps.paint[1], a);
  assert.ok(!ps.extend(3, a), 'cannot extend across the wall');
});

test('undo restores the previous snapshot', () => {
  const ps = new PlayerState(puzzle);
  ps.beginChange();
  ps.newRegion(0);
  assert.ok(ps.undo());
  assert.equal(ps.paint[0], 0);
  assert.ok(ps.redo());
  assert.notEqual(ps.paint[0], 0);
});

test('a fixed wall blocks the brush like a drawn one', () => {
  const ps = new PlayerState({ ...puzzle, walls: [{ a: 1, b: 2 }] });
  const a = ps.newRegion(0);
  assert.ok(ps.extend(1, a));
  assert.ok(!ps.extend(2, a), 'cannot paint across a fixed wall');
  assert.equal(ps.paint[2], 0);
  const b = ps.newRegion(3);
  assert.ok(ps.extend(2, b), 'the other side is reachable from its own region');
  assert.ok(!ps.extend(1, b), 'nor can the brush cross back and absorb a region');
  assert.equal(ps.paint[1], a);
});

test('areaOf: a painted region as a whole, or the empty cells joined without crossing walls or paint', () => {
  const ps = new PlayerState({ width: 4, height: 4, clues: [] });
  const id = ps.newRegion(0);
  ps.extend(1, id);
  ps.extend(4, id);
  ps.setEdge(edgeBetween(ps.grid, 2, 3), WALL);
  assert.deepEqual(ps.areaOf(1), { count: 3, cells: [0, 1, 4] });
  // every empty cell is still joined (3 is reached through 7), never through the paint
  assert.equal(ps.areaOf(5).count, 13);
  assert.equal(ps.areaOf(2).count, 13);
  ps.setEdge(edgeBetween(ps.grid, 3, 7), WALL);
  assert.deepEqual(ps.areaOf(3), { count: 1, cells: [3] });
});

test('wallAround: walls every border of a region, and takes them away again when they are all there', () => {
  const ps = new PlayerState({ width: 4, height: 4, clues: [] });
  const id = ps.newRegion(0);
  ps.extend(1, id);
  ps.extend(4, id);
  const border = [[1, 2], [1, 5], [4, 5], [4, 8]].map(([a, b]) => edgeBetween(ps.grid, a, b));
  assert.equal(ps.wallAround(id), 4);
  assert.ok(border.every((e) => ps.isWall(e)));
  assert.deepEqual(Array.from(ps.paint).filter((x) => x === id).length, 3, 'the region itself is untouched');
  // one wall removed by hand: the next call completes the ring rather than clearing it
  ps.setEdge(border[0], 0);
  assert.equal(ps.wallAround(id), 1);
  assert.ok(border.every((e) => ps.isWall(e)));
  // fully walled: toggles the drawn walls off
  assert.equal(ps.wallAround(id), 4);
  assert.ok(border.every((e) => !ps.isWall(e)));
});
