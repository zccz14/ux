import { describe, expect, it } from "vitest";

import { advanceReveal, isRevealing, observeReveal, settledPace, settleReveal } from "../src/reveal.js";

const first = "第一段。";
const second = "第一段。\n\n第二段还在写，还会继续写下去。";

describe("reveal pacing", () => {
  it("mounts settled, so a surface never types out what it already had", () => {
    const pace = settledPace(first, 1_000);
    expect(pace.shown).toBe(first.length);
    expect(isRevealing(pace)).toBe(false);
  });

  it("holds still during the lag, then advances monotonically up to the target", () => {
    const initial = settledPace(first, 0);
    let pace = observeReveal(initial, second, 1_000);
    expect(isRevealing(pace)).toBe(true);
    expect(advanceReveal(pace, 1_050).shown).toBe(first.length);

    let previous = pace.shown;
    for (let at = 1_000; at <= 4_000; at += 16) {
      pace = advanceReveal(pace, at);
      expect(pace.shown).toBeGreaterThanOrEqual(previous);
      expect(pace.shown).toBeLessThanOrEqual(second.length);
      previous = pace.shown;
    }
    expect(pace.shown).toBe(second.length);
    expect(isRevealing(pace)).toBe(false);
  });

  it("spreads an append over several frames instead of jumping to the end", () => {
    const pace = observeReveal(settledPace(first, 0), second, 1_000);
    const firstFrame = advanceReveal(pace, pace.startsAt + 60);
    expect(firstFrame.shown).toBeGreaterThan(first.length);
    expect(firstFrame.shown).toBeLessThan(second.length);
  });

  it("shows a rewrite or a shorter snapshot at once rather than animating out of date text", () => {
    const animating = observeReveal(settledPace(first, 0), second, 1_000);
    const rewritten = observeReveal(animating, "完全不同的内容。", 1_200);
    expect(rewritten.shown).toBe("完全不同的内容。".length);
    expect(isRevealing(rewritten)).toBe(false);

    const shorter = observeReveal(animating, first, 1_200);
    expect(shorter.shown).toBe(first.length);
    expect(isRevealing(shorter)).toBe(false);
  });

  it("keeps the interval it already learned when the snapshot is rewritten", () => {
    let pace = settledPace(first, 0);
    pace = observeReveal(pace, `${first}a`, 500);
    expect(pace.interval).toBeGreaterThan(500);
    expect(pace.interval).toBeLessThan(750);
    const rewritten = observeReveal(pace, "换一段。", 1_000);
    expect(rewritten.interval).toBe(pace.interval);
  });

  it("settles everything at once when asked to stop pretending", () => {
    const animating = observeReveal(settledPace(first, 0), second, 1_000);
    const settled = settleReveal(animating);
    expect(settled.shown).toBe(second.length);
    expect(isRevealing(settled)).toBe(false);
  });

  it("ignores the same snapshot arriving again", () => {
    const pace = settledPace(second, 1_000);
    expect(observeReveal(pace, second, 1_400)).toBe(pace);
  });
});
