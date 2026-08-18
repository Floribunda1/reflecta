import type { CanvasElementDTO } from "@reflecta/ui/canvas";

/**
 * 新元素 DTO 工厂：拖入 / 创建时生成（元素 id 与 X6 cell id 零映射，每次新建随机生成；
 * 时间戳字段由 saveCanvas 对账时服务端补全，本地先占位）。
 */
export function createCanvasElementId(): string {
  return crypto.randomUUID();
}

const now = () => new Date().toISOString();

export function newTextElement(
  partial: Partial<Pick<CanvasElementDTO, "x" | "y" | "width" | "height">> = {},
): CanvasElementDTO {
  return {
    id: createCanvasElementId(),
    canvasId: "",
    parentId: null,
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    width: partial.width ?? 220,
    height: partial.height ?? 120,
    zIndex: 1,
    createdAt: now(),
    updatedAt: now(),
    kind: "text",
    understandingId: null,
    canvasRefId: null,
    props: { text: "" },
  };
}

export function newShapeElement(shapeType: "rect" | "circle"): CanvasElementDTO {
  return {
    id: createCanvasElementId(),
    canvasId: "",
    parentId: null,
    x: 0,
    y: 0,
    width: 120,
    height: 80,
    zIndex: 1,
    createdAt: now(),
    updatedAt: now(),
    kind: "shape",
    understandingId: null,
    canvasRefId: null,
    props: { shapeType },
  };
}

export function newGroupElement(): CanvasElementDTO {
  return {
    id: createCanvasElementId(),
    canvasId: "",
    parentId: null,
    x: 0,
    y: 0,
    width: 320,
    height: 240,
    zIndex: 1,
    createdAt: now(),
    updatedAt: now(),
    kind: "group",
    understandingId: null,
    canvasRefId: null,
    props: { label: "" },
  };
}

export function newUnderstandingElement(understandingId: string): CanvasElementDTO {
  return {
    id: createCanvasElementId(),
    canvasId: "",
    parentId: null,
    x: 0,
    y: 0,
    width: 260,
    height: 220,
    zIndex: 1,
    createdAt: now(),
    updatedAt: now(),
    kind: "understanding",
    understandingId,
    canvasRefId: null,
    props: {},
  };
}

export function newCanvasRefElement(canvasRefId: string): CanvasElementDTO {
  return {
    id: createCanvasElementId(),
    canvasId: "",
    parentId: null,
    x: 0,
    y: 0,
    width: 180,
    height: 72,
    zIndex: 1,
    createdAt: now(),
    updatedAt: now(),
    kind: "canvas_ref",
    understandingId: null,
    canvasRefId,
    props: {},
  };
}
