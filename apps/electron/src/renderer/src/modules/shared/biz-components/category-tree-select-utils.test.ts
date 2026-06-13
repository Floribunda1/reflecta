import { describe, expect, test } from "vitest";
import type { CategoryTreeNode } from "@shared/category";
import {
  convertToTreeNodes,
  excludeTreeNodeKeys,
  flattenTreeNodes,
} from "./category-tree-select-utils";

const categories = [
  {
    id: "work",
    name: "Work",
    parentId: null,
    sortOrder: 0,
    children: [
      {
        id: "project",
        name: "Project",
        parentId: "work",
        sortOrder: 0,
        children: [
          {
            id: "meeting",
            name: "Meeting",
            parentId: "project",
            sortOrder: 0,
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: "life",
    name: "Life",
    parentId: null,
    sortOrder: 1,
    children: [],
  },
] satisfies CategoryTreeNode[];

describe("category tree select utils", () => {
  test("converts categories to tree select nodes with path labels", () => {
    const nodes = convertToTreeNodes(categories);

    expect(flattenTreeNodes(nodes).map((node) => node.pathLabel)).toEqual([
      "Work",
      "Work > Project",
      "Work > Project > Meeting",
      "Life",
    ]);
  });

  test("excludes a node and its descendants", () => {
    const filtered = excludeTreeNodeKeys(convertToTreeNodes(categories), new Set(["project"]));

    expect(flattenTreeNodes(filtered).map((node) => node.key)).toEqual(["work", "life"]);
  });
});
