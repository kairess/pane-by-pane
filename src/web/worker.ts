import { generate, type GenerateOptions } from '../engine/generator/generate.ts';
import type { LogicalResult } from '../engine/logical.ts';
import type { Puzzle } from '../engine/types.ts';

/** Messages between the page and the generator worker. */
export type WorkerIn = { type: 'generate'; opts: GenerateOptions };
export type WorkerOut =
  | { type: 'progress'; attempt: number; reason: string }
  | { type: 'result'; puzzle: Puzzle; solution: number[]; analysis: Omit<LogicalResult, 'labels'>; seed: number }
  | { type: 'none' };

const post = (m: WorkerOut) => (self as unknown as { postMessage(m: unknown): void }).postMessage(m);

self.addEventListener('message', (ev: MessageEvent<WorkerIn>) => {
  const msg = ev.data;
  if (msg.type !== 'generate') return;
  const r = generate({
    ...msg.opts,
    onAttempt: (i) => post({ type: 'progress', attempt: i.attempt, reason: i.reason }),
  });
  if (!r) {
    post({ type: 'none' });
    return;
  }
  const { labels: _labels, ...analysis } = r.analysis;
  post({ type: 'result', puzzle: r.puzzle, solution: Array.from(r.solution), analysis, seed: r.seed });
});
