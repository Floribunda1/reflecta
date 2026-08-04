import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { tmpdir } from "node:os";
import { delimiter } from "node:path";
import { createInterface } from "node:readline";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { saveAssetFile } from "../asset-storage";

export const PI_IMAGE_TOOL_NAMES = ["image_generate"] as const;

type JsonRecord = Record<string, unknown>;
type CodexProcess = Pick<
  ChildProcessWithoutNullStreams,
  "stdin" | "stdout" | "stderr" | "exitCode" | "on" | "kill"
>;
type StartCodex = () => CodexProcess;

type ImageGenerationItem = {
  type: "imageGeneration";
  status: string;
  result: string;
  revisedPrompt?: string | null;
};

type GeneratedImageAsset = {
  kind: "generated-image";
  assetUrl: string;
  mediaType: string;
  revisedPrompt?: string;
};

const MAX_IMAGE_BASE64_LENGTH = 70_000_000;
const IMAGE_TIMEOUT_MS = 5 * 60_000;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function imageItem(value: unknown): ImageGenerationItem | undefined {
  if (!isRecord(value) || value.type !== "imageGeneration" || value.status !== "completed") {
    return undefined;
  }
  return typeof value.result === "string" && value.result
    ? (value as ImageGenerationItem)
    : undefined;
}

function imageFormat(buffer: Buffer): { extension: string; mediaType: string } | undefined {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { extension: ".png", mediaType: "image/png" };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: ".jpg", mediaType: "image/jpeg" };
  }
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { extension: ".webp", mediaType: "image/webp" };
  }
  return undefined;
}

function codexError(error: unknown): Error {
  if (isRecord(error) && error.code === "ENOENT") {
    return new Error("未检测到 Codex，请先安装 Codex CLI");
  }
  return error instanceof Error ? error : new Error(String(error));
}

function defaultStartCodex(): CodexProcess {
  const searchPath = [
    process.env.PATH,
    ...(process.platform === "darwin" ? ["/opt/homebrew/bin", "/usr/local/bin"] : []),
  ]
    .filter(Boolean)
    .join(delimiter);
  return spawn("codex", ["app-server", "--listen", "stdio://"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, PATH: searchPath },
  });
}

