import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { InlineExtension } from "@earendil-works/pi-coding-agent";

export const PI_WEB_ACCESS_TOOL_NAMES = [
  "web_search",
  "source_check",
  "fetch_content",
  "get_search_content",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function configurePiWebAccess(agentDir: string) {
  fs.mkdirSync(agentDir, { recursive: true });
  process.env.PI_CODING_AGENT_DIR = agentDir;

  const configPath = path.join(agentDir, "web-search.json");
  let current: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (isRecord(parsed)) current = parsed;
    } catch {
      current = {};
    }
  }

  const webSearch = isRecord(current.webSearch) ? current.webSearch : {};
  const ssrf = isRecord(current.ssrf) ? current.ssrf : {};
  const next = {
    ...current,
    provider: "exa",
    workflow: "auto-summary",
    webSearch: { ...webSearch, enabled: true },
    ssrf: { ...ssrf, allowRanges: ssrf.allowRanges ?? ["198.18.0.0/15"] },
  };
  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  if (!fs.existsSync(configPath) || fs.readFileSync(configPath, "utf8") !== serialized) {
    fs.writeFileSync(configPath, serialized);
  }
}

function resolvePiWebAccessExtensionPath(): string {
  const require = createRequire(import.meta.url);
  return path.join(path.dirname(require.resolve("pi-web-access/package.json")), "index.ts");
}

function createPiWebAccessPolicy(): InlineExtension {
  return {
    name: "reflecta-web-access-policy",
    factory: (pi) => {
      pi.on("tool_call", (event) => {
        if (event.toolName !== "web_search" || !isRecord(event.input)) return undefined;

        // 模型显式传入的 provider / workflow 一律就地删除，回落到
        // web-search.json 固定的 provider: "exa" + workflow: "auto-summary"。
        // 不直接 block：模型会把描述中的 "auto" / "none" 当成合理取值，
        // 阻止后它会反复用同样的越界参数重试而持续失败；
        // 静默归一化让任何显式值都等价于缺省，稳定走自动摘要。
        delete event.input.provider;
        delete event.input.workflow;
        return undefined;
      });
    },
  };
}

export function createPiWebAccessResources(agentDir: string): {
  additionalExtensionPaths: string[];
  extensionFactories: InlineExtension[];
} {
  configurePiWebAccess(agentDir);
  return {
    additionalExtensionPaths: [resolvePiWebAccessExtensionPath()],
    extensionFactories: [createPiWebAccessPolicy()],
  };
}
