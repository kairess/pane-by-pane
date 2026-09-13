import type { Grid } from '../grid.ts';
import type { Clue, Puzzle } from '../types.ts';
import { CoreRule } from './core.ts';
import { RoseRule } from './rose.ts';
import type { Rule } from './rule.ts';
import { PairShapeRule, PolyominoRule, ShapeBankRule } from './shapes.ts';
import { AreaNumberRule, RangeRule, SizeSeparationRule } from './size.ts';

export type { Deduction, Rule } from './rule.ts';

function ofType<T extends Clue['type']>(clues: Clue[], t: T): Extract<Clue, { type: T }>[] {
  return clues.filter((c): c is Extract<Clue, { type: T }> => c.type === t);
}

/** Build rule objects for a puzzle. The core propagator is always last. */
export function buildRules(puzzle: Puzzle, grid: Grid): Rule[] {
  const rules: Rule[] = [];
  const an = ofType(puzzle.clues, 'areaNumber');
  if (an.length) rules.push(new AreaNumberRule(an));
  const rg = ofType(puzzle.clues, 'range');
  if (rg.length) rules.push(new RangeRule(rg, grid));
  const sb = ofType(puzzle.clues, 'shapeBank');
  if (sb.length) rules.push(new ShapeBankRule(sb));
  const po = ofType(puzzle.clues, 'polyomino');
  if (po.length) rules.push(new PolyominoRule(po));
  const ge = ofType(puzzle.clues, 'gemini');
  if (ge.length) rules.push(new PairShapeRule('gemini', ge, grid));
  const de = ofType(puzzle.clues, 'delta');
  if (de.length) rules.push(new PairShapeRule('delta', de, grid));
  const ro = ofType(puzzle.clues, 'rose');
  if (ro.length > 1) throw new Error('only one rose clue per puzzle');
  if (ro.length) rules.push(new RoseRule(ro[0], grid));
  if (ofType(puzzle.clues, 'sizeSeparation').length) rules.push(new SizeSeparationRule());
  rules.push(new CoreRule(rules.slice()));
  return rules;
}
