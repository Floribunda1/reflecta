# Capture State Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the capture module's mixed Jotai/local-state/query-cache patching with a clear Zustand client-state store plus React Query server-state boundary.

**Architecture:** React Query remains the only source for saved category/thought/context data. Zustand owns capture UI/session state, the current thought draft, and save status through selector-friendly actions. Mutations call IPC and invalidate queries; they do not write unsaved drafts into React Query caches.

**Tech Stack:** React 19, Zustand, React Query 5, Vitest, Bun, Electron IPC proxy.

---

## File Structure

- Create `apps/electron/src/renderer/src/modules/capture/store.ts` for all capture client state and pure actions.
- Create `apps/electron/src/renderer/src/modules/capture/store.test.ts` for store lifecycle tests.
- Create `apps/electron/src/renderer/src/modules/capture/queries.ts` for query keys, query hooks, mutations, and invalidation helpers.
- Create `apps/electron/src/renderer/src/modules/capture/useThoughtDraftAutosave.ts` for debounced, sequential draft saving.
- Create `apps/electron/src/renderer/src/modules/capture/useThoughtDraftAutosave.test.ts` for autosave behavior.
- Modify `apps/electron/package.json` and `bun.lock` to add `zustand`.
- Modify `apps/electron/src/renderer/src/modules/capture/index.tsx` to use store actions for selection/search bridge.
- Modify `apps/electron/src/renderer/src/modules/capture/category/hooks.ts` and `apps/electron/src/renderer/src/modules/capture/category/components/CategoryTree.tsx` to use centralized queries/mutations and Zustand state.
- Modify `apps/electron/src/renderer/src/modules/capture/thought-list/hooks.ts`, `apps/electron/src/renderer/src/modules/capture/thought-list/index.tsx`, and `apps/electron/src/renderer/src/modules/capture/thought-list/ThoughtRow.tsx` to read saved summaries only and use store selection/actions.
- Modify `apps/electron/src/renderer/src/modules/capture/thought-detail/hooks.ts` and `apps/electron/src/renderer/src/modules/capture/thought-detail/ThoughtDetail.tsx` to use saved detail query plus Zustand draft/autosave.
- Remove old capture Jotai state from `apps/electron/src/renderer/src/modules/capture/state.ts`.
- Delete old workaround tests `apps/electron/src/renderer/src/modules/capture/thought-detail/hooks.test.ts` and `apps/electron/src/renderer/src/modules/capture/thought-list/hooks.test.ts`.

## Task 1: Add Zustand Dependency

**Files:**

- Modify: `apps/electron/package.json`
- Modify: `bun.lock`

- [ ] **Step 1: Add dependency**

Run:

```bash
cd <projectRoot>
rtk bun add zustand --filter @reflecta/electron
```

Expected: `apps/electron/package.json` contains a `zustand` dependency and `bun.lock` is updated.

## Task 2: Implement Capture Store With TDD

**Files:**

- Create: `apps/electron/src/renderer/src/modules/capture/store.test.ts`
- Create: `apps/electron/src/renderer/src/modules/capture/store.ts`

- [ ] **Step 1: Write failing store tests**

Test the required state transitions:

