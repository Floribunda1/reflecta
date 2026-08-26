/**
 * [bench:capture] capture 模块的所有性能场景，共享一次 app launch：
 *   1. domain 切换（refetch → 虚拟网格重渲染）
 *   2. rail 动画与网格列数
 *   3. 虚拟网格滚动
 *   4. 详情 / Agent Dock 开关
 *   5. capture → agent 路由切换
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
import { measureStep, sampleFrames, settle, wheelScroll } from "../perf/perf-utils";
import { checkBudget, checkFrameBudget, sampleInteractions } from "../perf/budget";

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

async function firstGridRowCardCount(p: Page): Promise<number> {
  return p
    .getByTestId("capture-card-grid")
    .locator("[data-index]")
    .first()
    .getByTestId("capture-understanding-card")
    .count();
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

  checkBudget(run, {
    elapsedMsSoft: 1000,
    longTaskCountSoft: 3,
    longTaskTotalMsSoft: 400,
    longTaskMaxMsSoft: 150,
  });
  console.log(`[bench] data scale: 3 domains x 80 complex-markdown cards (240 total)`);
});

test("rail 收起/展开：动画帧率与网格列数稳定", async () => {
  const rail = page.getByTestId("app-nav-rail");
  const trigger = page.getByTestId("app-nav-rail-collapse-button");
  expect(await firstGridRowCardCount(page)).toBeGreaterThan(1);

  const collapseFrames = sampleFrames(page, 500);
  await trigger.click();
  await expect(rail).toHaveCSS("width", "0px");
  checkFrameBudget("capture-rail-collapse", await collapseFrames, {
    p95Ms: 34,
    maxMs: 100,
    longFrameCount: 1,
  });
  expect(await firstGridRowCardCount(page)).toBeGreaterThan(1);

  const expandFrames = sampleFrames(page, 500);
  await trigger.click();
  await expect(rail).not.toHaveCSS("width", "0px");
  checkFrameBudget("capture-rail-expand", await expandFrames, {
    p95Ms: 34,
    maxMs: 100,
    longFrameCount: 1,
  });
  expect(await firstGridRowCardCount(page)).toBeGreaterThan(1);
});

test("Capture 网格滚动：markdown 卡片虚拟化帧率", async () => {
  const grid = page.getByTestId("capture-card-grid");
  await grid.evaluate((element) => {
    element.scrollTop = 0;
  });
  const before = await grid.evaluate((element) => element.scrollTop);
  const box = (await grid.boundingBox())!;
  const framesPromise = sampleFrames(page, 1300);
  await wheelScroll(bench.cdp, {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    deltaY: 5000,
    steps: 60,
    durationMs: 1100,
  });
  const frames = await framesPromise;
  const after = await grid.evaluate((element) => element.scrollTop);

  expect(after - before).toBeGreaterThan(500);
  checkFrameBudget("capture-grid-scroll", frames, {
    p95Ms: 34,
    maxMs: 100,
    longFrameCount: 1,
  });
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

  checkBudget(run, {
    elapsedMsSoft: 800,
    longTaskCountSoft: 4,
    longTaskTotalMsSoft: 500,
    longTaskMaxMsSoft: 200,
  });
});

test("详情面板关闭：网格恢复与主线程卡顿", async () => {
  const panel = page.getByTestId("capture-understanding-detail-panel");
  const run = await sampleInteractions(async (index) => {
    await page
      .getByTestId("capture-understanding-card")
      .nth(index % 3)
      .click();
    await expect(panel).toBeVisible();
    await settle(page, 100);
    return measureStep(page, "close-detail", async () => {
      await closeDetailPanel(page);
      await expect(panel).toHaveCount(0);
    });
  });

  expect(await firstGridRowCardCount(page)).toBeGreaterThan(1);
  checkBudget(run, {
    elapsedMsSoft: 500,
    longTaskCountSoft: 3,
    longTaskTotalMsSoft: 400,
    longTaskMaxMsSoft: 150,
  });
});

test("Contextual Agent Dock 打开/关闭：三栏重排", async () => {
  const dock = page.getByTestId("capture-agent-dock");
  const open = await sampleInteractions(async () => {
    if (await dock.isVisible()) {
      await dock.getByRole("button", { name: "关闭 Agent" }).click();
      await expect(dock).toHaveCount(0);
    }
    await page.getByTestId("capture-understanding-card").first().click({ button: "right" });
    const menuItem = page.getByRole("menuitem", { name: "和 AI 聊聊" });
    await expect(menuItem).toBeVisible();
    return measureStep(page, "open-agent-dock", async () => {
      await menuItem.click();
      await expect(dock).toBeVisible();
    });
  });

  const close = await sampleInteractions(async () => {
    if (!(await dock.isVisible())) {
      await page.getByTestId("capture-understanding-card").first().click({ button: "right" });
      await page.getByRole("menuitem", { name: "和 AI 聊聊" }).click();
      await expect(dock).toBeVisible();
    }
    return measureStep(page, "close-agent-dock", async () => {
      await dock.getByRole("button", { name: "关闭 Agent" }).click();
      await expect(dock).toHaveCount(0);
    });
  });

  checkBudget(open, {
    elapsedMsSoft: 800,
    longTaskCountSoft: 4,
    longTaskTotalMsSoft: 500,
    longTaskMaxMsSoft: 200,
  });
  checkBudget(close, {
    elapsedMsSoft: 500,
    longTaskCountSoft: 3,
    longTaskTotalMsSoft: 400,
    longTaskMaxMsSoft: 150,
  });
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

  checkBudget(run, {
    elapsedMsSoft: 800,
    longTaskCountSoft: 4,
    longTaskTotalMsSoft: 600,
    longTaskMaxMsSoft: 200,
  });
});
