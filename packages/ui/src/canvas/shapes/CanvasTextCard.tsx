import { useEffect, useRef, useState } from "react";
import type { Node } from "@antv/x6";
import { SimpleMarkdownPreview } from "../../editor/simple-markdown-preview";
import type { CanvasElementDTO } from "../document";
import { CARD_BASE_CLASS, selectedCardClass } from "./shared";

/**
 * 文本卡（M3-B）：工具栏拖入创建；双击就地编辑（textarea + 简单 markdown 预览），
 * 失焦保存（M3-B2）——提交写回 node data（props.text），事件桥 → 防抖 saveCanvas 持久化（M3-B3）。
 */
export function CanvasTextCard({ node }: { node: Node }) {
  const element = node.getData<CanvasElementDTO>();
  const text = element.kind === "text" ? element.props.text : "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const startEditing = () => {
    setDraft(text);
    setEditing(true);
  };

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft === text) return;
    node.setData<CanvasElementDTO>({
      ...element,
      props: { ...element.props, text: draft },
    } as CanvasElementDTO);
  };

  return (
    <div
      data-testid="canvas-text-card"
      className={`${CARD_BASE_CLASS} ${selectedCardClass(false)} ${editing ? "ring-2 ring-ring" : ""}`}
      onDoubleClick={startEditing}
    >
      {editing ? (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDraft(text);
              setEditing(false);
            }
          }}
          className="h-full w-full resize-none bg-transparent p-2 text-xs leading-5 outline-none"
          aria-label="文本卡内容"
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <SimpleMarkdownPreview value={text} className="canvas-card-markdown" />
        </div>
      )}
    </div>
  );
}
