import * as S from "effect/Schema";
import { Effect } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { markdownEquals } from "@reflecta/ui/editor/markdown-normalize";
import { kvsRuntime, runAtom } from "@renderer/lib/atoms";
import type { UnderstandingListSortBy } from "./dashboard/sort";

/**
 * 捕获/理解区 UI 状态（迁移到 Effect atoms）。
 *
 * - `prefsAtom`：持久化（localStorage `capture:state`）——选中域 / 排序 / 展开态等；
 * - 其余为 UI 瞬态原子：`selectedUnderstandingIdAtom` / `searchAtom` /
 *   `activeContextIdAtom` / `draftAtom`（草稿状态机）/ `agentDockAtom`。
 *
 * draft 状态机暂以单个 atom 承载其语义（保留给 P4-3 迁为显式状态 Effect 程序）。
 */

// --- 类型 ---

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

export type CaptureAgentScope = {
  type: "domain" | "understanding" | "canvas";
  id: string;
  title?: string;
};

export type CapturePrefs = {
  selectedDomainId: string;
  includeDescendants: boolean;
  understandingListSortBy: UnderstandingListSortBy;
  expandedDomainIds: Record<string, boolean>;
  participationOverviewCollapsed: boolean;
};

export type CaptureTransient = {
  selectedUnderstandingId: string | null;
  searchOpen: boolean;
  searchQuery: string;
  activeContextId: string | null;
  draft: CaptureDraft | null;
  agentDockOpen: boolean;
  agentDockScope: CaptureAgentScope | null;
  agentDockThreadId: string | null;
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
  toggleParticipationOverviewCollapsed: () => void;
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
  openAgentDock: (scope: CaptureAgentScope) => void;
  bindAgentDockThread: (threadId: string) => void;
  closeAgentDock: () => void;
};

export type CaptureStore = CapturePrefs & CaptureTransient & CaptureActions;

// --- 初始值 ---

export const initialPrefs: CapturePrefs = {
  selectedDomainId: "all",
  includeDescendants: true,
  understandingListSortBy: "updatedAt",
  expandedDomainIds: {},
  participationOverviewCollapsed: false,
};

const initialSearch = { open: false, query: "" };
const initialAgentDock = {
  open: false,
  scope: null as CaptureAgentScope | null,
  threadId: null as string | null,
};

// --- schema（持久化：只持久化 prefs 的 5 字段，对齐旧 `partialize`） ---

const PrefsSchema = S.Struct({
  selectedDomainId: S.String,
  includeDescendants: S.Boolean,
  understandingListSortBy: S.Union([S.Literal("updatedAt"), S.Literal("createdAt")]),
  expandedDomainIds: S.Record(S.String, S.Boolean),
  participationOverviewCollapsed: S.Boolean,
});

// --- atoms ---

export const prefsAtom: Atom.Writable<CapturePrefs, CapturePrefs> = Atom.keepAlive(
  Atom.kvs({
    runtime: kvsRuntime,
    key: "capture:state",
    schema: PrefsSchema,
    defaultValue: () => initialPrefs,
  }),
);
/** 足迹收起的局部订阅 atom：prefs 其他字段（selectedDomainId 等）变化时不通知订阅者。 */
export const participationCollapsedAtom = Atom.map(
  prefsAtom,
  (prefs) => prefs.participationOverviewCollapsed,
);
export const selectedUnderstandingIdAtom: Atom.Writable<string | null, string | null> =
  Atom.keepAlive(Atom.make<string | null>(null));
export const searchAtom: Atom.Writable<typeof initialSearch, typeof initialSearch> = Atom.keepAlive(
  Atom.make(initialSearch),
);
export const activeContextIdAtom: Atom.Writable<string | null, string | null> = Atom.keepAlive(
  Atom.make<string | null>(null),
);
export const draftAtom: Atom.Writable<CaptureDraft | null, CaptureDraft | null> = Atom.keepAlive(
  Atom.make<CaptureDraft | null>(null),
);
export const agentDockAtom: Atom.Writable<typeof initialAgentDock, typeof initialAgentDock> =
  Atom.keepAlive(Atom.make(initialAgentDock));

// --- 纯辅助 ---

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
  return draft.title !== draft.baseTitle || !markdownEquals(draft.body, draft.baseBody);
}

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

function sameAgentScope(left: CaptureAgentScope | null, right: CaptureAgentScope) {
  return Boolean(left && left.type === right.type && left.id === right.id);
}

const clearUnderstanding = Effect.gen(function* () {
  yield* Atom.set(selectedUnderstandingIdAtom, null);
  yield* Atom.set(activeContextIdAtom, null);
  yield* Atom.set(draftAtom, null);
});

const closeAgentDock = Effect.gen(function* () {
  yield* Atom.update(agentDockAtom, (dock) => ({ ...dock, open: false }));
});

// --- actions（按 registry 参数化；captureActions 用全局 appAtomRegistry，
// createCaptureStore 用每实例 registry，实现多实例隔离） ---

type RunWith = <A, E>(
  effect: Effect.Effect<A, E, import("effect/unstable/reactivity").AtomRegistry.AtomRegistry>,
) => A;

