import { createEngine } from '../engine/engine.ts';
import { shapeName } from '../engine/shape.ts';
import { RULE_KINDS, type Puzzle, type RuleKind } from '../engine/types.ts';
import type { GenerateOptions } from '../engine/generator/generate.ts';
import { checkCompletion, findViolations, nextHint } from './analysis.ts';
import { Board, shapeIcon, wallsOf } from './board.ts';
import { PlayerState } from './model.ts';
import type { WorkerIn, WorkerOut } from './worker.ts';

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
    if (info) setStatus(`이 영역: ${info.count}칸`);
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
  for (const i of form.querySelectorAll<HTMLInputElement>('#rules input')) i.checked = o.rules.includes(i.value as RuleKind);
  $('size-row').hidden = o.rules.includes('shapeBank');
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
    seed: Number(q.get('seed')),
    attempts: 300,
  };
}

// -- generation ------------------------------------------------------------------

function startGenerate(opts: GenerateOptions): void {
  if (worker) worker.terminate();
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  genBtn.disabled = true;
  genStatus.textContent = '생성 중…';
  const t0 = Date.now();
  worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
    const m = ev.data;
    if (m.type === 'progress') {
      genStatus.textContent = `생성 중… (시도 ${m.attempt})`;
      return;
    }
    genBtn.disabled = false;
    if (m.type === 'none') {
      genStatus.textContent = '이 설정으로는 퍼즐을 못 찾았습니다. 룰 조합이나 별점을 바꿔보세요.';
      return;
    }
    genStatus.textContent = `${((Date.now() - t0) / 1000).toFixed(1)}s · seed ${m.seed}`;
    const shared = { ...opts, seed: m.seed };
    history.replaceState(null, '', optionsToHash(shared));
    shareEl.href = location.href;
    loadPuzzle(m.puzzle, Int32Array.from(m.solution), m.analysis.stars, m.analysis.difficulty);
    saveLast({ puzzle: m.puzzle, solution: m.solution, stars: m.analysis.stars, difficulty: m.analysis.difficulty, hash: location.hash });
  };
  worker.onerror = (e) => {
    genBtn.disabled = false;
    genStatus.textContent = `오류: ${e.message}`;
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
  board.hypoBase = null;
  $('hypo').hidden = false;
  $('hypo-controls').hidden = true;
  board.setPuzzle(p, ps);
  info.hidden = false;
  starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(7 - stars) + `  (${difficulty})`;
  rulesInfo.replaceChildren();
  const add = (text: string, extra?: HTMLElement[]) => {
    const div = document.createElement('div');
    div.className = 'rule';
    div.append(text, ...(extra ?? []));
    rulesInfo.append(div);
  };
  const kinds = new Set(p.clues.map((c) => c.type));
  if (kinds.has('areaNumber')) add('숫자: 그 숫자가 속한 region의 칸 수');
  if (kinds.has('polyomino')) add('도형 아이콘: 그 region의 모양');
  for (const c of p.clues) {
    if (c.type === 'range') {
      const lo = c.min ?? 1;
      const hi = c.max;
      add(c.min !== undefined && c.max !== undefined && c.min === c.max ? `모든 region의 크기 = ${c.min}` : `모든 region의 크기: ${hi === undefined ? `${lo} 이상` : c.min === undefined ? `${hi} 이하` : `${lo}~${hi}`}`);
    } else if (c.type === 'shapeBank') {
      const icons = c.shapes.map((k) => {
        const el = shapeIcon(k);
        el.title = shapeName(k);
        return el;
      });
      add('모든 region은 이 모양 중 하나 (회전·반사 가능):', icons);
    } else if (c.type === 'rose') {
      add(`모든 region은 각 기호(${['○', '△', '□', '☆'].slice(0, c.symbolCount).join(' ')})를 정확히 하나씩 포함`);
    } else if (c.type === 'sizeSeparation') {
      add('인접한 두 region의 크기는 서로 다름');
    }
  }
  if (kinds.has('gemini')) add('= : 양쪽 region의 모양이 같음 (경계)');
  if (kinds.has('delta')) add('≠ : 양쪽 region의 모양이 다름 (경계)');
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
  if (c.done) setStatus(c.by === 'borders' ? '완성! ✓ (경계선)' : '완성! ✓ (색칠)', 'ok');
  else if (c.reason === 'dangling') setStatus('끊긴 벽이 있습니다');
  else if (c.reason === 'wrong') setStatus('전부 칠했지만 규칙에 맞지 않습니다');
  else setStatus('');
}

