/*
 * Progressive reveal turns a string that arrives in whole snapshots into the impression of one
 * being typed. A polling host hands the renderer the same field over and over, each time a little
 * longer; the animation is the renderer's own idea, never the controller's, so nothing here may
 * invent text: every length this module returns is a prefix of the content it was given.
 *
 * The pacing is arithmetic, not React, so the contracts a test can hold it to are exact: the
 * revealed length never runs backwards, never passes the target, snaps whenever the content is not
 * a pure append, and spends the gap between two snapshots at a steady rate rather than in one jump.
 */

export type RevealPace = {
  /** The content the pace was last given. */
  content: string;
  /** How much of it is on screen, in source characters. */
  shown: number;
  /** How much of it should be on screen, in source characters. */
  target: number;
  /** Smoothed time between two content changes, in milliseconds. */
  interval: number;
  /** When the last change arrived. */
  changedAt: number;
  /** The segment in flight: where it began, when it starts, how long it takes. */
  from: number;
  startsAt: number;
  duration: number;
};

/*
 * The first snapshot of a surface has no history to learn from, so 750 ms is assumed — the cadence
 * a polling client usually keeps while a turn is running. Every arrival after that replaces a
 * little of the guess with the interval actually observed.
 */
const INITIAL_INTERVAL = 750;
const INTERVAL_WEIGHT = 0.4;
const MIN_INTERVAL = 150;
const MAX_INTERVAL = 4000;
/* How much of the observed gap the visible text spreads across, and how much of it is held back. */
const PACE_RATIO = 0.9;
const LAG_RATIO = 0.35;
const MIN_SEGMENT = 120;
const MAX_SEGMENT = 1200;

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** A surface that shows everything it was given: the state a fresh mount starts in. */
export function settledPace(content: string, now: number): RevealPace {
  return {
    content,
    shown: content.length,
    target: content.length,
    interval: INITIAL_INTERVAL,
    changedAt: now,
    from: content.length,
    startsAt: now,
    duration: 0,
  };
}

export function isRevealing(pace: RevealPace): boolean {
  return pace.shown < pace.target;
}

/*
 * A new snapshot. An append continues the animation from whatever is on screen; anything else —
 * a rewrite, a correction, a shorter snapshot, a different message in the same slot — is shown at
 * once. A mount never animates: the pace starts settled, so only content that grows after the
 * surface is on screen is revealed.
 */
export function observeReveal(pace: RevealPace, content: string, now: number): RevealPace {
  if (content === pace.content) {
    return pace;
  }
  if (!content.startsWith(pace.content)) {
    return { ...settledPace(content, now), interval: pace.interval };
  }
  // A surface that sat still for a while is not evidence of a slow cadence: only the recent gap
  // says how fast this content is arriving.
  const gap = Math.min(Math.max(0, now - pace.changedAt), MAX_INTERVAL);
  const interval = clamp(
    pace.interval * (1 - INTERVAL_WEIGHT) + gap * INTERVAL_WEIGHT,
    MIN_INTERVAL,
    MAX_INTERVAL,
  );
  return {
    ...pace,
    content,
    target: content.length,
    from: pace.shown,
    startsAt: now + interval * LAG_RATIO,
    duration: clamp(interval * PACE_RATIO, MIN_SEGMENT, MAX_SEGMENT),
    interval,
    changedAt: now,
  };
}

/** One frame. Before the segment starts the screen holds still; after it ends the target is shown. */
export function advanceReveal(pace: RevealPace, now: number): RevealPace {
  if (!isRevealing(pace) || now < pace.startsAt) {
    return pace;
  }
  const progress = pace.duration <= 0 ? 1 : Math.min(1, (now - pace.startsAt) / pace.duration);
  const shown = Math.min(pace.target, Math.floor(pace.from + (pace.target - pace.from) * progress));
  return shown <= pace.shown ? pace : { ...pace, shown };
}

/** Everything at once, for a surface that stops pretending: hidden tab, reduced motion, unmount. */
export function settleReveal(pace: RevealPace): RevealPace {
  return { ...pace, shown: pace.target, from: pace.target, duration: 0 };
}
