import { Atom } from "effect/unstable/reactivity";
import { runAtom } from "@renderer/lib/atoms";
import type { CanvasLibrarySortBy, CanvasLibraryTab } from "@reflecta/ui/canvas";

/**
 * 理解库筛选：keepAlive，收起面板卸载后仍保留搜索 / 领域 / 排序 / Tab。
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

export const libraryFiltersAtom: Atom.Writable<CanvasLibraryFilters, CanvasLibraryFilters> =
  Atom.keepAlive(Atom.make(initialLibraryFilters));

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
