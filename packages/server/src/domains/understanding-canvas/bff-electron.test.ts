import { Effect } from "effect";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createDBInstance, type ReflectaDb } from "../../db";
import { UnderstandingCanvasElectronBff } from "./bff-electron";
import { UnderstandingCliBff } from "../understanding/bff-cli";
import type { CanvasDocument, CanvasElementDTO } from "./types";

let tempDir: string;
let db: ReflectaDb;
let service: UnderstandingCanvasElectronBff;
let canvasId: string;

function element(
  id: string,
  kind: CanvasElementDTO["kind"] = "text",
  extra: Partial<CanvasElementDTO> = {},
): CanvasElementDTO {
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
        understandingId: "u-1",
        canvasRefId: null,
        props: {},
        ...extra,
      } as CanvasElementDTO;
    case "text":
      return {
        ...base,
        kind,
        understandingId: null,
        canvasRefId: null,
        props: { text: "" },
        ...extra,
      } as CanvasElementDTO;
    case "group":
      return {
        ...base,
        kind,
        understandingId: null,
        canvasRefId: null,
        props: { label: "" },
        ...extra,
      } as CanvasElementDTO;
    case "canvas_ref":
      return {
        ...base,
        kind,
        understandingId: null,
        canvasRefId: "canvas-target",
        props: {},
        ...extra,
      } as CanvasElementDTO;
  }
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "reflecta-canvas-bff-"));
  db = await createDBInstance(join(tempDir, "test.db"), {
    appVersion: "2.0.0",
    runMigrations: true,
  });
  service = new UnderstandingCanvasElectronBff(db);
  canvasId = (await Effect.runPromise(service.createCanvas({ title: "主画布" }))).id;
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("UnderstandingCanvasElectronBff.getCanvasDetail", () => {
  test("assembles elements, edges, refs and referenced canvases", async () => {
    const targetId = (await Effect.runPromise(service.createCanvas({ title: "被引用画布" }))).id;
    const u = new UnderstandingCliBff(db);
    const understanding = await u.createUnderstanding({ title: "分区灌溉", body: "水压先稳" });

    const doc: CanvasDocument = {
      elements: [
        element("u-card", "understanding", { understandingId: understanding.id }),
        element("note", "text", { props: { text: "备注" } }),
        element("text", "text", { props: { text: "note" } }),
        element("group", "group", { props: { label: "核心" }, parentId: null }),
        element("ref", "canvas_ref", { canvasRefId: targetId }),
        element("child", "text", { parentId: "group", props: { text: "组内" } }),
      ],
      edges: [
        {
          id: "edge-1",
          canvasId,
          sourceElementId: "u-card",
          targetElementId: "note",
          label: "依赖",
          style: { color: "#ff0000" },
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    };
    await Effect.runPromise(service.saveCanvas(canvasId, doc));

    const detail = await Effect.runPromise(service.getCanvasDetail(canvasId));
    expect(detail).not.toBeNull();
    expect(detail!.canvas.title).toBe("主画布");
    expect(detail!.elements).toHaveLength(6);
    expect(detail!.edges).toHaveLength(1);
    expect(detail!.edges[0].style).toEqual({ color: "#ff0000" });
    expect(detail!.understandingRefs).toEqual([
      expect.objectContaining({ id: understanding.id, title: "分区灌溉", deleted: false }),
    ]);
    expect(detail!.referencedCanvases).toEqual([
      expect.objectContaining({ id: targetId, title: "被引用画布", deleted: false }),
    ]);
    // 判别联合：kind 收窄
    const uCard = detail!.elements.find((e) => e.id === "u-card")!;
    expect(uCard.kind).toBe("understanding");
    expect(uCard.understandingId).toBe(understanding.id);
    const textEl = detail!.elements.find((e) => e.id === "note")!;
    expect(textEl.kind).toBe("text");
    if (textEl.kind !== "text") throw new Error("unreachable");
    expect(textEl.props.text).toBe("备注");
    const child = detail!.elements.find((e) => e.id === "child")!;
    expect(child.parentId).toBe("group");
  });

  test("marks soft-deleted understandings as deleted in refs", async () => {
    const u = new UnderstandingCliBff(db);
    const understanding = await u.createUnderstanding({ title: "将被删", body: "x" });
    await Effect.runPromise(
      service.saveCanvas(canvasId, {
        elements: [element("u-card", "understanding", { understandingId: understanding.id })],
        edges: [],
      }),
    );

    await Effect.runPromise(u.deleteUnderstanding(understanding.id));

    const detail = await Effect.runPromise(service.getCanvasDetail(canvasId));
    expect(detail!.understandingRefs[0].deleted).toBe(true);
  });

  test("listCanvasesByUnderstanding returns canvases referencing the understanding", async () => {
    const u = new UnderstandingCliBff(db);
    const understanding = await u.createUnderstanding({ title: "常用理解", body: "x" });
    const otherCanvas = (await Effect.runPromise(service.createCanvas({ title: "另一画布" }))).id;

    await Effect.runPromise(
      service.saveCanvas(canvasId, {
        elements: [element("u-card", "understanding", { understandingId: understanding.id })],
        edges: [],
      }),
    );
    // 另一画布不引用该理解
    await Effect.runPromise(
      service.saveCanvas(otherCanvas, {
        elements: [element("t", "text", { props: { text: "x" } })],
        edges: [],
      }),
    );

    const canvases = await Effect.runPromise(service.listCanvasesByUnderstanding(understanding.id));
    expect(canvases.map((c) => c.id)).toEqual([canvasId]);
  });

  test("listCanvases orders by updated_at desc", async () => {
    const a = (await Effect.runPromise(service.createCanvas({ title: "A" }))).id;
    const b = (await Effect.runPromise(service.createCanvas({ title: "B" }))).id;
    await Effect.runPromise(service.saveCanvas(a, { elements: [element("e1")], edges: [] }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    await Effect.runPromise(service.saveCanvas(b, { elements: [element("e2")], edges: [] }));
    const canvases = await Effect.runPromise(service.listCanvases());
    expect(canvases.map((c) => c.id)).toEqual([b, a, canvasId]);
  });

  test("updateCanvas renames and getCanvasDetail reflects it", async () => {
    await Effect.runPromise(service.updateCanvas(canvasId, { title: "新名字" }));
    const detail = await Effect.runPromise(service.getCanvasDetail(canvasId));
    expect(detail!.canvas.title).toBe("新名字");
  });

  test("TBD-2: understanding detail reports referencedByCanvases", async () => {
    const u = new UnderstandingCliBff(db);
    const understanding = await u.createUnderstanding({ title: "被引用的理解", body: "x" });
    await Effect.runPromise(
      service.saveCanvas(canvasId, {
        elements: [element("u-card", "understanding", { understandingId: understanding.id })],
        edges: [],
      }),
    );

    const detail = await u.getUnderstanding(understanding.id);
    expect(detail.referencedByCanvases).toEqual([
      expect.objectContaining({ id: canvasId, title: "主画布" }),
    ]);

    // 未被任何画布引用的理解返回空数组
    const orphan = await u.createUnderstanding({ title: "孤立理解", body: "y" });
    const orphanDetail = await u.getUnderstanding(orphan.id);
    expect(orphanDetail.referencedByCanvases).toEqual([]);
  });
});
