import { create, type StateCreator } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ThoughtListSortBy } from "./thought-list/sort";

export type CaptureDraft = {
  thoughtId: string;
  title: string;
  body: string;
  baseTitle: string;
  baseBody: string;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  lastSavedAt: string | null;
  saveRequestedAt: string | null;
};

export type CaptureState = {
  selectedCategoryId: string;
  selectedThoughtId: string | null;
  searchOpen: boolean;
  searchQuery: string;
  includeDescendants: boolean;
  thoughtListSortBy: ThoughtListSortBy;
  expandedCategoryIds: Record<string, boolean>;
  activeSourceId: string | null;
  draft: CaptureDraft | null;
};

export type CaptureActions = {
  selectCategory: (categoryId: string) => void;
  selectThought: (thoughtId: string | null) => void;
  selectThoughtFromSearch: (input: { thoughtId: string; categoryIds?: string[] }) => void;
  reconcileSelectedThought: (visibleThoughtIds: Set<string>) => void;
  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setIncludeDescendants: (include: boolean) => void;
  setThoughtListSortBy: (sortBy: ThoughtListSortBy) => void;
  toggleCategoryExpanded: (categoryId: string) => void;
  reconcileExpandedCategories: (validIds: Set<string>) => void;
  expandCategoryAncestors: (categoryIds: string[]) => void;
  setActiveSourceId: (sourceId: string | null) => void;
  initializeDraft: (input: { thoughtId: string; title: string; body: string }) => void;
  updateDraftTitle: (title: string) => void;
  updateDraftBody: (body: string) => void;
  markDraftSaveStarted: (thoughtId: string) => void;
  markDraftSaveSucceeded: (input: {
    thoughtId: string;
    title: string;
    body: string;
    savedAt: string;
  }) => void;
  markDraftSaveFailed: (input: { thoughtId: string; error: string }) => void;
  resetAfterThoughtDeleted: (thoughtId: string) => void;
  resetAfterCategoryDeleted: (deletedCategoryIds: Set<string>) => void;
};

export type CaptureStore = CaptureState & CaptureActions;

export const initialCaptureState: CaptureState = {
  selectedCategoryId: "all",
  selectedThoughtId: null,
  searchOpen: false,
  searchQuery: "",
  includeDescendants: true,
  thoughtListSortBy: "updatedAt",
  expandedCategoryIds: {},
  activeSourceId: null,
  draft: null,
};

function expandedCategoryKeysEqual(
  left: Record<string, boolean>,
  right: Record<string, boolean>,
): boolean {
  const leftKeys = Object.keys(left)
    .filter((key) => left[key])
    .sort();
  const rightKeys = Object.keys(right)
    .filter((key) => right[key])
    .sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key, index) => key === rightKeys[index]);
}

function makeDraft(input: { thoughtId: string; title: string; body: string }): CaptureDraft {
  return {
    thoughtId: input.thoughtId,
    title: input.title,
    body: input.body,
    baseTitle: input.title,
    baseBody: input.body,
    dirty: false,
    saving: false,
    error: null,
    lastSavedAt: null,
    saveRequestedAt: null,
  };
}

function isDraftDirty(draft: Pick<CaptureDraft, "title" | "body" | "baseTitle" | "baseBody">) {
  return draft.title !== draft.baseTitle || draft.body !== draft.baseBody;
}

function clearThoughtState(state: CaptureStore): Partial<CaptureStore> {
  if (!state.selectedThoughtId && !state.activeSourceId && !state.draft) return {};
  return {
    selectedThoughtId: null,
    activeSourceId: null,
    draft: null,
  };
}

