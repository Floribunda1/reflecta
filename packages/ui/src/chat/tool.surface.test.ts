import { describe, expect, test } from "vitest";
import { PI_PLAIN_TOOL_NAMES } from "@reflecta/shared";
import { TOOL_BUCKET, TOOL_ICON_KIND } from "./execution/activity-presentation";
import { completedTools } from "./tool-fixtures";

/**
 * UI 与 Storybook 同源约束：shared 的 plain 工具面清单是唯一真源，
 * 以下单向完整性校验保证——加新工具后若 UI 分类 / Storybook fixture 未跟上即红灯。
 * （approval 工具不在此列：它们走 proposal UI，不渲染为 activity group。）
 */
describe("tool surface 同源完整性", () => {
  test("每个 plain 工具都有图标映射", () => {
    const iconKeys = new Set(Object.keys(TOOL_ICON_KIND));
    for (const name of PI_PLAIN_TOOL_NAMES) {
      expect(iconKeys.has(name), `缺少图标映射：${name}`).toBe(true);
    }
  });

  test("每个 plain 工具都有明确的摘要桶（不落 other 兜底）", () => {
    for (const name of PI_PLAIN_TOOL_NAMES) {
      expect(TOOL_BUCKET[name], `缺少摘要桶：${name}`).toBeDefined();
      expect(TOOL_BUCKET[name], `摘要桶落到 other：${name}`).not.toBe("other");
    }
  });

  test("每个 plain 工具在 Storybook fixtures 里都有完成态样本", () => {
    const fixtureNames = new Set(completedTools.map((block) => block.toolName));
    for (const name of PI_PLAIN_TOOL_NAMES) {
      expect(fixtureNames.has(name), `缺少 Storybook fixture：${name}`).toBe(true);
    }
  });
});
