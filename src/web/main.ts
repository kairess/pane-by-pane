import { createEngine } from '../engine/engine.ts';
import { shapeName } from '../engine/shape.ts';
import { RULE_KINDS, type Puzzle, type RuleKind } from '../engine/types.ts';
import type { GenerateOptions } from '../engine/generator/generate.ts';
import { checkCompletion, findViolations, nextHint } from './analysis.ts';
import { Board, shapeIcon, solutionView } from './board.ts';
import { PlayerState, WALL } from './model.ts';
import type { WorkerIn, WorkerOut } from './worker.ts';
import { M, applyStatic, lang, setLang } from './i18n.ts';

applyStatic();

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const form = $<HTMLFormElement>('gen-form');
const genBtn = $<HTMLButtonElement>('generate');
const genStatus = $('gen-status');
const info = $('info');
const starsEl = $('stars');
const rulesInfo = $('rules-info');
const statusEl = $('status');
const shareEl = $<HTMLAnchorElement>('share');
const errorMode = $<HTMLSelectElement>('error-mode');
const goalDialog = $<HTMLDialogElement>('goal-dialog');
const revealDialog = $<HTMLDialogElement>('reveal-dialog');
const revealBtn = $<HTMLButtonElement>('reveal');
const warnDialog = $<HTMLDialogElement>('warn-dialog');

/** A warning the user has to see: shown as a modal, not a status line. */
function warn(text: string): void {
  $('warn-text').textContent = text;
  warnDialog.showModal();
}
$('warn-close').addEventListener('click', () => warnDialog.close());
$('lang').addEventListener('click', () => setLang(lang === 'ko' ? 'en' : 'ko'));

interface Current {
  puzzle: Puzzle;
  solution: Int32Array;
  engine: ReturnType<typeof createEngine>;
  ps: PlayerState;
  key: string;
}
let current: Current | null = null;
let worker: Worker | null = null;

const board = new Board($<HTMLCanvasElement>('board'), {
  onChange: () => onChange(),
  onArea: (info) => {
    if (info) setStatus(M.areaOf(info.count));
    else refreshStatus();
  },
});

// -- options / URL -------------------------------------------------------------

function readOptions(): GenerateOptions {
  const num = (id: string) => Number($<HTMLInputElement>(id).value);
  const rules = [...form.querySelectorAll<HTMLInputElement>('#rules input:checked')].map((i) => i.value as RuleKind);
  const seedText = $<HTMLInputElement>('seed').value.trim();
  return {
    width: num('w'),
    height: num('h'),
    rules,
    minSize: num('min'),
    maxSize: num('max'),
    stars: [num('starLo'), num('starHi')],
    seed: seedText ? Number(seedText) >>> 0 : undefined,
    mask: $<HTMLInputElement>('mask').checked ? 'symmetric' : 'rect',
    walls: $<HTMLInputElement>('walls').checked,
    roseSymbols: Math.min(4, Math.max(1, num('rose') || 2)),
    attempts: 300,
  };
}

function writeOptions(o: GenerateOptions): void {
  $<HTMLInputElement>('w').value = String(o.width);
  $<HTMLInputElement>('h').value = String(o.height);
  $<HTMLInputElement>('min').value = String(o.minSize ?? 3);
  $<HTMLInputElement>('max').value = String(o.maxSize ?? 6);
  $<HTMLInputElement>('starLo').value = String(o.stars?.[0] ?? 1);
  $<HTMLInputElement>('starHi').value = String(o.stars?.[1] ?? 7);
  $<HTMLInputElement>('mask').checked = o.mask === 'symmetric';
  $<HTMLInputElement>('walls').checked = !!o.walls;
  $<HTMLInputElement>('rose').value = String(o.roseSymbols ?? 2);
  for (const i of form.querySelectorAll<HTMLInputElement>('#rules input')) i.checked = o.rules.includes(i.value as RuleKind);
  $('size-row').hidden = o.rules.includes('shapeBank');
  $('rose-row').hidden = !o.rules.includes('rose');
}

function optionsToHash(o: GenerateOptions): string {
  const q = new URLSearchParams({
    w: String(o.width),
    h: String(o.height),
    rules: o.rules.join(','),
    min: String(o.minSize ?? 3),
    max: String(o.maxSize ?? 6),
    stars: `${o.stars?.[0] ?? 1}-${o.stars?.[1] ?? 7}`,
    mask: o.mask === 'symmetric' ? '1' : '0',
    walls: o.walls ? '1' : '0',
    rose: String(o.roseSymbols ?? 2),
    seed: String(o.seed ?? ''),
  });
  return `#${q}`;
}

