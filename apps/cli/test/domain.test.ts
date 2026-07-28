import { describe, it, expect } from "vitest";
import { runCommand, parseJsonl, parseJson, getDomainId } from "./helpers";

describe("Domain 管理", () => {
  describe("domain list", () => {
    it("列出所有 Domain", async () => {
      const { code, stdout } = await runCommand(["domain", "list"]);
      expect(code).toBe(0);
      const domains = parseJsonl(stdout);
      expect(domains.length).toBeGreaterThan(0);
      for (const c of domains) {
        expect(c).toMatchObject({ id: expect.any(String), name: expect.any(String) });
      }
    });
  });

  describe("domain inspect", () => {
    it("检查包含 Understanding 的 Domain", async () => {
      const catId = getDomainId("Programming");
      expect(catId).toBeDefined();
      const { code, stdout } = await runCommand(["domain", "inspect", catId!]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as {
        domain: unknown;
        domains: unknown[];
        understandings: unknown[];
        page: { hasMore: boolean };
      };
      expect(data.domain).toBeDefined();
      expect(Array.isArray(data.domains)).toBe(true);
      expect(Array.isArray(data.understandings)).toBe(true);
      expect(data.page.hasMore).toBe(false);
    });

    it("检查时使用分页限制", async () => {
      const catId = getDomainId("Programming");
      expect(catId).toBeDefined();
      const { code, stdout } = await runCommand(["domain", "inspect", catId!, "--limit", "2"]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { understandings: unknown[]; page: { hasMore: boolean } };
      expect(data.understandings.length).toBeLessThanOrEqual(2);
    });

    it("检查不存在的 Domain", async () => {
      const { code, stderr } = await runCommand(["domain", "inspect", "nonexistent-id-12345"]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("NOT_FOUND");
    });
  });

  describe("domain create", () => {
    it("创建根 Domain", async () => {
      const { code, stdout } = await runCommand([
        "domain",
        "create",
        "--name",
        "Test Root",
        "--yes",
      ]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { id: string; name: string; parentId: string | null };
      expect(data.name).toBe("Test Root");
      expect(data.parentId).toBeNull();
    });

    it("创建子 Domain", async () => {
      const parentId = getDomainId("Programming");
      expect(parentId).toBeDefined();
      const { code, stdout } = await runCommand([
        "domain",
        "create",
        "--name",
        "Test Child",
        "--parent-id",
        parentId!,
        "--yes",
      ]);
      expect(code).toBe(0);
      const data = parseJson(stdout) as { id: string; name: string; parentId: string };
      expect(data.name).toBe("Test Child");
      expect(data.parentId).toBe(parentId);
    });

    it("缺少必填参数 --name", async () => {
      const { code, stderr } = await runCommand(["domain", "create", "--yes"]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("VALIDATION_ERROR");
    });

    it("未加 --yes 时拒绝创建", async () => {
      const { code } = await runCommand(["domain", "create", "--name", "X"]);
      expect(code).toBe(3);
    });
  });

  describe("domain update", () => {
    it("重命名子 Domain 时保留原来的父级", async () => {
      const parentId = getDomainId("Programming");
      expect(parentId).toBeDefined();
      const { stdout: createOut } = await runCommand([
        "domain",
        "create",
        "--name",
        "Rename Me",
        "--parent-id",
        parentId!,
        "--yes",
      ]);
      const catId = (parseJson(createOut) as { id: string }).id;
      const { code, stdout } = await runCommand([
        "domain",
        "update",
        catId,
        "--name",
        "Renamed",
        "--yes",
      ]);
      expect(code).toBe(0);
      expect(parseJson(stdout)).toMatchObject({ name: "Renamed", parentId });
    });

    it("移动 Domain 到新的父节点", async () => {
      const parentId = getDomainId("Design");
      expect(parentId).toBeDefined();
      const { stdout: createOut } = await runCommand([
        "domain",
        "create",
        "--name",
        "Move Me",
        "--yes",
      ]);
      const catId = (parseJson(createOut) as { id: string }).id;
      const { code, stdout } = await runCommand([
        "domain",
        "update",
        catId,
        "--parent-id",
        parentId!,
        "--yes",
      ]);
      expect(code).toBe(0);
      expect((parseJson(stdout) as { parentId: string }).parentId).toBe(parentId);
    });

    it("将 Domain 移动到根节点", async () => {
      const parentId = getDomainId("Programming");
      const { stdout: createOut } = await runCommand([
        "domain",
        "create",
        "--name",
        "Move To Root",
        "--parent-id",
        parentId!,
        "--yes",
      ]);
      const domainId = (parseJson(createOut) as { id: string }).id;
      const { code, stdout } = await runCommand([
        "domain",
        "update",
        domainId,
        "--parent-id",
        "",
        "--yes",
      ]);

      expect(code).toBe(0);
      expect((parseJson(stdout) as { parentId: string | null }).parentId).toBeNull();
    });

    it("更新不存在的 Domain", async () => {
      const { code, stderr } = await runCommand([
        "domain",
        "update",
        "nonexistent-id-12345",
        "--name",
        "X",
        "--yes",
      ]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("NOT_FOUND");
    });

    it("防止把父 Domain 移动到自己的后代下面", async () => {
      const parent = parseJson(
        (await runCommand(["domain", "create", "--name", "Cycle Parent", "--yes"])).stdout,
      ) as { id: string };
      const child = parseJson(
        (
          await runCommand([
            "domain",
            "create",
            "--name",
            "Cycle Child",
            "--parent-id",
            parent.id,
            "--yes",
          ])
        ).stdout,
      ) as { id: string };

      const { code, stderr } = await runCommand([
        "domain",
        "update",
        parent.id,
        "--parent-id",
        child.id,
        "--yes",
      ]);

      expect(code).toBe(1);
      expect(JSON.parse(stderr)).toMatchObject({
        code: "VALIDATION_ERROR",
        message: "Domain cannot be moved under its descendant",
      });
      const domains = parseJsonl((await runCommand(["domain", "list"])).stdout) as Array<{
        id: string;
        parentId: string | null;
      }>;
      expect(domains.find(({ id }) => id === parent.id)?.parentId).toBeNull();
      expect(domains.find(({ id }) => id === child.id)?.parentId).toBe(parent.id);
    });
  });

  describe("domain delete", () => {
    it("不使用级联删除 Domain 时保留关联的 Understanding", async () => {
      const { stdout: createOut } = await runCommand([
        "domain",
        "create",
        "--name",
        "Delete Me",
        "--yes",
      ]);
      const catId = (parseJson(createOut) as { id: string }).id;
      const { stdout: understandingOut } = await runCommand([
        "understanding",
        "create",
        "--title",
        "Keep After Domain Delete",
        "--domain-id",
        catId,
        "--yes",
      ]);
      const understandingId = (parseJson(understandingOut) as { id: string }).id;
      const { code } = await runCommand(["domain", "delete", catId, "--yes"]);
      expect(code).toBe(0);

      const domains = parseJsonl((await runCommand(["domain", "list"])).stdout) as Array<{
        id: string;
      }>;
      expect(domains.map((domain) => domain.id)).not.toContain(catId);
      const understanding = parseJson(
        (await runCommand(["understanding", "get", understandingId])).stdout,
      ) as { domains: unknown[] };
      expect(understanding.domains).toEqual([]);
    });

    it("使用级联删除 Domain", async () => {
      const { stdout: catOut } = await runCommand([
        "domain",
        "create",
        "--name",
        "Cascade Cat",
        "--yes",
      ]);
      const catId = (parseJson(catOut) as { id: string }).id;
      const { stdout: thOut } = await runCommand([
        "understanding",
        "create",
        "--title",
        "Cascade Understanding",
        "--domain-id",
        catId,
        "--yes",
      ]);
      const understandingId = (parseJson(thOut) as { id: string }).id;
      const { code } = await runCommand(["domain", "delete", catId, "--yes", "--cascade"]);
      expect(code).toBe(0);
      const getResult = await runCommand(["understanding", "get", understandingId]);
      expect(getResult.code).toBe(1);
      expect(JSON.parse(getResult.stderr).code).toBe("NOT_FOUND");
    });

    it("删除不存在的 Domain", async () => {
      const { code, stderr } = await runCommand([
        "domain",
        "delete",
        "nonexistent-id-12345",
        "--yes",
      ]);
      expect(code).toBe(1);
      expect(JSON.parse(stderr).code).toBe("NOT_FOUND");
    });
  });
});
