import { useLatest } from "ahooks";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { FileText, LayoutGrid, MessageCircleDashed, NotebookText, X } from "lucide-react";
import { Empty, EmptyDescription } from "../components/empty";
import {
  cloneElement,
  lazy,
  memo,
  Suspense,
  useCallback,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement,
  type SVGAttributes,
} from "react";
import type { Activity, ThemeInput } from "react-activity-calendar";
import "react-activity-calendar/tooltips.css";
import { Button } from "../components/button";
import { Skeleton } from "../components/skeleton";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "../components/item";
import { ScrollArea } from "../components/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "../components/popover";
import { cn } from "#lib/utils";

const ActivityCalendar = lazy(async () => {
  const module = await import("react-activity-calendar");
  return { default: module.ActivityCalendar };
});

export type ParticipationAssetsView = {
  understanding: number;
  canvas: number;
  context: number;
};

export type ParticipationActivityDay = {
  date: string;
  count: number;
  level: number;
};

export type ParticipationDayCounts = {
  conversations: number;
  messages: number;
  understandingCreated: number;
  canvasCreated: number;
  contextCreated: number;
};

export type ParticipationDayDetail = {
  sessions: readonly { id: string; title: string; messageCount: number }[];
  understandings: readonly { id: string; title: string }[];
  contexts: readonly { id: string; medium: string; title: string }[];
  canvases: readonly { id: string; title: string }[];
};

export type ParticipationOverviewProps = {
  assets: ParticipationAssetsView | null;
  days: readonly ParticipationActivityDay[] | null;
  getDayCounts?: (date: string) => ParticipationDayCounts | undefined;
  resolveDayDetail?: (date: string) => ParticipationDayDetail;
  hidden?: boolean;
  className?: string;
};

function dayTitle(date: string): string {
  return `${format(new Date(`${date}T00:00:00`), "yyyy年M月d日 EEEE", { locale: zhCN })}`;
}

function buildParticipationTip(detail: ParticipationDayCounts): string {
  const parts: string[] = [];
  if (detail.conversations > 0) parts.push(`对话 ${detail.conversations} 次`);
  if (detail.messages > 0) parts.push(`消息 ${detail.messages} 条`);
  if (detail.understandingCreated > 0) parts.push(`创建理解 ${detail.understandingCreated} 条`);
  if (detail.canvasCreated > 0) parts.push(`创建画布 ${detail.canvasCreated} 个`);
  if (detail.contextCreated > 0) parts.push(`创建上下文 ${detail.contextCreated} 条`);
  return parts.length > 0 ? parts.join(" · ") : "无参与";
}

function activityTip(
  date: string,
  getDayCounts: ((date: string) => ParticipationDayCounts | undefined) | undefined,
): string {
  const detail = getDayCounts?.(date);
  return detail
    ? `${dayTitle(date)}：${buildParticipationTip(detail)}`
    : `${dayTitle(date)}：无参与`;
}

