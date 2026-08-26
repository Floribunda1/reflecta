import { describe, expect, test } from "vitest";
import { PI_ACTIVITY_TOOL_NAMES, PI_PLAIN_TOOL_NAMES } from "@reflecta/shared";
import { TOOL_BUCKET, TOOL_ICON_KIND } from "./execution/activity-presentation";
import { completedTools } from "./tool-fixtures";

/**
 * UI 与 Storybook 同源约束：shared 的工具面清单是唯一真源，以下单向完整性校验保证——
 * 加新工具后若 UI 分类 / Storybook fixture 未跟上即红灯。
 * 契约分层：approval（proposal UI）与交付类（image/canvas_present 独立消息块）不进 activity group。
 */
describe("tool surface 同源完整性", () => {
  test("每个 activity 工具都有图标映射", () => {
    const iconKeys = new Set(Object.keys(TOOL_ICON_KIND));
    for (const name of PI_ACTIVITY_TOOL_NAMES) {
      expect(iconKeys.has(name), `缺少图标映射：${name}`).toBe(true);
    }
  });

  test("每个 activity 工具都有明确的摘要桶（不落 other 兜底）", () => {
    for (const name of PI_ACTIVITY_TOOL_NAMES) {
      expect(TOOL_BUCKET[name], `缺少摘要桶：${name}`).toBeDefined();
      expect(TOOL_BUCKET[name], `摘要桶落到 other：${name}`).not.toBe("other");
    }
  });

  test("每个 activity 工具在 Storybook fixtures 里都有完成态样本", () => {
    const fixtureNames = new Set(completedTools.map((block) => block.toolName));
    for (const name of PI_ACTIVITY_TOOL_NAMES) {
      expect(fixtureNames.has(name), `缺少 Storybook fixture：${name}`).toBe(true);
    }
  });

  test("交付类工具（image/canvas_present）不进入 activity group 的图标与摘要桶", () => {
    for (const name of PI_PLAIN_TOOL_NAMES) {
      if (name === "image_generate" || name === "canvas_present") {
        expect(TOOL_ICON_KIND[name], `交付工具不该有图标映射：${name}`).toBeUndefined();
        expect(TOOL_BUCKET[name], `交付工具不该有摘要桶：${name}`).toBeUndefined();
      }
    }
  });

  test("交付类工具不出现在 tool-activity fixtures 里（由独立消息块承载）", () => {
    const fixtureNames = new Set(completedTools.map((block) => block.toolName));
    expect(fixtureNames.has("image_generate")).toBe(false);
    expect(fixtureNames.has("canvas_present")).toBe(false);
  });
});
