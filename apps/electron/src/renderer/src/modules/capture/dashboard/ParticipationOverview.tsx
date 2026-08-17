import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import {
  cloneElement,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement,
  type SVGAttributes,
} from "react";
import { ActivityCalendar, type Activity, type ThemeInput } from "react-activity-calendar";
import "react-activity-calendar/tooltips.css";
import { Button } from "@reflecta/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@reflecta/ui/components/popover";
import { useCaptureStore } from "../store";
import { useParticipationOverview, type ParticipationOverviewData } from "../queries";
import {
  buildParticipationActivity,
  computeParticipationAssets,
  type DayDetailCounts,
} from "./participation-stats";

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

function MiniStat({ stat, label, total }: { stat: string; label: string; total: number }) {
  return (
    <span data-stat={stat} className="flex items-baseline gap-1.5">
      <span className="text-sm font-medium tabular-nums">{total}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}

/** 空格与实心都走语义色；light/dark 都写同一组 var，实际色随 `.dark` 解析，不跟系统 media 分叉。 */
const PARTICIPATION_CALENDAR_THEME: ThemeInput = {
  light: ["var(--muted)", "var(--primary)"],
  dark: ["var(--muted)", "var(--primary)"],
};

/** 工具栏里的展开/收起入口；收起后概览不再单独占一行。 */
export function ParticipationOverviewToggle() {
  const collapsed = useCaptureStore((state) => state.participationOverviewCollapsed);
  const toggleCollapsed = useCaptureStore((state) => state.toggleParticipationOverviewCollapsed);
  return (
    <Button
      type="button"
      size="sm"
      variant={collapsed ? "ghost" : "secondary"}
      aria-label={collapsed ? "展开参与概览" : "收起参与概览"}
      aria-pressed={!collapsed}
      data-testid="capture-participation-overview-toggle"
      onClick={toggleCollapsed}
    >
      参与概览
      {collapsed ? <ChevronDown /> : <ChevronUp />}
    </Button>
  );
}

/** 捕获页顶部「参与概览」：热力图与资产指标同排；收起时不渲染。 */
export function ParticipationOverview() {
  const collapsed = useCaptureStore((state) => state.participationOverviewCollapsed);
  // 折叠时不再拉取全局参与数据；展开后按需恢复（同一会话内由 react-query 缓存）
  const { data } = useParticipationOverview(!collapsed);
  const [dayPopover, setDayPopover] = useState<{ date: string } | null>(null);
  const dayAnchorRef = useRef<{ x: number; y: number } | null>(null);

  const assets = data ? computeParticipationAssets(data) : null;
  const calendar = data ? buildParticipationActivity(data) : null;

  const openDay = (event: MouseEvent<SVGRectElement>, date: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    dayAnchorRef.current = { x: rect.left, y: rect.bottom };
    setDayPopover({ date });
  };

  if (collapsed) return null;

  return (
    <div data-testid="participation-overview" className="flex shrink-0 items-start gap-3">
      {assets ? (
        <div className="flex shrink-0 flex-col justify-center gap-1 pt-4">
          <MiniStat stat="理解" label="理解" total={assets.understanding} />
          <MiniStat stat="画布" label="画布" total={assets.canvas} />
          <MiniStat stat="上下文" label="上下文" total={assets.context} />
        </div>
      ) : null}

      {calendar ? (
        <div
          data-testid="participation-heatmap"
          className="min-w-0 flex-1 overflow-x-auto text-muted-foreground"
        >
          <ActivityCalendar
            data={calendar.days}
            weekStart={1}
            blockSize={10}
            blockMargin={3}
            blockRadius={2}
            fontSize={11}
            theme={PARTICIPATION_CALENDAR_THEME}
            labels={{
              months: [
                "1月",
                "2月",
                "3月",
                "4月",
                "5月",
                "6月",
                "7月",
                "8月",
                "9月",
                "10月",
                "11月",
                "12月",
              ],
              weekdays: ["日", "一", "二", "三", "四", "五", "六"],
              totalCount: "共 {{count}} 次参与",
            }}
            showWeekdayLabels={["mon", "wed", "fri"]}
            showTotalCount={false}
            showColorLegend={false}
            tooltips={{
              activity: {
                text: (activity: Activity) => {
                  const detail = calendar.details.get(activity.date);
                  return detail
                    ? `${dayTitle(activity.date)}：${buildParticipationTip(detail)}`
                    : `${dayTitle(activity.date)}：无参与`;
                },
              },
            }}
            renderBlock={(block: ReactElement, activity: Activity) => {
              const detail = calendar.details.get(activity.date);
              const tip = detail
                ? `${dayTitle(activity.date)}：${buildParticipationTip(detail)}`
                : `${dayTitle(activity.date)}：无参与`;
              return cloneElement(block, {
                "data-date": activity.date,
                title: tip,
                onClick: (event: MouseEvent<SVGRectElement>) => openDay(event, activity.date),
              } as unknown as SVGAttributes<SVGRectElement>);
            }}
          />
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