function DayDetail({ detail }: { detail: ParticipationDayDetail }) {
  if (
    detail.sessions.length === 0 &&
    detail.understandings.length === 0 &&
    detail.contexts.length === 0 &&
    detail.canvases.length === 0
  ) {
    return (
      <Empty className="py-6">
        <EmptyDescription>这一天没有参与记录。</EmptyDescription>
      </Empty>
    );
  }

  return (
    <div className="space-y-5">
      {detail.sessions.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MessageCircleDashed className="size-3.5" />
            <span>对话</span>
          </div>
          <ItemGroup className="gap-1.5">
            {detail.sessions.map((session) => (
              <Item key={session.id} variant="muted" size="sm">
                <ItemMedia variant="icon">
                  <MessageCircleDashed className="text-muted-foreground" />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle>{session.title}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <span className="text-xs text-muted-foreground">
                    {session.messageCount} 条消息
                  </span>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </section>
      ) : null}
      {detail.understandings.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <FileText className="size-3.5" />
            <span>理解</span>
          </div>
          <ItemGroup className="gap-1.5">
            {detail.understandings.map((understanding) => (
              <Item key={understanding.id} variant="outline" size="sm">
                <ItemMedia variant="icon">
                  <FileText className="text-muted-foreground" />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle>{understanding.title}</ItemTitle>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </section>
      ) : null}
      {detail.canvases.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <LayoutGrid className="size-3.5" />
            <span>画布</span>
          </div>
          <ItemGroup className="gap-1.5">
            {detail.canvases.map((canvas) => (
              <Item key={canvas.id} variant="outline" size="sm">
                <ItemMedia variant="icon">
                  <LayoutGrid className="text-muted-foreground" />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle>{canvas.title}</ItemTitle>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </section>
      ) : null}
      {detail.contexts.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <NotebookText className="size-3.5" />
            <span>上下文</span>
          </div>
          <ItemGroup className="gap-1.5">
            {detail.contexts.map((context) => (
              <Item key={context.id} variant="muted" size="sm">
                <ItemMedia variant="icon">
                  <NotebookText className="text-muted-foreground" />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle>{context.title}</ItemTitle>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </section>
      ) : null}
    </div>
  );
}

function AssetStat({ stat, label, total }: { stat: string; label: string; total: number }) {
  return (
    <div data-stat={stat} className="flex items-baseline gap-2">
      <span className="min-w-8 text-right text-lg font-semibold tabular-nums leading-none">
        {total}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

const PARTICIPATION_CALENDAR_THEME: ThemeInput = {
  light: ["var(--muted)", "var(--primary)"],
  dark: ["var(--muted)", "var(--primary)"],
};

const PARTICIPATION_CALENDAR_LABELS = {
  months: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
  weekdays: ["日", "一", "二", "三", "四", "五", "六"],
  totalCount: "共 {{count}} 次参与",
};

// 骨架高度与真实日历一致：7 行 10px 方块 + 6 个 3px 间距，避免加载前后布局跳动。
const HEATMAP_HEIGHT = 7 * 10 + 6 * 3;

/** 热力图骨架：整块标准 Skeleton，尺寸对位真实日历。 */
function ParticipationHeatmapSkeleton() {
  return (
    <div className="min-w-0 flex-1" aria-hidden>
      <Skeleton className="w-full" style={{ height: HEATMAP_HEIGHT }} />
    </div>
  );
}

/** 整体骨架：资产列 + 热力图，与数据加载完成后的布局同构。 */
function ParticipationOverviewSkeleton() {
  return (
    <div
      data-testid="participation-overview-skeleton"
      className="flex shrink-0 items-center gap-4"
      role="status"
      aria-label="正在加载参与足迹"
    >
      <div className="flex shrink-0 flex-col justify-center gap-3 border-r pr-4" aria-hidden>
        <Skeleton className="h-5 w-14" />
        <Skeleton className="h-5 w-14" />
        <Skeleton className="h-5 w-14" />
      </div>
      <ParticipationHeatmapSkeleton />
    </div>
  );
}

const EMPTY_DAY_DETAIL: ParticipationDayDetail = {
  sessions: [],
  understandings: [],
  contexts: [],
  canvases: [],
};

/**
 * 捕获页顶部足迹：资产存量与 365 天热力图同排。
 * 数据由 Adapter 算好再传入；点击格子打开当天明细。
 */
export const ParticipationOverview = memo(function ParticipationOverview({
  assets,
  days,
  getDayCounts,
  resolveDayDetail,
  hidden = false,
  className,
}: ParticipationOverviewProps) {
  const [dayPopover, setDayPopover] = useState<{ date: string } | null>(null);
  const dayAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const getDayCountsRef = useLatest(getDayCounts);

  const openDay = useCallback((event: MouseEvent, date: string) => {
    const target = (event.target as Element | null)?.closest("rect[data-date]");
    const rect = (target ?? (event.currentTarget as Element)).getBoundingClientRect();
    dayAnchorRef.current = { x: rect.left, y: rect.bottom };
    setDayPopover({ date });
  }, []);

  const renderBlock = useCallback(
    (block: ReactElement, activity: Activity) => {
      return cloneElement(block, {
        "data-date": activity.date,
        title: activityTip(activity.date, getDayCountsRef.current),
      } as unknown as SVGAttributes<SVGRectElement>);
    },
    [getDayCountsRef],
  );

  return (
    <div
      data-testid="participation-overview"
      hidden={hidden}
      className={cn(hidden ? "hidden" : "flex shrink-0 items-center gap-4", className)}
    >
      {assets ? (
        <div className="flex shrink-0 flex-col justify-center gap-3 border-r pr-4">
          <AssetStat stat="理解" label="理解" total={assets.understanding} />
          <AssetStat stat="画布" label="画布" total={assets.canvas} />
          <AssetStat stat="上下文" label="上下文" total={assets.context} />
        </div>
      ) : null}

      {!assets || !days ? (
        <ParticipationOverviewSkeleton />
      ) : (
        <div
          data-testid="participation-heatmap"
          role="group"
          aria-label="参与足迹"
          className="min-w-0 flex-1 overflow-x-auto text-muted-foreground"
          onClick={(event) => {
            const target = (event.target as Element | null)?.closest("rect[data-date]");
            const date = target?.getAttribute("data-date");
            if (date) openDay(event, date);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            const target = (event.target as Element | null)?.closest("rect[data-date]");
            const date = target?.getAttribute("data-date");
            if (date) openDay(event as unknown as MouseEvent, date);
          }}
        >
          <Suspense fallback={<ParticipationHeatmapSkeleton />}>
            <ActivityCalendar
              data={days as Activity[]}
              weekStart={1}
              blockSize={10}
              blockMargin={3}
              blockRadius={2}
              fontSize={11}
              theme={PARTICIPATION_CALENDAR_THEME}
              labels={PARTICIPATION_CALENDAR_LABELS}
              showWeekdayLabels={["mon", "wed", "fri"]}
              showTotalCount={false}
              showColorLegend={false}
              tooltips={{
                activity: {
                  text: (activity: Activity) => activityTip(activity.date, getDayCountsRef.current),
                },
              }}
              renderBlock={renderBlock}
            />
          </Suspense>
        </div>
      )}

      {dayPopover && dayAnchorRef.current ? (
        <Popover open onOpenChange={(open) => !open && setDayPopover(null)}>
          <PopoverTrigger
            nativeButton={false}
            render={
              <div
                className="pointer-events-none fixed z-50 h-px w-px"
                style={{
                  left: dayAnchorRef.current.x,
                  top: dayAnchorRef.current.y,
                }}
              />
            }
          />
          <PopoverContent
            data-testid="participation-day-popover"
            align="start"
            side="bottom"
            sideOffset={6}
            className="w-80 gap-0 overflow-hidden p-0"
          >
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
              <PopoverHeader>
                <PopoverTitle>{dayTitle(dayPopover.date)}</PopoverTitle>
              </PopoverHeader>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="关闭"
                onClick={() => setDayPopover(null)}
              >
                <X size={14} />
              </Button>
            </div>
            <ScrollArea className="max-h-[min(70vh,28rem)]">
              <div className="p-3">
                <DayDetail detail={resolveDayDetail?.(dayPopover.date) ?? EMPTY_DAY_DETAIL} />
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
});
