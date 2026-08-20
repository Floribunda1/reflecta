/**
 * [bench:long-conversation] agent 长会话：加载 / 滚动 / 展开收起。
 *
 * 目标是「长对话里用户能感知的卡」。虚拟化（@tanstack/react-virtual）已开启，
 * 因此加载卡 = 会话 hydration + 首屏渲染；滚动卡 = 虚拟列表 measureElement/重排；
 * 展开收起 = 轮次跳转面板（turn nav）这种重交互树的展开。分别量化。
 *
 * 三个子场景：
 * 1. 加载：打开长线程 → 消息列表稳定 的延迟与 long task。
 * 2. 滚动：CDP 滚轮扫过长虚拟列表，采样帧间隔（p95 接近 50ms 即掉帧）+ long task。
 * 3. 展开/收起：打开/关闭轮次跳转面板（agent-chat-jump-trigger）。
 *
 * 说明：“运行（追加渲染）”需要真实 AI 流式回包，这里用「轮次跳转展开」作交互渲染代理；
 * 真实运行路径的 benchmark 见本文件底部注释 / README，需接模型后补。
 */
import { expect, test } from "@playwright/test";
import { launchBench } from "../harness";
import { resetAgentFixtures, seedLongThread } from "../fixtures/seed";
import { openAgentPage, openThread } from "../../acceptance/spec/agent/agent-e2e";
import { measureStep, settle, sampleFrames, wheelScroll, fmtStep } from "../perf/perf-utils";
import { checkBudget, sampleInteractions, type Budget } from "../perf/budget";

const TURNS = 120; // 240 条消息的长对话

test("长会话加载：打开线程到列表稳定", async () => {
  resetAgentFixtures();
  seedLongThread("bench-long-load", TURNS);

  const bench = await launchBench();
  try {
    const { page } = bench;
    await openAgentPage(page);
    await settle(page);

    const run = await sampleInteractions(async () => {
      // 每次回到会话列表（新线程）以同一起点重开
      await page.getByTestId("agent-new-thread-button").click();
      await expect(page.getByTestId("agent-empty-state")).toBeVisible();
      await settle(page, 150);
      return measureStep(page, "open-long-thread", async () => {
        await openThread(page, `BENCH_LONG_${TURNS}`);
        await expect(page.getByTestId("agent-message-scroll")).toBeVisible();
        // 等最后一条 assistant 消息渲染（虚拟列表首屏稳定）
        await expect(
          page.getByTestId("agent-assistant-text").filter({ hasText: "回答" }).last(),
        ).toBeVisible();
      });
    }, 4);

    checkBudget(run, {
      elapsedMsSoft: 1500,
      longTaskCountSoft: 5,
      longTaskTotalMsSoft: 700,
    } satisfies Budget);
  } finally {
    await bench.close();
  }
});

test("长会话滚动：虚拟列表滚轮滚动帧率与掉帧", async () => {
  resetAgentFixtures();
  seedLongThread("bench-long-scroll", TURNS);

  const bench = await launchBench();
  try {
    const { page, cdp } = bench;
    await openAgentPage(page);
    await openThread(page, `BENCH_LONG_${TURNS}`);
    await expect(page.getByTestId("agent-message-scroll")).toBeVisible();
    await settle(page, 300);

    const scroll = page.getByTestId("agent-message-scroll");
    const box = (await scroll.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // 并行：采样帧 + 驱动滚动（CDP 真实合成滚动触发 virtualizer 的 measureElement 路径）
    const framePromise = sampleFrames(page, 1500);
    await drainNearby(page);
    await wheelScroll(cdp, { x: cx, y: cy, deltaY: 12000, steps: 40 });
    const frames = await framePromise;

    console.log(
      `[bench] long-convo scroll: frames=${frames.frames} avg=${frames.avgMs.toFixed(1)}ms p95=${frames.p95Ms.toFixed(1)}ms max=${frames.maxMs.toFixed(0)}ms`,
    );
    // 滚动流畅性的客观指标：p95 帧间隔不应接近掉帧线
    expect(frames.p95Ms).toBeLessThan(100);
  } finally {
    await bench.close();
  }
});

test("长会话展开/收起：轮次跳转面板 open/close 延迟与 long task", async () => {
  resetAgentFixtures();
  seedLongThread("bench-long-turn-nav", TURNS);

  const bench = await launchBench();
  try {
    const { page } = bench;
    await openAgentPage(page);
    await openThread(page, `BENCH_LONG_${TURNS}`);
    await expect(page.getByTestId("agent-chat-jump-nav")).toBeVisible();
    await settle(page, 300);

    const trigger = page.getByTestId("agent-chat-jump-trigger");
    // 确保起点关闭，再测「打开」
    await page.keyboard.press("Escape").catch(() => {});
    await settle(page, 100);
    const open = await sampleInteractions(async () => {
      await page.keyboard.press("Escape").catch(() => {});
      await settle(page, 80);
      return measureStep(page, "turn-nav-open", async () => {
        await trigger.click();
        await expect(page.getByTestId("agent-chat-jump-item").first()).toBeVisible();
      });
    }, 4);

    // 确保起点打开，再测「关闭」
    await trigger.click();
    await expect(page.getByTestId("agent-chat-jump-item").first()).toBeVisible();
    const close = await sampleInteractions(async () => {
      await trigger.click();
      await expect(page.getByTestId("agent-chat-jump-item").first()).toBeVisible();
      await settle(page, 80);
      return measureStep(page, "turn-nav-close", async () => {
        await page.keyboard.press("Escape");
        await expect(page.getByTestId("agent-chat-jump-trigger")).toBeVisible();
      });
    }, 4);

    checkBudget(open, { elapsedMsSoft: 800, longTaskCountSoft: 3, longTaskTotalMsSoft: 400 });
    checkBudget(close, { elapsedMsSoft: 600, longTaskCountSoft: 2, longTaskTotalMsSoft: 300 });
    console.log(`[bench] open:  ${fmtStep(open.raw[open.raw.length - 1]!)}`);
    console.log(`[bench] close: ${fmtStep(close.raw[close.raw.length - 1]!)}`);
  } finally {
    await bench.close();
  }
});

async function drainNearby(page: Awaited<ReturnType<typeof launchBench>>["page"]) {
  // 滚动前派发一次滚动让虚拟列表先进入滚动态，避免首帧集中 measure
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="agent-message-scroll"]');
    if (el) {
      el.scrollTop += 1;
      el.dispatchEvent(new Event("scroll"));
    }
  });
  await page.waitForTimeout(80);
}
