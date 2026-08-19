import type { Edge, Node } from "@xyflow/react";
import { describe, expect, test } from "vitest";
import type { CanvasElementDTO } from "./document";
import { deleteGroupBranch, groupSelectedNodes, ungroupNodes } from "./graph-operations";

const timestamp = "2026-08-19T00:00:00.000Z";

function textNode(
  id: string,
  position: { x: number; y: number },
  size: { width: number; height: number },
  parentId?: string,
): Node {
  const element: CanvasElementDTO = {
    id,
    canvasId: "canvas",
    parentId: parentId ?? null,
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
    zIndex: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    kind: "text",
    understandingId: null,
    canvasRefId: null,
    props: { text: id },
  };
  return {
    id,
    type: "text",
    position,
    width: size.width,
    height: size.height,
    parentId,
    data: { element },
  };
}

function groupNode(
  id: string,
  position: { x: number; y: number },
  size: { width: number; height: number },
  parentId?: string,
): Node {
  const node = textNode(id, position, size, parentId);
  return {
    ...node,
    type: "group",
    data: {
      element: {
        ...(node.data as { element: CanvasElementDTO }).element,
        kind: "group",
        props: { label: id },
      } as CanvasElementDTO,
    },
  };
}

describe("Canvas group operations", () => {
  test("groups a selection without changing member absolute positions", () => {
    const nodes = [
      textNode("a", { x: 100, y: 100 }, { width: 100, height: 80 }),
      textNode("b", { x: 300, y: 200 }, { width: 120, height: 90 }),
    ];

    const result = groupSelectedNodes(nodes, ["a", "b"], {
      id: "group",
      canvasId: "canvas",
      createdAt: timestamp,
    });

    expect(result[0]).toMatchObject({
      id: "group",
      type: "group",
      position: { x: 76, y: 56 },
      width: 368,
      height: 258,
    });
    expect(result.find((node) => node.id === "a")).toMatchObject({
      parentId: "group",
      position: { x: 24, y: 44 },
    });
    expect(result.find((node) => node.id === "b")).toMatchObject({
      parentId: "group",
      position: { x: 224, y: 144 },
    });
  });

  test("creates a nested group inside the members' shared parent", () => {
    const nodes = [
      groupNode("outer", { x: 50, y: 50 }, { width: 500, height: 400 }),
      textNode("a", { x: 50, y: 60 }, { width: 100, height: 80 }, "outer"),
      textNode("b", { x: 200, y: 180 }, { width: 120, height: 90 }, "outer"),
    ];

    const result = groupSelectedNodes(nodes, ["a", "b"], {
      id: "inner",
      canvasId: "canvas",
      createdAt: timestamp,
    });

    expect(result.map((node) => node.id)).toEqual(["outer", "inner", "a", "b"]);
    expect(result.find((node) => node.id === "inner")).toMatchObject({
      parentId: "outer",
      position: { x: 26, y: 16 },
    });
    expect(result.find((node) => node.id === "a")).toMatchObject({
      parentId: "inner",
      position: { x: 24, y: 44 },
    });
    expect(result.find((node) => node.id === "b")).toMatchObject({
      parentId: "inner",
      position: { x: 174, y: 164 },
    });
  });

  test("ungroups nested members into the nearest surviving parent", () => {
    const nodes = [
      groupNode("outer", { x: 50, y: 50 }, { width: 500, height: 400 }),
      groupNode("inner", { x: 26, y: 16 }, { width: 318, height: 278 }, "outer"),
      textNode("a", { x: 24, y: 44 }, { width: 100, height: 80 }, "inner"),
      textNode("b", { x: 174, y: 164 }, { width: 120, height: 90 }, "inner"),
    ];

    const result = ungroupNodes(nodes, ["inner"]);

    expect(result.map((node) => node.id)).toEqual(["outer", "a", "b"]);
    expect(result.find((node) => node.id === "a")).toMatchObject({
      parentId: "outer",
      position: { x: 50, y: 60 },
    });
    expect(result.find((node) => node.id === "b")).toMatchObject({
      parentId: "outer",
      position: { x: 200, y: 180 },
    });
  });

  test("deletes a group branch and only its incident edges", () => {
    const nodes = [
      groupNode("outer", { x: 50, y: 50 }, { width: 500, height: 400 }),
      groupNode("inner", { x: 26, y: 16 }, { width: 318, height: 278 }, "outer"),
      textNode("inside", { x: 24, y: 44 }, { width: 100, height: 80 }, "inner"),
      textNode("outside", { x: 700, y: 100 }, { width: 100, height: 80 }),
    ];
    const edges: Edge[] = [
      { id: "incident", source: "inside", target: "outside" },
      { id: "unrelated", source: "outside", target: "outside" },
    ];

    const result = deleteGroupBranch(nodes, edges, "outer");

    expect(result.nodes.map((node) => node.id)).toEqual(["outside"]);
    expect(result.edges.map((edge) => edge.id)).toEqual(["unrelated"]);
  });

  test("does not create a group without two distinct existing selections", () => {
    const nodes = [textNode("a", { x: 0, y: 0 }, { width: 100, height: 80 })];

    expect(
      groupSelectedNodes(nodes, ["a", "a", "missing"], {
        id: "group",
        canvasId: "canvas",
        createdAt: timestamp,
      }),
    ).toBe(nodes);
  });

  test("does not reparent a descendant when its selected ancestor is grouped", () => {
    const nodes = [
      {
        ...groupNode("existing-group", { x: 50, y: 50 }, { width: 300, height: 240 }),
        selected: true,
      },
      {
        ...textNode("child", { x: 30, y: 50 }, { width: 100, height: 80 }, "existing-group"),
        selected: true,
      },
      {
        ...textNode("outside", { x: 500, y: 100 }, { width: 100, height: 80 }),
        selected: true,
      },
    ];

    const result = groupSelectedNodes(nodes, ["existing-group", "child", "outside"], {
      id: "new-group",
      canvasId: "canvas",
      createdAt: timestamp,
    });

    expect(result.find((node) => node.id === "existing-group")?.parentId).toBe("new-group");
    expect(result.find((node) => node.id === "outside")?.parentId).toBe("new-group");
    expect(result.find((node) => node.id === "child")?.parentId).toBe("existing-group");
    expect(result.find((node) => node.id === "child")?.selected).toBe(false);
  });

  test("ungroups multiple nested groups in one operation", () => {
    const nodes = [
      groupNode("outer", { x: 50, y: 50 }, { width: 500, height: 400 }),
      groupNode("inner", { x: 26, y: 16 }, { width: 318, height: 278 }, "outer"),
      textNode("child", { x: 24, y: 44 }, { width: 100, height: 80 }, "inner"),
    ];

    const result = ungroupNodes(nodes, ["outer", "inner"]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "child",
      parentId: undefined,
      position: { x: 100, y: 110 },
    });
  });
});
