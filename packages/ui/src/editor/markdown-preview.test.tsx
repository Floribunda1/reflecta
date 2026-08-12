// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test } from "vitest";
import { SimpleMarkdownPreview } from "./markdown-preview";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

function render(value: string, lineClamp?: number) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<SimpleMarkdownPreview value={value} lineClamp={lineClamp} />));
  return container;
}

describe("SimpleMarkdownPreview", () => {
  test("renders compact Markdown with typed entity references", () => {
    const preview = render(
      "# Heading\n\nConnect **Alpha** to [[c:context-1]] and [source](https://example.com).\n\n- checked\n\n> note\n\n- [x] done\n\n![diagram](asset:///diagram.png)",
    );

    expect(preview.querySelector("h1")?.textContent).toBe("Heading");
    expect(preview.querySelector("strong")?.textContent).toBe("Alpha");
    expect(preview.querySelector("ul")).not.toBeNull();
    expect(preview.querySelector("blockquote")?.textContent).toContain("note");
    expect(preview.textContent).toContain("context-1");
    expect(preview.querySelector("svg")).not.toBeNull();
    expect(preview.textContent).toContain("diagram");
    expect(preview.querySelector("a")).toBeNull();
    expect(preview.querySelector("input")).toBeNull();
    expect(preview.querySelector("img")).toBeNull();
  });

  test("clips the rendered preview to the configured line height", () => {
    const preview = render("one\n\ntwo\n\nthree", 2).firstElementChild as HTMLElement;

    // 12px 字体 + 20px 行高（text-body-small + leading-5）→ 每行 1.25rem
    expect(preview.style.maxHeight).toBe("2.5rem");
    expect(preview.style.overflow).toBe("hidden");
  });
});
