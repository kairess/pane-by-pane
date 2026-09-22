/**
 * Drive the built web app in headless Chrome over the DevTools protocol and
 * take screenshots: paints a region across an area-number clue (error
 * hatching on a clue cell), double-taps a painted cell (walls around the
 * region), long-presses an empty cell (area counter).
 *
 *   npm run build
 *   npx vite preview --port 4173 --strictPort &
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
 *       --remote-debugging-port=9333 --user-data-dir=/tmp/pbp-chrome about:blank &
 *   node scripts/ui-drive.mjs /tmp/shots
 *
 * Screenshots land in the given directory as ui-hatch.png, ui-doubletap.png,
 * ui-longpress.png. Board geometry: canvas padding 12 css px, cell =
 * (canvas width - 24) / columns. The first-visit coach bubble overlays the
 * top rows and swallows pointer events, so it is dismissed first.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const out = process.argv[2] ?? '.';
mkdirSync(out, { recursive: true });
const url = process.argv[3] ?? 'http://localhost:4173/#w=6&h=6&rules=areaNumber,gemini,delta&stars=1-3&mask=0&walls=0&rose=2&seed=3';
const W = Number(new URL(url).hash.match(/w=(\d+)/)?.[1] ?? 6);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch('http://localhost:9333/json')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) {
    pending.get(d.id)(d);
    pending.delete(d.id);
  }
  if (d.method === 'Runtime.exceptionThrown') console.log('PAGE EXCEPTION:', JSON.stringify(d.params.exceptionDetails).slice(0, 400));
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 700, height: 760, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url });
for (let i = 0; i < 60; i++) {
  await sleep(500);
  if (await evaluate(`!!localStorage.getItem('pbp:last') && document.getElementById('status').textContent.length > 0`)) break;
}
await sleep(500);
await evaluate(`document.getElementById('coach-ok')?.click(); 'ok'`);
await sleep(200);

const geo = await evaluate(`(() => { const r = document.getElementById('board').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width }; })()`);
const pad = 12;
const cell = (geo.w - 2 * pad) / W;
const at = (cx, cy) => ({ x: geo.x + pad + (cx + 0.5) * cell, y: geo.y + pad + (cy + 0.5) * cell });
const mouse = (type, p, extra = {}) => send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', pointerType: 'mouse', ...extra });
const press = (p) => mouse('mousePressed', p, { clickCount: 1 });
const release = (p) => mouse('mouseReleased', p, { clickCount: 1 });
const tap = async (cx, cy) => { const p = at(cx, cy); await press(p); await sleep(40); await release(p); };
const drag = async (cells) => {
  const p0 = at(...cells[0]);
  await press(p0);
  for (const c of cells.slice(1)) {
    const p = at(...c);
    for (let k = 1; k <= 4; k++) {
      await mouse('mouseMoved', { x: p0.x + ((p.x - p0.x) * k) / 4, y: p0.y + ((p.y - p0.y) * k) / 4 }, { buttons: 1 });
      await sleep(15);
    }
  }
  await release(at(...cells[cells.length - 1]));
};
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${out}/${name}.png`, Buffer.from(r.result.data, 'base64'));
};

const clues = await evaluate(`JSON.parse(localStorage.getItem('pbp:last')).puzzle.clues`);
const nums = clues.filter((c) => c.type === 'areaNumber').sort((a, b) => a.value - b.value);
const target = nums.find((c) => Math.floor(c.cell / W) >= 2) ?? nums[0];
const tx = target.cell % W;
const ty = Math.floor(target.cell / W);
// 1) too many cells across the clue -> error hatching on a clue cell
const path = [[tx, ty]];
for (let k = 1; k <= target.value; k++) path.push([tx + k < W ? tx + k : tx - k, ty]);
await drag(path);
await sleep(300);
await shot('ui-hatch');
// 2) double-tap a painted cell -> walls around the region
await tap(path[1][0], path[1][1]);
await sleep(120);
await tap(path[1][0], path[1][1]);
await sleep(300);
await shot('ui-doubletap');
// 3) long-press an empty cell -> area of the joined empty cells
const pe = at(tx, ty === 0 ? 3 : 0);
await press(pe);
await sleep(700);
console.log('status during long-press:', await evaluate(`document.getElementById('status').textContent`));
await shot('ui-longpress');
await release(pe);
ws.close();
console.log('done ->', out);
