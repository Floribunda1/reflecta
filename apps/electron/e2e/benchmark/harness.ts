/**
 * Benchmark 启动器：统一 launch + 注入 perf 采集，降低用例样板代码。
 * 每个 spec 目标独立（独立 Electron 实例），故只在这边做一次 installPerf。
 */
import type { CDPSession, Page } from "@playwright/test";
import { launchApp } from "../acceptance/spec/agent/agent-e2e";
import { installPerf } from "./perf/perf-utils";

export type BenchHarness = {
  page: Page;
  cdp: CDPSession;
  close: () => Promise<void>;
};

export async function launchBench(): Promise<BenchHarness> {
  const { app, page } = await launchApp();
  await installPerf(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  return {
    page,
    cdp,
    close: async () => {
      await app.close();
    },
  };
}
