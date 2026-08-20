/**
 * [bench:streaming-scroll] AI 流式回复进行中，用户在长对话里滚动。
 *
 * 这是「运行中滚动」的真实卡顿场景：virtualizer 一边 followOnAppend 追加/测量消息，
 * 一边响应滚轮 —— 主线程同时承担流式渲染与滚动布局。量化帧间隔（p95 接近 50ms 即掉帧）。
 *
 * 需要真实模型（REFLECTA_E2E_AI_API_KEY），无 key 时 skip。
 * 采样 2 次（每次一条真实回复），回复进行中采样帧 + 驱动滚动。
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

const hasAi = hasE2eAiConfig();
const SAMPLES = 2;

test.skip(!hasAi, "requires REFLECTA_E2E_AI_API_KEY");

test("AI 流式回复中滚动：帧率与掉帧", async () => {
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

    const runs: FrameStat[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      // 发一条要求长回答的消息，触发流式回复
      await sendMessage(
        page,
        `请用长文详细分析第 ${i} 号议题：背景、方案对比、实现细节、表格、代码示例，尽量写长。`,
      );
      // 回复进行中：stop 按钮可见
      await expect(page.getByTestId("agent-stop-button")).toBeVisible({ timeout: 30_000 });
      // 流式渲染进行中，采样帧 + 驱动滚动（真实合成滚动，触发 virtualizer 测量路径）
      const framePromise = sampleFrames(page, 1500);
      await wheelScroll(cdp, { x: cx, y: cy, deltaY: -4000, steps: 30 });
      runs.push(await framePromise);
      // 等回复结束（stop 消失 + composer 可编辑）
      await waitForAssistantReply(page);
      await settle(page, 200);
    }

    const avgP95 = runs.reduce((a, r) => a + r.p95Ms, 0) / runs.length;
    const maxMax = Math.max(...runs.map((r) => r.maxMs));
    for (const [i, r] of runs.entries()) {
      console.log(
        `[bench] streaming-scroll sample${i}: frames=${r.frames} avg=${r.avgMs.toFixed(1)}ms p95=${r.p95Ms.toFixed(1)}ms max=${r.maxMs.toFixed(0)}ms`,
      );
    }
    console.log(
      `[bench] streaming-scroll summary: avgP95=${avgP95.toFixed(1)}ms maxMax=${maxMax.toFixed(0)}ms (p95 >= 50ms 即掉帧)`,
    );
    expect(avgP95).toBeLessThan(50);
  } finally {
    await bench.close();
  }
});
