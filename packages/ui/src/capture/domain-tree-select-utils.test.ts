import { describe, expect, test } from "vitest";
import type { DomainTreeNodeView } from "./domain-tree";
import {
  excludeDomainTreeSelectNodes,
  flattenDomainTreeSelectNodes,
  toDomainTreeSelectNodes,
} from "./domain-tree-select-utils";

const domains = [
  {
    id: "work",
    name: "Work",
    children: [
      {
        id: "project",
        name: "Project",
        children: [{ id: "meeting", name: "Meeting", children: [] }],
      },
    ],
  },
  { id: "life", name: "Life", children: [] },
] satisfies DomainTreeNodeView[];

describe("domain tree select options", () => {
  test("keeps a stable path label for each nested domain", () => {
    const nodes = toDomainTreeSelectNodes(domains);

    expect(flattenDomainTreeSelectNodes(nodes).map((node) => node.pathLabel)).toEqual([
      "Work",
      "Work > Project",
      "Work > Project > Meeting",
      "Life",
    ]);
  });

  test("excluding a parent also removes descendants from selection", () => {
    const filtered = excludeDomainTreeSelectNodes(
      toDomainTreeSelectNodes(domains),
      new Set(["project"]),
    );

    expect(flattenDomainTreeSelectNodes(filtered).map((node) => node.id)).toEqual(["work", "life"]);
  });
});
