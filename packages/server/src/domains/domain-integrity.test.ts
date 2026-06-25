import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createDBInstance, type ReflectaDb } from "../db";
import { DomainCore } from "./domain/core";
import { ContextCore } from "./context/core";
import { UnderstandingCore } from "./understanding/core";

let tempDir: string;
let db: ReflectaDb;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "reflecta-domain-"));
  db = await createDBInstance(join(tempDir, "test.db"), { runMigrations: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("domain write integrity", () => {
  test("validates domain ids inside Understanding writes", async () => {
    const understandings = new UnderstandingCore(db);

    await expect(
      understandings._createUnderstanding({ body: "body", domainIds: ["missing-domain"] }),
    ).rejects.toThrow("Domain not found: missing-domain");
  });

  test("validates Domain parents inside Domain writes", async () => {
    const domains = new DomainCore(db);
    const parent = await domains.createDomain({ name: "Parent" });
    const child = await domains.createDomain({ name: "Child", parentId: parent.id });

    await expect(domains.createDomain({ name: "Bad", parentId: "missing" })).rejects.toThrow(
      "Domain not found: missing",
    );
    await expect(domains.updateDomain(parent.id, { parentId: child.id })).rejects.toThrow(
      "Domain cannot be moved under its descendant",
    );
  });

  test("validates Domain parents inside reorder writes", async () => {
    const domains = new DomainCore(db);
    const parent = await domains.createDomain({ name: "Parent" });
    const child = await domains.createDomain({ name: "Child", parentId: parent.id });

    await expect(
      domains.reorderDomains([{ id: parent.id, parentId: child.id, sortOrder: 0 }]),
    ).rejects.toThrow("Domain cannot be moved under its descendant");
    await expect(
      domains.reorderDomains([{ id: child.id, parentId: "missing", sortOrder: 0 }]),
    ).rejects.toThrow("Domain not found: missing");
  });

  test("validates Context targets inside Context writes", async () => {
    const contexts = new ContextCore(db);

    await expect(
      contexts._createContext({
        understandingId: "missing-understanding",
        medium: "ai",
        content: "content",
      }),
    ).rejects.toThrow("Understanding not found: missing-understanding");
    await expect(contexts._updateContext("missing-context", {})).rejects.toThrow(
      "No context fields to update",
    );
  });
});