export function generateCodexImage(
  input: { prompt: string; contentStorageRoot: string; signal?: AbortSignal },
  startCodex: StartCodex = defaultStartCodex,
): Promise<GeneratedImageAsset> {
  return new Promise((resolve, reject) => {
    const child = startCodex();
    const lines = createInterface({ input: child.stdout });
    const pending = new Map<
      number,
      { resolve: (value: unknown) => void; reject: (error: Error) => void }
    >();
    let requestId = 0;
    let threadId: string | undefined;
    let generatedImage: ImageGenerationItem | undefined;
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeout);
      input.signal?.removeEventListener("abort", abort);
      lines.close();
      child.stdin.end();
      if (child.exitCode === null) child.kill();
    };
    const finish = (error?: unknown, result?: GeneratedImageAsset) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(codexError(error));
      else if (result) resolve(result);
    };
    const fail = (error: unknown) => {
      const normalized = codexError(error);
      for (const request of pending.values()) request.reject(normalized);
      pending.clear();
      finish(normalized);
    };
    const abort = () => fail(new Error("图片生成已取消"));
    const timeout = setTimeout(() => fail(new Error("图片生成超时，请稍后重试")), IMAGE_TIMEOUT_MS);

    const request = (method: string, params: JsonRecord): Promise<unknown> => {
      const id = requestId++;
      return new Promise((requestResolve, requestReject) => {
        pending.set(id, { resolve: requestResolve, reject: requestReject });
        child.stdin.write(`${JSON.stringify({ method, id, params })}\n`);
      });
    };

    child.stderr.resume();
    child.on("error", fail);
    child.on("exit", (code) => {
      if (!settled) fail(new Error(`Codex 图片生成进程意外退出（${code ?? "unknown"}）`));
    });
    input.signal?.addEventListener("abort", abort, { once: true });
    if (input.signal?.aborted) {
      abort();
      return;
    }

    lines.on("line", (line) => {
      let message: JsonRecord;
      try {
        const parsed = JSON.parse(line);
        if (!isRecord(parsed)) throw new Error("Invalid JSON-RPC message");
        message = parsed;
      } catch {
        fail(new Error("Codex 返回了无法识别的响应"));
        return;
      }

      if (typeof message.id === "number") {
        const waiter = pending.get(message.id);
        if (!waiter) return;
        pending.delete(message.id);
        if (isRecord(message.error)) {
          waiter.reject(new Error(String(message.error.message ?? "Codex 请求失败")));
        } else {
          waiter.resolve(message.result);
        }
        return;
      }

      if (message.method === "item/completed" && isRecord(message.params)) {
        const item = imageItem(message.params.item);
        if (item && (!threadId || message.params.threadId === threadId)) generatedImage = item;
        return;
      }

      if (message.method !== "turn/completed" || !isRecord(message.params)) return;
      if (threadId && message.params.threadId !== threadId) return;
      const turn = isRecord(message.params.turn) ? message.params.turn : {};
      const item =
        generatedImage ??
        (Array.isArray(turn.items) ? turn.items.map(imageItem).find(Boolean) : undefined);
      if (!item) {
        fail(
          new Error(
            isRecord(turn.error) && typeof turn.error.message === "string"
              ? turn.error.message
              : "Codex 未返回图片",
          ),
        );
        return;
      }
      if (item.result.length > MAX_IMAGE_BASE64_LENGTH) {
        fail(new Error("Codex 返回的图片过大"));
        return;
      }
      const buffer = Buffer.from(item.result, "base64");
      const format = imageFormat(buffer);
      if (!format) {
        fail(new Error("Codex 返回的图片格式不受支持"));
        return;
      }
      void saveAssetFile(input.contentStorageRoot, buffer, `generated${format.extension}`).then(
        (assetId) =>
          finish(undefined, {
            kind: "generated-image",
            assetUrl: `asset:///${assetId}`,
            mediaType: format.mediaType,
            ...(item.revisedPrompt ? { revisedPrompt: item.revisedPrompt } : {}),
          }),
        fail,
      );
    });

    void (async () => {
      await request("initialize", {
        clientInfo: { name: "reflecta", title: "Reflecta", version: "1" },
        capabilities: { experimentalApi: false, requestAttestation: false },
      });
      child.stdin.write(`${JSON.stringify({ method: "initialized" })}\n`);

      const accountResponse = await request("account/read", { refreshToken: false });
      const account =
        isRecord(accountResponse) && isRecord(accountResponse.account)
          ? accountResponse.account
          : undefined;
      if (account?.type !== "chatgpt") {
        throw new Error("请先使用 ChatGPT 账号登录 Codex（codex login）");
      }

      const capabilities = await request("modelProvider/capabilities/read", {});
      if (!isRecord(capabilities) || capabilities.imageGeneration !== true) {
        throw new Error("当前 Codex 账号或版本不支持图片生成");
      }

      const threadResponse = await request("thread/start", {
        cwd: tmpdir(),
        approvalPolicy: "never",
        sandbox: "read-only",
        ephemeral: true,
        serviceName: "reflecta",
      });
      const thread =
        isRecord(threadResponse) && isRecord(threadResponse.thread)
          ? threadResponse.thread
          : undefined;
      if (!thread || typeof thread.id !== "string") throw new Error("Codex 未能创建图片生成任务");
      threadId = thread.id;

      await request("turn/start", {
        threadId,
        input: [
          {
            type: "text",
            text: `$imagegen\nGenerate exactly one image for the request below. Do not edit project files.\n\n${input.prompt}`,
            text_elements: [],
          },
        ],
      });
    })().catch(fail);
  });
}

export function createPiImageTools(contentStorageRoot: string): ToolDefinition[] {
  return [
    defineTool({
      name: PI_IMAGE_TOOL_NAMES[0],
      label: "生成图片",
      description:
        "Generate exactly one image with the user's signed-in Codex subscription. Use only when the user asks to create an image.",
      promptSnippet: "image_generate: generate one image from a complete visual prompt.",
      parameters: Type.Object({
        prompt: Type.String({ minLength: 1, maxLength: 4_000 }),
      }),
      execute: async (_toolCallId, { prompt }, signal) => {
        const details = await generateCodexImage({ prompt, contentStorageRoot, signal });
        return {
          content: [{ type: "text", text: "Image generated and attached to the conversation." }],
          details,
        };
      },
    }),
  ];
}
