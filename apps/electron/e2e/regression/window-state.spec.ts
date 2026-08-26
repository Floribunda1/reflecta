import { expect, test } from "@playwright/test";
import { launchApp } from "../acceptance/spec/agent/agent-e2e";

// 窗口尺寸恢复与打开哪个模块页无关；用 capture 默认页即可，
// 避免二次启动时为进 agent 页引入额外的加载竞态。
async function launchToCapture() {
  const launched = await launchApp();
  await expect(
    launched.page.getByTestId("capture-page").or(launched.page.getByTestId("agent-page")),
  ).toBeVisible({ timeout: 20_000 });
  return launched;
}

test("关闭后恢复上次的窗口尺寸", async () => {
  // 冷启动 + 二次启动的 Electron 首启可能偏慢，预留足够预算。
  test.setTimeout(120_000);

  const first = await launchToCapture();

  try {
    const window = await first.app.browserWindow(first.page);
    await window.evaluate(
      (window: { unmaximize(): void; setSize(width: number, height: number): void }) => {
        window.unmaximize();
        window.setSize(1024, 768);
      },
    );
  } finally {
    await first.app.close();
  }

  const second = await launchToCapture();

  try {
    const window = await second.app.browserWindow(second.page);
    await expect
      .poll(() => window.evaluate((window: { getSize(): [number, number] }) => window.getSize()))
      .toEqual([1024, 768]);
  } finally {
    await second.app.close();
  }
});
