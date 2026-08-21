/**
 * [bench:streaming-scroll] AI 流式回复进行中，用户在长对话里滚动。
 *
 * 这是「运行中滚动」的真实卡顿场景：virtualizer 一边 followOnAppend 追加/测量消息，
 * 一边响应滚轮 —— 主线程同时承担流式渲染与滚动布局。量化帧间隔（p95 接近 50ms 即掉帧）。
 *
 * 需要真实模型（REFLECTA_E2E_AI_API_KEY），无 key 时 skip。
 * 采样 2 次（每次一条真实回复）：先停留底部测持续 markdown 更新，再小幅滚动，
 * 保证活跃消息仍在虚拟窗口内。
 */
import { expect, test } from "@playwright/test";
import { launchBench } from "../harness";
import { resetAgentFixtures, seedLongThread } from "../fixtures/seed";
import {
  openAgentPage,
  openThread,
  configureE2eAiKey,
  sendMessage,
  waitForAssistantReply,
} from "../../acceptance/spec/agent/agent-e2e";
import { getE2eAiEnv, hasE2eAiConfig } from "../../test-env";
import { sampleFrames, wheelScroll, settle, type FrameStat } from "../perf/perf-utils";
import { checkFrameBudget } from "../perf/budget";

const hasAi = hasE2eAiConfig();
const SAMPLES = 2;

test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");

test("AI 流式回复停留底部及滚动：帧率与掉帧", async () => {
  resetAgentFixtures();
  seedLongThread("bench-stream-scroll", 40);

  const bench = await launchBench();
  try {
    const { page, cdp } = bench;
    await openAgentPage(page);
    await configureE2eAiKey(page, getE2eAiEnv().apiKey);
    await openThread(page, "BENCH_LONG_40");
    await expect(page.getByTestId("agent-message-scroll")).toBeVisible();
    await settle(page, 300);

    const scroll = page.getByTestId("agent-message-scroll");
    const box = (await scroll.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    const bottomRuns: FrameStat[] = [];
    const scrollRuns: FrameStat[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      await scroll.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      // 发一条要求长回答的消息，触发流式回复
      await sendMessage(
        page,
        `请用约 800 字详细分析第 ${i} 号议题：背景、方案对比、实现细节、表格、代码示例。`,
      );
      // 回复进行中：stop 按钮可见
      await expect(page.getByTestId("agent-stop-button")).toBeVisible({ timeout: 30_000 });
      // 停留底部：持续覆盖活跃 assistant markdown 的追加与测量。
      bottomRuns.push(await sampleFrames(page, 1000));
      await expect(page.getByTestId("agent-stop-button")).toBeVisible();

      // 小幅、持续滚动，避免把活跃消息移出虚拟窗口。
      const before = await scroll.evaluate((element) => element.scrollTop);
      const framePromise = sampleFrames(page, 1100);
      await wheelScroll(cdp, {
        x: cx,
        y: cy,
        deltaY: -600,
        steps: 50,
        durationMs: 900,
      });
      scrollRuns.push(await framePromise);
      const after = await scroll.evaluate((element) => element.scrollTop);
      expect(before - after).toBeGreaterThan(100);
      await expect(page.getByTestId("agent-assistant-text").last()).toBeVisible();
      // 等回复结束（stop 消失 + composer 可编辑）
      await waitForAssistantReply(page);
      await settle(page, 200);
    }

    for (const [i, frames] of bottomRuns.entries()) {
      checkFrameBudget(`streaming-bottom-${i}`, frames, {
        p95Ms: 34,
        maxMs: 100,
        longFrameCount: 1,
      });
    }
    for (const [i, frames] of scrollRuns.entries()) {
      checkFrameBudget(`streaming-scroll-${i}`, frames, {
        p95Ms: 34,
        maxMs: 100,
        longFrameCount: 1,
      });
    }
  } finally {
    await bench.close();
  }
});
