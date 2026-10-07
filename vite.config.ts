import { defineConfig } from "vitest/config";

const externalPackages = [
  "@base-ui/react",
  "linkit-react-components",
  "react",
  "react-dom",
  "react-router-dom",
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
