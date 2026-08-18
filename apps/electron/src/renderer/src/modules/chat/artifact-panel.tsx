import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  ChevronDown,
  FileText,
  FolderTree,
  NotebookPen,
  PanelsTopLeft,
  Sparkles,
} from "lucide-react";
import { cn } from "@reflecta/ui/lib/utils";
import {
  type ArtifactPanelView,
  type ArtifactType,
  type LandedArtifact,
} from "./session/artifact-panel";

const ARTIFACT_ICONS: Record<ArtifactType, typeof NotebookPen> = {
  understanding: NotebookPen,
  context: FileText,
  domain: FolderTree,
  canvas: PanelsTopLeft,
};

const NEW_LANDING_FLASH_MS = 1_600;

/**
 * 对话 artifact panel（C14 / M8-7 / U2）：header 下方单行产出条。
 * 只展示本对话已落地的产出（approved + saved），pending 提案留在消息流。
 * 行点击 = 打开实体详情（understanding/context 复用 chat 右面板 inspector，
 * domain 跳 capture 并选中；canvas 待画布工具落地后接 C13 跳转）。
 */
export function ArtifactPanel({
  view,
  onOpen,
}: {
  view: ArtifactPanelView;
  onOpen: (artifact: LandedArtifact) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [flash, setFlash] = useState(false);
  const prevTotalRef = useRef(view.total);

  useEffect(() => {
    const prevTotal = prevTotalRef.current;
    prevTotalRef.current = view.total;
    if (view.total <= prevTotal) return undefined;
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), NEW_LANDING_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [view.total]);

  if (view.total === 0) return null;

  const summary = view.groups.map((group) => `${group.label} ${group.items.length}`).join(" · ");

  return (
    <div
      data-testid="artifact-panel"
      className={cn(
        "shrink-0 border-b border-border/60 transition-colors",
        flash && "bg-primary/5",
      )}
    >
      <button
        type="button"
        data-testid="artifact-panel-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="flex h-8 w-full items-center gap-2 px-5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <Sparkles size={14} className={cn("shrink-0", flash && "text-primary")} />
        <span className="truncate">
          本对话产出 {view.total} 项{summary ? ` · ${summary}` : ""}
        </span>
        <ChevronDown
          size={14}
          className={cn("ml-auto shrink-0 transition-transform", expanded && "rotate-180")}
        />
      </button>
      {expanded ? (
        <div
          data-testid="artifact-panel-list"
          className="max-h-64 overflow-y-auto border-t border-border/40 px-4 py-2"
        >
          {view.groups.map((group) => {
            const Icon = ARTIFACT_ICONS[group.type];
            return (
              <div
                key={group.type}
                role="group"
                aria-label={group.label}
                className="px-1 pt-1 pb-1.5"
              >
                <div className="flex items-center gap-1.5 px-1 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground">
                  <Icon size={12} />
                  {group.label}
                  <span className="tabular-nums">{group.items.length}</span>
                </div>
                {group.items.map((artifact) => (
                  <button
                    key={artifact.id}
                    type="button"
                    data-testid={`artifact-item-${artifact.type}`}
                    title={artifact.title}
                    onClick={() => onOpen(artifact)}
                    className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-foreground/90 transition-colors hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1 truncate">{artifact.title}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {formatDistanceToNow(new Date(artifact.landingAt), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
