import { describe, expect, it } from "vitest";
import { prepareKnowledgeWanderMarkdown, renderKnowledgeWanderMarkdown } from "./markdown";

describe("prepareKnowledgeWanderMarkdown", () => {
  it("keeps markdown structure while turning wiki links into readable labels", () => {
    expect(
      prepareKnowledgeWanderMarkdown(
        "## 判断\n\n- 参考 [[显式关系#understanding-1]] 与 [[旧关系]]\n- 保留 **重点**",
      ),
    ).toBe("## 判断\n\n- 参考 显式关系 与 旧关系\n- 保留 **重点**");
  });

  it("renders static GFM without interactive links", () => {
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
