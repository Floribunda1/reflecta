import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { useCallback, useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import { cn } from "@renderer/lib/utils";
import { ipcClient } from "@renderer/utils/ipc";
import {
  createReflectaMilkdownEditorBuilder,
  getMilkdownMarkdown,
  setMilkdownMarkdown,
} from "./milkdown-editor";
import { milkdownMarkdownEquals } from "./markdown-normalize";
import "./milkdown-theme.scss";

type MarkdownEditorProps = {
  contentKey?: string;
  initialContent?: string;
  content?: string;
  width?: number | string;
  height?: number | string;
  maxHeight?: number | string;
  placeholder?: string;
  readonly?: boolean;
  className?: string;
  onUpdate?: (value: string) => void;
  onBlur?: () => void;
  onWikiLinkClick?: (thoughtId: string) => void;
};

function toCssSize(value: number | string): string {
  return typeof value === "number" ? `${value}px` : value;
}

function MarkdownEditorSurface({
  contentKey,
  content,
  placeholder,
  readonly,
  onUpdate,
  onBlur,
  onWikiLinkClick,
}: {
  contentKey?: string;
  content: string;
  placeholder: string;
  readonly?: boolean;
  onUpdate?: (value: string) => void;
  onBlur?: () => void;
  onWikiLinkClick?: (thoughtId: string) => void;
}) {
  const onUpdateRef = useRef(onUpdate);
  const onBlurRef = useRef(onBlur);
  const onWikiLinkClickRef = useRef(onWikiLinkClick);
  const contentKeyRef = useRef(contentKey);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    onBlurRef.current = onBlur;
  }, [onBlur]);

  useEffect(() => {
    onWikiLinkClickRef.current = onWikiLinkClick;
  }, [onWikiLinkClick]);

  const handleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
      "a[data-wiki-link]",
    );
    const thoughtId = link?.dataset.wikiLink;
    if (!thoughtId) return;

    event.preventDefault();
    onWikiLinkClickRef.current?.(thoughtId);
  }, []);

  const uploadAsset = useCallback(async (file: File) => {
    return ipcClient.asset.saveAsset(await file.arrayBuffer(), file.name);
  }, []);

  const editor = useEditor(
    (root) =>
      createReflectaMilkdownEditorBuilder({
        root,
        content,
        placeholder,
        readonly,
        uploadAsset,
        onUpdate: (next) => {
          onUpdateRef.current?.(next);
        },
        onBlur: () => {
          onBlurRef.current?.();
        },
      }),
    [placeholder, readonly, uploadAsset],
  );

  useEffect(() => {
    const instance = editor.get();
    if (!instance) return;

    if (contentKey === undefined) {
      contentKeyRef.current = undefined;
    } else {
      if (contentKeyRef.current === contentKey) return;
      contentKeyRef.current = contentKey;
    }

    if (milkdownMarkdownEquals(content, getMilkdownMarkdown(instance))) return;

    setMilkdownMarkdown(instance, content);
  }, [content, contentKey, editor]);

  return (
    <div className="reflecta-md-editor__surface" onClick={handleClick}>
      <Milkdown />
    </div>
  );
}

export function MarkdownEditor({
  contentKey,
  initialContent,
  content = "",
  width = "100%",
  height = 400,
  maxHeight,
  placeholder = "请输入",
  readonly,
  className,
  onUpdate,
  onBlur,
  onWikiLinkClick,
}: MarkdownEditorProps) {
  const editorContent = initialContent ?? content;
  const autoGrow = height === "auto";

  return (
    <div
      className={cn("reflecta-md-editor", autoGrow && "reflecta-md-editor--auto-grow", className)}
      data-no-drag
      style={{
        width: toCssSize(width),
        height: autoGrow ? undefined : toCssSize(height),
        ...(autoGrow && maxHeight != null
          ? { "--reflecta-md-editor-max-height": toCssSize(maxHeight) }
          : {}),
      }}
    >
      <MilkdownProvider>
        <MarkdownEditorSurface
          contentKey={contentKey}
          content={editorContent}
          placeholder={placeholder}
          readonly={readonly}
          onUpdate={onUpdate}
          onBlur={onBlur}
          onWikiLinkClick={onWikiLinkClick}
        />
      </MilkdownProvider>
    </div>
  );
}
