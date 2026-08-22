// @vitest-environment happy-dom

import { beforeEach, describe, expect, test } from "vitest";
import {
  canvasIsEmptyAtom,
  canvasLibraryOpenAtom,
  dispatchCanvasAction,
  getCanvasSessionState,
  selectedCanvasIdAtom,
} from "./store";
import { runAtom } from "@renderer/lib/atoms";
import { Atom } from "effect/unstable/reactivity";

describe("dispatchCanvasAction", () => {
  beforeEach(() => {
    dispatchCanvasAction({ type: "session/closed" });
  });

  test("session/opened projects canvas id without marking the canvas empty before hydrate", () => {
    dispatchCanvasAction({ type: "session/opened", canvasId: "canvas-1" });
    expect(getCanvasSessionState().canvasId).toBe("canvas-1");
    expect(runAtom(Atom.get(selectedCanvasIdAtom))).toBe("canvas-1");
    expect(runAtom(Atom.get(canvasIsEmptyAtom))).toBe(false);
  });

  test("hydrate then document/changed only flips the empty boolean once content appears", () => {
    dispatchCanvasAction({ type: "session/opened", canvasId: "canvas-1" });
    dispatchCanvasAction({
      type: "document/hydrated",
      document: { elements: [], edges: [] },
      viewport: null,
    });
    expect(runAtom(Atom.get(canvasIsEmptyAtom))).toBe(true);

    dispatchCanvasAction({
      type: "document/changed",
      document: {
        elements: [
          {
            id: "text",
            canvasId: "canvas-1",
            parentId: null,
            x: 0,
            y: 0,
            width: 100,
            height: 80,
            zIndex: 1,
            createdAt: "2026-08-19T00:00:00.000Z",
            updatedAt: "2026-08-19T00:00:00.000Z",
            kind: "text",
            understandingId: null,
            canvasRefId: null,
            props: { text: "note" },
          },
        ],
        edges: [],
      },
    });
    expect(runAtom(Atom.get(canvasIsEmptyAtom))).toBe(false);
  });

  test("panel/toggleLibrary is independently readable from the document slice", () => {
    dispatchCanvasAction({ type: "panel/toggleLibrary" });
    expect(runAtom(Atom.get(canvasLibraryOpenAtom))).toBe(true);
    dispatchCanvasAction({ type: "panel/toggleLibrary" });
    expect(runAtom(Atom.get(canvasLibraryOpenAtom))).toBe(false);
  });
});
