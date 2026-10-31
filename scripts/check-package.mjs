import { readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

/*
 * The renderer imports `katex/dist/katex.min.css` for its side effect. Declaring the package as
 * side-effect free would let a consumer's bundler drop that import, and every formula in the family
 * would quietly render as bare LaTeX with no error to notice. The stylesheet deliberately depends
 * on that import surviving, so the manifest may never claim otherwise.
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
];

const failures = contracts.filter(([, holds]) => !holds).map(([reason]) => reason);
for (const reason of failures) {
  console.error(`check-package: failed — ${reason}`);
}
if (failures.length > 0) {
  process.exit(1);
}
console.log(`check-package: ${contracts.length} contracts hold`);
