import { describe, expect, test } from "vitest";
import {
  mergeEntityPresentations,
  presentationsFromUnderstandings,
  remoteEntityReferences,
} from "./card-entity-presentations";

const understanding = {
  id: "u-1",
  title: "灌溉策略",
  body: "见 [[u:u-1]] 和 [[c:c-1]]",
  domainIds: [],
  contextCount: 0,
  mentionCount: 1,
  mentionIds: ["u-1"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("card entity presentations", () => {
  test("resolves understanding titles from the already-loaded list", () => {
    const local = presentationsFromUnderstandings([understanding]);
    expect(local.get("understanding:u-1")).toEqual({
      state: "ready",
      label: "灌溉策略",
      canOpen: true,
    });
  });

  test("only remote-fetches references missing from the list", () => {
    const local = presentationsFromUnderstandings([understanding]);
    const remote = remoteEntityReferences(
      [
        { type: "understanding", id: "u-1" },
        { type: "context", id: "c-1" },
      ],
      local,
    );
    expect(remote).toEqual([{ type: "context", id: "c-1" }]);
  });

  test("merges remote titles once, without dropping local entries", () => {
    const local = presentationsFromUnderstandings([understanding]);
    const merged = mergeEntityPresentations(
      local,
      [{ type: "context", id: "c-1" }],
      [{ title: "回水记录" }],
    );
    expect(merged.get("understanding:u-1")?.label).toBe("灌溉策略");
    expect(merged.get("context:c-1")).toEqual({
      state: "ready",
      label: "回水记录",
      canOpen: true,
    });
  });
});
