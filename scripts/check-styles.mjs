import { readFileSync } from "node:fs";

const stylesheet = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

const tokenBlock = (selector) =>
  stylesheet.match(new RegExp(`^${selector} \\{\\n([\\s\\S]*?)^\\}`, "m"))?.[1] ?? "";
const tokens = (block) =>
  [...block.matchAll(/^\s*(--ux-[a-z-]+):/gm)].map((match) => match[1]);
const references = (block) =>
  [...block.matchAll(/var\((--ux-[a-z-]+)/g)].map((match) => match[1]);

const lightBlock = tokenBlock(":root");
const darkBlock = tokenBlock("\\.dark");
const body = stylesheet.replace(lightBlock, "").replace(darkBlock, "");
const lightTokens = tokens(lightBlock);
const darkTokens = tokens(darkBlock);
const bodyReferences = [...new Set(references(body))];
const rawAppTokenReferences = [...body.matchAll(/var\((--[a-z-]+)/g)]
  .map((match) => match[1])
  .filter((name) => !name.startsWith("--ux-"));

// The Markdown layer is checked as its own section: it is the single typographic contract every
// surface in the app family shares, so its properties are contracts rather than preferences.
const markdownSection = stylesheet.slice(stylesheet.indexOf("/* --- Markdown --- */"));
const markdownRule = (selector) =>
  markdownSection.match(new RegExp(`\\${selector} \\{\\n([\\s\\S]*?)^\\}`, "m"))?.[1] ?? "";
const markdownRules = [...markdownSection.matchAll(/^\.[^{]+\{\n([\s\S]*?)^\}/gm)];
const markdownScrollers = [...markdownSection.matchAll(/overflow-x: auto/g)].length;
const markdownAbsoluteSizes = [...markdownSection.matchAll(/font-size:\s*[0-9.]+(?:px|rem|pt)/g)];
const markdownMeasures = [...markdownSection.matchAll(/max-width:\s*[0-9.]+(?:ch|px|rem)/g)];
const markdownRawColours = [...markdownSection.matchAll(/var\((--[a-z-]+)/g)].filter(
  (match) => !match[1].startsWith("--ux-"),
);
const externalMarker = markdownRule(".ux-markdown .ux-markdown__external-link");

const shellContracts = [
  [
    "the sidebar animates between 16rem and 3rem",
    stylesheet.includes("transition: width 200ms linear") &&
      stylesheet.includes("width: 16rem") &&
      stylesheet.includes("width: 3rem"),
  ],
  [
    "the logo renders in a single fixed 1.75rem box",
    stylesheet.includes("width: 1.75rem") && stylesheet.includes("height: 1.75rem"),
  ],
  [
    "the collapsed sidebar drops the title from layout",
    stylesheet.includes('.ux-app-layout[data-state="collapsed"] .ux-sidebar__title {\n  display: none;\n}'),
  ],
  [
    "the collapsed sidebar drops nav group labels from layout",
    stylesheet.includes('.ux-app-layout[data-state="collapsed"] .ux-nav-group__label {\n  display: none;\n}'),
  ],
  [
    "the collapsed sidebar pulls nav labels out of the row",
    stylesheet.includes('.ux-app-layout[data-state="collapsed"] .ux-nav-item__text {\n  width: 0;\n  opacity: 0;\n}'),
  ],
  [
    "the collapsed tooltip stays hidden while the sidebar is expanded",
    stylesheet.includes(".ux-tooltip[hidden] {\n  display: none;\n}"),
  ],
  [
    "reduced motion disables shell transitions",
    stylesheet.includes("prefers-reduced-motion: reduce"),
  ],
  ["the stylesheet has no external imports", !stylesheet.includes("@import")],
  [
    "every shell colour resolves through the --ux-* layer",
    rawAppTokenReferences.length === 0,
  ],
  [
    "the dark layer covers exactly the light tokens",
    lightTokens.length > 0 && lightTokens.join() === darkTokens.join(),
  ],
  [
    "every --ux-* token is used by a rule",
    bodyReferences.length === lightTokens.length &&
      bodyReferences.every((name) => lightTokens.includes(name)),
  ],
  [
    "the shell declares color-scheme for both modes",
    stylesheet.includes("color-scheme: light;") && stylesheet.includes("color-scheme: dark;"),
  ],
];

const markdownContracts = [
  ["markdown owns one typographic block", markdownRules.length >= 20],
  ["markdown sizes stay relative to the host font", markdownAbsoluteSizes.length === 0],
  ["markdown imposes no measure on its content", markdownMeasures.length === 0],
  [
    "headings are relative steps, not fixed sizes",
    markdownSection.includes("font-size: 1.5em;") &&
      markdownSection.includes("font-size: 1.25em;") &&
      markdownSection.includes("font-size: 1.125em;"),
  ],
  [
    "code blocks, tables, display math and diagrams scroll instead of widening the surface",
    markdownScrollers >= 4,
  ],
  [
    "code blocks and inline code share the muted token",
    markdownRule(".ux-markdown pre").includes("var(--ux-muted)") &&
      markdownRule(".ux-markdown code").includes("var(--ux-muted)"),
  ],
  [
    "tables scroll in their own wrapper and drop the outer cell border",
    markdownRule(".ux-markdown .ux-markdown__table").includes("overflow-x: auto") &&
      markdownSection.includes("tr:last-child td {\n  border-bottom: 0;\n}"),
  ],
  [
    "task lists replace the marker with the checkbox",
    markdownSection.includes(".ux-markdown ul.contains-task-list") &&
      markdownSection.includes(".ux-markdown li.task-list-item"),
  ],
  [
    "the external-link marker scales with the text it follows",
    externalMarker.includes("width: 0.75em") && externalMarker.includes("height: 0.75em"),
  ],
  [
    "display math scrolls on its own line",
    markdownRule(".ux-markdown .katex-display").includes("overflow-x: auto"),
  ],
  [
    "broken math degrades to the destructive token",
    markdownRule(".ux-markdown .katex-error").includes("var(--ux-destructive)"),
  ],
  [
    "the markdown layer adds no colour outside the --ux-* token set",
    markdownRawColours.length === 0,
  ],
];

const contracts = [...shellContracts, ...markdownContracts];

const failures = contracts.filter(([, holds]) => !holds).map(([reason]) => reason);
for (const reason of failures) {
  console.error(`check-styles: failed — ${reason}`);
}
if (failures.length > 0) {
  console.error(`check-styles: raw app token references — ${rawAppTokenReferences.join(", ") || "none"}`);
  console.error(`check-styles: light tokens — ${lightTokens.join(", ")}`);
  console.error(`check-styles: dark tokens — ${darkTokens.join(", ")}`);
  console.error(`check-styles: referenced tokens — ${bodyReferences.join(", ")}`);
  console.error(`check-styles: markdown fixes sizes — ${markdownAbsoluteSizes.map((match) => match[0]).join(", ") || "none"}`);
  console.error(`check-styles: markdown imposes measures — ${markdownMeasures.map((match) => match[0]).join(", ") || "none"}`);
  console.error(`check-styles: markdown scrollers — ${markdownScrollers}`);
  console.error(`check-styles: markdown raw colours — ${markdownRawColours.map((match) => match[1]).join(", ") || "none"}`);
  console.error(`check-styles: markdown rules — ${markdownRules.length}`);
  process.exit(1);
}
console.log(`check-styles: ${contracts.length} contracts hold`);
