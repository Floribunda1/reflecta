import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cloneElement, useState, type ReactElement, type SVGAttributes } from "react";
import { ActivityCalendar, type Activity } from "react-activity-calendar";
import "react-activity-calendar/tooltips.css";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@reflecta/ui/components/card";
import { Button } from "@reflecta/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@reflecta/ui/components/empty";
import { Tabs, TabsList, TabsTrigger } from "@reflecta/ui/components/tabs";
import { RECAP_PERIODS, buildActivityData, computeRecapStats, type RecapPeriodId } from "./stats";
import { useRecapData, type RecapDataQuery } from "./queries";

function dayTitle(date: string): string {
  return `${format(new Date(`${date}T00:00:00`), "yyyy年M月d日 EEEE", { locale: zhCN })}`;
}

function DayDetail({ date, data }: { date: string; data: RecapDataQuery }) {
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

function AssetCounter({
  stat,
  label,
  total,
  period,
}: {
  stat: string;
  label: string;
  total: number;
  period: number;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-0.5">
        <span className="flex items-baseline gap-1.5">
          <span data-stat={stat} className="text-2xl font-semibold tabular-nums">
            {total}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">期内 +{period}</span>
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}

export function RecapPage() {
  const { data, isLoading } = useRecapData();
  const [period, setPeriod] = useState<RecapPeriodId>("week");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <div data-testid="recap-page" className="flex h-full min-h-0 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">正在整理回顾…</p>
      </div>
    );
  }

  const stats = computeRecapStats({ ...data, domains: data.domainList, period });
  const { days: activityDays, details: activityDetails } = buildActivityData({
    ...data,
    domains: data.domainList,
    period,
  });
  const noAssets =
    stats.assets.understanding.total === 0 &&
    stats.assets.canvas.total === 0 &&
    stats.assets.context.total === 0 &&
    data.recap.sessions.length === 0;

  return (
    <section
      data-testid="recap-page"
      className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-6"
    >
      {/* Section 1：period 筛选（全局，作用于过程数据与资产期内新增） */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">回顾</h2>
        <Tabs value={period} onValueChange={(value) => setPeriod(value as RecapPeriodId)}>
          <TabsList aria-label="回顾时间范围">
            {RECAP_PERIODS.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Section 2.1：过程数据 */}
      <section aria-label="过程数据" data-testid="recap-participation">
        <Card>
          <CardHeader>
            <CardTitle>参与热力图</CardTitle>
            <CardDescription>
              按天着色：这一天是否有对话或沉淀动作。悬停查看当天细分，点击某天查看当天参与记录。
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div data-testid="recap-heatmap">
              <ActivityCalendar
                data={activityDays}
                weekStart={1}
                blockSize={13}
                blockMargin={3}
                blockRadius={3}
                fontSize={12}
                theme={{
                  light: ["#e6e6e6", "#0d9488"],
                  dark: ["#2a2a2a", "#2dd4bf"],
                }}
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
                  legend: { less: "少", more: "多" },
                }}
                showWeekdayLabels={["mon", "wed", "fri"]}
                showTotalCount={false}
                tooltips={{
                  activity: {
                    text: (activity: Activity) => {
                      const detail = activityDetails.get(activity.date);
                      if (!detail) return `${dayTitle(activity.date)}：无参与`;
                      return (
                        `${dayTitle(activity.date)}：` +
                        `对话 ${detail.conversations} 次 · 消息 ${detail.messages} 条 · ` +
                        `沉淀资产 ${detail.assets} 个`
                      );
                    },
                  },
                }}
                renderBlock={(block: ReactElement, activity: Activity) => {
                  const detail = activityDetails.get(activity.date);
                  const tip = detail
                    ? `${dayTitle(activity.date)}：对话 ${detail.conversations} 次 · 消息 ${detail.messages} 条 · 沉淀资产 ${detail.assets} 个`
                    : `${dayTitle(activity.date)}：无参与`;
                  return cloneElement(block, {
                    "data-date": activity.date,
                    title: tip,
                    onClick: () => setSelectedDate(activity.date),
                  } as unknown as SVGAttributes<SVGRectElement>);
                }}
              />
            </div>
          </CardContent>
        </Card>

        {selectedDate ? (
          <Card className="mt-3">
            <CardHeader>
              <CardTitle>{dayTitle(selectedDate)}</CardTitle>
              <CardAction>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDate(null)}
                >
                  关闭
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <DayDetail date={selectedDate} data={data} />
            </CardContent>
          </Card>
        ) : null}
      </section>

      {/* Section 2.2：已沉淀资产 */}
      <section aria-label="已沉淀资产" data-testid="recap-assets">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">已沉淀资产</h2>

        {noAssets ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle className="text-sm">还没有沉淀记录。</EmptyTitle>
              <EmptyDescription className="text-sm">
                去写一条理解、整理一张画布，或和 Agent 深聊一次，这里会如实呈现你的足迹。
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              <AssetCounter
                stat="理解"
                label="理解"
                total={stats.assets.understanding.total}
                period={stats.assets.understanding.period}
              />
              <AssetCounter
                stat="画布"
                label="画布"
                total={stats.assets.canvas.total}
                period={stats.assets.canvas.period}
              />
              <AssetCounter
                stat="上下文"
                label="上下文"
                total={stats.assets.context.total}
                period={stats.assets.context.period}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>理解 · 按领域排名</CardTitle>
                <CardDescription>沉淀最深的领域（按理解总数降序，前 10）</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                {stats.domainRank.length === 0 ? (
                  <p className="text-sm text-muted-foreground">还没有理解。</p>
                ) : (
                  stats.domainRank.map((item, index) => (
                    <div
                      key={item.domainId}
                      className="flex min-w-0 items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                          {index + 1}
                        </span>
                        <span className="truncate">{item.name}</span>
                      </span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {item.total}
                        {item.period > 0 ? (
                          <span className="text-xs"> · 期内 +{item.period}</span>
                        ) : null}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </section>
    </section>
  );
}
