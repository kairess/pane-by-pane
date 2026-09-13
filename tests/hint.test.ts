import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/engine/engine.ts';
import { generate } from '../src/engine/generator/generate.ts';
import { nextHint } from '../src/web/analysis.ts';
import { PlayerState, WALL } from '../src/web/model.ts';

test('hints: staged deductions lead to the solution, and a wrong mark is pointed out', () => {
  const r = generate({ width: 5, height: 5, rules: ['areaNumber', 'delta'], seed: 11, attempts: 60 });
  assert.ok(r);
  const engine = createEngine(r.puzzle);
  const ps = new PlayerState(r.puzzle);
  const g = ps.grid;
  // apply hints until done: every hint must agree with the solution
  for (let i = 0; i < 200; i++) {
    const h = nextHint(engine, ps, r.solution);
    if (!h) break;
    assert.equal(h.kind, 'step');
    if (h.kind !== 'step') break;
    assert.ok(h.where.length > 0 && h.reason.length > 0);
    assert.ok(h.region.length > 0);
    const a = g.edgeA[h.edge];
    const b = g.edgeB[h.edge];
    assert.equal(r.solution[a] !== r.solution[b], h.value === 'wall');
    if (h.value === 'wall') ps.setEdge(h.edge, WALL);
    else {
      assert.ok(h.focus === a || h.focus === b);
      const from = h.focus === a ? b : a;
      const id = ps.paint[from] || ps.newRegion(from);
      ps.extend(h.focus, id);
    }
  }
  assert.equal(nextHint(engine, ps, r.solution), null, 'nothing left to deduce');
  // a wall where the solution joins is reported as a mistake
  const ps2 = new PlayerState(r.puzzle);
  const joinEdge = [...Array(g.edges).keys()].find((e) => r.solution[g.edgeA[e]] === r.solution[g.edgeB[e]])!;
  ps2.setEdge(joinEdge, WALL);
  const m = nextHint(engine, ps2, r.solution);
  assert.ok(m && m.kind === 'mistake' && m.edge === joinEdge);
});
