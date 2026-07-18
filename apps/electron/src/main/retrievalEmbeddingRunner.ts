import { utilityProcess, type UtilityProcess } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { EmbeddingProvider, RetrievalEmbeddingConfig } from "@reflecta/server";
import type {
  RetrievalEmbeddingWorkerRequest,
  RetrievalEmbeddingWorkerResponse,
} from "./retrievalEmbeddingProtocol";

type EmbeddingProgress = { completed: number; total: number };

type PendingEmbedding = {
  request: RetrievalEmbeddingWorkerRequest;
  runtimeKey: string;
  onProgress?: (progress: EmbeddingProgress) => void;
  resolve: (vectors: number[][]) => void;
  reject: (error: Error) => void;
};

export type RetrievalEmbeddingUtilityProcess = Pick<UtilityProcess, "kill" | "on" | "postMessage">;

type RetrievalEmbeddingRunnerOptions = {
  fork: () => RetrievalEmbeddingUtilityProcess;
};

export class RetrievalEmbeddingRunner {
  private readonly queue: PendingEmbedding[] = [];
  private child?: RetrievalEmbeddingUtilityProcess;
  private childReady = false;
  private childRuntimeKey = "";
  private active?: PendingEmbedding;
  private nextRequestId = 1;
  private stopped = false;

  constructor(private readonly options: RetrievalEmbeddingRunnerOptions) {}

  embed(
    config: Pick<RetrievalEmbeddingConfig, "modelId" | "modelPath">,
    texts: string[],
    onProgress?: (progress: EmbeddingProgress) => void,
  ): Promise<number[][]> {
    if (this.stopped) return Promise.reject(new Error("Retrieval embedding runner is stopped"));
    if (!config.modelPath) return Promise.reject(new Error("请先下载本地 embedding 模型"));

    return new Promise((resolve, reject) => {
      const requestId = this.nextRequestId++;
      this.queue.push({
        request: {
          type: "embed",
          requestId,
          modelId: config.modelId,
          modelPath: config.modelPath!,
          texts,
        },
        runtimeKey: `${config.modelId}\0${config.modelPath}`,
        onProgress,
        resolve,
        reject,
      });
      this.pump();
    });
  }

  stop() {
    this.stopped = true;
    const error = new Error("Retrieval embedding runner stopped");
    this.active?.reject(error);
    this.active = undefined;
    for (const pending of this.queue.splice(0)) pending.reject(error);
    this.stopChild();
  }

  private pump() {
    if (this.stopped || this.active) return;
    const pending = this.queue[0];
    if (!pending) {
      this.stopChild();
      return;
    }

    if (this.child && this.childRuntimeKey !== pending.runtimeKey) this.stopChild();
    if (!this.child) this.startChild(pending.runtimeKey);
    if (!this.childReady || !this.child) return;

    this.active = this.queue.shift();
    this.child.postMessage(this.active!.request);
  }

  private startChild(runtimeKey: string) {
    const child = this.options.fork();
    this.child = child;
    this.childReady = false;
    this.childRuntimeKey = runtimeKey;
    child.on("message", (message) => this.handleMessage(child, message));
    child.on("exit", (code) => this.handleExit(child, code));
  }

  private handleMessage(
    child: RetrievalEmbeddingUtilityProcess,
    message: RetrievalEmbeddingWorkerResponse,
  ) {
    if (child !== this.child) return;
    if (message.type === "ready") {
      this.childReady = true;
      this.pump();
      return;
    }

    const active = this.active;
    if (!active || message.requestId !== active.request.requestId) return;
    if (message.type === "progress") {
      active.onProgress?.({ completed: message.completed, total: message.total });
      return;
    }

    this.active = undefined;
    if (message.type === "result") active.resolve(message.vectors);
    else active.reject(new Error(message.error));
    this.pump();
  }

  private handleExit(child: RetrievalEmbeddingUtilityProcess, code: number) {
    if (child !== this.child) return;
    this.child = undefined;
    this.childReady = false;
    const active = this.active;
    this.active = undefined;
    if (active) active.reject(new Error(`Retrieval embedding worker exited with code ${code}`));
    this.pump();
  }

  private stopChild() {
    const child = this.child;
    this.child = undefined;
    this.childReady = false;
    this.childRuntimeKey = "";
    child?.kill();
  }
}

const workerPath = join(dirname(fileURLToPath(import.meta.url)), "retrieval-embedding-worker.js");

export const retrievalEmbeddingRunner = new RetrievalEmbeddingRunner({
  fork: () => utilityProcess.fork(workerPath),
});

export function createUtilityProcessEmbeddingProvider(
  config: RetrievalEmbeddingConfig,
): EmbeddingProvider | undefined {
  if (config.provider !== "local-llama-cpp") return undefined;
  return {
    modelId: config.modelId,
    embed: (texts, options) => retrievalEmbeddingRunner.embed(config, texts, options?.onProgress),
  };
}
