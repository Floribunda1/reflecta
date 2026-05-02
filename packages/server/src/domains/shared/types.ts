export type PageInfo = {
  limit: number;
  offset?: number;
  nextOffset?: number | null;
  hasMore: boolean;
};

export function makePageInfo(limit: number, offset: number, hasMore: boolean): PageInfo {
  return {
    limit,
    offset,
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
  };
}
