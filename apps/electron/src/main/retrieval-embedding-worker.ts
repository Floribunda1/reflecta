import { LlamaCppEmbeddingProvider } from "@reflecta/server";
import type {
  RetrievalEmbeddingWorkerRequest,
  RetrievalEmbeddingWorkerResponse,
} from "./retrievalEmbeddingProtocol";

const parentPort = process.parentPort;
if (!parentPort) throw new Error("Retrieval embedding worker requires a parent process");

let provider: LlamaCppEmbeddingProvider | undefined;
let providerKey = "";

function reply(response: RetrievalEmbeddingWorkerResponse) {
  parentPort.postMessage(response);
}

parentPort.on("message", async ({ data }: Electron.MessageEvent) => {
  const request = data as RetrievalEmbeddingWorkerRequest;
  if (request.type !== "embed") return;

  try {
    const key = `${request.modelId}\0${request.modelPath}`;
    if (!provider || providerKey !== key) {
      provider = new LlamaCppEmbeddingProvider({
        modelId: request.modelId,
        modelPath: request.modelPath,
      });
      providerKey = key;
    }
    const vectors = await provider.embed(request.texts, {
      onProgress: ({ completed, total }) =>
        reply({ type: "progress", requestId: request.requestId, completed, total }),
    });
    reply({ type: "result", requestId: request.requestId, vectors });
  } catch (error) {
    reply({
      type: "error",
      requestId: request.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

reply({ type: "ready" });
