import { describe, expect, it } from "vitest";
import { makeInMemoryWire } from "./wire";

describe("ipc/wire: in-memory 线", () => {
  it("把 encoded 值发给 handler 并取回响应（结构化克隆）", async () => {
    const wire = makeInMemoryWire(async (payload) => {
      const obj = payload as { n: number };
      return { doubled: obj.n * 2 };
    });
    expect(await wire.invoke({ n: 21 })).toEqual({ doubled: 42 });
  });

  it("handler 抛错时 promise 拒绝（模拟主进程失败路径）", async () => {
    const wire = makeInMemoryWire(async () => {
      throw new Error("boom");
    });
    await expect(wire.invoke({})).rejects.toThrow("boom");
  });
});
