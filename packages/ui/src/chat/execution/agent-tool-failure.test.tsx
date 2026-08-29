// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { AgentToolFailure } from "./agent-tool-failure";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

describe("AgentToolFailure", () => {
  test("shows the tool name and a truncated reason", () => {
    act(() =>
      root.render(
        <AgentToolFailure
          toolLabel="展示画布视图"
          reason='Unknown edge ref: standing", "understandingId": "abc"'
          testId="tool-fail"
        />,
      ),
    );
    const box = container.querySelector('[data-testid="tool-fail"]');
    expect(box?.className).toContain("w-full");
    expect(box?.textContent).toContain("调用展示画布视图失败");
    expect(box?.textContent).toContain("Unknown edge ref: standing");
    expect(box?.querySelector("span")?.className).toContain("truncate");
  });

  test("expands the reason on click", () => {
    act(() =>
      root.render(
        <AgentToolFailure toolLabel="展示画布视图" reason={"Unknown edge ref: standing"} />,
      ),
    );
    const button = container.querySelector("button");
    expect(button?.getAttribute("aria-expanded")).toBe("false");
    act(() => button?.click());
    expect(button?.getAttribute("aria-expanded")).toBe("true");
    expect(button?.querySelector("span")?.className).toContain("whitespace-pre-wrap");
  });
});
