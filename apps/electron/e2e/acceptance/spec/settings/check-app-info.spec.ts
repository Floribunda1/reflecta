import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";

const PROJECT_URL = "https://github.com/Floribunda1/reflecta";
const RELEASES_URL = `${PROJECT_URL}/releases`;

async function openAboutSettings(launched: Awaited<ReturnType<typeof launchApp>>) {
  const { page } = launched;
  await page.getByTestId("app-settings-menu-item").click();
  await page.getByTestId("settings-menu-about").click();
  await expect(page.getByRole("heading", { name: "关于" })).toBeVisible();
}

test("@ABOUT-SETTINGS-001 用户查看应用版本与运行架构", async () => {
  const launched = await launchApp();

  try {
    await openAboutSettings(launched);
    const version = await launched.app.evaluate(({ app }) => app.getVersion());
    const arch = await launched.app.evaluate(() => process.arch);

    await expect(launched.page.getByTestId("settings-about-version")).toHaveText(
      `v${version}（${arch}）`,
    );
  } finally {
    await launched.app.close();
  }
});

test("@ABOUT-SETTINGS-002 没有更新机制的构建上更新入口不可用", async () => {
  const launched = await launchApp();

  try {
    await openAboutSettings(launched);

    // E2E 运行的是未打包的源码构建，不具备 macOS 安装版的 Sparkle 更新组件，
    // 因此检查更新按钮应禁用并给出说明，而不是报错。
    await expect(launched.page.getByTestId("settings-about-check-button")).toBeDisabled();
    await expect(launched.page.getByText("检查更新仅适用于 macOS 安装版")).toBeVisible();
  } finally {
    await launched.app.close();
  }
});

test("@ABOUT-SETTINGS-003 用户查看项目与许可信息", async () => {
  const launched = await launchApp();

  try {
    await openAboutSettings(launched);

    await expect(launched.page.getByTestId("settings-about-repo-link")).toHaveAttribute(
      "href",
      PROJECT_URL,
    );
    await expect(launched.page.getByTestId("settings-about-releases-link")).toHaveAttribute(
      "href",
      RELEASES_URL,
    );
    await expect(launched.page.getByText("MIT License")).toBeVisible();
  } finally {
    await launched.app.close();
  }
});
