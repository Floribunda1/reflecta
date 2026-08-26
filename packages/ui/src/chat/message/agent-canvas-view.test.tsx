// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { AgentCanvasView } from "./agent-canvas-view";
import type { AgentCanvasViewBlock } from "./types";

const canvasRender = vi.hoisted(() => vi.fn());

vi.mock("../../canvas/readonly-canvas-card", () => ({
  ReadOnlyCanvasCard: (props: unknown) => {
    canvasRender(props);
    return <div data-testid="readonly-canvas" />;
  },
  ReadOnlyCanvasSkeleton: () => <div data-testid="canvas-view-skeleton" />,
}));

afterEach(() => vi.clearAllMocks());

function block(): AgentCanvasViewBlock {
  return {
    kind: "canvas-view",
    id: "canvas-view",
    title: "关系图",
    document: { elements: [], edges: [] },
    status: "done",
    understandingRefs: new Map([["u1", { id: "u1", title: "理解", body: "正文", deleted: false }]]),
  };
}

test("does not rerender the canvas for equivalent streaming snapshots", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<AgentCanvasView block={block()} />));
  act(() => root.render(<AgentCanvasView block={block()} />));

  expect(canvasRender).toHaveBeenCalledTimes(1);
  act(() => root.unmount());
});

test("uses the full-width presentation card for the streaming skeleton", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(<AgentCanvasView block={{ ...block(), status: "streaming" }} />));

  const card = container.querySelector('[data-testid="agent-canvas-placeholder"]');
  expect(card?.getAttribute("data-slot")).toBe("card");
  expect(card?.classList.contains("w-full")).toBe(true);
  expect(card?.querySelector('[data-testid="canvas-view-skeleton"]')).not.toBeNull();
  expect(canvasRender).not.toHaveBeenCalled();
  act(() => root.unmount());
});
