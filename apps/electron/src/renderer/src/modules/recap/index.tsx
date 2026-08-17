import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useState } from "react";
import { cn } from "@reflecta/ui/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@reflecta/ui/components/card";
import { Button } from "@reflecta/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@reflecta/ui/components/empty";
import { Tabs, TabsList, TabsTrigger } from "@reflecta/ui/components/tabs";
import { RECAP_PERIODS, computeRecapStats, type HeatmapCell, type RecapPeriodId } from "./stats";
import { useRecapData, type RecapDataQuery } from "./queries";

const HEATMAP_LEVEL_CLASS = [
  "bg-muted",
  "bg-primary/25",
  "bg-primary/50",
  "bg-primary/75",
  "bg-primary",
] as const;

function dayTitle(date: string | null): string {
  if (!date) return "尚未到来";
  return `${format(new Date(`${date}T00:00:00`), "yyyy年M月d日 EEEE", { locale: zhCN })}`;
}

function RecapHeatmap({
  heatmapWeeks,
  selectedDate,
  onHover,
  onSelect,
}: {
  heatmapWeeks: readonly (readonly HeatmapCell[])[];
  selectedDate: string | null;
  onHover: (cell: HeatmapCell | null) => void;
  onSelect: (date: string | null) => void;
}) {
  return (
    <div
      className="grid grid-flow-col gap-[3px] overflow-x-auto pb-1"
      style={{ gridTemplateRows: `repeat(7, minmax(0, 1fr))` }}
      aria-label="参与热力图"
      role="img"
    >
      {heatmapWeeks.flatMap((week, weekIndex) =>
        week.map((cell, dayIndex) => {
          const label = cell.date
            ? `${dayTitle(cell.date)}：对话 ${cell.conversations} 次，沉淀资产 ${cell.assets} 个`
            : "不在窗口内";
          return (
            <button
              key={`${weekIndex}-${dayIndex}`}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={cell.date !== null && cell.date === selectedDate}
              disabled={cell.date === null}
              onMouseEnter={() => onHover(cell.date !== null ? cell : null)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(cell.date !== null ? cell : null)}
              onBlur={() => onHover(null)}
              onClick={() => onSelect(cell.date !== selectedDate ? cell.date : null)}
              className={cn(
                "size-2.5 rounded-[3px] transition-transform disabled:opacity-40",
                HEATMAP_LEVEL_CLASS[cell.level],
                cell.date !== null &&
                  cell.date === selectedDate &&
                  "ring-2 ring-ring ring-offset-1",
              )}
            />
          );
        }),
      )}
    </div>
  );
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
          <span data-stat={stat} className="text-xl font-semibold tabular-nums">
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
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <div data-testid="recap-page" className="flex h-full min-h-0 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">正在整理回顾…</p>
      </div>
    );
  }

  const stats = computeRecapStats({ ...data, domains: data.domainList, period });
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
      {/* Section 1：period 筛选 */}
      <Tabs value={period} onValueChange={(value) => setPeriod(value as RecapPeriodId)}>
        <TabsList aria-label="回顾时间范围">
          {RECAP_PERIODS.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Section 2.1：过程数据 */}
      <section aria-label="过程数据" data-testid="recap-participation">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">过程数据</h2>
        <Card>
          <CardHeader>
            <CardTitle>参与热力图</CardTitle>
            <CardDescription>
              按天着色：这一天是否有对话或沉淀动作。悬停查看当天细分，点击某天查看当天参与记录。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {hoveredCell?.date ? (
              <p
                data-testid="recap-heatmap-tooltip"
                className="text-sm tabular-nums"
                aria-live="polite"
              >
                {dayTitle(hoveredCell.date)} · 对话 {hoveredCell.conversations} 次 · 消息{" "}
                {hoveredCell.messages} 条 · 沉淀资产 {hoveredCell.assets} 个
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">悬停查看某一天的参与明细</p>
            )}
            <RecapHeatmap
              heatmapWeeks={stats.heatmapWeeks}
              selectedDate={selectedDate}
              onHover={setHoveredCell}
              onSelect={setSelectedDate}
            />
            {selectedDate ? (
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{dayTitle(selectedDate)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedDate(null)}
                  >
                    关闭
                  </Button>
                </div>
                <DayDetail date={selectedDate} data={data} />
              </div>
            ) : null}
          </CardContent>
        </Card>
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
