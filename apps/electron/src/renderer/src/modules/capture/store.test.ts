// @vitest-environment happy-dom

import { beforeEach, describe, expect, test } from "vitest";
import { createCaptureStore, initialCaptureState } from "./store";

describe("capture store", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear();
  });

  test("selectDomain clears selected understanding, active context, and draft", () => {
    const store = createCaptureStore();
    store.getState().selectUnderstanding("understanding-1");
    store.getState().setActiveContextId("context-1");
    store.getState().initializeDraft({ understandingId: "understanding-1", title: "A", body: "B" });

    store.getState().selectDomain("domain-1");

    expect(store.getState().selectedDomainId).toBe("domain-1");
    expect(store.getState().selectedUnderstandingId).toBeNull();
    expect(store.getState().activeContextId).toBeNull();
    expect(store.getState().draft).toBeNull();
  });

  test("selectUnderstanding clears active context without changing domain", () => {
    const store = createCaptureStore({
      ...initialCaptureState,
      selectedDomainId: "domain-1",
      activeContextId: "context-1",
    });

    store.getState().selectUnderstanding("understanding-1");

    expect(store.getState().selectedDomainId).toBe("domain-1");
    expect(store.getState().selectedUnderstandingId).toBe("understanding-1");
    expect(store.getState().activeContextId).toBeNull();
  });

  test("setIncludeDescendants updates includeDescendants", () => {
    const store = createCaptureStore();

    store.getState().setIncludeDescendants(false);

    expect(store.getState().includeDescendants).toBe(false);
  });

  test("setUnderstandingListSortBy updates understandingListSortBy", () => {
    const store = createCaptureStore();

    store.getState().setUnderstandingListSortBy("createdAt");

    expect(store.getState().understandingListSortBy).toBe("createdAt");
  });

  test("reconcileSelectedUnderstanding clears invisible selected understanding", () => {
    const store = createCaptureStore();
    store.getState().selectUnderstanding("missing");

    store.getState().reconcileSelectedUnderstanding(new Set(["visible"]));

    expect(store.getState().selectedUnderstandingId).toBeNull();
  });

  test("reconcileSelectedUnderstanding keeps visible selected understanding", () => {
    const store = createCaptureStore();
    store.getState().selectUnderstanding("visible");

    store.getState().reconcileSelectedUnderstanding(new Set(["visible"]));

    expect(store.getState().selectedUnderstandingId).toBe("visible");
  });

  test("reconcileExpandedDomains drops invalid expanded keys", () => {
    const store = createCaptureStore({
      ...initialCaptureState,
      expandedDomainIds: { keep: true, drop: true },
    });

    store.getState().reconcileExpandedDomains(new Set(["keep"]));

    expect(store.getState().expandedDomainIds).toEqual({ keep: true });
  });

  test("reconcileExpandedDomains is a no-op when expanded keys are already valid", () => {
    const store = createCaptureStore({
      ...initialCaptureState,
      expandedDomainIds: { keep: true },
    });
    const before = store.getState().expandedDomainIds;

    store.getState().reconcileExpandedDomains(new Set(["keep"]));

    expect(store.getState().expandedDomainIds).toBe(before);
  });

  test("expandDomainAncestors expands each provided domain id", () => {
    const store = createCaptureStore();

    store.getState().expandDomainAncestors(["root", "child"]);

    expect(store.getState().expandedDomainIds).toEqual({ root: true, child: true });
  });

  test("initializeDraft does not overwrite a dirty draft for the same understanding", () => {
    const store = createCaptureStore();
    store.getState().initializeDraft({ understandingId: "t1", title: "Saved", body: "Saved body" });
    store.getState().updateDraftBody("Local body");

    store
      .getState()
      .initializeDraft({ understandingId: "t1", title: "Server", body: "Server body" });

    expect(store.getState().draft?.body).toBe("Local body");
    expect(store.getState().draft?.dirty).toBe(true);
  });

  test("initializeDraft replaces draft when understanding id changes", () => {
    const store = createCaptureStore();
    store.getState().initializeDraft({ understandingId: "t1", title: "A", body: "B" });
    store.getState().updateDraftBody("Local body");

    store.getState().initializeDraft({ understandingId: "t2", title: "C", body: "D" });

    expect(store.getState().draft).toMatchObject({
      understandingId: "t2",
      title: "C",
      body: "D",
      dirty: false,
    });
  });

  test("markDraftSaveSucceeded updates base values and clears dirty flags", () => {
    const store = createCaptureStore();
    store.getState().initializeDraft({ understandingId: "t1", title: "Old", body: "Old body" });
    store.getState().updateDraftTitle("New");
    store.getState().markDraftSaveStarted("t1");

    store.getState().markDraftSaveSucceeded({
      understandingId: "t1",
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
      lastSavedAt: "2026-06-15T00:00:00.000Z",
    });
  });

  test("markDraftSaveSucceeded does not overwrite a newer dirty draft", () => {
    const store = createCaptureStore();
    store.getState().initializeDraft({ understandingId: "t1", title: "Old", body: "Old body" });
    store.getState().updateDraftBody("First local");
    store.getState().markDraftSaveStarted("t1");
    store.getState().updateDraftBody("Second local");

    store.getState().markDraftSaveSucceeded({
      understandingId: "t1",
      title: "Old",
      body: "First local",
      savedAt: "2026-06-15T00:00:00.000Z",
    });

    expect(store.getState().draft).toMatchObject({
      body: "Second local",
      baseBody: "First local",
      dirty: true,
      saving: false,
    });
  });

  test("updateDraftBody ignores trailing newline-only changes for dirty state", () => {
    const store = createCaptureStore();
    store.getState().initializeDraft({ understandingId: "t1", title: "A", body: "Saved body" });
    store.getState().updateDraftBody("Saved body\n");

    expect(store.getState().draft?.body).toBe("Saved body\n");
    expect(store.getState().draft?.dirty).toBe(false);
  });

  test("markDraftSaveFailed keeps draft content", () => {
    const store = createCaptureStore();
    store.getState().initializeDraft({ understandingId: "t1", title: "Old", body: "Old body" });
    store.getState().updateDraftBody("Unsaved");

    store.getState().markDraftSaveFailed({ understandingId: "t1", error: "failed" });

    expect(store.getState().draft?.body).toBe("Unsaved");
    expect(store.getState().draft?.dirty).toBe(true);
    expect(store.getState().draft?.error).toBe("failed");
  });

  test("resetAfterUnderstandingDeleted clears state for current understanding", () => {
    const store = createCaptureStore();
    store.getState().selectUnderstanding("t1");
    store.getState().setActiveContextId("s1");
    store.getState().initializeDraft({ understandingId: "t1", title: "A", body: "B" });

    store.getState().resetAfterUnderstandingDeleted("t1");

    expect(store.getState().selectedUnderstandingId).toBeNull();
    expect(store.getState().activeContextId).toBeNull();
    expect(store.getState().draft).toBeNull();
  });

  test("resetAfterDomainDeleted returns to all when current domain is deleted", () => {
    const store = createCaptureStore({
      ...initialCaptureState,
      selectedDomainId: "child",
      selectedUnderstandingId: "t1",
      activeContextId: "s1",
      draft: {
        understandingId: "t1",
        title: "A",
        body: "B",
        baseTitle: "A",
        baseBody: "B",
        dirty: false,
        saving: false,
        error: null,
        lastSavedAt: null,
        saveRequestedAt: null,
      },
    });

    store.getState().resetAfterDomainDeleted(new Set(["parent", "child"]));

    expect(store.getState().selectedDomainId).toBe("all");
    expect(store.getState().selectedUnderstandingId).toBeNull();
    expect(store.getState().activeContextId).toBeNull();
    expect(store.getState().draft).toBeNull();
  });
});
