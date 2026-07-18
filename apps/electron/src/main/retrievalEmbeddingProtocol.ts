export type RetrievalEmbeddingWorkerRequest = {
  type: "embed";
  requestId: number;
  modelId: string;
  modelPath: string;
  texts: string[];
};

export type RetrievalEmbeddingWorkerResponse =
  | { type: "ready" }
  | { type: "progress"; requestId: number; completed: number; total: number }
  | { type: "result"; requestId: number; vectors: number[][] }
  | { type: "error"; requestId: number; error: string };
