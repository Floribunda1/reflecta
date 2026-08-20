/** config 域业务逻辑（删除式迁移：从 ConfigService 抽出为纯函数，供 Effect handler 调用）。 */
import { app, dialog, shell } from "electron";
import { configureRetrievalEmbedding, type RetrievalIndexStatus } from "@reflecta/server";
import type {
  AiConfig,
  AiModelOption,
  AiModelSelection,
  AiProviderDefinition,
  AiReasoningLevel,
  RetrievalConfig,
  RetrievalEmbeddingModelStatus,
} from "../config";
import { retrievalIndexCoordinator } from "../retrievalIndexCoordinator";
import {
  getActiveAgentReasoningLevel as getStoredReasoningLevel,
  clampAiReasoningLevel,
  downloadDefaultRetrievalEmbeddingModel as downloadModel,
  getActiveAiModelSelection,
  getAiConfig as getStoredAiConfig,
  getAiModelOptions,
  getAiProviderDefinition,
  getAiProviderDefinitions,
  getContentStorageRoot,
  isCodexAuthenticated,
  getRetrievalConfig as getStoredRetrievalConfig,
  getRetrievalEmbeddingModelStatus as getStoredEmbeddingStatus,
  normalizeAiConfig,
  normalizeRetrievalConfig,
  readConfig,
  writeConfig,
} from "../config";
import {
  createCodexBrowserAuthInteraction,
  getSharedModelRuntime,
  refreshSharedModelRuntime,
} from "./agent/pi-model-runtime";

function applyRetrievalConfigToServer(config: RetrievalConfig): void {
  configureRetrievalEmbedding(config.embedding);
}

export async function openDirectoryPicker(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
    title: "选择存储目录",
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}

export function setContentStorageRoot(newPath: string): void {
  writeConfig({ contentStorageRoot: newPath || undefined });
}

export function restartApp(): void {
  app.relaunch();
  app.quit();
}

export function getConfig(): {
  contentStorageRoot: string;
  isCustomContentStorageRoot: boolean;
} {
  const config = readConfig();
  return {
    contentStorageRoot: getContentStorageRoot(),
    isCustomContentStorageRoot: !!config.contentStorageRoot,
  };
}

export function getAiConfig(): AiConfig {
  return getStoredAiConfig();
}

export function setAiConfig(config: AiConfig): void {
  const next = normalizeAiConfig(config);
  const incompleteProvider = next.providers.find((provider) => {
    const definition = getAiProviderDefinition(provider.id);
    const authenticated =
      definition.authType === "codex" ? isCodexAuthenticated() : !!provider.apiKey;
    return authenticated && provider.enabledModelIds.length === 0;
  });
  if (incompleteProvider) throw new Error("请至少选择一个用于 Chat 的模型");
  writeConfig({ ai: next });
  void refreshSharedModelRuntime().catch(() => undefined);
}

export function getCodexAuthStatus(): boolean {
  return isCodexAuthenticated();
}

export async function connectCodex(): Promise<boolean> {
  const modelRuntime = await getSharedModelRuntime();
  await modelRuntime.login(
    "openai-codex",
    "oauth",
    createCodexBrowserAuthInteraction((url) => shell.openExternal(url)),
  );
  app.focus({ steal: true });
  return isCodexAuthenticated();
}

export async function disconnectCodex(): Promise<void> {
  const modelRuntime = await getSharedModelRuntime();
  await modelRuntime.logout("openai-codex");
  const ai = getAiConfig();
  writeConfig({
    ai: normalizeAiConfig({
      ...ai,
      providers: ai.providers.filter((provider) => provider.id !== "openai-codex"),
    }),
  });
}

export function getRetrievalConfig(): RetrievalConfig {
  return getStoredRetrievalConfig();
}

export function setRetrievalConfig(config: RetrievalConfig): void {
  const next = normalizeRetrievalConfig(config);
  writeConfig({ retrieval: next });
  applyRetrievalConfigToServer(next);
  void retrievalIndexCoordinator.rebuild().catch(() => undefined);
}

export function getRetrievalEmbeddingModelStatus(): RetrievalEmbeddingModelStatus {
  return getStoredEmbeddingStatus();
}

export function downloadDefaultRetrievalEmbeddingModel(): Promise<RetrievalEmbeddingModelStatus> {
  return downloadModel();
}

export function getRetrievalIndexStatus(): Promise<RetrievalIndexStatus> {
  return retrievalIndexCoordinator.getStatus();
}

export async function rebuildRetrievalIndex(): Promise<RetrievalIndexStatus> {
  try {
    await retrievalIndexCoordinator.rebuild();
  } catch {
    /* ignore */
  }
  return retrievalIndexCoordinator.getStatus();
}

export function listAiModelOptions(): AiModelOption[] {
  return getAiModelOptions();
}

export function listAiProviderDefinitions(): AiProviderDefinition[] {
  return getAiProviderDefinitions();
}

export function getActiveAgentModel(): AiModelSelection | null {
  return getActiveAiModelSelection() ?? null;
}

export function getActiveAgentReasoningLevel(): AiReasoningLevel {
  return getStoredReasoningLevel();
}

export function setActiveAgentModel(selection: AiModelSelection): AiReasoningLevel {
  const ai = getAiConfig();
  const requested = {
    providerId: selection.providerId.trim(),
    modelId: selection.modelId.trim(),
  };
  const exists = getAiModelOptions(ai).some(
    (option) => option.providerId === requested.providerId && option.modelId === requested.modelId,
  );
  if (!exists) throw new Error("请选择可用的 AI 模型");
  const currentLevel = getStoredReasoningLevel(ai);
  const reasoningLevel = clampAiReasoningLevel(requested, currentLevel);
  const next = normalizeAiConfig({
    ...ai,
    activeAgentModel: requested,
    activeAgentReasoningLevel: reasoningLevel,
  });
  writeConfig({ ai: next });
  return reasoningLevel;
}

export function setActiveAgentReasoningLevel(level: AiReasoningLevel): void {
  const ai = getAiConfig();
  const active = getActiveAiModelSelection(ai);
  const option = getAiModelOptions(ai).find(
    (item) => item.providerId === active?.providerId && item.modelId === active.modelId,
  );
  if (!option?.supportedReasoningLevels.includes(level)) {
    throw new Error("当前模型不支持该推理等级");
  }
  const next = normalizeAiConfig({ ...ai, activeAgentReasoningLevel: level });
  if (next.activeAgentReasoningLevel !== level) throw new Error("请选择可用的推理等级");
  writeConfig({ ai: next });
}
