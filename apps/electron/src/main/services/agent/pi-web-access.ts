import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { InlineExtension } from "@earendil-works/pi-coding-agent";

export const PI_WEB_ACCESS_TOOL_NAMES = [
  "web_search",
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
  const next = {
    ...current,
    provider: "exa",
    workflow: "auto-summary",
    webSearch: { ...webSearch, enabled: true },
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

        if (event.input.provider !== undefined && event.input.provider !== "exa") {
          return {
            block: true,
            reason: "Reflecta 只允许使用 Exa 进行网页搜索。",
          };
        }
        if (event.input.workflow !== undefined && event.input.workflow !== "auto-summary") {
          return {
            block: true,
            reason: "Reflecta 网页搜索固定使用自动摘要流程。",
          };
        }
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
