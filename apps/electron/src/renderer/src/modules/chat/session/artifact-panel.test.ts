import { describe, expect, test } from "vitest";
import type { AgentReducedAssistantBlock, AgentReducedMessage } from "@shared/agent";
import {
  ARTIFACT_TYPE_LABELS,
  ARTIFACT_TYPES,
  buildArtifactPanelView,
  scanLandedArtifacts,
} from "./artifact-panel";

function toolBlock(
  partial: Partial<Extract<AgentReducedAssistantBlock, { kind: "tool" }>> = {},
): Extract<AgentReducedAssistantBlock, { kind: "tool" }> {
  return {
    kind: "tool",
    toolCallId: "tool-1",
    toolName: "understanding_create",
    state: "completed",
    createdAt: "2026-08-01T10:00:00.000Z",
    ...partial,
  };
}

function approvalBlock(
  partial: Partial<Extract<AgentReducedAssistantBlock, { kind: "approval" }>> = {},
): Extract<AgentReducedAssistantBlock, { kind: "approval" }> {
  return {
    kind: "approval",
    approvalId: "approval-1",
    toolCallId: "tool-1",
    toolName: "understanding_create",
    title: "候选 Understanding",
    state: "completed",
    approvalState: "approved",
    executionState: "completed",
    displayState: "completed",
    createdAt: "2026-08-01T10:00:00.000Z",
    ...partial,
  };
}

function message(id: string, blocks: AgentReducedAssistantBlock[]): AgentReducedMessage {
  return {
    id,
    role: "assistant",
    text: "",
    createdAt: "2026-08-01T10:00:00.000Z",
    blocks,
  };
}

describe("scanLandedArtifacts", () => {
  test("collects completed tool output with its resultRefTitle", () => {
    const artifacts = scanLandedArtifacts([
      message("assistant-1", [
        toolBlock({
          output: {
            resultRefType: "understanding",
            resultRefId: "understanding-1",
            resultRefTitle: "双链的本质是溯源",
          },
        }),
      ]),
    ]);
    expect(artifacts).toEqual([
      {
        type: "understanding",
        id: "understanding-1",
        title: "双链的本质是溯源",
        landingAt: "2026-08-01T10:00:00.000Z",
        messageId: "assistant-1",
      },
    ]);
  });

  test("collects completed approval output and falls back to payload name for domain", () => {
    const artifacts = scanLandedArtifacts([
      message("assistant-1", [
        approvalBlock({
          toolName: "domain_create",
          payload: { name: "认知科学基础", reason: "结构化" },
          output: { resultRefType: "domain", resultRefId: "domain-1" },
        }),
      ]),
    ]);
    expect(artifacts).toEqual([
      {
        type: "domain",
        id: "domain-1",
        title: "认知科学基础",
        landingAt: "2026-08-01T10:00:00.000Z",
        messageId: "assistant-1",
      },
    ]);
  });

  test("falls back to payload title for context when output has no title", () => {
    const artifacts = scanLandedArtifacts([
      message("assistant-1", [
        approvalBlock({
          toolName: "context_create",
          payload: { title: "卡尼曼访谈", understandingId: "understanding-1" },
          output: { resultRefType: "context", resultRefId: "context-1" },
        }),
      ]),
    ]);
    expect(artifacts[0]).toMatchObject({
      type: "context",
      id: "context-1",
      title: "卡尼曼访谈",
    });
  });

  test("includes canvas output type", () => {
    const artifacts = scanLandedArtifacts([
      message("assistant-1", [
        toolBlock({
          toolName: "canvas_update",
          output: {
            resultRefType: "canvas",
            resultRefId: "canvas-1",
            resultRefTitle: "心智模型画布",
          },
        }),
      ]),
    ]);
    expect(artifacts[0]).toMatchObject({ type: "canvas", id: "canvas-1", title: "心智模型画布" });
  });

  test("skips blocks without artifact output and unknown result types", () => {
    const artifacts = scanLandedArtifacts([
      message("assistant-1", [
        toolBlock({ output: { anything: true } }),
        toolBlock({ output: { resultRefType: "unknown", resultRefId: "x" } }),
      ]),
    ]);
    expect(artifacts).toEqual([]);
  });

  test("skips pending tool, pending approval, and rejected approval", () => {
    const artifacts = scanLandedArtifacts([
      message("assistant-1", [
        toolBlock({
          state: "running",
          output: { resultRefType: "understanding", resultRefId: "u-1" },
        }),
        approvalBlock({
          executionState: "not_started",
          approvalState: "pending",
          state: "pending",
          output: { resultRefType: "understanding", resultRefId: "u-2" },
        }),
        approvalBlock({
          approvalState: "rejected",
          executionState: "not_started",
          state: "rejected",
          output: { resultRefType: "understanding", resultRefId: "u-3" },
        }),
      ]),
    ]);
    expect(artifacts).toEqual([]);
  });

  test("skips completed delete outputs", () => {
    const artifacts = scanLandedArtifacts([
      message("assistant-1", [
        toolBlock({
          toolName: "understanding_delete",
          output: { resultRefType: "understanding", resultRefId: "u-1" },
        }),
        approvalBlock({
          toolName: "canvas_delete",
          output: { resultRefType: "canvas", resultRefId: "canvas-1" },
        }),
      ]),
    ]);
    expect(artifacts).toEqual([]);
  });

  test("falls back to 未命名 when neither output nor payload carries a title", () => {
    const artifacts = scanLandedArtifacts([
      message("assistant-1", [
        approvalBlock({
          output: { resultRefType: "domain", resultRefId: "domain-1" },
        }),
      ]),
    ]);
    expect(artifacts[0]?.title).toBe("未命名");
  });
});

