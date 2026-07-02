import type {
  AgentApprovalRequested,
  AgentApprovalResolved,
  AgentAssistantTurn,
  AgentAssistantTurnBlock,
  AgentCitationSource,
  AgentEventBase,
  AgentLiveEvent,
  AgentToolApprovalState,
  AgentToolDisplayState,
  AgentToolExecutionState,
} from "@shared/agent";

type AccumulatorEvent = AgentLiveEvent | AgentApprovalRequested | AgentApprovalResolved;
type FinalAnswerEvent = AgentEventBase & {
  messageId: string;
  text: string;
  citationSources?: AgentCitationSource[];
};

function displayState(
  approvalState: AgentToolApprovalState,
  executionState: AgentToolExecutionState,
): AgentToolDisplayState {
  if (executionState === "failed") return "failed";
  if (executionState === "completed") return "completed";
  if (approvalState === "rejected") return "rejected";
  if (approvalState === "pending") return "pending_approval";
  return "running";
}

function blockState(
  display: AgentToolDisplayState,
): Extract<AgentAssistantTurnBlock, { kind: "approval" }>["state"] {
  if (display === "pending_approval") return "pending";
  if (display === "rejected") return "rejected";
  if (display === "completed") return "completed";
  if (display === "failed") return "failed";
  return "approved";
}

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
      const toolUpdate =
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
            ...toolUpdate,
            createdAt: event.createdAt,
          },
        ];
        return;
      }
      this.blocks = this.blocks.map((block, blockIndex) =>
        blockIndex === index && (block.kind === "tool" || block.kind === "approval")
          ? block.kind === "approval"
            ? this.updateApprovalExecution(
                block,
                event.type === "tool.completed" ? "completed" : "failed",
                event.type === "tool.completed" ? { output: event.output } : { error: event.error },
              )
            : { ...block, ...toolUpdate }
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
          approvalState: "pending",
          executionState: "not_started",
          displayState: "pending_approval",
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
        ? this.updateApprovalState(block, event.approved ? "approved" : "rejected", {
            approved: event.approved,
          })
        : block,
    );
  }

  appendFinalAnswer(event: FinalAnswerEvent): void {
    this.replaceFinalTextBlock({
      kind: "text",
      text: event.text,
      state: "done",
      createdAt: event.createdAt,
    });
  }

  isEmpty(): boolean {
    return this.blocks.length === 0;
  }

  toolResults(): unknown[] {
    return this.blocks.flatMap((block) => {
      if (block.kind === "tool" && block.state === "completed" && block.output !== undefined) {
        return [block.output];
      }
      if (
        block.kind === "approval" &&
        block.executionState === "completed" &&
        block.output !== undefined
      ) {
        return [block.output];
      }
      return [];
    });
  }

  toAssistantTurn(input: Omit<AgentAssistantTurn, "blocks" | "text">): AgentAssistantTurn {
    return {
      ...input,
      blocks: this.blocks,
      text: this.blocks.flatMap((block) => (block.kind === "text" ? [block.text] : [])).join(""),
    };
  }

  private updateApprovalState(
    block: Extract<AgentAssistantTurnBlock, { kind: "approval" }>,
    approvalState: AgentToolApprovalState,
    update: Partial<Extract<AgentAssistantTurnBlock, { kind: "approval" }>>,
  ): Extract<AgentAssistantTurnBlock, { kind: "approval" }> {
    const executionState = approvalState === "rejected" ? "not_started" : block.executionState;
    const nextDisplayState = displayState(approvalState, executionState);
    return {
      ...block,
      ...update,
      approvalState,
      executionState,
      displayState: nextDisplayState,
      state: blockState(nextDisplayState),
    };
  }

  private updateApprovalExecution(
    block: Extract<AgentAssistantTurnBlock, { kind: "approval" }>,
    executionState: AgentToolExecutionState,
    update: Partial<Extract<AgentAssistantTurnBlock, { kind: "approval" }>>,
  ): Extract<AgentAssistantTurnBlock, { kind: "approval" }> {
    const nextDisplayState = displayState(block.approvalState, executionState);
    return {
      ...block,
      ...update,
      executionState,
      displayState: nextDisplayState,
      state: blockState(nextDisplayState),
    };
  }

  private replaceFinalTextBlock(block: Extract<AgentAssistantTurnBlock, { kind: "text" }>): void {
    const index = this.blocks.findLastIndex((current) => current.kind === "text");
    if (index < 0) {
      this.blocks = [...this.blocks, block];
      return;
    }
    this.blocks = this.blocks.map((current, blockIndex) =>
      blockIndex === index ? block : current,
    );
  }
}
