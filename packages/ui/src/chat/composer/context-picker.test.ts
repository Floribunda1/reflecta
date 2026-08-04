import { describe, expect, test } from "vitest";
import {
  filterChatComposerSkills,
  isLeadingSkillTrigger,
  nextContextPickerIndex,
} from "./context-picker";

describe("nextContextPickerIndex", () => {
  test("moves through candidates with wrapping", () => {
    expect(nextContextPickerIndex(0, 3, 1)).toBe(1);
    expect(nextContextPickerIndex(2, 3, 1)).toBe(0);
    expect(nextContextPickerIndex(0, 3, -1)).toBe(2);
  });

  test("keeps empty lists at zero", () => {
    expect(nextContextPickerIndex(4, 0, 1)).toBe(0);
  });
});

describe("filterChatComposerSkills", () => {
  test("matches skill names and descriptions without changing the empty-query list", () => {
    const skills = [
      { name: "explain-note", description: "Explain a note clearly" },
      { name: "release-check", description: "检查版本发布" },
    ];

    expect(filterChatComposerSkills(skills, "")).toBe(skills);
    expect(filterChatComposerSkills(skills, "NOTE")).toEqual([skills[0]]);
    expect(filterChatComposerSkills(skills, "版本")).toEqual([skills[1]]);
  });
});

test("opens the $ picker only for the first non-whitespace token", () => {
  expect(isLeadingSkillTrigger("  \n")).toBe(true);
  expect(isLeadingSkillTrigger("已有内容 ")).toBe(false);
});
