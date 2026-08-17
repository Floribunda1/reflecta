/** 与 Tailwind `sm` / `lg` / `xl` 视口断点对齐，对应原来的 grid-cols-1/2/3/4。 */
export function captureGridColumnCount(viewportWidth: number): number {
  if (viewportWidth >= 1280) return 4;
  if (viewportWidth >= 1024) return 3;
  if (viewportWidth >= 640) return 2;
  return 1;
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
