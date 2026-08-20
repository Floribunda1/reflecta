/**
 * [bench:route-switch] 切换路由很卡（capture → agent 等）。
 *
 * 当前 router 是静态 import（无代码分割），切换即整棵目标模块树 mount，
 * 期间主线程被占满 → 长任务堆积 → 用户感知「卡」。本场景量化：
 * - 点击导航到「目标页可见 + 稳定」的延迟（含 mount 与数据 refetch）。
 * - 切换期间主线程 long task（卡顿的直接证据）。
 *
 * 由于 SPA 不整页刷新，perf observer 可持续采集，跨路由切换累计。
 */
import { expect, test } from "@playwright/test";
import { launchBench } from "../harness";
import { resetAgentFixtures } from "../fixtures/seed";
import { openCapturePage } from "../../acceptance/spec/capture/capture-e2e";
import { measureStep, settle, fmtStep } from "../perf/perf-utils";
import { checkBudget, sampleInteractions, type Budget } from "../perf/budget";

test("capture → agent 路由切换延迟与主线程卡顿", async () => {
  resetAgentFixtures();
  const bench = await launchBench();
  try {
    const { page } = bench;
    await openCapturePage(page);
    await settle(page);

    const run = await sampleInteractions(async () => {
      // 每次先回到 capture，保证从同一起点切换
      await page.getByTestId("app-nav-module-capture").click();
      await expect(page.getByTestId("capture-page")).toBeVisible();
      await settle(page, 150);
      return measureStep(page, "nav→agent", async () => {
        await page.getByTestId("app-nav-module-agent").click();
        await expect(page.getByTestId("agent-page")).toBeVisible({ timeout: 20_000 });
      });
    }, 4);

    checkBudget(run, {
      elapsedMsSoft: 1200,
      longTaskCountSoft: 4,
      longTaskTotalMsSoft: 600,
    } satisfies Budget);

    console.log(`[bench] ${fmtStep(run.raw[run.raw.length - 1]!)}`);
  } finally {
    await bench.close();
  }
});
