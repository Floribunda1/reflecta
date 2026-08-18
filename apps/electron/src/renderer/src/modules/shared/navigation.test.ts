// @vitest-environment happy-dom

import { describe, expect, test } from "vitest";
import { parseCanvasEntryParams } from "./navigation";

describe("parseCanvasEntryParams", () => {
  test("无参数时返回 null", () => {
    expect(parseCanvasEntryParams(new URLSearchParams("")).canvasId).toBeNull();
    expect(parseCanvasEntryParams(new URLSearchParams("?from=capture")).canvasId).toBeNull();
  });

  test("带 canvas 参数时返回对应 id", () => {
    expect(parseCanvasEntryParams(new URLSearchParams("?canvas=canvas-1")).canvasId).toBe(
      "canvas-1",
    );
    expect(parseCanvasEntryParams(new URLSearchParams("?from=capture&canvas=abc")).canvasId).toBe(
      "abc",
    );
  });

  test("空值 / 纯空白归一为 null", () => {
    expect(parseCanvasEntryParams(new URLSearchParams("?canvas=")).canvasId).toBeNull();
    expect(parseCanvasEntryParams(new URLSearchParams("?canvas=%20%20")).canvasId).toBeNull();
  });

  test("URL 编码 id 正确解码", () => {
    expect(parseCanvasEntryParams(new URLSearchParams("?canvas=a%2Fb")).canvasId).toBe("a/b");
  });
});
