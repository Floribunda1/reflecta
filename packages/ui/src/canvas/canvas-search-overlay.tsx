import { FileText, Group, LayoutGrid, Spline, Type, type LucideIcon } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../components/command";

/**
 * 画布内搜索：⌘/Ctrl+F 打开 Command Dialog。
 * 范围由上层从文档 + 展示数据构建：理解卡标题 / 正文、文本卡内容、组名、连线标签、画布引用标题。
 * 过滤由 Command 承担；命中后由上层定位/选中。Esc / 点遮罩关闭。
 */
const KIND_LABEL: Record<string, string> = {
  understanding: "理解",
  text: "文本",
  group: "组",
  canvas_ref: "画布引用",
  edge: "连线",
};

const KIND_ICON: Record<string, LucideIcon> = {
  understanding: FileText,
  text: Type,
  group: Group,
  canvas_ref: LayoutGrid,
  edge: Spline,
};

export type CanvasSearchIndexItem = {
  id: string;
  kind: string;
  /** 主文本（标题 / 内容 / 组名 / 标签） */
  text: string;
};

export type CanvasSearchOverlayProps = {
  index: CanvasSearchIndexItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
};

export function CanvasSearchOverlay({ index, onSelect, onClose }: CanvasSearchOverlayProps) {
  return (
    <CommandDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="搜索画布"
      description="按标题、组名或连线标签查找元素"
      className="sm:max-w-lg"
    >
      <Command data-testid="canvas-search-overlay">
        <CommandInput placeholder="搜索卡片 / 组 / 连线标签…" data-testid="canvas-search-input" />
        <CommandList>
          <CommandEmpty>无匹配结果</CommandEmpty>
          <CommandGroup>
            {index.map((item) => {
              const kindLabel = KIND_LABEL[item.kind] ?? item.kind;
              const Icon = KIND_ICON[item.kind];
              return (
                <CommandItem
                  key={item.id}
                  value={`${item.text} ${kindLabel} ${item.id}`}
                  aria-label={`${kindLabel} ${item.text}`}
                  data-testid="canvas-search-result"
                  onSelect={() => onSelect(item.id)}
                >
                  {Icon ? <Icon className="text-muted-foreground" /> : null}
                  <span className="min-w-0 flex-1 truncate">{item.text}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
