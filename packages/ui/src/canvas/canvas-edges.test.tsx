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
) {
  const onUpdate = vi.fn();
  act(() =>
    root.render(
      <CanvasShapeDataProvider value={{ ...EMPTY_CANVAS_SHAPE_DATA, readonly }}>
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

  test("renders color, marker, selection feedback, label, and toolbar", () => {
    render({ ...edge, style: { color: "#123456" } }, { markerEnd: "arrow-marker" });
    expect(renderedStyle().stroke).toBe("#123456");
    render({ ...edge, style: { color: "#123456" } }, { selected: true, markerEnd: "arrow-marker" });
    expect(renderedStyle()).toMatchObject({ stroke: "hsl(var(--primary))", strokeWidth: 4 });
    expect(container.querySelector('[data-testid="base-edge"]')?.getAttribute("data-marker")).toBe(
      "arrow-marker",
    );
    expect(container.textContent).toContain("LABEL");
    expect(container.querySelector('[data-testid="edge-toolbar"]')).not.toBeNull();
    expect(container.querySelector<HTMLElement>(".ring-primary")).not.toBeNull();
  });

  test("label editing trims and commits changes but ignores unchanged values", () => {
    const onUpdate = render(edge);
    act(() =>
      container
        .querySelector<HTMLElement>('[data-testid="base-edge"]')!
        .dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
    );
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

    render(edge);
    act(() =>
      container
        .querySelector<HTMLElement>('[data-testid="base-edge"]')!
        .dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
    );
    act(() => container.querySelector<HTMLInputElement>('input[aria-label="连线标签"]')!.blur());
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  test("Escape cancels label editing and readonly prevents it", () => {
    const onUpdate = render(edge);
    act(() =>
      container
        .querySelector<HTMLElement>('[data-testid="base-edge"]')!
        .dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
    );
    act(() =>
      container
        .querySelector<HTMLInputElement>('input[aria-label="连线标签"]')!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
    );
    expect(container.querySelector("input")).toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();

    render(edge, { selected: true }, true);
    act(() =>
      container
        .querySelector<HTMLElement>('[data-testid="base-edge"]')!
        .dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
    );
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector('[data-testid="edge-toolbar"]')).toBeNull();
  });
});
