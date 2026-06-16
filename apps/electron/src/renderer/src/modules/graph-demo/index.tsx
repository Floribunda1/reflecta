import { ExternalLink, Filter, Search, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import { cn } from "@renderer/lib/utils";

type GraphScope = "all" | "workflow" | "unlinked" | "no-source";

type GraphNode = {
  id: string;
  title: string;
  domain: string;
  x: number;
  y: number;
  hasSource: boolean;
  sourceLabel: string;
  linksLabel: string;
  summary: string;
};

type GraphEdge = {
  id: string;
  from: string;
  to: string;
};

const nodes: GraphNode[] = [
  {
    id: "workflow-define",
    title: "AI调教落地：工作流先定义再试点迭代",
    domain: "workflow 搭建",
    x: 245,
    y: 155,
    hasSource: true,
    sourceLabel: "2 个 experience source",
    linksLabel: "2 个相关连接",
    summary: "先定义 workflow，再用小模块试点，根据结果 clarification。",
  },
  {
    id: "workflow-debug",
    title: "AI工作流调试能力：决定能否产出可靠结果",
    domain: "workflow 搭建",
    x: 455,
    y: 185,
    hasSource: false,
    sourceLabel: "暂无 source",
    linksLabel: "3 个相关连接",
    summary: "如果自己无法 debug 工作流，Agent 更不可能稳定执行。",
  },
  {
    id: "workflow-checklist",
    title: "AI执行偏差：用详细Checklist约束落地尺度",
    domain: "workflow 搭建",
    x: 645,
    y: 125,
    hasSource: true,
    sourceLabel: "1 个 experience source",
    linksLabel: "1 个相关连接",
    summary: "面对会过度执行的 AI，需要用 checklist 控制尺度。",
  },
  {
    id: "workflow-subtract",
    title: "workflow 多做减法",
    domain: "workflow 搭建",
    x: 555,
    y: 335,
    hasSource: false,
    sourceLabel: "暂无 source",
    linksLabel: "暂时独立",
    summary: "对 AI 给出的 workflow 做复杂度收敛，不追求大而全。",
  },
  {
    id: "workflow-boundary",
    title: "工作流职责边界：PRD重点未定义导致跑偏",
    domain: "workflow 搭建",
    x: 260,
    y: 360,
    hasSource: true,
    sourceLabel: "1 个 experience source",
    linksLabel: "1 个相关连接",
    summary: "AI 产出跑偏时，可能是上游 PRD 没有定义清楚重点。",
  },
  {
    id: "skill-small",
    title: "Agent skill：小步控制变量收敛",
    domain: "skill",
    x: 760,
    y: 300,
    hasSource: true,
    sourceLabel: "1 个 experience source",
    linksLabel: "2 个相关连接",
    summary: "agent skill 是混沌工程，需要小步改动、benchmark 和 human in the loop。",
  },
  {
    id: "skill-boundary",
    title: "认知边界：AI能力的天花板",
    domain: "skill",
    x: 820,
    y: 485,
    hasSource: true,
    sourceLabel: "1 个 experience source",
    linksLabel: "1 个相关连接",
    summary: "AI 只能在用户的理解边界内工作，不能代替用户形成理解。",
  },
  {
    id: "pmf-target",
    title: "PMF - Target Customer",
    domain: "产品设计",
    x: 130,
    y: 520,
    hasSource: true,
    sourceLabel: "3 个 source",
    linksLabel: "1 个相关连接",
    summary: "Target Customer 要能闭环产品的核心价值，而不是只描述画像。",
  },
  {
    id: "wireframe",
    title: "UX验证：AI可直接生成wireframe",
    domain: "workflow 搭建",
    x: 430,
    y: 535,
    hasSource: false,
    sourceLabel: "暂无 source",
    linksLabel: "暂时独立",
    summary: "目前只是一句记录，还缺少适用场景和边界。",
  },
];

const edges: GraphEdge[] = [
  { id: "define-debug", from: "workflow-define", to: "workflow-debug" },
  { id: "debug-checklist", from: "workflow-debug", to: "workflow-checklist" },
  { id: "debug-subtract", from: "workflow-debug", to: "workflow-subtract" },
  { id: "define-small", from: "workflow-define", to: "skill-small" },
  { id: "boundary-pmf", from: "workflow-boundary", to: "pmf-target" },
  { id: "small-boundary", from: "skill-small", to: "skill-boundary" },
];

const scopes: { value: GraphScope; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "workflow", label: "当前领域" },
  { value: "unlinked", label: "未连接" },
  { value: "no-source", label: "无来源" },
];

