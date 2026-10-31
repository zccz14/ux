import { readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const markdownSource = readFileSync(new URL("../src/markdown.tsx", import.meta.url), "utf8");
const mermaidSource = readFileSync(new URL("../src/mermaid.tsx", import.meta.url), "utf8");

const staticImports = (source, name) =>
  new RegExp(`(?:from|import)\\s+"${name.replace("/", "\\/")}"`).test(source);

/*
 * The two heavy halves of the pipeline are loaded on demand: KaTeX's runtime (~76 KB gzip) by the
 * first surface whose content may contain a formula, and Mermaid by the first diagram. A static
 * import of either would quietly push that weight into the main bundle of every app in the family,
 * where only a few of them ever need it — so the shape is checked, not just the API.
 */
const contracts = [
  ["the package never claims to be side-effect free", manifest.sideEffects !== false],
  [
    "KaTeX ships as a runtime dependency so its stylesheet always resolves",
    Boolean(manifest.dependencies?.katex),
  ],
  [
    "Markdown pipelines ship as runtime dependencies so hosts wire nothing",
    ["react-markdown", "remark-gfm", "remark-math-extended", "rehype-katex"].every(
      (name) => Boolean(manifest.dependencies?.[name]),
    ),
  ],
  [
    "mermaid ships as a runtime dependency so diagrams work without host wiring",
    Boolean(manifest.dependencies?.mermaid),
  ],
  [
    "react stays a peer dependency and never becomes a second copy",
    Boolean(manifest.peerDependencies?.react) && !manifest.dependencies?.react,
  ],
  [
    "the KaTeX stylesheet is imported for its side effect",
    markdownSource.includes('import "katex/dist/katex.min.css"'),
  ],
  [
    "the math runtime is never imported statically",
    !staticImports(markdownSource, "rehype-katex") &&
      !staticImports(markdownSource, "remark-math-extended") &&
      !staticImports(markdownSource, "katex/dist/katex.mjs") &&
      !staticImports(markdownSource, "katex"),
  ],
  ["mermaid is never imported statically", !staticImports(mermaidSource, "mermaid")],
];

const failures = contracts.filter(([, holds]) => !holds).map(([reason]) => reason);
for (const reason of failures) {
  console.error(`check-package: failed — ${reason}`);
}
if (failures.length > 0) {
  process.exit(1);
}
console.log(`check-package: ${contracts.length} contracts hold`);
