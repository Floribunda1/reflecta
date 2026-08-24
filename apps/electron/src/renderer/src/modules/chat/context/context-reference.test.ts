import { describe, expect, test } from "vitest";
import { inspectorPanelRef } from "./context-reference";

describe("inspectorPanelRef", () => {
  test("keeps understanding and context on the right panel", () => {
    expect(inspectorPanelRef({ type: "understanding", id: "u-1" })).toEqual({
      type: "understanding",
      id: "u-1",
    });
    expect(inspectorPanelRef({ type: "context", id: "c-1" })).toEqual({
      type: "context",
      id: "c-1",
    });
  });

  test("does not open the right panel for canvas", () => {
    expect(inspectorPanelRef({ type: "canvas", id: "cv-1", title: "RO" })).toBeNull();
    expect(inspectorPanelRef(null)).toBeNull();
  });
});
