import { Effect } from "effect";
import { describe, expect, test } from "vitest";
import { normalizeCanvasChanges } from "./changes";
import type { CanvasElementDTO } from "./document";

const textElement = (id: string, text: string): CanvasElementDTO => ({
  id,
  canvasId: "canvas-1",
  parentId: null,
  x: 20,
  y: 30,
  width: 220,
  height: 120,
  zIndex: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  kind: "text",
  understandingId: null,
  canvasRefId: null,
  props: { text },
});

describe("normalizeCanvasChanges", () => {
  test("rejects forward references", async () => {
    await expect(
      Effect.runPromise(
        normalizeCanvasChanges({
          changes: [
            { op: "add_edge", ref: "edge", sourceRef: "later", targetRef: "later" },
            { op: "add_element", ref: "later", element: { kind: "text", text: "later" } },
          ],
        }),
      ),
    ).rejects.toThrow(/Unknown edge ref: later/);
  });

  test("resolves earlier local refs into a canvas document", async () => {
    const result = await Effect.runPromise(
      normalizeCanvasChanges({
        changes: [
          { op: "add_element", ref: "question", element: { kind: "text", text: "Why?" } },
          { op: "add_element", ref: "answer", element: { kind: "text", text: "Because." } },
          {
            op: "add_edge",
            ref: "reason",
            sourceRef: "question",
            targetRef: "answer",
            label: "explains",
          },
        ],
      }),
    );

    expect(result.document.elements).toHaveLength(2);
    expect(result.document.edges).toHaveLength(1);
    expect(result.document.elements.map((element) => element.props)).toEqual([
      { text: "Why?" },
      { text: "Because." },
    ]);
    expect(result.document.edges[0]).toMatchObject({
      source: { cell: result.document.elements[0].id },
      target: { cell: result.document.elements[1].id },
      label: "explains",
    });
  });

  test("applies updates to stable ids in order", async () => {
    const result = await Effect.runPromise(
      normalizeCanvasChanges({
        base: { elements: [textElement("existing", "before")], edges: [] },
        changes: [
          { op: "update_element", ref: "existing", after: { kind: "text", text: "draft" } },
          { op: "update_element", ref: "existing", after: { kind: "text", text: "final" } },
        ],
      }),
    );

    expect(result.document.elements[0]).toMatchObject({
      id: "existing",
      x: 20,
      y: 30,
      props: { text: "final" },
    });
  });

  test("removing an element cascades through descendants and incident edges", async () => {
    const group: CanvasElementDTO = {
      ...textElement("group", ""),
      kind: "group",
      understandingId: null,
      canvasRefId: null,
      props: { label: "Branch" },
    };
    const child = { ...textElement("child", "inside"), parentId: "group" };
    const outside = textElement("outside", "outside");
    const result = await Effect.runPromise(
      normalizeCanvasChanges({
        base: {
          elements: [group, child, outside],
          edges: [
            {
              id: "edge",
              canvasId: "canvas-1",
              source: { cell: "child", port: "right" },
              target: { cell: "outside", port: "left" },
              router: { name: "reflecta-curve" },
              connector: { name: "reflecta-curve" },
              attrs: {},
              label: null,
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
        changes: [{ op: "remove_element", ref: "group" }],
      }),
    );

    expect(result.document).toEqual({ elements: [outside], edges: [] });
  });

  test("updates edge endpoints and clears its label", async () => {
    const edge = {
      id: "edge",
      canvasId: "canvas-1",
      source: { cell: "a", port: "right" as const },
      target: { cell: "b", port: "left" as const },
      router: { name: "reflecta-curve" as const },
      connector: { name: "reflecta-curve" as const },
      attrs: {},
      label: "old",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const result = await Effect.runPromise(
      normalizeCanvasChanges({
        base: {
          elements: [textElement("a", "a"), textElement("b", "b"), textElement("c", "c")],
          edges: [edge],
        },
        changes: [{ op: "update_edge", ref: "edge", targetRef: "c", label: null }],
      }),
    );

    expect(result.document.edges[0]).toMatchObject({
      source: { cell: "a" },
      target: { cell: "c" },
      label: null,
    });
  });

  test("groups and ungroups without moving elements", async () => {
    const a = textElement("a", "a");
    const b = { ...textElement("b", "b"), x: 300, y: 200 };
    const result = await Effect.runPromise(
      normalizeCanvasChanges({
        base: { elements: [a, b], edges: [] },
        changes: [
          { op: "group", ref: "cluster", label: "Cluster", elementRefs: ["a", "b"] },
          { op: "ungroup", ref: "cluster" },
        ],
      }),
    );

    expect(result.document.elements).toEqual([a, b]);
  });

  test("lays out a connected graph horizontally", async () => {
    const result = await Effect.runPromise(
      normalizeCanvasChanges({
        layout: "horizontal",
        changes: [
          { op: "add_element", ref: "a", element: { kind: "text", text: "a" } },
          { op: "add_element", ref: "b", element: { kind: "text", text: "b" } },
          { op: "add_edge", ref: "edge", sourceRef: "a", targetRef: "b" },
        ],
      }),
    );

    const [a, b] = result.document.elements;
    expect(a.x + a.width).toBeLessThan(b.x);
  });

  test("lays out an agent-created branching graph without overlapping cards", async () => {
    const result = await Effect.runPromise(
      normalizeCanvasChanges({
        layout: "horizontal",
        changes: [
          { op: "add_element", ref: "question", element: { kind: "text", text: "Question" } },
          { op: "add_element", ref: "option-a", element: { kind: "text", text: "Option A" } },
          { op: "add_element", ref: "option-b", element: { kind: "text", text: "Option B" } },
          { op: "add_element", ref: "evidence", element: { kind: "text", text: "Evidence" } },
          { op: "add_element", ref: "decision", element: { kind: "text", text: "Decision" } },
          { op: "add_edge", ref: "q-a", sourceRef: "question", targetRef: "option-a" },
          { op: "add_edge", ref: "q-b", sourceRef: "question", targetRef: "option-b" },
          { op: "add_edge", ref: "a-decision", sourceRef: "option-a", targetRef: "decision" },
          { op: "add_edge", ref: "b-evidence", sourceRef: "option-b", targetRef: "evidence" },
          { op: "add_edge", ref: "e-decision", sourceRef: "evidence", targetRef: "decision" },
        ],
      }),
    );

    for (const [index, a] of result.document.elements.entries()) {
      for (const b of result.document.elements.slice(index + 1)) {
        const overlaps =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        expect(overlaps, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  test("returns title changes and applies explicit relayout", async () => {
    const result = await Effect.runPromise(
      normalizeCanvasChanges({
        base: { elements: [textElement("a", "a"), textElement("b", "b")], edges: [] },
        changes: [
          { op: "add_edge", ref: "edge", sourceRef: "a", targetRef: "b" },
          { op: "set_title", title: "New title" },
          { op: "relayout", direction: "vertical" },
        ],
      }),
    );

    expect(result.title).toBe("New title");
    expect(result.document.elements[0].y + result.document.elements[0].height).toBeLessThan(
      result.document.elements[1].y,
    );
    expect(result.document.edges[0]).toMatchObject({
      source: { port: "bottom" },
      target: { port: "top" },
    });
  });

  test("keeps existing positions while placing newly added elements", async () => {
    const existing = { ...textElement("existing", "existing"), x: 100, y: 100 };
    const result = await Effect.runPromise(
      normalizeCanvasChanges({
        base: { elements: [existing], edges: [] },
        changes: [
          { op: "add_element", ref: "new", element: { kind: "text", text: "new" } },
          { op: "add_edge", ref: "edge", sourceRef: "existing", targetRef: "new" },
        ],
      }),
    );

    expect(result.document.elements[0]).toMatchObject({ x: 100, y: 100 });
    expect(result.document.elements[1].x).toBeGreaterThan(100 + existing.width);
  });

  /**
   * 布局不变量：ELK 归一化后，组必须紧裹其子节点、顶层节点互不重叠、
   * 连线端口在水平布局下为 right→left。这是「agent 生成 canvas 布局干净」
   * 的验收锚点，改动布局规则时要同时更新这里与 UI fixture。
   */
  test("keeps agent layout clean: group bounds children, nodes don't overlap, ports are right/left", async () => {
    const result = await Effect.runPromise(
      normalizeCanvasChanges({
        layout: "horizontal",
        changes: [
          { op: "add_element", ref: "question", element: { kind: "text", text: "Question" } },
          { op: "add_element", ref: "opt-a", element: { kind: "text", text: "A" } },
          { op: "add_element", ref: "opt-b", element: { kind: "text", text: "B" } },
          { op: "add_element", ref: "decision", element: { kind: "text", text: "Decision" } },
          { op: "group", ref: "options", label: "Options", elementRefs: ["opt-a", "opt-b"] },
          { op: "add_edge", ref: "e1", sourceRef: "question", targetRef: "opt-a" },
          { op: "add_edge", ref: "e2", sourceRef: "question", targetRef: "opt-b" },
          { op: "add_edge", ref: "e3", sourceRef: "opt-a", targetRef: "decision" },
          { op: "add_edge", ref: "e4", sourceRef: "opt-b", targetRef: "decision" },
        ],
      }),
    );

    const byId = new Map(result.document.elements.map((e) => [e.id, e]));
    const abs = (id: string): { x: number; y: number } => {
      let el = byId.get(id)!;
      let x = el.x;
      let y = el.y;
      while (el.parentId) {
        el = byId.get(el.parentId)!;
        x += el.x;
        y += el.y;
      }
      return { x, y };
    };

    const group = result.document.elements.find(
      (e) => e.kind === "group" && e.props.label === "Options",
    )!;
    const children = result.document.elements.filter((e) => e.parentId === group.id);
    expect(children).toHaveLength(2);
    for (const child of children) {
      const p = abs(child.id);
      expect(p.x).toBeGreaterThanOrEqual(group.x);
      expect(p.x + child.width).toBeLessThanOrEqual(group.x + group.width);
      expect(p.y).toBeGreaterThanOrEqual(group.y);
      expect(p.y + child.height).toBeLessThanOrEqual(group.y + group.height);
    }

    // 顶层节点（含组）互不重叠
    const top = result.document.elements.filter((e) => !e.parentId);
    for (const [i, a] of top.entries()) {
      for (const b of top.slice(i + 1)) {
        const overlaps =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        expect(overlaps, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }

    for (const edge of result.document.edges) {
      expect(edge.source.port).toBe("right");
      expect(edge.target.port).toBe("left");
    }
  });

  test("text cards get a content-derived height (fixed width, taller for longer text)", async () => {
    const short = await Effect.runPromise(
      normalizeCanvasChanges({
        changes: [{ op: "add_element", ref: "t", element: { kind: "text", text: "结论" } }],
      }),
    );
    const long = await Effect.runPromise(
      normalizeCanvasChanges({
        changes: [
          {
            op: "add_element",
            ref: "t",
            element: {
              kind: "text",
              text: "长期回灌依赖观察窗，而非瞬时峰值；新管段试运营期需单独建档，并记录每次联调的回水温度与主管压力，以便在统一观察窗内比较。",
            },
          },
        ],
      }),
    );
    const [shortEl] = short.document.elements;
    const [longEl] = long.document.elements;
    expect(shortEl.width).toBe(220);
    expect(shortEl.height).toBe(64); // 短文本落到最小高（校准版）
    expect(longEl.height).toBeGreaterThan(shortEl.height);
    expect(longEl.height).toBeGreaterThanOrEqual(80); // 校准版行高 28，长文本更高
    expect(longEl.height).toBeLessThanOrEqual(300); // 上限钳制，超出走卡内滚动
  });
});
