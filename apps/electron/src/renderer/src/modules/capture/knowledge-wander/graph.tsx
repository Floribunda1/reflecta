import type { Graph as G6Graph, IElementEvent } from "@antv/g6";
import { Button } from "@renderer/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@renderer/components/ui/empty";
import { Skeleton } from "@renderer/components/ui/skeleton";
import { cn } from "@renderer/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@renderer/components/ui/tooltip";
import { Link2, Maximize2, Unlink2, Waypoints, ZoomIn, ZoomOut } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KnowledgeGraphData } from "./graph-data";
import { buildGraphSelectionStates, splitKnowledgeGraphData } from "./graph-data";
import { readKnowledgeGraphTheme } from "./graph-theme";

function topologyKey(data: KnowledgeGraphData): string {
  return `${data.nodes.map(({ id }) => id).join("|")}::${data.edges.map(({ id }) => id).join("|")}`;
}

function titleKey(data: KnowledgeGraphData): string {
  return data.nodes.map(({ id, data: nodeData }) => `${id}:${nodeData.title}`).join("|");
}

function ConnectedGraphCanvas({
  data,
  selectedUnderstandingId,
  onSelect,
}: {
  data: KnowledgeGraphData;
  selectedUnderstandingId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<G6Graph | null>(null);
  const dataRef = useRef(data);
  const selectedRef = useRef(selectedUnderstandingId);
  const hoveredRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const { resolvedTheme } = useTheme();
  const graphTopologyKey = useMemo(() => topologyKey(data), [data]);
  const graphTitleKey = useMemo(() => titleKey(data), [data]);

  dataRef.current = data;
  selectedRef.current = selectedUnderstandingId;
  onSelectRef.current = onSelect;

  const applyElementStates = useCallback((graph: G6Graph) => {
    const focusId = hoveredRef.current ?? selectedRef.current;
    const states = buildGraphSelectionStates(dataRef.current, focusId);
    if (hoveredRef.current && states[hoveredRef.current]) {
      states[hoveredRef.current] = [...states[hoveredRef.current], "hover"];
    }
    void graph.setElementState(states, false);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let graph: G6Graph | null = null;
    let observer: ResizeObserver | null = null;
    setReady(false);
    setFailed(false);

    void import("@antv/g6")
      .then(async ({ Graph, NodeEvent }) => {
        if (cancelled) return;
        const theme = readKnowledgeGraphTheme();

        graph = new Graph({
          container,
          autoResize: false,
          animation: false,
          data: dataRef.current,
          zoomRange: [0.15, 2],
          padding: 56,
          layout: {
            type: "force-atlas2",
            preLayout: true,
            animation: false,
            iterations: 320,
            mode: "linlog",
            preventOverlap: true,
            nodeSize: 184,
            kr: 24,
            kg: 6,
          },
          behaviors: ["drag-canvas", "zoom-canvas", "drag-element"],
          node: {
            type: "rect",
            style: {
              size: [176, 54],
              radius: 12,
              fill: theme.card,
              stroke: theme.border,
              lineWidth: 1.5,
              cursor: "pointer",
              labelText: (datum) => String(datum.data?.title ?? "未命名理解"),
              labelPlacement: "center",
              labelFill: theme.foreground,
              labelFontSize: 13,
              labelFontWeight: 600,
              labelLineHeight: 17,
              labelTextAlign: "center",
              labelTextBaseline: "middle",
              labelWordWrap: true,
              labelMaxWidth: 148,
              labelMaxLines: 2,
              labelTextOverflow: "ellipsis",
            },
            state: {
              hover: {
                stroke: theme.primary,
                lineWidth: 2,
              },
              selected: {
                stroke: theme.primary,
                fill: theme.accent,
                lineWidth: 2,
              },
              related: {
                stroke: theme.primary,
                lineWidth: 1.5,
              },
              dimmed: {
                opacity: 0.2,
              },
            },
          },
          edge: {
            type: "line",
            style: {
              stroke: theme.mutedForeground,
              lineWidth: 1.5,
              opacity: 0.58,
            },
            state: {
              selected: {
                stroke: theme.primary,
                lineWidth: 2.25,
                opacity: 1,
              },
              dimmed: {
                opacity: 0.08,
              },
            },
          },
        });

        graphRef.current = graph;
        graph.on(NodeEvent.CLICK, (event) => {
          onSelectRef.current(String((event as IElementEvent).target.id));
        });
        graph.on(NodeEvent.POINTER_ENTER, (event) => {
          hoveredRef.current = String((event as IElementEvent).target.id);
          if (graph) applyElementStates(graph);
        });
        graph.on(NodeEvent.POINTER_LEAVE, () => {
          hoveredRef.current = null;
          if (graph) applyElementStates(graph);
        });

        await graph.render();
        if (cancelled) return;
        await graph.fitView({ when: "always", direction: "both" }, false);
        applyElementStates(graph);
        setReady(true);

        observer = new ResizeObserver(() => {
          if (container.clientWidth > 0 && container.clientHeight > 0) {
            graph?.resize();
          }
        });
        observer.observe(container);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      graph?.destroy();
      if (graphRef.current === graph) graphRef.current = null;
    };
  }, [applyElementStates, graphTopologyKey, resolvedTheme]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.updateNodeData(
      data.nodes.map((node) => ({
        id: node.id,
        data: node.data,
      })),
    );
    void graph.draw();
  }, [data.nodes, graphTitleKey]);

  useEffect(() => {
    const graph = graphRef.current;
    if (graph) applyElementStates(graph);
  }, [selectedUnderstandingId, applyElementStates]);

  const zoomIn = () => void graphRef.current?.zoomBy(1.2, false);
  const zoomOut = () => void graphRef.current?.zoomBy(1 / 1.2, false);
  const fitView = () =>
    void graphRef.current?.fitView({ when: "always", direction: "both" }, false);

  return (
    <div data-testid="knowledge-wander-connected-graph" className="relative h-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
      <div className="sr-only" aria-label="图谱理解">
        {data.nodes.map((node) => (
          <button key={node.id} type="button" onClick={() => onSelect(node.id)}>
            {node.data.title}
          </button>
        ))}
      </div>

      {!ready && !failed ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Skeleton className="h-24 w-52" />
        </div>
      ) : null}

      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          图谱加载失败
        </div>
      ) : null}

      {ready ? (
        <TooltipProvider>
          <div className="absolute bottom-3 left-3 flex flex-col overflow-hidden rounded-md bg-card shadow-sm ring-1 ring-foreground/10">
            {[
              { label: "放大", Icon: ZoomIn, action: zoomIn },
              { label: "缩小", Icon: ZoomOut, action: zoomOut },
              { label: "适应画布", Icon: Maximize2, action: fitView },
            ].map(({ label, Icon, action }) => (
              <Tooltip key={label}>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="rounded-none border-b last:border-b-0"
                      aria-label={label}
                      onClick={action}
                    >
                      <Icon size={15} />
                    </Button>
                  }
                />
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      ) : null}
    </div>
  );
}

