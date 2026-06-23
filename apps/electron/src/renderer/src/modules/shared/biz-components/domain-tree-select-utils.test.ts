import { describe, expect, test } from "vitest";
import type { DomainTreeNode } from "@shared/domain";
import {
  convertToTreeNodes,
  excludeTreeNodeKeys,
  flattenTreeNodes,
} from "./domain-tree-select-utils";

const domains = [
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
] satisfies DomainTreeNode[];

describe("domain tree select utils", () => {
  test("converts domains to tree select nodes with path labels", () => {
    const nodes = convertToTreeNodes(domains);

    expect(flattenTreeNodes(nodes).map((node) => node.pathLabel)).toEqual([
      "Work",
      "Work > Project",
      "Work > Project > Meeting",
      "Life",
    ]);
  });

  test("excludes a node and its descendants", () => {
    const filtered = excludeTreeNodeKeys(convertToTreeNodes(domains), new Set(["project"]));

    expect(flattenTreeNodes(filtered).map((node) => node.key)).toEqual(["work", "life"]);
  });
});
