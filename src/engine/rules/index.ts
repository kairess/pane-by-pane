import type { Grid } from '../grid.ts';
import type { Clue, Puzzle } from '../types.ts';
import { BoxyRule, NonBoxyRule } from './boxy.ts';
import { DifferenceRule, InequalityRule } from './compare.ts';
import { CoreRule } from './core.ts';
import { RoseRule } from './rose.ts';
import { SolitudeRule } from './solitude.ts';
import type { Rule } from './rule.ts';
import { MatchRule, MingleRule, MismatchRule, PairShapeRule, PolyominoRule, ShapeBankRule } from './shapes.ts';
import { BrickyRule, LoopyRule, PalisadeRule, WatchtowerRule } from './topo.ts';
import { AreaNumberRule, RangeRule, SizeSeparationRule } from './size.ts';
import { FixedWallsRule } from './walls.ts';

export type { Deduction, Rule } from './rule.ts';

function ofType<T extends Clue['type']>(clues: Clue[], t: T): Extract<Clue, { type: T }>[] {
  return clues.filter((c): c is Extract<Clue, { type: T }> => c.type === t);
}

/** Build rule objects for a puzzle. The core propagator is always last. */
export function buildRules(puzzle: Puzzle, grid: Grid): Rule[] {
  const rules: Rule[] = [];
  if (puzzle.walls?.length) rules.push(new FixedWallsRule(puzzle.walls, grid));
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
  if (ofType(puzzle.clues, 'solitude').length) rules.push(new SolitudeRule(puzzle.clues, grid));
  const boxy = ofType(puzzle.clues, 'boxy').length > 0;
  const nonBoxy = ofType(puzzle.clues, 'nonBoxy').length > 0;
  if (boxy && nonBoxy) throw new Error('boxy and nonBoxy contradict each other');
  if (boxy) rules.push(new BoxyRule());
  if (nonBoxy) rules.push(new NonBoxyRule());
  const ineq = ofType(puzzle.clues, 'inequality');
  if (ineq.length) rules.push(new InequalityRule(ineq, grid));
  if (ofType(puzzle.clues, 'mingle').length) rules.push(new MingleRule());
  const match = ofType(puzzle.clues, 'match').length > 0;
  const mismatch = ofType(puzzle.clues, 'mismatch').length > 0;
  if (match && mismatch) throw new Error('match and mismatch contradict each other');
  if (match) rules.push(new MatchRule());
  if (mismatch) rules.push(new MismatchRule(ofType(puzzle.clues, 'boxy').length > 0));
  const pal = ofType(puzzle.clues, 'palisade');
  if (pal.length) rules.push(new PalisadeRule(pal));
  if (ofType(puzzle.clues, 'bricky').length) rules.push(new BrickyRule());
  if (ofType(puzzle.clues, 'loopy').length) rules.push(new LoopyRule());
  const wt = ofType(puzzle.clues, 'watchtower');
  if (wt.length) rules.push(new WatchtowerRule(wt, grid));
  const diff = ofType(puzzle.clues, 'difference');
  if (diff.length) rules.push(new DifferenceRule(diff, grid));
  rules.push(new CoreRule(rules.slice()));
  return rules;
}
