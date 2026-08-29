import { Atom } from "effect/unstable/reactivity";
import * as S from "effect/Schema";
import { kvsRuntime, runAtom } from "@renderer/lib/atoms";
import type { CanvasLibrarySortBy, CanvasLibraryTab } from "@reflecta/ui/canvas";

/**
 * 理解库面板的 UI 偏好。
 *
 * 筛选与右侧栏宽度都要在收起后还在：面板卸载不能丢掉它们。
 * 筛选是会话内 keepAlive；宽度落 localStorage，下次展开按上次拖过的尺寸打开。
 */

export type CanvasLibraryFilters = {
  tab: CanvasLibraryTab;
  selectedDomainId: string;
  includeDescendants: boolean;
  searchQuery: string;
  sortBy: CanvasLibrarySortBy;
};

export const initialLibraryFilters: CanvasLibraryFilters = {
  tab: "understandings",
  selectedDomainId: "all",
  includeDescendants: true,
  searchQuery: "",
  sortBy: "updatedAt",
};

export const DEFAULT_CANVAS_RIGHT_PANEL_SIZE = "32%";
const MIN_RIGHT_PANEL_PCT = 24;
const MAX_RIGHT_PANEL_PCT = 80;

export const libraryFiltersAtom: Atom.Writable<CanvasLibraryFilters, CanvasLibraryFilters> =
  Atom.keepAlive(Atom.make(initialLibraryFilters));

export const canvasRightPanelSizeAtom: Atom.Writable<string, string> = Atom.keepAlive(
  Atom.kvs({
    runtime: kvsRuntime,
    key: "canvas:rightPanelSize",
    schema: S.String,
    defaultValue: () => DEFAULT_CANVAS_RIGHT_PANEL_SIZE,
  }),
);

export function patchLibraryFilters(patch: Partial<CanvasLibraryFilters>): void {
  runAtom(
    Atom.update(libraryFiltersAtom, (current) => {
      const next = { ...current, ...patch };
      if (
        next.tab === current.tab &&
        next.selectedDomainId === current.selectedDomainId &&
        next.includeDescendants === current.includeDescendants &&
        next.searchQuery === current.searchQuery &&
        next.sortBy === current.sortBy
      ) {
        return current;
      }
      return next;
    }),
  );
}

export function normalizeCanvasRightPanelSize(size: string): string {
  const pct = Number.parseFloat(size);
  if (!Number.isFinite(pct)) return DEFAULT_CANVAS_RIGHT_PANEL_SIZE;
  return `${Math.min(MAX_RIGHT_PANEL_PCT, Math.max(MIN_RIGHT_PANEL_PCT, Math.round(pct)))}%`;
}

export function persistCanvasRightPanelSize(asPercentage: number): void {
  const next = normalizeCanvasRightPanelSize(`${asPercentage}%`);
  runAtom(Atom.update(canvasRightPanelSizeAtom, (current) => (current === next ? current : next)));
}
