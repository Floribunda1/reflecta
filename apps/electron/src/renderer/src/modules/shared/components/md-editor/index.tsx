import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { editorViewCtx } from "@milkdown/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@renderer/lib/utils";
import { ipcClient } from "@renderer/utils/ipc";
import type { ThoughtSummaryDTO } from "@shared/thought";
import { formatThoughtWikiLink } from "../wiki-links";
import {
  createReflectaMilkdownEditorBuilder,
  getMilkdownMarkdown,
  setMilkdownMarkdown,
} from "./milkdown-editor";
import {
  insertWikiLinkMarkdown,
  type WikiLinkMenuState,
  type WikiLinkPluginController,
} from "./wiki-link-plugin";
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

const inactiveWikiLinkState: WikiLinkMenuState = { active: false };

function titleForThought(thought: ThoughtSummaryDTO): string {
  const title = thought.title?.trim();
  if (title) return title;
  const firstLine = thought.body
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine || "未命名理解";
}

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
  const wikiResultsRef = useRef<ThoughtSummaryDTO[]>([]);
  const wikiStateRef = useRef<WikiLinkMenuState>(inactiveWikiLinkState);
  const [wikiState, setWikiState] = useState<WikiLinkMenuState>(inactiveWikiLinkState);
  const [wikiResults, setWikiResults] = useState<ThoughtSummaryDTO[]>([]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const uploadAsset = useCallback(async (file: File) => {
    return ipcClient.asset.saveAsset(await file.arrayBuffer(), file.name);
  }, []);

  const wikiLinkController = useMemo<WikiLinkPluginController>(
    () => ({
      onStateChange: (next) => {
        wikiStateRef.current = next;
        setWikiState(next);
      },
      getItemCount: () => wikiResultsRef.current.length,
      getSelectedMarkdown: (state) => {
        const thought = wikiResultsRef.current[state.selectedIndex];
        if (!thought) return null;

        return formatThoughtWikiLink({
          id: thought.id,
          title: titleForThought(thought),
        });
      },
    }),
    [],
  );

  const editor = useEditor(
    (root) =>
      createReflectaMilkdownEditorBuilder({
        root,
        content,
        placeholder,
        readonly,
        uploadAsset,
        wikiLinkController: readonly ? undefined : wikiLinkController,
        onUpdate: (next) => {
          onUpdateRef.current?.(next);
        },
      }),
    [placeholder, readonly, uploadAsset, wikiLinkController],
  );

  useEffect(() => {
    if (!wikiState.active) {
      wikiResultsRef.current = [];
      setWikiResults([]);
      return;
    }

    let cancelled = false;
    wikiResultsRef.current = [];
    setWikiResults([]);

    const loadResults = async () => {
      const client = ipcClient as Partial<IpcServices>;
      if (!client.search || !client.thought) {
        if (!cancelled) {
          wikiResultsRef.current = [];
          setWikiResults([]);
        }
        return;
      }

      const query = wikiState.query.trim();
      const results = query
        ? await client.search.searchThoughts(query)
        : await client.thought.listThoughts();
      if (cancelled) return;

      const next = results.slice(0, 8);
      wikiResultsRef.current = next;
      setWikiResults(next);
    };

    void loadResults();

    return () => {
      cancelled = true;
    };
  }, [wikiState.active, wikiState.active ? wikiState.query : ""]);

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

  const selectWikiLink = useCallback(
    (thought: ThoughtSummaryDTO) => {
      const instance = editor.get();
      if (!instance || !wikiStateRef.current.active) return;

      insertWikiLinkMarkdown(
        instance.ctx.get(editorViewCtx),
        wikiStateRef.current,
        formatThoughtWikiLink({
          id: thought.id,
          title: titleForThought(thought),
        }),
      );
    },
    [editor],
  );

  return (
    <div className="reflecta-md-editor__surface">
      <Milkdown />
      {wikiState.active && wikiResults.length > 0 && (
        <div
          className="reflecta-md-editor__wiki-menu"
          role="listbox"
          aria-label="Wiki link suggestions"
        >
          {wikiResults.map((thought, index) => {
            const active = index === wikiState.selectedIndex;
            const title = titleForThought(thought);
            return (
              <button
                key={thought.id}
                type="button"
                role="option"
                aria-selected={active}
                className={cn("reflecta-md-editor__wiki-menu-item", active && "active")}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectWikiLink(thought)}
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
