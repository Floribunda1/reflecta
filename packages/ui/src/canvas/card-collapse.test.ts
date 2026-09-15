// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CanvasDocument, CanvasElementDTO } from "@reflecta/shared";
import {
  CANVAS_CARD_COLLAPSE,
  COLLAPSED_CARD_HEIGHT_FALLBACK,
  PRESENT_CARD_COLLAPSE,
  planCollapseSizes,
  planPushDown,
  readCardExpanded,
  resolveCardCollapse,
  withExpandedHeights,
  writeCardExpanded,
} from "./card-collapse";

/** 测试环境（vitest + happy-dom）不提供 localStorage，用假实现验证键名与落盘路径。 */
const fakeStore = vi.hoisted(() => new Map<string, string>());
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => fakeStore.get(key) ?? null,
    setItem: (key: string, value: string) => void fakeStore.set(key, value),
  },
});

/** 记忆有内存缓存，跨用例必须用互不相同的卡片 / 入口键。 */
let seq = 0;
const uniqueId = () => `u-${(seq += 1)}`;

beforeEach(() => {
  fakeStore.clear();
});

describe("折叠入口默认值与记忆", () => {
  test("编辑画布默认展开，canvas_present 默认折叠", () => {
    expect(resolveCardCollapse(undefined, false)).toBe(CANVAS_CARD_COLLAPSE);
    expect(CANVAS_CARD_COLLAPSE.defaultExpanded).toBe(true);
    expect(resolveCardCollapse(undefined, true).defaultExpanded).toBe(true);
    expect(PRESENT_CARD_COLLAPSE.defaultExpanded).toBe(false);
    // 显式指定的入口优先
    expect(resolveCardCollapse(PRESENT_CARD_COLLAPSE, false)).toBe(PRESENT_CARD_COLLAPSE);
  });

  test("没有记忆时返回 undefined，由入口默认值兜底", () => {
    expect(readCardExpanded("canvas", uniqueId())).toBeUndefined();
  });

  test("状态按入口与卡片隔离，并落盘到 localStorage", () => {
    const cardA = uniqueId();
    const cardB = uniqueId();

    writeCardExpanded("canvas", cardA, false);
    writeCardExpanded("present", cardA, true);

    expect(readCardExpanded("canvas", cardA)).toBe(false);
    expect(readCardExpanded("present", cardA)).toBe(true);
    // 同入口的其他卡片不受影响
    expect(readCardExpanded("canvas", cardB)).toBeUndefined();
    // 其他入口不受影响
    expect(readCardExpanded("canvas-readonly", cardA)).toBeUndefined();
    // 落盘（刷新 / 重新进入的来源）
    expect(fakeStore.get(`canvas:card-collapse:canvas:${cardA}`)).toBe("0");
    expect(fakeStore.get(`canvas:card-collapse:present:${cardA}`)).toBe("1");
  });

  test("内存里没有记录时从落盘状态恢复", () => {
    const card = uniqueId();
    fakeStore.set(`canvas:card-collapse:canvas:${card}`, "0");
    expect(readCardExpanded("canvas", card)).toBe(false);
  });
});

function understanding(id: string, height: number): CanvasElementDTO {
  return {
    id,
    canvasId: "cv",
    parentId: null,
    x: 0,
    y: 0,
    width: 340,
    height,
    zIndex: 1,
    createdAt: "t",
    updatedAt: "t",
    kind: "understanding",
    understandingId: `th-${id}`,
    canvasRefId: null,
    props: {},
  };
}

