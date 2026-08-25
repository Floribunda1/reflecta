// @vitest-environment happy-dom
import { afterEach, expect, test } from "vitest";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SimpleMarkdownPreview, type SimpleMarkdownPreviewProps } from "./simple-markdown-preview";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

function render(node: ReactNode): HTMLDivElement {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(node));
  return container;
}

function htmlOf(value: string, resolveWikiLink?: SimpleMarkdownPreviewProps["resolveWikiLink"]) {
  const next = render(<SimpleMarkdownPreview value={value} resolveWikiLink={resolveWikiLink} />);
  return next.querySelector(".markdown-preview-compact")?.innerHTML ?? "";
}

test("renders refs as icon + label spans", () => {
  const html = htmlOf("见 [[u:abc-1]]", (reference) =>
    reference.id === "abc-1" ? { state: "ready", label: "标题A", canOpen: true } : undefined,
  );
  expect(html).toContain("<svg");
  expect(html).toContain("标题A");
});

test("supports [[cv:id]] canvas refs", () => {
  const html = htmlOf("画布 [[cv:canvas-1]]");
  expect(html).toContain("<svg");
  expect(html).toContain("canvas-1");
});

test("keeps refs inside fenced code blocks literal", () => {
  const html = htmlOf("```ts\nconst r = '[[u:in-code]]'\n```");
  expect(html).toContain("<code");
  expect(html).toContain("[[u:in-code]]");
  expect(html.match(/<svg/g) ?? []).toHaveLength(0);
});

test("keeps refs inside inline code literal", () => {
  const html = htmlOf("`[[u:inline]]`");
  expect(html).toContain("[[u:inline]]");
  expect(html.match(/<svg/g) ?? []).toHaveLength(0);
});

test("keeps refs inside Markdown link labels literal", () => {
  const html = htmlOf("[label [[u:lbl]]](https://example.test)");
  expect(html).toContain("[[u:lbl]]");
  expect(html.match(/<svg/g) ?? []).toHaveLength(0);
});

test("escaped refs still render as links (editor/compact policy, done deliberately)", () => {
  const html = htmlOf(String.raw`\[[u:escaped]]`);
  expect(html).toContain("<svg");
});

test("does not double-escape HTML entities in surrounding text", () => {
  const html = htmlOf("A &amp; B [[u:x]]");
  expect(html).toContain("&amp;");
  expect(html.match(/&amp;amp;/g) ?? []).toHaveLength(0);
});
