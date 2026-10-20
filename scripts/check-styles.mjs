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

const contracts = [
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

const failures = contracts.filter(([, holds]) => !holds).map(([reason]) => reason);
for (const reason of failures) {
  console.error(`check-styles: failed — ${reason}`);
}
if (failures.length > 0) {
  console.error(`check-styles: raw app token references — ${rawAppTokenReferences.join(", ") || "none"}`);
  console.error(`check-styles: light tokens — ${lightTokens.join(", ")}`);
  console.error(`check-styles: dark tokens — ${darkTokens.join(", ")}`);
  console.error(`check-styles: referenced tokens — ${bodyReferences.join(", ")}`);
  process.exit(1);
}
console.log(`check-styles: ${contracts.length} contracts hold`);