function optionsFromHash(): GenerateOptions | null {
  if (!location.hash || location.hash.length < 2) return null;
  const q = new URLSearchParams(location.hash.slice(1));
  const rules = (q.get('rules') ?? '').split(',').filter((r): r is RuleKind => RULE_KINDS.includes(r as RuleKind));
  if (!rules.length || !q.get('seed')) return null;
  const [lo, hi] = (q.get('stars') ?? '1-7').split('-').map(Number);
  return {
    width: Number(q.get('w') ?? 6),
    height: Number(q.get('h') ?? 6),
    rules,
    minSize: Number(q.get('min') ?? 3),
    maxSize: Number(q.get('max') ?? 6),
    stars: [lo, hi ?? lo],
    mask: q.get('mask') === '1' ? 'symmetric' : 'rect',
    walls: q.get('walls') === '1',
    roseSymbols: Number(q.get('rose') ?? 2),
    seed: Number(q.get('seed')),
    attempts: 300,
  };
}

// -- generation ------------------------------------------------------------------

function startGenerate(opts: GenerateOptions): void {
  if (worker) worker.terminate();
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  genBtn.disabled = true;
  genStatus.textContent = M.generating;
  const t0 = Date.now();
  worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
    const m = ev.data;
    if (m.type === 'progress') {
      genStatus.textContent = M.generatingAttempt(m.attempt);
      return;
    }
    genBtn.disabled = false;
    if (m.type === 'none') {
      genStatus.textContent = '';
      warn(M.warnNoPuzzle);
      return;
    }
    genStatus.textContent = M.generatedIn(((Date.now() - t0) / 1000).toFixed(1), m.seed);
    const shared = { ...opts, seed: m.seed };
    history.replaceState(null, '', optionsToHash(shared));
    shareEl.href = location.href;
    loadPuzzle(m.puzzle, Int32Array.from(m.solution), m.analysis.stars, m.analysis.difficulty);
    saveLast({ puzzle: m.puzzle, solution: m.solution, stars: m.analysis.stars, difficulty: m.analysis.difficulty, hash: location.hash });
  };
  worker.onerror = (e) => {
    genBtn.disabled = false;
    genStatus.textContent = M.error(e.message);
  };
  worker.postMessage({ type: 'generate', opts } satisfies WorkerIn);
}

// -- persistence -----------------------------------------------------------------

interface LastPuzzle {
  puzzle: Puzzle;
  solution: number[];
  stars: number;
  difficulty: number;
  hash: string;
}

function saveLast(l: LastPuzzle): void {
  try {
    localStorage.setItem('pbp:last', JSON.stringify(l));
  } catch {
    /* ignore */
  }
}

function loadLast(): LastPuzzle | null {
  try {
    const t = localStorage.getItem('pbp:last');
    return t ? (JSON.parse(t) as LastPuzzle) : null;
  } catch {
    return null;
  }
}

function puzzleKey(p: Puzzle): string {
  const s = JSON.stringify(p);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `pbp:marks:${(h >>> 0).toString(36)}`;
}

function saveMarks(): void {
  if (!current) return;
  try {
    localStorage.setItem(current.key, current.ps.serialize());
  } catch {
    /* ignore */
  }
}

// -- puzzle screen ----------------------------------------------------------------

function loadPuzzle(p: Puzzle, solution: Int32Array, stars: number, difficulty: number): void {
  const ps = new PlayerState(p);
  const key = puzzleKey(p);
  try {
    const saved = localStorage.getItem(key);
    if (saved) ps.deserialize(saved);
  } catch {
    /* ignore */
  }
  current = { puzzle: p, solution, engine: createEngine(p), ps, key };
  board.eraser = false;
  $('eraser').classList.remove('active');
  board.setPuzzle(p, ps);
  resetHint();
  revealBtn.textContent = M.reveal;
  info.hidden = false;
  starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(7 - stars);
  starsEl.title = M.difficultyLabel(String(stars), String(difficulty));
  $('goal-stars').textContent = M.difficultyLabel('★'.repeat(stars) + '☆'.repeat(7 - stars), String(difficulty));
  rulesInfo.replaceChildren();
  const add = (name: string, text: string, extra?: HTMLElement[]) => {
    const div = document.createElement('div');
    div.className = 'rule';
    const b = document.createElement('b');
    b.textContent = name;
    div.append(b, text, ...(extra ?? []));
    rulesInfo.append(div);
  };
  const kinds = new Set(p.clues.map((c) => c.type));
  if (p.walls?.length) add(M.rule.fixedWalls, M.desc.fixedWalls);
  if (kinds.has('areaNumber')) add(M.rule.areaNumber, M.desc.areaNumber);
  for (const c of p.clues) {
    if (c.type === 'range') {
      const lo = c.min;
      const hi = c.max;
      if (lo !== undefined && hi !== undefined && lo === hi) add(M.rule.precision, M.desc.precision(lo));
      else add(M.rule.range, M.desc.range(lo, hi));
    } else if (c.type === 'shapeBank') {
      const icons = c.shapes.map((k) => {
        const el = shapeIcon(k);
        el.title = shapeName(k);
        return el;
      });
      add(M.rule.shapeBank, M.desc.shapeBank, icons);
    } else if (c.type === 'rose') {
      add(M.rule.rose, M.desc.rose(['○', '△', '□', '☆'].slice(0, c.symbolCount).join(' ')));
    } else if (c.type === 'sizeSeparation') {
      add(M.rule.sizeSeparation, M.desc.sizeSeparation);
    }
  }
  if (kinds.has('polyomino')) add(M.rule.polyomino, M.desc.polyomino);
  if (kinds.has('gemini')) add(M.rule.gemini, M.desc.gemini);
  if (kinds.has('delta')) add(M.rule.delta, M.desc.delta);
  refreshStatus();
  updateButtons();
}

