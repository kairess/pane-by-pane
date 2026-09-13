import { edgeBetween, makeGrid } from './grid.ts';
import { shapeName } from './shape.ts';
import type { Labels, Puzzle } from './types.ts';

const ROSE_GLYPHS = ['○', '△', '□', '☆', '◇', '♡'];

/**
 * ASCII rendering of a puzzle, optionally with a solution's borders drawn.
 * Cell contents show clues; Gemini/Delta markers are drawn on the edge.
 * Holes are drawn as blank space outside the board.
 */
export function render(puzzle: Puzzle, labels?: Labels): string {
  const g = makeGrid(puzzle.width, puzzle.height, puzzle.holes ?? []);
  const cellText: string[] = Array.from({ length: g.cells }, () => ' ');
  const edgeMark = new Map<number, string>();
  const fixed = new Set((puzzle.walls ?? []).map((w) => edgeBetween(g, w.a, w.b)));
  const globals: string[] = [];
  for (const c of puzzle.clues) {
    switch (c.type) {
      case 'areaNumber':
        cellText[c.cell] = String(c.value);
        break;
      case 'polyomino':
        cellText[c.cell] = 'P';
        globals.push(`polyomino @${c.cell}: ${shapeName(c.shape)}`);
        break;
      case 'rose':
        for (const s of c.symbols) cellText[s.cell] = ROSE_GLYPHS[s.symbol] ?? String(s.symbol);
        break;
      case 'gemini':
      case 'delta': {
        const e = edgeBetween(g, c.edge.a, c.edge.b);
        if (e < 0) throw new Error(`cells ${c.edge.a},${c.edge.b} are not adjacent`);
        edgeMark.set(e, c.type === 'gemini' ? '=' : '≠');
        break;
      }
      case 'range':
        globals.push(`range ${c.min ?? '-'}..${c.max ?? '-'}`);
        break;
      case 'shapeBank':
        globals.push(`bank [${c.shapes.map(shapeName).join(', ')}]`);
        break;
      case 'sizeSeparation':
        globals.push('size separation');
        break;
    }
  }
  const act = (x: number, y: number) => x >= 0 && y >= 0 && x < g.w && y < g.h && g.active[y * g.w + x] === 1;
  /** border between two positions: '' none (both holes), 'wall', 'open', or a marker */
  const border = (ax: number, ay: number, bx: number, by: number): string => {
    const a = act(ax, ay);
    const b = act(bx, by);
    if (!a && !b) return '';
    if (a !== b) return 'wall';
    const e = edgeBetween(g, ay * g.w + ax, by * g.w + bx);
    const m = edgeMark.get(e);
    if (m) return m;
    if (fixed.has(e)) return 'fixed';
    if (labels && labels[ay * g.w + ax] !== labels[by * g.w + bx]) return 'wall';
    return 'open';
  };
  const lines: string[] = [];
  for (let y = 0; y <= g.h; y++) {
    // horizontal separator line
    let s = '';
    for (let x = 0; x < g.w; x++) {
      const b = border(x, y - 1, x, y);
      const corner = act(x, y) || act(x, y - 1) || act(x - 1, y) || act(x - 1, y - 1) ? '+' : ' ';
      s += corner + (b === '' ? '   ' : b === 'wall' ? '---' : b === 'fixed' ? '═══' : b === 'open' ? '   ' : ` ${b} `);
    }
    s += act(g.w - 1, y) || act(g.w - 1, y - 1) ? '+' : ' ';
    lines.push(s.trimEnd());
    if (y === g.h) break;
    let r = '';
    for (let x = 0; x <= g.w; x++) {
      const b = border(x - 1, y, x, y);
      r += b === '' ? ' ' : b === 'wall' ? '|' : b === 'fixed' ? '║' : b === 'open' ? ' ' : b;
      if (x < g.w) r += act(x, y) ? ` ${cellText[y * g.w + x]} ` : '   ';
    }
    lines.push(r.trimEnd());
  }
  if (globals.length) lines.push(globals.join(' | '));
  return lines.join('\n');
}

/** Region labels as a letter grid, e.g. "AABB\\nACCB" ('.' for holes). */
export function renderLabels(width: number, labels: Labels): string {
  const rows: string[] = [];
  for (let y = 0; y * width < labels.length; y++) {
    let s = '';
    for (let x = 0; x < width; x++) {
      const l = labels[y * width + x];
      s += l < 0 ? '.' : String.fromCharCode(65 + (l % 26));
    }
    rows.push(s);
  }
  return rows.join('\n');
}
