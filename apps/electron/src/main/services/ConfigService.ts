import { app, dialog } from "electron";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import {
  configureRetrievalEmbedding,
  getRetrievalIndexStatus,
  markRetrievalIndexDirty,
  rebuildRetrievalIndexWithStatus,
  type RetrievalEmbeddingConfig as ServerRetrievalEmbeddingConfig,
  type RetrievalIndexStatus,
} from "@reflecta/server";
import type {
  AiConfig,
  AiModelOption,
  AiModelSelection,
  AiProviderCatalogItem,
  RetrievalConfig,
  RetrievalEmbeddingModelStatus,
} from "../config";
import { getDBInstance } from "../db";
import {
  downloadDefaultRetrievalEmbeddingModel,
  getActiveAiModelSelection,
  getAiConfig,
  getAiModelOptions,
  getAiProviderCatalog,
  getContentStorageRoot,
  getRetrievalConfig,
  getRetrievalEmbeddingModelStatus,
  normalizeAiConfig,
  normalizeRetrievalConfig,
  readConfig,
  writeConfig,
} from "../config";

function toServerRetrievalEmbeddingConfig(
  config: RetrievalConfig,
): Partial<ServerRetrievalEmbeddingConfig> | undefined {
  if (config.embedding.provider === "disabled") return undefined;
  return {
    provider: "openai-compatible",
    modelId: config.embedding.modelId,
    baseUrl: config.embedding.baseUrl,
    apiKey: config.embedding.apiKey,
  };
}

export function applyRetrievalConfigToServer(config = getRetrievalConfig()): void {
  configureRetrievalEmbedding(toServerRetrievalEmbeddingConfig(config));
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
    writeConfig({ ai: normalizeAiConfig(config) });
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
    await markRetrievalIndexDirty();
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
    return getRetrievalIndexStatus();
  }

  @IpcMethod()
  async rebuildRetrievalIndex(): Promise<RetrievalIndexStatus> {
    await rebuildRetrievalIndexWithStatus(getDBInstance());
    return getRetrievalIndexStatus();
  }

  @IpcMethod()
  async listAiModelOptions(): Promise<AiModelOption[]> {
    return getAiModelOptions();
  }

  @IpcMethod()
  async listAiProviderCatalog(): Promise<AiProviderCatalogItem[]> {
    return getAiProviderCatalog();
  }

  @IpcMethod()
  async getActiveAgentModel(): Promise<AiModelSelection | null> {
    return getActiveAiModelSelection() ?? null;
  }

  @IpcMethod()
  async setActiveAgentModel(selection: AiModelSelection): Promise<void> {
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
    const next = normalizeAiConfig({ ...ai, activeAgentModel: requested });
    writeConfig({ ai: next });
  }
}
