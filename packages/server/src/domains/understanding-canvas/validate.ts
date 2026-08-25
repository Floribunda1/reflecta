import { inArray } from "drizzle-orm";
import { understandings } from "../../db/schema";
import type { ReflectaDb } from "../../db/types";
import { CanvasValidationError } from "@reflecta/shared";

/**
 * 文档级写路径下的引用完整性校验（§2.4）：确认引用理解存在（允许引用软删理解——
 * 占位语义由前端呈现）。纯结构校验（assertValidDocument 等）已上移到 @reflecta/shared。
 */

/**
 * 校验引用理解存在（允许引用软删理解——占位语义由前端呈现）。
 * 返回文档中引用的 understanding ids（去重），供调用方决定是否取 refs。
 */
export async function assertUnderstandingRefsExist(
  db: ReflectaDb,
  understandingIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(understandingIds)];
  if (uniqueIds.length === 0) return;
  const rows = await db
    .select({ id: understandings.id })
    .from(understandings)
    .where(inArray(understandings.id, uniqueIds));
  const found = new Set(rows.map((row) => row.id));
  const missing = uniqueIds.find((id) => !found.has(id));
  if (missing !== undefined) {
    throw new CanvasValidationError(`Understanding not found: ${missing}`);
  }
}
