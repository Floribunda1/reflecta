// @vitest-environment happy-dom

import { describe, expect, test } from "vitest";
import { canvasQueryKeys } from "./queries";

describe("canvas query keys", () => {
  test("列表 key 与 capture 参与概览共用（同一数据源，进页不拉两次）", () => {
    // capture queries.ts 中 `canvases: ["understandingCanvas.listCanvases"]`
    expect(canvasQueryKeys.list).toEqual(["understandingCanvas.listCanvases"]);
  });

  test("detail key 按画布 id 区分", () => {
    expect(canvasQueryKeys.detail("canvas-1")).toEqual([
      "understandingCanvas.getCanvas",
      "canvas-1",
    ]);
    expect(canvasQueryKeys.detail("canvas-2")).not.toEqual(canvasQueryKeys.detail("canvas-1"));
  });
});
