import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: resolve(import.meta.dirname, "src/renderer"),
  test: { maxWorkers: 2 },
  resolve: {
    alias: {
      "@renderer": resolve(import.meta.dirname, "src/renderer/src"),
      "@shared": resolve(import.meta.dirname, "src/preload/typings"),
      "@antv/x6": "@antv/x6/es/index.js",
    },
  },
  ssr: { noExternal: ["@antv/x6"] },
});
