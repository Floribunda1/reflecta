import { Effect } from "effect";
import { describe, expect, test } from "vitest";
import { normalizeCanvasChanges } from "./changes";
import type { CanvasElementDTO } from "./types";

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
});
