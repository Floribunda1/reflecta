import { desc, isNull, count } from "drizzle-orm";
import {
  categories,
  contexts,
  thoughtCategories,
  thoughtConnections,
  thoughts,
} from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import { toThoughtSummaries } from "../shared/bff-cli";
import type { ProjectSnapshotResult } from "../shared/types-cli";

export class SnapshotService {
  constructor(private db: ReflectaDb) {}

  async projectSnapshot(): Promise<ProjectSnapshotResult> {
    const allCategories = await this.db.select().from(categories).orderBy(categories.sortOrder);

    const tcCounts = await this.db
      .select({ categoryId: thoughtCategories.categoryId, count: count() })
      .from(thoughtCategories)
      .groupBy(thoughtCategories.categoryId);

    const countMap = new Map(tcCounts.map((c) => [c.categoryId, c.count]));

    const catsWithCount = allCategories.map((c) => ({
      id: c.id,
      name: c.name,
      thoughtCount: countMap.get(c.id) ?? 0,
    }));

    const recentThoughtRows = await this.db
      .select()
      .from(thoughts)
      .where(isNull(thoughts.deletedAt))
      .orderBy(desc(thoughts.updatedAt))
      .limit(10);

    const recentThoughts = await toThoughtSummaries(this.db, recentThoughtRows);

    const [thoughtCount, contextCount, categoryCount, refCount] = await Promise.all([
      this.db.select({ count: count() }).from(thoughts).where(isNull(thoughts.deletedAt)),
      this.db.select({ count: count() }).from(contexts).where(isNull(contexts.deletedAt)),
      this.db.select({ count: count() }).from(categories),
      this.db.select({ count: count() }).from(thoughtConnections),
    ]);

    return {
      categories: catsWithCount,
      recentThoughts,
      stats: {
        totalThoughts: thoughtCount[0]?.count ?? 0,
        totalContexts: contextCount[0]?.count ?? 0,
        totalCategories: categoryCount[0]?.count ?? 0,
        totalReferences: refCount[0]?.count ?? 0,
      },
    };
  }
}
