import Ajv from "ajv";
import {
  getModel,
  parseJsonWithRepair,
  parseStreamingJson,
  stream,
  type Api,
  type Context,
  type Model,
} from "@earendil-works/pi-ai";
import type { AgentEntityCatalogEntry, AgentTextPart } from "@shared/agent";
import type { ResolvedAiModelConfig } from "../../config";
import { validateFinalAnswerParts } from "./agent-text-parts";

export type FinalAnswer = {
  parts: AgentTextPart[];
};

export type RunAgentFinalizerInput = {
  userQuestion: string;
  piDraftText: string;
  toolResults: unknown[];
  entityCatalog: AgentEntityCatalogEntry[];
  requiresEntityRefs: boolean;
  signal?: AbortSignal;
  onPartial: (partial: { text: string; parts: AgentTextPart[]; previewText?: string }) => void;
};

export type RunAgentFinalizerResult = {
  text: string;
  parts: AgentTextPart[];
};

export type AgentFinalizerDeps = {
  maxAttempts?: number;
  streamJson: (input: RunAgentFinalizerInput, attempt: number) => AsyncIterable<string>;
};

export const FINAL_ANSWER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["parts"],
  properties: {
    parts: {
      type: "array",
      items: {
        oneOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "text"],
            properties: {
              type: { type: "string", const: "text" },
              text: { type: "string" },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "entityType", "entityId"],
            properties: {
              type: { type: "string", const: "entity_ref" },
              entityType: {
                type: "string",
                enum: ["understanding", "context", "domain"],
              },
              entityId: { type: "string", minLength: 1 },
              fallbackText: { type: "string" },
            },
          },
        ],
      },
    },
  },
} as const;

const ajv = new Ajv({ allErrors: true });
const validateFinalAnswerJson = ajv.compile<FinalAnswer>(FINAL_ANSWER_JSON_SCHEMA);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type FinalAnswerObjectMode = "responses_json_schema" | "chat_json_object" | "unsupported";

function finalAnswerObjectMode(payload: unknown, model?: Model<Api>): FinalAnswerObjectMode {
  if (!isRecord(payload)) return "unsupported";
  if (
    "input" in payload &&
    (model?.api === "openai-responses" || model?.api === "azure-openai-responses")
  ) {
    return "responses_json_schema";
  }
  if ("messages" in payload && model?.api === "openai-completions") {
    return "chat_json_object";
  }
  return "unsupported";
}

function assertFinalAnswerObjectGenerationSupported(model: Model<Api>): void {
  if (
    model.api === "openai-responses" ||
    model.api === "azure-openai-responses" ||
    model.api === "openai-completions"
  ) {
    return;
  }
  throw new Error(`当前模型不支持最终答案对象生成: ${model.provider}/${model.id} (${model.api})`);
}

export function withFinalAnswerStructuredOutput(payload: unknown, model?: Model<Api>): unknown {
  if (!isRecord(payload)) return payload;

  const mode = finalAnswerObjectMode(payload, model);
  if (mode === "responses_json_schema") {
    return {
      ...payload,
      text: {
        ...(isRecord(payload.text) ? payload.text : {}),
        format: {
          type: "json_schema",
          name: "reflecta_final_answer",
          strict: true,
          schema: FINAL_ANSWER_JSON_SCHEMA,
        },
      },
    };
  }

  if (mode === "chat_json_object") {
    return {
      ...payload,
      response_format: {
        type: "json_object",
      },
    };
  }

  return payload;
}

export function resolveFinalizerModel(providerId: string, modelId: string): Model<Api> {
  const model = (getModel as (provider: string, modelId: string) => Model<Api> | undefined)(
    providerId,
    modelId,
  );
  if (!model) throw new Error(`Finalizer model not found: ${providerId}/${modelId}`);
  return model;
}

export function buildFinalizerContext(input: RunAgentFinalizerInput): Context {
  return {
    systemPrompt: [
      "你是 Reflecta 的最终答案对象生成器。",
      "你必须只输出一个有效 json object，不输出 markdown，不输出解释，不输出普通正文。",
      "json object 必须匹配这个形状：",
      '{"parts":[{"type":"text","text":"文字"},{"type":"entity_ref","entityType":"domain","entityId":"domain_id","fallbackText":"标题"}]}',
      "parts 中可以交替使用 text 和 entity_ref。",
      "entity_ref.entityId 必须来自给定 entityCatalog，不允许编造。",
      "如果 requiresEntityRefs 为 true，parts 至少包含一个 entity_ref。",
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          userQuestion: input.userQuestion,
          piDraftText: input.piDraftText,
          toolResults: input.toolResults,
          entityCatalog: input.entityCatalog,
          requiresEntityRefs: input.requiresEntityRefs,
        }),
        timestamp: Date.now(),
      },
    ],
  };
}

