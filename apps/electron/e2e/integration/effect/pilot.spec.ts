import { expect, test } from "@playwright/test";
import { launchApp } from "../../acceptance/spec/agent/agent-e2e";

/** pilot 契约（electron-effect-rpc）暴露在 `window.api` 上的方法形状；e2e 进程无 renderer 全局类型，故本地声明。 */
type PilotApi = {
  PilotPing(input: {}): Promise<{ message: string }>;
  PilotProbe(input: { id: string }): Promise<{ id: string; ok: boolean }>;
};

/**
 * P1 垂直切片：Effect IPC（electron-effect-rpc）跨 main→preload→renderer 端到端。
 *
 * 验证目标：
 * 1. 成功路径：renderer 通过 `window.api`（preload 暴露的 bridge）调用 main 处理器；
 * 2. typed domain error 路径：main 侧 `Effect.fail(PilotBoom)` 跨进程往返后，
 *    renderer 收到结构完整（reason/code）的 PilotBoom，而非现状的 code:"UNKNOWN" 裸 Error。
 */
test("effect pilot: typed Effect IPC roundtrip (success + typed domain error)", async ({
  page,
}) => {
  const { app } = await launchApp();
  try {
    // 成功路径
    const ping = await page.evaluate(() =>
      (window as unknown as { api: PilotApi }).api.PilotPing({}),
    );
    expect(ping).toEqual({ message: "pong" });

    const ok = await page.evaluate(() =>
      (window as unknown as { api: PilotApi }).api.PilotProbe({ id: "x" }),
    );
    expect(ok).toEqual({ id: "x", ok: true });

    // typed error 路径：应拒绝并还原 PilotBoom 的结构化字段
    const boom = await page.evaluate(async () => {
      try {
        await (window as unknown as { api: PilotApi }).api.PilotProbe({ id: "boom" });
        return null;
      } catch (error) {
        const e = error as Record<string, unknown>;
        return { name: e.name, reason: e.reason, code: e.code, message: e.message };
      }
    });
    expect(boom).not.toBeNull();
    expect(boom?.reason).toBe("boom: boom");
    expect(boom?.code).toBe(404);
  } finally {
    await app.close();
  }
});
