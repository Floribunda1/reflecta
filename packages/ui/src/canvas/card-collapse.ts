import type { CanvasDocument } from "@reflecta/shared";

/**
 * 画布理解卡的折叠状态 + 展开时的避让布局（纯逻辑，不含渲染）。
 *
 * 折叠是「当前用户怎么看这张画布」的视图偏好，不是画布数据：
 * - 记忆落在 localStorage（与 renderer 侧 Atom.kvs 同一 localStorage 机制），按入口 + 卡片隔离；
 * - 不写进画布文档：文档里的高度语义恒为「展开高度」，折叠态由本机记忆跨刷新 / 重进恢复
 *   （跨设备同步不在本次范围）。
 */

export type CanvasCardCollapse = {
  /** 记忆隔离维度：不同入口各自记忆，互不覆盖彼此的默认体验。 */
  scope: string;
  /** 该入口首次展示（无记忆）时的默认值。 */
  defaultExpanded: boolean;
};

/** 可编辑画布入口：默认展开。 */
export const CANVAS_CARD_COLLAPSE: CanvasCardCollapse = { scope: "canvas", defaultExpanded: true };

/** 只读查看入口（引用对话框等）：默认展开，与编辑画布各记一份。 */
export const READONLY_CARD_COLLAPSE: CanvasCardCollapse = {
  scope: "canvas-readonly",
  defaultExpanded: true,
};

/** 对话内 canvas_present 入口：首次展示默认折叠。 */
export const PRESENT_CARD_COLLAPSE: CanvasCardCollapse = {
  scope: "present",
  defaultExpanded: false,
};

/** 未显式指定入口时按是否只读取默认值（只读预览沿用「默认展开」的现状）。 */
export function resolveCardCollapse(
  cardCollapse: CanvasCardCollapse | undefined,
  readonly: boolean,
): CanvasCardCollapse {
  if (cardCollapse) return cardCollapse;
  return readonly ? READONLY_CARD_COLLAPSE : CANVAS_CARD_COLLAPSE;
}

/** 记忆条目的画布隔离：卡 id 全局唯一（每次新建随机生成），画布之间天然不串。 */
const STORAGE_PREFIX = "canvas:card-collapse";

/** 首次渲染（量测尚未回来）时的折叠高度估值；随后由卡片量到的真实标题行高度纠正。 */
export const COLLAPSED_CARD_HEIGHT_FALLBACK = 40;

/** 展开时给被压住的邻居留出的间距（避免边框贴边框）。 */
const PUSH_GAP = 16;

/** 会话内缓存：文档每次回写都会重算折叠态，避免重复读 localStorage。 */
const memory = new Map<string, boolean>();

function storage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    const store = (globalThis as { localStorage?: Partial<Storage> }).localStorage;
    return typeof store?.getItem === "function" && typeof store.setItem === "function"
      ? (store as Pick<Storage, "getItem" | "setItem">)
      : null;
  } catch {
    // 隐私模式 / 存储被禁用：记忆退化为本次会话（内存）。
    return null;
  }
}

function storageKey(scope: string, elementId: string): string {
  return `${STORAGE_PREFIX}:${scope}:${elementId}`;
}

/** 读取已记录的展开状态；没有记录时返回 undefined，由入口默认值兜底。 */
export function readCardExpanded(scope: string, elementId: string): boolean | undefined {
  const key = storageKey(scope, elementId);
  const cached = memory.get(key);
  if (cached !== undefined) return cached;
  const raw = storage()?.getItem(key);
  const saved = raw === "1" ? true : raw === "0" ? false : undefined;
  if (saved !== undefined) memory.set(key, saved);
  return saved;
}

/** 记录展开状态：落盘（刷新 / 重新进入后恢复），内存缓存同源。 */
export function writeCardExpanded(scope: string, elementId: string, expanded: boolean): void {
  const key = storageKey(scope, elementId);
  memory.set(key, expanded);
  try {
    storage()?.setItem(key, expanded ? "1" : "0");
  } catch {
    // 配额 / 权限异常：保留内存记忆，不影响当前会话。
  }
}

export type CanvasBox = { id: string; x: number; y: number; width: number; height: number };

export type CollapseNode = {
  id: string;
  /** 节点当前高度 */
  height: number;
  /** 文档里的高度：展开高度的权威来源 */
  expandedHeight: number;
};

