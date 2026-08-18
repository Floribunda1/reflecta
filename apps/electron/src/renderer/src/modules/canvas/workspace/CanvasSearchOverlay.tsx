import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@reflecta/ui/components/input";

/**
 * 画布内搜索浮层（M2-6）：⌘/Ctrl+F 打开。
 * 范围（由 workspace 从 store 文档 + 展示数据构建）：
 * 理解卡标题 / 正文、文本卡内容、组名、连线标签、画布引用标题。
 * 过滤在浮层内做；命中后由 workspace 定位/选中（centerCell + 缩放）。Esc 关闭。
 */
export type CanvasSearchIndexItem = {
  id: string;
  kind: string;
  /** 主文本（标题 / 内容 / 组名 / 标签） */
  text: string;
};

export function CanvasSearchOverlay({
  index,
  onSelect,
  onClose,
}: {
  index: CanvasSearchIndexItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return index.filter((item) => item.text.toLowerCase().includes(q));
  }, [index, query]);

  const kindLabel: Record<string, string> = {
    understanding: "理解",
    text: "文本",
    shape: "图形",
    group: "组",
    canvas_ref: "画布引用",
    edge: "连线",
  };

  const commit = (id: string) => onSelect(id);

  return (
    <div
      data-testid="canvas-search-overlay"
      className="absolute left-1/2 top-3 z-30 w-80 -translate-x-1/2 rounded-lg border bg-background/95 shadow-lg"
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Search size={14} className="shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((a) => Math.min(a + 1, matches.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (event.key === "Enter" && matches[active]) {
              commit(matches[active].id);
            }
          }}
          data-testid="canvas-search-input"
          placeholder="搜索卡片 / 组 / 连线标签…"
          className="h-7 border-transparent bg-transparent px-1 shadow-none focus-visible:ring-0"
        />
      </div>
      <div className="max-h-64 overflow-y-auto p-1">
        {query.trim() && matches.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">无匹配结果</div>
        ) : (
          matches.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => commit(item.id)}
              onMouseEnter={() => setActive(i)}
              data-testid="canvas-search-result"
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                i === active ? "bg-accent" : ""
              }`}
            >
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {kindLabel[item.kind] ?? item.kind}
              </span>
              <span className="truncate">{item.text}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
