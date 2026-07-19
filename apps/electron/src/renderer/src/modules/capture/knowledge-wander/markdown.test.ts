import { describe, expect, it } from "vitest";
import { renderKnowledgeWanderMarkdown } from "./markdown";

describe("renderKnowledgeWanderMarkdown", () => {
  it("renders id-backed wiki links as highlighted static labels", () => {
    const html = renderKnowledgeWanderMarkdown(
      "## 判断\n\n- 参考 [[显式关系#understanding-1]]\n- 保留 **重点**",
    );

    expect(html).toContain("<h2>判断</h2>");
    expect(html).toContain("<strong>重点</strong>");
    expect(html).toContain(
      '<span class="knowledge-wander-markdown__wiki-link" data-wiki-link="understanding-1">显式关系</span>',
    );
    expect(html).not.toContain("[[");
  });

  it("renders regular GFM links without making the card contain nested interactions", () => {
    const html = renderKnowledgeWanderMarkdown(
      "## 判断\n\n- 保留 **重点**\n- 阅读 [原文](https://example.com)",
    );

    expect(html).toContain("<h2>判断</h2>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<strong>重点</strong>");
    expect(html).toContain('<span class="knowledge-wander-markdown__link">原文</span>');
    expect(html).not.toContain("<a");
  });
});
