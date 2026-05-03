import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./test/setup.ts"],
    pool: "forks",
  },
  resolve: {
    alias: {
      "@reflecta/server": new URL("../../packages/server/src", import.meta.url).pathname,
    },
  },
});
