import type { Element } from "hast";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import ReactMarkdown, { type Components, type Options } from "react-markdown";
import remarkGfm from "remark-gfm";

import { ExternalLinkIcon } from "./icons.js";
import { hasOpenFence, revealTailOffset, truncateTo } from "./markdown-reveal.js";
import { Mermaid } from "./mermaid.js";
import { advanceReveal, isRevealing, observeReveal, settledPace, settleReveal, type RevealPace } from "./reveal.js";
import type { MarkdownProps } from "./types.js";

/*
 * KaTeX carries its own typography and fonts. Importing the stylesheet here — rather than asking
 * every host app to remember it — is what makes a formula render identically, and never unstyled,
 * on every surface. The import is a module-level side effect on purpose: see
 * scripts/check-package.mjs, which exists so nobody tree-shakes it away. Only the stylesheet is
 * static; the runtime below it is loaded on demand.
 */
import "katex/dist/katex.min.css";

type RehypePlugins = NonNullable<Options["rehypePlugins"]>;
type RemarkPlugins = NonNullable<Options["remarkPlugins"]>;

/*
 * Math is the only part of the pipeline with real weight — KaTeX's runtime is ~76 KB gzipped, more
 * than the rest of the chain together — and most surfaces in the family never show a formula. So
 * the tokenizer and the renderer arrive together, on demand, instead of shipping to every app. What
 * the component can render never varies; only when the code arrives does.
 */
let mathPipeline: { rehypePlugins: RehypePlugins; remarkPlugins: RemarkPlugins } | null = null;
let mathLoad: Promise<void> | null = null;
const mathListeners = new Set<() => void>();

function subscribeToMath(listener: () => void): () => void {
  mathListeners.add(listener);
  return () => {
    mathListeners.delete(listener);
  };
}

function isMathReady(): boolean {
  return mathPipeline !== null;
}

/*
 * Every delimiter this component accepts starts with one of these tokens, so the test is exact: a
 * formula cannot slip past it. A false positive — a `$5` price, a code block with a backslash —
 * only costs one shared fetch per session, and the fetched chunk is cached for good.
 */
