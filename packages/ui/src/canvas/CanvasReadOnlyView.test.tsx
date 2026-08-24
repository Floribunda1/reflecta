// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { CanvasReadOnlyView } from "./CanvasReadOnlyView";
import { EMPTY_CANVAS_DOCUMENT } from "./document";

const handles = vi.hoisted(() => ({
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  fitView: vi.fn(),
}));

vi.mock("./CanvasGraph", async () => {
  const React = await import("react");
  return {
    CanvasGraph: React.forwardRef(function CanvasGraphMock(
      _props: unknown,
      ref: React.Ref<{ zoomIn: () => void; zoomOut: () => void; fitView: () => void }>,
    ) {
      React.useImperativeHandle(ref, () => handles);
      return <div data-testid="canvas-readonly-graph" />;
    }),
  };
});

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.clearAllMocks();
});

function render(node: ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(node));
  return container;
}

test("does not show zoom controls on compact readonly previews", () => {
  const next = render(<CanvasReadOnlyView document={EMPTY_CANVAS_DOCUMENT} />);
  expect(next.querySelector('[data-testid="canvas-zoom-controls"]')).toBeNull();
});

test("wires zoom controls on the agent readonly modal", () => {
  const next = render(<CanvasReadOnlyView document={EMPTY_CANVAS_DOCUMENT} showZoomControls />);
  expect(next.querySelector('[data-testid="canvas-zoom-controls"]')).not.toBeNull();

  act(() => next.querySelector<HTMLButtonElement>('[data-testid="canvas-zoom-in"]')?.click());
  act(() => next.querySelector<HTMLButtonElement>('[data-testid="canvas-zoom-out"]')?.click());
  act(() => next.querySelector<HTMLButtonElement>('[data-testid="canvas-zoom-fit"]')?.click());

  expect(handles.zoomIn).toHaveBeenCalledOnce();
  expect(handles.zoomOut).toHaveBeenCalledOnce();
  expect(handles.fitView).toHaveBeenCalledOnce();
});
