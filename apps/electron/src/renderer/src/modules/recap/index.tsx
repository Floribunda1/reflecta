import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@reflecta/ui/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@reflecta/ui/components/card";
import { Button } from "@reflecta/ui/components/button";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@reflecta/ui/components/empty";
import { computeRecapStats, HEATMAP_DAYS_PER_WEEK, type HeatmapCell } from "./stats";
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
  onSelect,
}: {
  heatmapWeeks: readonly (readonly HeatmapCell[])[];
  selectedDate: string | null;
  onSelect: (date: string | null) => void;
}) {
  return (
    <div
      className="grid grid-flow-col gap-[3px] overflow-x-auto pb-1"
      style={{ gridTemplateRows: `repeat(${HEATMAP_DAYS_PER_WEEK}, minmax(0, 1fr))` }}
    >
      {heatmapWeeks.flatMap((week, weekIndex) =>
        week.map((cell, dayIndex) => {
          const label = cell.date ? `${dayTitle(cell.date)}：${cell.count} 次参与` : "尚未到来";
          return (
            <button
              key={`${weekIndex}-${dayIndex}`}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={cell.date !== null && cell.date === selectedDate}
              disabled={cell.date === null}
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

function StateList({
  title,
  count,
  items,
  emptyHint,
}: {
  title: string;
  count: number;
  items: { id: string; title: string; updatedAt: string }[];
  emptyHint: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title} <span className="text-muted-foreground">({count})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyHint}</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex min-w-0 items-baseline justify-between gap-3 text-sm"
            >
              <span className="truncate">{item.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {format(new Date(item.updatedAt), "M月d日")}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function RecapPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useRecapData();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <div data-testid="recap-page" className="flex h-full min-h-0 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">正在整理回顾…</p>
      </div>
    );
  }

  const stats = computeRecapStats(data);
  const noAssets =
    stats.assets.understandingTotal === 0 &&
    stats.assets.canvasTotal === 0 &&
    stats.assets.contextTotal === 0 &&
    data.recap.sessions.length === 0;

  const understandingList = [...data.understandings]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 10);

  return (
    <section
      data-testid="recap-page"
      className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-6"
    >
      {/* 过程块：参与过程（主） */}
      <section aria-label="参与过程" data-testid="recap-participation">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">最近参与</h2>

        <div className="grid grid-cols-3 gap-3">
          <Card size="sm">
            <CardContent className="flex flex-col gap-0.5">
              <span data-stat="今日对话" className="text-xl font-semibold tabular-nums">
                {stats.today.conversations}
              </span>
              <span className="text-xs text-muted-foreground">今日对话（轮）</span>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="flex flex-col gap-0.5">
              <span data-stat="今日消息" className="text-xl font-semibold tabular-nums">
                {stats.today.messages}
              </span>
              <span className="text-xs text-muted-foreground">今日消息（条）</span>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="flex flex-col gap-0.5">
              <span data-stat="今日沉淀动作" className="text-xl font-semibold tabular-nums">
                {stats.today.actions}
              </span>
              <span className="text-xs text-muted-foreground">今日沉淀动作（次）</span>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-3">
          <CardHeader>
            <CardTitle>近 12 周参与</CardTitle>
            <CardDescription>
              按天着色：这一天是否有参与——对话、写或编辑理解、补充上下文、整理画布。点击某天查看当天的参与记录。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <RecapHeatmap
              heatmapWeeks={stats.heatmapWeeks}
              selectedDate={selectedDate}
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

      {/* 资产块：沉淀资产（次，中性） */}
      <section aria-label="沉淀资产" data-testid="recap-assets">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">沉淀资产</h2>

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
          <>
            <div className="grid grid-cols-3 gap-3">
              <Card size="sm">
                <CardContent className="flex flex-col gap-0.5">
                  <span data-stat="理解" className="text-xl font-semibold tabular-nums">
                    {stats.assets.understandingTotal}
                  </span>
                  <span className="text-xs text-muted-foreground">理解</span>
                </CardContent>
              </Card>
              <Card size="sm">
                <CardContent className="flex flex-col gap-0.5">
                  <span data-stat="画布" className="text-xl font-semibold tabular-nums">
                    {stats.assets.canvasTotal}
                  </span>
                  <span className="text-xs text-muted-foreground">画布</span>
                </CardContent>
              </Card>
              <Card size="sm">
                <CardContent className="flex flex-col gap-0.5">
                  <span data-stat="上下文" className="text-xl font-semibold tabular-nums">
                    {stats.assets.contextTotal}
                  </span>
                  <span className="text-xs text-muted-foreground">上下文</span>
                </CardContent>
              </Card>
            </div>

            <div className="mt-3 grid gap-3">
              <Card>
                <CardHeader>
                  <CardTitle>最近的理解</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1">
                  {understandingList.map((u) => (
                    <Button
                      key={u.id}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto justify-start px-1.5 py-1 text-sm font-normal"
                      onClick={() => navigate("/capture")}
                    >
                      <span className="truncate">{u.title?.trim() || "（无标题）"}</span>
                    </Button>
                  ))}
                  {understandingList.length === 0 ? (
                    <p className="text-sm text-muted-foreground">还没有理解。</p>
                  ) : null}
                </CardContent>
              </Card>
              <div className="grid gap-3 md:grid-cols-3">
                <StateList
                  title="孤岛"
                  count={stats.states.islandTotal}
                  items={stats.states.islands}
                  emptyHint="所有理解都已出现在某张画布上。"
                />
                <StateList
                  title="缺上下文"
                  count={stats.states.missingContextTotal}
                  items={stats.states.missingContext}
                  emptyHint="每条理解都有上下文。"
                />
                <StateList
                  title="最近打磨"
                  count={Math.min(stats.states.recentlyWorked.length, 999)}
                  items={stats.states.recentlyWorked}
                  emptyHint="还没有理解。"
                />
              </div>
            </div>
          </>
        )}
      </section>
    </section>
  );
}
