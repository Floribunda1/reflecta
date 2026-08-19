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
    {
      // 画布模块集成测试：只围绕 React Flow 定制逻辑（自定义节点/边/组/配置差异），
      // 不挂 Feature ID（不被 feature:check 拦），也不归入 regression 技术风险。
      name: "integration",
      testDir: "./e2e/integration",
    },
  ],
  use: {
    trace: "on-first-retry",
  },
});
