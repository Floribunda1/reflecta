// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ArtifactPanel } from "./artifact-panel";
import type { ArtifactPanelView } from "./session/artifact-panel";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  container?.remove();
  container = null;
  vi.useRealTimers();
});

function renderPanel(view: ArtifactPanelView, onOpen = vi.fn()) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<ArtifactPanel view={view} onOpen={onOpen} />);
  });
  return { container, onOpen };
}

const view: ArtifactPanelView = {
  total: 2,
  groups: [
    {
      type: "understanding",
      label: "理解",
      items: [
        {
          type: "understanding",
          id: "u-1",
          title: "双链的本质",
          landingAt: "2026-08-01T12:00:00.000Z",
          messageId: "m-1",
        },
      ],
    },
    {
      type: "canvas",
      label: "画布",
      items: [
        {
          type: "canvas",
          id: "c-1",
          title: "心智模型",
          landingAt: "2026-08-01T11:00:00.000Z",
          messageId: "m-2",
        },
      ],
    },
  ],
};

describe("ArtifactPanel", () => {
  test("renders nothing when the conversation has no landed artifacts", () => {
    renderPanel({ total: 0, groups: [] });
    expect(container?.querySelector('[data-testid="artifact-panel"]')).toBeNull();
  });

  test("shows a collapsed summary strip with total and per-type counts", () => {
    const { container } = renderPanel(view);
    const toggle = container?.querySelector('[data-testid="artifact-panel-toggle"]');
    expect(toggle?.textContent).toContain("本对话产出 2 项");
    expect(toggle?.textContent).toContain("理解 1");
    expect(toggle?.textContent).toContain("画布 1");
    expect(container?.querySelector('[data-testid="artifact-panel-list"]')).toBeNull();
  });

  test("expands to the grouped list and opens an artifact on row click", () => {
    const { container, onOpen } = renderPanel(view);
    const toggle = container?.querySelector('[data-testid="artifact-panel-toggle"]') as HTMLElement;
    act(() => toggle.click());

    expect(container?.querySelector('[data-testid="artifact-panel-list"]')).not.toBeNull();
    const rows = container?.querySelectorAll('[data-testid^="artifact-item-"]') ?? [];
    expect(rows.length).toBe(2);

    const understandingRow = container?.querySelector(
      '[data-testid="artifact-item-understanding"]',
    ) as HTMLElement;
    act(() => understandingRow.click());
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ type: "understanding", id: "u-1" }),
    );
  });

  test("flashes briefly when the total grows", () => {
    vi.useFakeTimers();
    const { container, onOpen } = renderPanel({ total: 0, groups: [] });
    expect(container?.querySelector('[data-testid="artifact-panel"]')).toBeNull();

    act(() => {
      root?.render(<ArtifactPanel view={view} onOpen={onOpen} />);
    });
    const panel = container?.querySelector('[data-testid="artifact-panel"]');
    expect(panel?.className).toContain("bg-primary/5");

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(panel?.className).not.toContain("bg-primary/5");
  });
});
