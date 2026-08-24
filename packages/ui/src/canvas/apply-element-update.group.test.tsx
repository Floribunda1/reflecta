// @vitest-environment happy-dom
import { describe, expect, test } from "vitest";
import { Graph, Node } from "@antv/x6";
import { nodeMetadataFor, applyElementUpdate } from "./graph-document";
import type { CanvasDocument, CanvasElementDTO } from "./document";

Node.define({
  shape: "group",
  inherit: "rect",
  ports: { groups: { default: { position: "left", attrs: { circle: { r: 4, magnet: true } } } } },
});
Node.define({
  shape: "text",
  inherit: "rect",
  ports: { groups: { default: { position: "left", attrs: { circle: { r: 4, magnet: true } } } } },
});

function elementFor(
  id: string,
  kind: CanvasElementDTO["kind"],
  partial: Partial<CanvasElementDTO> = {},
): CanvasElementDTO {
  const base = {
    id,
    canvasId: "c",
    parentId: null as string | null,
    x: 0,
    y: 0,
    width: 120,
    height: 80,
    zIndex: 0,
    createdAt: "t",
    updatedAt: "t",
  };
  switch (kind) {
    case "group":
      return { ...base, kind, understandingId: null, canvasRefId: null, props: { label: "G" }, ...partial } as CanvasElementDTO;
    case "text":
      return { ...base, kind, understandingId: null, canvasRefId: null, props: { text: "t" }, ...partial } as CanvasElementDTO;
    default:
      throw new Error("unsupported");
  }
}

/** 贴近真实工作区：async 渲染 + group 带子节点（virtual 在 happy-dom 缺 SVG matrix API，测不了）。 */
function makeGroupScene() {
  const container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", { value: 1000, configurable: true });
  Object.defineProperty(container, "clientHeight", { value: 800, configurable: true });
  document.body.appendChild(container);
  const graph = new Graph({
    container,
    async: true,
    virtual: false,
    autoResize: false,
    interacting: { nodeMovable: true },
  });
  const groupEl = elementFor("g1", "group", { x: 100, y: 100, width: 300, height: 200 });
  const memberEl = elementFor("m1", "text", { x: 130, y: 130 });
  const group = graph.addNode(nodeMetadataFor(groupEl)) as import("@antv/x6").Node;
  const member = graph.addNode(nodeMetadataFor(memberEl)) as import("@antv/x6").Node;
  group.addChild(member);
  return { graph, group, member, groupEl, memberEl, container };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("port paint sync on a group scene", () => {
  test("clearing the group color keeps the group and its child rendered", async () => {
    const { graph, group, groupEl, container } = makeGroupScene();
    await tick();
    try {
      // 设色
      applyElementUpdate(group, {
        ...groupEl,
        props: { ...groupEl.props, color: "chart-2" },
      } as CanvasElementDTO);
      await tick();
      expect(graph.getCellById("g1")).toBe(group);
      // 清除颜色（attr(path, undefined) → removeAttrByPath）
      applyElementUpdate(group, { ...groupEl, props: { label: "G" } } as CanvasElementDTO);
      await tick();
      // group cell 还在
      expect(graph.getCellById("g1")).toBe(group);
      // group 的子节点还在
      const children = group.getChildren() ?? [];
      expect(children.map((c) => c.id)).toContain("m1");
      // group 视图 DOM 还在
      const view = graph.findViewByCell(group);
      const viewRoot = view ? view.container : null;
      expect(viewRoot).not.toBeNull();
      expect(container.querySelectorAll("[data-cell-id='g1']").length).toBeGreaterThan(0);
      expect(container.querySelectorAll("[data-cell-id='m1']").length).toBeGreaterThan(0);
    } finally {
      graph.dispose();
      container.remove();
    }
  });
});