export function KnowledgeGraph({
  data,
  selectedUnderstandingId,
  onSelect,
}: {
  data: KnowledgeGraphData;
  selectedUnderstandingId: string | null;
  onSelect: (id: string) => void;
}) {
  const { connected, unconnected } = useMemo(() => splitKnowledgeGraphData(data), [data]);
  const summary = `${connected.nodes.length} 条已连接 · ${unconnected.length} 条未连接 · ${connected.edges.length} 条显式连接`;

  return (
    <section
      data-testid="knowledge-wander-graph"
      className="flex h-full min-h-0 flex-col bg-muted/30"
    >
      <div className="relative min-h-0 flex-1">
        <div
          data-testid="knowledge-wander-graph-summary"
          className="absolute top-3 left-3 z-10 inline-flex items-center gap-2 rounded-lg bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow-sm ring-1 ring-foreground/10 backdrop-blur-sm"
        >
          <Link2 size={14} aria-hidden />
          {summary}
        </div>

        {connected.nodes.length > 0 ? (
          <ConnectedGraphCanvas
            data={connected}
            selectedUnderstandingId={selectedUnderstandingId}
            onSelect={onSelect}
          />
        ) : (
          <Empty className="h-full border-0 pt-20">
            <EmptyContent>
              <EmptyMedia variant="icon">
                <Waypoints />
              </EmptyMedia>
              <EmptyDescription>这个领域还没有形成显式连接</EmptyDescription>
            </EmptyContent>
          </Empty>
        )}
      </div>

      {unconnected.length > 0 ? (
        <div
          data-testid="knowledge-wander-unconnected"
          className="max-h-56 shrink-0 overflow-y-auto border-t bg-background/95 p-3"
        >
          <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
            <Unlink2 size={14} aria-hidden />
            未连接理解
            <span className="font-normal">{unconnected.length}</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
            {unconnected.map((node) => (
              <Button
                key={node.id}
                type="button"
                size="sm"
                variant="outline"
                title={node.data.title}
                aria-current={selectedUnderstandingId === node.id ? "true" : undefined}
                className={cn(
                  "h-auto min-h-9 justify-start py-2 text-left font-normal whitespace-normal",
                  selectedUnderstandingId === node.id && "border-primary bg-accent",
                )}
                onClick={() => onSelect(node.id)}
              >
                <span className="line-clamp-2">{node.data.title}</span>
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
