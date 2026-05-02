export type PageInfo = {
  limit: number;
  offset?: number;
  nextOffset?: number | null;
  hasMore: boolean;
};
