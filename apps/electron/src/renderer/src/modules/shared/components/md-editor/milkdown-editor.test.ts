// @vitest-environment happy-dom

import { afterEach, describe, expect, test, vi } from "vitest";
import { schemaCtx } from "@milkdown/core";
import { uploadConfig } from "@milkdown/plugin-upload";
import type { Editor } from "@milkdown/core";
import type { Fragment } from "@milkdown/prose/model";
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

  test("does not emit updates while creating the editor", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const onUpdate = vi.fn();

    const editor = await createReflectaMilkdownEditor({
      root,
      content: "Initial",
      onUpdate,
    });
    editors.push(editor);

    expect(onUpdate).not.toHaveBeenCalled();
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

  test("preserves wiki links while leaving other markdown to Crepe", async () => {
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

  test("uses the Crepe upload hook for pasted images and videos", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const uploaded: string[] = [];

    const editor = await createReflectaMilkdownEditor({
      root,
      content: "Upload target",
      uploadAsset: async (file) => {
        uploaded.push(file.name);
        return `saved-${file.name}`;
      },
    });
    editors.push(editor);

    const files = {
      length: 2,
      item: (index: number) =>
        [
          new File(["image"], "capture.png", { type: "image/png" }),
          new File(["video"], "clip.mp4", { type: "video/mp4" }),
        ][index] ?? null,
    } as FileList;

    const schema = editor.ctx.get(schemaCtx);
    const uploader = editor.ctx.get(uploadConfig.key).uploader;
    const fragment = (await uploader(files, schema, editor.ctx, 0)) as Fragment;

    expect(uploaded).toEqual(["capture.png", "clip.mp4"]);
    expect(fragment.childCount).toBe(2);
    expect(fragment.child(0).attrs.src).toBe("asset:///saved-capture.png");
    expect(fragment.child(1).attrs.value).toContain('src="asset:///saved-clip.mp4"');
  });

  test("does not render admonitions as custom editor block nodes", async () => {
    const root = document.createElement("div");
    document.body.append(root);

    const editor = await createReflectaMilkdownEditor({
      root,
      content: ":::warning\nCareful\n:::",
    });
    editors.push(editor);

    const admonition = root.querySelector<HTMLElement>('[data-admonition][data-type="warning"]');
    expect(admonition).toBeNull();
    expect(getMilkdownMarkdown(editor)).toContain(":::warning");
  });

  test("does not render custom mermaid preview widgets in the editor", async () => {
    const root = document.createElement("div");
    document.body.append(root);

    const editor = await createReflectaMilkdownEditor({
      root,
      content: "```mermaid\ngraph TD\n  A --> B\n```",
    });
    editors.push(editor);

    expect(root.querySelector(".reflecta-md-editor__mermaid-preview")).toBeNull();
    expect(getMilkdownMarkdown(editor)).toContain("```mermaid");
  });
});
