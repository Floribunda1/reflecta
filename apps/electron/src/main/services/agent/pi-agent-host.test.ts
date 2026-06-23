import { describe, expect, test, vi } from "vitest";
import { AuthStorage } from "@earendil-works/pi-coding-agent";
import type { ResolvedAiModelConfig } from "../../config";
import { configurePiRuntimeAuth } from "./pi-agent-host";

vi.mock("./pi-readonly-tools", () => ({
  createPiReadOnlyTools: () => [],
  PI_READ_ONLY_TOOL_NAMES: [],
}));

vi.mock("./pi-write-tools", () => ({
  approvalTitleForTool: () => "候选操作",
  createPiWriteTools: () => [],
  executePiApprovedTool: vi.fn(),
  isPiApprovalToolName: () => false,
  PI_APPROVAL_TOOL_NAMES: [],
}));

vi.mock("./codex-auth", () => ({
  getCodexCredentials: vi.fn(async () => ({
    accessToken: "codex-access-token",
    accountId: "account-test",
  })),
}));

function modelConfig(input: {
  providerId: string;
  apiKey: string;
  authType?: "api-key" | "codex";
}): ResolvedAiModelConfig {
  return {
    provider: { id: input.providerId, apiKey: input.apiKey, models: [{ id: "model-test" }] },
    catalog: {
      id: input.providerId,
      name: input.providerId,
      baseUrl: "https://example.test",
      authType: input.authType,
      models: [{ id: "model-test" }],
    },
    model: { id: "model-test" },
    selection: { providerId: input.providerId, modelId: "model-test" },
    label: `${input.providerId} / model-test`,
  };
}

describe("configurePiRuntimeAuth", () => {
  test("uses Codex access token instead of the empty config key", async () => {
    const authStorage = AuthStorage.inMemory();

    await configurePiRuntimeAuth(
      authStorage,
      modelConfig({ providerId: "openai-codex", apiKey: "", authType: "codex" }),
    );

    await expect(authStorage.getApiKey("openai-codex")).resolves.toBe("codex-access-token");
  });

  test("uses configured API key for normal providers", async () => {
    const authStorage = AuthStorage.inMemory();

    await configurePiRuntimeAuth(
      authStorage,
      modelConfig({ providerId: "opencode-go", apiKey: "opencode-key" }),
    );

    await expect(authStorage.getApiKey("opencode-go")).resolves.toBe("opencode-key");
  });
});