describe("折叠状态 → 节点尺寸计划", () => {
  test("折叠时收成标题行高度，并记住展开高度", () => {
    const memory = new Map<string, number>();
    const plan = planCollapseSizes(
      [{ id: "card", height: 480, expandedHeight: 480 }],
      new Set(["card"]),
      new Map([["card", 39]]),
      memory,
    );
    expect(plan.resizes).toEqual([{ id: "card", height: 39 }]);
    expect(plan.pushAnchors).toEqual([]);
    expect(memory.get("card")).toBe(480);
  });

  test("展开时还原记住（或文档里的）展开高度，并要求检查避让", () => {
    const memory = new Map([["card", 480]]);
    const plan = planCollapseSizes(
      [{ id: "card", height: 39, expandedHeight: 260 }],
      new Set(),
      new Map(),
      memory,
    );
    expect(plan.resizes).toEqual([{ id: "card", height: 480 }]);
    expect(plan.pushAnchors).toEqual(["card"]);
    expect(memory.size).toBe(0);

    const noMemory = planCollapseSizes(
      [{ id: "card2", height: 39, expandedHeight: 260 }],
      new Set(),
      new Map(),
      new Map(),
    );
    expect(noMemory.resizes).toEqual([{ id: "card2", height: 260 }]);
  });

  test("量测纠正折叠高度时不覆盖展开高度记忆", () => {
    const memory = new Map<string, number>();
    const first = planCollapseSizes(
      [{ id: "card", height: 620, expandedHeight: 620 }],
      new Set(["card"]),
      new Map(),
      memory,
    );
    // 首帧用估值，随后长标题量到两行高度
    expect(first.resizes).toEqual([{ id: "card", height: COLLAPSED_CARD_HEIGHT_FALLBACK }]);
    const second = planCollapseSizes(
      [{ id: "card", height: COLLAPSED_CARD_HEIGHT_FALLBACK, expandedHeight: 620 }],
      new Set(["card"]),
      new Map([["card", 55]]),
      memory,
    );
    expect(second.resizes).toEqual([{ id: "card", height: 55 }]);
    expect(memory.get("card")).toBe(620);
  });

  test("尺寸已正确时不产生变更", () => {
    const plan = planCollapseSizes(
      [{ id: "card", height: 480, expandedHeight: 480 }],
      new Set(),
      new Map(),
      new Map(),
    );
    expect(plan).toEqual({ resizes: [], pushAnchors: [] });
  });
});

describe("展开后的避让下推", () => {
  const anchor = { id: "anchor", x: 100, y: 100, width: 340, height: 580 };

  test("只推动横向相交且被展开框压住的节点", () => {
    const shifts = planPushDown(
      [
        anchor,
        { id: "below", x: 140, y: 560, width: 340, height: 200 },
        { id: "far", x: 140, y: 1200, width: 340, height: 200 },
        { id: "side", x: 600, y: 560, width: 340, height: 200 },
      ],
      "anchor",
    );
    // 展开框底 680 + 间距 16 - 邻居顶 560
    expect(shifts.get("below")).toBe(136);
    expect(shifts.has("far")).toBe(false);
    expect(shifts.has("side")).toBe(false);
    expect(shifts.has("anchor")).toBe(false);
  });

  test("下推沿链传递，不留重叠", () => {
    const shifts = planPushDown(
      [
        anchor,
        { id: "below", x: 100, y: 560, width: 340, height: 200 },
        { id: "chain", x: 100, y: 780, width: 340, height: 200 },
      ],
      "anchor",
    );
    const below = 560 + (shifts.get("below") ?? 0);
    const chain = 780 + (shifts.get("chain") ?? 0);
    expect(below).toBe(696);
    expect(chain).toBeGreaterThanOrEqual(below + 200 + 16);
  });

  test("锚点不存在时不移动任何节点", () => {
    expect(planPushDown([anchor], "missing").size).toBe(0);
  });
});

describe("回写文档时还原展开高度", () => {
  test("只改折叠卡的高度，其余元素保持同一引用", () => {
    const collapsedCard = understanding("collapsed", 39);
    const untouched = understanding("other", 300);
    const document: CanvasDocument = { elements: [collapsedCard, untouched], edges: [] };
    const next = withExpandedHeights(document, new Map([["collapsed", 480]]));
    expect(next.elements[0].height).toBe(480);
    expect(next.elements[1]).toBe(untouched);
    expect(document.elements[0].height).toBe(39);
  });

  test("没有折叠卡时原样返回", () => {
    const document: CanvasDocument = { elements: [understanding("a", 300)], edges: [] };
    expect(withExpandedHeights(document, new Map())).toBe(document);
  });
});
