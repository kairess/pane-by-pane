import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonical, orientations, parseKey, shapeFromName, shapeName, regionKey, isRectangleKey } from '../src/engine/shape.ts';

test('rotations and reflections share one canonical key', () => {
  const L = parseKey('0,0;0,1;0,2;1,2');
  const keys = new Set(orientations(L).map((o) => canonical(o)));
  assert.equal(keys.size, 1);
  assert.equal(canonical(L), shapeFromName('L4'));
});

test('orientation counts', () => {
  assert.equal(orientations(parseKey(shapeFromName('O4'))).length, 1);
  assert.equal(orientations(parseKey(shapeFromName('I4'))).length, 2);
  assert.equal(orientations(parseKey(shapeFromName('T4'))).length, 4);
  assert.equal(orientations(parseKey(shapeFromName('L4'))).length, 8);
  assert.equal(orientations(parseKey(shapeFromName('S4'))).length, 4);
});

test('all 12 pentominoes are distinct and named', () => {
  const names = ['F5', 'I5', 'L5', 'N5', 'P5', 'T5', 'U5', 'V5', 'W5', 'X5', 'Y5', 'Z5'];
  const keys = new Set(names.map(shapeFromName));
  assert.equal(keys.size, 12);
  for (const n of names) assert.equal(shapeName(shapeFromName(n)), n);
});

test('regionKey from grid cells', () => {
  // cells 0,1,2 in a 3-wide grid = I3 horizontal; 0,3,6 = I3 vertical
  assert.equal(regionKey(3, [0, 1, 2]), regionKey(3, [0, 3, 6]));
  assert.equal(shapeName(regionKey(3, [0, 1, 2])), 'I3');
  assert.ok(isRectangleKey(regionKey(3, [0, 1, 3, 4])));
  assert.ok(!isRectangleKey(regionKey(3, [0, 1, 2, 3])));
});