function makeCaptureActions(run: RunWith): CaptureActions {
  return {
    selectDomain: (domainId) =>
      run(
        Effect.gen(function* () {
          yield* Atom.update(prefsAtom, (s) => ({ ...s, selectedDomainId: domainId }));
          yield* clearUnderstanding;
        }),
      ),

    selectUnderstanding: (understandingId) =>
      run(
        Effect.gen(function* () {
          const current = yield* Atom.get(selectedUnderstandingIdAtom);
          yield* Atom.set(selectedUnderstandingIdAtom, understandingId);
          yield* Atom.set(activeContextIdAtom, null);
          if (current !== understandingId) yield* Atom.set(draftAtom, null);
        }),
      ),

    reconcileSelectedUnderstanding: (visibleUnderstandingIds) =>
      run(
        Effect.gen(function* () {
          const selected = yield* Atom.get(selectedUnderstandingIdAtom);
          if (selected && !visibleUnderstandingIds.has(selected)) yield* clearUnderstanding;
        }),
      ),

    setSearchOpen: (open) =>
      run(Atom.update(searchAtom, (s) => ({ ...s, open, query: open ? s.query : "" }))),

    setSearchQuery: (query) => run(Atom.update(searchAtom, (s) => ({ ...s, query }))),

    setIncludeDescendants: (include) =>
      run(Atom.update(prefsAtom, (s) => ({ ...s, includeDescendants: include }))),

    setUnderstandingListSortBy: (sortBy) =>
      run(Atom.update(prefsAtom, (s) => ({ ...s, understandingListSortBy: sortBy }))),

    toggleDomainExpanded: (domainId) =>
      run(
        Atom.update(prefsAtom, (s) => {
          const next = { ...s.expandedDomainIds };
          if (next[domainId]) delete next[domainId];
          else next[domainId] = true;
          return { ...s, expandedDomainIds: next };
        }),
      ),

    toggleParticipationOverviewCollapsed: () =>
      run(
        Atom.update(prefsAtom, (s) => ({
          ...s,
          participationOverviewCollapsed: !s.participationOverviewCollapsed,
        })),
      ),

    reconcileExpandedDomains: (validIds) =>
      run(
        Atom.update(prefsAtom, (state) => {
          const expandedDomainIds = Object.fromEntries(
            Object.entries(state.expandedDomainIds).filter(
              ([domainId, expanded]) => expanded && validIds.has(domainId),
            ),
          );
          if (expandedDomainKeysEqual(state.expandedDomainIds, expandedDomainIds)) return state;
          return { ...state, expandedDomainIds };
        }),
      ),

    expandDomainAncestors: (domainIds) =>
      run(
        Atom.update(prefsAtom, (s) => ({
          ...s,
          expandedDomainIds: {
            ...s.expandedDomainIds,
            ...Object.fromEntries(domainIds.map((domainId) => [domainId, true])),
          },
        })),
      ),

    setActiveContextId: (contextId) => run(Atom.set(activeContextIdAtom, contextId)),

    initializeDraft: (input) =>
      run(
        Effect.gen(function* () {
          const draft = yield* Atom.get(draftAtom);
          if (draft?.understandingId === input.understandingId && draft.dirty) return;
          yield* Atom.set(draftAtom, makeDraft(input));
        }),
      ),

    updateDraftTitle: (title) =>
      run(
        Atom.update(draftAtom, (draft) => {
          if (!draft) return draft;
          const next = { ...draft, title, error: null };
          return { ...next, dirty: isDraftDirty(next) };
        }),
      ),

    updateDraftBody: (body) =>
      run(
        Atom.update(draftAtom, (draft) => {
          if (!draft) return draft;
          const next = { ...draft, body, error: null };
          return { ...next, dirty: isDraftDirty(next) };
        }),
      ),

    markDraftSaveStarted: (understandingId) =>
      run(
        Atom.update(draftAtom, (draft) => {
          if (!draft || draft.understandingId !== understandingId) return draft;
          return {
            ...draft,
            saving: true,
            error: null,
            saveRequestedAt: new Date().toISOString(),
          };
        }),
      ),

    markDraftSaveSucceeded: ({ understandingId, title, body, savedAt }) =>
      run(
        Atom.update(draftAtom, (draft) => {
          if (!draft || draft.understandingId !== understandingId) return draft;
          const next = {
            ...draft,
            baseTitle: title,
            baseBody: body,
            saving: false,
            error: null,
            lastSavedAt: savedAt,
            saveRequestedAt: null,
          };
          return { ...next, dirty: isDraftDirty(next) };
        }),
      ),

    markDraftSaveFailed: ({ understandingId, error }) =>
      run(
        Atom.update(draftAtom, (draft) => {
          if (!draft || draft.understandingId !== understandingId) return draft;
          return { ...draft, saving: false, error, saveRequestedAt: null };
        }),
      ),

    resetAfterUnderstandingDeleted: (understandingId) =>
      run(
        Effect.gen(function* () {
          const [selected, draft, dock] = yield* Effect.all([
            Atom.get(selectedUnderstandingIdAtom),
            Atom.get(draftAtom),
            Atom.get(agentDockAtom),
          ]);
          const agentScopeMatches =
            dock.scope?.type === "understanding" && dock.scope.id === understandingId;
          if (
            selected !== understandingId &&
            draft?.understandingId !== understandingId &&
            !agentScopeMatches
          )
            return;
          if (selected === understandingId || draft?.understandingId === understandingId) {
            yield* clearUnderstanding;
          }
          if (agentScopeMatches) {
            yield* Atom.set(agentDockAtom, initialAgentDock);
          }
        }),
      ),

    resetAfterDomainDeleted: (deletedDomainIds) =>
      run(
        Effect.gen(function* () {
          const [prefs, dock] = yield* Effect.all([Atom.get(prefsAtom), Atom.get(agentDockAtom)]);
          const expandedDomainIds = Object.fromEntries(
            Object.entries(prefs.expandedDomainIds).filter(
              ([domainId]) => !deletedDomainIds.has(domainId),
            ),
          );
          const domainAgentScopeDeleted =
            dock.scope?.type === "domain" && deletedDomainIds.has(dock.scope.id);
          if (deletedDomainIds.has(prefs.selectedDomainId)) {
            yield* Atom.update(prefsAtom, (s) => ({
              ...s,
              selectedDomainId: "all",
              expandedDomainIds,
            }));
            yield* clearUnderstanding;
          } else {
            yield* Atom.update(prefsAtom, (s) => ({ ...s, expandedDomainIds }));
          }
          if (domainAgentScopeDeleted) {
            yield* Atom.set(agentDockAtom, initialAgentDock);
          }
        }),
      ),

    openAgentDock: (scope) =>
      run(
        Effect.gen(function* () {
          const dock = yield* Atom.get(agentDockAtom);
          yield* Atom.set(agentDockAtom, {
            open: true,
            scope,
            threadId: sameAgentScope(dock.scope, scope) ? dock.threadId : null,
          });
        }),
      ),

    bindAgentDockThread: (threadId) =>
      run(Atom.update(agentDockAtom, (dock) => ({ ...dock, threadId }))),

    closeAgentDock: () => run(closeAgentDock),
  };
}

