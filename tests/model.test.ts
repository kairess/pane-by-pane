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
