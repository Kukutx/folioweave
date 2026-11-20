import { createContext } from "react";
/** Set by Envelope when it is torn open: `at` = performance.now() of the release (−1 while sealed); a
 *  listener that sleeps until then is woken at that moment. Outside an envelope there is no clock and the
 *  contents are simply open. (A small object with methods, so that it can live in React state.) */
export class Clock {
  at = -1;
  private wake?: () => void;
  release(at: number) {
    this.at = at;
    this.wake?.();
  }
  listen(fn: (() => void) | undefined) {
    this.wake = fn;
  }
  isListening(fn: () => void) {
    return this.wake === fn;
  }
}
export const EnvelopeClock = createContext<Clock | null>(null);