describe("buildArtifactPanelView", () => {
  test("returns empty view for empty messages", () => {
    expect(buildArtifactPanelView([])).toEqual({ total: 0, groups: [] });
  });

  test("dedupes by (type, id), keeps the latest landing and refreshed title", () => {
    const view = buildArtifactPanelView([
      message("assistant-1", [
        approvalBlock({
          toolCallId: "tool-1",
          createdAt: "2026-08-01T10:00:00.000Z",
          output: {
            resultRefType: "understanding",
            resultRefId: "understanding-1",
            resultRefTitle: "旧标题",
          },
        }),
      ]),
      message("assistant-2", [
        approvalBlock({
          toolCallId: "tool-2",
          createdAt: "2026-08-01T11:00:00.000Z",
          output: {
            resultRefType: "understanding",
            resultRefId: "understanding-1",
            resultRefTitle: "新标题",
          },
        }),
      ]),
    ]);
    expect(view.total).toBe(1);
    expect(view.groups[0]?.items[0]).toMatchObject({
      type: "understanding",
      id: "understanding-1",
      title: "新标题",
      landingAt: "2026-08-01T11:00:00.000Z",
    });
  });

  test("sorts items by landing time descending within each group", () => {
    const view = buildArtifactPanelView([
      message("assistant-1", [
        approvalBlock({
          createdAt: "2026-08-01T10:00:00.000Z",
          output: { resultRefType: "understanding", resultRefId: "u-early" },
        }),
        approvalBlock({
          toolCallId: "tool-2",
          createdAt: "2026-08-01T12:00:00.000Z",
          output: { resultRefType: "understanding", resultRefId: "u-late" },
        }),
      ]),
    ]);
    expect(view.groups[0]?.items.map((item) => item.id)).toEqual(["u-late", "u-early"]);
  });

  test("groups by type in ARTIFACT_TYPES order and skips empty groups", () => {
    const view = buildArtifactPanelView([
      message("assistant-1", [
        approvalBlock({
          toolCallId: "tool-1",
          output: { resultRefType: "understanding", resultRefId: "u-1" },
        }),
        approvalBlock({
          toolCallId: "tool-2",
          output: { resultRefType: "context", resultRefId: "c-1" },
        }),
        approvalBlock({
          toolCallId: "tool-3",
          output: { resultRefType: "domain", resultRefId: "d-1" },
        }),
      ]),
    ]);
    expect(view.groups.map((group) => group.type)).toEqual(["understanding", "context", "domain"]);
    expect(view.groups.map((group) => group.label)).toEqual(["理解", "上下文", "领域"]);
    expect(ARTIFACT_TYPE_LABELS).toMatchObject({
      understanding: "理解",
      context: "上下文",
      domain: "领域",
      canvas: "画布",
    });
    expect(ARTIFACT_TYPES).toEqual(["understanding", "context", "domain", "canvas"]);
  });
});
