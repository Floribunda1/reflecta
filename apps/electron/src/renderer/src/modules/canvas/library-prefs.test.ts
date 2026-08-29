// @vitest-environment happy-dom
import { beforeEach, describe, expect, test } from "vitest";
import { Atom } from "effect/unstable/reactivity";
import { runAtom } from "@renderer/lib/atoms";
import { initialLibraryFilters, libraryFiltersAtom, patchLibraryFilters } from "./library-prefs";

describe("library filters", () => {
  beforeEach(() => {
    runAtom(Atom.set(libraryFiltersAtom, initialLibraryFilters));
  });

  test("patchLibraryFilters 更新筛选且相同值不换引用", () => {
    patchLibraryFilters({ searchQuery: "灌溉", selectedDomainId: "night-shift" });
    const first = runAtom(Atom.get(libraryFiltersAtom));
    expect(first).toEqual({
      ...initialLibraryFilters,
      searchQuery: "灌溉",
      selectedDomainId: "night-shift",
    });
    patchLibraryFilters({ searchQuery: "灌溉" });
    expect(runAtom(Atom.get(libraryFiltersAtom))).toBe(first);
  });

  test("收起面板（卸载）不会丢掉筛选", () => {
    patchLibraryFilters({
      tab: "canvases",
      searchQuery: "联调",
      includeDescendants: false,
      sortBy: "createdAt",
    });
    const saved = runAtom(Atom.get(libraryFiltersAtom));
    expect(runAtom(Atom.get(libraryFiltersAtom))).toBe(saved);
    expect(saved.tab).toBe("canvases");
    expect(saved.searchQuery).toBe("联调");
    expect(saved.includeDescendants).toBe(false);
    expect(saved.sortBy).toBe("createdAt");
  });
});