export type CollapseSizePlan = {
  /** 需要应用的高度（折叠取量到的标题行高度，展开取记忆 / 文档高度） */
  resizes: Array<{ id: string; height: number }>;
  /** 变高（展开）后需要检查避让的节点 */
  pushAnchors: string[];
};

/**
 * 折叠状态 → 节点尺寸计划（纯函数）。
 *
 * `expandedHeights` 是「当前折叠、展开时要还原的高度」记忆，由本函数就地维护：
 * 折叠时记下当时的展开高度，展开时消费掉——文档高度语义恒为展开高度，
 * 而节点 data 里的 DTO 可能是拖拽前的旧值，不能当展开高度用。
 */
export function planCollapseSizes(
  nodes: readonly CollapseNode[],
  collapsedIds: ReadonlySet<string>,
  collapsedHeights: ReadonlyMap<string, number>,
  expandedHeights: Map<string, number>,
): CollapseSizePlan {
  const resizes: CollapseSizePlan["resizes"] = [];
  const pushAnchors: string[] = [];
  for (const node of nodes) {
    if (collapsedIds.has(node.id)) {
      const target = collapsedHeights.get(node.id) ?? COLLAPSED_CARD_HEIGHT_FALLBACK;
      if (Math.abs(node.height - target) < 0.5) continue;
      // 只在「从展开高度收下来」时记，避免二次收窄（标题换行）覆盖真正的展开高度。
      if (node.height > target && !expandedHeights.has(node.id))
        expandedHeights.set(node.id, node.height);
      resizes.push({ id: node.id, height: target });
      continue;
    }
    const target = expandedHeights.get(node.id) ?? node.expandedHeight;
    if (Math.abs(node.height - target) < 0.5) {
      expandedHeights.delete(node.id);
      continue;
    }
    if (target > node.height) pushAnchors.push(node.id);
    expandedHeights.delete(node.id);
    resizes.push({ id: node.id, height: target });
  }
  return { resizes, pushAnchors };
}

const horizontalOverlap = (a: CanvasBox, b: CanvasBox): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width;

const verticalOverlap = (a: CanvasBox, b: CanvasBox): boolean =>
  a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * 展开后把被压住的节点整体下推，直到没有任何重叠：nodeId → 向下位移。
 *
 * 只推与展开框（及其传递下推结果）相交的节点，其余节点不动；位移方向单一向下，
 * 因此每轮只会累加、可达几何有限，必然收敛（最多 n 轮后无变化即结束）。
 */
export function planPushDown(
  boxes: readonly CanvasBox[],
  anchorId: string,
  gap = PUSH_GAP,
): Map<string, number> {
  const shifts = new Map<string, number>();
  if (!boxes.some((box) => box.id === anchorId)) return shifts;
  const others = boxes.filter((box) => box.id !== anchorId);
  const shifted = (box: CanvasBox): CanvasBox => ({
    ...box,
    y: box.y + (shifts.get(box.id) ?? 0),
  });

  for (let pass = 0; pass <= others.length; pass += 1) {
    let moved = false;
    for (const box of others) {
      const current = shifted(box);
      let push = 0;
      for (const obstacle of boxes) {
        if (obstacle.id === box.id) continue;
        const other = shifted(obstacle);
        if (!horizontalOverlap(current, other) || !verticalOverlap(current, other)) continue;
        push = Math.max(push, other.y + other.height + gap - current.y);
      }
      if (push <= 0) continue;
      shifts.set(box.id, (shifts.get(box.id) ?? 0) + push);
      moved = true;
    }
    if (!moved) break;
  }
  return shifts;
}

/**
 * 回写文档时把折叠卡的高度还原成展开高度：折叠高度只是展示态，
 * 否则任何一次拖拽回写都会把折叠高度固化进文档，重新展开就再也回不到原高度。
 */
export function withExpandedHeights(
  document: CanvasDocument,
  expandedHeights: ReadonlyMap<string, number>,
): CanvasDocument {
  if (expandedHeights.size === 0) return document;
  return {
    ...document,
    elements: document.elements.map((element) => {
      const height = expandedHeights.get(element.id);
      return height === undefined || height === element.height ? element : { ...element, height };
    }),
  };
}
