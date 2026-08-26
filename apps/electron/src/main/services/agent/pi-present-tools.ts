import { Type } from "@earendil-works/pi-ai";
import { Effect } from "effect";
import { defineTool } from "@earendil-works/pi-coding-agent";
import {
  normalizeCanvasChanges,
  type CanvasDocument,
  PI_PRESENT_TOOL_NAMES,
  PI_TOOL_LABELS,
} from "@reflecta/shared";
import { canvasGraphChangeParameter, layoutDirectionParameter } from "./pi-write-tools";

export { PI_PRESENT_TOOL_NAMES };
export type PiPresentToolName = (typeof PI_PRESENT_TOOL_NAMES)[number];
export function isPiPresentToolName(name: string): name is PiPresentToolName {
  return PI_PRESENT_TOOL_NAMES.includes(name as PiPresentToolName);
}

const layoutParameter = Type.Optional(layoutDirectionParameter);

export function createPiPresentTools() {
  return [
    defineTool({
      name: "canvas_present",
      label: PI_TOOL_LABELS.canvas_present,
      description:
        "Insert a read-only analysis canvas into the reply, derived from the current Understanding / Domain / Context / Canvas situation. It creates, modifies or saves nothing.",
      promptSnippet:
        "canvas_present: show a read-only analysis canvas in the answer (no persistence).",
      promptGuidelines: [
        "First read the entities you want to analyze with read tools, then describe the analysis structure with add_element / add_edge / group.",
        "Present cognitive relations (derivation / dependency / scenario / principle...), not thematic grouping; each edge must carry a label that names the relation.",
        "Only place nodes that participate in the structure (connected by an edge); orphan and meaningless nodes stay in the reply text, not on the canvas.",
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
