import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Calendar, X } from "lucide-react";
import {
  cloneElement,
  lazy,
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement,
  type SVGAttributes,
} from "react";
import type { Activity, ThemeInput } from "react-activity-calendar";
import "react-activity-calendar/tooltips.css";
import { Button } from "@reflecta/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@reflecta/ui/components/popover";
import { useAtomValue } from "@effect/atom-react";
import { captureActions, prefsAtom } from "../store";
import { useParticipationOverview, type ParticipationOverviewData } from "../queries";
import {
  buildParticipationActivity,
  computeParticipationAssets,
  type DayDetailCounts,
} from "./participation-stats";

const ActivityCalendar = lazy(async () => {
  const module = await import("react-activity-calendar");
  return { default: module.ActivityCalendar };
});

function dayTitle(date: string): string {
  return `${format(new Date(`${date}T00:00:00`), "yyyy年M月d日 EEEE", { locale: zhCN })}`;
}

/** 某天的参与提示：只罗列当日实际发生的细分（对话/消息/各类型创建），0 值不展示。 */
function buildParticipationTip(detail: DayDetailCounts): string {
  const parts: string[] = [];
  if (detail.conversations > 0) parts.push(`对话 ${detail.conversations} 次`);
  if (detail.messages > 0) parts.push(`消息 ${detail.messages} 条`);
  if (detail.understandingCreated > 0) parts.push(`创建理解 ${detail.understandingCreated} 条`);
  if (detail.canvasCreated > 0) parts.push(`创建画布 ${detail.canvasCreated} 个`);
  if (detail.contextCreated > 0) parts.push(`创建上下文 ${detail.contextCreated} 条`);
  return parts.length > 0 ? parts.join(" · ") : "无参与";
}

function activityTip(date: string, details: ReadonlyMap<string, DayDetailCounts>): string {
  const detail = details.get(date);
  return detail
    ? `${dayTitle(date)}：${buildParticipationTip(detail)}`
    : `${dayTitle(date)}：无参与`;
}

function DayDetail({ date, data }: { date: string; data: ParticipationOverviewData }) {
  const dayKey = (iso: string) => format(new Date(iso), "yyyy-MM-dd");
  const matchedSessions = data.recap.sessions.filter((session) =>
    session.userMessageDates.some((iso) => dayKey(iso) === date),
  );
  const matchedUnderstandings = data.understandings.filter((u) =>
    [u.createdAt, u.updatedAt].some((iso) => dayKey(iso) === date),
  );

  if (matchedSessions.length === 0 && matchedUnderstandings.length === 0) {
    return <p className="text-sm text-muted-foreground">这一天没有参与记录。</p>;
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      {matchedSessions.length > 0 ? (
        <div>
          <span className="text-xs font-medium text-muted-foreground">对话</span>
          <ul className="mt-1 flex flex-col gap-1">
            {matchedSessions.map((session) => (
              <li key={session.sessionId} className="truncate text-muted-foreground">
                {session.title || "（无标题）"} · {session.messageCount} 条消息
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {matchedUnderstandings.length > 0 ? (
        <div>
          <span className="text-xs font-medium text-muted-foreground">理解</span>
          <ul className="mt-1 flex flex-col gap-1">
            {matchedUnderstandings.map((u) => (
              <li key={u.id} className="truncate">
                {u.title?.trim() || "（无标题）"}
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

/** 空格与实心都走语义色；light/dark 都写同一组 var，实际色随 `.dark` 解析，不跟系统 media 分叉。 */
const PARTICIPATION_CALENDAR_THEME: ThemeInput = {
  light: ["var(--muted)", "var(--primary)"],
  dark: ["var(--muted)", "var(--primary)"],
};

const EMPTY_DAY_DETAILS = new Map<string, DayDetailCounts>();

const PARTICIPATION_CALENDAR_LABELS = {
  months: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
  weekdays: ["日", "一", "二", "三", "四", "五", "六"],
  totalCount: "共 {{count}} 次参与",
};

/** 工具栏里的足迹开关；收起后热力图不再占一行。 */
export function ParticipationOverviewToggle() {
  const collapsed = useAtomValue(prefsAtom).participationOverviewCollapsed;
  const toggleCollapsed = captureActions.toggleParticipationOverviewCollapsed;
  return (
    <Button
      type="button"
      size="icon-sm"
      variant={collapsed ? "ghost" : "secondary"}
      aria-label={collapsed ? "展开足迹" : "收起足迹"}
      title={collapsed ? "展开足迹" : "收起足迹"}
      aria-pressed={!collapsed}
      data-testid="capture-participation-overview-toggle"
      onClick={toggleCollapsed}
    >
      <Calendar size={14} />
    </Button>
  );
}

/** 捕获页顶部足迹：指标卡与热力图同排；收起后保持挂载，避免 365 格反复卸载。 */
export function ParticipationOverview() {
  const collapsed = useAtomValue(prefsAtom).participationOverviewCollapsed;
  const [mounted, setMounted] = useState(() => !collapsed);
  if (!collapsed && !mounted) setMounted(true);
  const { data } = useParticipationOverview(mounted);
  const [dayPopover, setDayPopover] = useState<{ date: string } | null>(null);
  const dayAnchorRef = useRef<{ x: number; y: number } | null>(null);

  const assets = useMemo(() => (data ? computeParticipationAssets(data) : null), [data]);
  const calendar = useMemo(() => (data ? buildParticipationActivity(data) : null), [data]);
  const detailsRef = useRef(calendar?.details);
  detailsRef.current = calendar?.details;

  const openDay = useCallback((event: MouseEvent, date: string) => {
    const target = (event.target as Element | null)?.closest("rect[data-date]");
    const rect = (target ?? (event.currentTarget as Element)).getBoundingClientRect();
    dayAnchorRef.current = { x: rect.left, y: rect.bottom };
    setDayPopover({ date });
  }, []);

  const renderBlock = useCallback((block: ReactElement, activity: Activity) => {
    return cloneElement(block, {
      "data-date": activity.date,
      title: activityTip(activity.date, detailsRef.current ?? EMPTY_DAY_DETAILS),
    } as unknown as SVGAttributes<SVGRectElement>);
  }, []);

  if (!mounted) return null;

  return (
    <div
      data-testid="participation-overview"
      hidden={collapsed}
      className={collapsed ? "hidden" : "flex shrink-0 items-center gap-4"}
    >
      {assets ? (
        <div className="flex shrink-0 flex-col justify-center gap-3 border-r pr-4">
          <AssetStat stat="理解" label="理解" total={assets.understanding} />
          <AssetStat stat="画布" label="画布" total={assets.canvas} />
          <AssetStat stat="上下文" label="上下文" total={assets.context} />
        </div>
      ) : null}

      {calendar ? (
        <div
          data-testid="participation-heatmap"
          className="min-w-0 flex-1 overflow-x-auto text-muted-foreground"
          onClick={(event) => {
            const target = (event.target as Element | null)?.closest("rect[data-date]");
            const date = target?.getAttribute("data-date");
            if (date) openDay(event, date);
          }}
        >
          <Suspense fallback={<div className="h-[118px] min-w-0" />}>
            <ActivityCalendar
              data={calendar.days}
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
                  text: (activity: Activity) =>
                    activityTip(activity.date, detailsRef.current ?? EMPTY_DAY_DETAILS),
                },
              }}
              renderBlock={renderBlock}
            />
          </Suspense>
        </div>
      ) : null}

      {dayPopover && dayAnchorRef.current && data ? (
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
            <DayDetail date={dayPopover.date} data={data} />
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
