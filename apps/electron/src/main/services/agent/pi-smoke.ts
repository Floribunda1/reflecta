import fs from "node:fs";
import path from "node:path";
import { getModel, type Api, type Model } from "@earendil-works/pi-ai/compat";
import {
  createAgentSession,
  createExtensionRuntime,
  ModelRuntime,
  SessionManager,
  SettingsManager,
  type ResourceLoader,
} from "@earendil-works/pi-coding-agent";
import { getPiAgentSessionsRoot } from "./pi-session-log";
import { extractPiAssistantText } from "./pi-message";

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

function createSmokeResourceLoader(): ResourceLoader {
  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () =>
      "You are Reflecta's Pi Agent smoke test assistant. Reply briefly and plainly.",
    getSystemPromptSource: () => undefined,
    getAppendSystemPrompt: () => [],
    getAppendSystemPromptSources: () => [],
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

export async function runPiAgentSmoke(input: RunPiAgentSmokeInput): Promise<RunPiAgentSmokeResult> {
  fs.mkdirSync(input.contentStorageRoot, { recursive: true });
  const sessionsRoot = getPiAgentSessionsRoot(input.contentStorageRoot);
  const agentDir = path.join(input.contentStorageRoot, ".pi-agent");
  fs.mkdirSync(sessionsRoot, { recursive: true });
  fs.mkdirSync(agentDir, { recursive: true });

  const modelRuntime = await ModelRuntime.create({
    authPath: path.join(agentDir, "auth.json"),
    modelsPath: null,
  });
  await modelRuntime.setRuntimeApiKey(input.providerId, input.apiKey);
  const model =
    modelRuntime.getModel(input.providerId, input.modelId) ??
    resolvePiModel(input.providerId, input.modelId);
  const sessionManager = SessionManager.create(input.contentStorageRoot, sessionsRoot);
  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: false },
    retry: { enabled: false },
  });

  const { session } = await createAgentSession({
    agentDir,
    cwd: input.contentStorageRoot,
    model,
    modelRuntime,
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
      const finalText = extractPiAssistantText(event.message);
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
