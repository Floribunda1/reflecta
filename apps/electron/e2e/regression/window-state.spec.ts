import { expect, test } from "@playwright/test";
import { launchAgentPage } from "../acceptance/spec/agent/agent-e2e";

test("关闭后恢复上次的窗口尺寸", async () => {
  const first = await launchAgentPage();

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

  const second = await launchAgentPage();

  try {
    const window = await second.app.browserWindow(second.page);
    await expect
      .poll(() => window.evaluate((window: { getSize(): [number, number] }) => window.getSize()))
      .toEqual([1024, 768]);
  } finally {
    await second.app.close();
  }
});
