// @vitest-environment happy-dom

import { beforeEach, describe, expect, test } from "vitest";
import { createCanvasStore, initialCanvasState } from "./store";
import type { CanvasDocument } from "@reflecta/server";

const EMPTY: CanvasDocument = { elements: [], edges: [] };

function element(
  kind: "text" | "group" = "text",
  id = "element-1",
): CanvasDocument["elements"][number] {
  const base = {
    id,
    canvasId: "canvas-1",
    parentId: null,
    x: 0,
    y: 0,
    width: 200,
    height: 80,
    zIndex: 1,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
  if (kind === "group") {
    return { ...base, kind, understandingId: null, canvasRefId: null, props: { label: "组" } };
  }
  return { ...base, kind, understandingId: null, canvasRefId: null, props: { text: "hello" } };
}

describe("canvas store", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear();
  });

  test("初始状态为空镜像", () => {
    const store = createCanvasStore();
    expect(store.getState()).toMatchObject(initialCanvasState);
  });

  test("selectCanvas 打开画布并清空文档 / 视口 / 选中", () => {
    const store = createCanvasStore();
    store.getState().setDocument({ elements: [element()], edges: [] });
    store.getState().setViewport({ x: 10, y: 20, zoom: 1.5 });
    store.getState().setSelection(["element-1"]);

    store.getState().selectCanvas("canvas-2");

    expect(store.getState().selectedCanvasId).toBe("canvas-2");
    expect(store.getState().document).toEqual(EMPTY);
    expect(store.getState().viewport).toBeNull();
    expect(store.getState().selection).toEqual([]);
  });

  test("selectCanvas(null) 关闭画布并复位", () => {
    const store = createCanvasStore();
    store.getState().selectCanvas("canvas-1");
    store.getState().selectCanvas(null);
    expect(store.getState().selectedCanvasId).toBeNull();
    expect(store.getState().document).toEqual(EMPTY);
  });

  test("事件桥回写：setDocument / setViewport / setSelection", () => {
    const store = createCanvasStore();
    const document = { elements: [element()], edges: [] };

    store.getState().setDocument(document);
    store.getState().setViewport({ x: 1, y: 2, zoom: 0.8 });
    store.getState().setSelection(["element-1"]);

    expect(store.getState().document).toEqual(document);
    expect(store.getState().viewport).toEqual({ x: 1, y: 2, zoom: 0.8 });
    expect(store.getState().selection).toEqual(["element-1"]);
  });

  test("reset 回到初始状态", () => {
    const store = createCanvasStore();
    store.getState().selectCanvas("canvas-1");
    store.getState().setDocument({ elements: [element()], edges: [] });
    store.getState().reset();
    expect(store.getState()).toMatchObject(initialCanvasState);
  });

  test("多实例互不干扰（只读预览不共享交互态）", () => {
    const a = createCanvasStore();
    const b = createCanvasStore();
    a.getState().selectCanvas("canvas-1");
    expect(b.getState().selectedCanvasId).toBeNull();
  });
});
