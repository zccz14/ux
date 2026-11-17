import type { Link, Root, RootContent, Text } from "mdast";
import type { Plugin } from "unified";

/** The range mdast records for a node; reached through `Link` so the package needs no `unist` type. */
type Range = NonNullable<Link["position"]>;

/*
 * GFM's autolink literal carries a bare URL to the next whitespace and then trims ASCII punctuation
 * off its tail. That rule is written for prose that separates its words with spaces, and Chinese
 * does not: `已部署到 https://cybion.ntnl.io。线上 bundle 已更新` has no space after the URL, so the
 * literal swallows the full-width stop — and the whole clause behind it — into the anchor. The rest
 * of the sentence renders underlined, and the link points at a URL nobody wrote.
 *
 * So a bare URL also ends at the first CJK punctuation mark — `。，、；：！？（）「」【】《》…` and the
 * rest of the full-width families — which is the boundary the writer already drew. An ideograph is
 * a letter, not a mark: `…/wiki/中文` stays inside the link, because that is a real URL.
 */

/** Punctuation and symbols, in the shapes CJK prose punctuates with. */
const wideMark = /[\p{P}\p{S}]/u;

function isWideMark(character: string): boolean {
  const code = character.codePointAt(0);
  // Everything ASCII is the parser's own business: it already knows `,` and `.` and `!` end a URL.
  return code !== undefined && code > 0x7f && wideMark.test(character);
}

function firstWideMark(value: string): number {
  let index = 0;
  for (const character of value) {
    if (isWideMark(character)) {
      return index;
    }
    index += character.length;
  }
  return -1;
}

/* The tail rule GFM applies, reused because cutting at `。` can expose a `.` it never had to see. */
const asciiTail = /[.,;:!?'"*_~]+$/;

/*
 * Only a literal autolink is rewritten. `[text](url)` and `<url>` carry a boundary the author typed;
 * a literal carries none but its own length, which is exactly what the source range measures.
 */
function isLiteral(node: Link): boolean {
  const [child] = node.children;
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return (
    node.children.length === 1 &&
    child?.type === "text" &&
    typeof start === "number" &&
    typeof end === "number" &&
    end - start === child.value.length
  );
}

function halves(position: Range | undefined, length: number) {
  const start = position?.start.offset;
  if (position === null || position === undefined || typeof start !== "number") {
    return { head: undefined, tail: undefined };
  }
  const column = { ...position.start, offset: start + length, column: position.start.column + length };
  return {
    head: { start: position.start, end: { ...position.end, ...column } },
    tail: { start: column, end: position.end },
  };
}

/** The link cut at the first wide mark, plus the sentence it was swallowing. */
function splitAtMark(node: Link): [Link, Text] | null {
  if (!isLiteral(node)) {
    return null;
  }
  const text = node.children[0] as Text;
  const mark = firstWideMark(text.value);
  const kept = mark === -1 ? text.value : text.value.slice(0, mark).replace(asciiTail, "");
  if (kept === "" || kept.length === text.value.length) {
    return null;
  }
  const shortened = text.value.length - kept.length;
  const { head, tail } = halves(node.position ?? undefined, kept.length);
  return [
    { ...node, url: node.url.slice(0, node.url.length - shortened), children: [{ ...text, value: kept }], position: head },
    { type: "text", value: text.value.slice(kept.length), position: tail },
  ];
}

function rewrite(node: Root | RootContent): void {
  if (!("children" in node) || !Array.isArray(node.children)) {
    return;
  }
  const children: RootContent[] = [];
  for (const child of node.children as RootContent[]) {
    const split = child.type === "link" ? splitAtMark(child) : null;
    if (split === null) {
      children.push(child);
      rewrite(child);
      continue;
    }
    children.push(split[0], split[1]);
  }
  (node as { children: RootContent[] }).children = children;
}

/** A remark plugin that ends every bare URL at the CJK punctuation following it. */
export const autolinkBoundary: Plugin<[], Root> = () => (tree) => {
  rewrite(tree);
};