export const captureActions: CaptureActions = makeCaptureActions(runAtom);

/** 命令式读全局 store 的某个 atom（getState 等价，与 React 共享 registry）。 */
export const readCaptureState = <A>(atom: Atom.Atom<A>): A => runAtom(Atom.get(atom));

export const initialCaptureState: CapturePrefs & CaptureTransient = {
  ...initialPrefs,
  selectedUnderstandingId: null,
  searchOpen: false,
  searchQuery: "",
  activeContextId: null,
  draft: null,
  agentDockOpen: false,
  agentDockScope: null,
  agentDockThreadId: null,
};

export type CaptureStoreApi = { getState: () => CaptureStore };

/** 多实例 / 单测：每实例独立 registry + 独立 atom 状态（如只读预览不同交互态）。 */
export function createCaptureStore(
  initialState: CapturePrefs & CaptureTransient = initialCaptureState,
): CaptureStoreApi {
  const registry = AtomRegistry.make({});
  const run: RunWith = <A, E>(effect: Effect.Effect<A, E, AtomRegistry.AtomRegistry>): A =>
    Effect.runSync(effect.pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)));

  run(
    Effect.gen(function* () {
      yield* Atom.set(prefsAtom, {
        selectedDomainId: initialState.selectedDomainId,
        includeDescendants: initialState.includeDescendants,
        understandingListSortBy: initialState.understandingListSortBy,
        expandedDomainIds: initialState.expandedDomainIds,
        participationOverviewCollapsed: initialState.participationOverviewCollapsed,
      });
      yield* Atom.set(selectedUnderstandingIdAtom, initialState.selectedUnderstandingId);
      yield* Atom.set(searchAtom, {
        open: initialState.searchOpen,
        query: initialState.searchQuery,
      });
      yield* Atom.set(activeContextIdAtom, initialState.activeContextId);
      yield* Atom.set(draftAtom, initialState.draft ?? null);
      yield* Atom.set(agentDockAtom, {
        open: initialState.agentDockOpen,
        scope: initialState.agentDockScope,
        threadId: initialState.agentDockThreadId,
      });
    }),
  );

  const actions = makeCaptureActions(run);
  const getState = (): CaptureStore => {
    const prefs = run(Atom.get(prefsAtom));
    const search = run(Atom.get(searchAtom));
    const dock = run(Atom.get(agentDockAtom));
    return {
      ...prefs,
      selectedUnderstandingId: run(Atom.get(selectedUnderstandingIdAtom)),
      searchOpen: search.open,
      searchQuery: search.query,
      activeContextId: run(Atom.get(activeContextIdAtom)),
      draft: run(Atom.get(draftAtom)),
      agentDockOpen: dock.open,
      agentDockScope: dock.scope,
      agentDockThreadId: dock.threadId,
      ...actions,
    };
  };
  return { getState };
}
