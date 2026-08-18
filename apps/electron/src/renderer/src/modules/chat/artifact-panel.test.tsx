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

  test("shows an icon and total count without a visible summary label", () => {
    const { container } = renderPanel(view);
    const toggle = container?.querySelector('[data-testid="artifact-panel-toggle"]');
    expect(toggle?.textContent).toContain("2");
    expect(toggle?.textContent).not.toContain("本对话产出");
    expect(toggle?.getAttribute("aria-label")).toBe("已生成 2 项");
    expect(document.body.querySelector('[data-testid="artifact-panel-list"]')).toBeNull();
  });

  test("opens a flat list with type icons and opens an artifact on row click", () => {
    const { container, onOpen } = renderPanel(view);
    const toggle = container?.querySelector('[data-testid="artifact-panel-toggle"]') as HTMLElement;
    act(() => toggle.click());

    expect(document.body.querySelector('[data-testid="artifact-panel-list"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain("理解 1");
    expect(document.body.textContent).not.toContain("画布 1");
    const rows = document.body.querySelectorAll('[data-testid^="artifact-item-"]');
    expect(rows.length).toBe(2);

    const understandingRow = container?.querySelector(
      '[data-testid="artifact-item-u-1"]',
    ) as HTMLElement | null;
    const row =
      understandingRow ?? document.body.querySelector('[data-testid="artifact-item-u-1"]');
    act(() => row?.click());
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
    const toggle = container?.querySelector('[data-testid="artifact-panel-toggle"]');
    expect(toggle?.className).toContain("bg-primary/10");

    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(toggle?.className).not.toContain("bg-primary/10");
  });
});
