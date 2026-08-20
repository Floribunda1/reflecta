import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";
import { resetAgentFixtures } from "../../acceptance/spec/agent/agent-fixtures";

/**
 * P1 垂直切片：Effect IPC（electron-effect-rpc）跨 main→preload→renderer 端到端。
 *
 * `window.api` 是 preload 暴露的底层 bridge { invoke, subscribe, onStreamFrame }；
 * 返回桥层信封 { type: "success"|"error", data }。per-method typed 客户端由
 * `pilotIpc.renderer(window.api)` 解码 data。本测试经 bridge.invoke 走真实传输，
 * 验证 main 处理器成功 + typed domain error（PilotBoom）跨进程结构化往返。
 *
 * 注：launchApp 的 firstWindow() 偶发返回未导航 about:blank，故用 navigatedPage 定位。
 */
type Bridge = { invoke(method: string, payload: unknown): Promise<unknown> };

test.beforeEach(() => {
  resetAgentFixtures();
});

/** 找到实际导航到 app 的窗口（约 20s 超时）。 */
async function navigatedPage(app: Electron.Application): Promise<import("@playwright/test").Page> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    for (const win of app.windows()) {
      try {
        const href = await win.evaluate(() => location.href);
        if (href && href !== "about:blank") return win;
      } catch {
        /* window closed / context gone */
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("app window never navigated away from about:blank");
}

test("effect pilot: typed Effect IPC roundtrip (success + typed domain error)", async () => {
  const { app } = await launchApp();
  try {
    const page = await navigatedPage(app);
    expect(await page.evaluate(() => typeof (window as unknown as { api?: unknown }).api)).toBe(
      "object",
    );

    // 成功路径（桥层信封：{ type, data }）
    const ping = await page.evaluate(() =>
      (window as unknown as { api: Bridge }).api.invoke("PilotPing", {}),
    );
    expect(ping).toMatchObject({ type: "success", data: { message: "pong" } });

    const ok = await page.evaluate(() =>
      (window as unknown as { api: Bridge }).api.invoke("PilotProbe", { id: "x" }),
    );
    expect(ok).toMatchObject({ type: "success", data: { id: "x", ok: true } });

    // typed error 路径：main 侧 Effect.fail(PilotBoom) 跨进程往返后结构完整
    const boom = await page.evaluate(() =>
      (window as unknown as { api: Bridge }).api.invoke("PilotProbe", { id: "boom" }),
    );
    const boomErr = boom as {
      type?: string;
      error?: { tag?: string; data?: Record<string, unknown> };
    };
    expect(boomErr.type).toBe("failure");
    expect(boomErr.error?.tag).toBe("PilotBoom");
    expect(boomErr.error?.data?.reason).toBe("boom: boom");
    expect(boomErr.error?.data?.code).toBe(404);
  } finally {
    await app.close();
  }
});
