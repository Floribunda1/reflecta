import { app, dialog, shell } from "electron";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
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
  getActiveAgentReasoningLevel,
  clampAiReasoningLevel,
  downloadDefaultRetrievalEmbeddingModel,
  getActiveAiModelSelection,
  getAiConfig,
  getAiModelOptions,
  getAiProviderDefinition,
  getAiProviderDefinitions,
  getContentStorageRoot,
  isCodexAuthenticated,
  getRetrievalConfig,
  getRetrievalEmbeddingModelStatus,
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

function applyRetrievalConfigToServer(config = getRetrievalConfig()): void {
  configureRetrievalEmbedding(config.embedding);
}

export class ConfigService extends IpcService {
  static readonly groupName = "config";

  @IpcMethod()
  async openDirectoryPicker(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "选择存储目录",
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  }

  @IpcMethod()
  async setContentStorageRoot(newPath: string): Promise<void> {
    writeConfig({ contentStorageRoot: newPath || undefined });
  }

  @IpcMethod()
  async restartApp(): Promise<void> {
    app.relaunch();
    app.quit();
  }

  @IpcMethod()
  async getConfig(): Promise<{
    contentStorageRoot: string;
    isCustomContentStorageRoot: boolean;
  }> {
    const config = readConfig();
    return {
      contentStorageRoot: getContentStorageRoot(),
      isCustomContentStorageRoot: !!config.contentStorageRoot,
    };
  }

  @IpcMethod()
  async getAiConfig(): Promise<AiConfig> {
    return getAiConfig();
  }

  @IpcMethod()
  async setAiConfig(config: AiConfig): Promise<void> {
    const next = normalizeAiConfig(config);
    const incompleteProvider = next.providers.find((provider) => {
      const definition = getAiProviderDefinition(provider.id);
      const authenticated =
        definition.authType === "codex" ? isCodexAuthenticated() : !!provider.apiKey;
      return authenticated && provider.enabledModelIds.length === 0;
    });
    if (incompleteProvider) throw new Error("请至少选择一个用于 Chat 的模型");
    writeConfig({ ai: next });
    // API keys / providers changed: rebuild the shared runtime in the background
    // so the next agent message never waits on a model catalog refresh.
    void refreshSharedModelRuntime().catch(() => undefined);
  }

  @IpcMethod()
  async getCodexAuthStatus(): Promise<boolean> {
    return isCodexAuthenticated();
  }

  @IpcMethod()
  async connectCodex(): Promise<boolean> {
    const modelRuntime = await getSharedModelRuntime();
    await modelRuntime.login(
      "openai-codex",
      "oauth",
      createCodexBrowserAuthInteraction((url) => shell.openExternal(url)),
    );
    app.focus({ steal: true });
    return isCodexAuthenticated();
  }

  @IpcMethod()
  async disconnectCodex(): Promise<void> {
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

  @IpcMethod()
  async getRetrievalConfig(): Promise<RetrievalConfig> {
    return getRetrievalConfig();
  }

  @IpcMethod()
  async setRetrievalConfig(config: RetrievalConfig): Promise<void> {
    const next = normalizeRetrievalConfig(config);
    writeConfig({ retrieval: next });
    applyRetrievalConfigToServer(next);
    void retrievalIndexCoordinator.rebuild().catch(() => undefined);
  }

  @IpcMethod()
  async getRetrievalEmbeddingModelStatus(): Promise<RetrievalEmbeddingModelStatus> {
    return getRetrievalEmbeddingModelStatus();
  }

  @IpcMethod()
  async downloadDefaultRetrievalEmbeddingModel(): Promise<RetrievalEmbeddingModelStatus> {
    return downloadDefaultRetrievalEmbeddingModel();
  }

  @IpcMethod()
  async getRetrievalIndexStatus(): Promise<RetrievalIndexStatus> {
    return retrievalIndexCoordinator.getStatus();
  }

  @IpcMethod()
  async rebuildRetrievalIndex(): Promise<RetrievalIndexStatus> {
    try {
      await retrievalIndexCoordinator.rebuild();
    } catch {}
    return retrievalIndexCoordinator.getStatus();
  }

  @IpcMethod()
  async listAiModelOptions(): Promise<AiModelOption[]> {
    return getAiModelOptions();
  }

  @IpcMethod()
  async listAiProviderDefinitions(): Promise<AiProviderDefinition[]> {
    return getAiProviderDefinitions();
  }

  @IpcMethod()
  async getActiveAgentModel(): Promise<AiModelSelection | null> {
    return getActiveAiModelSelection() ?? null;
  }

  @IpcMethod()
  async getActiveAgentReasoningLevel(): Promise<AiReasoningLevel> {
    return getActiveAgentReasoningLevel();
  }

  @IpcMethod()
  async setActiveAgentModel(selection: AiModelSelection): Promise<AiReasoningLevel> {
    const ai = getAiConfig();
    const requested = {
      providerId: selection.providerId.trim(),
      modelId: selection.modelId.trim(),
    };
    const exists = getAiModelOptions(ai).some(
      (option) =>
        option.providerId === requested.providerId && option.modelId === requested.modelId,
    );
    if (!exists) throw new Error("请选择可用的 AI 模型");
    const currentLevel = getActiveAgentReasoningLevel(ai);
    const reasoningLevel = clampAiReasoningLevel(requested, currentLevel);
    const next = normalizeAiConfig({
      ...ai,
      activeAgentModel: requested,
      activeAgentReasoningLevel: reasoningLevel,
    });
    writeConfig({ ai: next });
    return reasoningLevel;
  }

  @IpcMethod()
  async setActiveAgentReasoningLevel(level: AiReasoningLevel): Promise<void> {
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
}
