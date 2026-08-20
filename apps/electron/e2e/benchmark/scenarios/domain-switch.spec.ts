/**
 * [bench:domain-switch] 切换 domain 时「页面卡一下」。
 *
 * 测量目标：点击 domain 后到网格稳定（selectedDomainId 变化 → refetch → 网格重渲染完成）的
 * 交互延迟 + 期间主线程 long task。数据规模越大、卡顿越明显，故灌入较多 Understanding。
 *
 * 注意：切换会触发 React Query refetch（含真实 IPC/DB 往返），因此「慢」和「卡」需要分开看——
 * elapsedMs 混合了 fetch 等待与渲染；long task 才是「卡」的直接证据。测试同时输出两者。
 */
import { expect, test } from "@playwright/test";
import { launchBench } from "../harness";
import { resetAgentFixtures, seedPortfolio } from "../fixtures/seed";
import { openCapturePage, domainNode } from "../../acceptance/spec/capture/capture-e2e";
import { measureStep, settle } from "../perf/perf-utils";
import { checkBudget, sampleInteractions, type Budget } from "../perf/budget";

const DOMAIN_COUNT = 12;
const UNDERSTANDINGS_PER_DOMAIN = 30;

test("切换 domain 的交互延迟与主线程卡顿 (longtask)", async () => {
  resetAgentFixtures();
  seedPortfolio(DOMAIN_COUNT, UNDERSTANDINGS_PER_DOMAIN);

  const bench = await launchBench();
  try {
    const { page } = bench;
    await openCapturePage(page);
    await settle(page);
    // 确认首屏有数据，避免加速器空转
    await expect(page.getByTestId("capture-understanding-card").first()).toBeVisible();

    // 选一个领域，把 selectedDomainId 从默认切走（测量路径真实触发）
    await domainNode(page, "Bench Domain 0").click();
    await expect(
      page.getByTestId("capture-understanding-card").filter({ hasText: "Bench Understanding 0-0" }),
    ).toBeVisible();
    await settle(page);

    const run = await sampleInteractions(async (i: number) => {
      const target = (i % 2 === 0 ? "Bench Domain 1" : "Bench Domain 2") as string;
      // 先清回同一起点领域，保证每次都是从同样状态出发
      await domainNode(page, "Bench Domain 0").click();
      await settle(page, 150);
      return measureStep(page, `switch→${target}`, async () => {
        await domainNode(page, target).click();
        await expect(
          page.getByTestId("capture-understanding-card").filter({
            hasText:
              target === "Bench Domain 1" ? "Bench Understanding 1-0" : "Bench Understanding 2-0",
          }),
        ).toBeVisible();
      });
    }, 4);

    checkBudget(run, {
      elapsedMsSoft: 1500,
      longTaskCountSoft: 3,
      longTaskTotalMsSoft: 400,
    } satisfies Budget);

    const cards = await page.getByTestId("capture-understanding-card").count();
    console.log(
      `[bench] data scale: ${DOMAIN_COUNT} domains x ${UNDERSTANDINGS_PER_DOMAIN} understandings, ${cards} cards rendered`,
    );
  } finally {
    await bench.close();
  }
});