function onChange(): void {
  if (!current) return;
  board.hint = null;
  board.errors = errorMode.value === 'always' ? findViolations(current.puzzle, current.ps) : new Set();
  board.draw();
  refreshStatus();
  updateButtons();
  saveMarks();
}

function updateButtons(): void {
  if (!current) return;
  $<HTMLButtonElement>('undo').disabled = !current.ps.canUndo;
  $<HTMLButtonElement>('redo').disabled = !current.ps.canRedo;
}

// -- hypothesis mode ---------------------------------------------------------------

function enterHypothesis(): void {
  if (!current || board.hypoBase) return;
  board.hypoBase = current.ps.snapshot();
  $('hypo').hidden = true;
  $('hypo-controls').hidden = false;
  setStatus('가정 모드: 이후 표시는 반투명으로 쌓입니다. 확정하거나 버리세요.');
  board.draw();
}

function exitHypothesis(keep: boolean): void {
  if (!current) return;
  if (board.hypoBase && !keep) {
    current.ps.beginChange();
    current.ps.restore(board.hypoBase);
  }
  board.hypoBase = null;
  $('hypo').hidden = false;
  $('hypo-controls').hidden = true;
  onChange();
}

// -- wiring --------------------------------------------------------------------------

const bankBox = form.querySelector<HTMLInputElement>('#rules input[value="shapeBank"]')!;
const syncSizeRow = () => {
  $('size-row').hidden = bankBox.checked;
};
bankBox.addEventListener('change', syncSizeRow);
syncSizeRow();

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const o = readOptions();
  if (!o.rules.length) {
    genStatus.textContent = '룰을 하나 이상 고르세요.';
    return;
  }
  if (o.rules.length === 1 && o.rules[0] === 'shapeBank' && o.mask !== 'symmetric') {
    genStatus.textContent = 'Shape Bank만으로는 직사각형 격자에서 퍼즐이 거의 나오지 않습니다. 비정형 격자를 켜거나 다른 룰을 추가하세요.';
    return;
  }
  startGenerate(o);
});

$('undo').addEventListener('click', () => {
  if (current?.ps.undo()) onChange();
});
$('redo').addEventListener('click', () => {
  if (current?.ps.redo()) onChange();
});
$('clear').addEventListener('click', () => {
  if (!current) return;
  board.overlay = null;
  exitHypothesis(true);
  current.ps.clear();
  onChange();
});
$('eraser').addEventListener('click', () => {
  board.eraser = !board.eraser;
  $('eraser').classList.toggle('active', board.eraser);
});
$('hypo').addEventListener('click', enterHypothesis);
$('hypo-keep').addEventListener('click', () => exitHypothesis(true));
$('hypo-drop').addEventListener('click', () => exitHypothesis(false));
$('check').addEventListener('click', () => {
  if (!current) return;
  board.errors = findViolations(current.puzzle, current.ps);
  board.draw();
  const n = board.errors.size;
  setStatus(n ? `규칙을 어긴 칸 ${n}개를 빗금으로 표시했습니다` : '지금까지의 표시는 규칙을 어기지 않습니다');
});
errorMode.addEventListener('change', () => onChange());
$('hint').addEventListener('click', () => {
  if (!current) return;
  const h = nextHint(current.engine, current.ps);
  if (h === 'error') {
    setStatus('현재 표시대로는 풀 수 없습니다. 어딘가 잘못된 표시가 있습니다.');
    return;
  }
  if (!h) {
    setStatus('더 이상 단순한 추론을 찾지 못했습니다.');
    return;
  }
  board.hint = h;
  board.draw();
  setStatus(`${h.value === 'wall' ? '경계선' : '연결'}: ${h.label}`);
});
$('reveal').addEventListener('click', () => {
  if (!current) return;
  board.overlay = board.overlay ? null : wallsOf(current.ps.grid, current.solution);
  board.draw();
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
}
