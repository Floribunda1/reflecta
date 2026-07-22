import type { AuthInteraction } from "@earendil-works/pi-ai";
import { registerBunOAuthFlows } from "@earendil-works/pi-ai/bun-oauth";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { getPiAuthPath, type ResolvedAiModelConfig } from "../../config";

registerBunOAuthFlows();

export async function createPiModelRuntime(
  modelConfig?: ResolvedAiModelConfig,
): Promise<ModelRuntime> {
  const modelRuntime = await ModelRuntime.create({ authPath: getPiAuthPath(), modelsPath: null });
  if (modelConfig && modelConfig.definition.authType !== "codex") {
    await modelRuntime.setRuntimeApiKey(
      modelConfig.definition.piProviderId,
      modelConfig.provider.apiKey,
    );
  }
  return modelRuntime;
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
