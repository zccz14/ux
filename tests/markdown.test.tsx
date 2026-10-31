import { cleanup, render, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Markdown } from "../src/markdown.js";

const mermaidModule = vi.hoisted(() => ({
  loads: 0,
  initialize: vi.fn(),
  render: vi.fn(async (id: string) => ({ svg: `<svg data-diagram="${id}"></svg>` })),
}));

const katexModule = vi.hoisted(() => ({ loads: 0 }));

vi.mock("mermaid", () => {
  mermaidModule.loads += 1;
  return { default: { initialize: mermaidModule.initialize, render: mermaidModule.render } };
});

vi.mock("rehype-katex", async (importOriginal) => {
  katexModule.loads += 1;
  return importOriginal();
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
  it("does not load the math pipeline for content without a formula", () => {
    expect(katexModule.loads).toBe(0);
    const { container } = render(<Markdown content={"# 标题\n\n普通段落、`code` 与 **粗体**。"} />);
    expect(container.querySelector(".katex")).not.toBeInTheDocument();
    expect(katexModule.loads).toBe(0);
  });

  it("loads the pipeline once and renders inline math", async () => {
    const { container } = render(<Markdown content={"质能方程 $E=mc^2$ 把质量与能量联系起来。"} />);
    await waitFor(() => {
      expect(container.querySelector(".katex")).toBeInTheDocument();
    });
    expect(container.textContent).toContain("质能方程");
    expect(katexModule.loads).toBe(1);
  });

  it("keeps the formula as source when rendered without a browser", () => {
    const html = staticHtml("求和：\n\n$$\n\\sum_{i=1}^{n} i\n$$");
    expect(html).not.toContain("katex");
    expect(html).toContain("sum_");
  });

  it("settles every delimiter family, in the first frame once the pipeline is cached", () => {
    const display = render(
      <Markdown content={"求和：\n\n$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$"} />,
    );
    expect(display.container.querySelector(".katex-display")).toBeInTheDocument();

    const latex = render(
      <Markdown
        content={"其中 \\(\\alpha+\\beta\\) 是两个系数。\n\n\\[ p=\\sigma\\left(\\frac{\\mu}{T}\\right) \\]"}
      />,
    );
    expect(latex.container.querySelector(".katex")).toBeInTheDocument();
    expect(latex.container.querySelector(".katex-display")).toBeInTheDocument();
    expect(latex.container.textContent).toContain("是两个系数");

    const fenced = render(
      <Markdown content={"```math\na^2 + b^2 = c^2\n```\n\n```ts\nconst answer = 42\n```"} />,
    );
    expect(fenced.container.querySelector(".katex-display")).toBeInTheDocument();
    expect(fenced.container.innerHTML).toContain('<code class="language-ts">const answer = 42');
  });

  it("keeps code literal and a TeX line break inside one formula", () => {
    const fences = render(
      <Markdown content={"```ts\nconst x = \\[ a \\]\n```\n\n行内 \\(y\\) 写成 `\\[ z \\]`。"} />,
    );
    expect(fences.container.innerHTML).toContain("const x = \\[ a \\]");
    expect(fences.container.innerHTML).toContain("<code>\\[ z \\]</code>");
    expect(fences.container.querySelector(".katex")).toBeInTheDocument();

    const aligned = render(
      <Markdown content={"$$\n\\begin{aligned}\na &= b \\\\[2pt]\nc &= d\n\\end{aligned}\n$$"} />,
    );
    expect(aligned.container.querySelectorAll(".katex-display").length).toBe(1);
    expect(aligned.container.querySelector(".katex-error")).not.toBeInTheDocument();
  });

  it("degrades broken math and leaves streaming math as source", () => {
    const broken = render(<Markdown content={"坏掉的公式 $\\frac{$ 不应打断渲染"} />);
    const error = broken.container.querySelector(".katex-error");
    expect(error).toBeInTheDocument();
    expect(error?.getAttribute("title")).toBeTruthy();
    expect(broken.container.innerHTML).toContain("var(--ux-destructive)");
    expect(broken.container.textContent).toContain("不应打断渲染");

    const partial = render(<Markdown content={"还在输出：\\[ p=\\sigma"} />);
    expect(partial.container.querySelector(".katex")).not.toBeInTheDocument();
    expect(partial.container.textContent).toContain("p=");
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
