import Ajv from "ajv";
import { parseJsonWithRepair, parseStreamingJson, Type } from "@earendil-works/pi-ai";
import { defineTool } from "@earendil-works/pi-coding-agent";
import type { AgentEntityCatalogEntry, AgentTextPart } from "@shared/agent";
import { validateFinalAnswerParts } from "./agent-text-parts";

export const REFLECTA_FINAL_ANSWER_TOOL_NAME = "reflecta_final_answer";

export type FinalStructuredOutput = {
  parts: AgentTextPart[];
};

export type FinalStructuredOutputResult = {
  text: string;
  parts: AgentTextPart[];
};

export type FinalStructuredOutputPartial = FinalStructuredOutputResult & {
  previewText?: string;
};

export type FinalStructuredOutputPartialResult =
  | { ok: true; partial: FinalStructuredOutputPartial }
  | { ok: false; error: string };

export const FINAL_STRUCTURED_OUTPUT_JSON_SCHEMA = {
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

const finalAnswerToolParameters = Type.Object({
  parts: Type.Array(
    Type.Union([
      Type.Object({
        type: Type.Literal("text"),
        text: Type.String(),
      }),
      Type.Object({
        type: Type.Literal("entity_ref"),
        entityType: Type.Union([
          Type.Literal("understanding"),
          Type.Literal("context"),
          Type.Literal("domain"),
        ]),
        entityId: Type.String({ minLength: 1 }),
        fallbackText: Type.Optional(Type.String()),
      }),
    ]),
  ),
});

const ajv = new Ajv({ allErrors: true });
const validateFinalOutputJson = ajv.compile<FinalStructuredOutput>(
  FINAL_STRUCTURED_OUTPUT_JSON_SCHEMA,
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isReflectaFinalAnswerToolName(toolName: string): boolean {
  return toolName === REFLECTA_FINAL_ANSWER_TOOL_NAME;
}

export function createReflectaFinalAnswerTool() {
  return defineTool({
    name: REFLECTA_FINAL_ANSWER_TOOL_NAME,
    label: "最终回答",
    description:
      "Submit the final Reflecta answer as structured message parts. Use this for final answers, especially when referencing Understanding, Context, or Domain entities.",
    promptSnippet:
      "reflecta_final_answer: submit the final answer as structured text/entity_ref parts.",
    promptGuidelines: [
      "Use reflecta_final_answer for the final answer when you mention Reflecta Understanding, Context, or Domain objects.",
      "Use real stable entity ids returned by Reflecta tools or selected context.",
      "Never write XML, YAML, [[ref:*]], [1], U1, D1, or ref:* citation tokens in normal text.",
    ],
    parameters: finalAnswerToolParameters,
    execute: async () => ({
      content: [{ type: "text" as const, text: "accepted" }],
      details: { accepted: true },
    }),
  });
}

function stablePartsFromPartial(value: unknown): AgentTextPart[] {
  if (!isRecord(value) || !Array.isArray(value.parts)) return [];
  return value.parts.flatMap((part): AgentTextPart[] => {
    if (!isRecord(part) || typeof part.type !== "string") return [];
    if (part.type === "text" && typeof part.text === "string") {
      return [{ type: "text", text: part.text }];
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
          type: "entity_ref",
          entityType: part.entityType,
          entityId: part.entityId,
          ...(typeof part.fallbackText === "string" ? { fallbackText: part.fallbackText } : {}),
        },
      ];
    }
    return [];
  });
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

export function finalStructuredOutputPartialFromValue(
  value: unknown,
  catalog: AgentEntityCatalogEntry[],
): FinalStructuredOutputPartialResult {
  const parts = stablePartsFromPartial(value);
  const { committedParts, previewText } = splitPreviewText(parts);
  const validated = validateFinalAnswerParts(committedParts, catalog);
  if (!validated.ok) return { ok: false, error: validated.error };
  return {
    ok: true,
    partial: {
      text: `${validated.text}${previewText ?? ""}`,
      parts: validated.parts,
      ...(previewText ? { previewText } : {}),
    },
  };
}

export function finalStructuredOutputPartialFromJson(
  rawJson: string,
  catalog: AgentEntityCatalogEntry[],
): FinalStructuredOutputPartialResult {
  return finalStructuredOutputPartialFromValue(
    parseStreamingJson<Partial<FinalStructuredOutput>>(rawJson),
    catalog,
  );
}

function finalStructuredOutputFromUnknown(value: unknown): FinalStructuredOutput {
  if (!validateFinalOutputJson(value)) {
    const message = ajv.errorsText(validateFinalOutputJson.errors, { separator: "; " });
    throw new Error(`最终答案结构化失败: ${message}`);
  }
  return value;
}

export function validateFinalStructuredOutput(
  value: unknown,
  catalog: AgentEntityCatalogEntry[],
): FinalStructuredOutputResult {
  const finalOutput = finalStructuredOutputFromUnknown(value);
  const validated = validateFinalAnswerParts(finalOutput.parts, catalog);
  if (!validated.ok) throw new Error(validated.error);
  return { text: validated.text, parts: validated.parts };
}

export function validateFinalStructuredOutputJson(
  rawJson: string,
  catalog: AgentEntityCatalogEntry[],
): FinalStructuredOutputResult {
  let parsed: unknown;
  try {
    parsed = parseJsonWithRepair<unknown>(rawJson);
  } catch {
    throw new Error("最终答案对象生成失败: provider 返回了普通文本而不是有效 JSON object");
  }
  return validateFinalStructuredOutput(parsed, catalog);
}
