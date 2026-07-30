import { EditorView as CodeMirrorView } from "@codemirror/view";
import { Editor, editorViewCtx, serializerCtx } from "@milkdown/core";
import { trailingConfig } from "@milkdown/plugin-trailing";
import { uploadConfig } from "@milkdown/plugin-upload";
import type { Node as ProseNode } from "@milkdown/prose/model";
import { Fragment } from "@milkdown/prose/model";
import type { EditorView } from "@milkdown/prose/view";
import type { Schema } from "@milkdown/prose/model";
import { Crepe } from "@milkdown/crepe";
import { replaceAll } from "@milkdown/utils";
import { escape } from "lodash-es";
import { renderMermaid } from "#lib/mermaid";
import { reflectaMilkdownExtensions } from "./milkdown-extensions";
import { markdownEquals, normalizeMarkdown } from "./markdown-normalize";
import {
  createWikiLinkSuggestionPlugin,
  type WikiLinkSuggestionSource,
} from "./wiki-link-suggestion";
import type { MarkdownAssetUploader } from "./types";

export type CreateReflectaMilkdownEditorOptions = {
  root: HTMLElement;
  content: string;
  placeholder?: string;
  readOnly?: boolean;
  onChange?: (markdown: string) => void;
  onBlur?: (markdown: string) => void;
  uploadAsset?: MarkdownAssetUploader;
  getSuggestions?: WikiLinkSuggestionSource;
};

let mermaidPreviewId = 0;

function renderMermaidPreview(
  language: string,
  content: string,
  applyPreview: (value: null | string | HTMLElement) => void,
): null | undefined {
  if (language.toLowerCase() !== "mermaid" || !content.trim()) return null;

  const id = `reflecta-mermaid-${++mermaidPreviewId}`;
  void renderMermaid(id, content).then(
    ({ svg }) => applyPreview(svg),
    (error) => {
      const message = document.createElement("p");
      message.className = "reflecta-mermaid-error";
      message.textContent = "Mermaid 图表渲染失败";
      message.title = error instanceof Error ? error.message : String(error);
      applyPreview(message);
    },
  );
  return undefined;
}

function isSupportedMedia(file: File): boolean {
  return file.type.startsWith("image/") || file.type.startsWith("video/");
}

function createImageNode(schema: Schema, assetUrl: string, alt: string): ProseNode | null {
  const imageBlock = schema.nodes["image-block"];
  if (imageBlock) return imageBlock.createAndFill({ src: assetUrl, alt });

  const image = schema.nodes.image;
  if (image) return image.createAndFill({ src: assetUrl, alt, title: alt });

  return null;
}

function createVideoNode(schema: Schema, assetUrl: string, title: string): ProseNode | null {
  const html = schema.nodes.html;
  if (!html) return null;

  return html.create({
    value: `<video src="${escape(assetUrl)}" controls title="${escape(title)}"></video>`,
  });
}

async function uploadFilesAsMarkdown(
  files: FileList,
  schema: Schema,
  uploadAsset?: MarkdownAssetUploader,
): Promise<Fragment | ProseNode | ProseNode[]> {
  if (!uploadAsset) return Fragment.empty;

  const nodes: ProseNode[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files.item(index);
    if (!file || !isSupportedMedia(file)) continue;

    const controller = new AbortController();
    const result = await uploadAsset(file, controller.signal);
    const alt = result.alt ?? file.name;
    const node = file.type.startsWith("image/")
      ? createImageNode(schema, result.url, alt)
      : createVideoNode(schema, result.url, alt);
    if (node) nodes.push(node);
  }

  return Fragment.fromArray(nodes);
}

export function createReflectaMilkdownEditorBuilder({
  root,
  content,
  placeholder,
  readOnly,
  onChange,
  onBlur,
  uploadAsset,
  getSuggestions,
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
      [Crepe.Feature.BlockEdit]: false,
      [Crepe.Feature.TopBar]: false,
    },
    featureConfigs: {
      [Crepe.Feature.CodeMirror]: {
        renderPreview: renderMermaidPreview,
        extensions: [CodeMirrorView.lineWrapping],
      },
      [Crepe.Feature.Cursor]: {
        virtual: false,
      },
      [Crepe.Feature.Placeholder]: {
        text: placeholder ?? "请输入",
        mode: "block",
      },
    },
  });

  const editor = crepe.editor.config((ctx) => {
    ctx.update(uploadConfig.key, (prev) => ({
      ...prev,
      enableHtmlFileUploader: true,
      uploader: (files, schema) => uploadFilesAsMarkdown(files, schema, uploadAsset),
    }));
    if (readOnly) {
      ctx.update(trailingConfig.key, (prev) => ({
        ...prev,
        shouldAppend: () => false,
      }));
    }
  });

  let lastMarkdown = normalizeMarkdown(content);
  crepe.on((listener) => {
    const currentMarkdown = (ctx: Parameters<Parameters<typeof listener.blur>[0]>[0]) => {
      const serializer = ctx.get(serializerCtx);
      const view: EditorView = ctx.get(editorViewCtx);
      return normalizeMarkdown(serializer(view.state.doc));
    };
    const flush = (ctx: Parameters<Parameters<typeof listener.blur>[0]>[0]) => {
      const markdown = currentMarkdown(ctx);
      if (!markdownEquals(markdown, lastMarkdown)) {
        lastMarkdown = markdown;
        onChange?.(markdown);
      }
      onBlur?.(markdown);
    };

    listener.markdownUpdated((_ctx, markdown, prevMarkdown) => {
      if (prevMarkdown != null && markdownEquals(markdown, prevMarkdown)) return;
      lastMarkdown = markdown;
      onChange?.(markdown);
    });
    listener.blur(flush);
  });

  editor.use(reflectaMilkdownExtensions);
  if (!readOnly && getSuggestions) {
    editor.use(createWikiLinkSuggestionPlugin({ source: getSuggestions }));
  }
  if (readOnly) crepe.setReadonly(true);

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
  return normalizeMarkdown(serializer(view.state.doc));
}

export function setMilkdownMarkdown(editor: Editor, markdown: string): void {
  if (markdownEquals(markdown, getMilkdownMarkdown(editor))) return;
  editor.action(replaceAll(markdown));
}
