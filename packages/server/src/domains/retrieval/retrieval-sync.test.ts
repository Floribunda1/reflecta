import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createDBInstance } from "../../db";
import { ContextCliBff } from "../context/bff-cli";
import { DomainCliBff } from "../domain/bff-cli";
import { SearchCliBff } from "../search/bff-cli";
import { UnderstandingCliBff } from "../understanding/bff-cli";
import { createRetrievalIndex } from "./sync";

const tempDirs: string[] = [];
const previousIndexPath = process.env.REFLECTA_RETRIEVAL_INDEX_PATH;

afterEach(async () => {
  if (previousIndexPath === undefined) {
    delete process.env.REFLECTA_RETRIEVAL_INDEX_PATH;
  } else {
    process.env.REFLECTA_RETRIEVAL_INDEX_PATH = previousIndexPath;
  }
  await Promise.all(tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

async function setupServices() {
  const tempDir = await mkdtemp(join(tmpdir(), "reflecta-retrieval-sync-"));
  tempDirs.push(tempDir);
  process.env.REFLECTA_RETRIEVAL_INDEX_PATH = join(tempDir, "index");
  const db = await createDBInstance(join(tempDir, "test.db"));
  return {
    contexts: new ContextCliBff(db),
    domains: new DomainCliBff(db),
    search: new SearchCliBff(db),
    understandings: new UnderstandingCliBff(db),
  };
}

async function indexIds(query: string) {
  return (await createRetrievalIndex().search(query, 10)).map((hit) => hit.id);
}

describe("retrieval index write-path sync", () => {
  test("Understanding create, update, and delete sync retrieval rows", async () => {
    const { understandings } = await setupServices();

    const created = await understandings.createUnderstanding({
      title: "Sync Understanding",
      body: "understandingsyncbeforemarker",
    });
    expect(await indexIds("understandingsyncbeforemarker")).toContain(
      `understanding:${created.id}`,
    );

    await understandings.updateUnderstanding(created.id, {
      body: "understandingsyncaftermarker",
    });
    expect(await indexIds("understandingsyncbeforemarker")).not.toContain(
      `understanding:${created.id}`,
    );
    expect(await indexIds("understandingsyncaftermarker")).toContain(`understanding:${created.id}`);

    await understandings.deleteUnderstanding(created.id);
    expect(await indexIds("understandingsyncaftermarker")).not.toContain(
      `understanding:${created.id}`,
    );
  });

  test("Context create, update, and delete sync parent retrieval rows", async () => {
    const { contexts, understandings } = await setupServices();
    const understanding = await understandings.createUnderstanding({
      title: "Sync Context Parent",
      body: "Parent body",
    });

    const context = await contexts.createContext({
      understandingId: understanding.id,
      medium: "experience",
      title: "Sync Context",
      content: "contextsyncbeforemarker",
    });
    expect(await indexIds("contextsyncbeforemarker")).toContain(`context:${context.id}`);

    await contexts.updateContext(context.id, { content: "contextsyncaftermarker" });
    expect(await indexIds("contextsyncbeforemarker")).not.toContain(`context:${context.id}`);
    expect(await indexIds("contextsyncaftermarker")).toContain(`context:${context.id}`);

    await contexts.deleteContext(context.id);
    expect(await indexIds("contextsyncaftermarker")).not.toContain(`context:${context.id}`);
  });

  test("retrieveKnowledge expands one-hop explicit Understanding relations from anchors", async () => {
    const { search, understandings } = await setupServices();
    const target = await understandings.createUnderstanding({
      title: "Relation Target",
      body: "Related target body",
    });
    const source = await understandings.createUnderstanding({
      title: "Relation Source",
      body: `See [[Relation Target#${target.id}]]`,
    });

    const result = await search.retrieveKnowledge({
      query: "nohitrelationmarker",
      anchors: [{ type: "understanding", id: source.id }],
      limit: 5,
    });

    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: target.id,
          evidence: expect.arrayContaining([expect.objectContaining({ channel: "relation" })]),
        }),
      ]),
    );
    expect(result.trace.relation.candidates).toBe(1);
    expect(result.trace).toMatchObject({
      embeddingModel: "local-concept-v1",
      projectionVersion: 1,
      fusion: { method: "rrf" },
    });
  });

  test("retrieveKnowledge returns capped direct Understandings from Domain anchors", async () => {
    const { domains, search, understandings } = await setupServices();
    const domain = await domains.createDomain({ name: "Anchor Domain" });
    const first = await understandings.createUnderstanding({
      title: "Domain Anchor A",
      domainIds: [domain.id],
    });
    const second = await understandings.createUnderstanding({
      title: "Domain Anchor B",
      domainIds: [domain.id],
    });

    const result = await search.retrieveKnowledge({
      query: "zzznomtxq",
      anchors: [{ type: "domain", id: domain.id }],
      limit: 1,
    });

    expect(result.candidates).toHaveLength(1);
    expect([first.id, second.id]).toContain(result.candidates[0].id);
    expect(result.candidates[0]).toMatchObject({
      evidence: expect.arrayContaining([expect.objectContaining({ channel: "anchor" })]),
    });
    expect(result.trace.relation.candidates).toBe(1);
  });
});
