import { useLatest } from "ahooks";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { X } from "lucide-react";
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
  if (detail.sessions.length === 0 && detail.understandings.length === 0) {
    return <p className="text-sm text-muted-foreground">这一天没有参与记录。</p>;
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      {detail.sessions.length > 0 ? (
        <div>
          <span className="text-xs font-medium text-muted-foreground">对话</span>
          <ul className="mt-1 flex flex-col gap-1">
            {detail.sessions.map((session) => (
              <li key={session.id} className="truncate text-muted-foreground">
                {session.title} · {session.messageCount} 条消息
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {detail.understandings.length > 0 ? (
        <div>
          <span className="text-xs font-medium text-muted-foreground">理解</span>
          <ul className="mt-1 flex flex-col gap-1">
            {detail.understandings.map((understanding) => (
              <li key={understanding.id} className="truncate">
                {understanding.title}
              </li>
            ))}
          </ul>
        </div>
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

const EMPTY_DAY_DETAIL: ParticipationDayDetail = { sessions: [], understandings: [] };

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

      {days ? (
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
          <Suspense fallback={<div className="h-[118px] min-w-0" />}>
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
      ) : null}

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
            className="w-80"
          >
            <div className="flex items-center justify-between gap-2">
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
            <DayDetail detail={resolveDayDetail?.(dayPopover.date) ?? EMPTY_DAY_DETAIL} />
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
});
