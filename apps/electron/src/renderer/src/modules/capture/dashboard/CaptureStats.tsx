import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useMemo } from "react";
import type { UnderstandingSummaryDTO } from "@shared/understanding";
import { cn } from "@reflecta/ui/lib/utils";
import { computeCaptureStats } from "./stats";

const HEATMAP_LEVEL_CLASS = [
  "bg-muted",
  "bg-primary/25",
  "bg-primary/50",
  "bg-primary/75",
  "bg-primary",
] as const;

export function CaptureStats({
  understandings,
}: {
  understandings: readonly UnderstandingSummaryDTO[];
}) {
  const stats = useMemo(() => computeCaptureStats(understandings), [understandings]);

  const statItems = [
    { label: "总理解", value: String(stats.total) },
    { label: "本周新增", value: String(stats.createdThisWeek) },
    { label: "连续记录", value: `${stats.streakDays} 天` },
    { label: "上下文", value: String(stats.contextTotal) },
  ];

  return (
    <section
      data-testid="capture-dashboard-stats"
      className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border bg-card px-4 py-3"
    >
      <div className="flex min-w-0 items-center gap-6">
        {statItems.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-col gap-0.5">
            <span data-stat={item.label} className="text-lg leading-6 font-semibold tabular-nums">
              {item.value}
            </span>
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>

      <div
        className="ml-auto grid grid-flow-col gap-[3px]"
        style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}
        aria-label="最近 12 周记录热力图"
        role="img"
      >
        {stats.heatmapWeeks.flatMap((week, weekIndex) =>
          week.map((cell, dayIndex) => {
            const label = cell.date
              ? `${format(new Date(`${cell.date}T00:00:00`), "yyyy年M月d日 EEEE", { locale: zhCN })}：${cell.count} 条`
              : "尚未到来";
            return (
              <span
                key={`${weekIndex}-${dayIndex}`}
                title={label}
                aria-label={label}
                className={cn("size-2.5 rounded-[3px]", HEATMAP_LEVEL_CLASS[cell.level])}
              />
            );
          }),
        )}
      </div>
    </section>
  );
}
