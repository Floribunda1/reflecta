import { Effect } from "effect";
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
  db = await createDBInstance(join(tempDir, "test.db"), {
    appVersion: "2.0.0",
    runMigrations: true,
  });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("domain write integrity", () => {
  test("validates domain ids inside Understanding writes", async () => {
    const understandings = new UnderstandingCore(db);

    await expect(
      Effect.runPromise(
        understandings._createUnderstanding({ body: "body", domainIds: ["missing-domain"] }),
      ),
    ).rejects.toMatchObject({
      _tag: "UnderstandingDomainNotFoundError",
      domainId: "missing-domain",
    });
  });

  test("validates Domain parents inside Domain writes", async () => {
    const domains = new DomainCore(db);
    const parent = await Effect.runPromise(domains.createDomain({ name: "Parent" }));
    const child = await Effect.runPromise(
      domains.createDomain({ name: "Child", parentId: parent.id }),
    );

    await expect(
      Effect.runPromise(domains.createDomain({ name: "Bad", parentId: "missing" })),
    ).rejects.toMatchObject({ _tag: "DomainNotFoundError" });
    await expect(
      Effect.runPromise(domains.updateDomain(parent.id, { parentId: child.id })),
    ).rejects.toMatchObject({ _tag: "InvalidParentError" });
  });

  test("validates Domain parents inside reorder writes", async () => {
    const domains = new DomainCore(db);
    const parent = await Effect.runPromise(domains.createDomain({ name: "Parent" }));
    const child = await Effect.runPromise(
      domains.createDomain({ name: "Child", parentId: parent.id }),
    );

    await expect(
      Effect.runPromise(
        domains.reorderDomains([{ id: parent.id, parentId: child.id, sortOrder: 0 }]),
      ),
    ).rejects.toMatchObject({ _tag: "InvalidParentError" });
    await expect(
      Effect.runPromise(
        domains.reorderDomains([{ id: child.id, parentId: "missing", sortOrder: 0 }]),
      ),
    ).rejects.toMatchObject({ _tag: "DomainNotFoundError" });
  });

  test("validates Context targets inside Context writes", async () => {
    const contexts = new ContextCore(db);
    const understandings = new UnderstandingCore(db);

    await expect(
      Effect.runPromise(
        contexts._createContext({
          understandingId: "missing-understanding",
          medium: "ai",
          content: "content",
        }),
      ),
    ).rejects.toMatchObject({ _tag: "ContextUnderstandingNotFoundError" });
    await expect(
      Effect.runPromise(contexts._updateContext("missing-context", {})),
    ).rejects.toMatchObject({ _tag: "NoContextFieldsError" });

    const understanding = await Effect.runPromise(
      understandings._createUnderstanding({ body: "body" }),
    );
    const context = await Effect.runPromise(
      contexts._createContext({
        understandingId: understanding.id,
        medium: "ai",
        content: "content",
      }),
    );
    await expect(
      Effect.runPromise(
        contexts._updateContext(context.id, { understandingId: "missing-understanding" }),
      ),
    ).rejects.toMatchObject({ _tag: "ContextUnderstandingNotFoundError" });
  });
});
