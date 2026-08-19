import type { Connection, Edge, EdgeChange, Node, NodeChange } from "@xyflow/react";
import { describe, expect, test } from "vitest";
import {
  appendCanvasConnection,
  reduceCanvasEdgeChanges,
  reduceCanvasNodeChanges,
} from "./canvas-graph-bridge";

const node: Node = {
  id: "node",
  position: { x: 0, y: 0 },
  data: {},
};

const edge: Edge = { id: "edge", source: "source", target: "target" };

describe("CanvasGraph controlled state bridge", () => {
  test.each([
    {
      name: "position",
      change: { id: "node", type: "position", position: { x: 40, y: 60 } } as NodeChange,
      documentChanged: true,
    },
    {
      name: "selection",
      change: { id: "node", type: "select", selected: true } as NodeChange,
      documentChanged: false,
    },
    {
      name: "dimensions",
      change: {
        id: "node",
        type: "dimensions",
        dimensions: { width: 240, height: 120 },
        setAttributes: true,
      } as NodeChange,
      documentChanged: true,
    },
    {
      name: "removal",
      change: { id: "node", type: "remove" } as NodeChange,
      documentChanged: true,
    },
    {
      name: "addition",
      change: {
        type: "add",
        item: { id: "added", position: { x: 20, y: 30 }, data: {} },
      } as NodeChange,
      documentChanged: true,
    },
    {
      name: "replacement",
      change: {
        id: "node",
        type: "replace",
        item: { id: "node", position: { x: 80, y: 90 }, data: {} },
      } as NodeChange,
      documentChanged: true,
    },
  ])(
    "applies $name changes and reports whether the document changed",
    ({ change, documentChanged }) => {
      const result = reduceCanvasNodeChanges([node], [change]);

      expect(result.nodes).not.toEqual([node]);
      expect(result.documentChanged).toBe(documentChanged);
    },
  );

  test.each([
    {
      name: "selection",
      change: { id: "edge", type: "select", selected: true } as EdgeChange,
      documentChanged: false,
    },
    {
      name: "removal",
      change: { id: "edge", type: "remove" } as EdgeChange,
      documentChanged: true,
    },
    {
      name: "addition",
      change: {
        type: "add",
        item: { id: "added", source: "source", target: "target" },
      } as EdgeChange,
      documentChanged: true,
    },
    {
      name: "replacement",
      change: {
        id: "edge",
        type: "replace",
        item: { id: "edge", source: "target", target: "source" },
      } as EdgeChange,
      documentChanged: true,
    },
  ])("applies edge $name changes and reports document impact", ({ change, documentChanged }) => {
    const result = reduceCanvasEdgeChanges([edge], [change]);

    expect(result.edges).not.toEqual([edge]);
    expect(result.documentChanged).toBe(documentChanged);
  });

  test("appends parallel edges and self loops without deduplication", () => {
    const makeEdge =
      (id: string) =>
      (connection: Connection): Edge => ({
        id,
        source: connection.source!,
        target: connection.target!,
      });

    const first = appendCanvasConnection(
      [],
      { source: "node", target: "node", sourceHandle: null, targetHandle: null },
      makeEdge("self-loop"),
    );
    const second = appendCanvasConnection(
      first,
      { source: "node", target: "node", sourceHandle: null, targetHandle: null },
      makeEdge("parallel"),
    );

    expect(second.map((item) => item.id)).toEqual(["self-loop", "parallel"]);
  });

  test("ignores incomplete connections", () => {
    const edges = [edge];

    expect(
      appendCanvasConnection(
        edges,
        { source: "source", target: "", sourceHandle: null, targetHandle: null },
        () => ({ id: "unexpected", source: "source", target: "target" }),
      ),
    ).toBe(edges);
  });
});
