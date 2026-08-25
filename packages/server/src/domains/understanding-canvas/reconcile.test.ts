import { Effect } from "effect";
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
  const canvas = await Effect.runPromise(core.createCanvas({ title: "测试画布" }));
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
  test("creates a canvas and its initial document together", async () => {
    const core = new CanvasCore(db);
    const created = await Effect.runPromise(
      core.createCanvasWithDocument(
        { title: "Agent canvas" },
        { elements: [element("agent-node")], edges: [] },
      ),
    );

    const detail = await Effect.runPromise(core.getCanvasDetail(created.id));
    expect(detail?.canvas.title).toBe("Agent canvas");
    expect(detail?.elements.map(({ id }) => id)).toEqual(["agent-node"]);
  });

  test("rolls back canvas creation when its initial document cannot be inserted", async () => {
    const core = new CanvasCore(db);
    const before = db.$client
      .prepare("SELECT COUNT(*) AS count FROM understanding_canvases")
      .get() as {
      count: number;
    };

    await expect(
      Effect.runPromise(
        core.createCanvasWithDocument(
          { title: "Broken canvas" },
          {
            elements: [
              element("missing-canvas-ref", {
                kind: "canvas_ref",
                canvasRefId: "does-not-exist",
              }),
            ],
            edges: [],
          },
        ),
      ),
    ).rejects.toThrow();

    const after = db.$client
      .prepare("SELECT COUNT(*) AS count FROM understanding_canvases")
      .get() as {
      count: number;
    };
    expect(after.count).toBe(before.count);
  });

  test("updates title with the document in one save", async () => {
    const core = new CanvasCore(db);
    await Effect.runPromise(core.saveCanvas(canvasId, { elements: [], edges: [] }, "Renamed"));
    await expect(Effect.runPromise(core.getCanvas(canvasId))).resolves.toMatchObject({
      title: "Renamed",
    });
  });

  test("inserts new elements and edges", async () => {
    const core = new CanvasCore(db);
    const doc: CanvasDocument = {
      elements: [element("e1"), element("e2")],
      edges: [
        {
          id: "x",
          canvasId,
          source: { cell: "e1", port: "bottom" },
          target: { cell: "e2", port: "top" },
          router: { name: "manhattan", args: { startDirections: ["bottom"] } },
          connector: { name: "rounded", args: { radius: 8 } },
          label: "依赖",
          attrs: {},
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    };
    await Effect.runPromise(core.saveCanvas(canvasId, doc));
    const { elements, edges } = await readRows();
    expect(elements).toHaveLength(2);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      source_port_id: "bottom",
      target_port_id: "top",
      router: '{"name":"manhattan","args":{"startDirections":["bottom"]}}',
      connector: '{"name":"rounded","args":{"radius":8}}',
    });
    expect((await Effect.runPromise(core.getCanvasDetail(canvasId)))?.edges[0]).toMatchObject({
      source: { cell: "e1", port: "bottom" },
      target: { cell: "e2", port: "top" },
      router: { name: "manhattan", args: { startDirections: ["bottom"] } },
      connector: { name: "rounded", args: { radius: 8 } },
    });
  });

  test("second save with identical document is a zero-write (idempotent, updated_at unchanged)", async () => {
    const core = new CanvasCore(db);
    const doc: CanvasDocument = {
      elements: [element("e1", { x: 10 }), element("e2")],
      edges: [
        {
          id: "x",
          canvasId,
          source: { cell: "e1", port: "right" },
          target: { cell: "e2", port: "left" },
          router: null,
          connector: { name: "smooth" },
          label: null,
          attrs: { line: { stroke: "#ff0000" } },
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    };
    await Effect.runPromise(core.saveCanvas(canvasId, doc));
    const before = (await Effect.runPromise(core.getCanvas(canvasId)))!.updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));
    await Effect.runPromise(core.saveCanvas(canvasId, doc));
    const after = (await Effect.runPromise(core.getCanvas(canvasId)))!.updatedAt;
    expect(after).toBe(before);
  });

  test("updates changed element fields and keeps createdAt", async () => {
    const core = new CanvasCore(db);
    await Effect.runPromise(
      core.saveCanvas(canvasId, { elements: [element("e1", { x: 1 })], edges: [] }),
    );
    const originalCreatedAt = (await readRows()).elements[0].created_at;
    await Effect.runPromise(
      core.saveCanvas(canvasId, {
        elements: [element("e1", { x: 99, props: { text: "改" } })],
        edges: [],
      }),
    );
    const rows = await readRows();
    expect(rows.elements).toHaveLength(1);
    expect(rows.elements[0].x).toBe(99);
    expect(rows.elements[0].created_at).toBe(originalCreatedAt);
    const updated = (await Effect.runPromise(core.getCanvas(canvasId)))!;
    expect(updated.updatedAt).not.toBeNull();
  });

  test("viewport-only save does not bump updatedAt", async () => {
    const core = new CanvasCore(db);
    await Effect.runPromise(core.saveCanvas(canvasId, { elements: [element("e1")], edges: [] }));
    const before = (await Effect.runPromise(core.getCanvas(canvasId)))!.updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));
    await Effect.runPromise(core.updateViewport(canvasId, { x: 10, y: 20, zoom: 1.5 }));
    const after = (await Effect.runPromise(core.getCanvas(canvasId)))!;
    expect(after.updatedAt).toBe(before);
    expect(after.viewport).toEqual({ x: 10, y: 20, zoom: 1.5 });
  });

  test("deletes elements and edges missing from the document", async () => {
    const core = new CanvasCore(db);
    await Effect.runPromise(
      core.saveCanvas(canvasId, {
        elements: [element("e1"), element("e2"), element("e3")],
        edges: [
          {
            id: "x1",
            canvasId,
            source: { cell: "e1", port: "right" },
            target: { cell: "e2", port: "left" },
            router: null,
            connector: { name: "smooth" },
            label: null,
            attrs: {},
            createdAt: "2026-08-01T00:00:00.000Z",
          },
        ],
      }),
    );
    await Effect.runPromise(
      core.saveCanvas(canvasId, {
        elements: [element("e1", { x: 5 })],
        edges: [],
      }),
    );
    const { elements, edges } = await readRows();
    expect(elements.map((row) => row.id)).toEqual(["e1"]);
    expect(elements[0].x).toBe(5);
    expect(edges).toHaveLength(0);
  });

  test("empty document clears the canvas (legal)", async () => {
    const core = new CanvasCore(db);
    await Effect.runPromise(core.saveCanvas(canvasId, { elements: [element("e1")], edges: [] }));
    await Effect.runPromise(core.saveCanvas(canvasId, { elements: [], edges: [] }));
    const { elements, edges } = await readRows();
    expect(elements).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  test("updates touch canvas.updated_at (list ordering signal)", async () => {
    const core = new CanvasCore(db);
    const before = (await Effect.runPromise(core.getCanvas(canvasId)))!.updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));
    await Effect.runPromise(core.saveCanvas(canvasId, { elements: [element("e1")], edges: [] }));
    const after = (await Effect.runPromise(core.getCanvas(canvasId)))!.updatedAt;
    expect(after > before).toBe(true);
  });

  test("throws when canvas does not exist", async () => {
    const core = new CanvasCore(db);
    await expect(
      Effect.runPromise(core.saveCanvas("missing", { elements: [], edges: [] })),
    ).rejects.toThrow(/Canvas not found/);
  });

  test("rejects invalid document and rolls back atomically", async () => {
    const core = new CanvasCore(db);
    const good = { elements: [element("e1")], edges: [] };
    await Effect.runPromise(core.saveCanvas(canvasId, good));
    // 非法文档：边引用不存在的元素
    const bad: CanvasDocument = {
      elements: [element("e1"), element("e2")],
      edges: [
        {
          id: "x",
          canvasId,
          source: { cell: "e1", port: "right" },
          target: { cell: "missing", port: "left" },
          router: null,
          connector: { name: "smooth" },
          label: null,
          attrs: {},
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    };
    await expect(Effect.runPromise(core.saveCanvas(canvasId, bad))).rejects.toThrow(
      /target element not in document/,
    );
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
    await expect(Effect.runPromise(core.saveCanvas(canvasId, doc))).rejects.toThrow(
      /Understanding not found/,
    );
  });

  test("deleteCanvas soft-deletes to trash (elements kept), permanentlyDeleteCanvas cascades children", async () => {
    const core = new CanvasCore(db);
    await Effect.runPromise(
      core.saveCanvas(canvasId, {
        elements: [element("e1"), element("e2")],
        edges: [
          {
            id: "x",
            canvasId,
            source: { cell: "e1", port: "right" },
            target: { cell: "e2", port: "left" },
            router: null,
            connector: { name: "smooth" },
            label: null,
            attrs: {},
            createdAt: "2026-08-01T00:00:00.000Z",
          },
        ],
      }),
    );

    // 软删除：画布从列表 / 详情消失，但元素与连线保留（回收站可恢复）
    await Effect.runPromise(core.deleteCanvas(canvasId));
    expect(await Effect.runPromise(core.getCanvas(canvasId))).toBeNull();
    expect(await Effect.runPromise(core.listCanvases())).toHaveLength(0);
    const trashed = await Effect.runPromise(core.listTrashedCanvases());
    expect(trashed.map((c) => c.id)).toEqual([canvasId]);
    let { elements, edges } = await readRows();
    expect(elements).toHaveLength(2);
    expect(edges).toHaveLength(1);

    // 恢复：画布重新可见，元素与连线原样保留
    await Effect.runPromise(core.restoreCanvas(canvasId));
    expect(await Effect.runPromise(core.getCanvas(canvasId))).not.toBeNull();
    expect(await Effect.runPromise(core.listTrashedCanvases())).toHaveLength(0);
    ({ elements, edges } = await readRows());
    expect(elements).toHaveLength(2);
    expect(edges).toHaveLength(1);

    // 永久删除：FK 级联清掉元素与连线
    await Effect.runPromise(core.permanentlyDeleteCanvas(canvasId));
    expect(await Effect.runPromise(core.getCanvas(canvasId))).toBeNull();
    ({ elements, edges } = await readRows());
    expect(elements).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  test("canvasRowToDTO round-trips viewport JSON", async () => {
    const core = new CanvasCore(db);
    await Effect.runPromise(core.updateViewport(canvasId, { x: 1, y: 2, zoom: 0.8 }));
    const canvas = await Effect.runPromise(core.getCanvas(canvasId));
    expect(canvas?.viewport).toEqual({ x: 1, y: 2, zoom: 0.8 });
    expect(typeof canvasRowToDTO).toBe("function");
  });
});