export function createCaptureState(
  initialState: CaptureState = initialCaptureState,
): StateCreator<CaptureStore> {
  return (set) => ({
    ...initialState,

    selectCategory: (categoryId) =>
      set((state) => ({
        selectedCategoryId: categoryId,
        ...clearThoughtState(state),
      })),

    selectThought: (thoughtId) =>
      set((state) => ({
        selectedThoughtId: thoughtId,
        activeSourceId: null,
        draft: state.selectedThoughtId === thoughtId ? state.draft : null,
      })),

    selectThoughtFromSearch: ({ thoughtId, categoryIds }) =>
      set((state) => ({
        selectedCategoryId: categoryIds?.[0] ?? "all",
        selectedThoughtId: thoughtId,
        activeSourceId: null,
        draft: state.selectedThoughtId === thoughtId ? state.draft : null,
      })),

    reconcileSelectedThought: (visibleThoughtIds) =>
      set((state) => {
        if (!state.selectedThoughtId || visibleThoughtIds.has(state.selectedThoughtId)) return {};
        return clearThoughtState(state);
      }),

    setSearchOpen: (open) =>
      set((state) => ({
        searchOpen: open,
        searchQuery: open ? state.searchQuery : "",
      })),

    setSearchQuery: (query) => set({ searchQuery: query }),

    setIncludeDescendants: (include) => set({ includeDescendants: include }),

    setThoughtListSortBy: (sortBy) => set({ thoughtListSortBy: sortBy }),

    toggleCategoryExpanded: (categoryId) =>
      set((state) => {
        const next = { ...state.expandedCategoryIds };
        if (next[categoryId]) {
          delete next[categoryId];
        } else {
          next[categoryId] = true;
        }
        return { expandedCategoryIds: next };
      }),

    reconcileExpandedCategories: (validIds) =>
      set((state) => {
        const expandedCategoryIds = Object.fromEntries(
          Object.entries(state.expandedCategoryIds).filter(
            ([categoryId, expanded]) => expanded && validIds.has(categoryId),
          ),
        );
        if (expandedCategoryKeysEqual(state.expandedCategoryIds, expandedCategoryIds)) return {};
        return { expandedCategoryIds };
      }),

    expandCategoryAncestors: (categoryIds) =>
      set((state) => {
        if (categoryIds.every((categoryId) => state.expandedCategoryIds[categoryId])) return {};
        return {
          expandedCategoryIds: {
            ...state.expandedCategoryIds,
            ...Object.fromEntries(categoryIds.map((categoryId) => [categoryId, true])),
          },
        };
      }),

    setActiveSourceId: (sourceId) => set({ activeSourceId: sourceId }),

    initializeDraft: (input) =>
      set((state) => {
        if (state.draft?.thoughtId === input.thoughtId && state.draft.dirty) return {};
        return { draft: makeDraft(input) };
      }),

    updateDraftTitle: (title) =>
      set((state) => {
        if (!state.draft) return {};
        const draft = { ...state.draft, title, error: null };
        return { draft: { ...draft, dirty: isDraftDirty(draft) } };
      }),

    updateDraftBody: (body) =>
      set((state) => {
        if (!state.draft) return {};
        const draft = { ...state.draft, body, error: null };
        return { draft: { ...draft, dirty: isDraftDirty(draft) } };
      }),

    markDraftSaveStarted: (thoughtId) =>
      set((state) => {
        if (state.draft?.thoughtId !== thoughtId) return {};
        return {
          draft: {
            ...state.draft,
            saving: true,
            error: null,
            saveRequestedAt: new Date().toISOString(),
          },
        };
      }),

    markDraftSaveSucceeded: ({ thoughtId, title, body, savedAt }) =>
      set((state) => {
        if (state.draft?.thoughtId !== thoughtId) return {};
        const draft = {
          ...state.draft,
          baseTitle: title,
          baseBody: body,
          saving: false,
          error: null,
          lastSavedAt: savedAt,
          saveRequestedAt: null,
        };
        return { draft: { ...draft, dirty: isDraftDirty(draft) } };
      }),

    markDraftSaveFailed: ({ thoughtId, error }) =>
      set((state) => {
        if (state.draft?.thoughtId !== thoughtId) return {};
        return {
          draft: {
            ...state.draft,
            saving: false,
            error,
            saveRequestedAt: null,
          },
        };
      }),

    resetAfterThoughtDeleted: (thoughtId) =>
      set((state) => {
        if (state.selectedThoughtId !== thoughtId && state.draft?.thoughtId !== thoughtId)
          return {};
        return clearThoughtState(state);
      }),

    resetAfterCategoryDeleted: (deletedCategoryIds) =>
      set((state) => {
        const expandedCategoryIds = Object.fromEntries(
          Object.entries(state.expandedCategoryIds).filter(
            ([categoryId]) => !deletedCategoryIds.has(categoryId),
          ),
        );
        if (!deletedCategoryIds.has(state.selectedCategoryId)) {
          return { expandedCategoryIds };
        }
        return {
          selectedCategoryId: "all",
          expandedCategoryIds,
          ...clearThoughtState(state),
        };
      }),
  });
}

export function createCaptureStore(initialState: CaptureState = initialCaptureState) {
  return createStore<CaptureStore>()(createCaptureState(initialState));
}

type PersistedCaptureState = Pick<
  CaptureStore,
  "selectedCategoryId" | "includeDescendants" | "thoughtListSortBy" | "expandedCategoryIds"
>;

export const useCaptureStore = create<CaptureStore>()(
  persist(createCaptureState(), {
    name: "capture:state",
    storage: createJSONStorage(() => localStorage),
    partialize: (state): PersistedCaptureState => ({
      selectedCategoryId: state.selectedCategoryId,
      includeDescendants: state.includeDescendants,
      thoughtListSortBy: state.thoughtListSortBy,
      expandedCategoryIds: state.expandedCategoryIds,
    }),
  }),
);

export type CaptureStoreApi = StoreApi<CaptureStore>;
