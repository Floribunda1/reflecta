/** insights 域业务逻辑（删除式迁移：从 InsightsService 抽出为纯函数，供 Effect handler 调用）。 */
import { isNull, isNotNull } from "drizzle-orm";
import { getDBInstance } from "@main/db";
import { contexts, understandingCanvasEdges, understandingCanvasElements } from "@reflecta/server";
import type { ContextParticipation, RecapData, SessionParticipation } from "@shared/recap";
import { getContentStorageRoot } from "../config";
import { AgentSessionLog } from "./agent/pi-session-log";

async function listSessionParticipation(): Promise<SessionParticipation[]> {
  const sessionLog = new AgentSessionLog(getContentStorageRoot());
  const summaries = await sessionLog.listSessions();
  const participations = await Promise.all(
    summaries.map(async (summary) => {
      const events = await sessionLog.readEvents(summary.id);
      const userMessages = events.filter((event) => event.type === "user.message");
      return {
        sessionId: summary.id,
        title: summary.title,
        createdAt: userMessages[0]?.createdAt ?? summary.createdAt,
        updatedAt: summary.updatedAt,
        messageCount: userMessages.length,
        userMessageDates: userMessages.map((event) => event.createdAt),
      };
    }),
  );
  return participations.filter((item) => item.messageCount > 0);
}

export async function getRecapData(): Promise<RecapData> {
  const db = getDBInstance();
  const [sessions, contextRows, elementRows, edgeRows, refRows] = await Promise.all([
    listSessionParticipation(),
    db
      .select({
        id: contexts.id,
        medium: contexts.medium,
        title: contexts.title,
        createdAt: contexts.createdAt,
      })
      .from(contexts)
      .where(isNull(contexts.deletedAt)),
    db
      .select({ createdAt: understandingCanvasElements.createdAt })
      .from(understandingCanvasElements),
    db.select({ createdAt: understandingCanvasEdges.createdAt }).from(understandingCanvasEdges),
    db
      .selectDistinct({ understandingId: understandingCanvasElements.understandingId })
      .from(understandingCanvasElements)
      .where(isNotNull(understandingCanvasElements.understandingId)),
  ]);
  const contextParticipations: ContextParticipation[] = contextRows.map((row) => ({
    id: row.id,
    medium: row.medium as ContextParticipation["medium"],
    title: row.title,
    createdAt: row.createdAt,
  }));
  return {
    sessions,
    contexts: contextParticipations,
    contextCreates: contextRows.map((row) => row.createdAt),
    canvasElementCreates: elementRows.map((row) => row.createdAt),
    canvasEdgeCreates: edgeRows.map((row) => row.createdAt),
    canvasReferencedUnderstandingIds: refRows
      .map((row) => row.understandingId)
      .filter((id): id is string => id !== null),
  };
}