function setStatus(text: string, cls = ''): void {
  statusEl.textContent = text;
  statusEl.className = cls;
}

function refreshStatus(): void {
  if (!current) return;
  const c = checkCompletion(current.engine, current.ps);
  board.setComplete(c.done && !board.reveal);
  if (c.done) setStatus(c.by === 'borders' ? M.completeBorders : M.completePaint, 'ok');
  else if (c.reason === 'dangling') setStatus(M.dangling);
  else if (c.reason === 'wrong') setStatus(M.wrong);
  else setStatus('');
}

function onChange(): void {
  if (!current) return;
  if (board.reveal) hideSolution();
  resetHint();
  const v = errorMode.value === 'always' ? findViolations(current.puzzle, current.ps) : { cells: new Set<number>(), edges: new Set<number>() };
  board.errors = v.cells;
  board.errorEdges = v.edges;
  board.draw();
  refreshStatus();
  updateButtons();
  saveMarks();
}

function updateButtons(): void {
  for (const id of ['goal', 'undo', 'redo', 'clear']) $<HTMLButtonElement>(id).disabled = !current;
  if (!current) return;
  $<HTMLButtonElement>('undo').disabled = !current.ps.canUndo;
  $<HTMLButtonElement>('redo').disabled = !current.ps.canRedo;
  $<HTMLButtonElement>('clear').disabled = current.ps.isEmpty();
}

// -- wiring --------------------------------------------------------------------------

const bankBox = form.querySelector<HTMLInputElement>('#rules input[value="shapeBank"]')!;
const roseBox = form.querySelector<HTMLInputElement>('#rules input[value="rose"]')!;
const syncRows = () => {
  $('size-row').hidden = bankBox.checked;
  $('rose-row').hidden = !roseBox.checked;
};
bankBox.addEventListener('change', syncRows);
roseBox.addEventListener('change', syncRows);
syncRows();

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const o = readOptions();
  if (!o.rules.length) {
    warn(M.warnNoRules);
    return;
  }
  // Twin, unlike and size separation never forbid cutting a region in two, so
  // on their own (even with every border pre-drawn) the solution is never unique.
  if (o.rules.every((r) => r === 'gemini' || r === 'delta' || r === 'sizeSeparation')) {
    warn(M.warnCannotOutline);
    return;
  }
  // Twin regions have the same shape, hence the same area: size separation forbids exactly that.
  if (o.rules.includes('gemini') && o.rules.includes('sizeSeparation')) {
    warn(M.warnGeminiSizeSep);
    return;
  }
  startGenerate(o);
});

