import { describe, expect, test, vi } from "vitest";

vi.mock("../../config", () => ({
  getAiModelConfig: (selection: { providerId?: string; modelId?: string } = {}) => {
    const providerId = selection.providerId ?? "deepseek";
    const modelId = selection.modelId ?? "deepseek-chat";
    const isOpenAI = providerId === "openai";
    const isCodex = providerId === "openai-codex";
    return {
      provider: {
        id: providerId,
        apiKey: isCodex ? "" : "test-key",
        models: [{ id: modelId }],
      },
      catalog: {
        id: providerId,
        name: isOpenAI ? "OpenAI" : isCodex ? "Codex Subscription" : "DeepSeek",
        baseUrl: isOpenAI || isCodex ? "https://api.openai.com/v1" : "https://api.deepseek.com",
        authType: isCodex ? "codex" : "api-key",
        models: [{ id: modelId }],
      },
      model: { id: modelId },
      selection,
      label: `${providerId} / ${modelId}`,
    };
  },
}));

vi.mock("./codex-auth", () => ({
  getCodexCredentials: async () => ({
    accessToken: "test-codex-token",
    accountId: "account-test",
  }),
}));

function sseResponse(events: unknown[]) {
  const body = `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")}data: [DONE]\n\n`;
  return new Response(body, {
    headers: { "content-type": "text/event-stream" },
  });
}

describe("getAgentModel", () => {
  test("uses OpenAI-compatible chat completions model family", async () => {
    const { getAgentModel } = await import("./model");
    const { model, modelId, providerOptionsKey } = await getAgentModel({
      providerId: "deepseek",
      modelId: "deepseek-chat",
    });
    expect((model as { provider?: string }).provider).toBe("deepseek.chat");
    expect(modelId).toBe("deepseek:deepseek-chat");
    expect(providerOptionsKey).toBe("deepseek");
  });

  test("uses camelCase provider options keys for hyphenated compatible providers", async () => {
    const { getAgentModel } = await import("./model");
    const { providerOptionsKey } = await getAgentModel({
      providerId: "opencode-zen",
      modelId: "glm-5",
    });
    expect(providerOptionsKey).toBe("opencodeZen");
  });

  test("uses Responses API for first-party OpenAI models", async () => {
    const { getAgentModel } = await import("./model");
    const { model, modelId, providerOptionsKey } = await getAgentModel({
      providerId: "openai",
      modelId: "o4-mini",
    });
    expect((model as { provider?: string }).provider).toContain("responses");
    expect(modelId).toBe("openai:o4-mini");
    expect(providerOptionsKey).toBe("openai");
  });

  test("uses Codex subscription credentials with Responses API", async () => {
    const { getAgentModel } = await import("./model");
    const { model, modelId, providerOptionsKey, codexSubscription } = await getAgentModel({
      providerId: "openai-codex",
      modelId: "gpt-5.4",
    });

    expect((model as { provider?: string }).provider).toContain("openai-codex.responses");
    expect(modelId).toBe("openai-codex:gpt-5.4");
    expect(providerOptionsKey).toBe("openai");
    expect(codexSubscription).toBe(true);
  });

  test("streams reasoning_content from compatible providers as reasoning deltas", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      sseResponse([
        {
          id: "chunk-1",
          object: "chat.completion.chunk",
          created: 0,
          model: "deepseek-reasoner",
          choices: [
            {
              index: 0,
              delta: { role: "assistant", reasoning_content: "thinking" },
              finish_reason: null,
            },
          ],
        },
        {
          id: "chunk-2",
          object: "chat.completion.chunk",
          created: 0,
          model: "deepseek-reasoner",
          choices: [{ index: 0, delta: { content: "done" }, finish_reason: null }],
        },
        {
          id: "chunk-3",
          object: "chat.completion.chunk",
          created: 0,
          model: "deepseek-reasoner",
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        },
      ]),
    );
    const { streamText } = await import("ai");
    const { getAgentModel } = await import("./model");
    const { model } = await getAgentModel({
      providerId: "deepseek",
      modelId: "deepseek-reasoner",
    });

    const result = streamText({ model, prompt: "hi" });
    const reasoning: string[] = [];
    const text: string[] = [];
    for await (const part of result.fullStream) {
      if (part.type === "reasoning-delta") reasoning.push(part.text);
      if (part.type === "text-delta") text.push(part.text);
    }

    expect(reasoning.join("")).toBe("thinking");
    expect(text.join("")).toBe("done");
    fetchMock.mockRestore();
  });
});
