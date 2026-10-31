import { defineConfig } from "vitest/config";

// Everything the library declares as a runtime dependency stays external: the consumer's bundler
// resolves it (and can tree-shake it), and `import "katex/dist/katex.min.css"` survives into the
// published build as a side effect the host app's bundler picks up.
const externalPackages = [
  "@base-ui/react",
  "katex",
  "linkit-react-components",
  "mermaid",
  "react",
  "react-dom",
  "react-markdown",
  "react-router-dom",
  "rehype-katex",
  "remark-gfm",
  "remark-math-extended",
];

export default defineConfig({
  build: {
    lib: { entry: "src/index.ts", formats: ["es"], fileName: "index" },
    rollupOptions: {
      external: (id) =>
        externalPackages.some((name) => id === name || id.startsWith(`${name}/`)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
  },
});
