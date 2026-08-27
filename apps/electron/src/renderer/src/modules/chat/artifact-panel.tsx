import { useEffect, useRef, useState } from "react";
import { PanelsTopLeft, Sparkles } from "lucide-react";
import { cn } from "@reflecta/ui/lib/utils";
import { Button } from "@reflecta/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@reflecta/ui/components/popover";
import { entityIcon } from "@reflecta/ui/chat";
import { type ArtifactPanelView, type LandedArtifact } from "./session/artifact-panel";

const NEW_LANDING_FLASH_MS = 1_600;

/**
 * 对话 artifact panel（C14 / M8-7 / U2）：header actions 中的产出入口。
 * 只展示本对话已落地的产出（approved + saved），pending 提案留在消息流。
 * 条目点击 = 打开实体详情（understanding/context 复用 chat 右面板 inspector，
 * canvas 打开只读 dialog；domain 跳 capture 并选中）。
 */
export function ArtifactPanel({
  view,
  onOpen,
}: {
  view: ArtifactPanelView;
  onOpen: (artifact: LandedArtifact) => void;
}) {
  const [open, setOpen] = useState(false);
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

  const artifacts = view.groups
    .flatMap((group) => group.items)
    .sort((left, right) => right.landingAt.localeCompare(left.landingAt));

  return (
    <div data-testid="artifact-panel">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              data-testid="artifact-panel-toggle"
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`已生成 ${view.total} 项`}
              title={`已生成 ${view.total} 项`}
              className={cn(flash && "bg-primary/10 text-primary hover:bg-primary/15")}
            >
              <Sparkles aria-hidden="true" />
              <span className="tabular-nums">{view.total}</span>
            </Button>
          }
        />
        <PopoverContent
          data-testid="artifact-panel-list"
          align="end"
          sideOffset={6}
          className="max-h-64 w-[min(24rem,calc(100vw-2rem))] overflow-x-hidden overflow-y-auto p-1.5"
        >
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {artifacts.map((artifact) => {
              const Icon = artifact.type === "canvas" ? PanelsTopLeft : entityIcon(artifact.type);
              const typeLabel = view.groups.find((group) => group.type === artifact.type)?.label;
              if (!Icon) return null;
              return (
                <li key={`${artifact.type}:${artifact.id}`} className="min-w-0">
                  <button
                    type="button"
                    data-testid={`artifact-item-${artifact.id}`}
                    aria-label={`${typeLabel ?? artifact.type}：${artifact.title}`}
                    title={artifact.title}
                    onClick={() => {
                      setOpen(false);
                      onOpen(artifact);
                    }}
                    className="flex min-h-9 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{artifact.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
