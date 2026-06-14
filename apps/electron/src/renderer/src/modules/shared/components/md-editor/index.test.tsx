// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MarkdownEditor } from "./index";
import { getMilkdownMarkdown, setMilkdownMarkdown } from "./milkdown-editor";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let currentEditorMarkdown = "Initial";

vi.mock("@renderer/utils/ipc", () => ({
  ipcClient: {
    asset: {
      saveAsset: vi.fn(),
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
  createReflectaMilkdownEditorBuilder: vi.fn(() => {
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
    vi.clearAllMocks();
  });

  test("does not replace the active editor document for same-session content updates", () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        React.createElement(MarkdownEditor, {
          contentKey: "thought-1",
          content: "Initial",
        }),
      );
    });

    expect(setMilkdownMarkdown).not.toHaveBeenCalled();

    currentEditorMarkdown = "Local typing";
    act(() => {
      root?.render(
        React.createElement(MarkdownEditor, {
          contentKey: "thought-1",
          content: "Server formatted local typing",
        }),
      );
    });

    expect(setMilkdownMarkdown).not.toHaveBeenCalled();

    act(() => {
      root?.render(
        React.createElement(MarkdownEditor, {
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
});
