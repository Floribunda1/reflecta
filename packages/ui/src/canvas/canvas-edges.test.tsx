// @vitest-environment happy-dom
import { act } from "react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { CanvasEdgeDTO, CanvasEdgeStyle } from "./document";
import {
  CanvasEdgeUpdateProvider,
  CanvasShapeDataProvider,
  EMPTY_CANVAS_SHAPE_DATA,
} from "./shape-context";

vi.mock("@xyflow/react", () => ({
  BaseEdge: ({
    path,
    style,
    markerEnd,
    onDoubleClick,
  }: {
    path: string;
    style: CSSProperties;
    markerEnd?: string;
    onDoubleClick?: () => void;
  }) => (
    <button
      type="button"
      data-testid="base-edge"
      data-path={path}
      data-style={JSON.stringify(style)}
      data-marker={markerEnd}
      onDoubleClick={onDoubleClick}
    />
  ),
  EdgeToolbar: ({ isVisible, children }: { isVisible: boolean; children: ReactNode }) =>
    isVisible ? <div data-testid="edge-toolbar">{children}</div> : null,
  EdgeLabelRenderer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  getStraightPath: () => ["straight", 10, 20],
  getSmoothStepPath: () => ["orthogonal", 10, 20],
  getBezierPath: () => ["curve", 10, 20],
}));

import { CanvasEdge } from "./edges";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const edge: CanvasEdgeDTO = {
  id: "edge",
  canvasId: "canvas",
  sourceElementId: "source",
  targetElementId: "target",
  label: "LABEL",
  style: null,
  createdAt: "2026-08-19T00:00:00.000Z",
};

let container: HTMLDivElement;
let root: Root;
let renderCount = 0;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function edgeProps(dto: CanvasEdgeDTO, extra: Partial<ComponentProps<typeof CanvasEdge>> = {}) {
  return {
    id: dto.id,
    source: dto.sourceElementId,
    target: dto.targetElementId,
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: "right",
    targetPosition: "left",
    data: { edge: dto },
    selected: false,
    ...extra,
  } as ComponentProps<typeof CanvasEdge>;
}

function render(
  dto: CanvasEdgeDTO,
  extra: Partial<ComponentProps<typeof CanvasEdge>> = {},
  readonly = false,
  editing = false,
) {
  const onUpdate = vi.fn();
  const shape = { ...EMPTY_CANVAS_SHAPE_DATA, readonly };
  // key 强制每次 render 全新挂载：editing 从 false 开始，模拟双击触发（editingEdgeId 注入）后
  // effect 再开启编辑，与生产中 onEdgeDoubleClick → editingEdgeId 同一条路径。
  const contextValue = editing ? { ...shape, editingEdgeId: dto.id } : shape;
  act(() =>
    root.render(
      <CanvasShapeDataProvider key={++renderCount} value={contextValue}>
        <CanvasEdgeUpdateProvider value={onUpdate}>
          <CanvasEdge {...edgeProps(dto, extra)} />
        </CanvasEdgeUpdateProvider>
      </CanvasShapeDataProvider>,
    ),
  );
  return onUpdate;
}

function renderedStyle() {
  return JSON.parse(
    container.querySelector('[data-testid="base-edge"]')?.getAttribute("data-style") ?? "{}",
  ) as Record<string, unknown>;
}

