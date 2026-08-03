// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

const theme = vi.hoisted(() => ({ resolved: "light", mermaidMounts: 0 }));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: theme.resolved }),
}));

vi.mock("streamdown", async () => {
  const React = await import("react");
  return {
    defaultUrlTransform: (url: string) => url,
    Streamdown: ({ children }: { children: React.ReactNode }) => {
      React.useEffect(() => {
        theme.mermaidMounts += 1;
      }, []);
      return React.createElement("div", null, children);
    },
  };
});

const { ChatMarkdown } = await import("./chat-markdown");

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  theme.resolved = "light";
  theme.mermaidMounts = 0;
});

describe("ChatMarkdown", () => {
  test("rerenders Mermaid when the resolved system theme changes", () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(<ChatMarkdown value={"```mermaid\nflowchart LR\nA --> B\n```"} />));
    expect(theme.mermaidMounts).toBe(1);

    theme.resolved = "dark";
    act(() => root?.render(<ChatMarkdown value={"```mermaid\nflowchart LR\nA --> B\n```"} />));

    expect(theme.mermaidMounts).toBe(2);
  });
});
