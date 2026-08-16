import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createDBInstance, type ReflectaDb } from "../../db";
import { CanvasCore, canvasRowToDTO } from "./core";
import type { CanvasDocument, CanvasElementDTO } from "./types";

let tempDir: string;
let db: ReflectaDb;
let canvasId: string;

function element(id: string, partial: Partial<CanvasElementDTO> = {}): CanvasElementDTO {
  const kind = partial.kind ?? "text";
  const base = {
    id,
    canvasId,
    parentId: null as string | null,
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    zIndex: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
  switch (kind) {
    case "understanding":
      return {
        ...base,
        kind,
        understandingId: partial.understandingId ?? "u-1",
        canvasRefId: null,
        props: {},
        ...partial,
      } as CanvasElementDTO;
    case "text":
      return {
        ...base,
        kind,
        understandingId: null,
        canvasRefId: null,
        props: { text: "" },
        ...partial,
      } as CanvasElementDTO;
    case "shape":
      return {
        ...base,
        kind,
        understandingId: null,
        canvasRefId: null,
        props: { shapeType: "rect" },
        ...partial,
      } as CanvasElementDTO;
    case "group":
      return {
        ...base,
        kind,
        understandingId: null,
        canvasRefId: null,
        props: { label: "" },
        ...partial,
      } as CanvasElementDTO;
    case "canvas_ref":
      return {
        ...base,
        kind,
        understandingId: null,
        canvasRefId: partial.canvasRefId ?? "canvas-target",
        props: {},
        ...partial,
      } as CanvasElementDTO;
  }
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "reflecta-canvas-reconcile-"));
  db = await createDBInstance(join(tempDir, "test.db"), {
    appVersion: "2.0.0",
    runMigrations: true,
  });
  const core = new CanvasCore(db);
  const canvas = await core.createCanvas({ title: "测试画布" });
  canvasId = canvas.id;
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const readRows = async () => {
  const elements = db.$client
    .prepare("SELECT * FROM understanding_canvas_elements WHERE canvas_id = ?")
    .all(canvasId) as Array<Record<string, unknown>>;
  const edges = db.$client
    .prepare("SELECT * FROM understanding_canvas_edges WHERE canvas_id = ?")
    .all(canvasId) as Array<Record<string, unknown>>;
  return { elements, edges };
};

