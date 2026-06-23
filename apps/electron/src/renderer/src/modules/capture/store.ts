import { create, type StateCreator } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import { createJSONStorage, persist } from "zustand/middleware";
import type { UnderstandingListSortBy } from "./understanding-list/sort";
import { milkdownMarkdownEquals } from "@renderer/modules/shared/components/markdown-editor/editor/markdown-normalize";

export type CaptureDraft = {
  understandingId: string;
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
  selectedDomainId: string;
  selectedUnderstandingId: string | null;
  searchOpen: boolean;
  searchQuery: string;
  includeDescendants: boolean;
  understandingListSortBy: UnderstandingListSortBy;
  expandedDomainIds: Record<string, boolean>;
  activeContextId: string | null;
  draft: CaptureDraft | null;
};

export type CaptureActions = {
  selectDomain: (domainId: string) => void;
  selectUnderstanding: (understandingId: string | null) => void;
  reconcileSelectedUnderstanding: (visibleUnderstandingIds: Set<string>) => void;
  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setIncludeDescendants: (include: boolean) => void;
  setUnderstandingListSortBy: (sortBy: UnderstandingListSortBy) => void;
  toggleDomainExpanded: (domainId: string) => void;
  reconcileExpandedDomains: (validIds: Set<string>) => void;
  expandDomainAncestors: (domainIds: string[]) => void;
  setActiveContextId: (contextId: string | null) => void;
  initializeDraft: (input: { understandingId: string; title: string; body: string }) => void;
  updateDraftTitle: (title: string) => void;
  updateDraftBody: (body: string) => void;
  markDraftSaveStarted: (understandingId: string) => void;
  markDraftSaveSucceeded: (input: {
    understandingId: string;
    title: string;
    body: string;
    savedAt: string;
  }) => void;
  markDraftSaveFailed: (input: { understandingId: string; error: string }) => void;
  resetAfterUnderstandingDeleted: (understandingId: string) => void;
  resetAfterDomainDeleted: (deletedDomainIds: Set<string>) => void;
};

export type CaptureStore = CaptureState & CaptureActions;

export const initialCaptureState: CaptureState = {
  selectedDomainId: "all",
  selectedUnderstandingId: null,
  searchOpen: false,
  searchQuery: "",
  includeDescendants: true,
  understandingListSortBy: "updatedAt",
  expandedDomainIds: {},
  activeContextId: null,
  draft: null,
};

