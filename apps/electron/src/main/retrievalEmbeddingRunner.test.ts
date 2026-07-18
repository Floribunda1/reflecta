import { describe, expect, test, vi } from "vitest";
import {
  RetrievalEmbeddingRunner,
  type RetrievalEmbeddingUtilityProcess,
} from "./retrievalEmbeddingRunner";
import type { RetrievalEmbeddingWorkerResponse } from "./retrievalEmbeddingProtocol";

function createFakeChild() {
  const messageListeners: Array<(message: RetrievalEmbeddingWorkerResponse) => void> = [];
  const exitListeners: Array<(code: number) => void> = [];
  const child = {
    killed: false,
    messages: [] as unknown[],
    kill: vi.fn(() => {
      child.killed = true;
      return true;
    }),
    on: vi.fn((event: string, listener: (...args: never[]) => void) => {
      if (event === "message") {
        messageListeners.push(listener as (message: RetrievalEmbeddingWorkerResponse) => void);
      } else if (event === "exit") {
        exitListeners.push(listener as (code: number) => void);
      }
      return child;
    }),
    postMessage: vi.fn((message: unknown) => child.messages.push(message)),
    emitMessage(message: RetrievalEmbeddingWorkerResponse) {
      for (const listener of messageListeners) listener(message);
    },
    emitExit(code: number) {
      for (const listener of exitListeners) listener(code);
    },
  };
  return child;
}

describe("retrieval embedding runner", () => {
  test("reuses one utility process for queued embeddings and stops it when the queue is empty", async () => {
    const child = createFakeChild();
    const fork = vi.fn(() => child as unknown as RetrievalEmbeddingUtilityProcess);
    const runner = new RetrievalEmbeddingRunner({ fork });
    const config = { modelId: "local-model", modelPath: "/models/local.gguf" };

    const first = runner.embed(config, ["first"]);
    const second = runner.embed(config, ["second"]);
    expect(fork).toHaveBeenCalledTimes(1);

    child.emitMessage({ type: "ready" });
    expect(child.messages).toHaveLength(1);
    child.emitMessage({ type: "result", requestId: 1, vectors: [[1, 0]] });
    expect(child.messages).toHaveLength(2);
    child.emitMessage({ type: "result", requestId: 2, vectors: [[0, 1]] });

    await expect(first).resolves.toEqual([[1, 0]]);
    await expect(second).resolves.toEqual([[0, 1]]);
    expect(fork).toHaveBeenCalledTimes(1);
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  test("does not load two local models at the same time when configuration changes", async () => {
    const firstChild = createFakeChild();
    const secondChild = createFakeChild();
    const fork = vi
      .fn()
      .mockReturnValueOnce(firstChild as unknown as RetrievalEmbeddingUtilityProcess)
      .mockReturnValueOnce(secondChild as unknown as RetrievalEmbeddingUtilityProcess);
    const runner = new RetrievalEmbeddingRunner({ fork });

    const first = runner.embed({ modelId: "one", modelPath: "/one.gguf" }, ["first"]);
    const second = runner.embed({ modelId: "two", modelPath: "/two.gguf" }, ["second"]);
    firstChild.emitMessage({ type: "ready" });
    firstChild.emitMessage({ type: "result", requestId: 1, vectors: [[1]] });

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(fork).toHaveBeenCalledTimes(2);
    secondChild.emitMessage({ type: "ready" });
    secondChild.emitMessage({ type: "result", requestId: 2, vectors: [[2]] });

    await expect(first).resolves.toEqual([[1]]);
    await expect(second).resolves.toEqual([[2]]);
    expect(secondChild.kill).toHaveBeenCalledTimes(1);
  });
});
