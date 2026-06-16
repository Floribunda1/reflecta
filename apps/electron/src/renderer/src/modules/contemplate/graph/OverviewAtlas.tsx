import type { CSSProperties } from "react";
import type { Category } from "@shared/category";
import type { ThoughtSummaryDTO } from "@shared/thought";
import { cn } from "@renderer/lib/utils";

type AtlasNode = {
  id: string;
  categoryId: string | null;
  label: string;
  count: number;
  ownCount: number;
  children: AtlasNode[];
};

type AtlasRect = {
  node: AtlasNode;
  depth: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

function buildAtlas(categories: Category[], thoughts: ThoughtSummaryDTO[]): AtlasNode[] {
  const nodes = new Map<string, AtlasNode>();
  const roots: AtlasNode[] = [];

  for (const category of categories) {
    nodes.set(category.id, {
      id: category.id,
      categoryId: category.id,
      label: category.name,
      count: 0,
      ownCount: 0,
      children: [],
    });
  }

  for (const category of categories) {
    const node = nodes.get(category.id)!;
    const parent = category.parentId ? nodes.get(category.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const uncategorized: AtlasNode = {
    id: "uncategorized",
    categoryId: null,
    label: "未归类",
    count: 0,
    ownCount: 0,
    children: [],
  };

  for (const thought of thoughts) {
    const categoryId = thought.categoryIds[0];
    const node = categoryId ? nodes.get(categoryId) : null;
    if (node) node.ownCount += 1;
    else uncategorized.ownCount += 1;
  }

  const rollup = (node: AtlasNode): number => {
    node.count = node.ownCount + node.children.reduce((sum, child) => sum + rollup(child), 0);
    node.children = node.children
      .filter((child) => child.count > 0)
      .sort((a, b) => b.count - a.count);
    return node.count;
  };

  const result = roots.filter((node) => rollup(node) > 0).sort((a, b) => b.count - a.count);
  if (uncategorized.ownCount > 0) {
    uncategorized.count = uncategorized.ownCount;
    result.push(uncategorized);
  }
  return result;
}

function sliceTreemap(nodes: AtlasNode[], x: number, y: number, w: number, h: number): AtlasRect[] {
  const total = nodes.reduce((sum, node) => sum + node.count, 0);
  if (total <= 0) return [];

  let offset = 0;
  const splitX = w >= h;
  return nodes.map((node) => {
    const share = node.count / total;
    const rect = splitX
      ? { node, depth: 0, x: x + offset, y, w: w * share, h }
      : { node, depth: 0, x, y: y + offset, w, h: h * share };
    offset += splitX ? rect.w : rect.h;
    return rect;
  });
}

function collectRects(nodes: AtlasNode[], x = 0, y = 0, w = 100, h = 100, depth = 0): AtlasRect[] {
  const rects = sliceTreemap(nodes, x, y, w, h).map((rect) => ({ ...rect, depth }));
  const children: AtlasRect[] = [];
  for (const rect of rects) {
    if (rect.node.children.length === 0 || rect.w < 14 || rect.h < 12) continue;
    children.push(
      ...collectRects(
        rect.node.children,
        rect.x + 1.2,
        rect.y + 6.2,
        Math.max(0, rect.w - 2.4),
        Math.max(0, rect.h - 7.4),
        depth + 1,
      ),
    );
  }
  return [...rects, ...children];
}

function tileStyle(rect: AtlasRect): CSSProperties {
  const density = Math.max(10, 30 - Math.min(rect.node.count, 24));
  return {
    left: `${rect.x}%`,
    top: `${rect.y}%`,
    width: `${rect.w}%`,
    height: `${rect.h}%`,
    backgroundImage: "radial-gradient(circle, hsl(38 58% 58% / 0.28) 1px, transparent 1.2px)",
    backgroundSize: `${density}px ${density}px`,
  };
}

export function OverviewAtlas({
  categories,
  thoughts,
  onSelectCategory,
}: {
  categories: Category[];
  thoughts: ThoughtSummaryDTO[];
  onSelectCategory: (categoryId: string) => void;
}) {
  const nodes = buildAtlas(categories, thoughts);
  const rects = collectRects(nodes);

  return (
    <div className="absolute inset-0 overflow-hidden bg-background px-8 pb-8 pt-24 text-foreground">
      <div className="relative h-full w-full">
        {rects.map((rect) => (
          <button
            key={`${rect.depth}:${rect.node.id}`}
            type="button"
            className={cn(
              "absolute overflow-hidden rounded-md border border-amber-500/20 bg-amber-500/[0.035] p-2 text-left transition-colors hover:border-amber-400/60 hover:bg-amber-500/[0.08]",
              rect.depth > 0 && "border-cyan-400/20 bg-cyan-400/[0.035]",
            )}
            style={tileStyle(rect)}
            disabled={!rect.node.categoryId}
            onClick={() => {
              if (rect.node.categoryId) onSelectCategory(rect.node.categoryId);
            }}
          >
            <div className="flex min-w-0 items-center gap-2 text-xs">
              <span className="truncate font-medium">{rect.node.label}</span>
              <span className="shrink-0 text-muted-foreground">{rect.node.count}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
