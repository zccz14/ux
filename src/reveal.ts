/*
 * Progressive reveal turns a string that arrives in whole snapshots into the impression of one
 * being typed.
 *
 * The input is a staircase: a polling host hands the renderer the same field again every few
 * hundred milliseconds, each time a few hundred characters longer. Any animation scheduled one
 * segment per snapshot inherits that staircase — it runs, it stops, it runs again — because the
 * dead time between two snapshots has nothing left to show. So this module does not schedule
 * segments; it keeps one continuous velocity, learns it from the characters that actually arrive
 * per millisecond, and moves the screen along that velocity every frame. A staircase driven at its
 * own average rate comes out as a straight line.
 *
 * The velocity is a follower, not a plan: it survives snapshots and is only ever nudged towards
 * what has been observed, and the screen is never allowed to fall more than about one snapshot
 * behind the truth — so the smoothing can never turn into a growing lag.
 *
 * Nothing here may invent text: every length it returns is a prefix of the content it was given.
 */

export type RevealPace = {
  /** The content the pace was last given. */
  content: string;
  /** Source characters on screen. Fractional — the caller rounds for rendering. */
  shown: number;
  /** Source characters received. */
  target: number;
  /** Characters per millisecond, smoothed across snapshots. */
  rate: number;
  /** Smoothed time between two snapshots, in milliseconds. */
  interval: number;
  /** When the last snapshot arrived. */
  changedAt: number;
  /** When the reveal last advanced, so a frame knows how much time it covers. */
  advancedAt: number;
  /** How slowly a drift is corrected, in milliseconds: longer is gentler. */
  catchUpTime: number;
};

/*
 * The first snapshot of a surface has no history to learn from, so 750 ms is assumed — the cadence
 * a polling client usually keeps while a turn is running. Every arrival after that replaces a
 * little of the guess with what was actually measured.
 */
const INITIAL_INTERVAL = 750;
const INTERVAL_WEIGHT = 0.4;
const RATE_WEIGHT = 0.35;
const MIN_INTERVAL = 60;
const MAX_INTERVAL = 4000;
/* Two snapshots cannot be closer than a frame; a shorter gap would read as a nonsensical rate. */
const MIN_GAP = 16;
/* A pathological snapshot is typed faster, not forever. */
const MAX_RATE = 1.6;
/*
 * How long the screen takes to close a gap it has fallen behind by. Catching up is the velocity's
 * job, never a jump in position: a step in the text is exactly the artefact this module exists to
 * remove, and a proportional acceleration is invisible where a snap is not.
 */

/*
 * A gap is closed over this many snapshots: the corrector may speed the text up, but only as
 * gently as a reader would still read it as one steady motion.
 */
const CATCHUP_SNAPSHOTS = 1.5;
/* A frame that took longer than this (a backgrounded tab) is not spent replaying the gap. */
const MAX_FRAME = 100;

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** A surface that shows everything it was given: the state a fresh mount starts in. */
export function settledPace(content: string, now: number): RevealPace {
  return {
    content,
    shown: content.length,
    target: content.length,
    rate: 0,
    interval: INITIAL_INTERVAL,
    changedAt: now,
    advancedAt: now,
    catchUpTime: INITIAL_INTERVAL * CATCHUP_SNAPSHOTS,
  };
}

export function isRevealing(pace: RevealPace): boolean {
  return pace.shown < pace.target;
}

/*
 * A new snapshot.
 *
 * An append measures how many characters arrived and how long they took, and nudges the velocity
 * towards that measurement — one nudge, not a new schedule, which is what keeps the motion
 * continuous across snapshots.
 *
 * Anything that is not an append — a correction, a shorter snapshot, a different text in the same
 * slot — is shown at once. Retyping what a reader has already read would hide a fix behind a
 * replay, and the screen must never describe text the caller no longer holds.
 *
 * A mount never animates: the pace starts settled, so only content that arrives after the surface
 * is on screen is revealed.
 */
export function observeReveal(pace: RevealPace, content: string, now: number): RevealPace {
  if (content === pace.content) {
    return pace;
  }
  const gap = clamp(now - pace.changedAt, MIN_GAP, MAX_INTERVAL);
  const interval = clamp(
    pace.interval * (1 - INTERVAL_WEIGHT) + gap * INTERVAL_WEIGHT,
    MIN_INTERVAL,
    MAX_INTERVAL,
  );
  if (!content.startsWith(pace.content)) {
    return { ...settledPace(content, now), interval };
  }
  const added = content.length - pace.content.length;
  /*
   * The first snapshot of a surface has no rate to nudge yet, and it often arrives a millisecond
   * after the mount that showed it: measured over that gap alone it would fly past in a single
   * frame. It is measured over the cadence the surface is settling into instead.
   */
  const observed =
    pace.rate === 0 ? added / Math.max(gap, Math.min(pace.interval, MAX_INTERVAL)) : added / gap;
  const rate =
    pace.rate === 0
      ? Math.min(observed, MAX_RATE)
      : clamp(pace.rate * (1 - RATE_WEIGHT) + observed * RATE_WEIGHT, 0, MAX_RATE);
  return { ...pace, content, target: content.length, rate, interval, changedAt: now };
}

/** One frame. */
export function advanceReveal(pace: RevealPace, now: number): RevealPace {
  const dt = clamp(now - pace.advancedAt, 0, MAX_FRAME);
  if (!isRevealing(pace) || dt === 0) {
    return { ...pace, advancedAt: now };
  }
  /*
   * Two terms, both of them speed.
   *
   * The feed-forward one is the velocity learned from the snapshots. Being one snapshot behind is
   * not a fault — it is how the smoothing works — so the corrector only reacts to what is behind
   * *on top of* that baseline: a rate learned on small arrivals that now meets big ones, or a
   * burst that would otherwise queue up. It corrects by speeding up for a while, never by dropping
   * characters in all at once, because a step in the text is the artefact this module exists to
   * remove.
   */
  const drift = pace.target - pace.shown - pace.rate * pace.interval;
  const rate = Math.min(MAX_RATE, pace.rate + Math.max(0, drift) / pace.catchUpTime);
  return { ...pace, shown: Math.min(pace.target, pace.shown + rate * dt), advancedAt: now };
}

/** Everything at once, for a surface that stops pretending: hidden tab, reduced motion, unmount. */
export function settleReveal(pace: RevealPace): RevealPace {
  return { ...pace, shown: pace.target, rate: 0 };
}
