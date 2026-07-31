import { editorViewCtx } from "@milkdown/core";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { type CSSProperties, type MouseEvent, useCallback, useEffect, useRef } from "react";
import { cn } from "#lib/utils";
import type { ChatEntityReference, ChatEntityType, ResolveChatEntity } from "../chat/entity";
import {
  createReflectaMilkdownEditorBuilder,
  getMilkdownMarkdown,
  setMilkdownMarkdown,
} from "./milkdown-editor";
import { markdownEquals } from "./markdown-normalize";
import type { MarkdownAssetUploader, MarkdownEditorSuggestionSource } from "./types";
import "./milkdown-theme.scss";

export type MarkdownEditorProps = {
  documentId?: string;
  value: string;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  height?: number | string;
  maxHeight?: number | string;
  onChange?: (markdown: string) => void;
  onBlur?: (markdown: string) => void;
  uploadAsset?: MarkdownAssetUploader;
  getSuggestions?: MarkdownEditorSuggestionSource;
  resolveWikiLink?: ResolveChatEntity;
  onWikiLinkOpen?: (reference: ChatEntityReference) => void;
};

function toCssSize(value: number | string): string {
  return typeof value === "number" ? `${value}px` : value;
}

function MarkdownEditorSurface({
  documentId,
  value,
  placeholder,
  readOnly,
  onChange,
  onBlur,
  uploadAsset,
  getSuggestions,
  resolveWikiLink,
  onWikiLinkOpen,
}: Omit<MarkdownEditorProps, "className" | "height" | "maxHeight"> & {
  placeholder: string;
}) {
  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);
  const uploadAssetRef = useRef(uploadAsset);
  const getSuggestionsRef = useRef(getSuggestions);
  const onWikiLinkOpenRef = useRef(onWikiLinkOpen);

  onChangeRef.current = onChange;
  onBlurRef.current = onBlur;
  uploadAssetRef.current = uploadAsset;
  getSuggestionsRef.current = getSuggestions;
  onWikiLinkOpenRef.current = onWikiLinkOpen;

  const handleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
      "a[data-wiki-link]",
    );
    const id = link?.dataset.wikiLink;
    const type = link?.dataset.entityType as ChatEntityType | undefined;
    if (!id || !type) return;

    event.preventDefault();
    onWikiLinkOpenRef.current?.({ type, id });
  }, []);

  const stableUploader = useCallback<MarkdownAssetUploader>((file, signal) => {
    const uploader = uploadAssetRef.current;
    if (!uploader) return Promise.reject(new Error("Markdown asset upload is not configured."));
    return uploader(file, signal);
  }, []);

  const stableSuggestionSource = useCallback<MarkdownEditorSuggestionSource>(
    (query, signal) => getSuggestionsRef.current?.(query, signal) ?? Promise.resolve([]),
    [],
  );

  const editor = useEditor(
    (root) =>
      createReflectaMilkdownEditorBuilder({
        root,
        content: value,
        placeholder,
        readOnly,
        uploadAsset: !readOnly && uploadAsset ? stableUploader : undefined,
        getSuggestions: !readOnly && getSuggestions ? stableSuggestionSource : undefined,
        onChange: (next) => onChangeRef.current?.(next),
        onBlur: (markdown) => onBlurRef.current?.(markdown),
      }),
    [
      placeholder,
      readOnly,
      !!uploadAsset,
      !!getSuggestions,
      stableUploader,
      stableSuggestionSource,
    ],
  );

  useEffect(() => {
    const instance = editor.get();
    if (!instance || markdownEquals(value, getMilkdownMarkdown(instance))) return;
    setMilkdownMarkdown(instance, value);
  }, [documentId, editor, value]);

  useEffect(() => {
    const instance = editor.get();
    if (!instance || !resolveWikiLink) return;
    const view = instance.ctx.get(editorViewCtx);
    let transaction = view.state.tr;

    view.state.doc.descendants((node, position) => {
      if (node.type.name !== "wiki_link") return;
      const reference = {
        type: node.attrs.entityType as ChatEntityType,
        id: String(node.attrs.id),
      };
      const label = resolveWikiLink(reference)?.label;
      if (!label || label === node.attrs.title) return;
      transaction = transaction.setNodeMarkup(position, undefined, {
        ...node.attrs,
        title: label,
      });
    });

    if (transaction.docChanged) view.dispatch(transaction);
  }, [editor, resolveWikiLink, value]);

  return (
    <div className="reflecta-md-editor__surface" onClick={handleClick}>
      <Milkdown />
    </div>
  );
}

export function MarkdownEditor({
  documentId,
  value,
  readOnly,
  placeholder = "请输入",
  className,
  height = 400,
  maxHeight,
  onChange,
  onBlur,
  uploadAsset,
  getSuggestions,
  resolveWikiLink,
  onWikiLinkOpen,
}: MarkdownEditorProps) {
  const autoGrow = height === "auto";
  const style: CSSProperties & { "--reflecta-md-editor-max-height"?: string } = {
    height: autoGrow ? undefined : toCssSize(height),
  };
  if (autoGrow && maxHeight != null) {
    style["--reflecta-md-editor-max-height"] = toCssSize(maxHeight);
  }

  return (
    <div
      className={cn("reflecta-md-editor", autoGrow && "reflecta-md-editor--auto-grow", className)}
      data-no-drag
      style={style}
    >
      <MilkdownProvider>
        <MarkdownEditorSurface
          documentId={documentId}
          value={value}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={onChange}
          onBlur={onBlur}
          uploadAsset={uploadAsset}
          getSuggestions={getSuggestions}
          resolveWikiLink={resolveWikiLink}
          onWikiLinkOpen={onWikiLinkOpen}
        />
      </MilkdownProvider>
    </div>
  );
}