```ts
// @vitest-environment happy-dom

import { beforeEach, describe, expect, test } from "vitest";
import { createCaptureStore, initialCaptureState } from "./store";

describe("capture store", () => {
  beforeEach(() => localStorage.clear());

  test("selectCategory clears selected thought, active source, and draft", () => {
    const store = createCaptureStore();
    store.getState().selectThought("thought-1");
    store.getState().setActiveSourceId("source-1");
    store.getState().initializeDraft({ thoughtId: "thought-1", title: "A", body: "B" });

    store.getState().selectCategory("category-1");

    expect(store.getState().selectedCategoryId).toBe("category-1");
    expect(store.getState().selectedThoughtId).toBeNull();
    expect(store.getState().activeSourceId).toBeNull();
    expect(store.getState().draft).toBeNull();
  });

  test("reconcileSelectedThought clears invisible selected thought", () => {
    const store = createCaptureStore();
    store.getState().selectThought("missing");

    store.getState().reconcileSelectedThought(new Set(["visible"]));

    expect(store.getState().selectedThoughtId).toBeNull();
  });

  test("initializeDraft does not overwrite a dirty draft for the same thought", () => {
    const store = createCaptureStore();
    store.getState().initializeDraft({ thoughtId: "t1", title: "Saved", body: "Saved body" });
    store.getState().updateDraftBody("Local body");

    store.getState().initializeDraft({ thoughtId: "t1", title: "Server", body: "Server body" });

    expect(store.getState().draft?.body).toBe("Local body");
    expect(store.getState().draft?.dirty).toBe(true);
  });

  test("markDraftSaveSucceeded updates base values and clears dirty flags", () => {
    const store = createCaptureStore();
    store.getState().initializeDraft({ thoughtId: "t1", title: "Old", body: "Old body" });
    store.getState().updateDraftTitle("New");
    store.getState().markDraftSaveStarted("t1");

    store.getState().markDraftSaveSucceeded({
      thoughtId: "t1",
      title: "New",
      body: "Old body",
      savedAt: "2026-06-15T00:00:00.000Z",
    });

    expect(store.getState().draft).toMatchObject({
      title: "New",
      baseTitle: "New",
      dirty: false,
      saving: false,
      error: null,
    });
  });

  test("markDraftSaveFailed keeps draft content", () => {
    const store = createCaptureStore();
    store.getState().initializeDraft({ thoughtId: "t1", title: "Old", body: "Old body" });
    store.getState().updateDraftBody("Unsaved");

    store.getState().markDraftSaveFailed({ thoughtId: "t1", error: "failed" });

    expect(store.getState().draft?.body).toBe("Unsaved");
    expect(store.getState().draft?.dirty).toBe(true);
    expect(store.getState().draft?.error).toBe("failed");
  });

  test("resetAfterCategoryDeleted returns to initial selection when current category is deleted", () => {
    const store = createCaptureStore({
      ...initialCaptureState,
      selectedCategoryId: "child",
      selectedThoughtId: "t1",
      activeSourceId: "s1",
      draft: {
        thoughtId: "t1",
        title: "A",
        body: "B",
        baseTitle: "A",
        baseBody: "B",
        dirty: false,
        saving: false,
        error: null,
        lastSavedAt: null,
      },
    });

    store.getState().resetAfterCategoryDeleted(new Set(["parent", "child"]));

    expect(store.getState().selectedCategoryId).toBe("all");
    expect(store.getState().selectedThoughtId).toBeNull();
    expect(store.getState().activeSourceId).toBeNull();
    expect(store.getState().draft).toBeNull();
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run:

```bash
cd <projectRoot>/apps/electron
rtk bun run test src/modules/capture/store.test.ts --run
```

Expected: FAIL because `./store` does not exist or exported members are missing.

- [ ] **Step 3: Implement store**

Implement `createCaptureStore`, `useCaptureStore`, `initialCaptureState`, and typed actions in `store.ts`. Use `zustand/vanilla`, `zustand`, and `zustand/middleware` `persist` with `partialize` so only `selectedCategoryId`, `includeDescendants`, and `expandedCategoryIds` persist.

- [ ] **Step 4: Verify store tests pass**

Run:

```bash
cd <projectRoot>/apps/electron
rtk bun run test src/modules/capture/store.test.ts --run
```

Expected: PASS.

## Task 3: Centralize Capture Queries and Mutations

**Files:**

- Create: `apps/electron/src/renderer/src/modules/capture/queries.ts`
- Modify: `apps/electron/src/renderer/src/modules/capture/category/hooks.ts`
- Modify: `apps/electron/src/renderer/src/modules/shared/hooks/use-category.ts`

- [ ] **Step 1: Create centralized query module**

Move category query, thought list query, thought detail query, and mutation invalidation helpers into `capture/queries.ts`. Expose:

```ts
useCaptureCategories();
useCaptureThoughtList(filter);
useCaptureThoughtDetail(thoughtId);
useCreateThoughtMutation();
useDeleteThoughtMutation();
useUpdateThoughtMutation();
useCreateContextMutation();
useUpdateContextMutation();
useDeleteContextMutation();
useCategoryMutations();
```

- [ ] **Step 2: Keep shared category hook compatible**

Change `useCategoryData` to delegate to `useCaptureCategories()` so existing non-refactored consumers keep working.

- [ ] **Step 3: Verify typecheck for query boundaries**

Run:

```bash
cd <projectRoot>/apps/electron
rtk bun run typecheck:web
```

Expected: PASS or only failures from not-yet-refactored imports that Task 4 will remove.

## Task 4: Refactor Capture Page, Category Tree, and Thought List

**Files:**

- Modify: `apps/electron/src/renderer/src/modules/capture/index.tsx`
- Modify: `apps/electron/src/renderer/src/modules/capture/category/hooks.ts`
- Modify: `apps/electron/src/renderer/src/modules/capture/category/components/CategoryTree.tsx`
- Modify: `apps/electron/src/renderer/src/modules/capture/thought-list/hooks.ts`
- Modify: `apps/electron/src/renderer/src/modules/capture/thought-list/index.tsx`
- Modify: `apps/electron/src/renderer/src/modules/capture/thought-list/ThoughtRow.tsx`

- [ ] **Step 1: Replace Jotai selectors with Zustand selectors**

Use `useCaptureStore((s) => s.fieldOrAction)` for each primitive/action needed by each component. Do not subscribe to the whole store.

- [ ] **Step 2: Remove list ordering workaround**

`useThoughtList` must return server-ordered `displayedThoughts` directly from `useCaptureThoughtList`. It must call `reconcileSelectedThought` after list data loads and must not auto-select the first row.

- [ ] **Step 3: Route create/delete actions through mutations**

`createEmptyUnderstanding` should call create thought mutation, invalidate list queries through mutation hooks, then `selectThought(created.id)`. `deleteThought` should call delete mutation and `resetAfterThoughtDeleted(id)`.

- [ ] **Step 4: Verify focused typecheck**

Run:

```bash
cd <projectRoot>/apps/electron
rtk bun run typecheck:web
```

Expected: remaining failures are limited to detail/autosave not yet migrated.

## Task 5: Implement Autosave With TDD

**Files:**

- Create: `apps/electron/src/renderer/src/modules/capture/useThoughtDraftAutosave.test.ts`
- Create: `apps/electron/src/renderer/src/modules/capture/useThoughtDraftAutosave.ts`

- [ ] **Step 1: Write failing autosave tests**

Use fake timers and a mock save function to assert debounce, latest snapshot, success marking, failure marking, and invalidation callback invocation.

- [ ] **Step 2: Verify autosave tests fail**

Run:

```bash
cd <projectRoot>/apps/electron
rtk bun run test src/modules/capture/useThoughtDraftAutosave.test.ts --run
```

Expected: FAIL because hook/helper does not exist.

- [ ] **Step 3: Implement autosave**

Export a testable `createDraftSaveQueue` helper and `useThoughtDraftAutosave` hook. The hook reads the draft from Zustand, waits 350ms, snapshots the current draft, marks save started, calls update mutation, marks success/failure, and invalidates through the mutation hook.

- [ ] **Step 4: Verify autosave tests pass**

Run:

```bash
cd <projectRoot>/apps/electron
rtk bun run test src/modules/capture/useThoughtDraftAutosave.test.ts --run
```

Expected: PASS.

## Task 6: Refactor Thought Detail

**Files:**

- Modify: `apps/electron/src/renderer/src/modules/capture/thought-detail/hooks.ts`
- Modify: `apps/electron/src/renderer/src/modules/capture/thought-detail/ThoughtDetail.tsx`

- [ ] **Step 1: Replace local title/body state with Zustand draft**

`ThoughtDetail` must initialize draft from saved detail query and bind title/body inputs to `draft.title` and `draft.body`.

- [ ] **Step 2: Replace updateThought direct calls**

Title/body changes update draft only. Category changes call update thought mutation directly because they are committed UI controls, not draft text. Context create/update/delete use centralized context mutations.

- [ ] **Step 3: Add save status UI**

Show a compact saving/error/saved status in the detail header. Keep wording short and non-intrusive.

- [ ] **Step 4: Verify focused tests and typecheck**

Run:

```bash
cd <projectRoot>/apps/electron
rtk bun run test src/modules/capture/store.test.ts src/modules/capture/useThoughtDraftAutosave.test.ts --run
rtk bun run typecheck:web
```

Expected: PASS.

## Task 7: Remove Old State and Workaround Tests

**Files:**

- Modify or delete: `apps/electron/src/renderer/src/modules/capture/state.ts`
- Delete: `apps/electron/src/renderer/src/modules/capture/thought-detail/hooks.test.ts`
- Delete: `apps/electron/src/renderer/src/modules/capture/thought-list/hooks.test.ts`

- [ ] **Step 1: Remove capture Jotai atoms**

Delete `state.ts` if it has no remaining imports. If an empty module is needed during migration, leave only a comment-free export-free file until imports are gone, then delete it.

- [ ] **Step 2: Delete tests for removed workarounds**

Remove the old sequential runner and stable order tests because their production code no longer exists.

- [ ] **Step 3: Search for forbidden old patterns**

Run:

```bash
cd <projectRoot>
rtk rg -n "selectedCategoryIdAtom|selectedThoughtIdAtom|thoughtListSearchQueryAtom|thoughtListIncludeDescendantsAtom|expandedCategoryKeysAtom|orderThoughtsForStableList|createSequentialLatestRunner|setQueriesData<ThoughtSummaryDTO|setQueryData<ThoughtDTO" apps/electron/src/renderer/src/modules/capture
```

Expected: no results.

## Task 8: Final Verification

**Files:** all changed files.

- [ ] **Step 1: Run focused tests**

```bash
cd <projectRoot>/apps/electron
rtk bun run test src/modules/capture/store.test.ts src/modules/capture/useThoughtDraftAutosave.test.ts --run
```

Expected: PASS.

- [ ] **Step 2: Run web typecheck**

```bash
cd <projectRoot>/apps/electron
rtk bun run typecheck:web
```

Expected: PASS.

- [ ] **Step 3: Inspect diff**

```bash
cd <projectRoot>
rtk git diff -- apps/electron/package.json bun.lock apps/electron/src/renderer/src/modules/capture docs/superpowers/plans/2026-06-15-capture-state-redesign.md
```

Expected: diff only contains capture state redesign, Zustand dependency, tests, and this plan.