describe("CanvasCore.saveCanvas reconciliation", () => {
  test("inserts new elements and edges", async () => {
    const core = new CanvasCore(db);
    const doc: CanvasDocument = {
      elements: [element("e1"), element("e2")],
      edges: [
        {
          id: "x",
          canvasId,
          sourceElementId: "e1",
          targetElementId: "e2",
          label: "依赖",
          style: null,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    };
    await core.saveCanvas(canvasId, doc);
    const { elements, edges } = await readRows();
    expect(elements).toHaveLength(2);
    expect(edges).toHaveLength(1);
  });

  test("second save with identical document is a zero-write (idempotent, updated_at unchanged)", async () => {
    const core = new CanvasCore(db);
    const doc: CanvasDocument = {
      elements: [element("e1", { x: 10 }), element("e2")],
      edges: [
        {
          id: "x",
          canvasId,
          sourceElementId: "e1",
          targetElementId: "e2",
          label: null,
          style: { color: "#ff0000" },
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    };
    await core.saveCanvas(canvasId, doc);
    const before = (await core.getCanvas(canvasId))!.updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));
    await core.saveCanvas(canvasId, doc);
    const after = (await core.getCanvas(canvasId))!.updatedAt;
    expect(after).toBe(before);
  });

  test("updates changed element fields and keeps createdAt", async () => {
    const core = new CanvasCore(db);
    await core.saveCanvas(canvasId, { elements: [element("e1", { x: 1 })], edges: [] });
    const originalCreatedAt = (await readRows()).elements[0].created_at;
    await core.saveCanvas(canvasId, {
      elements: [element("e1", { x: 99, props: { text: "改" } })],
      edges: [],
    });
    const rows = await readRows();
    expect(rows.elements).toHaveLength(1);
    expect(rows.elements[0].x).toBe(99);
    expect(rows.elements[0].created_at).toBe(originalCreatedAt);
    const updated = (await core.getCanvas(canvasId))!;
    expect(updated.updatedAt).not.toBeNull();
  });

  test("deletes elements and edges missing from the document", async () => {
    const core = new CanvasCore(db);
    await core.saveCanvas(canvasId, {
      elements: [element("e1"), element("e2"), element("e3")],
      edges: [
        {
          id: "x1",
          canvasId,
          sourceElementId: "e1",
          targetElementId: "e2",
          label: null,
          style: null,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    });
    await core.saveCanvas(canvasId, {
      elements: [element("e1", { x: 5 })],
      edges: [],
    });
    const { elements, edges } = await readRows();
    expect(elements.map((row) => row.id)).toEqual(["e1"]);
    expect(elements[0].x).toBe(5);
    expect(edges).toHaveLength(0);
  });

  test("empty document clears the canvas (legal)", async () => {
    const core = new CanvasCore(db);
    await core.saveCanvas(canvasId, { elements: [element("e1")], edges: [] });
    await core.saveCanvas(canvasId, { elements: [], edges: [] });
    const { elements, edges } = await readRows();
    expect(elements).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  test("updates touch canvas.updated_at (list ordering signal)", async () => {
    const core = new CanvasCore(db);
    const before = (await core.getCanvas(canvasId))!.updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));
    await core.saveCanvas(canvasId, { elements: [element("e1")], edges: [] });
    const after = (await core.getCanvas(canvasId))!.updatedAt;
    expect(after > before).toBe(true);
  });

  test("throws when canvas does not exist", async () => {
    const core = new CanvasCore(db);
    await expect(core.saveCanvas("missing", { elements: [], edges: [] })).rejects.toThrow(
      /Canvas not found/,
    );
  });

  test("rejects invalid document and rolls back atomically", async () => {
    const core = new CanvasCore(db);
    const good = { elements: [element("e1")], edges: [] };
    await core.saveCanvas(canvasId, good);
    // 非法文档：自环
    const bad: CanvasDocument = {
      elements: [element("e1"), element("e2")],
      edges: [
        {
          id: "x",
          canvasId,
          sourceElementId: "e1",
          targetElementId: "e1",
          label: null,
          style: null,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    };
    await expect(core.saveCanvas(canvasId, bad)).rejects.toThrow(/self-loop/);
    const { elements } = await readRows();
    expect(elements).toHaveLength(1);
    expect(elements[0].id).toBe("e1");
  });

  test("rejects unknown understanding references", async () => {
    const core = new CanvasCore(db);
    const doc: CanvasDocument = {
      elements: [element("e1", { kind: "understanding", understandingId: "does-not-exist" })],
      edges: [],
    };
    await expect(core.saveCanvas(canvasId, doc)).rejects.toThrow(/Understanding not found/);
  });

  test("deleteCanvas hard-deletes canvas and cascades children", async () => {
    const core = new CanvasCore(db);
    await core.saveCanvas(canvasId, {
      elements: [element("e1"), element("e2")],
      edges: [
        {
          id: "x",
          canvasId,
          sourceElementId: "e1",
          targetElementId: "e2",
          label: null,
          style: null,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    });
    await core.deleteCanvas(canvasId);
    expect(await core.getCanvas(canvasId)).toBeNull();
    const { elements, edges } = await readRows();
    expect(elements).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  test("canvasRowToDTO round-trips viewport JSON", async () => {
    const core = new CanvasCore(db);
    await core.updateViewport(canvasId, { x: 1, y: 2, zoom: 0.8 });
    const canvas = await core.getCanvas(canvasId);
    expect(canvas?.viewport).toEqual({ x: 1, y: 2, zoom: 0.8 });
    expect(typeof canvasRowToDTO).toBe("function");
  });
});
