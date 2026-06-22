import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";

export const PI_APPROVAL_TOOL_NAMES = ["thought_create"] as const;
export type PiApprovalToolName = (typeof PI_APPROVAL_TOOL_NAMES)[number];

export function isPiApprovalToolName(name: string): name is PiApprovalToolName {
  return PI_APPROVAL_TOOL_NAMES.includes(name as PiApprovalToolName);
}

export function createPiWriteTools(): ToolDefinition[] {
  return [
    defineTool({
      name: "thought_create",
      label: "候选 Thought",
      description:
        "Create a new Reflecta Thought only after user approval. Call this when the user asks you to propose or create a Thought. The tool requests approval; it must not write the knowledge base until the user confirms.",
      promptSnippet: "thought_create: propose a new Reflecta Thought and request user approval.",
      promptGuidelines: [
        "When the user asks to create or propose a Thought, call thought_create and wait for user approval.",
        "Do not claim a Thought has been written until approval is confirmed.",
      ],
      parameters: Type.Object({
        title: Type.Optional(Type.String({ description: "Short Thought title." })),
        body: Type.String({ minLength: 1, description: "Markdown body for the new Thought." }),
        categoryIds: Type.Optional(Type.Array(Type.String())),
      }),
      execute: async (_toolCallId, params) => ({
        content: [
          {
            type: "text" as const,
            text: "Approval requested. The Thought has not been written yet.",
          },
        ],
        details: {
          approvalStatus: "pending",
          proposalType: "thought_create",
          ...params,
        },
      }),
    }),
  ];
}
