import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const selectedCategoryIdAtom = atomWithStorage("capture:selectedCategoryId", "all");

export const selectedThoughtIdAtom = atomWithStorage<string | null>(
  "capture:selectedThoughtId",
  null,
);

export const expandedCategoryKeysAtom = atomWithStorage<Record<string, boolean>>(
  "capture:expandedCategoryKeys",
  {},
);

/** Select a category and clear the current thought selection. */
export const selectCategoryAtom = atom(null, (_get, set, categoryId: string) => {
  set(selectedCategoryIdAtom, categoryId);
  set(selectedThoughtIdAtom, null);
});
