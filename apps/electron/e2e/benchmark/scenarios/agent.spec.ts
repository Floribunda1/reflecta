/**
 * [bench:agent] agent 模块的所有性能场景，共享一次 app launch：
 *   1. 长会话加载（打开线程到列表稳定）
 *   2. 虚拟列表滚动（帧率与掉帧）
 *   3. 轮次跳转面板（jumpnav）展开收起
 *   4. activity group（工具活动分组）展开收起
 *   5. reasoning 思考全文展开渲染
 *
 * 数据：seedLongThread（120 轮 = 240 条，每条 = 长 thinking + 3 个 search tool（聚合
 * lookup activity group）+ 复杂 markdown）。describe.serial 顺序执行；一个场景失败后续跳过。
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { launchBench, type BenchHarness } from "../harness";
import { resetAgentFixtures, seedLongThread, seedInteractiveThread } from "../fixtures/seed";
import { openAgentPage, openThread } from "../../acceptance/spec/agent/agent-e2e";
import { measureStep, settle, sampleFrames, wheelScroll } from "../perf/perf-utils";
import { checkBudget, checkFrameBudget, sampleInteractions } from "../perf/budget";

test.describe.configure({ mode: "serial" });

const TURNS = 120; // 240 条消息的长对话

let bench: BenchHarness;
let page: Page;

test.beforeAll(async () => {
  resetAgentFixtures();
  seedLongThread("bench-all", TURNS); // 高复杂度长对话（load/scroll/turn-nav）
  seedInteractiveThread("bench-interact", 20); // 矮消息线程（activity/reasoning 可真实交互）
  bench = await launchBench();
  page = bench.page;
  await openAgentPage(page);
  await openThread(page, `BENCH_LONG_${TURNS}`);
  await expect(page.getByTestId("agent-message-scroll")).toBeVisible();
  await settle(page, 400);
});

test.afterAll(async () => {
  await bench.close();
});

/** 找第一个「中心在视口内」的目标（从底部往上找，底部消息在渲染窗口内）。 */
async function firstInViewport(locator: Locator): Promise<Locator> {
  const scroll = page.getByTestId("agent-message-scroll");
  const sbox = (await scroll.boundingBox())!;
  const count = await locator.count();
  for (let i = count - 1; i >= 0; i--) {
    const item = locator.nth(i);
    const box = await item.boundingBox();
    if (!box) continue;
    const centerY = box.y + box.height / 2;
    const inside = centerY >= sbox.y + 24 && centerY <= sbox.y + sbox.height - 24 && box.width > 0;
    if (inside) return item;
  }
  throw new Error("no in-viewport target");
}

/** 滚到列表中部后找视口内目标（中部消息的 group/reasoning 在渲染窗口内，已验证）。 */
async function findInViewportAtMiddle(locator: Locator): Promise<Locator> {
  const scroll = page.getByTestId("agent-message-scroll");
  for (let attempt = 0; attempt < 3; attempt++) {
    await scroll.evaluate((el) => {
      el.scrollTop = el.scrollHeight / 2;
      el.dispatchEvent(new Event("scroll"));
    });
    await settle(page, 400);
    try {
      return await firstInViewport(locator);
    } catch {
      // 线程切换/数据加载时序：重试滚动
    }
  }
  throw new Error("no in-viewport target");
}

test("长会话加载：打开线程到列表稳定", async () => {
  const run = await sampleInteractions(async () => {
    // 每次回到会话列表（新线程）以同一起点重开
    await page.getByTestId("agent-new-thread-button").click();
    await expect(page.getByTestId("agent-empty-state")).toBeVisible();
    await settle(page, 150);
    return measureStep(page, "open-long-thread", async () => {
      await openThread(page, `BENCH_LONG_${TURNS}`);
      await expect(page.getByTestId("agent-message-scroll")).toBeVisible();
      // 等最后一条 assistant 消息渲染（虚拟列表首屏稳定，anchorTo end → 底部可见）
      await expect(
        page.getByTestId("agent-assistant-text").filter({ hasText: "answer-" }).last(),
      ).toBeVisible();
    });
  }, 4);

  checkBudget(run, {
    elapsedMsSoft: 1000,
    longTaskCountSoft: 5,
    longTaskTotalMsSoft: 700,
    longTaskMaxMsSoft: 200,
  });
});

