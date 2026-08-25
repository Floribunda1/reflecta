import { Type } from "@earendil-works/pi-ai";
import { Effect } from "effect";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { normalizeCanvasChanges, type CanvasDocument } from "@reflecta/shared";
import { canvasGraphChangeParameter, layoutDirectionParameter } from "./pi-write-tools";

/**
 * 第三类 agent 工具：present（展示）。
 *
 * 与 readonly（取已存在数据给自己看）、proposal（提案写入需审批）不同，present 工具
 * 是模型对一个临时分析结构做**只读展示**：不写入、不审批、不产生 artifact receipt。
 * 工具名即 UI 路由；completed output 元数据 `kind: "canvas-view", version: 1` 供
 * Turn Renderer 派生独立 canvas-view 消息块。
 */
export const PI_PRESENT_TOOL_NAMES = ["canvas_present"] as const;
export type PiPresentToolName = (typeof PI_PRESENT_TOOL_NAMES)[number];
export function isPiPresentToolName(name: string): name is PiPresentToolName {
  return PI_PRESENT_TOOL_NAMES.includes(name as PiPresentToolName);
}

const layoutParameter = Type.Optional(layoutDirectionParameter);

export function createPiPresentTools() {
  return [
    defineTool({
      name: "canvas_present",
      label: "展示画布视图",
      description:
        "Insert a read-only analysis canvas into the reply, derived from the current Understanding / Domain / Context / Canvas situation. It creates, modifies or saves nothing.",
      promptSnippet:
        "canvas_present: show a read-only analysis canvas in the answer (no persistence).",
      promptGuidelines: [
        "First read the entities you want to analyze with read tools, then describe the analysis structure with add_element / add_edge / group.",
        "Do not write coordinates, ids, timestamps, ports, or edge rendering details (layout is generated deterministically by the app).",
        "This view is the AI's analysis of existing knowledge and is not saved; do not imply its relationships are the user's persisted structure.",
        "Use it only when spatial / relational structure explains better than plain text.",
      ],
      parameters: Type.Object({
        title: Type.String({ minLength: 1, description: "Title of the presented view." }),
        caption: Type.Optional(
          Type.String({
            description: "One-line note on what this analysis view expresses (optional).",
          }),
        ),
        layout: layoutParameter,
        changes: Type.Array(canvasGraphChangeParameter, {
          description:
            "Read-only graph changes describing the presented structure (built from empty).",
        }),
      }),
      execute: async (_toolCallId, params) => {
        const record = params as {
          title: string;
          caption?: string;
          layout?: "auto" | "horizontal" | "vertical";
          changes: Parameters<typeof normalizeCanvasChanges>[0]["changes"];
        };
        const normalized = await Effect.runPromise(
          normalizeCanvasChanges({ changes: record.changes, layout: record.layout ?? "auto" }),
        );
        const document = normalized.document as CanvasDocument;
        return {
          content: [{ type: "text" as const, text: JSON.stringify(document, null, 2) }],
          details: {
            kind: "canvas-view",
            version: 1,
            title: record.title,
            ...(record.caption ? { caption: record.caption } : {}),
            document,
          },
        };
      },
    }),
  ];
}
