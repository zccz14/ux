import type { Element } from "hast";
import ReactMarkdown, { type Components, type Options } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math-extended";

import { ExternalLinkIcon } from "./icons.js";
import { Mermaid } from "./mermaid.js";
import type { MarkdownProps } from "./types.js";

/*
 * KaTeX carries its own typography and fonts. Importing them here — rather than asking every host
 * app to remember a stylesheet — is what makes a formula render identically, and never unstyled,
 * on every surface that shows Markdown. The import is a module-level side effect on purpose: see
 * scripts/check-package.mjs, which exists so nobody tree-shakes it away.
 */
import "katex/dist/katex.min.css";

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

// Two delimiter families, because models pick either one: remark-math-extended adds `\(...\)` and
// `\[...\]` on top of the usual `$` / `$$`, and a `\\[2pt]` line break inside a formula stays
// formula content instead of opening a second display block.
const remarkPlugins: Options["remarkPlugins"] = [remarkGfm, remarkMath];

/*
 * Model-written formulas are loose by nature — Unicode symbols, full-width characters, CJK inside
 * `\text` — and strict mode only reports those as warnings, so the transcript stays clean. Real
 * syntax errors are still KaTeX's job: they degrade to a `.katex-error` span, never a throw.
 */
const rehypePlugins: Options["rehypePlugins"] = [[rehypeKatex, { strict: "ignore", errorColor: "var(--ux-destructive)" }]];

export function Markdown({ content }: MarkdownProps) {
  return (
    <div className="ux-markdown">
      <ReactMarkdown
        components={components}
        rehypePlugins={rehypePlugins}
        remarkPlugins={remarkPlugins}
        urlTransform={safeUrl}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
