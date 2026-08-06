import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // rendering benchmarks exercise large streaming markdown documents
    testTimeout: 180_000,
  },
});
