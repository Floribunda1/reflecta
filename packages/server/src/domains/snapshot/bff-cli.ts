import { desc, isNull, count } from "drizzle-orm";
import {
  domains,
  contexts,
  understandingDomains,
  understandingConnections,
  understandings,
} from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import { toUnderstandingSummaries } from "../understanding/core";
import type { ProjectSnapshotResult } from "./types";

export class SnapshotCliBff {
  constructor(private db: ReflectaDb) {}

  async projectSnapshot(): Promise<ProjectSnapshotResult> {
    const allDomains = await this.db.select().from(domains).orderBy(domains.sortOrder);

    const tcCounts = await this.db
      .select({ domainId: understandingDomains.domainId, count: count() })
      .from(understandingDomains)
      .groupBy(understandingDomains.domainId);

    const countMap = new Map(tcCounts.map((c) => [c.domainId, c.count]));

    const catsWithCount = allDomains.map((c) => ({
      id: c.id,
      name: c.name,
      understandingCount: countMap.get(c.id) ?? 0,
    }));

    const recentUnderstandingRows = await this.db
      .select()
      .from(understandings)
      .where(isNull(understandings.deletedAt))
      .orderBy(desc(understandings.updatedAt))
      .limit(10);

    const recentUnderstandings = await toUnderstandingSummaries(this.db, recentUnderstandingRows);

    const [understandingCount, contextCount, domainCount, refCount] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(understandings)
        .where(isNull(understandings.deletedAt)),
      this.db.select({ count: count() }).from(contexts).where(isNull(contexts.deletedAt)),
      this.db.select({ count: count() }).from(domains),
      this.db.select({ count: count() }).from(understandingConnections),
    ]);

    return {
      domains: catsWithCount,
      recentUnderstandings,
      stats: {
        totalUnderstandings: understandingCount[0]?.count ?? 0,
        totalContexts: contextCount[0]?.count ?? 0,
        totalDomains: domainCount[0]?.count ?? 0,
        totalReferences: refCount[0]?.count ?? 0,
      },
    };
  }
}