export function createPiAiFinalizerStream(input: {
  modelConfig: ResolvedAiModelConfig;
  apiKey: string;
}): AgentFinalizerDeps["streamJson"] {
  const model = resolveFinalizerModel(input.modelConfig.provider.id, input.modelConfig.model.id);
  return async function* streamJson(finalizerInput) {
    assertFinalAnswerObjectGenerationSupported(model);
    const eventStream = stream(model, buildFinalizerContext(finalizerInput), {
      apiKey: input.apiKey,
      signal: finalizerInput.signal,
      temperature: 0,
      maxTokens: Math.min(model.maxTokens, 4096),
      onPayload: (payload, model) => withFinalAnswerStructuredOutput(payload, model),
    });
    for await (const event of eventStream) {
      if (event.type === "text_delta") yield event.delta;
      if (event.type === "error") {
        throw new Error(event.error.errorMessage ?? "最终答案生成失败");
      }
    }
  };
}

function stablePartsFromPartial(value: unknown): AgentTextPart[] {
  if (!isRecord(value) || !Array.isArray(value.parts)) return [];
  return value.parts.flatMap((part): AgentTextPart[] => {
    if (!isRecord(part) || typeof part.type !== "string") return [];
    if (part.type === "text" && typeof part.text === "string") {
      return [{ type: "text" as const, text: part.text }];
    }
    if (
      part.type === "entity_ref" &&
      (part.entityType === "understanding" ||
        part.entityType === "context" ||
        part.entityType === "domain") &&
      typeof part.entityId === "string"
    ) {
      return [
        {
          type: "entity_ref" as const,
          entityType: part.entityType,
          entityId: part.entityId,
          ...(typeof part.fallbackText === "string" ? { fallbackText: part.fallbackText } : {}),
        },
      ];
    }
    return [];
  });
}

function hasEntityRef(parts: AgentTextPart[]) {
  return parts.some((part) => part.type === "entity_ref");
}

function splitPreviewText(parts: AgentTextPart[]): {
  committedParts: AgentTextPart[];
  previewText?: string;
} {
  const last = parts.at(-1);
  if (last?.type !== "text") return { committedParts: parts };
  return {
    committedParts: parts.slice(0, -1),
    ...(last.text ? { previewText: last.text } : {}),
  };
}

function finalAnswerFromRawJson(rawJson: string): FinalAnswer {
  let parsed: unknown;
  try {
    parsed = parseJsonWithRepair<unknown>(rawJson);
  } catch {
    throw new Error("最终答案对象生成失败: provider 返回了普通文本而不是有效 JSON object");
  }

  if (!validateFinalAnswerJson(parsed)) {
    const message = ajv.errorsText(validateFinalAnswerJson.errors, { separator: "; " });
    throw new Error(`最终答案结构化失败: ${message}`);
  }
  return parsed;
}

async function runOneAttempt(
  input: RunAgentFinalizerInput,
  deps: AgentFinalizerDeps,
  attempt: number,
): Promise<RunAgentFinalizerResult> {
  let rawJson = "";
  for await (const chunk of deps.streamJson(input, attempt)) {
    input.signal?.throwIfAborted();
    rawJson += chunk;
    const partial = parseStreamingJson<Partial<FinalAnswer>>(rawJson);
    const parts = stablePartsFromPartial(partial);
    const { committedParts, previewText } = splitPreviewText(parts);
    const validated = validateFinalAnswerParts(committedParts, input.entityCatalog);
    if (validated.ok) {
      input.onPartial({
        text: `${validated.text}${previewText ?? ""}`,
        parts: validated.parts,
        ...(previewText ? { previewText } : {}),
      });
    }
  }

  const finalAnswer = finalAnswerFromRawJson(rawJson);
  if (input.requiresEntityRefs && !hasEntityRef(finalAnswer.parts)) {
    throw new Error("缺少必要实体引用");
  }
  const validated = validateFinalAnswerParts(finalAnswer.parts, input.entityCatalog);
  if (!validated.ok) throw new Error(validated.error);
  input.onPartial({ text: validated.text, parts: validated.parts });
  return { text: validated.text, parts: validated.parts };
}

export async function runAgentFinalizer(
  input: RunAgentFinalizerInput,
  deps: AgentFinalizerDeps,
): Promise<RunAgentFinalizerResult> {
  if (!input.requiresEntityRefs && input.entityCatalog.length === 0) {
    const result = {
      text: input.piDraftText,
      parts: [{ type: "text" as const, text: input.piDraftText }],
    };
    input.onPartial(result);
    return result;
  }

  const maxAttempts = deps.maxAttempts ?? 2;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await runOneAttempt(input, deps, attempt);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("最终答案生成失败");
}
