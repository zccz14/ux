import { readFileSync } from "node:fs";

const stylesheet = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

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
    "the collapsed tooltip stays hidden while the sidebar is expanded",
    stylesheet.includes(".ux-tooltip[hidden] {\n  display: none;\n}"),
  ],
  [
    "reduced motion disables shell transitions",
    stylesheet.includes("prefers-reduced-motion: reduce"),
  ],
  ["the stylesheet has no external imports", !stylesheet.includes("@import")],
];

const failures = contracts.filter(([, holds]) => !holds).map(([reason]) => reason);
for (const reason of failures) {
  console.error(`check-styles: failed — ${reason}`);
}
if (failures.length > 0) {
  process.exit(1);
}
console.log(`check-styles: ${contracts.length} contracts hold`);
