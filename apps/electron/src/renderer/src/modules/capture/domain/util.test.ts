import { describe, expect, test } from "vitest";
import type { DomainTreeNode } from "@shared/domain";
import { getDomainPath } from "./util";

describe("getDomainPath", () => {
  test("formats nested domains with a custom separator", () => {
    const domains = [
      {
        id: "programming",
        name: "programming",
        parentId: null,
        sortOrder: 0,
        children: [
          {
            id: "react",
            name: "react",
            parentId: "programming",
            sortOrder: 0,
            children: [],
          },
        ],
      },
    ] satisfies DomainTreeNode[];

    expect(getDomainPath("react", domains, "/")).toBe("programming/react");
  });
});
