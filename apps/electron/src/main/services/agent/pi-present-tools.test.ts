import { describe, expect, test, vi } from "vitest";
import { createPiPresentTools, PI_PRESENT_TOOL_NAMES } from "./pi-present-tools";

// present 工具不触碰任何 RPC 服务；mock core 只为让 pi-write-tools 的 schema 导入
// 不拉起真实 core → @main/db 依赖图。
vi.mock("../core", () => ({}));

type PresentToolResult = { details: Record<string, unknown> };
type PresentTool = {
  name: string;
  execute: (toolCallId: string, params: Record<string, unknown>) => Promise<PresentToolResult>;
};

const canvasPresent = createPiPresentTools()[0] as unknown as PresentTool;

describe("canvas_present", () => {
  test("is registered under the present tool category", () => {
    expect(PI_PRESENT_TOOL_NAMES).toContain("canvas_present");
    expect(canvasPresent.name).toBe("canvas_present");
  });

  test("normalizes changes into a versioned canvas-view result without persistence", async () => {
    const result = await canvasPresent.execute("tc1", {
      title: "前端知识结构",
      changes: [
        { op: "add_element", ref: "a", element: { kind: "understanding", understandingId: "u1" } },
        { op: "add_element", ref: "b", element: { kind: "understanding", understandingId: "u2" } },
        { op: "add_edge", ref: "e", sourceRef: "a", targetRef: "b" },
      ],
    });

    expect(result.details.kind).toBe("canvas-view");
    expect(result.details.version).toBe(1);
    expect(result.details.title).toBe("前端知识结构");
    const document = result.details.document as { elements: unknown[]; edges: unknown[] };
    expect(document.elements).toHaveLength(2);
    expect(document.edges).toHaveLength(1);
  });

  test("honours an explicit layout direction", async () => {
    const result = await canvasPresent.execute("tc2", {
      title: "布局",
      layout: "vertical",
      changes: [
        { op: "add_element", ref: "a", element: { kind: "text", text: "A" } },
        { op: "add_element", ref: "b", element: { kind: "text", text: "B" } },
      ],
    });
    expect(result.details.document).toMatchObject({ elements: expect.any(Array) });
  });

  test("invalid structure fails with a one-line reason, not a changes dump", async () => {
    await expect(
      canvasPresent.execute("tc3", {
        title: "坏结构",
        changes: [
          { op: "add_element", ref: "a", element: { kind: "text", text: "A" } },
          { op: "add_edge", ref: "e", sourceRef: "a", targetRef: "missing" },
        ],
      }),
    ).rejects.toThrow(/Unknown edge ref: missing/);
  });
});
