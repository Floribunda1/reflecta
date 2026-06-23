import { describe, it, expect } from "vitest";
import { runCommand, parseJson } from "./helpers";

describe("全局行为", () => {
  describe("输出格式", () => {
    it("默认使用 JSONL 格式输出数组", async () => {
      const { code, stdout } = await runCommand(["domain", "list"]);
      expect(code).toBe(0);

      const lines = stdout.split("\n").filter((l) => l.trim());
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        const obj = JSON.parse(line);
        expect(obj).toHaveProperty("id");
        expect(obj).toHaveProperty("name");
      }
    });

    it("使用 --format json 输出单个 JSON 数组", async () => {
      const { code, stdout } = await runCommand(["domain", "list", "--format", "json"]);
      expect(code).toBe(0);

      const data = parseJson(stdout) as unknown[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it("单对象查询使用 --format json 输出对象而非数组", async () => {
      const { code, stdout } = await runCommand(["domain", "list", "--format", "json"]);
      expect(code).toBe(0);
      const arr = parseJson(stdout) as unknown[];
      const firstId = (arr[0] as { id: string }).id;

      const { stdout: stdout2 } = await runCommand(["domain", "get", firstId, "--format", "json"]);
      const data = parseJson(stdout2);
      expect(Array.isArray(data)).toBe(false);
      expect(data).toMatchObject({ id: firstId });
    });

    it("单对象查询使用 --format jsonl 输出单行", async () => {
      const { code, stdout } = await runCommand(["domain", "list", "--format", "json"]);
      expect(code).toBe(0);
      const arr = parseJson(stdout) as unknown[];
      const firstId = (arr[0] as { id: string }).id;

      const { stdout: stdout2 } = await runCommand(["domain", "get", firstId, "--format", "jsonl"]);
      const lines = stdout2.split("\n").filter((l) => l.trim());
      expect(lines.length).toBe(1);
      expect(JSON.parse(lines[0])).toMatchObject({ id: firstId });
    });
  });

  describe("修改确认", () => {
    it("修改命令未加 --yes 时拒绝执行", async () => {
      const { code, stdout } = await runCommand(["domain", "list", "--format", "json"]);
      expect(code).toBe(0);
      const arr = parseJson(stdout) as unknown[];
      const catId = (arr[0] as { id: string }).id;

      const { code: code2, stderr: stderr2 } = await runCommand(["domain", "delete", catId]);
      expect(code2).toBe(3);
      const err = JSON.parse(stderr2);
      expect(err.code).toBe("CONFIRMATION_REQUIRED");
    });

    it("修改命令加 --yes 后正常执行", async () => {
      const { stdout } = await runCommand(["domain", "list", "--format", "json"]);
      const arr = parseJson(stdout) as unknown[];
      const catId = (arr[0] as { id: string }).id;

      const { code } = await runCommand(["domain", "delete", catId, "--yes"]);
      expect(code).toBe(0);
    });
  });

  describe("静默模式", () => {
    it("--quiet 抑制标准输出", async () => {
      const { code, stdout } = await runCommand(["domain", "list", "--quiet"]);
      expect(code).toBe(0);
      expect(stdout).toBe("");
    });

    it("--quiet 模式下错误仍然输出到标准错误", async () => {
      const { code, stdout, stderr } = await runCommand([
        "understanding",
        "get",
        "nonexistent-id-12345",
        "--quiet",
      ]);
      expect(code).toBe(1);
      expect(stdout).toBe("");
      const err = JSON.parse(stderr);
      expect(err.code).toBe("NOT_FOUND");
    });
  });

  describe("参数校验", () => {
    it("整数选项传入非数字值时报错", async () => {
      const { code, stderr } = await runCommand([
        "understanding",
        "list",
        "--limit",
        "not-a-number",
      ]);
      expect(code).toBe(2);
      const err = JSON.parse(stderr);
      expect(err.code).toBe("VALIDATION_ERROR");
    });

    it("缺少子命令时报错", async () => {
      const { code, stderr } = await runCommand(["understanding"]);
      expect(code).toBe(2);
      const err = JSON.parse(stderr);
      expect(err.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("帮助系统", () => {
    it("顶层帮助输出命令分组", async () => {
      const { code, stdout } = await runCommand(["--help"]);
      expect(code).toBe(0);
      expect(stdout).toContain("Usage: reflecta <resource> <action> [args] [options]");
      expect(stdout).toContain("Resources:");
      expect(stdout).toContain("Commands:");
      expect(stdout).toContain("Global Options:");
    });

    it("嵌套帮助输出子命令列表", async () => {
      const { code, stdout } = await runCommand(["understanding", "--help"]);
      expect(code).toBe(0);
      expect(stdout).toContain("Usage: reflecta understanding <action> [args] [options]");
      expect(stdout).toContain("Actions:");
      expect(stdout).toContain("list");
      expect(stdout).toContain("Global Options:");
    });
  });
});
