/**
 * [bench:capture] capture 模块的所有性能场景，共享一次 app launch：
 *   1. domain 切换（refetch → 虚拟网格重渲染）
 *   2. hover 卡片
 *   3. 点击选中打开详情（全文 md + citation 查询）
 *   4. capture → agent 路由切换
 *
 * 数据：seedPortfolioBench（3 域 × 80 卡 = 240 条，body 前 5 行含 [[u:..]]/[[d:..]] citation
 * + 代码块；详情面板渲染全文）。describe.serial 保证顺序执行、共享 app；一个场景失败后续跳过。
 */
import { expect, test, type Page } from "@playwright/test";
import { launchBench, type BenchHarness } from "../harness";
import { resetAgentFixtures, seedPortfolioBench } from "../fixtures/seed";
import {
  openCapturePage,
  domainNode,
  closeDetailPanel,
} from "../../acceptance/spec/capture/capture-e2e";
import { measureStep, settle } from "../perf/perf-utils";
import { checkBudget, sampleInteractions } from "../perf/budget";

test.describe.configure({ mode: "serial" });

let bench: BenchHarness;
let page: Page;

test.beforeAll(async () => {
  resetAgentFixtures();
  seedPortfolioBench(3, 80); // 240 条复杂 markdown 卡片，关联 3 个自建 domain
  bench = await launchBench();
  page = bench.page;
  await openCapturePage(page);
  await settle(page);
});

test.afterAll(async () => {
  await bench.close();
});

async function firstCardTitle(p: Page): Promise<string> {
  const title = await p
    .getByTestId("capture-understanding-card")
    .first()
    .getAttribute("data-understanding-title");
  return title ?? "";
}

/** 等「网格数据变化后稳定」：首卡标题偏离 changedFrom（refetch 生效）→ 连续两次相同（渲染稳定）。 */
async function waitGridStable(p: Page, changedFrom: string, timeoutMs = 15_000): Promise<string> {
  await expect.poll(async () => firstCardTitle(p), { timeout: timeoutMs }).not.toBe(changedFrom);
  let last = "";
  await expect
    .poll(
      async () => {
        const title = await firstCardTitle(p);
        const stable = title === last;
        last = title;
        return stable ? title : "";
      },
      { timeout: timeoutMs },
    )
    .not.toBe("");
  return last;
}

test("domain 切换：交互延迟与主线程卡顿 (longtask)", async () => {
  const allTitle = await firstCardTitle(page);
  expect(allTitle).not.toBe("");

  await domainNode(page, "Bench Domain 0").click();
  const d0Title = await waitGridStable(page, allTitle);
  expect(d0Title).toContain("Bench Understanding 0-");
  await settle(page);

  let currentTitle = d0Title;
  const run = await sampleInteractions(async (i: number) => {
    const target = i % 2 === 0 ? "Bench Domain 1" : "Bench Domain 2";
    if (currentTitle !== d0Title) {
      await domainNode(page, "Bench Domain 0").click();
      currentTitle = await waitGridStable(page, currentTitle);
    }
    await settle(page, 150);
    return measureStep(page, `switch→${target}`, async () => {
      await domainNode(page, target).click();
      currentTitle = await waitGridStable(page, currentTitle);
    });
  }, 4);

  checkBudget(run, { elapsedMsSoft: 1500, longTaskCountSoft: 3, longTaskTotalMsSoft: 400 });
  console.log(`[bench] data scale: 3 domains x 80 complex-markdown cards (240 total)`);
});

test("hover 卡片：hover 态渲染延迟与 long task", async () => {
  const run = await sampleInteractions(async (i: number) => {
    const card = page.getByTestId("capture-understanding-card").nth(i % 3);
    const box = (await card.boundingBox())!;
    await page.mouse.move(4, 4);
    await settle(page, 80);
    return measureStep(page, "hover-card", async () => {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(60); // hover 态生效窗口
    });
  }, 4);

  checkBudget(run, { elapsedMsSoft: 600, longTaskCountSoft: 2, longTaskTotalMsSoft: 200 });
});

test("点击选中 understanding：详情面板打开（完整 md 解析 + citation 查询）", async () => {
  const panel = page.getByTestId("capture-understanding-detail-panel");
  const run = await sampleInteractions(async (i: number) => {
    // 关闭已有详情，回到列表起点（Escape 在编辑器内可能被吞，用面板关闭按钮）
    await closeDetailPanel(page);
    await settle(page, 100);
    const card = page.getByTestId("capture-understanding-card").nth(i % 3);
    return measureStep(page, "open-detail", async () => {
      await card.click();
      await expect(panel).toBeVisible();
      await expect(panel.locator(".ProseMirror").first()).toBeVisible();
    });
  }, 4);

  checkBudget(run, { elapsedMsSoft: 1500, longTaskCountSoft: 4, longTaskTotalMsSoft: 500 });
});

test("capture → agent 路由切换：导航延迟与主线程卡顿", async () => {
  const run = await sampleInteractions(async () => {
    // 回到 capture 起点
    await page.getByTestId("app-nav-module-capture").click();
    await expect(page.getByTestId("capture-page")).toBeVisible();
    await settle(page, 150);
    return measureStep(page, "nav→agent", async () => {
      await page.getByTestId("app-nav-module-agent").click();
      await expect(page.getByTestId("agent-page")).toBeVisible({ timeout: 20_000 });
    });
  }, 4);

  checkBudget(run, { elapsedMsSoft: 1200, longTaskCountSoft: 4, longTaskTotalMsSoft: 600 });
});