describe("canvas edges", () => {
  test.each([
    ["straight", "straight"],
    ["curve", "curve"],
    ["orthogonal", "orthogonal"],
  ] satisfies Array<[CanvasEdgeStyle["routing"], string]>)(
    "renders %s routing",
    (routing, path) => {
      render({ ...edge, style: { routing } });
      expect(container.querySelector('[data-testid="base-edge"]')?.getAttribute("data-path")).toBe(
        path,
      );
    },
  );

  test.each([
    ["solid", undefined],
    ["dashed", "5 5"],
    ["dotted", "2 2"],
  ] satisfies Array<[CanvasEdgeStyle["lineStyle"], string | undefined]>)(
    "renders %s line style",
    (lineStyle, dash) => {
      render({ ...edge, style: { lineStyle } });
      expect(renderedStyle().strokeDasharray).toBe(dash);
    },
  );

  test.each([
    ["thin", 2],
    ["medium", 3],
    ["thick", 4],
  ] satisfies Array<[CanvasEdgeStyle["width"], number]>)("renders %s width", (width, pixels) => {
    render({ ...edge, style: { width } });
    expect(renderedStyle().strokeWidth).toBe(pixels);
  });

  test("idle stroke stays hover-overridable via CSS variable", () => {
    render(edge);
    expect(renderedStyle().stroke).toBe("var(--canvas-edge-stroke, var(--muted-foreground))");
  });

  test("renders color, marker, selection feedback, label, and toolbar", () => {
    render({ ...edge, style: { color: "chart-1" } }, { markerEnd: "arrow-marker" });
    expect(renderedStyle().stroke).toBe("var(--canvas-edge-stroke, var(--chart-1))");
    render({ ...edge, style: { color: "#123456" } }, { markerEnd: "arrow-marker" });
    expect(renderedStyle().stroke).toBe("var(--canvas-edge-stroke, #123456)");
    render({ ...edge, style: { color: "#123456" } }, { selected: true, markerEnd: "arrow-marker" });
    // 选中态使用边自身颜色（与卡片 selected 跟随 border 一致）。
    expect(renderedStyle()).toMatchObject({ stroke: "#123456", strokeWidth: 4 });
    expect(container.querySelector('[data-testid="base-edge"]')?.getAttribute("data-marker")).toBe(
      "arrow-marker",
    );
    expect(container.textContent).toContain("LABEL");
    expect(container.querySelector('[data-testid="edge-toolbar"]')).not.toBeNull();
    expect(container.querySelector<HTMLElement>(".ring-primary")).not.toBeNull();
  });

  function openEditor() {
    // 双击连线经 React Flow onEdgeDoubleClick → editingEdgeId 触发编辑。
    act(() =>
      container
        .querySelector<HTMLElement>("[data-testid='base-edge']")!
        .dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
    );
  }

  test("label editing trims and commits changes but ignores unchanged values", () => {
    const onUpdate = render(edge, {}, false, true);
    openEditor();
    const input = container.querySelector<HTMLInputElement>('input[aria-label="连线标签"]')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
        input,
        "  CHANGED  ",
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(onUpdate).toHaveBeenCalledWith({ ...edge, label: "CHANGED" });

    render(edge, {}, false, true);
    openEditor();
    act(() => container.querySelector<HTMLInputElement>('input[aria-label="连线标签"]')!.blur());
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  test("style controls pick values from a secondary menu", () => {
    const onUpdate = render(edge, { selected: true });
    act(() =>
      container
        .querySelector<HTMLElement>('[data-testid="edge-toolbar"] [aria-label="形状"]')!
        .click(),
    );
    act(() =>
      [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]
        .find((item) => item.textContent === "直线")!
        .click(),
    );
    expect(onUpdate).toHaveBeenCalledWith({ ...edge, style: { routing: "straight" } });

    act(() =>
      container
        .querySelector<HTMLElement>('[data-testid="edge-toolbar"] [aria-label="线宽"]')!
        .click(),
    );
    act(() =>
      [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]
        .find((item) => item.textContent === "粗")!
        .click(),
    );
    expect(onUpdate).toHaveBeenCalledWith({ ...edge, style: { width: "thick" } });

    act(() =>
      container
        .querySelector<HTMLElement>('[data-testid="edge-toolbar"] [aria-label="箭头"]')!
        .click(),
    );
    act(() =>
      [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]
        .find((item) => item.textContent === "无")!
        .click(),
    );
    expect(onUpdate).toHaveBeenCalledWith({ ...edge, style: { arrowhead: "none" } });
  });

  test("Escape cancels label editing and readonly prevents it", () => {
    const onUpdate = render(edge, {}, false, true);
    openEditor();
    act(() =>
      container
        .querySelector<HTMLInputElement>('input[aria-label="连线标签"]')!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
    );
    expect(container.querySelector("input")).toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();

    // readonly：不注入 editingEdgeId，双击连线不进入编辑。
    render(edge, { selected: true }, true, true);
    openEditor();
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector('[data-testid="edge-toolbar"]')).toBeNull();
  });

  test("double-click trigger (editingEdgeId) re-opens editing for the same edge", () => {
    // editingEdgeId === 本边 id → 挂载 effect 开启编辑。
    render(edge, {}, false, true);
    expect(container.querySelector('input[aria-label="连线标签"]')).not.toBeNull();
    // 提交后触发清空（onEdgeEditEnd → editingEdgeId 置 null）→ 编辑关闭。
    render(edge, {}, false, false);
    expect(container.querySelector("input")).toBeNull();
    // 再次双击同一连线 → trigger 重新注入 → 再次进入。
    render(edge, {}, false, true);
    expect(container.querySelector('input[aria-label="连线标签"]')).not.toBeNull();
  });
});
