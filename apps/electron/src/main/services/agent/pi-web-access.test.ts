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
  test("defaults the SSRF allowlist for TUN fake-IP proxies", () => {
    const root = tempRoot();
    const agentDir = path.join(root, ".pi-agent");

    createPiWebAccessResources(agentDir);

    expect(JSON.parse(fs.readFileSync(path.join(agentDir, "web-search.json"), "utf8"))).toEqual({
      provider: "exa",
      workflow: "auto-summary",
      webSearch: { enabled: true },
      ssrf: { allowRanges: ["198.18.0.0/15"] },
    });
  });

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

  test("normalizes explicit provider/workflow to the fixed Exa auto-summary policy", async () => {
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

    const run = (input: Record<string, unknown>) => {
      const event: ToolCallEvent = {
        type: "tool_call",
        toolName: "web_search",
        toolCallId: "search",
        input,
      };
      return { result: handler!(event, {} as ExtensionContext), input };
    };

    // 缺省参数：不 block，也不改动输入。
    const omitted = run({ query: "Reflecta" });
    expect(await omitted.result).toBeUndefined();
    expect(omitted.input).toEqual({ query: "Reflecta" });

    // 显式合法值：不 block，但被归一化为缺省（删除后由配置决定 exa + auto-summary）。
    const allowed = run({ query: "Reflecta", provider: "exa", workflow: "auto-summary" });
    expect(await allowed.result).toBeUndefined();
    expect(allowed.input).toEqual({ query: "Reflecta" });

    // 越界值（provider: "auto"/"openai"、workflow: "none"/"summary-review"）：
    // 不再阻止执行，而是就地删除，避免模型用同样的参数反复重试失败。
    const outOfPolicy = run({
      query: "Reflecta",
      provider: "auto",
      workflow: "none",
      numResults: 5,
    });
    expect(await outOfPolicy.result).toBeUndefined();
    expect(outOfPolicy.input).toEqual({ query: "Reflecta", numResults: 5 });
  });
});
