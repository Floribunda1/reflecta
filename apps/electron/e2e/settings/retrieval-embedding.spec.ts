import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { readE2eTestEnv } from "../test-env";

function writeLexicalOnlyRetrievalConfig() {
  const env = readE2eTestEnv();
  const configPath = path.join(env.appConfigDir, "reflecta-config.json");
  const existing = fs.existsSync(configPath)
    ? (JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>)
    : {};
  fs.mkdirSync(env.appConfigDir, { recursive: true });
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        ...existing,
        retrieval: {
          embedding: {
            provider: "disabled",
            modelId: "lexical-only",
          },
        },
      },
      null,
      2,
    ),
    "utf-8",
  );
}

test("@EMBEDDING-SETTINGS-001 用户查看默认本地 embedding 模型并触发下载", async () => {
  const { app, page } = await launchApp({ REFLECTA_STUB_RETRIEVAL_MODEL_DOWNLOAD: "1" });

  try {
    await page.getByLabel("Switch module").click();
    await page.getByTestId("app-settings-menu-item").click();
    await page.getByTestId("settings-menu-retrieval").click();

    await expect(page.getByTestId("settings-retrieval-model-name")).toContainText(
      "Qwen3 Embedding 0.6B",
    );
    await expect(page.getByTestId("settings-retrieval-model-purpose")).toContainText(
      "本地语义检索",
    );
    await expect(page.getByText("本地 llama.cpp embedding runtime")).toBeVisible();

    await page.getByTestId("settings-retrieval-download-button").click();
    await expect(page.getByTestId("settings-retrieval-model-status")).toContainText("已下载");
  } finally {
    await app.close();
  }
});

test("@EMBEDDING-SETTINGS-002 用户查看并重建 retrieval 索引", async () => {
  writeLexicalOnlyRetrievalConfig();
  const { app, page } = await launchApp();

  try {
    await page.getByLabel("Switch module").click();
    await page.getByTestId("app-settings-menu-item").click();
    await page.getByTestId("settings-menu-retrieval").click();

    await expect(page.getByTestId("settings-retrieval-index-status")).toBeVisible();
    await page.getByTestId("settings-retrieval-rebuild-button").click();
    await expect(page.getByTestId("settings-retrieval-index-status")).toContainText("已完成", {
      timeout: 30_000,
    });
  } finally {
    await app.close();
  }
});
