import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DefaultResourceLoader,
  SettingsManager,
  type ExtensionAPI,
  type ExtensionContext,
  type ToolCallEvent,
  type ToolCallEventResult,
} from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createPiWebAccessResources, PI_WEB_ACCESS_TOOL_NAMES } from "./pi-web-access";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "reflecta-pi-web-access-"));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createPiWebAccessResources", () => {
  test("loads only the bundled web access tools with app-isolated Exa policy", async () => {
    const root = tempRoot();
    const agentDir = path.join(root, ".pi-agent");
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(
      path.join(agentDir, "web-search.json"),
      JSON.stringify({
        provider: "openai",
        workflow: "summary-review",
        exaApiKey: "preserved-key",
        ssrf: { allowRanges: ["198.18.0.0/15"] },
        webSearch: { enabled: false, preserved: true },
      }),
    );

    const resources = createPiWebAccessResources(agentDir);
    const loader = new DefaultResourceLoader({
      cwd: root,
      agentDir,
      settingsManager: SettingsManager.inMemory({}),
      noExtensions: true,
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
      noContextFiles: true,
      additionalExtensionPaths: resources.additionalExtensionPaths,
      extensionFactories: resources.extensionFactories,
    });
    await loader.reload();

    expect(process.env.PI_CODING_AGENT_DIR).toBe(agentDir);
    expect(JSON.parse(fs.readFileSync(path.join(agentDir, "web-search.json"), "utf8"))).toEqual({
      provider: "exa",
      workflow: "auto-summary",
      exaApiKey: "preserved-key",
      ssrf: { allowRanges: ["198.18.0.0/15"] },
      webSearch: { enabled: true, preserved: true },
    });
    expect(loader.getExtensions().errors).toEqual([]);
    expect(loader.getExtensions().extensions.map((extension) => extension.path)).toEqual([
      resources.additionalExtensionPaths[0],
      "<inline:reflecta-web-access-policy>",
    ]);
    expect(
      loader.getExtensions().extensions.flatMap((extension) => [...extension.tools.keys()]),
    ).toEqual(PI_WEB_ACCESS_TOOL_NAMES);
    expect(loader.getSkills().skills).toEqual([]);
  });

  test("allows only the fixed Exa auto-summary search policy", async () => {
    const resources = createPiWebAccessResources(tempRoot());
    const policy = resources.extensionFactories[0];
    const factory = typeof policy === "function" ? policy : policy.factory;
    let handler:
      | ((
          event: ToolCallEvent,
          context: ExtensionContext,
        ) => Promise<ToolCallEventResult | undefined> | ToolCallEventResult | undefined)
      | undefined;
    factory({
      on: (event: string, candidate: typeof handler) => {
        if (event === "tool_call") handler = candidate;
      },
    } as ExtensionAPI);
    if (!handler) throw new Error("web access policy did not register a tool_call handler");

    const call = (input: Record<string, unknown>) =>
      handler!(
        { type: "tool_call", toolName: "web_search", toolCallId: "search", input },
        {} as ExtensionContext,
      );

    expect(await call({ query: "Reflecta" })).toBeUndefined();
    expect(
      await call({ query: "Reflecta", provider: "exa", workflow: "auto-summary" }),
    ).toBeUndefined();
    expect(await call({ query: "Reflecta", provider: "openai" })).toEqual({
      block: true,
      reason: "Reflecta 只允许使用 Exa 进行网页搜索。",
    });
    expect(await call({ query: "Reflecta", workflow: "summary-review" })).toEqual({
      block: true,
      reason: "Reflecta 网页搜索固定使用自动摘要流程。",
    });
  });
});