function getVisibleNodes(scope: GraphScope) {
  if (scope === "workflow") return nodes.filter((node) => node.domain === "workflow 搭建");
  if (scope === "no-source") return nodes.filter((node) => !node.hasSource);
  if (scope === "unlinked") {
    return nodes.filter(
      (node) => !edges.some((edge) => edge.from === node.id || edge.to === node.id),
    );
  }
  return nodes;
}

function getVisibleEdges(visibleNodes: GraphNode[]) {
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  return edges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to));
}

function getNode(id: string) {
  return nodes.find((node) => node.id === id);
}

function getNodeTone(node: GraphNode, linked: boolean) {
  if (!node.hasSource && !linked) {
    return "border-dashed border-amber-400 bg-amber-50 text-amber-950";
  }
  if (!node.hasSource) return "border-amber-400 bg-amber-50 text-amber-950";
  if (!linked)
    return "border-dashed border-muted-foreground/45 bg-background text-muted-foreground";
  return "border-primary/50 bg-background text-foreground";
}

function getConnectionSummary(nodeId: string) {
  const linkedCount = edges.filter((edge) => edge.from === nodeId || edge.to === nodeId).length;

  if (linkedCount === 0) return "暂时独立";
  return `${linkedCount} 个相关连接`;
}

function NodeDetail({
  node,
  linked,
  onClose,
}: {
  node: GraphNode;
  linked: boolean;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-5 top-20 z-20 w-[320px] rounded-md border bg-card shadow-lg">
      <div className="flex items-start justify-between gap-4 border-b p-4">
        <div>
          <div className="text-xs text-muted-foreground">{node.domain}</div>
          <h2 className="mt-2 text-base font-semibold leading-6">{node.title}</h2>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="关闭详情">
          <X />
        </Button>
      </div>
      <div className="space-y-4 p-4">
        <p className="text-sm leading-6 text-muted-foreground">{node.summary}</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border bg-background p-3">
            <div className="text-xs text-muted-foreground">来源</div>
            <div className="mt-1 text-sm font-medium">{node.sourceLabel}</div>
          </div>
          <div className="rounded-md border bg-background p-3">
            <div className="text-xs text-muted-foreground">连接</div>
            <div className="mt-1 text-sm font-medium">{getConnectionSummary(node.id)}</div>
          </div>
        </div>
        <div className="rounded-md border bg-background p-3 text-sm leading-6">
          {!node.hasSource
            ? "这条理解还没有来源。适合回到原笔记补一段具体 Context。"
            : linked
              ? "这条理解已经有来源，也处在关系网里。可以继续打开原笔记整理表达。"
              : "这条理解有来源，但暂时没有连接。可以回看是否和相邻笔记有关。"}
        </div>
        <Button className="w-full" variant="outline">
          <ExternalLink />
          打开笔记
        </Button>
      </div>
    </div>
  );
}

