import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { seedUnderstanding } from "../agent/agent-fixtures";
import { readE2eTestEnv } from "../test-env";

async function openStorageSettings(page: Awaited<ReturnType<typeof launchApp>>["page"]) {
  await page.getByTestId("app-settings-menu-item").click();
  await page.getByTestId("settings-menu-storage").click();
  await expect(page.getByRole("heading", { name: "存储" })).toBeVisible();
}

function writeCustomStorageRoot(customRoot: string) {
  const env = readE2eTestEnv();
  const configPath = path.join(env.appConfigDir, "reflecta-config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
  fs.writeFileSync(
    configPath,
    JSON.stringify({ ...config, contentStorageRoot: customRoot }, null, 2),
    "utf-8",
  );
}

test("@STORAGE-SETTINGS-001 用户切换内容存储位置", async () => {
  const env = readE2eTestEnv();
  const selectedPath = path.join(path.dirname(env.contentStorageRoot), "selected-content");
  fs.mkdirSync(selectedPath, { recursive: true });
  const { app, page } = await launchApp();

  try {
    await app.evaluate(({ dialog }, nextPath) => {
      const mutableDialog = dialog as typeof dialog & {
        showOpenDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>;
      };
      mutableDialog.showOpenDialog = async () => ({ canceled: false, filePaths: [nextPath] });
    }, selectedPath);
    await openStorageSettings(page);
    await page.getByRole("button", { name: "更改目录" }).click();

    await expect(page.getByText(selectedPath)).toBeVisible();
    await expect(page.getByText("需要重启", { exact: true })).toBeVisible();
    await expect(page.getByText("数据目录已更新，重启应用后生效。")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@STORAGE-SETTINGS-002 用户恢复默认内容存储位置", async () => {
  const env = readE2eTestEnv();
  writeCustomStorageRoot(path.join(path.dirname(env.contentStorageRoot), "custom-content"));
  const { app, page } = await launchApp();

  try {
    await openStorageSettings(page);
    await page.getByRole("button", { name: "重置为默认" }).click();

    await expect(page.getByText(env.contentStorageRoot)).toBeVisible();
    await expect(page.getByText("数据目录已更新，重启应用后生效。")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@STORAGE-SETTINGS-003 用户扫描并确认清理孤立资源", async () => {
  const env = readE2eTestEnv();
  const assetsDir = path.join(env.contentStorageRoot, "assets");
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(path.join(assetsDir, "used.png"), "used");
  fs.writeFileSync(path.join(assetsDir, "orphan.png"), "orphan");
  seedUnderstanding({
    id: "storage-used-asset",
    title: "引用资源",
    body: "![used](asset:///used.png)",
  });
  const { app, page } = await launchApp();

  try {
    await openStorageSettings(page);
    await page.getByRole("button", { name: "扫描" }).click();
    await expect(page.getByText("发现 1 个无效文件")).toBeVisible();
    await expect(page.getByText("orphan.png")).toBeVisible();

    await page.getByRole("button", { name: "清除 1 个文件" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "确认清除" }).click();
    await expect(page.getByText("已清除无效媒体文件")).toBeVisible();
    expect(fs.existsSync(path.join(assetsDir, "orphan.png"))).toBe(false);
    expect(fs.existsSync(path.join(assetsDir, "used.png"))).toBe(true);
  } finally {
    await app.close();
  }
});

test("@STORAGE-SETTINGS-004 内容存储中没有孤立资源", async () => {
  const { app, page } = await launchApp();

  try {
    await openStorageSettings(page);
    await page.getByRole("button", { name: "扫描" }).click();
    await expect(page.getByText("未发现无效文件")).toBeVisible();
  } finally {
    await app.close();
  }
});
