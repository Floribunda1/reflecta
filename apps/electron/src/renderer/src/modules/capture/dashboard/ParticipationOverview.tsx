import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { Button } from "@reflecta/ui/components/button";
import {
  ParticipationOverview as ParticipationOverviewView,
  type ParticipationDayDetail,
} from "@reflecta/ui/capture";
import { useAtomValue } from "@effect/atom-react";
import { captureActions, participationCollapsedAtom } from "../store";
import { useParticipationOverview } from "../queries";
import { buildParticipationActivity, computeParticipationAssets } from "./participation-stats";

function dayKey(iso: string) {
  return format(new Date(iso), "yyyy-MM-dd");
}

/** 工具栏里的足迹开关；收起后热力图不再占一行。 */
export function ParticipationOverviewToggle() {
  const collapsed = useAtomValue(participationCollapsedAtom);
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
export const ParticipationOverview = memo(function ParticipationOverview() {
  const collapsed = useAtomValue(participationCollapsedAtom);
  const [mounted, setMounted] = useState(() => !collapsed);
  if (!collapsed && !mounted) setMounted(true);
  const { data } = useParticipationOverview(mounted);

  const assets = useMemo(() => (data ? computeParticipationAssets(data) : null), [data]);
  const calendar = useMemo(() => (data ? buildParticipationActivity(data) : null), [data]);

  const resolveDayDetail = useCallback(
    (date: string): ParticipationDayDetail => {
      if (!data) return { sessions: [], understandings: [], contextCount: 0, canvases: [] };
      return {
        sessions: data.recap.sessions
          .filter((session) => session.userMessageDates.some((iso) => dayKey(iso) === date))
          .map((session) => ({
            id: session.sessionId,
            title: session.title || "（无标题）",
            messageCount: session.messageCount,
          })),
        understandings: data.understandings
          .filter((understanding) =>
            [understanding.createdAt, understanding.updatedAt].some((iso) => dayKey(iso) === date),
          )
          .map((understanding) => ({
            id: understanding.id,
            title: understanding.title?.trim() || "（无标题）",
          })),
        contextCount: data.recap.contextCreates.filter((iso) => dayKey(iso) === date).length,
        canvases: data.canvases
          .filter((canvas) => dayKey(canvas.createdAt) === date)
          .map((canvas) => ({ id: canvas.id, title: canvas.title || "（无标题）" })),
      };
    },
    [data],
  );

  if (!mounted) return null;

  return (
    <ParticipationOverviewView
      assets={assets}
      days={calendar?.days ?? null}
      getDayCounts={(date) => calendar?.details.get(date)}
      resolveDayDetail={resolveDayDetail}
      hidden={collapsed}
    />
  );
});
