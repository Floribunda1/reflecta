// @vitest-environment happy-dom

import { afterEach, describe, expect, test } from "vitest";
import type { Editor } from "@milkdown/core";
import {
  createReflectaMilkdownEditor,
  getMilkdownMarkdown,
  setMilkdownMarkdown,
} from "./milkdown-editor";

const editors: Editor[] = [];

afterEach(async () => {
  await Promise.all(editors.map((editor) => editor.destroy()));
  editors.length = 0;
});

describe("reflecta milkdown editor", () => {
  test("creates a headless editor and serializes markdown", async () => {
    const root = document.createElement("div");
    document.body.append(root);

    const editor = await createReflectaMilkdownEditor({
      root,
      content: "# Title\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n- [x] Task",
      placeholder: "请输入",
    });
    editors.push(editor);

    const markdown = getMilkdownMarkdown(editor);

    expect(markdown).toContain("# Title");
    expect(markdown).toContain("| A | B |");
    expect(markdown).toMatch(/[*-] \[x] Task/);
    expect(root.querySelector(".milkdown")).toBeTruthy();
  });

  test("replaces the editor document from markdown", async () => {
    const root = document.createElement("div");
    document.body.append(root);

    const editor = await createReflectaMilkdownEditor({
      root,
      content: "Initial",
    });
    editors.push(editor);

    setMilkdownMarkdown(editor, "## Next\n\nUpdated body");

    expect(getMilkdownMarkdown(editor)).toContain("## Next");
    expect(getMilkdownMarkdown(editor)).toContain("Updated body");
    expect(getMilkdownMarkdown(editor)).not.toContain("Initial");
  });

  test("preserves reflecta markdown extensions in serialized markdown", async () => {
    const root = document.createElement("div");
    document.body.append(root);

    const editor = await createReflectaMilkdownEditor({
      root,
      content:
        "Connect [[Alpha#thought-1]].\n\n```mermaid\ngraph TD\n  A --> B\n```\n\n:::warning\nCareful\n:::",
    });
    editors.push(editor);

    const markdown = getMilkdownMarkdown(editor);

    expect(markdown).toContain("[[Alpha#thought-1]]");
    expect(markdown).toContain("```mermaid");
    expect(markdown).toContain(":::warning");
  });

  test("renders id-backed wiki links as inline anchors in the editor", async () => {
    const root = document.createElement("div");
    document.body.append(root);

    const editor = await createReflectaMilkdownEditor({
      root,
      content: "Connect [[Alpha#thought-1]].",
    });
    editors.push(editor);

    const link = root.querySelector<HTMLAnchorElement>('a[data-wiki-link="thought-1"]');
    expect(link?.textContent).toBe("Alpha");
    expect(getMilkdownMarkdown(editor)).toContain("[[Alpha#thought-1]]");
  });

  test("renders admonitions as block nodes in the editor", async () => {
    const root = document.createElement("div");
    document.body.append(root);

    const editor = await createReflectaMilkdownEditor({
      root,
      content: ":::warning\nCareful\n:::",
    });
    editors.push(editor);

    const admonition = root.querySelector<HTMLElement>('[data-admonition][data-type="warning"]');
    expect(admonition?.textContent).toContain("Careful");
    expect(getMilkdownMarkdown(editor)).toContain(":::warning");
  });

  test("renders mermaid preview widgets in the editor", async () => {
    const root = document.createElement("div");
    document.body.append(root);

    const editor = await createReflectaMilkdownEditor({
      root,
      content: "```mermaid\ngraph TD\n  A --> B\n```",
    });
    editors.push(editor);

    expect(root.querySelector(".reflecta-md-editor__mermaid-preview")).toBeTruthy();
    expect(getMilkdownMarkdown(editor)).toContain("```mermaid");
  });
});
