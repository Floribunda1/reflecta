import { afterAll, beforeAll } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { configureRetrievalEmbedding } from "@reflecta/server";

const SEED_SCRIPT = path.resolve(import.meta.dirname, "../scripts/seed-test-data.ts");
const workerId = process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? "0";
const TEST_DIR = path.join(os.tmpdir(), "reflecta-cli-test", workerId, String(process.pid));
const TEST_DB_PATH = path.join(TEST_DIR, "reflecta.db");
const TEST_RETRIEVAL_INDEX_PATH = path.join(TEST_DIR, "retrieval-index");
let embeddingServer: Server | undefined;

fs.rmSync(TEST_DIR, { recursive: true, force: true });
fs.mkdirSync(TEST_DIR, { recursive: true });
process.env.REFLECTA_DB_PATH = TEST_DB_PATH;
process.env.REFLECTA_RETRIEVAL_INDEX_PATH = TEST_RETRIEVAL_INDEX_PATH;

function embeddingFor(text: string): number[] {
  const concepts = [
    /\b(ai|agent|llm|model)\b|模型|智能体|助手|大模型/i,
    /产出|输出|回复|回答|result|response|answer|output/i,
    /稳定|可靠|可控|一致|预期|quality|stable|reliable|consistent|expected/i,
    /验收|标准|criteria|check|检查|评估|判断|完成/i,
  ];
  return concepts.map((concept) => (concept.test(text) ? 1 : 0));
}

async function startEmbeddingServer(): Promise<string> {
  embeddingServer = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as { input: string[] };
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          data: body.input.map((text) => ({ embedding: embeddingFor(text) })),
        }),
      );
    });
  });
  await new Promise<void>((resolve) => embeddingServer!.listen(0, "127.0.0.1", resolve));
  const address = embeddingServer.address();
  if (!address || typeof address === "string") throw new Error("Embedding server failed to start");
  return `http://127.0.0.1:${address.port}/v1`;
}

beforeAll(async () => {
  configureRetrievalEmbedding({
    provider: "openai-compatible",
    modelId: "cli-test-embedding",
    baseUrl: await startEmbeddingServer(),
  });

  try {
    execSync(`bun run "${SEED_SCRIPT}" "${TEST_DB_PATH}"`, {
      stdio: "pipe",
      encoding: "utf-8",
      timeout: 30000,
    });
  } catch (err) {
    throw new Error(`Seed script failed:\n${err instanceof Error ? err.message : String(err)}`);
  }

  console.log(`[test/setup] Seeded test database at ${TEST_DB_PATH}`);
});

afterAll(async () => {
  configureRetrievalEmbedding();
  if (embeddingServer) {
    await new Promise<void>((resolve, reject) => {
      embeddingServer!.close((error) => (error ? reject(error) : resolve()));
    });
  }
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});
