/** config 域 IPC handlers（业务在 services/config-ops）。 */
import { Effect } from "effect";
import { ConfigError } from "../../ipc";
import type { AiConfig, AiModelSelection, RetrievalConfig } from "@reflecta/shared";
import {
  getActiveAgentReasoningLevel,
  getAiConfig,
  getRetrievalConfig,
  getRetrievalEmbeddingModelStatus,
} from "../config";
import * as configOps from "../services/config-ops";
import { liftPromise, liftSync, toVoid, type HandlerModule } from "./util";

const error = (message: string) => new ConfigError({ reason: message, code: 500 });

export const config: HandlerModule = {
  domain: "config",
  error,
  handlers: {
    "config.openDirectoryPicker": () => liftPromise(error, () => configOps.openDirectoryPicker()),
    "config.setContentStorageRoot": ({ newPath }) =>
      liftSync(error, () => configOps.setContentStorageRoot(newPath)),
    "config.restartApp": () => Effect.sync(() => configOps.restartApp()),
    "config.getConfig": () => Effect.sync(() => configOps.getConfig()),
    "config.getAiConfig": () => Effect.sync(() => getAiConfig()),
    "config.setAiConfig": ({ config }) =>
      liftSync(error, () => configOps.setAiConfig(config as AiConfig)),
    "config.getCodexAuthStatus": () => Effect.sync(() => configOps.getCodexAuthStatus()),
    "config.connectCodex": () => liftPromise(error, () => configOps.connectCodex()),
    "config.disconnectCodex": () =>
      liftPromise(error, () => configOps.disconnectCodex()).pipe(toVoid),
    "config.getRetrievalConfig": () => Effect.sync(() => getRetrievalConfig()),
    "config.setRetrievalConfig": ({ config }) =>
      liftSync(error, () => configOps.setRetrievalConfig(config as RetrievalConfig)),
    "config.getRetrievalEmbeddingModelStatus": () =>
      Effect.sync(() => getRetrievalEmbeddingModelStatus()),
    "config.downloadDefaultRetrievalEmbeddingModel": () =>
      liftPromise(error, () => configOps.downloadDefaultRetrievalEmbeddingModel()),
    "config.getRetrievalIndexStatus": () =>
      liftPromise(error, () => configOps.getRetrievalIndexStatus()),
    "config.rebuildRetrievalIndex": () =>
      liftPromise(error, () => configOps.rebuildRetrievalIndex()),
    "config.listAiModelOptions": () => Effect.sync(() => configOps.listAiModelOptions()),
    "config.listAiProviderDefinitions": () =>
      Effect.sync(() => configOps.listAiProviderDefinitions()),
    "config.refreshAiModels": () => liftPromise(error, () => configOps.refreshAiModels()),
    "config.getActiveAgentModel": () => Effect.sync(() => configOps.getActiveAgentModel()),
    "config.getActiveAgentReasoningLevel": () => Effect.sync(() => getActiveAgentReasoningLevel()),
    "config.setActiveAgentModel": ({ selection }) =>
      liftSync(error, () => configOps.setActiveAgentModel(selection as AiModelSelection)),
    "config.setActiveAgentReasoningLevel": ({ level }) =>
      liftSync(error, () => configOps.setActiveAgentReasoningLevel(level)),
  },
};
