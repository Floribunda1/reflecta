import { compareDesc, startOfDay, subDays } from "date-fns";
import type { AgentThreadDTO } from "@shared/chat";

export type AgentThreadGroup = {
  id: string;
  label: string;
  threads: AgentThreadDTO[];
};

export function groupAgentThreads(threads: AgentThreadDTO[], now = Date.now()): AgentThreadGroup[] {
  const sorted = [...threads].sort((a, b) =>
    compareDesc(new Date(a.updatedAt), new Date(b.updatedAt)),
  );
  const todayStart = startOfDay(now).getTime();
  const yesterdayStart = subDays(todayStart, 1).getTime();
  const weekStart = subDays(todayStart, 7).getTime();
  const monthStart = subDays(todayStart, 30).getTime();
  const groups: AgentThreadGroup[] = [
    { id: "today", label: "今天", threads: [] },
    { id: "yesterday", label: "昨天", threads: [] },
    { id: "last-week", label: "最近 7 天", threads: [] },
    { id: "last-month", label: "最近 30 天", threads: [] },
    { id: "older", label: "更早", threads: [] },
  ];

  for (const thread of sorted) {
    const updatedAt = startOfDay(thread.updatedAt).getTime();
    if (updatedAt >= todayStart) groups[0]!.threads.push(thread);
    else if (updatedAt >= yesterdayStart) groups[1]!.threads.push(thread);
    else if (updatedAt >= weekStart) groups[2]!.threads.push(thread);
    else if (updatedAt >= monthStart) groups[3]!.threads.push(thread);
    else groups[4]!.threads.push(thread);
  }

  return groups.filter((group) => group.threads.length > 0);
}
