import { cleanup, render, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { Markdown } from "../src/markdown.js";

const first = "第一段。";
const second = "第一段。\n\n第二段还在写，而且重点在这里。";
const emphasised = "结论：\n\n**重点**在这里。";

const visible = (text: string) => text.replace(/\s/g, "");

afterEach(() => {
  cleanup();
});

describe("reveal", () => {
  it("shows a mounted surface in full, animation or not", () => {
    const html = renderToStaticMarkup(<Markdown content={second} reveal />);
    expect(html).toContain("第二段还在写");
    expect(renderToStaticMarkup(<Markdown content={emphasised} reveal />)).toContain(
      "<strong>重点</strong>",
    );
  });

  it("reveals an append frame by frame, and every frame is a prefix of the snapshot", async () => {
    const { container, rerender } = render(<Markdown content={first} reveal />);
    expect(visible(container.textContent ?? "")).toBe(visible(first));

    rerender(<Markdown content={second} reveal />);
    const samples: string[] = [];
    // waitFor 只在回调抛错时重试，所以推进用 expect：每一帧都记下来，直到整段落地。
    await waitFor(
      () => {
        const text = visible(container.textContent ?? "");
        samples.push(text);
        expect(text).toBe(visible(second));
      },
      { timeout: 5_000, interval: 20 },
    );

    const target = visible(second);
    expect(samples.length).toBeGreaterThan(2);
    for (const sample of samples) {
      expect(target.startsWith(sample)).toBe(true);
    }
    // 中间至少有一帧比开头的多、比结尾的少：它确实是在长，而不是一次性出现。
    expect(samples.some((sample) => sample.length > first.length && sample !== target)).toBe(true);
  });

  it("never shows Markdown syntax as the reveal cuts through a construct", async () => {
    const { container, rerender } = render(<Markdown content="结论：" reveal />);
    rerender(<Markdown content={emphasised} reveal />);
    const samples: string[] = [];
    await waitFor(
      () => {
        samples.push(container.textContent ?? "");
        expect(container.querySelector("strong")?.textContent).toBe("重点");
      },
      { timeout: 5_000, interval: 20 },
    );
    expect(samples.every((sample) => !sample.includes("*"))).toBe(true);
  });

  it("snaps to a rewritten snapshot instead of replaying the old one", () => {
    const { container, rerender } = render(<Markdown content={first} reveal />);
    rerender(<Markdown content="换掉的整段内容。" reveal />);
    expect(container.textContent).toBe("换掉的整段内容。");
  });

  it("renders exactly like the plain surface when reveal is off", () => {
    expect(renderToStaticMarkup(<Markdown content={second} />)).toBe(
      renderToStaticMarkup(<Markdown content={second} reveal={false} />),
    );
    expect(renderToStaticMarkup(<Markdown content={second} reveal={false} />)).not.toContain(
      "data-revealing",
    );
  });

  it("marks a live surface so the caret has something to hang on", () => {
    expect(renderToStaticMarkup(<Markdown content={first} reveal />)).toContain("data-revealing");
  });
});