test("长会话滚动：虚拟列表滚轮滚动帧率与掉帧", async () => {
  const scroll = page.getByTestId("agent-message-scroll");
  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const before = await scroll.evaluate((element) => element.scrollTop);
  const box = (await scroll.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // 并行：采样帧 + 驱动滚动（CDP 真实合成滚动触发 virtualizer 的 measureElement 路径）
  const framePromise = sampleFrames(page, 1300);
  await wheelScroll(bench.cdp, {
    x: cx,
    y: cy,
    deltaY: -12000,
    steps: 60,
    durationMs: 1100,
  });
  const frames = await framePromise;
  const after = await scroll.evaluate((element) => element.scrollTop);

  expect(before - after).toBeGreaterThan(1000);
  checkFrameBudget("long-convo-scroll", frames, { p95Ms: 34, maxMs: 100, longFrameCount: 1 });
});

test("长会话搜索：批量 markdown 高亮与虚拟列表跳转", async () => {
  await page.keyboard.press("Meta+f");
  const input = page.getByTestId("agent-thread-find-input");
  const findBox = page.getByTestId("agent-thread-find-box");
  const queries = ["answer", "标题", "细节", "正文"];
  const run = await sampleInteractions(async (index) => {
    return measureStep(page, "find-long-thread", async () => {
      await input.fill(queries[index]!);
      await page.waitForTimeout(350);
      await expect(findBox).not.toContainText("0/0", { timeout: 5_000 });
    });
  });
  await page.getByRole("button", { name: "关闭搜索" }).click();

  checkBudget(run, {
    elapsedMsSoft: 800,
    longTaskCountSoft: 3,
    longTaskTotalMsSoft: 400,
    longTaskMaxMsSoft: 150,
  });
});

test("轮次跳转面板展开/收起（jumpnav）", async () => {
  const trigger = page.getByTestId("agent-chat-jump-trigger");
  const jumpItem = page.getByTestId("agent-chat-jump-item").first();
  // 面板由 CSS group-hover 驱动：鼠标移到 trigger 上展开、移开收起。
  // 不用 Playwright 的 hover()：面板展开后会盖住 trigger，hover 的
  // pointer-intercepts 检查会超时；用 mouse.move 直移触发即可。
  const triggerBox = (await trigger.boundingBox())!;
  const triggerCx = triggerBox.x + triggerBox.width / 2;
  const triggerCy = triggerBox.y + triggerBox.height / 2;

  await page.mouse.move(4, 4);
  await expect(jumpItem).toBeHidden();
  await settle(page, 80);
  const open = await sampleInteractions(async () => {
    await page.mouse.move(4, 4);
    await expect(jumpItem).toBeHidden();
    await settle(page, 80);
    return measureStep(page, "turn-nav-open", async () => {
      await page.mouse.move(triggerCx, triggerCy);
      await expect(jumpItem).toBeVisible();
    });
  }, 4);

  const close = await sampleInteractions(async () => {
    await page.mouse.move(triggerCx, triggerCy);
    await expect(jumpItem).toBeVisible();
    await settle(page, 80);
    return measureStep(page, "turn-nav-close", async () => {
      await page.mouse.move(4, 4);
      await expect(jumpItem).toBeHidden();
    });
  }, 4);

  checkBudget(open, {
    elapsedMsSoft: 300,
    longTaskCountSoft: 3,
    longTaskTotalMsSoft: 400,
    longTaskMaxMsSoft: 150,
  });
  checkBudget(close, {
    elapsedMsSoft: 300,
    longTaskCountSoft: 2,
    longTaskTotalMsSoft: 300,
    longTaskMaxMsSoft: 150,
  });
});

test("activity group 展开/收起：工具活动分组 toggle", async () => {
  // 切到矮消息线程（消息整体在视口内，group 可真实点击）
  await openThread(page, "BENCH_INTERACT_20");
  await expect(page.getByTestId("agent-message-scroll")).toBeVisible();
  // 等线程数据渲染（activity group 出现）
  await expect(page.getByTestId("agent-activity-group").first()).toBeAttached();
  await settle(page, 400);
  const group = await findInViewportAtMiddle(page.getByTestId("agent-activity-group"));
  const trigger = group.getByTestId("agent-activity-group-trigger");
  await expect(group).toBeVisible();

  const state = () => group.getAttribute("data-state");
  const ensure = async (target: "open" | "closed") => {
    if ((await state()) !== target) {
      await trigger.click();
      await expect(group).toHaveAttribute("data-state", target);
    }
  };

  await ensure("closed");
  await settle(page, 80);
  const open = await sampleInteractions(async () => {
    await ensure("closed");
    await settle(page, 80);
    return measureStep(page, "activity-open", async () => {
      await trigger.click();
      await expect(group).toHaveAttribute("data-state", "open");
    });
  }, 4);

  await ensure("open");
  await settle(page, 80);
  const close = await sampleInteractions(async () => {
    await ensure("open");
    await settle(page, 80);
    return measureStep(page, "activity-close", async () => {
      await trigger.click();
      await expect(group).toHaveAttribute("data-state", "closed");
    });
  }, 4);

  checkBudget(open, {
    elapsedMsSoft: 400,
    longTaskCountSoft: 3,
    longTaskTotalMsSoft: 400,
    longTaskMaxMsSoft: 150,
  });
  checkBudget(close, {
    elapsedMsSoft: 300,
    longTaskCountSoft: 2,
    longTaskTotalMsSoft: 300,
    longTaskMaxMsSoft: 150,
  });
});

test("reasoning 展开/收起：思考全文渲染 toggle", async () => {
  // 当前在矮消息线程（activity 已切过来）；DOM click 不依赖视口，thinking 长展开成本真实
  const row = page.locator('[data-index][data-message-role="assistant"]').first();
  const reasoning = row.locator('[data-testid="agent-reasoning"]');
  const trigger = reasoning.locator('[data-slot="collapsible-trigger"]');
  const detail = reasoning.locator('[data-testid="agent-reasoning-detail"]');
  await expect(reasoning).toBeAttached();
  // CollapsibleContent 收起即卸载（无 keepMounted）——收起态 detail 不在 DOM
  const collapsed = async () => (await detail.count()) === 0;
  const ensureCollapsed = async () => {
    if (!(await collapsed())) {
      await trigger.evaluate((el) => (el as HTMLElement).click());
      await expect(detail).toHaveCount(0);
    }
  };
  const ensureExpanded = async () => {
    if (await collapsed()) {
      await trigger.evaluate((el) => (el as HTMLElement).click());
      await expect(detail).toBeAttached();
      await expect(detail).toHaveAttribute("data-open", "");
    }
  };

  // 注：Base UI Collapsible 下收起态 trigger 为 0 尺寸，
  // 这里用 DOM 级 click 触发展开，测量的是「展开全文渲染」的真实成本。
  const open = await sampleInteractions(async () => {
    await ensureCollapsed();
    await settle(page, 80);
    return measureStep(page, "reasoning-open", async () => {
      await trigger.evaluate((el) => (el as HTMLElement).click());
      await expect(detail).toBeAttached();
      await expect(detail).toHaveAttribute("data-open", "");
    });
  }, 4);

  const close = await sampleInteractions(async () => {
    await ensureExpanded();
    await settle(page, 80);
    return measureStep(page, "reasoning-close", async () => {
      await trigger.evaluate((el) => (el as HTMLElement).click());
      await expect(detail).toHaveCount(0);
    });
  }, 4);

  checkBudget(open, {
    elapsedMsSoft: 500,
    longTaskCountSoft: 4,
    longTaskTotalMsSoft: 500,
    longTaskMaxMsSoft: 200,
  });
  checkBudget(close, {
    elapsedMsSoft: 300,
    longTaskCountSoft: 2,
    longTaskTotalMsSoft: 300,
    longTaskMaxMsSoft: 150,
  });
});
