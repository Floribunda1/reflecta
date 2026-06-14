import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { useCallback, useEffect, useRef } from "react";
import { cn } from "@renderer/lib/utils";
import { ipcClient } from "@renderer/utils/ipc";
import {
  createReflectaMilkdownEditorBuilder,
  getMilkdownMarkdown,
  setMilkdownMarkdown,
} from "./milkdown-editor";
import "./milkdown-theme.scss";

type MarkdownEditorProps = {
  contentKey?: string;
  initialContent?: string;
  content?: string;
  width?: number | string;
  height?: number | string;
  placeholder?: string;
  readonly?: boolean;
  className?: string;
  onUpdate?: (value: string) => void;
};

function MarkdownEditorSurface({
  contentKey,
  content,
  placeholder,
  readonly,
  onUpdate,
}: {
  contentKey?: string;
  content: string;
  placeholder: string;
  readonly?: boolean;
  onUpdate?: (value: string) => void;
}) {
  const onUpdateRef = useRef(onUpdate);
  const contentKeyRef = useRef(contentKey);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

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

    if (content === getMilkdownMarkdown(instance)) return;

    setMilkdownMarkdown(instance, content);
  }, [content, contentKey, editor]);

  return (
    <div className="reflecta-md-editor__surface">
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
  placeholder = "请输入",
  readonly,
  className,
  onUpdate,
}: MarkdownEditorProps) {
  const editorContent = initialContent ?? content;

  return (
    <div
      className={cn("reflecta-md-editor", className)}
      data-no-drag
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
    >
      <MilkdownProvider>
        <MarkdownEditorSurface
          contentKey={contentKey}
          content={editorContent}
          placeholder={placeholder}
          readonly={readonly}
          onUpdate={onUpdate}
        />
      </MilkdownProvider>
    </div>
  );
}
