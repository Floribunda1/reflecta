import fs from "node:fs";
import path from "node:path";
import { getModel, type Api, type Model } from "@earendil-works/pi-ai";
import {
  AuthStorage,
  createAgentSession,
  createExtensionRuntime,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type ResourceLoader,
} from "@earendil-works/pi-coding-agent";

export type RunPiAgentSmokeInput = {
  apiKey: string;
  contentStorageRoot: string;
  modelId: string;
  providerId: string;
  prompt: string;
};

export type RunPiAgentSmokeResult = {
  assistantText: string;
  sessionFile: string;
  sessionId: string;
};

export function getPiAgentSessionsRoot(contentStorageRoot: string): string {
  return path.join(contentStorageRoot, "Sessions");
}

function createSmokeResourceLoader(): ResourceLoader {
  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () =>
      "You are Reflecta's Pi Agent smoke test assistant. Reply briefly and plainly.",
    getAppendSystemPrompt: () => [],
    extendResources: () => {},
    reload: async () => {},
  };
}

function resolvePiModel(providerId: string, modelId: string): Model<Api> {
  const model = (getModel as (provider: string, modelId: string) => Model<Api> | undefined)(
    providerId,
    modelId,
  );
  if (!model) throw new Error(`Pi model not found: ${providerId}/${modelId}`);
  return model;
}

function extractAssistantText(message: unknown): string {
  if (
    !message ||
    typeof message !== "object" ||
    !("role" in message) ||
    message.role !== "assistant" ||
    !("content" in message) ||
    !Array.isArray(message.content)
  ) {
    return "";
  }

  return message.content
    .map((part) =>
      part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part
        ? String(part.text)
        : "",
    )
    .join("");
}

export async function runPiAgentSmoke(input: RunPiAgentSmokeInput): Promise<RunPiAgentSmokeResult> {
  fs.mkdirSync(input.contentStorageRoot, { recursive: true });
  const sessionsRoot = getPiAgentSessionsRoot(input.contentStorageRoot);
  const agentDir = path.join(input.contentStorageRoot, ".pi-agent");
  fs.mkdirSync(sessionsRoot, { recursive: true });
  fs.mkdirSync(agentDir, { recursive: true });

  const authStorage = AuthStorage.create(path.join(agentDir, "auth.json"));
  authStorage.setRuntimeApiKey(input.providerId, input.apiKey);

  const modelRegistry = ModelRegistry.inMemory(authStorage);
  const model = resolvePiModel(input.providerId, input.modelId);
  const sessionManager = SessionManager.create(input.contentStorageRoot, sessionsRoot);
  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: false },
    retry: { enabled: false },
  });

  const { session } = await createAgentSession({
    agentDir,
    authStorage,
    cwd: input.contentStorageRoot,
    model,
    modelRegistry,
    noTools: "all",
    resourceLoader: createSmokeResourceLoader(),
    sessionManager,
    settingsManager,
    thinkingLevel: "off",
  });

  let assistantText = "";
  const unsubscribe = session.subscribe((event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      assistantText += event.assistantMessageEvent.delta;
      return;
    }
    if (event.type === "message_end") {
      const finalText = extractAssistantText(event.message);
      if (finalText) assistantText = finalText;
    }
  });

  try {
    await session.prompt(input.prompt);
    const sessionFile = session.sessionFile;
    if (!sessionFile) throw new Error("Pi session did not create a session file");
    return {
      assistantText,
      sessionFile,
      sessionId: session.sessionId,
    };
  } finally {
    unsubscribe();
    session.dispose();
  }
}