export function GraphTerrainDemo() {
  const [scope, setScope] = useState<GraphScope>("all");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const scopedNodes = getVisibleNodes(scope);
  const visibleNodes = normalizedQuery
    ? scopedNodes.filter((node) =>
        `${node.title} ${node.domain}`.toLowerCase().includes(normalizedQuery),
      )
    : scopedNodes;
  const visibleEdges = getVisibleEdges(visibleNodes);
  const [selectedNodeId, setSelectedNodeId] = useState(nodes[0].id);
  const selectedNode =
    visibleNodes.find((node) => node.id === selectedNodeId) ?? visibleNodes[0] ?? null;
  const linkedNodeIds = new Set(visibleEdges.flatMap((edge) => [edge.from, edge.to]));
  const viewBox = "0 0 980 660";

  function selectScope(nextScope: GraphScope) {
    const nextNodes = getVisibleNodes(nextScope);
    setScope(nextScope);
    setSelectedNodeId((current) =>
      nextNodes.some((node) => node.id === current) ? current : (nextNodes[0]?.id ?? nodes[0].id),
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-sm font-semibold">Graph</div>
            <div className="text-xs text-muted-foreground">
              单画布笔记图谱 · 节点是理解，边是关系
            </div>
          </div>
          <div className="hidden w-[260px] items-center gap-2 rounded-md border bg-background px-2 md:flex">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <Input
              className="h-8 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
              placeholder="搜索笔记或领域"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          {scopes.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={scope === item.value ? "default" : "outline"}
              onClick={() => selectScope(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_1px_1px,color-mix(in_srgb,var(--border),transparent_30%)_1px,transparent_0)] bg-[length:28px_28px]">
        <div className="absolute left-5 top-5 z-10 rounded-md border bg-card/95 p-3 text-xs leading-5 shadow-sm backdrop-blur">
          <div className="font-medium">图例</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="size-2 rounded-full border border-primary/50 bg-background" />
            有来源
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="size-2 rounded-full border border-amber-400 bg-amber-100" />
            无来源
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="size-2 rounded-full border border-dashed border-muted-foreground" />
            未连接
          </div>
          <div className="mt-2 h-px bg-border" />
          <div className="mt-2 flex items-center gap-2">
            <span className="h-px w-5 bg-foreground/40" />
            相关连接
          </div>
        </div>

        <svg className="h-full w-full" viewBox={viewBox} role="img" aria-label="Graph demo">
          <g opacity="0.62">
            <ellipse cx="440" cy="300" rx="310" ry="230" fill="var(--muted)" opacity="0.36" />
            <text x="130" y="92" fill="var(--muted-foreground)" fontSize="14" fontWeight="600">
              workflow 搭建
            </text>
            <ellipse cx="790" cy="392" rx="150" ry="170" fill="var(--muted)" opacity="0.22" />
            <text x="780" y="604" fill="var(--muted-foreground)" fontSize="14" fontWeight="600">
              skill
            </text>
            <ellipse cx="130" cy="520" rx="118" ry="74" fill="var(--muted)" opacity="0.18" />
            <text x="42" y="612" fill="var(--muted-foreground)" fontSize="14" fontWeight="600">
              产品设计
            </text>
          </g>

          {visibleEdges.map((edge) => {
            const from = getNode(edge.from);
            const to = getNode(edge.to);
            if (!from || !to) return null;

            return (
              <line
                key={edge.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="var(--foreground)"
                strokeOpacity={0.22}
                strokeWidth={2}
              />
            );
          })}

          {visibleNodes.map((node) => {
            const linked = linkedNodeIds.has(node.id);
            const selected = selectedNode?.id === node.id;

            return (
              <foreignObject key={node.id} x={node.x - 85} y={node.y - 34} width="170" height="78">
                <button
                  type="button"
                  className={cn(
                    "h-[68px] w-[170px] rounded-md border px-3 py-2 text-left text-xs leading-4 shadow-sm transition-transform hover:-translate-y-0.5",
                    getNodeTone(node, linked),
                    selected && "ring-2 ring-primary/25",
                  )}
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  <span className="line-clamp-2 font-medium">{node.title}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-[11px] opacity-70">
                    <span>{node.domain}</span>
                  </span>
                </button>
              </foreignObject>
            );
          })}
        </svg>

        {visibleNodes.length === 0 ? (
          <div className="absolute left-1/2 top-1/2 w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-md border bg-card p-4 text-center shadow-sm">
            <div className="text-sm font-medium">没有匹配的节点</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              换一个关键词，或回到全部视图继续浏览。
            </div>
          </div>
        ) : null}

        {selectedNode ? (
          <NodeDetail
            node={selectedNode}
            linked={linkedNodeIds.has(selectedNode.id)}
            onClose={() => setSelectedNodeId("")}
          />
        ) : null}

        <div className="absolute bottom-5 left-5 max-w-[520px] rounded-md border bg-card/95 px-3 py-2 text-xs leading-5 text-muted-foreground shadow-sm backdrop-blur">
          点击节点查看来源和连接状态；从详情进入原笔记继续补来源、补双链或修正理解。
        </div>
      </main>
    </div>
  );
}
