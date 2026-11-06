import { describe, expect, it } from "vitest";

import { advanceReveal, isRevealing, observeReveal, settledPace, settleReveal } from "../src/reveal.js";

const first = "第一段。";
const frame = 1000 / 60;

function advance(pace: ReturnType<typeof settledPace>, frames: number, from: number) {
  const seen: number[] = [];
  let at = from;
  for (let index = 0; index < frames; index += 1) {
    at += frame;
    pace = advanceReveal(pace, at);
    seen.push(pace.shown);
  }
  return { pace, seen, at };
}

describe("reveal pacing", () => {
  it("mounts settled, so a surface never types out what it already had", () => {
    const pace = settledPace(first, 1_000);
    expect(pace.shown).toBe(first.length);
    expect(isRevealing(pace)).toBe(false);
  });

  it("moves on the very next frame, with no dead time to wait out", () => {
    const pace = observeReveal(settledPace(first, 0), `${first}第二段。`, 1_000);
    const next = advanceReveal(pace, 1_000 + frame);
    expect(next.shown).toBeGreaterThan(first.length);
    // 一帧只走一帧的量：不是憋一会儿再一口气跳出去。
    expect(next.shown).toBeLessThan(first.length + 2);
  });

  it("keeps one velocity across snapshots, so a staircase of arrivals reads as a line", () => {
    // 连续帧 + 每 375ms 到 90 个字：真实宿主的样子（帧不停，快照一跳一跳）。
    let content = "x".repeat(10);
    let pace = settledPace(content, 0);
    let nextPoll = 375;
    const frames: { shown: number; target: number }[] = [];
    for (let at = frame; at <= 3_000; at += frame) {
      if (at >= nextPoll) {
        content += "y".repeat(90);
        pace = observeReveal(pace, content, at);
        nextPoll += 375;
      }
      pace = advanceReveal(pace, at);
      frames.push({ shown: pace.shown, target: pace.target });
    }

    const deltas: number[] = [];
    const stalls: number[] = [];
    for (let index = 1; index < frames.length; index += 1) {
      const behind = frames[index - 1].shown < frames[index - 1].target - 0.01;
      const delta = frames[index].shown - frames[index - 1].shown;
      if (behind) {
        deltas.push(delta);
        if (delta === 0) stalls.push(index);
      }
    }
    // 只要还有字没露出来，就一帧都没有停过。
    expect(stalls).toEqual([]);
    const mean = deltas.reduce((total, value) => total + value, 0) / deltas.length;
    // 也没有哪一帧是一次性倒出来的：最快的一帧不到平均的三倍。
    expect(Math.max(...deltas)).toBeLessThan(mean * 1.5);
  });

  it("never runs backwards, never passes the target, and catches up once the arrivals stop", () => {
    let pace = settledPace("x".repeat(20), 0);
    let content = "x".repeat(20);
    let at = 0;
    let previous = pace.shown;
    for (let poll = 0; poll < 6; poll += 1) {
      at += 250;
      content += "z".repeat(120);
      pace = observeReveal(pace, content, at);
      const step = advance(pace, 15, at);
      pace = step.pace;
      at = step.at;
      for (const value of step.seen) {
        expect(value).toBeGreaterThanOrEqual(previous);
        expect(value).toBeLessThanOrEqual(content.length);
        previous = value;
      }
    }
    const rest = advance(pace, 240, at);
    expect(rest.pace.shown).toBe(content.length);
    expect(isRevealing(rest.pace)).toBe(false);
  });

  it("catches a much larger snapshot up by speed, never by dropping characters in", () => {
    const small = observeReveal(settledPace("x".repeat(10), 0), "x".repeat(70), 300);
    const huge = observeReveal(small, "x".repeat(5_000), 600);

    const first = advanceReveal(huge, 600 + frame);
    const jump = first.shown - huge.shown;
    expect(jump).toBeGreaterThan(0);
    // 一帧最多走「速率上限 × 一帧能覆盖的时间」（这里封面最多按 100ms 计）：一大段不会被一次性倒出来。
    expect(jump).toBeLessThanOrEqual(1.6 * 100 + 0.001);

    const later = advance(first, 120, 600 + frame);
    expect(later.pace.shown).toBeGreaterThan(3_000);
  });

  it("shows a correction or a shorter snapshot at once instead of replaying it", () => {
    const animating = observeReveal(settledPace(first, 0), `${first}第二段还在写。`, 1_000);
    const shorter = observeReveal(animating, first, 1_200);
    expect(shorter.shown).toBe(first.length);
    expect(isRevealing(shorter)).toBe(false);

    const edited = observeReveal(animating, `${first}第二段写完了。`, 1_200);
    expect(edited.shown).toBe(`${first}第二段写完了。`.length);
    expect(isRevealing(edited)).toBe(false);
  });

  it("settles everything at once when asked to stop pretending", () => {
    const animating = observeReveal(settledPace(first, 0), `${first}还在写。`, 1_000);
    const settled = settleReveal(animating);
    expect(settled.shown).toBe(settled.target);
    expect(isRevealing(settled)).toBe(false);
  });

  it("ignores the same snapshot arriving again", () => {
    const pace = settledPace("一段已经说完的话。", 1_000);
    expect(observeReveal(pace, "一段已经说完的话。", 1_400)).toBe(pace);
  });
});
