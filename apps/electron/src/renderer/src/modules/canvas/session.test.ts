import { describe, expect, test } from "vitest";
import type { CanvasDocument } from "@reflecta/ui/canvas";
import {
  EMPTY_CANVAS_DOCUMENT,
  initialCanvasSession,
  panelForSelection,
  reduceCanvasSession,
  sanitizeDocument,
  type CanvasAction,
  type CanvasSessionState,
} from "./session";

const time = "2026-08-19T00:00:00.000Z";

function textElement(id: string, extra: { x?: number } = {}): CanvasDocument["elements"][number] {
  return {
    id,
    canvasId: "canvas-1",
    parentId: null,
    x: extra.x ?? 0,
    y: 0,
    width: 200,
    height: 80,
    zIndex: 1,
    createdAt: time,
    updatedAt: time,
    kind: "text",
    understandingId: null,
    canvasRefId: null,
    props: { text: id },
  };
}

function apply(state: CanvasSessionState, action: CanvasAction) {
  return reduceCanvasSession(state, action);
}

describe("reduceCanvasSession", () => {
  test("session/opened resets prior document, selection, panel and search", () => {
    const dirty: CanvasSessionState = {
      ...initialCanvasSession,
      canvasId: "canvas-1",
      hydrated: true,
      document: { elements: [textElement("a")], edges: [] },
      selection: ["a"],
      panel: { mode: "library" },
      searchOpen: true,
      saveStatus: "dirty",
    };
    const { state, effects } = apply(dirty, { type: "session/opened", canvasId: "canvas-2" });
    expect(effects).toEqual([]);
    expect(state).toEqual({ ...initialCanvasSession, canvasId: "canvas-2" });
  });

  test("session/opened with the same id is a no-op", () => {
    const current = { ...initialCanvasSession, canvasId: "canvas-1", hydrated: true };
    const { state, effects } = apply(current, { type: "session/opened", canvasId: "canvas-1" });
    expect(state).toBe(current);
    expect(effects).toEqual([]);
  });

  test("session/closed resets state and flushes pending saves", () => {
    const open = { ...initialCanvasSession, canvasId: "canvas-1", hydrated: true };
    const { state, effects } = apply(open, { type: "session/closed" });
    expect(state).toEqual(initialCanvasSession);
    expect(effects).toEqual([{ type: "flushSaves" }]);
  });

  test("document/hydrated writes hydrate once and ignores later refetches", () => {
    const opened = { ...initialCanvasSession, canvasId: "canvas-1" };
    const document: CanvasDocument = { elements: [textElement("a")], edges: [] };
    const viewport = { x: 1, y: 2, zoom: 0.8 };
    const first = apply(opened, { type: "document/hydrated", document, viewport });
    expect(first.state.hydrated).toBe(true);
    expect(first.state.hydrate).toEqual({ document, viewport });
    expect(first.state.document).toBe(document);

    const live = { ...first.state, document: { elements: [textElement("b")], edges: [] } };
    const second = apply(live, {
      type: "document/hydrated",
      document: { elements: [textElement("stale")], edges: [] },
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    expect(second.state).toBe(live);
  });

  test("document/changed sanitizes duplicate ids and requests save", () => {
    const opened = { ...initialCanvasSession, canvasId: "canvas-1", hydrated: true };
    const duplicate: CanvasDocument = {
      elements: [textElement("a"), textElement("a", { x: 40 })],
      edges: [
        {
          id: "edge",
          canvasId: "canvas-1",
          sourceElementId: "a",
          targetElementId: "missing",
          label: null,
          style: null,
          createdAt: time,
        },
      ],
    };
    const { state, effects } = apply(opened, { type: "document/changed", document: duplicate });
    expect(state.document.elements).toHaveLength(1);
    expect(state.document.edges).toEqual([]);
    expect(state.saveStatus).toBe("dirty");
    expect(effects).toEqual([{ type: "saveDocument", document: state.document }]);
  });

  test("viewport/changed ignores identical values", () => {
    const viewport = { x: 1, y: 2, zoom: 1 };
    const current = { ...initialCanvasSession, viewport };
    const { state, effects } = apply(current, {
      type: "viewport/changed",
      viewport: { ...viewport },
    });
    expect(state).toBe(current);
    expect(effects).toEqual([]);
  });

  test("selection/changed keeps an open library and closes detail", () => {
    const document: CanvasDocument = { elements: [textElement("a")], edges: [] };
    const withLibrary = {
      ...initialCanvasSession,
      document,
      panel: { mode: "library" as const },
    };
    expect(apply(withLibrary, { type: "selection/changed", cellIds: ["a"] }).state.panel).toEqual({
      mode: "library",
    });

    const withDetail = {
      ...initialCanvasSession,
      document,
      panel: { mode: "detail" as const, understandingId: "u" },
    };
    expect(apply(withDetail, { type: "selection/changed", cellIds: ["a"] }).state.panel).toBeNull();
  });

  test("panel and search actions are idempotent", () => {
    const closed = initialCanvasSession;
    expect(apply(closed, { type: "panel/close" }).state).toBe(closed);
    expect(apply(closed, { type: "search/closed" }).state).toBe(closed);

    const library = apply(closed, { type: "panel/toggleLibrary" }).state;
    expect(library.panel).toEqual({ mode: "library" });
    expect(apply(library, { type: "panel/toggleLibrary" }).state.panel).toBeNull();

    const detail = apply(closed, { type: "panel/openDetail", understandingId: "u" }).state;
    expect(apply(detail, { type: "panel/openDetail", understandingId: "u" }).state).toBe(detail);
  });

  test("search/selected closes the overlay and focuses the cell", () => {
    const open = { ...initialCanvasSession, searchOpen: true };
    const { state, effects } = apply(open, { type: "search/selected", id: "a" });
    expect(state.searchOpen).toBe(false);
    expect(effects).toEqual([{ type: "focusCell", id: "a" }]);
  });

  test("save/status no-ops on the same value; save/retry only emits an effect", () => {
    const dirty = { ...initialCanvasSession, saveStatus: "dirty" as const };
    expect(apply(dirty, { type: "save/status", status: "dirty" }).state).toBe(dirty);
    expect(apply(dirty, { type: "save/retry" })).toEqual({
      state: dirty,
      effects: [{ type: "retrySave" }],
    });
  });
});

describe("sanitizeDocument", () => {
  test("returns the same reference when already unique", () => {
    const document: CanvasDocument = { elements: [textElement("a")], edges: [] };
    expect(sanitizeDocument(document)).toBe(document);
  });
});

describe("panelForSelection", () => {
  const document: CanvasDocument = { elements: [textElement("text")], edges: [] };

  test.each([
    ["empty", [], null],
    ["ordinary node", ["text"], null],
    ["multiple", ["text", "other"], null],
  ])("routes %s selection from a closed panel", (_name, selection, expected) => {
    expect(panelForSelection(selection as string[], document, null)).toEqual(expected);
  });

  test("keeps an explicitly opened library", () => {
    const library = { mode: "library" } as const;
    expect(panelForSelection(["text"], document, library)).toBe(library);
  });
});

describe("empty document constant", () => {
  test("matches the session initial document", () => {
    expect(initialCanvasSession.document).toEqual(EMPTY_CANVAS_DOCUMENT);
  });
});