function expandedDomainKeysEqual(
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

function makeDraft(input: { understandingId: string; title: string; body: string }): CaptureDraft {
  return {
    understandingId: input.understandingId,
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
  return draft.title !== draft.baseTitle || !milkdownMarkdownEquals(draft.body, draft.baseBody);
}

function clearUnderstandingState(state: CaptureStore): Partial<CaptureStore> {
  if (!state.selectedUnderstandingId && !state.activeContextId && !state.draft) return {};
  return {
    selectedUnderstandingId: null,
    activeContextId: null,
    draft: null,
  };
}

export function createCaptureState(
  initialState: CaptureState = initialCaptureState,
): StateCreator<CaptureStore> {
  return (set) => ({
    ...initialState,

    selectDomain: (domainId) =>
      set((state) => ({
        selectedDomainId: domainId,
        ...clearUnderstandingState(state),
      })),

    selectUnderstanding: (understandingId) =>
      set((state) => ({
        selectedUnderstandingId: understandingId,
        activeContextId: null,
        draft: state.selectedUnderstandingId === understandingId ? state.draft : null,
      })),

    reconcileSelectedUnderstanding: (visibleUnderstandingIds) =>
      set((state) => {
        if (
          !state.selectedUnderstandingId ||
          visibleUnderstandingIds.has(state.selectedUnderstandingId)
        )
          return {};
        return clearUnderstandingState(state);
      }),

    setSearchOpen: (open) =>
      set((state) => ({
        searchOpen: open,
        searchQuery: open ? state.searchQuery : "",
      })),

    setSearchQuery: (query) => set({ searchQuery: query }),

    setIncludeDescendants: (include) => set({ includeDescendants: include }),

    setUnderstandingListSortBy: (sortBy) => set({ understandingListSortBy: sortBy }),

    toggleDomainExpanded: (domainId) =>
      set((state) => {
        const next = { ...state.expandedDomainIds };
        if (next[domainId]) {
          delete next[domainId];
        } else {
          next[domainId] = true;
        }
        return { expandedDomainIds: next };
      }),

    reconcileExpandedDomains: (validIds) =>
      set((state) => {
        const expandedDomainIds = Object.fromEntries(
          Object.entries(state.expandedDomainIds).filter(
            ([domainId, expanded]) => expanded && validIds.has(domainId),
          ),
        );
        if (expandedDomainKeysEqual(state.expandedDomainIds, expandedDomainIds)) return {};
        return { expandedDomainIds };
      }),

    expandDomainAncestors: (domainIds) =>
      set((state) => {
        if (domainIds.every((domainId) => state.expandedDomainIds[domainId])) return {};
        return {
          expandedDomainIds: {
            ...state.expandedDomainIds,
            ...Object.fromEntries(domainIds.map((domainId) => [domainId, true])),
          },
        };
      }),

    setActiveContextId: (contextId) => set({ activeContextId: contextId }),

    initializeDraft: (input) =>
      set((state) => {
        if (state.draft?.understandingId === input.understandingId && state.draft.dirty) return {};
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

    markDraftSaveStarted: (understandingId) =>
      set((state) => {
        if (state.draft?.understandingId !== understandingId) return {};
        return {
          draft: {
            ...state.draft,
            saving: true,
            error: null,
            saveRequestedAt: new Date().toISOString(),
          },
        };
      }),

    markDraftSaveSucceeded: ({ understandingId, title, body, savedAt }) =>
      set((state) => {
        if (state.draft?.understandingId !== understandingId) return {};
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

    markDraftSaveFailed: ({ understandingId, error }) =>
      set((state) => {
        if (state.draft?.understandingId !== understandingId) return {};
        return {
          draft: {
            ...state.draft,
            saving: false,
            error,
            saveRequestedAt: null,
          },
        };
      }),

    resetAfterUnderstandingDeleted: (understandingId) =>
      set((state) => {
        if (
          state.selectedUnderstandingId !== understandingId &&
          state.draft?.understandingId !== understandingId
        )
          return {};
        return clearUnderstandingState(state);
      }),

    resetAfterDomainDeleted: (deletedDomainIds) =>
      set((state) => {
        const expandedDomainIds = Object.fromEntries(
          Object.entries(state.expandedDomainIds).filter(
            ([domainId]) => !deletedDomainIds.has(domainId),
          ),
        );
        if (!deletedDomainIds.has(state.selectedDomainId)) {
          return { expandedDomainIds };
        }
        return {
          selectedDomainId: "all",
          expandedDomainIds,
          ...clearUnderstandingState(state),
        };
      }),
  });
}

export function createCaptureStore(initialState: CaptureState = initialCaptureState) {
  return createStore<CaptureStore>()(createCaptureState(initialState));
}

type PersistedCaptureState = Pick<
  CaptureStore,
  "selectedDomainId" | "includeDescendants" | "understandingListSortBy" | "expandedDomainIds"
>;

export const useCaptureStore = create<CaptureStore>()(
  persist(createCaptureState(), {
    name: "capture:state",
    storage: createJSONStorage(() => localStorage),
    partialize: (state): PersistedCaptureState => ({
      selectedDomainId: state.selectedDomainId,
      includeDescendants: state.includeDescendants,
      understandingListSortBy: state.understandingListSortBy,
      expandedDomainIds: state.expandedDomainIds,
    }),
  }),
);

export type CaptureStoreApi = StoreApi<CaptureStore>;
