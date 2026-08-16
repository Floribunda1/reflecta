import { describe, it, expect } from "vitest";
import { runCommand, parseJson, parseJsonl, getUnderstandingId } from "./helpers";

describe("Canvas 管理", () => {
  describe("canvas create / list / get / search", () => {
    it("创建画布后可通过 list 找到（按 updatedAt 排序）", async () => {
      const created = await runCommand(["canvas", "create", "CLI 测试画布", "--yes"]);
      expect(created.code).toBe(0);
      const canvas = parseJson(created.stdout) as { id: string; title: string };
      expect(canvas.id).toBeDefined();
      expect(canvas.title).toBe("CLI 测试画布");

      const listed = await runCommand(["canvas", "list", "--title-keyword", "CLI 测试画布"]);
      expect(listed.code).toBe(0);
      const rows = parseJsonl(listed.stdout) as Array<{ id: string; title: string }>;
      expect(rows.some((row) => row.id === canvas.id)).toBe(true);
    });

    it("canvas get 默认返回骨架（引用理解无正文），--with-bodies 返回正文", async () => {
      const created = await runCommand(["canvas", "create", "骨架测试", "--yes"]);
      const canvas = parseJson(created.stdout) as { id: string };
      const understandingId = getUnderstandingId("React Server Components");
      expect(understandingId).toBeDefined();
      const doc = JSON.stringify({
        elements: [
          {
            id: "c1",
            kind: "understanding",
            understandingId,
            canvasRefId: null,
            parentId: null,
            x: 0,
            y: 0,
            width: 100,
            height: 60,
            zIndex: 0,
            props: {},
          },
        ],
        edges: [],
      });
      const written = await runCommand(["canvas", "update", canvas.id, "--document", doc, "--yes"]);
      expect(written.code).toBe(0);

      const skeleton = await runCommand(["canvas", "get", canvas.id]);
      expect(skeleton.code).toBe(0);
      const detail = parseJson(skeleton.stdout) as {
        elements: Array<{ id: string }>;
        understandingRefs: Array<{ body: string }>;
      };
      expect(detail.elements).toHaveLength(1);
      expect(detail.understandingRefs).toHaveLength(1);
      expect(detail.understandingRefs[0].body).toBe("");

      const full = await runCommand(["canvas", "get", canvas.id, "--with-bodies"]);
      const fullDetail = parseJson(full.stdout) as { understandingRefs: Array<{ body: string }> };
      expect(fullDetail.understandingRefs[0].body.length).toBeGreaterThan(0);
    });

    it("canvas search 按 query 命中画布标题", async () => {
      await runCommand(["canvas", "create", "搜索目标画布", "--yes"]);
      const { code, stdout } = await runCommand(["canvas", "search", "搜索目标"]);
      expect(code).toBe(0);
      const hits = parseJsonl(stdout) as Array<{ canvas: { title: string }; reason: string }>;
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.some((hit) => hit.canvas.title === "搜索目标画布")).toBe(true);
    });

    it("canvas update --title 改名", async () => {
      const created = await runCommand(["canvas", "create", "改名前的画布", "--yes"]);
      const canvas = parseJson(created.stdout) as { id: string };
      const updated = await runCommand([
        "canvas",
        "update",
        canvas.id,
        "--title",
        "改名后的画布",
        "--yes",
      ]);
      expect(updated.code).toBe(0);
      expect((parseJson(updated.stdout) as { title: string }).title).toBe("改名后的画布");
    });

    it("canvas delete 硬删除（级联）", async () => {
      const created = await runCommand(["canvas", "create", "待删除画布", "--yes"]);
      const canvas = parseJson(created.stdout) as { id: string };
      const deleted = await runCommand(["canvas", "delete", canvas.id, "--yes"]);
      expect(deleted.code).toBe(0);
      const after = await runCommand(["canvas", "get", canvas.id]);
      expect(after.code).not.toBe(0);
    });

    it("canvas update --document 拒绝非法 JSON", async () => {
      const created = await runCommand(["canvas", "create", "JSON 校验", "--yes"]);
      const canvas = parseJson(created.stdout) as { id: string };
      const bad = await runCommand([
        "canvas",
        "update",
        canvas.id,
        "--document",
        "{not-json",
        "--yes",
      ]);
      expect(bad.code).not.toBe(0);
    });
  });
});
