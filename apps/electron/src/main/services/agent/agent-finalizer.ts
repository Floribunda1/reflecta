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

function supportsProviderStructuredOutput(model: Model<Api> | undefined): boolean {
  if (!model) return true;
  return model.api === "openai-responses" || model.api === "azure-openai-responses";
}

export function withFinalAnswerStructuredOutput(payload: unknown, model?: Model<Api>): unknown {
  if (!isRecord(payload)) return payload;
  if (!supportsProviderStructuredOutput(model)) return payload;
  if ("input" in payload) {
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
  if ("messages" in payload) {
    return {
      ...payload,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "reflecta_final_answer",
          strict: true,
          schema: FINAL_ANSWER_JSON_SCHEMA,
        },
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
    systemPrompt:
      "你是 Reflecta 的最终答案格式化器。只输出符合 schema 的 JSON。parts 中可以交替使用 text 和 entity_ref。entity_ref.entityId 必须来自给定 entityCatalog，不允许编造。",
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
    const eventStream = stream(model, buildFinalizerContext(finalizerInput), {
      apiKey: input.apiKey,
      signal: finalizerInput.signal,
      temperature: 0,
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
  const parsed = parseJsonWithRepair<unknown>(rawJson);
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
