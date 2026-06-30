import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createDBInstance, type ReflectaDb } from "../db";
import { DomainCliBff } from "./domain/bff-cli";

let tempDir: string;
let db: ReflectaDb;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "reflecta-domain-cli-"));
  db = await createDBInstance(join(tempDir, "test.db"), { runMigrations: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("DomainCliBff", () => {
  test("inspectDomain returns only descendant domains", async () => {
    const domains = new DomainCliBff(db);
    const root = await domains.createDomainSummary({ name: "Root" });
    const sibling = await domains.createDomainSummary({ name: "Sibling" });
    const child = await domains.createDomainSummary({ name: "Child", parentId: root.id });
    const grandchild = await domains.createDomainSummary({
      name: "Grandchild",
      parentId: child.id,
    });

    const result = await domains.inspectDomain(root.id);
    const domainIds = result.domains.map((domain) => domain.id);

    expect(domainIds).toHaveLength(2);
    expect(domainIds).toEqual(expect.arrayContaining([child.id, grandchild.id]));
    expect(domainIds).not.toContain(sibling.id);
    expect(domainIds).not.toContain(root.id);
  });
});
