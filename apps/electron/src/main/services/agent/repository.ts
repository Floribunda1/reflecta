import { and, desc, eq, gt, max } from "drizzle-orm";
import { nanoid } from "nanoid";
import { agentMessages, agentRuns, agentThreads, agentToolInvocations } from "@reflecta/server";
import type { ReflectaDb } from "@reflecta/server";
import type { AgentChatMessage, AgentThreadDTO } from "@shared/chat";
import { agentMessageDisplayText } from "@shared/chat-display";

export type AgentToolInvocationRow = typeof agentToolInvocations.$inferSelect;

export type AgentToolInvocationApprovalStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected";

type RecordToolInvocationInput = {
  threadId: string;
  toolCallId: string;
  toolName: string;
  state: string;
  input: unknown;
  output?: unknown;
  errorText?: string;
  approvalStatus: AgentToolInvocationApprovalStatus;
};

function parseJson<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  return JSON.parse(value) as T;
}

function titleFromMessage(message: AgentChatMessage): string {
  return agentMessageDisplayText(message).slice(0, 40);
}

function toThreadDTO(row: typeof agentThreads.$inferSelect): AgentThreadDTO {
  return {
    id: row.id,
    title: row.title,
    status: row.status === "archived" ? "archived" : "active",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class AgentRepository {
  constructor(private readonly getDb: () => ReflectaDb) {}

  private db() {
    return this.getDb();
  }

  async createThread(title = "新对话"): Promise<AgentThreadDTO> {
    const now = new Date().toISOString();
    const row = {
      id: nanoid(),
      title,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    await this.db().insert(agentThreads).values(row);
    return toThreadDTO(row);
  }

  async listThreads(): Promise<AgentThreadDTO[]> {
    const rows = await this.db()
      .select()
      .from(agentThreads)
      .where(eq(agentThreads.status, "active"))
      .orderBy(desc(agentThreads.updatedAt));
    return rows.map(toThreadDTO);
  }

  async renameThread(threadId: string, title: string): Promise<void> {
    await this.db()
      .update(agentThreads)
      .set({ title, updatedAt: new Date().toISOString() })
      .where(eq(agentThreads.id, threadId));
  }

  async archiveThread(threadId: string): Promise<void> {
    await this.db()
      .update(agentThreads)
      .set({ status: "archived", updatedAt: new Date().toISOString() })
      .where(eq(agentThreads.id, threadId));
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.db().delete(agentThreads).where(eq(agentThreads.id, threadId));
  }

  async getMessages(threadId: string): Promise<AgentChatMessage[]> {
    const rows = await this.db()
      .select()
      .from(agentMessages)
      .where(eq(agentMessages.threadId, threadId))
      .orderBy(agentMessages.seq);

    return rows.map((row) => ({
      id: row.id,
      role: row.role as AgentChatMessage["role"],
      parts: JSON.parse(row.partsJson) as AgentChatMessage["parts"],
      metadata: parseJson(row.metadataJson),
      createdAt: row.createdAt,
    }));
  }

  async appendMessage(threadId: string, message: AgentChatMessage): Promise<void> {
    const existing = await this.db()
      .select({ id: agentMessages.id, seq: agentMessages.seq })
      .from(agentMessages)
      .where(and(eq(agentMessages.threadId, threadId), eq(agentMessages.id, message.id)))
      .limit(1);
    if (existing.length > 0) {
      if (message.role !== "user") return;
      const now = new Date().toISOString();
      const seq = existing[0]!.seq;
      await this.db()
        .delete(agentMessages)
        .where(and(eq(agentMessages.threadId, threadId), gt(agentMessages.seq, seq)));
      await this.db()
        .update(agentMessages)
        .set({
          partsJson: JSON.stringify(message.parts),
          metadataJson: message.metadata ? JSON.stringify(message.metadata) : null,
        })
        .where(and(eq(agentMessages.threadId, threadId), eq(agentMessages.id, message.id)));
      const title = titleFromMessage(message);
      await this.db()
        .update(agentThreads)
        .set({
          title: seq === 1 && title ? title : undefined,
          updatedAt: now,
        })
        .where(eq(agentThreads.id, threadId));
      return;
    }

    const seqRows = await this.db()
      .select({ seq: max(agentMessages.seq) })
      .from(agentMessages)
      .where(eq(agentMessages.threadId, threadId));
    const seq = (seqRows[0]?.seq ?? 0) + 1;
    const now = new Date().toISOString();

    await this.db()
      .insert(agentMessages)
      .values({
        id: message.id,
        threadId,
        seq,
        role: message.role,
        partsJson: JSON.stringify(message.parts),
        attachmentsJson: null,
        metadataJson: message.metadata ? JSON.stringify(message.metadata) : null,
        createdAt: message.createdAt ?? now,
      });

    const title = titleFromMessage(message);
    await this.db()
      .update(agentThreads)
      .set({
        title: message.role === "user" && seq === 1 && title ? title : undefined,
        updatedAt: now,
      })
      .where(eq(agentThreads.id, threadId));
  }

  async replaceMessages(threadId: string, messages: AgentChatMessage[]): Promise<void> {
    const threadRows = await this.db()
      .select({ title: agentThreads.title })
      .from(agentThreads)
      .where(eq(agentThreads.id, threadId))
      .limit(1);
    const thread = threadRows[0];
    const now = new Date().toISOString();
    const firstUser = messages.find((message) => message.role === "user");
    const firstUserTitle = firstUser ? titleFromMessage(firstUser) : "";

    await this.db().transaction((tx) => {
      tx.delete(agentMessages).where(eq(agentMessages.threadId, threadId)).run();

      if (messages.length > 0) {
        tx.insert(agentMessages)
          .values(
            messages.map((message, index) => ({
              id: message.id,
              threadId,
              seq: index + 1,
              role: message.role,
              partsJson: JSON.stringify(message.parts),
              attachmentsJson: null,
              metadataJson: message.metadata ? JSON.stringify(message.metadata) : null,
              createdAt: message.createdAt ?? now,
            })),
          )
          .run();
      }

      tx.update(agentThreads)
        .set({
          title: firstUserTitle && thread?.title === "新对话" ? firstUserTitle : undefined,
          updatedAt: now,
        })
        .where(eq(agentThreads.id, threadId))
        .run();
    });
  }

  async recordToolInvocation(input: RecordToolInvocationInput): Promise<void> {
    const now = new Date().toISOString();
    await this.db()
      .insert(agentToolInvocations)
      .values({
        id: nanoid(),
        threadId: input.threadId,
        messageId: null,
        toolCallId: input.toolCallId,
        toolName: input.toolName,
        state: input.state,
        inputJson: JSON.stringify(input.input),
        outputJson: input.output === undefined ? null : JSON.stringify(input.output),
        errorText: input.errorText ?? null,
        approvalStatus: input.approvalStatus,
        resultRefType: null,
        resultRefId: null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: agentToolInvocations.toolCallId,
        set: {
          state: input.state,
          inputJson: JSON.stringify(input.input),
          outputJson: input.output === undefined ? null : JSON.stringify(input.output),
          errorText: input.errorText ?? null,
          approvalStatus: input.approvalStatus,
          updatedAt: now,
        },
      });
  }

  async getToolInvocation(toolCallId: string): Promise<AgentToolInvocationRow | null> {
    const rows = await this.db()
      .select()
      .from(agentToolInvocations)
      .where(eq(agentToolInvocations.toolCallId, toolCallId))
      .limit(1);
    return rows[0] ?? null;
  }

  async finishToolInvocation(
    toolCallId: string,
    input: {
      approvalStatus: "approved" | "rejected";
      resultRefType?: string;
      resultRefId?: string;
      output?: unknown;
    },
  ): Promise<void> {
    await this.db()
      .update(agentToolInvocations)
      .set({
        approvalStatus: input.approvalStatus,
        resultRefType: input.resultRefType ?? null,
        resultRefId: input.resultRefId ?? null,
        outputJson: input.output === undefined ? undefined : JSON.stringify(input.output),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(agentToolInvocations.toolCallId, toolCallId));
  }

  async patchToolOutput(
    messageId: string,
    toolCallId: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    const rows = await this.db()
      .select({ partsJson: agentMessages.partsJson })
      .from(agentMessages)
      .where(eq(agentMessages.id, messageId))
      .limit(1);
    const row = rows[0];
    if (!row) return;

    const parts = JSON.parse(row.partsJson) as AgentChatMessage["parts"];
    const nextParts = parts.map((part) => {
      if (!("toolCallId" in part) || part.toolCallId !== toolCallId) return part;
      if (!("output" in part) || typeof part.output !== "object" || part.output === null) {
        return part;
      }
      return { ...part, output: { ...part.output, ...patch } };
    });

    await this.db()
      .update(agentMessages)
      .set({ partsJson: JSON.stringify(nextParts) })
      .where(eq(agentMessages.id, messageId));
  }

  async createRun(threadId: string, model: string): Promise<string> {
    const id = nanoid();
    await this.db().insert(agentRuns).values({
      id,
      threadId,
      status: "streaming",
      model,
      startedAt: new Date().toISOString(),
      completedAt: null,
      errorText: null,
    });
    return id;
  }

  async finishRun(runId: string, status: "completed" | "failed" | "cancelled", errorText?: string) {
    await this.db()
      .update(agentRuns)
      .set({
        status,
        completedAt: new Date().toISOString(),
        errorText: errorText ?? null,
      })
      .where(eq(agentRuns.id, runId));
  }

  async markInterruptedRuns(): Promise<void> {
    await this.db()
      .update(agentRuns)
      .set({
        status: "failed",
        completedAt: new Date().toISOString(),
        errorText: "App restarted before stream finished",
      })
      .where(eq(agentRuns.status, "streaming"));
  }
}
