import { describe, expect, test } from "vitest";
import type { CanvasDocument, CanvasElementDTO } from "@reflecta/ui/canvas";
import { buildCanvasSearchIndex } from "./canvas-workspace-model";

const time = "2026-08-19T00:00:00.000Z";
const base = {
  canvasId: "canvas",
  parentId: null,
  x: 0,
  y: 0,
  width: 200,
  height: 100,
  zIndex: 0,
  createdAt: time,
  updatedAt: time,
};
const elements: CanvasElementDTO[] = [
  {
    ...base,
    id: "text",
    kind: "text",
    understandingId: null,
    canvasRefId: null,
    props: { text: "TEXT_BODY" },
  },
  {
    ...base,
    id: "understanding",
    kind: "understanding",
    understandingId: "u",
    canvasRefId: null,
    props: {},
  },
  {
    ...base,
    id: "group",
    kind: "group",
    understandingId: null,
    canvasRefId: null,
    props: { label: "GROUP_LABEL" },
  },
  {
    ...base,
    id: "reference",
    kind: "canvas_ref",
    understandingId: null,
    canvasRefId: "c",
    props: {},
  },
];
const document: CanvasDocument = {
  elements,
  edges: [
    {
      id: "edge",
      canvasId: "canvas",
      sourceElementId: "text",
      targetElementId: "understanding",
      label: "EDGE_LABEL",
      style: null,
      createdAt: time,
    },
  ],
};

describe("canvas workspace model", () => {
  test("indexes every searchable whiteboard content source", () => {
    expect(
      buildCanvasSearchIndex(
        document,
        new Map([["u", { title: "UNDERSTANDING_TITLE", body: "UNDERSTANDING_BODY" }]]),
        new Map([["c", { title: "CANVAS_TITLE" }]]),
      ),
    ).toEqual([
      { id: "text", kind: "text", text: "TEXT_BODY" },
      {
        id: "understanding",
        kind: "understanding",
        text: "UNDERSTANDING_TITLE\nUNDERSTANDING_BODY",
      },
      { id: "group", kind: "group", text: "GROUP_LABEL" },
      { id: "reference", kind: "canvas_ref", text: "CANVAS_TITLE" },
      { id: "edge", kind: "edge", text: "EDGE_LABEL" },
    ]);
  });
});
