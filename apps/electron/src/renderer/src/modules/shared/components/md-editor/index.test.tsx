// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MarkdownEditor } from "./index";
import { createReflectaMilkdownEditorBuilder } from "./milkdown-editor";
import { getMilkdownMarkdown, setMilkdownMarkdown } from "./milkdown-editor";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let currentEditorMarkdown = "Initial";
let latestBuilderOptions: any = null;

const thoughts = [
  {
    id: "thought-1",
    title: "Alpha",
    body: "Alpha body",
  },
  {
    id: "thought-2",
    title: "Beta",
    body: "Beta body",
  },
];

vi.mock("@renderer/utils/ipc", () => ({
  ipcClient: {
    asset: {
      saveAsset: vi.fn(),
    },
    search: {
      searchThoughts: vi.fn(async () => thoughts),
    },
    thought: {
      listThoughts: vi.fn(async () => thoughts),
    },
  },
}));

vi.mock("@milkdown/react", () => ({
  Milkdown: () => <div data-testid="milkdown" />,
  MilkdownProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useEditor: (factory: (root: HTMLElement) => unknown) => {
    const root = document.createElement("div");
    factory(root);
    return {
      get: () => ({ id: "editor" }),
    };
  },
}));

vi.mock("./milkdown-editor", () => ({
  createReflectaMilkdownEditorBuilder: vi.fn((options) => {
    latestBuilderOptions = options;
    return {};
  }),
  getMilkdownMarkdown: vi.fn(() => currentEditorMarkdown),
  setMilkdownMarkdown: vi.fn(),
}));

describe("MarkdownEditor", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container?.remove();
    container = null;
    currentEditorMarkdown = "Initial";
    latestBuilderOptions = null;
    vi.clearAllMocks();
  });

  test("does not replace the active editor document for same-session content updates", () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        React.createElement(MarkdownEditor as React.ComponentType<any>, {
          contentKey: "thought-1",
          content: "Initial",
        }),
      );
    });

    expect(setMilkdownMarkdown).not.toHaveBeenCalled();

    currentEditorMarkdown = "Local typing";
    act(() => {
      root?.render(
        React.createElement(MarkdownEditor as React.ComponentType<any>, {
          contentKey: "thought-1",
          content: "Server formatted local typing",
        }),
      );
    });

    expect(setMilkdownMarkdown).not.toHaveBeenCalled();

    act(() => {
      root?.render(
        React.createElement(MarkdownEditor as React.ComponentType<any>, {
          contentKey: "thought-2",
          content: "Another thought",
        }),
      );
    });

    expect(getMilkdownMarkdown).toHaveBeenCalled();
    expect(setMilkdownMarkdown).toHaveBeenCalledWith({ id: "editor" }, "Another thought");
  });

  test("does not expose a variant attribute on the editor root", () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root?.render(<MarkdownEditor content="Initial" />);
    });

    expect(container.querySelector(".reflecta-md-editor")?.hasAttribute("data-variant")).toBe(
      false,
    );
  });

  test("renders wiki-link suggestions from plugin state", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<MarkdownEditor content="Initial" />);
    });

    expect(createReflectaMilkdownEditorBuilder).toHaveBeenCalled();

    await act(async () => {
      latestBuilderOptions.wikiLinkController.onStateChange({
        active: true,
        from: 1,
        to: 3,
        query: "",
        selectedIndex: 0,
      });
    });

    const menu = container.querySelector('[role="listbox"]');
    expect(menu?.textContent).toContain("Alpha");
    expect(menu?.textContent).toContain("Beta");
    expect(container.querySelector('[role="option"][aria-selected="true"]')?.textContent).toContain(
      "Alpha",
    );
    expect(latestBuilderOptions.wikiLinkController.getItemCount()).toBe(2);
    expect(
      latestBuilderOptions.wikiLinkController.getSelectedMarkdown({
        active: true,
        from: 1,
        to: 3,
        query: "",
        selectedIndex: 1,
      }),
    ).toBe("[[Beta#thought-2]]");
  });
});
