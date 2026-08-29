// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CanvasLibraryPanel } from "./canvas-library-panel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const noop = () => undefined;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("CanvasLibraryPanel hover preview", () => {
  test("理解条目有正文时包一层 hover-card trigger", () => {
    act(() =>
      root.render(
        <CanvasLibraryPanel
          tab="understandings"
          items={[
            { id: "u-1", title: "分区灌溉", body: "先核对接线。" },
            { id: "u-2", title: "空正文", body: "" },
          ]}
          domainTree={[]}
          canvases={[]}
          searchQuery=""
          selectedDomainId="all"
          includeDescendants
          sortBy="updatedAt"
          onTabChange={noop}
          onSearchQueryChange={noop}
          onSelectedDomainIdChange={noop}
          onIncludeDescendantsChange={noop}
          onSortByChange={noop}
          onClose={noop}
          onStartDragUnderstanding={noop}
          onPickUnderstanding={noop}
          onStartDragCanvas={noop}
          onPickCanvas={noop}
        />,
      ),
    );
    expect(container.querySelectorAll('[data-slot="hover-card-trigger"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-testid="canvas-library-item"]')).toHaveLength(2);
  });

  test("画布条目没有正文预览", () => {
    act(() =>
      root.render(
        <CanvasLibraryPanel
          tab="canvases"
          items={[]}
          domainTree={[]}
          canvases={[{ id: "cv-1", title: "夜班联调" }]}
          searchQuery=""
          selectedDomainId="all"
          includeDescendants
          sortBy="updatedAt"
          onTabChange={noop}
          onSearchQueryChange={vi.fn()}
          onSelectedDomainIdChange={noop}
          onIncludeDescendantsChange={noop}
          onSortByChange={noop}
          onClose={noop}
          onStartDragUnderstanding={noop}
          onPickUnderstanding={noop}
          onStartDragCanvas={noop}
          onPickCanvas={noop}
        />,
      ),
    );
    expect(container.querySelectorAll('[data-slot="hover-card-trigger"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-testid="canvas-library-canvas-item"]')).toHaveLength(
      1,
    );
  });
});
