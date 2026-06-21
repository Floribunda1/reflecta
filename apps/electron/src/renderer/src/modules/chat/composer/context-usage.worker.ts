import { ALL_SPECIAL_TOKENS, countTokens } from "gpt-tokenizer/encoding/o200k_base";
import type {
  ContextUsage,
  ContextUsageRequest,
  ContextUsageWorkerRequest,
  ContextUsageWorkerResponse,
} from "./context-usage";

export function estimateContextUsage(request: ContextUsageRequest): ContextUsage {
  return {
    tokens: countTokens(request.input, { allowedSpecial: ALL_SPECIAL_TOKENS }),
    contextWindow: request.contextWindow,
    selectedContextCount: request.selectedContextCount,
  };
}

self.addEventListener("message", (event: MessageEvent<ContextUsageWorkerRequest>) => {
  const { id, ...request } = event.data;
  const response: ContextUsageWorkerResponse = {
    id,
    usage: estimateContextUsage(request),
  };
  self.postMessage(response);
});
