import { describe, expect, test } from "vitest";
import type { CanvasDocument, CanvasElementDTO } from "./document";
import { deleteGroupBranch, groupElements, ungroupGroups } from "./graph-operations";

const timestamp = "2026-08-19T00:00:00.000Z";

function element(
  id: string,
  kind: "text" | "group",
  position: { x: number; y: number },
  size: { width: number; height: number },
  parentId?: string,
): CanvasElementDTO {
  return {
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
    kind,
    understandingId: null,
    canvasRefId: null,
    props: kind === "group" ? { label: id } : { text: id },
  } as CanvasElementDTO;
}

const doc = (elements: CanvasElementDTO[]): CanvasDocument => ({ elements, edges: [] });

describe("Canvas group operations (pure document transforms)", () => {
  test("groups a selection without changing member absolute positions", () => {
    const result = groupElements(
      doc([
        element("a", "text", { x: 100, y: 100 }, { width: 100, height: 80 }),
        element("b", "text", { x: 300, y: 200 }, { width: 120, height: 90 }),
      ]),
      ["a", "b"],
      { id: "group", canvasId: "canvas", createdAt: timestamp },
    );
    expect(result.elements[0]).toMatchObject({
      id: "group",
      kind: "group",
      x: 76,
      y: 56,
      width: 368,
      height: 258,
    });
    expect(result.elements.find((e) => e.id === "a")).toMatchObject({
      parentId: "group",
      x: 24,
      y: 44,
    });
    expect(result.elements.find((e) => e.id === "b")).toMatchObject({
      parentId: "group",
      x: 224,
      y: 144,
    });
  });

  test("creates a nested group inside the members' shared parent", () => {
    const result = groupElements(
      doc([
        element("outer", "group", { x: 50, y: 50 }, { width: 500, height: 400 }),
        element("a", "text", { x: 50, y: 60 }, { width: 100, height: 80 }, "outer"),
        element("b", "text", { x: 200, y: 180 }, { width: 120, height: 90 }, "outer"),
      ]),
      ["a", "b"],
      { id: "inner", canvasId: "canvas", createdAt: timestamp },
    );
    expect(result.elements.map((e) => e.id)).toEqual(["outer", "inner", "a", "b"]);
    expect(result.elements.find((e) => e.id === "inner")).toMatchObject({
      parentId: "outer",
      x: 26,
      y: 16,
    });
    expect(result.elements.find((e) => e.id === "a")).toMatchObject({
      parentId: "inner",
      x: 24,
      y: 44,
    });
    expect(result.elements.find((e) => e.id === "b")).toMatchObject({
      parentId: "inner",
      x: 174,
      y: 164,
    });
  });

  test("ungroups nested members into the nearest surviving parent", () => {
    const result = ungroupGroups(
      doc([
        element("outer", "group", { x: 50, y: 50 }, { width: 500, height: 400 }),
        element("inner", "group", { x: 26, y: 16 }, { width: 318, height: 278 }, "outer"),
        element("a", "text", { x: 24, y: 44 }, { width: 100, height: 80 }, "inner"),
        element("b", "text", { x: 174, y: 164 }, { width: 120, height: 90 }, "inner"),
      ]),
      ["inner"],
    );
    expect(result.elements.map((e) => e.id)).toEqual(["outer", "a", "b"]);
    expect(result.elements.find((e) => e.id === "a")).toMatchObject({
      parentId: "outer",
      x: 50,
      y: 60,
    });
    expect(result.elements.find((e) => e.id === "b")).toMatchObject({
      parentId: "outer",
      x: 200,
      y: 180,
    });
  });

  test("deletes a group branch and only its incident edges", () => {
    const source: CanvasDocument = {
      elements: [
        element("outer", "group", { x: 50, y: 50 }, { width: 500, height: 400 }),
        element("inner", "group", { x: 26, y: 16 }, { width: 318, height: 278 }, "outer"),
        element("inside", "text", { x: 24, y: 44 }, { width: 100, height: 80 }, "inner"),
        element("outside", "text", { x: 700, y: 100 }, { width: 100, height: 80 }),
      ],
      edges: [
        {
          id: "incident",
          canvasId: "canvas",
          source: { cell: "inside", port: "right" },
          target: { cell: "outside", port: "left" },
          router: null,
          connector: { name: "smooth" },
          label: null,
          style: null,
          createdAt: timestamp,
        },
        {
          id: "unrelated",
          canvasId: "canvas",
          source: { cell: "outside", port: "right" },
          target: { cell: "outside", port: "left" },
          router: null,
          connector: { name: "smooth" },
          label: null,
          style: null,
          createdAt: timestamp,
        },
      ],
    };
    const result = deleteGroupBranch(source, "outer");
    expect(result.elements.map((e) => e.id)).toEqual(["outside"]);
    expect(result.edges.map((e) => e.id)).toEqual(["unrelated"]);
  });

  test("does not create a group with fewer than two distinct selections", () => {
    const input = doc([element("a", "text", { x: 0, y: 0 }, { width: 100, height: 80 })]);
    expect(
      groupElements(input, ["a", "a", "missing"], {
        id: "group",
        canvasId: "canvas",
        createdAt: timestamp,
      }),
    ).toBe(input);
  });

  test("does not reparent a descendant whose selected ancestor is grouped", () => {
    const result = groupElements(
      doc([
        element("existing-group", "group", { x: 50, y: 50 }, { width: 300, height: 240 }),
        element("child", "text", { x: 30, y: 50 }, { width: 100, height: 80 }, "existing-group"),
        element("outside", "text", { x: 500, y: 100 }, { width: 100, height: 80 }),
      ]),
      ["existing-group", "child", "outside"],
      { id: "new-group", canvasId: "canvas", createdAt: timestamp },
    );
    expect(result.elements.find((e) => e.id === "existing-group")?.parentId).toBe("new-group");
    expect(result.elements.find((e) => e.id === "outside")?.parentId).toBe("new-group");
    expect(result.elements.find((e) => e.id === "child")?.parentId).toBe("existing-group");
  });

  test("ungroups multiple nested groups in one operation", () => {
    const result = ungroupGroups(
      doc([
        element("outer", "group", { x: 50, y: 50 }, { width: 500, height: 400 }),
        element("inner", "group", { x: 26, y: 16 }, { width: 318, height: 278 }, "outer"),
        element("child", "text", { x: 24, y: 44 }, { width: 100, height: 80 }, "inner"),
      ]),
      ["outer", "inner"],
    );
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toMatchObject({ id: "child", parentId: null, x: 100, y: 110 });
  });
});
