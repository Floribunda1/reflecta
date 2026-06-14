import { Editor, editorViewCtx, parserCtx, serializerCtx } from "@milkdown/core";
import { uploadConfig } from "@milkdown/plugin-upload";
import type { Node as ProseNode } from "@milkdown/prose/model";
import { Fragment } from "@milkdown/prose/model";
import type { EditorView } from "@milkdown/prose/view";
import type { Schema } from "@milkdown/prose/model";
import { Crepe } from "@milkdown/crepe";
import { reflectaMilkdownExtensions } from "./milkdown-extensions";

export type AssetUploader = (file: File) => Promise<string>;

export type CreateReflectaMilkdownEditorOptions = {
  root: HTMLElement;
  content: string;
  placeholder?: string;
  readonly?: boolean;
  onUpdate?: (markdown: string) => void;
  uploadAsset?: AssetUploader;
};

function isSupportedMedia(file: File): boolean {
  return file.type.startsWith("image/") || file.type.startsWith("video/");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createImageNode(schema: Schema, file: File, assetUrl: string): ProseNode | null {
  const imageBlock = schema.nodes["image-block"];
  if (imageBlock) return imageBlock.createAndFill({ src: assetUrl, alt: file.name });

  const image = schema.nodes.image;
  if (image) return image.createAndFill({ src: assetUrl, alt: file.name, title: file.name });

  return null;
}

function createVideoNode(schema: Schema, file: File, assetUrl: string): ProseNode | null {
  const html = schema.nodes.html;
  if (!html) return null;

  return html.create({
    value: `<video src="${escapeHtml(assetUrl)}" controls title="${escapeHtml(file.name)}"></video>`,
  });
}

async function uploadFilesAsMarkdown(
  files: FileList,
  schema: Schema,
  uploadAsset?: AssetUploader,
): Promise<Fragment | ProseNode | ProseNode[]> {
  if (!uploadAsset) return Fragment.empty;

  const nodes: ProseNode[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files.item(index);
    if (!file || !isSupportedMedia(file)) continue;

    const savedFilename = await uploadAsset(file);
    const assetUrl = `asset:///${savedFilename}`;
    const node = file.type.startsWith("image/")
      ? createImageNode(schema, file, assetUrl)
      : createVideoNode(schema, file, assetUrl);
    if (node) nodes.push(node);
  }

  return Fragment.fromArray(nodes);
}

export function createReflectaMilkdownEditorBuilder({
  root,
  content,
  placeholder,
  readonly,
  onUpdate,
  uploadAsset,
}: CreateReflectaMilkdownEditorOptions): Editor {
  const editorRoot = document.createElement("div");
  editorRoot.className = "reflecta-milkdown";
  if (placeholder) editorRoot.dataset.placeholder = placeholder;
  root.replaceChildren(editorRoot);

  const crepe = new Crepe({
    root: editorRoot,
    defaultValue: content,
    features: {
      [Crepe.Feature.AI]: false,
      [Crepe.Feature.TopBar]: false,
    },
    featureConfigs: {
      [Crepe.Feature.Placeholder]: {
        text: placeholder ?? "请输入",
        mode: "block",
      },
    },
  });

  crepe.on((listener) => {
    listener.markdownUpdated((_ctx, markdown) => {
      onUpdate?.(markdown);
    });
  });

  const editor = crepe.editor.config((ctx) => {
    ctx.update(uploadConfig.key, (prev) => ({
      ...prev,
      enableHtmlFileUploader: true,
      uploader: (files, schema) => uploadFilesAsMarkdown(files, schema, uploadAsset),
    }));
  });

  editor.use(reflectaMilkdownExtensions);
  if (readonly) crepe.setReadonly(true);

  return editor;
}

export async function createReflectaMilkdownEditor(
  options: CreateReflectaMilkdownEditorOptions,
): Promise<Editor> {
  const editor = createReflectaMilkdownEditorBuilder(options);
  await editor.create();
  patchSlashMenuScroll(options.root);
  return editor;
}

function patchSlashMenuScroll(root: HTMLElement): void {
  const observer = new MutationObserver(() => {
    const menu = root.querySelector<HTMLElement>(".milkdown-slash-menu");
    if (!menu || menu.dataset.show === "false") return;

    const hovered = menu.querySelector<HTMLElement>(".menu-groups li.hover");
    hovered?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });

  observer.observe(root, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "data-show"],
  });
}

export function getMilkdownMarkdown(editor: Editor): string {
  const serializer = editor.ctx.get(serializerCtx);
  const view: EditorView = editor.ctx.get(editorViewCtx);
  return normalizeMilkdownMarkdown(serializer(view.state.doc));
}

export function setMilkdownMarkdown(editor: Editor, markdown: string): void {
  const parser = editor.ctx.get(parserCtx);
  const view: EditorView = editor.ctx.get(editorViewCtx);
  const nextDoc = parser(markdown);
  const transaction = view.state.tr.replaceWith(0, view.state.doc.content.size, nextDoc.content);
  view.dispatch(transaction);
}

function normalizeMilkdownMarkdown(markdown: string): string {
  return markdown.replaceAll(/\\\[\\\[([^\]\n]+)]]/g, "[[$1]]");
}
