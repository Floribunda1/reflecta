// @vitest-environment happy-dom

import { describe, expect, test } from "vitest";
import {
  ALL_MARKDOWN_FIXTURE,
  formatPastedMediaMarkdown,
  normalizeAdmonitionType,
  renderMarkdownToHtml,
} from "./markdown-support";
import fooMarkdown from "../foo.md?raw";

function compact(value: string): string {
  return value.replaceAll(/\s+/g, " ");
}

describe("markdown support", () => {
  test("renders the all-markdown fixture with project-specific blocks", () => {
    const html = renderMarkdownToHtml(ALL_MARKDOWN_FIXTURE);
    const normalized = compact(html);

    expect(normalized).toContain("<table>");
    expect(normalized).toContain('type="checkbox"');
    expect(normalized).toContain('data-wiki-link="thought-1"');
    expect(normalized).toContain('class="reflecta-admonition"');
    expect(normalized).toContain('data-type="warning"');
    expect(normalized).toContain('class="reflecta-mermaid"');
    expect(normalized).toContain("<video");
    expect(normalized).toContain('src="asset:///demo-video.mp4"');
  });

  test("renders every markdown feature in foo.md", () => {
    const html = renderMarkdownToHtml(fooMarkdown);
    const normalized = compact(html);

    expect(normalized).toContain("<h1>H1 一级标题</h1>");
    expect(normalized).toContain("<del>删除线文字</del>");
    expect(normalized).toContain('type="checkbox"');
    expect(normalized).toContain("<table>");
    expect(normalized).toContain("<details>");
    expect(normalized).toContain("<mark>高亮文字");
    expect(normalized).toContain("<kbd>Ctrl</kbd>");
    expect(normalized).toContain("<sup>上标文字</sup>");
    expect(normalized).toContain('data-footnote-ref');
    expect(normalized).toContain("<dl>");
    expect(normalized).toContain("<dt>Markdown</dt>");
    expect(normalized).toContain("<dd>一种轻量级标记语言</dd>");
    expect(normalized).toContain('class="katex"');
    expect(normalized).toContain('class="katex-display"');
  });

  test("renders id-backed wiki links as clickable anchors", () => {
    const html = renderMarkdownToHtml("Connect [[Alpha#thought-1]] now.");

    expect(html).toContain('data-wiki-link="thought-1"');
    expect(html).toContain("wiki-link");
    expect(html).toContain(">Alpha<");
  });

  test("renders admonition directives with nested markdown content", () => {
    const html = renderMarkdownToHtml(`:::danger
Check the **risk**.

- nested item
:::`)

    expect(html).toContain('data-admonition');
    expect(html).toContain('data-type="danger"');
    expect(html).toContain("<strong>risk</strong>");
    expect(html).toContain("<li>nested item</li>");
  });

  test("normalizes unknown admonition types to note", () => {
    expect(normalizeAdmonitionType("WARNING")).toBe("warning");
    expect(normalizeAdmonitionType("custom value")).toBe("note");
    expect(normalizeAdmonitionType("")).toBe("note");
  });

  test("formats pasted asset markdown for images and videos", () => {
    expect(
      formatPastedMediaMarkdown({
        filename: "capture.png",
        assetUrl: "asset:///asset-1.png",
        mimeType: "image/png",
      }),
    ).toBe("![capture.png](asset:///asset-1.png)");

    expect(
      formatPastedMediaMarkdown({
        filename: "clip.mp4",
        assetUrl: "asset:///asset-2.mp4",
        mimeType: "video/mp4",
      }),
    ).toBe('<video src="asset:///asset-2.mp4" controls title="clip.mp4"></video>');
  });
});
