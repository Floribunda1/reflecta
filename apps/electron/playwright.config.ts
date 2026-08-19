import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  outputDir: "./node_modules/.cache/playwright/test-results",
  reporter: process.env.CI ? "github" : "list",
  retries: process.env.CI ? 2 : 0,
  fullyParallel: true,
  projects: [
    {
      name: "acceptance",
      testDir: "./e2e/acceptance",
    },
    {
      name: "regression",
      testDir: "./e2e/regression",
    },
  ],
  use: {
    trace: "on-first-retry",
  },
});
