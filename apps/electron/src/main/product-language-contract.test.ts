import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

function readProjectFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function markdownFilesUnder(relativePath: string): string[] {
  const absolutePath = join(repoRoot, relativePath);
  return readdirSync(absolutePath).flatMap((entry) => {
    const entryPath = join(relativePath, entry);
    const absoluteEntryPath = join(repoRoot, entryPath);
    if (statSync(absoluteEntryPath).isDirectory()) return markdownFilesUnder(entryPath);
    return entryPath.endsWith(".md") ? [entryPath] : [];
  });
}

describe("product language contract", () => {
  test("project glossary defines the canonical product vocabulary", () => {
    const glossary = readProjectFile("CONTEXT.md");

    expect(glossary).toContain("## Understanding");
    expect(glossary).toContain("## Context");
    expect(glossary).toContain("## Connection");
    expect(glossary).toContain("## Domain");
    expect(glossary).toContain("origin | support | application | challenge | revision | related");
  });

  test("product-facing reference docs use Understanding and Domain as first-class names", () => {
    const docs = [
      "docs/references/product/value-proposition.md",
      "packages/skills/skills/cli-usage/references/reflecta-concepts.md",
    ];

    for (const relativePath of docs) {
      const content = readProjectFile(relativePath);
      expect(content, relativePath).toContain("Understanding");
      expect(content, relativePath).toContain("Domain");
      expect(content, relativePath).not.toMatch(/\bThought\b/);
      expect(content, relativePath).not.toMatch(/\bCategory\b/);
    }
  });

  test("Context is documented as full surrounding context, not just source evidence", () => {
    const valueProposition = readProjectFile("docs/references/product/value-proposition.md");

    expect(valueProposition).toContain("Context 是围绕某个 Understanding 的具象上下文");
    expect(valueProposition).toContain("形成、支撑、应用、挑战或修正");
    expect(valueProposition).not.toContain("Context 是理解的根");
    expect(valueProposition).not.toContain("来源证据");
  });

  test("v1.1.0 docs do not introduce rejected interim product names", () => {
    const docs = markdownFilesUnder("docs/iterations/v1.1.0").filter(
      (path) => path !== "docs/iterations/v1.1.0/product/domain-language-unification-plan.md",
    );
    const rejectedTerms = [
      "sourceEvidence",
      "sourceContext",
      "sourceStatus",
      "retrieve_understanding",
      "thought_capture",
      "Context 是理解的根",
      "source evidence",
    ];

    for (const relativePath of docs) {
      const content = readProjectFile(relativePath);
      for (const term of rejectedTerms) {
        expect(content, `${relativePath} should not contain ${term}`).not.toContain(term);
      }
    }
  });
});
