import { describe, expect, test } from "vitest";
import type { DomainTreeNode } from "@shared/domain";
import { buildDomainParentLookup, buildSiblingDomainReorderItems } from "./reorder";

const domains = [
  {
    id: "programming",
    name: "Programming",
    parentId: null,
    sortOrder: 0,
    children: [
      { id: "frontend", name: "Frontend", parentId: "programming", sortOrder: 0, children: [] },
      { id: "backend", name: "Backend", parentId: "programming", sortOrder: 1, children: [] },
      { id: "devops", name: "DevOps", parentId: "programming", sortOrder: 2, children: [] },
    ],
  },
  { id: "design", name: "Design", parentId: null, sortOrder: 1, children: [] },
] satisfies DomainTreeNode[];

describe("domain tree reorder", () => {
  test("builds a reorder payload for siblings", () => {
    expect(buildSiblingDomainReorderItems(domains, "backend", "frontend")).toEqual([
      { id: "backend", parentId: "programming", sortOrder: 0 },
      { id: "frontend", parentId: "programming", sortOrder: 1 },
      { id: "devops", parentId: "programming", sortOrder: 2 },
    ]);
  });

  test("ignores cross-parent drops", () => {
    expect(buildSiblingDomainReorderItems(domains, "backend", "design")).toEqual([]);
  });

  test("tracks parent ids for nested drag collision filtering", () => {
    expect(Object.fromEntries(buildDomainParentLookup(domains))).toEqual({
      programming: null,
      frontend: "programming",
      backend: "programming",
      devops: "programming",
      design: null,
    });
  });
});
