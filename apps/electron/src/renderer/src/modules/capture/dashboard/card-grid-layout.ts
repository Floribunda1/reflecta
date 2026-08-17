/** 卡片可接受的最小宽度；列数按网格容器宽度算，随详情拖拽变化。 */
export const CAPTURE_GRID_MIN_CARD_PX = 240;
export const CAPTURE_GRID_GAP_PX = 12;
export const CAPTURE_GRID_MAX_COLUMNS = 4;

export function captureGridColumnCount(containerWidth: number): number {
  if (containerWidth <= 0) return 1;
  const columns = Math.floor(
    (containerWidth + CAPTURE_GRID_GAP_PX) / (CAPTURE_GRID_MIN_CARD_PX + CAPTURE_GRID_GAP_PX),
  );
  return Math.min(CAPTURE_GRID_MAX_COLUMNS, Math.max(1, columns));
}

export function captureGridRowCount(itemCount: number, columns: number): number {
  if (itemCount <= 0 || columns <= 0) return 0;
  return Math.ceil(itemCount / columns);
}

export function captureGridRowSlice<T>(
  items: readonly T[],
  rowIndex: number,
  columns: number,
): readonly T[] {
  const start = rowIndex * columns;
  return items.slice(start, start + columns);
}

export function captureGridVisibleSlice<T>(
  items: readonly T[],
  startRow: number,
  endRow: number,
  columns: number,
): readonly T[] {
  if (items.length === 0 || columns <= 0 || endRow < startRow) return [];
  return items.slice(startRow * columns, (endRow + 1) * columns);
}
