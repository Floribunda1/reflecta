import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createDBInstance, type ReflectaDb } from "../db";
import { CategoryCore } from "./category/core";
import { ContextCore } from "./context/core";
import { ThoughtCore } from "./thought/core";

let tempDir: string;
let db: ReflectaDb;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "reflecta-domain-"));
  db = await createDBInstance(join(tempDir, "test.db"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("domain write integrity", () => {
  test("validates category ids inside Thought writes", async () => {
    const thoughts = new ThoughtCore(db);

    await expect(
      thoughts._createThought({ body: "body", categoryIds: ["missing-category"] }),
    ).rejects.toThrow("Category not found: missing-category");
  });

  test("validates Category parents inside Category writes", async () => {
    const categories = new CategoryCore(db);
    const parent = await categories.createCategory({ name: "Parent" });
    const child = await categories.createCategory({ name: "Child", parentId: parent.id });

    await expect(categories.createCategory({ name: "Bad", parentId: "missing" })).rejects.toThrow(
      "Category not found: missing",
    );
    await expect(categories.updateCategory(parent.id, { parentId: child.id })).rejects.toThrow(
      "Category cannot be moved under its descendant",
    );
  });

  test("validates Context targets inside Context writes", async () => {
    const contexts = new ContextCore(db);

    await expect(
      contexts._createContext({
        thoughtId: "missing-thought",
        sourceType: "ai",
        content: "content",
      }),
    ).rejects.toThrow("Thought not found: missing-thought");
    await expect(contexts._updateContext("missing-context", {})).rejects.toThrow(
      "No context fields to update",
    );
  });
});
