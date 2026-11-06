import type { Root, RootContent } from "mdast";
import type { Plugin } from "unified";

/*
 * Two jobs, both of which need the parser rather than a guess at it.
 *
 * The reveal never cuts the Markdown source: a half-typed `**bold` would flash as asterisks, and a
 * fence cut on the way out would stop being a fence. It cuts the parsed tree instead, so the text
 * inside a construct is revealed while the construct keeps rendering as itself — the same reason
 * the renderer, not the caller, owns this: only it knows what a block is.
 */

type Positioned = {
  position?: { start: { offset?: number | null }; end: { offset?: number | null } } | null;
  children?: Positioned[];
  value?: string;
};

/** Source characters a node covers, falling back to its own text when the parser gives no range. */
function sourceLength(node: Positioned): number {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (typeof start === "number" && typeof end === "number" && end >= start) {
    return end - start;
  }
  if (typeof node.value === "string") {
    return node.value.length;
  }
  return node.children?.reduce((total, child) => total + sourceLength(child), 0) ?? 0;
}

function cutChildren(children: Positioned[], budget: { left: number }): RootContent[] {
  const kept: RootContent[] = [];
  for (const child of children) {
    if (budget.left <= 0) {
      break;
    }
    const length = sourceLength(child);
    if (length <= budget.left) {
      kept.push(child as RootContent);
      budget.left -= length;
      continue;
    }
    const partial = cutNode(child, budget.left);
    budget.left = 0;
    if (partial !== null) {
      kept.push(partial);
    }
    break;
  }
  return kept;
}

/*
 * The deepest node the budget lands in keeps its type and loses only its text after the cut, so a
 * heading stays a heading and a list item stays a list item while it is being written.
 */
function cutNode(node: Positioned, remaining: number): RootContent | null {
  if (remaining <= 0) {
    return null;
  }
  if (typeof node.value === "string") {
    const value = node.value.slice(0, remaining);
    return value === "" ? null : ({ ...node, value } as RootContent);
  }
  if (!Array.isArray(node.children)) {
    return null;
  }
  const children = cutChildren(node.children, { left: remaining });
  return children.length === 0 ? null : ({ ...node, children } as RootContent);
}

/** A remark plugin that keeps the first `budget` source characters of whatever it is given. */
export function truncateTo(budget: number): Plugin<[], Root> {
  return () => (tree) => {
    tree.children = cutChildren(tree.children as Positioned[], {
      left: Math.max(0, Math.floor(budget)),
    });
  };
}

/*
 * An unfinished fence is the one block that must not reach the renderer whole: a diagram would be
 * handed half its source, fail to parse, and be retried on every frame. It stays source text until
 * the closing fence arrives — which is what a reader of a streaming reply expects to see anyway.
 */
export function hasOpenFence(source: string): boolean {
  let open = false;
  for (const line of source.split("\n")) {
    if (/^ {0,3}(?:```|~~~)/.test(line)) {
      open = !open;
    }
  }
  return open;
}
