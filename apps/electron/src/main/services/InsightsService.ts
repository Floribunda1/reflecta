import { isNull, isNotNull } from "drizzle-orm";
import { getDBInstance } from "@main/db";
import { contexts, understandingCanvasEdges, understandingCanvasElements } from "@reflecta/server";
import type { RecapData, SessionParticipation } from "@shared/recap";
import { IpcMethod, IpcService } from "electron-ipc-decorator";
import { getContentStorageRoot } from "../config";
import { AgentSessionLog } from "./agent/pi-session-log";

/**
 * 回顾页（Recap）聚合服务 —— 只负责收集"没有现成接口"的原始数据：
 * 会话参与（读 Sessions 事件）+ 上下文/画布元素的创建活动 + 画布引用关系。
 * 理解与画布列表沿用现有 understanding / understandingCanvas 服务，由 renderer 侧合并。
 */
export class InsightsService extends IpcService {
  static readonly groupName = "insights";

  @IpcMethod()
  async getRecapData(): Promise<RecapData> {
    const [sessions, contextRows, elementRows, edgeRows, refRows] = await Promise.all([
      this.listSessionParticipation(),
      this.listContextCreates(),
      this.listCanvasElementCreates(),
      this.listCanvasEdgeCreates(),
      this.listCanvasReferencedUnderstandingIds(),
    ]);
    return {
      sessions,
      contextCreates: contextRows.map((row) => row.createdAt),
      canvasElementCreates: elementRows.map((row) => row.createdAt),
      canvasEdgeCreates: edgeRows.map((row) => row.createdAt),
      canvasReferencedUnderstandingIds: refRows,
    };
  }

  private async listSessionParticipation(): Promise<SessionParticipation[]> {
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

  private async listContextCreates(): Promise<{ createdAt: string }[]> {
    const db = getDBInstance();
    return db
      .select({ createdAt: contexts.createdAt })
      .from(contexts)
      .where(isNull(contexts.deletedAt));
  }

  private async listCanvasElementCreates(): Promise<{ createdAt: string }[]> {
    const db = getDBInstance();
    return db
      .select({ createdAt: understandingCanvasElements.createdAt })
      .from(understandingCanvasElements);
  }

  private async listCanvasEdgeCreates(): Promise<{ createdAt: string }[]> {
    const db = getDBInstance();
    return db
      .select({ createdAt: understandingCanvasEdges.createdAt })
      .from(understandingCanvasEdges);
  }

  private async listCanvasReferencedUnderstandingIds(): Promise<string[]> {
    const db = getDBInstance();
    const rows = await db
      .selectDistinct({ understandingId: understandingCanvasElements.understandingId })
      .from(understandingCanvasElements)
      .where(isNotNull(understandingCanvasElements.understandingId));
    return rows.map((row) => row.understandingId).filter((id): id is string => id !== null);
  }
}
