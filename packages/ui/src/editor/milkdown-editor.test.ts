// @vitest-environment happy-dom

import { afterEach, describe, expect, test, vi } from "vitest";
import { schemaCtx } from "@milkdown/core";
import { editorViewCtx } from "@milkdown/core";
import { uploadConfig } from "@milkdown/plugin-upload";
import type { Editor } from "@milkdown/core";
import type { Fragment } from "@milkdown/prose/model";
import { Fragment as ProseFragment } from "@milkdown/prose/model";
import { TextSelection } from "@milkdown/prose/state";

if (!document.doctype) {
  document.insertBefore(
    document.implementation.createDocumentType("html", "", ""),
    document.documentElement,
  );
}
if (document.compatMode !== "CSS1Compat") {
  Object.defineProperty(document, "compatMode", { configurable: true, value: "CSS1Compat" });
}

const { createReflectaMilkdownEditor, getMilkdownMarkdown, setMilkdownMarkdown } =
  await import("./milkdown-editor");

const editors: Editor[] = [];

afterEach(async () => {
  await Promise.all(editors.map((editor) => editor.destroy()));
  editors.length = 0;
});

describe("reflecta milkdown editor", () => {
  test("does not emit updates while creating the editor", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const onChange = vi.fn();

    const editor = await createReflectaMilkdownEditor({
      root,
      content: "Initial",
      onChange,
    });
    editors.push(editor);

    expect(onChange).not.toHaveBeenCalled();
  });

  test("skips replace when markdown is already equivalent", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const onChange = vi.fn();

    const editor = await createReflectaMilkdownEditor({
      root,
      content: "Initial",
      onChange,
    });
    editors.push(editor);

    setMilkdownMarkdown(editor, "Initial\n");

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(onChange).not.toHaveBeenCalled();
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

  test("reports the latest document when the editor loses focus", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const onBlur = vi.fn();
    const editor = await createReflectaMilkdownEditor({
      root,
      content: "Initial",
      onBlur,
    });
    editors.push(editor);

    setMilkdownMarkdown(editor, "Latest body");
    editor.ctx.get(editorViewCtx).dom.dispatchEvent(new FocusEvent("blur", { bubbles: true }));

    expect(onBlur).toHaveBeenCalledWith("Latest body");
  });

  test("preserves wiki links, formulas, and Mermaid while leaving other markdown to Crepe", async () => {
    const root = document.createElement("div");
    document.body.append(root);

    const editor = await createReflectaMilkdownEditor({
      root,
      content:
        "Connect [[Alpha#understanding-1]] with $E = mc^2$.\n\n$$\n\\int_0^1 x^2 dx\n$$\n\n```mermaid\ngraph TD\n  A --> B\n```\n\n:::warning\nCareful\n:::",
    });
    editors.push(editor);

    const markdown = getMilkdownMarkdown(editor);

    expect(markdown).toContain("[[Alpha#understanding-1]]");
    expect(markdown).toContain("$E = mc^2$");
    expect(markdown).toContain("\\int_0^1 x^2 dx");
    expect(markdown).toContain("```mermaid");
    expect(markdown).toContain(":::warning");
  });

  test("renders id-backed wiki links as inline anchors in the editor", async () => {
    const root = document.createElement("div");
    document.body.append(root);

    const editor = await createReflectaMilkdownEditor({
      root,
      content: "Connect [[Alpha#understanding-1]].",
    });
    editors.push(editor);

    const link = root.querySelector<HTMLAnchorElement>('a[data-wiki-link="understanding-1"]');
    expect(link?.textContent).toBe("Alpha");
    expect(getMilkdownMarkdown(editor)).toContain("[[Alpha#understanding-1]]");
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
        return file.type.startsWith("video/")
          ? { url: `memory://${file.name}" onerror="alert(1)`, alt: `<${file.name}>` }
          : { url: `memory://${file.name}`, alt: file.name };
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
    expect(fragment.child(0).attrs.src).toBe("memory://capture.png");
    expect(fragment.child(1).attrs.value).toContain(
      'src="memory://clip.mp4&quot; onerror=&quot;alert(1)"',
    );
    expect(fragment.child(1).attrs.value).toContain('title="&lt;clip.mp4&gt;"');
    expect(fragment.child(1).attrs.value).not.toContain('onerror="alert(1)"');
  });

  test("backspace removes an empty paragraph inside a blockquote", async () => {
    const root = document.createElement("div");
    document.body.append(root);

    const editor = await createReflectaMilkdownEditor({
      root,
      content: "seed",
    });
    editors.push(editor);

    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const emptyParagraph = schema.nodes.paragraph.create();
    const quoteText = schema.nodes.paragraph.create(null, schema.text("quoted"));
    const blockquote = schema.nodes.blockquote.create(
      null,
      ProseFragment.fromArray([emptyParagraph, quoteText]),
    );
    view.dispatch(
      view.state.tr.replaceWith(0, view.state.doc.content.size, ProseFragment.from(blockquote)),
    );
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)));

    root
      .querySelector(".ProseMirror")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));

    expect(getMilkdownMarkdown(editor)).toBe("> quoted");
  });
});
