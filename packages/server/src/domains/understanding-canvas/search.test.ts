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
  tempDir = await mkdtemp(join(tmpdir(), "reflecta-canvas-search-"));
  db = await createDBInstance(join(tempDir, "test.db"), {
    appVersion: "2.0.0",
    runMigrations: true,
  });
  service = new UnderstandingCanvasElectronBff(db);
  canvasId = (await Effect.runPromise(service.createCanvas({ title: "灌溉调度" }))).id;
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("CanvasCore.searchCanvases (canvas_search 语义)", () => {
  test("matches canvas title (case-insensitive)", async () => {
    const hits = await Effect.runPromise(service.searchCanvases({ query: "灌溉" }));
    expect(hits.map((h) => h.canvas.id)).toEqual([canvasId]);
    expect(hits[0].reason).toContain("标题");
  });

  test("matches text card content", async () => {
    await Effect.runPromise(
      service.saveCanvas(canvasId, {
        elements: [element("t", { props: { text: "低温下先稳定主管压力" } })],
        edges: [],
      } as CanvasDocument),
    );
    const hits = await Effect.runPromise(service.searchCanvases({ query: "主管压力" }));
    expect(hits.map((h) => h.canvas.id)).toEqual([canvasId]);
    expect(hits[0].reason).toContain("文本卡");
  });

  test("matches edge labels", async () => {
    await Effect.runPromise(
      service.saveCanvas(canvasId, {
        elements: [element("a"), element("b")],
        edges: [
          {
            id: "x",
            canvasId,
            source: { cell: "a", port: "right" },
            target: { cell: "b", port: "left" },
            router: null,
            connector: { name: "smooth" },
            label: "依赖关系",
            attrs: {},
            createdAt: "2026-08-01T00:00:00.000Z",
          },
        ],
      } as CanvasDocument),
    );
    const hits = await Effect.runPromise(service.searchCanvases({ query: "依赖" }));
    expect(hits.map((h) => h.canvas.id)).toEqual([canvasId]);
    expect(hits[0].reason).toContain("连线标签");
  });

  test("matches group label", async () => {
    await Effect.runPromise(
      service.saveCanvas(canvasId, {
        elements: [element("g", { kind: "group", props: { label: "核心闭环" } })],
        edges: [],
      } as CanvasDocument),
    );
    const hits = await Effect.runPromise(service.searchCanvases({ query: "闭环" }));
    expect(hits.map((h) => h.canvas.id)).toEqual([canvasId]);
    expect(hits[0].reason).toContain("组");
  });

  test("matches referenced understanding title", async () => {
    const u = new UnderstandingCliBff(db);
    const understanding = await u.createUnderstanding({ title: "压力先稳原则", body: "x" });
    await Effect.runPromise(
      service.saveCanvas(canvasId, {
        elements: [element("c", { kind: "understanding", understandingId: understanding.id })],
        edges: [],
      } as CanvasDocument),
    );
    const hits = await Effect.runPromise(service.searchCanvases({ query: "压力先稳" }));
    expect(hits.map((h) => h.canvas.id)).toEqual([canvasId]);
    expect(hits[0].reason).toContain("引用理解");
  });

  test("multi-word OR semantics: any term matches", async () => {
    await Effect.runPromise(
      service.saveCanvas(canvasId, {
        elements: [element("t", { props: { text: "排水阀" } })],
        edges: [],
      } as CanvasDocument),
    );
    const hits = await Effect.runPromise(service.searchCanvases({ query: "不存在的词 排水阀" }));
    expect(hits.map((h) => h.canvas.id)).toEqual([canvasId]);
  });

  test("no match returns empty", async () => {
    const hits = await Effect.runPromise(service.searchCanvases({ query: "完全不存在的词" }));
    expect(hits).toEqual([]);
  });

  test("empty query returns empty", async () => {
    expect(await Effect.runPromise(service.searchCanvases({}))).toEqual([]);
    expect(await Effect.runPromise(service.searchCanvases({ query: "   " }))).toEqual([]);
  });

  test("understandingId reverse query returns canvas with reason", async () => {
    const u = new UnderstandingCliBff(db);
    const understanding = await u.createUnderstanding({ title: "逆查询理解", body: "x" });
    await Effect.runPromise(
      service.saveCanvas(canvasId, {
        elements: [element("c", { kind: "understanding", understandingId: understanding.id })],
        edges: [],
      } as CanvasDocument),
    );
    const hits = await Effect.runPromise(
      service.searchCanvases({ understandingId: understanding.id }),
    );
    expect(hits.map((h) => h.canvas.id)).toEqual([canvasId]);
    expect(hits[0].snippet).toContain("逆查询理解");
  });

  test("listCanvases filters by title keyword and limit", async () => {
    const other = (await Effect.runPromise(service.createCanvas({ title: "无关键词画布" }))).id;
    const all = await Effect.runPromise(service.listCanvases({ titleSearchKeyword: "灌溉" }));
    expect(all.map((c) => c.id)).toEqual([canvasId]);
    const limited = await Effect.runPromise(service.listCanvases({ limit: 1 }));
    expect(limited).toHaveLength(1);
    void other;
  });
});
