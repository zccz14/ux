import { cleanup, render, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Markdown } from "../src/markdown.js";

const mermaidModule = vi.hoisted(() => ({
  loads: 0,
  initialize: vi.fn(),
  render: vi.fn(async (id: string) => ({ svg: `<svg data-diagram="${id}"></svg>` })),
}));

vi.mock("mermaid", () => {
  mermaidModule.loads += 1;
  return { default: { initialize: mermaidModule.initialize, render: mermaidModule.render } };
});

function staticHtml(content: string): string {
  return renderToStaticMarkup(<Markdown content={content} />);
}

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
});

describe("links", () => {
  it("opens off-site links in a new tab and marks them as external", () => {
    const html = staticHtml('请查阅 [Cybion 文档](https://github.com/zccz14/cybion "仓库")。');
    expect(html).toContain('href="https://github.com/zccz14/cybion"');
    expect(html).toContain('title="仓库"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toMatch(/>Cybion 文档<svg[^>]*class="ux-markdown__external-link"/);
  });

  it("keeps in-page anchors and relative paths in place, and refuses unsafe URLs", () => {
    const html = staticHtml(
      "[站内](#配置) [相对](/docs/x) [坏链](javascript:alert(1)) [外站](https://example.com)",
    );
    expect(html).toMatch(/<a href="#[^\"]*">站内<[/]a>/);
    expect(html).toMatch(/<a href="[/]docs[/]x">相对<[/]a>/);
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain("javascript:");
    expect(html).toContain("<span>坏链</span>");
  });

  it("renders every surface inside the shared typographic wrapper", () => {
    expect(staticHtml("正文")).toContain('class="ux-markdown"');
  });
});

describe("tables and task lists", () => {
  it("gives a table its own scroller", () => {
    const html = staticHtml("| 功能 | 说明 |\n| --- | --- |\n| 表格 | 自带横滚 |");
    expect(html).toContain('class="ux-markdown__table"');
    expect(html).toContain("<table>");
    expect(html).not.toContain("[object Object]");
  });

  it("renders GFM task lists with checkboxes instead of bullets", () => {
    const html = staticHtml("- [x] 已完成\n- [ ] 未完成");
    expect(html).toContain("contains-task-list");
    expect(html).toContain("task-list-item");
    expect(html).toContain('type="checkbox"');
  });
});

describe("math", () => {
  it("renders inline, display, LaTeX-delimited and fenced math through KaTeX", () => {
    const inline = staticHtml("质能方程 $E=mc^2$ 把质量与能量联系起来。");
    expect(inline).toContain('<span class="katex">');
    expect(inline).toContain("质能方程");

    const display = staticHtml("求和公式：\n\n$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$");
    expect(display).toContain("katex-display");

    const latex = staticHtml("其中 \\(\\alpha+\\beta\\) 是两个系数。\n\n\\[ p=\\sigma\\left(\\frac{\\mu}{T}\\right) \\]");
    expect(latex).toContain('<span class="katex">');
    expect(latex).toContain("katex-display");
    expect(latex).toContain("是两个系数");

    const fenced = staticHtml("```math\na^2 + b^2 = c^2\n```\n\n```ts\nconst answer = 42\n```");
    expect(fenced).toContain("katex-display");
    expect(fenced).toContain('<code class="language-ts">const answer = 42');
  });

  it("keeps code literal and a TeX line break inside one formula", () => {
    const fences = staticHtml("```ts\nconst x = \\[ a \\]\n```\n\n行内 \\(y\\) 写成 `\\[ z \\]`。");
    expect(fences).toContain("const x = \\[ a \\]");
    expect(fences).toContain("<code>\\[ z \\]</code>");
    expect(fences).toContain('<span class="katex">');

    const aligned = staticHtml("$$\n\\begin{aligned}\na &= b \\\\[2pt]\nc &= d\n\\end{aligned}\n$$");
    expect((aligned.match(/class="katex-display"/g) ?? []).length).toBe(1);
    expect(aligned).not.toContain("katex-error");
  });

  it("degrades broken math and leaves streaming math as source", () => {
    const broken = staticHtml("坏掉的公式 $\\frac{$ 不应打断渲染");
    expect(broken).toMatch(/<span class="katex-error" title="/);
    expect(broken).toContain("color:var(--ux-destructive)");
    expect(broken).toContain("不应打断渲染");

    const partial = staticHtml("还在输出：\\[ p=\\sigma");
    expect(partial).not.toContain("katex");
    expect(partial).toContain("p=");
  });
});

describe("mermaid", () => {
  it("loads mermaid only when a diagram is actually rendered", () => {
    expect(mermaidModule.loads).toBe(0);
    render(<Markdown content={"```ts\nconst answer = 42\n```"} />);
    expect(mermaidModule.loads).toBe(0);
  });

  it("serves the fence as source when rendered without a browser", () => {
    const html = staticHtml("```mermaid\ngraph TD\n  A --> B\n```");
    expect(html).toContain('data-mermaid="source"');
    expect(html).toContain("graph TD");
    expect(html).not.toContain('data-mermaid="diagram"');
    expect(staticHtml("行内 `mermaid` 代码")).toContain("<code>mermaid</code>");
  });

  it("replaces the fence with the diagram once mermaid resolves", async () => {
    const { container } = render(<Markdown content={"```mermaid\ngraph TD\n  A --> B\n```"} />);
    expect(container.querySelector('[data-mermaid="source"]')).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector('[data-mermaid="diagram"]')).toBeInTheDocument();
    });
    expect(container.querySelector(".ux-markdown__mermaid svg")).toBeInTheDocument();
    expect(mermaidModule.render).toHaveBeenCalled();
  });

  it("renders with the palette of the theme in force when the diagram settles", async () => {
    document.documentElement.classList.add("dark");
    render(<Markdown content={"```mermaid\ngraph TD\n  A --> B\n```"} />);
    await waitFor(() => {
      expect(mermaidModule.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ startOnLoad: false, securityLevel: "strict", theme: "dark" }),
      );
    });
  });

  it("falls back to the source block when a diagram cannot be parsed", async () => {
    mermaidModule.render.mockRejectedValueOnce(new Error("parse error"));
    const { container } = render(<Markdown content={"```mermaid\ngraph TD\n  A ---\n```"} />);
    await waitFor(() => {
      expect(mermaidModule.render).toHaveBeenCalled();
    });
    expect(container.querySelector('[data-mermaid="source"]')).toBeInTheDocument();
    expect(container.querySelector('[data-mermaid="diagram"]')).not.toBeInTheDocument();
  });
});
