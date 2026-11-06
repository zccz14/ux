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

/*
 * A diagram is a function of its source, the palette and the host font size, so it is cached under
 * all three. The cache exists because a remount must not be visible: a streaming reply re-renders
 * the block being written on every frame and moves each finished block into the settled part above
 * it, which unmounts and remounts this component. Without a cache every one of those remounts
 * painted the fence source first and the SVG a frame later — a jump of about a hundred pixels for
 * anything laid out below the reply.
 */
const diagramCache = new Map<string, string>();
/* The last picture of a source, regardless of palette or size: the first frame of a remount has no
 * element to measure yet, and a picture at the previous size beats a code block at any size. */
const latestDiagram = new Map<string, string>();
const cacheLimit = 64;

function remember(key: string, source: string, svg: string) {
  diagramCache.set(key, svg);
  latestDiagram.set(source, svg);
  while (diagramCache.size > cacheLimit) {
    const oldest = diagramCache.keys().next();
    if (oldest.done) break;
    diagramCache.delete(oldest.value);
  }
  while (latestDiagram.size > cacheLimit) {
    const oldest = latestDiagram.keys().next();
    if (oldest.done) break;
    latestDiagram.delete(oldest.value);
  }
}

export function Mermaid({ source }: { source: string }) {
  // The first paint of a remount is the picture we already have, not the fence it replaced.
  const [svg, setSvg] = useState<string | null>(() => latestDiagram.get(source) ?? null);
  const element = useRef<HTMLElement | null>(null);
  const renderToken = useRef(0);

  useEffect(() => {
    const render = async () => {
      const token = ++renderToken.current;
      const key = `${currentTheme()}|${fontSizeOf(element.current)}|${source}`;
      const cached = diagramCache.get(key);
      if (cached !== undefined) {
        setSvg(cached);
        return;
      }
      const next = await renderDiagram(source, element.current);
      if (renderToken.current === token) {
        if (next !== null) {
          remember(key, source, next);
        }
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
