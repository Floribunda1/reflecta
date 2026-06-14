import {
  Editor,
  editorViewOptionsCtx,
  editorViewCtx,
  parserCtx,
  serializerCtx,
} from "@milkdown/core";
import { listenerCtx } from "@milkdown/plugin-listener";
import { uploadConfig } from "@milkdown/plugin-upload";
import { htmlSchema, imageSchema } from "@milkdown/preset-commonmark";
import type { Node as ProseNode } from "@milkdown/prose/model";
import { Fragment } from "@milkdown/prose/model";
import type { EditorView } from "@milkdown/prose/view";
import type { Ctx } from "@milkdown/ctx";
import { Crepe } from "@milkdown/crepe";
import { formatPastedMediaMarkdown } from "./markdown-support";
import { reflectaMilkdownExtensions } from "./milkdown-extensions";

export type AssetUploader = (file: File) => Promise<string>;

export type CreateReflectaMilkdownEditorOptions = {
  root: HTMLElement;
  content: string;
  placeholder?: string;
  onUpdate?: (markdown: string) => void;
  uploadAsset?: AssetUploader;
  onTextBeforeCursorChange?: (text: string) => void;
};

function isSupportedMedia(file: File): boolean {
  return file.type.startsWith("image/") || file.type.startsWith("video/");
}

async function uploadFilesAsMarkdown(
  files: FileList,
  ctx: Ctx,
  uploadAsset?: AssetUploader,
): Promise<Fragment | ProseNode | ProseNode[]> {
  const nodes: ProseNode[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files.item(index);
    if (!file || !isSupportedMedia(file)) continue;

    if (!uploadAsset) continue;

    const savedFilename = await uploadAsset(file);
    const assetUrl = `asset:///${savedFilename}`;

    if (file.type.startsWith("image/")) {
      const image = imageSchema.type(ctx).create({
        src: assetUrl,
        alt: file.name,
        title: file.name,
      });
      if (image) nodes.push(image);
      continue;
    }

    const video = htmlSchema.type(ctx).create({
      value: formatPastedMediaMarkdown({
        filename: file.name,
        assetUrl,
        mimeType: file.type,
      }),
    });
    if (video) nodes.push(video);
  }

  return Fragment.fromArray(nodes);
}

export function createReflectaMilkdownEditorBuilder({
  root,
  content,
  placeholder,
  onUpdate,
  uploadAsset,
  onTextBeforeCursorChange,
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
      [Crepe.Feature.ImageBlock]: {
        inlineOnUpload: uploadAsset,
        blockOnUpload: uploadAsset,
      },
    },
  });
  const editor = crepe.editor
    .config((ctx) => {
      ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
        onUpdate?.(markdown);
      });
      ctx.update(uploadConfig.key, (prev) => ({
        ...prev,
        enableHtmlFileUploader: true,
        uploader: (files) => uploadFilesAsMarkdown(files, ctx, uploadAsset),
      }));
      ctx.update(editorViewOptionsCtx, (prev) => ({
        ...prev,
        handleDOMEvents: {
          ...prev.handleDOMEvents,
          input: (view, event) => {
            const handled = prev.handleDOMEvents?.input?.(view, event) ?? false;
            queueMicrotask(() => onTextBeforeCursorChange?.(getTextBeforeCursorFromView(view)));
            return handled;
          },
          keyup: (view, event) => {
            const handled = prev.handleDOMEvents?.keyup?.(view, event) ?? false;
            queueMicrotask(() => onTextBeforeCursorChange?.(getTextBeforeCursorFromView(view)));
            return handled;
          },
        },
        handleClick: (view, position, event) => {
          const handled = prev.handleClick?.(view, position, event) ?? false;
          queueMicrotask(() => onTextBeforeCursorChange?.(getTextBeforeCursorFromView(view)));
          return handled;
        },
      }));
    })
    .use(reflectaMilkdownExtensions);

  return editor;
}

function getTextBeforeCursorFromView(view: EditorView): string {
  const selection = view.state.selection;
  if (!selection.empty) return "";
  return selection.$from.parent.textBetween(0, selection.$from.parentOffset, "\n", "\n");
}

export async function createReflectaMilkdownEditor(
  options: CreateReflectaMilkdownEditorOptions,
): Promise<Editor> {
  const editor = createReflectaMilkdownEditorBuilder(options);
  await editor.create();
  return editor;
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
  const transaction = view.state.tr.replaceWith(
    0,
    view.state.doc.content.size,
    nextDoc.content,
  );
  view.dispatch(transaction);
}

function normalizeMilkdownMarkdown(markdown: string): string {
  return markdown.replaceAll(/\\\[\\\[([^\]\n]+)]]/g, "[[$1]]");
}
