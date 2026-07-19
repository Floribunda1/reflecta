import { useScroll, useSize } from "ahooks";
import { useMasonry, usePositioner, useResizeObserver } from "masonic";
import type { RenderComponentProps } from "masonic";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { SimpleMarkdownPreview } from "@renderer/modules/shared/components/markdown-editor/preview";
import { cn } from "@renderer/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useEffect, useMemo, useRef } from "react";
import { getUnderstandingTitle } from "../understanding-title";

type WaterfallItem = {
  understanding: UnderstandingSummaryDTO;
  domainLabel: string | null;
  selected: boolean;
  onSelect: (id: string) => void;
};

function UnderstandingWanderCard({ data }: RenderComponentProps<WaterfallItem>) {
  const { understanding, domainLabel, selected, onSelect } = data;
  const updatedLabel = formatDistanceToNow(understanding.updatedAt, {
    addSuffix: true,
    locale: zhCN,
  });

  return (
    <button
      type="button"
      data-testid="knowledge-wander-card"
      data-understanding-id={understanding.id}
      data-understanding-title={getUnderstandingTitle(understanding)}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full flex-col gap-3 rounded-lg border bg-card p-4 text-left text-card-foreground shadow-xs outline-none transition-colors hover:bg-muted/20 focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "border-primary ring-1 ring-ring/20",
      )}
      onClick={() => onSelect(understanding.id)}
    >
      <div className="text-base font-semibold text-foreground">
        {getUnderstandingTitle(understanding)}
      </div>

      <div className="text-sm leading-6 text-muted-foreground">
        {understanding.body ? (
          <SimpleMarkdownPreview content={understanding.body} />
        ) : (
          <span>空理解，可以直接开始写。</span>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground/80">
        {domainLabel ? <span className="min-w-0 flex-1 truncate">{domainLabel}</span> : null}
        <span className="ml-auto shrink-0">{updatedLabel}</span>
      </div>
    </button>
  );
}

export function KnowledgeWaterfall({
  understandings,
  selectedUnderstandingId,
  scopeKey,
  getDomainLabel,
  onSelect,
}: {
  understandings: UnderstandingSummaryDTO[];
  selectedUnderstandingId: string | null;
  scopeKey: string;
  getDomainLabel: (understanding: UnderstandingSummaryDTO) => string | null;
  onSelect: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLElement>(null);
  const size = useSize(scrollRef);
  const scroll = useScroll(scrollRef);
  const itemOrderKey = understandings.map(({ id }) => id).join("|");
  const items = useMemo<WaterfallItem[]>(
    () =>
      understandings.map((understanding) => ({
        understanding,
        domainLabel: getDomainLabel(understanding),
        selected: understanding.id === selectedUnderstandingId,
        onSelect,
      })),
    [understandings, selectedUnderstandingId, getDomainLabel, onSelect],
  );
  const positioner = usePositioner(
    {
      width: Math.max(1, (size?.width ?? 1) - 32),
      columnWidth: 320,
      columnGutter: 12,
      rowGutter: 12,
      maxColumnCount: 4,
    },
    [itemOrderKey],
  );
  const resizeObserver = useResizeObserver(positioner);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [scopeKey]);

  const masonry = useMasonry({
    items,
    positioner,
    resizeObserver,
    height: Math.max(1, size?.height ?? 1),
    scrollTop: scroll?.top ?? 0,
    itemHeightEstimate: 240,
    itemKey: (item) => item.understanding.id,
    overscanBy: 2,
    role: "list",
    render: UnderstandingWanderCard,
  });

  return (
    <section
      ref={scrollRef}
      data-testid="knowledge-wander-waterfall"
      className="h-full overflow-y-auto bg-background/35 p-4"
    >
      {masonry}
    </section>
  );
}
