import { desc, eq } from "drizzle-orm";
import { conversations } from "@reflecta/server";
import type { ReflectaDb } from "@reflecta/server";
import type { ConversationDTO } from "@shared/chat";
import { nanoid } from "nanoid";

function toDTO(row: typeof conversations.$inferSelect): ConversationDTO {
  return {
    id: row.id,
    title: row.title,
    piSessionId: row.piSessionId ?? null,
    piSessionFile: row.piSessionFile ?? null,
    lastMessagePreview: row.lastMessagePreview ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class ChatRepository {
  constructor(private readonly getDb: () => ReflectaDb) {}

  private db() {
    return this.getDb();
  }

  async createConversation(title = "新对话"): Promise<ConversationDTO> {
    const now = new Date().toISOString();
    const row = {
      id: nanoid(),
      title,
      piSessionId: null,
      piSessionFile: null,
      lastMessagePreview: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db().insert(conversations).values(row);
    return toDTO(row);
  }

  async listConversations(): Promise<ConversationDTO[]> {
    const rows = await this.db()
      .select()
      .from(conversations)
      .orderBy(desc(conversations.updatedAt));
    return rows.map(toDTO);
  }

  async getConversation(conversationId: string): Promise<ConversationDTO | null> {
    const rows = await this.db()
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    return rows[0] ? toDTO(rows[0]) : null;
  }

  async bindPiSession(input: {
    conversationId: string;
    piSessionId: string;
    piSessionFile: string;
  }): Promise<void> {
    await this.db()
      .update(conversations)
      .set({
        piSessionId: input.piSessionId,
        piSessionFile: input.piSessionFile,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(conversations.id, input.conversationId));
  }

  async touchConversation(input: {
    conversationId: string;
    lastMessagePreview?: string;
    title?: string;
  }): Promise<void> {
    const patch: Partial<typeof conversations.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };
    if (input.lastMessagePreview !== undefined) {
      patch.lastMessagePreview = input.lastMessagePreview;
    }
    if (input.title !== undefined) {
      patch.title = input.title;
    }
    await this.db()
      .update(conversations)
      .set(patch)
      .where(eq(conversations.id, input.conversationId));
  }

  async renameConversation(conversationId: string, title: string): Promise<void> {
    await this.db()
      .update(conversations)
      .set({ title, updatedAt: new Date().toISOString() })
      .where(eq(conversations.id, conversationId));
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.db().delete(conversations).where(eq(conversations.id, conversationId));
  }
}
