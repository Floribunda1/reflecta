import type { Graph as G6Graph, IElementEvent } from "@antv/g6";
import { Button } from "@renderer/components/ui/button";
import { Skeleton } from "@renderer/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@renderer/components/ui/tooltip";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KnowledgeGraphData } from "./graph-data";
import { buildGraphSelectionStates } from "./graph-data";
import { readKnowledgeGraphTheme } from "./graph-theme";

function topologyKey(data: KnowledgeGraphData): string {
  return `${data.nodes.map(({ id }) => id).join("|")}::${data.edges.map(({ id }) => id).join("|")}`;
}

function titleKey(data: KnowledgeGraphData): string {
  return data.nodes.map(({ id, data: nodeData }) => `${id}:${nodeData.title}`).join("|");
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
    const states = buildGraphSelectionStates(dataRef.current, selectedRef.current);
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
          background: theme.background,
          animation: false,
          data: dataRef.current,
          zoomRange: [0.15, 2],
          padding: 48,
          layout: {
            type: "d3-force",
            preLayout: true,
            animation: false,
            iterations: 300,
            manyBody: { strength: -700, distanceMax: 900 },
            link: { distance: 280, strength: 0.35, iterations: 2 },
            collide: { radius: 126, strength: 1, iterations: 2 },
            x: { strength: 0.04 },
            y: { strength: 0.04 },
          },
          behaviors: ["drag-canvas", "zoom-canvas", { type: "drag-element-force", fixed: true }],
          plugins: [
            {
              type: "minimap",
              key: "knowledge-wander-minimap",
              className: "knowledge-wander-minimap",
              size: [160, 104],
              padding: 8,
              position: "right-bottom",
              containerStyle: {
                backgroundColor: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-xs)",
                margin: "12px",
                overflow: "hidden",
                zIndex: "1",
              },
              maskStyle: {
                background: "color-mix(in srgb, var(--primary), transparent 84%)",
                border: "1px solid var(--primary)",
              },
            },
          ],
          node: {
            type: "rect",
            style: {
              size: [220, 72],
              radius: 10,
              fill: theme.card,
              stroke: theme.border,
              lineWidth: 1,
              cursor: "pointer",
              labelText: (datum) => String(datum.data?.title ?? "未命名理解"),
              labelFill: theme.foreground,
              labelFontSize: 13,
              labelFontWeight: 500,
              labelTextAlign: "center",
              labelTextBaseline: "middle",
              labelWordWrap: true,
              labelMaxWidth: 184,
              labelMaxLines: 3,
              labelTextOverflow: "ellipsis",
            },
            state: {
              hover: {
                stroke: theme.mutedForeground,
                lineWidth: 1.5,
              },
              selected: {
                stroke: theme.primary,
                lineWidth: 2,
              },
            },
          },
          edge: {
            type: "line",
            style: {
              stroke: theme.border,
              lineWidth: 1,
              opacity: 0.72,
            },
            state: {
              selected: {
                stroke: theme.primary,
                lineWidth: 2,
                opacity: 1,
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
    <section
      data-testid="knowledge-wander-graph"
      className="relative h-full overflow-hidden bg-background/35"
    >
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
          <div className="absolute bottom-3 left-3 flex flex-col overflow-hidden rounded-md border bg-card shadow-xs">
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
    </section>
  );
}