$('goal').addEventListener('click', () => {
  if (current) goalDialog.showModal();
});
$('goal-close').addEventListener('click', () => goalDialog.close());
goalDialog.addEventListener('click', (e) => {
  if (e.target === goalDialog) goalDialog.close();
});
$('undo').addEventListener('click', () => {
  if (current?.ps.undo()) onChange();
});
$('redo').addEventListener('click', () => {
  if (current?.ps.redo()) onChange();
});
$('clear').addEventListener('click', () => {
  if (!current) return;
  current.ps.clear();
  onChange();
});
$('eraser').addEventListener('click', () => {
  board.eraser = !board.eraser;
  $('eraser').classList.toggle('active', board.eraser);
});
$('check').addEventListener('click', () => {
  if (!current) return;
  const v = findViolations(current.puzzle, current.ps);
  board.errors = v.cells;
  board.errorEdges = v.edges;
  board.draw();
  setStatus(M.checkResult(v.cells.size, v.edges.size));
});
errorMode.addEventListener('change', () => onChange());
// Hints come in stages: where to look → what follows and why → apply it.
const hintBtn = $<HTMLButtonElement>('hint');
function resetHint(): void {
  board.hint = null;
  board.hintStage = 1;
  hintBtn.textContent = M.hint;
}
hintBtn.addEventListener('click', () => {
  if (!current) return;
  const h = board.hint;
  if (h?.kind === 'step' && board.hintStage === 1) {
    board.hintStage = 2;
    board.draw();
    setStatus(h.reason);
    hintBtn.textContent = M.hintApply;
    return;
  }
  if (h?.kind === 'step' && board.hintStage === 2) {
    const ps = current.ps;
    ps.beginChange();
    if (h.value === 'wall') ps.setEdge(h.edge, WALL);
    else {
      const g = ps.grid;
      const a = g.edgeA[h.edge];
      const b = g.edgeB[h.edge];
      const from = h.focus === a ? b : a;
      const id = ps.paint[from] || ps.newRegion(from);
      if (ps.paint[h.focus] !== id) ps.extend(h.focus, id);
    }
    onChange();
    return;
  }
  const next = nextHint(current.engine, current.ps, current.solution);
  if (!next) {
    resetHint();
    board.draw();
    setStatus(checkCompletion(current.engine, current.ps).done ? M.hintDone : M.hintNone);
    return;
  }
  board.hint = next;
  board.hintStage = 1;
  board.draw();
  if (next.kind === 'mistake') {
    setStatus(next.edge >= 0 ? M.mistakeWall : next.cells.length ? M.mistakeCells : M.mistakeOther);
    hintBtn.textContent = M.hint;
    return;
  }
  setStatus(next.where);
  hintBtn.textContent = M.hintMore;
});
function showSolution(): void {
  if (!current) return;
  board.reveal = solutionView(current.puzzle, current.solution);
  board.setComplete(false);
  resetHint();
  board.errors = new Set();
  board.errorEdges = new Set();
  board.draw();
  revealBtn.textContent = M.hideSolution;
  for (const id of ['eraser', 'check', 'hint']) $<HTMLButtonElement>(id).disabled = true;
  setStatus(M.revealing);
}

function hideSolution(): void {
  board.reveal = null;
  revealBtn.textContent = M.reveal;
  for (const id of ['eraser', 'check', 'hint']) $<HTMLButtonElement>(id).disabled = false;
}

revealBtn.addEventListener('click', () => {
  if (!current) return;
  if (board.reveal) {
    hideSolution();
    onChange();
    return;
  }
  revealDialog.showModal();
});
$('reveal-cancel').addEventListener('click', () => revealDialog.close());
$('reveal-confirm').addEventListener('click', () => {
  revealDialog.close();
  showSolution();
});
revealDialog.addEventListener('click', (e) => {
  if (e.target === revealDialog) revealDialog.close();
});

document.addEventListener('keydown', (e) => {
  if (!current) return;
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
    e.preventDefault();
    if (e.shiftKey) {
      if (current.ps.redo()) onChange();
    } else if (current.ps.undo()) onChange();
  }
});

// Safari pinch-zoom gesture events and double-tap zoom anywhere on the page.
for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, (e) => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

// -- boot ---------------------------------------------------------------------------------

const fromHash = optionsFromHash();
const last = loadLast();
if (fromHash && last && last.hash === location.hash) {
  writeOptions(fromHash);
  loadPuzzle(last.puzzle, Int32Array.from(last.solution), last.stars, last.difficulty);
  shareEl.href = location.href;
  genStatus.textContent = `seed ${fromHash.seed}`;
} else if (fromHash) {
  writeOptions(fromHash);
  startGenerate(fromHash);
} else if (last) {
  history.replaceState(null, '', last.hash);
  const o = optionsFromHash();
  if (o) writeOptions(o);
  loadPuzzle(last.puzzle, Int32Array.from(last.solution), last.stars, last.difficulty);
  shareEl.href = location.href;
} else {
  // First visit: a curated window rather than an empty stage. Shape Bank only,
  // a symmetric outline with three shapes to fit, four stars.
  const intro: GenerateOptions = { width: 7, height: 7, rules: ['shapeBank'], minSize: 2, maxSize: 6, stars: [3, 4], seed: 125, mask: 'symmetric', walls: true, roseSymbols: 2, attempts: 300 };
  writeOptions(intro);
  startGenerate(intro);
}
updateButtons();
