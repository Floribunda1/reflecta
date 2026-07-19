import { useScroll, useSize } from "ahooks";
import { useMasonry, usePositioner, useResizeObserver } from "masonic";
import type { RenderComponentProps } from "masonic";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { cn } from "@renderer/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { FileText, Link2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getUnderstandingTitle } from "../understanding-title";
import { KnowledgeWanderMarkdown } from "./markdown";

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
  const title = getUnderstandingTitle(understanding);

  return (
    <article
      role="button"
      tabIndex={0}
      data-testid="knowledge-wander-card"
      data-understanding-id={understanding.id}
      data-understanding-title={title}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full cursor-pointer flex-col gap-4 rounded-lg border bg-card p-5 text-left text-card-foreground shadow-xs outline-none transition-colors hover:bg-muted/20 focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "border-primary ring-1 ring-ring/20",
      )}
      onClick={() => onSelect(understanding.id)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect(understanding.id);
      }}
    >
      <div className="text-base font-semibold leading-snug text-foreground">{title}</div>

      <div className="min-w-0">
        {understanding.body ? (
          <KnowledgeWanderMarkdown content={understanding.body} />
        ) : (
          <span className="text-sm text-muted-foreground">空理解，可以直接开始写。</span>
        )}
      </div>

      {domainLabel ? (
        <div className="truncate text-xs text-muted-foreground/75">{domainLabel}</div>
      ) : null}

      <div className="flex min-w-0 items-center gap-3 text-xs text-muted-foreground/75">
        <span
          className="inline-flex items-center gap-1"
          aria-label={`${understanding.contextCount} 个上下文`}
        >
          <FileText size={13} aria-hidden />
          {understanding.contextCount}
        </span>
        <span
          className="inline-flex items-center gap-1"
          aria-label={`${understanding.connectionCount} 个双链关系`}
        >
          <Link2 size={13} aria-hidden />
          {understanding.connectionCount}
        </span>
        <span className="ml-auto shrink-0">{updatedLabel}</span>
      </div>
    </article>
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
  const layoutRef = useRef<HTMLDivElement>(null);
  const viewportSize = useSize(scrollRef);
  const layoutSize = useSize(layoutRef);
  const scroll = useScroll(scrollRef);
  const [measurementPass, setMeasurementPass] = useState(0);
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
      width: Math.max(1, layoutSize?.width ?? 1),
      columnWidth: 520,
      columnGutter: 20,
      rowGutter: 20,
      maxColumnCount: 2,
    },
    [itemOrderKey, scopeKey, measurementPass],
  );
  const resizeObserver = useResizeObserver(positioner);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [scopeKey]);

  useEffect(() => {
    // Rich Markdown changes the measured card heights after Masonic's first placement.
    // Rebuild once on the next frame so items can rebalance across columns.
    const frame = window.requestAnimationFrame(() => setMeasurementPass((value) => value + 1));
    return () => window.cancelAnimationFrame(frame);
  }, [itemOrderKey, scopeKey, layoutSize?.width]);

  const masonry = useMasonry({
    items,
    positioner,
    resizeObserver,
    height: Math.max(1, viewportSize?.height ?? 1),
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
      className="h-full overflow-y-auto bg-background/35 px-5 py-6"
    >
      <div ref={layoutRef} className="w-full">
        {masonry}
      </div>
    </section>
  );
}
