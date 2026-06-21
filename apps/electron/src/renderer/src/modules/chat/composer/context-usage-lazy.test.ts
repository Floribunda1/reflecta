import { describe, expect, test, vi } from "vitest";
import type { AgentChatMessage } from "@shared/chat";

const mocks = vi.hoisted(() => ({
  importedTokenizer: vi.fn(),
}));

vi.mock("gpt-tokenizer/encoding/o200k_base", () => {
  mocks.importedTokenizer();
  return {
    ALL_SPECIAL_TOKENS: "all",
    countTokens: vi.fn(() => 1),
  };
});

function userMessage(text: string): AgentChatMessage {
  return {
    id: "user-1",
    role: "user",
    parts: [{ type: "text", text }],
  };
}

describe("context usage lazy tokenizer", () => {
  test("does not import tokenizer from main-thread usage helpers", async () => {
    const { buildContextUsageRequest } = await import("./context-usage");

    expect(mocks.importedTokenizer).not.toHaveBeenCalled();

    buildContextUsageRequest({
      messages: [userMessage("hello world")],
      draft: "",
      selectedContexts: [],
      modelSelection: { providerId: "openai", modelId: "gpt-4o" },
    });

    expect(mocks.importedTokenizer).not.toHaveBeenCalled();
  });
});
