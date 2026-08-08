import path from "node:path";
import type { AuthInteraction } from "@earendil-works/pi-ai";
import { registerBunOAuthFlows } from "@earendil-works/pi-ai/bun-oauth";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import {
  getAiConfig,
  getAiProviderDefinition,
  getAppConfigDir,
  getPiAuthPath,
  type ResolvedAiModelConfig,
} from "../../config";

registerBunOAuthFlows();

/** Persist the dynamic pi.dev catalog alongside the app config for UI reads. */
export function getPiModelsPath(): string {
  return path.join(getAppConfigDir(), "pi-models", "models.json");
}

export async function createPiModelRuntime(
  modelConfig?: ResolvedAiModelConfig,
): Promise<ModelRuntime> {
  const modelRuntime = await ModelRuntime.create({
    authPath: getPiAuthPath(),
    modelsPath: getPiModelsPath(),
    // Refresh the provider catalog from pi.dev at startup (then every 4h),
    // so new models/providers show up without bumping the pi-ai dependency.
    allowModelNetwork: true,
    // Cap the first refresh so a slow catalog endpoint never blocks agent setup.
    modelRefreshTimeoutMs: 10_000,
  });
  if (modelConfig && modelConfig.definition.authType !== "codex") {
    await modelRuntime.setRuntimeApiKey(
      modelConfig.definition.piProviderId,
      modelConfig.provider.apiKey,
    );
  }
  return modelRuntime;
}

let sharedModelRuntime: ModelRuntime | undefined;
let pendingSharedModelRuntime: Promise<ModelRuntime> | undefined;
let runtimeGeneration = 0;

/**
 * Apply the currently configured non-OAuth API keys to a runtime.
 * Called once per runtime creation; setRuntimeApiKey re-runs a per-provider
 * availability pass, so it must not run on the per-message hot path.
 */
async function applyConfiguredApiKeys(runtime: ModelRuntime): Promise<void> {
  for (const provider of getAiConfig().providers) {
    if (!provider.apiKey) continue;
    let definition;
    try {
      definition = getAiProviderDefinition(provider.id);
    } catch {
      // Unknown provider ids are dropped by config normalization; stay defensive.
      continue;
    }
    if (definition.authType === "codex") continue;
    await runtime.setRuntimeApiKey(definition.piProviderId, provider.apiKey);
  }
}

function buildSharedModelRuntime(): Promise<ModelRuntime> {
  const generation = ++runtimeGeneration;
  return createPiModelRuntime().then(async (runtime) => {
    await applyConfiguredApiKeys(runtime);
    // Only the newest build may become the shared runtime, so a stale prewarm
    // can never overwrite a refresh triggered by newer settings.
    if (generation === runtimeGeneration) sharedModelRuntime = runtime;
    return runtime;
  });
}

/**
 * The shared ModelRuntime used by every agent session and title generation.
 * Creating a runtime refreshes the pi.dev catalog and re-checks provider
 * availability, so it must happen once (see services/index.ts prewarm), not on
 * every message like the previous per-sendModelRuntime creation.
 */
export function getSharedModelRuntime(): Promise<ModelRuntime> {
  if (sharedModelRuntime) return Promise.resolve(sharedModelRuntime);
  pendingSharedModelRuntime ??= buildSharedModelRuntime().finally(() => {
    pendingSharedModelRuntime = undefined;
  });
  return pendingSharedModelRuntime;
}

/**
 * Rebuild the shared runtime in the background after AI settings or
 * credentials change. The previous runtime keeps serving until the new one is
 * ready; callers awaiting the returned promise get the fresh runtime.
 */
export function refreshSharedModelRuntime(): Promise<ModelRuntime> {
  const next = buildSharedModelRuntime();
  next.catch(() => {
    // Keep serving the previous runtime; getSharedModelRuntime() retries lazily.
  });
  return next;
}

export function createCodexBrowserAuthInteraction(
  openExternal: (url: string) => Promise<void>,
): AuthInteraction {
  let openError: unknown;
  let rejectPrompt: ((error: unknown) => void) | undefined;

  return {
    async prompt(prompt) {
      if (prompt.type === "select") return "browser";
      if (prompt.type !== "manual_code") throw new Error("不支持的 OpenAI 授权步骤");
      return new Promise<string>((_resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("等待 OpenAI 授权超时")), 5 * 60_000);
        rejectPrompt = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
        if (openError) rejectPrompt(openError);
        prompt.signal?.addEventListener(
          "abort",
          () => rejectPrompt?.(new Error("OpenAI 授权已结束")),
          { once: true },
        );
      });
    },
    notify(event) {
      if (event.type !== "auth_url") return;
      void openExternal(event.url).catch((error) => {
        openError = error;
        rejectPrompt?.(error);
      });
    },
  };
}
