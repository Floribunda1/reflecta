import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@renderer/lib/utils";
import { ipcClient } from "@renderer/utils/ipc";
import type { ThoughtSummaryDTO } from "@shared/thought";
import {
  findWikiLinkTrigger,
  getTextBeforeCursor,
  insertMarkdownReplacingTrigger,
} from "./editor-actions";
import {
  createReflectaMilkdownEditorBuilder,
  getMilkdownMarkdown,
  setMilkdownMarkdown,
} from "./milkdown-editor";
import "./milkdown-theme.css";

type MarkdownEditorProps = {
  content?: string;
  width?: number | string;
  height?: number | string;
  enableWikiLink?: boolean;
  placeholder?: string;
  variant?: "default" | "plain";
  className?: string;
  onUpdate?: (value: string) => void;
};

type WikiMenu = { fromOffset: number; query: string } | null;

function titleForThought(thought: ThoughtSummaryDTO): string {
  const title = thought.title?.trim();
  if (title) return title;
  const firstLine = thought.body
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine || "未命名理解";
}

function getDomTextBeforeCursor(): string {
  const selection = window.getSelection();
  if (!selection || !selection.isCollapsed || !selection.anchorNode) return "";
  const text = selection.anchorNode.textContent ?? "";
  return text.slice(0, selection.anchorOffset);
}

function MarkdownEditorSurface({
  content,
  placeholder,
  onUpdate,
}: {
  content: string;
  placeholder: string;
  onUpdate?: (value: string) => void;
}) {
  const contentRef = useRef(content);
  const lastMarkdownRef = useRef(content);
  const onUpdateRef = useRef(onUpdate);
  const isApplyingExternalContentRef = useRef(false);
  const isReadyForUserUpdatesRef = useRef(false);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [wikiMenu, setWikiMenu] = useState<WikiMenu>(null);
  const [wikiResults, setWikiResults] = useState<ThoughtSummaryDTO[]>([]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const uploadAsset = useCallback(async (file: File) => {
    return ipcClient.asset.saveAsset(await file.arrayBuffer(), file.name);
  }, []);

  const updateMenuFromText = useCallback((textBeforeCursor: string) => {
    const wiki = findWikiLinkTrigger(textBeforeCursor);
    if (wiki) {
      setWikiMenu(wiki);
      return;
    }

    setWikiMenu(null);
  }, []);

  const editor = useEditor(
    (root) =>
      createReflectaMilkdownEditorBuilder({
        root,
        content: contentRef.current,
        placeholder,
        uploadAsset,
        onUpdate: (next) => {
          if (
            !isReadyForUserUpdatesRef.current ||
            isApplyingExternalContentRef.current ||
            !surfaceRef.current?.contains(document.activeElement) ||
            next === lastMarkdownRef.current
          ) {
            lastMarkdownRef.current = next;
            return;
          }

          lastMarkdownRef.current = next;
          onUpdateRef.current?.(next);
          updateMenuFromText(next.split("\n").at(-1) ?? "");
        },
        onTextBeforeCursorChange: updateMenuFromText,
      }),
    [placeholder, uploadAsset, updateMenuFromText],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      isReadyForUserUpdatesRef.current = true;
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      isReadyForUserUpdatesRef.current = false;
    };
  }, []);

  useEffect(() => {
    const instance = editor.get();
    if (!instance) return;
    if (content === lastMarkdownRef.current) return;
    if (content === getMilkdownMarkdown(instance)) return;

    isApplyingExternalContentRef.current = true;
    setMilkdownMarkdown(instance, content);
    lastMarkdownRef.current = content;
    queueMicrotask(() => {
      isApplyingExternalContentRef.current = false;
    });
  }, [content, editor]);

  useEffect(() => {
    if (!wikiMenu) return;
    let cancelled = false;

    const load = async () => {
      const client = ipcClient as Partial<IpcServices>;
      if (!client.search || !client.thought) {
        if (!cancelled) setWikiResults([]);
        return;
      }
      const results = wikiMenu.query.trim()
        ? await client.search.searchThoughts(wikiMenu.query.trim())
        : await client.thought.listThoughts();
      if (!cancelled) setWikiResults(results.slice(0, 8));
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [wikiMenu]);

  const refreshMenu = useCallback(() => {
    const instance = editor.get();
    if (!instance) return;

    updateMenuFromText(getTextBeforeCursor(instance));
  }, [editor, updateMenuFromText]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    let proseMirror: Element | null = null;
    const handler = () => {
      queueMicrotask(() => updateMenuFromText(getDomTextBeforeCursor()));
    };
    const attach = () => {
      const next = surface.querySelector(".ProseMirror");
      if (!next || next === proseMirror) return;
      proseMirror?.removeEventListener("beforeinput", handler);
      proseMirror?.removeEventListener("input", handler);
      proseMirror?.removeEventListener("keyup", handler);
      proseMirror?.removeEventListener("mouseup", handler);
      proseMirror = next;
      proseMirror.addEventListener("beforeinput", handler);
      proseMirror.addEventListener("input", handler);
      proseMirror.addEventListener("keyup", handler);
      proseMirror.addEventListener("mouseup", handler);
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(surface, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      proseMirror?.removeEventListener("beforeinput", handler);
      proseMirror?.removeEventListener("input", handler);
      proseMirror?.removeEventListener("keyup", handler);
      proseMirror?.removeEventListener("mouseup", handler);
    };
  }, [updateMenuFromText]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const surface = surfaceRef.current;
      if (!surface || !surface.contains(document.activeElement)) return;
      updateMenuFromText(getDomTextBeforeCursor());
    }, 150);

    return () => window.clearInterval(interval);
  }, [updateMenuFromText]);

  const insertWikiLink = useCallback(
    (markdown: string) => {
      const instance = editor.get();
      if (!instance || !wikiMenu) return;
      insertMarkdownReplacingTrigger(instance, {
        fromOffset: wikiMenu.fromOffset,
        markdown,
      });
      setWikiMenu(null);
    },
    [editor, wikiMenu],
  );

  return (
    <div
      ref={surfaceRef}
      className="reflecta-md-editor__surface"
      onInputCapture={() => {
        queueMicrotask(() => updateMenuFromText(getDomTextBeforeCursor()));
      }}
      onKeyUpCapture={() => {
        queueMicrotask(() => updateMenuFromText(getDomTextBeforeCursor()));
      }}
      onKeyUp={refreshMenu}
      onMouseUp={refreshMenu}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setWikiMenu(null);
      }}
    >
      <Milkdown />
      {wikiMenu && wikiResults.length > 0 && (
        <div className="reflecta-md-editor__menu" tabIndex={-1}>
          {wikiResults.map((thought) => {
            const title = titleForThought(thought);
            return (
              <button
                key={thought.id}
                type="button"
                className="reflecta-md-editor__menu-item"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertWikiLink(`[[${title}#${thought.id}]]`)}
              >
                <span>{title}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MarkdownEditor({
  content = "",
  width = "100%",
  height = 400,
  placeholder = "请输入",
  variant = "default",
  className,
  onUpdate,
}: MarkdownEditorProps) {
  return (
    <div
      className={cn("reflecta-md-editor", className)}
      data-variant={variant}
      data-no-drag
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
    >
      <MilkdownProvider>
        <MarkdownEditorSurface content={content} placeholder={placeholder} onUpdate={onUpdate} />
      </MilkdownProvider>
    </div>
  );
}
