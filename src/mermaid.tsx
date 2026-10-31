import { useEffect, useRef, useState } from "react";

let diagramSequence = 0;

function currentTheme(): "dark" | "neutral" {
  return document.documentElement.classList.contains("dark") ? "dark" : "neutral";
}

/*
 * Both the palette and the type are sampled at execution time, not at mount time: a render that
 * started before a theme switch and settles after it must not paint the previous colours, and the
 * diagram has to inherit the host app's font — the family comes from the document, the size from
 * the block it replaces, clamped so a pathological host size cannot produce an unreadable chart.
 */
function fontFamily(): string {
  const family = getComputedStyle(document.documentElement).fontFamily.trim();
  return family === "" ? "sans-serif" : family;
}

function fontSizeOf(element: HTMLElement | null): number {
  const measured = element ? Number.parseFloat(getComputedStyle(element).fontSize) : Number.NaN;
  if (!Number.isFinite(measured) || measured <= 0) {
    return 16;
  }
  return Math.min(Math.max(measured, 10), 20);
}

async function renderDiagram(source: string, element: HTMLElement | null): Promise<string | null> {
  try {
    const { default: mermaid } = await import("mermaid");
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: currentTheme(),
      themeVariables: { fontFamily: fontFamily(), fontSize: `${fontSizeOf(element)}px` },
    });
    const { svg } = await mermaid.render(`ux-mermaid-${++diagramSequence}`, source);
    return svg;
  } catch {
    // RECOVERY: an unparseable or still-streaming diagram falls back to its source block instead of
    // breaking the surface that contains it.
    return null;
  }
}

export function Mermaid({ source }: { source: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const element = useRef<HTMLElement | null>(null);
  const renderToken = useRef(0);

  useEffect(() => {
    const render = async () => {
      const token = ++renderToken.current;
      const next = await renderDiagram(source, element.current);
      if (renderToken.current === token) {
        setSvg(next);
      }
    };
    void render();
    const observer = new MutationObserver(() => void render());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      renderToken.current += 1;
      observer.disconnect();
    };
  }, [source]);

  if (svg === null) {
    return (
      <pre
        className="ux-markdown__mermaid-source"
        data-mermaid="source"
        ref={(node) => {
          element.current = node;
        }}
      >
        <code className="language-mermaid">{source}</code>
      </pre>
    );
  }
  return (
    <div
      aria-label="Mermaid diagram"
      className="ux-markdown__mermaid"
      data-mermaid="diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
      ref={(node) => {
        element.current = node;
      }}
      role="img"
    />
  );
}
