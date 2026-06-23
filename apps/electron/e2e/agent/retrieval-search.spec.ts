import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { composer, launchAgentPage } from "./agent-e2e";
import { resetAgentFixtures, seedUnderstanding } from "./agent-fixtures";
import { readE2eTestEnv } from "../test-env";

test.beforeEach(() => {
  resetAgentFixtures();
});

function writeRetrievalConfig(baseUrl: string) {
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
            provider: "openai-compatible",
            modelId: "test-e2e-semantic",
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

async function startEmbeddingServer() {
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
      const payload = JSON.parse(body) as { input?: string[] | string };
      const inputs = Array.isArray(payload.input) ? payload.input : [payload.input ?? ""];
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          data: inputs.map((text, index) => ({
            index,
            embedding: /semanticvector-target|meaningbridge/i.test(text) ? [1, 0] : [0, 1],
          })),
        }),
      );
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

test("@AG-RETRIEVAL-001 用户通过关键词搜索找到 Understanding", async () => {
  seedUnderstanding({
    id: "e2e-lexical-target",
    title: "Lexical Retrieval Canary",
    body: "This body contains E2E_LEXICAL_CANARY_927 for retrieval.",
  });
  const { app, page } = await launchAgentPage();

  try {
    await composer(page).click();
    await page.keyboard.type("@E2E_LEXICAL_CANARY_927");
    await expect(page.getByTestId("agent-context-picker")).toBeVisible({ timeout: 15_000 });
    await expect(
      page
        .locator('[data-testid="agent-context-option"][data-context-type="understanding"]')
        .filter({ hasText: "Lexical Retrieval Canary" }),
    ).toBeVisible();
  } finally {
    await app.close();
  }
});

test("@AG-RETRIEVAL-002 用户通过 @ 搜索不会看到只有语义相关的 Understanding", async () => {
  const embeddingServer = await startEmbeddingServer();
  writeRetrievalConfig(embeddingServer.baseUrl);
  seedUnderstanding({
    id: "e2e-semantic-target",
    title: "Vector Recall Canary",
    body: "semanticvector-target document without query words.",
  });
  const { app, page } = await launchAgentPage();

  try {
    await composer(page).click();
    await page.keyboard.type("@meaningbridge");
    await expect(page.getByTestId("agent-context-picker")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("没有可选上下文")).toBeVisible({ timeout: 15_000 });
    await expect(
      page
        .locator('[data-testid="agent-context-option"][data-context-type="understanding"]')
        .filter({ hasText: "Vector Recall Canary" }),
    ).toHaveCount(0);
  } finally {
    await app.close();
    await embeddingServer.close();
  }
});
