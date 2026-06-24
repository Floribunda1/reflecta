import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { launchApp } from "../agent/agent-e2e";
import { readE2eTestEnv } from "../test-env";

const RETRIEVAL_MODEL_FILE_NAME = "Qwen3-Embedding-0.6B-Q8_0.gguf";

function writePreparedSemanticRetrievalConfig(baseUrl: string) {
  const env = readE2eTestEnv();
  const configPath = path.join(env.appConfigDir, "reflecta-config.json");
  const modelPath = path.join(env.appConfigDir, "models", "retrieval", RETRIEVAL_MODEL_FILE_NAME);
  const existing = fs.existsSync(configPath)
    ? (JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>)
    : {};
  fs.mkdirSync(env.appConfigDir, { recursive: true });
  fs.mkdirSync(path.dirname(modelPath), { recursive: true });
  fs.writeFileSync(modelPath, "prepared semantic retrieval model", "utf-8");
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        ...existing,
        retrieval: {
          embedding: {
            provider: "openai-compatible",
            modelId: "test-e2e-semantic-progress",
            baseUrl,
          },
        },
      },
      null,
      2,
    ),
    "utf-8",
  );
}

async function startSlowEmbeddingServer() {
  const server = http.createServer((request, response) => {
    if (request.method !== "POST" || request.url !== "/v1/embeddings") {
      response.writeHead(404).end();
      return;
    }

    let body = "";
    request.setEncoding("utf-8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      setTimeout(() => {
        const payload = JSON.parse(body) as { input?: string[] | string };
        const inputs = Array.isArray(payload.input) ? payload.input : [payload.input ?? ""];
        response.setHeader("Content-Type", "application/json");
        response.end(
          JSON.stringify({
            data: inputs.map((_text, index) => ({ index, embedding: [1, 0] })),
          }),
        );
      }, 120);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Embedding server failed to start");
  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function waitForEmbeddingProgressAdvance(
  page: Awaited<ReturnType<typeof launchApp>>["page"],
) {
  const completedCounts: number[] = [];
  await expect
    .poll(
      async () => {
        const match = /生成 embedding (\d+)\/(\d+)/.exec(await page.locator("body").innerText());
        if (!match) return false;
        completedCounts.push(Number(match[1]));
        return Math.max(...completedCounts) > Math.min(...completedCounts);
      },
      { timeout: 20_000 },
    )
    .toBe(true);
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
      "本地 embedding 模型",
    );
    await expect(page.getByTestId("settings-retrieval-model-purpose")).toContainText("llama.cpp");

    await page.getByTestId("settings-retrieval-download-button").click();
    await expect(page.getByTestId("settings-retrieval-model-status")).toContainText("已安装");
  } finally {
    await app.close();
  }
});

test("@EMBEDDING-SETTINGS-002 用户查看并重建 retrieval 索引", async () => {
  const embeddingServer = await startSlowEmbeddingServer();
  writePreparedSemanticRetrievalConfig(embeddingServer.baseUrl);
  const { app, page } = await launchApp();

  try {
    await page.getByLabel("Switch module").click();
    await page.getByTestId("app-settings-menu-item").click();
    await page.getByTestId("settings-menu-retrieval").click();

    await expect(page.getByTestId("settings-retrieval-index-status")).toBeVisible();
    await page.getByTestId("settings-retrieval-rebuild-button").click();
    await expect(page.getByTestId("settings-retrieval-index-status")).toContainText("构建中");
    await waitForEmbeddingProgressAdvance(page);
    await expect(page.getByTestId("settings-retrieval-index-status")).toContainText("已就绪", {
      timeout: 30_000,
    });
  } finally {
    await app.close();
    await embeddingServer.close();
  }
});
