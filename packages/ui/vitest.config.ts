import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@antv/x6": "@antv/x6/es/index.js" } },
  ssr: { noExternal: ["@antv/x6"] },
});
