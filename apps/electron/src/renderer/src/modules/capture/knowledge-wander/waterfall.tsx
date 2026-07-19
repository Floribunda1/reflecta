import { useScroll, useSize } from "ahooks";
import { useMasonry, usePositioner, useResizeObserver } from "masonic";
import type { RenderComponentProps } from "masonic";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@renderer/components/ui/card";
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
    <Card
      role="button"
      tabIndex={0}
      data-testid="knowledge-wander-card"
      data-understanding-id={understanding.id}
      data-understanding-title={title}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "w-full cursor-pointer text-left shadow-sm outline-none ring-1 ring-foreground/10 transition-[box-shadow,background-color] hover:shadow-md hover:ring-foreground/15 focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "bg-accent/25 ring-2 ring-primary/45",
      )}
      onClick={() => onSelect(understanding.id)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect(understanding.id);
      }}
    >
      <CardHeader>
        <CardTitle className="font-semibold leading-snug text-foreground">{title}</CardTitle>
      </CardHeader>

      <CardContent className="min-w-0">
        {understanding.body ? (
          <KnowledgeWanderMarkdown content={understanding.body} />
        ) : (
          <span className="text-sm text-muted-foreground">空理解，可以直接开始写。</span>
        )}
      </CardContent>

      <CardFooter className="min-w-0 gap-3 border-t text-xs text-muted-foreground/75">
        {domainLabel ? <span className="min-w-0 flex-1 truncate">{domainLabel}</span> : null}
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
      </CardFooter>
    </Card>
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
      className="h-full overflow-y-auto bg-muted/35 p-5"
    >
      <div ref={layoutRef} className="w-full">
        {masonry}
      </div>
    </section>
  );
}