const mathFence = /^ {0,3}(?:```|~~~)\s*math\b/m;

function mayContainMath(content: string): boolean {
  return (
    content.includes("$") ||
    content.includes("\\(") ||
    content.includes("\\[") ||
    mathFence.test(content)
  );
}

function loadMath(): Promise<void> {
  mathLoad ??= Promise.all([import("remark-math-extended"), import("rehype-katex")])
    .then(([remarkMath, rehypeKatex]) => {
      mathPipeline = {
        remarkPlugins: [remarkMath.default],
        rehypePlugins: [
          [rehypeKatex.default, { strict: "ignore", errorColor: "var(--ux-destructive)" }],
        ],
      };
      for (const listener of mathListeners) {
        listener();
      }
    })
    .catch(() => {
      // RECOVERY: a chunk that fails to fetch must never take the surface down with it. Math keeps
      // rendering as the text it was written as, and the next surface retries the load.
      mathLoad = null;
    });
  return mathLoad;
}

function mermaidSource(node: Element | undefined): string | null {
  const code = node?.children[0];
  if (code?.type !== "element" || code.tagName !== "code") {
    return null;
  }
  const classes = code.properties.className;
  if (!Array.isArray(classes) || !classes.includes("language-mermaid")) {
    return null;
  }
  const text = code.children[0];
  return text?.type === "text" ? text.value : null;
}

const components: Components = {
  a: ({ children, href, node: _node, ...props }) => {
    // A rejected URL was already emptied by safeUrl, so the link degrades to its own text instead
    // of becoming an anchor that reloads the current page.
    if (!href) {
      return <span {...props}>{children}</span>;
    }
    // Only an absolute URL leaves the app. An in-page anchor or a relative path stays inside the
    // document that hosts it, so it navigates in place and carries no external marker.
    if (!isExternal(href)) {
      return (
        <a {...props} href={href}>
          {children}
        </a>
      );
    }
    return (
      <a {...props} href={href} rel="noopener noreferrer" target="_blank">
        {children}
        <ExternalLinkIcon />
      </a>
    );
  },
  pre: ({ children, node, ...props }) => {
    const source = mermaidSource(node);
    return source === null ? <pre {...props}>{children}</pre> : <Mermaid source={source} />;
  },
  // A wide table scrolls on its own; the transcript or article around it never grows a horizontal
  // scrollbar, so the columns past the fold stay reachable.
  table: ({ children, node: _node, ...props }) => (
    <div className="ux-markdown__table">
      <table {...props}>{children}</table>
    </div>
  ),
};

const safeProtocols = new Set(["http", "https", "mailto"]);

function isExternal(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//");
}

/*
 * One URL rule for the whole family, so no host app passes its own transform: absolute URLs must
 * be http(s) or mailto, and anything without a scheme stays relative. `javascript:`, `data:` and
 * friends become empty and therefore plain text.
 */
function safeUrl(url: string): string {
  const trimmed = url.trim();
  const separator = trimmed.indexOf(":");
  if (separator === -1) {
    return trimmed;
  }
  const scheme = trimmed.slice(0, separator).toLowerCase();
  if (!/^[a-z][a-z0-9+.-]*$/.test(scheme)) {
    return trimmed;
  }
  return safeProtocols.has(scheme) ? trimmed : "";
}

const baseRemarkPlugins: RemarkPlugins = [remarkGfm];
const noRemarkPlugins: RemarkPlugins = [];
const noRehypePlugins: RehypePlugins = [];

/*
 * The reveal moves every frame: one commit per frame is what makes a staircase read as a line, and
 * only the block still being written re-renders. The guard is there to keep two rAF callbacks in
 * the same frame from committing twice, not to slow the text down.
 */
const commitInterval = 12;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/*
 * How much of `content` the surface paints right now. Everything below stays a pure function of
 * that number, so the animation can never show something the caller did not send: the pace starts
 * settled (a mount shows everything), only an append animates, and anything else snaps.
 */
function useRevealedLength(content: string, reveal: boolean): number {
  const [shown, setShown] = useState(content.length);
  // Null until the first effect: a ref initialised during render would date the mount from a
  // moment no clock measured, and the first append would then read as a very long gap.
  const pace = useRef<RevealPace | null>(null);
  const frame = useRef<number | null>(null);
  const committedAt = useRef(0);

  const stop = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
  }, []);

  const commit = useCallback((value: number, at: number) => {
    committedAt.current = at;
    setShown(value);
  }, []);

  const schedule = useCallback(() => {
    if (frame.current !== null) {
      return;
    }
    frame.current = requestAnimationFrame(function tick() {
      frame.current = null;
      if (pace.current === null) {
        return;
      }
      const at = Date.now();
      pace.current = advanceReveal(pace.current, at);
      const revealing = isRevealing(pace.current);
      if (!revealing || at - committedAt.current >= commitInterval) {
        commit(pace.current.shown, at);
      }
      if (revealing) {
        frame.current = requestAnimationFrame(tick);
      }
    });
  }, [commit]);

  useEffect(() => {
    const at = Date.now();
    if (!reveal || prefersReducedMotion()) {
      stop();
      pace.current = settledPace(content, at);
      commit(content.length, at);
      return;
    }
    pace.current = observeReveal(pace.current ?? settledPace(content, at), content, at);
    commit(pace.current.shown, at);
    if (isRevealing(pace.current)) {
      schedule();
    } else {
      stop();
    }
  }, [content, reveal, commit, schedule, stop]);

  /*
   * A tab in the background paints nothing, so its frames pile up into one burst on return. The
   * reveal gives up instead and shows the whole snapshot: coming back to a finished paragraph is
   * less strange than watching it type itself out for a reader who already left.
   */
  useEffect(() => {
    if (!reveal) {
      return;
    }
    const settleWhenHidden = () => {
      if (!document.hidden) {
        return;
      }
      stop();
      if (pace.current !== null) {
        pace.current = settleReveal(pace.current);
        commit(pace.current.shown, Date.now());
      }
    };
    document.addEventListener("visibilitychange", settleWhenHidden);
    return () => document.removeEventListener("visibilitychange", settleWhenHidden);
  }, [reveal, commit, stop]);

  useEffect(() => stop, [stop]);

  return shown;
}

/*
 * While a fence is still being written its source is what a reader should see — the diagram needs
 * the closing fence to mean anything, and retrying it on every frame would burn the main thread.
 */
const openFencePre: NonNullable<Components["pre"]> = ({ children, node: _node, ...props }) => (
  <pre {...props}>{children}</pre>
);

export function Markdown({ content, reveal = false }: MarkdownProps) {
  // Server rendering and the first client paint both report "not loaded", so they agree and math
  // starts as the source it was written as; the swap happens once, off the render path.
  const ready = useSyncExternalStore(subscribeToMath, isMathReady, () => false);

  useEffect(() => {
    if (!ready && mayContainMath(content)) {
      void loadMath();
    }
  }, [content, ready]);

  const shown = useRevealedLength(content, reveal);
  const revealing = reveal && shown < content.length;
  /*
   * The finished blocks and the block still being written are rendered apart: the first ones only
   * re-render when another block settles, so a diagram or a formula above the tail is built once
   * instead of on every frame. The offset comes from the parser, never from a second opinion about
   * where a block ends.
   */
  const tailOffset = useMemo(() => (revealing ? revealTailOffset(content) : 0), [content, revealing]);
  const prefix = revealing ? content.slice(0, tailOffset) : "";
  const tail = revealing ? content.slice(tailOffset) : content;
  const budget = Math.min(Math.max(0, shown - tailOffset), tail.length);

  const rehypePlugins = ready && mathPipeline ? mathPipeline.rehypePlugins : noRehypePlugins;
  const mathRemarkPlugins = ready && mathPipeline ? mathPipeline.remarkPlugins : noRemarkPlugins;

  const settledRemarkPlugins = useMemo(
    () => [...baseRemarkPlugins, ...mathRemarkPlugins],
    [mathRemarkPlugins],
  );
  const tailRemarkPlugins = useMemo(
    () => (revealing ? [...settledRemarkPlugins, truncateTo(budget)] : settledRemarkPlugins),
    [revealing, settledRemarkPlugins, budget],
  );
  const tailComponents = useMemo(
    () => (revealing && hasOpenFence(tail) ? { ...components, pre: openFencePre } : components),
    [revealing, tail],
  );

  return (
    <div className="ux-markdown" data-revealing={reveal ? "" : undefined}>
      {prefix === "" ? null : (
        <ReactMarkdown
          components={components}
          rehypePlugins={rehypePlugins}
          remarkPlugins={settledRemarkPlugins}
          urlTransform={safeUrl}
        >
          {prefix}
        </ReactMarkdown>
      )}
      <ReactMarkdown
        components={tailComponents}
        rehypePlugins={rehypePlugins}
        remarkPlugins={tailRemarkPlugins}
        urlTransform={safeUrl}
      >
        {tail}
      </ReactMarkdown>
    </div>
  );
}
