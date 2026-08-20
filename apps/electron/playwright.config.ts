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
    {
      // 性能 benchmark：独立 suite，不进常规回归门禁（不参与 test:e2e）。
      // 单 worker、宽松 timeout，测量才稳定。用法见 e2e/benchmark/README.md。
      name: "benchmark",
      testDir: "./e2e/benchmark",
      timeout: 300_000,
      fullyParallel: false,
      workers: 1,
    },
  ],
  use: {
    trace: "on-first-retry",
  },
});
