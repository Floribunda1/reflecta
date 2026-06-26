import type {
  AgentApprovalRequested,
  AgentApprovalResolved,
  AgentAssistantTurn,
  AgentAssistantTurnBlock,
  AgentLiveEvent,
} from "@shared/agent";

type AccumulatorEvent = AgentLiveEvent | AgentApprovalRequested | AgentApprovalResolved;

export class AgentRunAccumulator {
  private blocks: AgentAssistantTurnBlock[] = [];

  append(event: AccumulatorEvent): void {
    if (event.type === "assistant.reasoning.delta") {
      const last = this.blocks.at(-1);
      this.blocks =
        last?.kind === "reasoning"
          ? this.blocks.map((block, index) =>
              index === this.blocks.length - 1 ? { ...last, text: last.text + event.delta } : block,
            )
          : [...this.blocks, { kind: "reasoning", text: event.delta, createdAt: event.createdAt }];
      return;
    }

    if (event.type === "assistant.text.delta") {
      const last = this.blocks.at(-1);
      this.blocks =
        last?.kind === "text"
          ? this.blocks.map((block, index) =>
              index === this.blocks.length - 1 ? { ...last, text: last.text + event.delta } : block,
            )
          : [...this.blocks, { kind: "text", text: event.delta, createdAt: event.createdAt }];
      return;
    }

    if (event.type === "tool.started") {
      this.blocks = [
        ...this.blocks,
        {
          kind: "tool",
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          input: event.input,
          state: "running",
          createdAt: event.createdAt,
        },
      ];
      return;
    }

    if (event.type === "tool.completed" || event.type === "tool.failed") {
      const index = this.blocks.findIndex(
        (block) =>
          (block.kind === "tool" || block.kind === "approval") &&
          block.toolCallId === event.toolCallId,
      );
      const update =
        event.type === "tool.completed"
          ? { state: "completed" as const, output: event.output }
          : { state: "failed" as const, error: event.error };
      if (index < 0) {
        this.blocks = [
          ...this.blocks,
          {
            kind: "tool",
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            ...update,
            createdAt: event.createdAt,
          },
        ];
        return;
      }
      this.blocks = this.blocks.map((block, blockIndex) =>
        blockIndex === index && (block.kind === "tool" || block.kind === "approval")
          ? { ...block, ...update }
          : block,
      );
      return;
    }

    if (event.type === "approval.requested") {
      this.blocks = [
        ...this.blocks,
        {
          kind: "approval",
          approvalId: event.approvalId,
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          title: event.title,
          description: event.description,
          payload: event.payload,
          state: "pending",
          createdAt: event.createdAt,
        },
      ];
      return;
    }

    const index = this.blocks.findIndex(
      (block) => block.kind === "approval" && block.approvalId === event.approvalId,
    );
    if (index < 0) return;
    this.blocks = this.blocks.map((block, blockIndex) =>
      blockIndex === index && block.kind === "approval"
        ? {
            ...block,
            approved: event.approved,
            state: event.approved ? "approved" : "rejected",
          }
        : block,
    );
  }

  isEmpty(): boolean {
    return this.blocks.length === 0;
  }

  toAssistantTurn(input: Omit<AgentAssistantTurn, "blocks" | "text">): AgentAssistantTurn {
    return {
      ...input,
      blocks: this.blocks,
      text: this.blocks.flatMap((block) => (block.kind === "text" ? [block.text] : [])).join(""),
    };
  }
}
