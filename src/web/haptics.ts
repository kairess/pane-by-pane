/**
 * Haptic feedback for the board: one tick per pane of glass.
 *
 * Browsers with the Vibration API (Android) get a short pulse per change.
 *
 * iOS Safari never implemented navigator.vibrate. Since iOS 17.4 the system
 * plays its "switch" haptic when an <input type=checkbox switch> is toggled,
 * and since iOS 26.5 only when a real finger does the toggling: script-driven
 * clicks are silent. WebKit does, however, also tick every time the thumb of a
 * switch visually flips while a finger is *dragging* it (its PointerTracking
 * trigger), and that path has no user-activation check because touch moves
 * are trusted events.
 *
 * So the board is covered by one invisible switch. A touch lands on it and,
 * after WebKit's 200 ms hold delay, the switch tracks the finger: the thumb
 * flips whenever the finger's position *relative to the switch* crosses the
 * middle of the track. During a gesture the switch is made twenty boards wide
 * and placed so that the finger sits far from the middle, so no flip happens
 * by accident; to play a tick, the switch is moved under the finger so that
 * the very next touchmove lands on the other side of the middle. A plain tap
 * toggles the switch on release, which plays the tick by itself.
 */

/** width of the switch during a gesture, in board widths (the middle is at 10) */
const SWITCH_WIDTH = 20;
/** where the finger is kept, in board widths from the switch's left edge */
const SIDE: [number, number] = [8, 12];
/** WebKit starts tracking the finger 200 ms after touchstart; allow for jitter */
const HOLD_MS = 260;

export class Haptics {
  private sw: HTMLInputElement | null = null;
  private vibrate: ((ms: number) => void) | null = null;
  private active = false;
  private t0 = 0;
  /** which side of the middle the finger is placed on (index into SIDE) */
  private side = 0;
  /** the switch's thumb is known to be on the finger's side (or will be on the next touchmove) */
  private exposed = true;
  /** ticks requested but not yet played */
  private pending = 0;
  /** what the last gesture did; decides whether a tap's own click may tick */
  private changed = false;
  /** a gesture began on this touch (a touch outside the window never does) */
  private began = false;

  private readonly stage: HTMLElement;
  private readonly canvas: HTMLCanvasElement;

  constructor(stage: HTMLElement, canvas: HTMLCanvasElement) {
    this.stage = stage;
    this.canvas = canvas;
    if (typeof navigator === 'undefined') return;
    if ('switch' in HTMLInputElement.prototype && navigator.maxTouchPoints > 0) {
      const sw = document.createElement('input');
      sw.type = 'checkbox';
      sw.setAttribute('switch', '');
      sw.id = 'haptic';
      sw.tabIndex = -1;
      sw.setAttribute('aria-hidden', 'true');
      if (new URLSearchParams(location.search).get('debug') === 'haptic') sw.classList.add('debug');
      stage.appendChild(sw);
      this.sw = sw;
      stage.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: true });
      stage.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
      stage.addEventListener('touchcancel', (e) => this.onTouchEnd(e), { passive: false });
    } else if (typeof navigator.vibrate === 'function') {
      this.vibrate = (ms) => {
        try {
          navigator.vibrate(ms);
        } catch {
          /* not allowed yet */
        }
      };
    }
  }

  /** true when an invisible switch sits over the board and receives the touches */
  get overlay(): boolean {
    return this.sw !== null;
  }

  /** A gesture starts (pointer down on the board). */
  begin(): void {
    this.active = true;
    this.began = true;
    this.changed = false;
    this.pending = 0;
    const sw = this.sw;
    if (!sw) return;
    this.t0 = performance.now();
    this.side = 0;
    this.exposed = true;
    sw.checked = false;
    // widen the switch and put the middle of the board 8 board-widths from its
    // left edge: wherever the finger is, it is far to the left of the middle
    const r = this.stage.getBoundingClientRect();
    this.place(r.left + r.width / 2, SIDE[0]);
  }

  /** One pane changed under the finger: play a tick. */
  tick(): void {
    if (!this.active) return;
    this.changed = true;
    if (this.vibrate) this.vibrate(8);
    else if (this.sw && this.pending < 3) this.pending++;
  }

  /** The gesture ended (pointer up). */
  end(changed: boolean): void {
    this.active = false;
    this.changed = changed;
    this.pending = 0;
    const sw = this.sw;
    if (!sw) return;
    sw.style.cssText = '';
  }

  private onTouchMove(e: TouchEvent): void {
    const sw = this.sw;
    if (!sw || !this.active) return;
    const tracking = performance.now() - this.t0 >= HOLD_MS;
    if (this.pending > 0 && this.exposed) {
      // Move the switch so the finger is now across the middle: WebKit flips
      // the thumb (and ticks) when it handles this same touchmove.
      this.pending--;
      this.side ^= 1;
      const t = e.touches[0];
      if (t) this.place(t.clientX, SIDE[this.side]);
      this.exposed = tracking;
    } else if (!this.exposed && tracking) {
      // the first touchmove after tracking began flips the thumb to this side
      this.exposed = true;
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    if (e.touches.length) return;
    // Releasing the finger toggles the switch and ticks. Let that happen for a
    // tap that changed something; a tap outside the window or on a fixed
    // border stays silent. (A drag that already ticked ends without a click
    // tick of its own.) If the pointer-up has not been seen yet, let it tick.
    const silent = !this.began || (!this.active && !this.changed);
    if (silent && e.cancelable) e.preventDefault();
    this.began = false;
  }

  /** Size and position the switch so that `clientX` lies `boards` board-widths from its left edge. */
  private place(clientX: number, boards: number): void {
    const sw = this.sw!;
    const r = this.stage.getBoundingClientRect();
    const b = this.canvas.clientWidth || r.width;
    sw.style.width = `${SWITCH_WIDTH * b}px`;
    sw.style.height = `${this.canvas.clientHeight || r.height}px`;
    sw.style.left = `${clientX - r.left - boards * b}px`;
    // force layout now: WebKit measures the finger against the switch's box
    // when it handles the touch event that is being dispatched
    void sw.offsetWidth;
  }
}
